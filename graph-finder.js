/**
 * Graph Finder Module (v2 - Hierarchical Optimization)
 * =====================================================
 * Finds all non-isomorphic graphs with closed-form eigenvalues
 * 
 * Optimization Strategy:
 * 1. Build from smaller n: seed known families, use cached results
 * 2. Product graph pre-computation: Cartesian/Tensor products are instant
 * 3. Disconnected graphs: resolve via component lookup
 * 4. Polynomial caching: same polynomial = same analyticity
 * 5. Abel-Ruffini cutoff: skip degree > 4 irreducible factors
 */

import { 
    state, clearGraph, createVertex, addEdge, 
    getCirclePositions, getSpherePositions,
    getConcentricCirclePositions2, getConcentricCirclePositions3,
    getConcentricSpherePositions2
} from './graph-core.js';

import { 
    computeEigenvaluesNumerical, 
    computeSkewSymmetricEigenvalues,
    detectClosedForm,
    analyzeEigenvaluesForClosedForms,
    subscript,
    PolynomialFactorizer,
    SpectralEngine
} from './spectral-analysis.js';

import {
    computeCanonicalHash,
    computePolynomialHash,
    checkPolynomialCache,
    cachePolynomialResult,
    storeAnalyticGraph,
    getAnalyticGraphs,
    hasResultsForN,
    getStats,
    resetStats,
    precomputeProductGraphs,
    checkProductGraph,
    findConnectedComponents,
    resolveDisconnectedGraph,
    seedKnownFamilies,
    saveDatabase,
    loadDatabase,
    clearDatabase,
    initializeForN
} from './graph-database.js';

import { ChebyshevFactorizer } from './chebyshev-factorizer.js';

// =====================================================
// SEARCH STATE
// =====================================================

let searchCancelled = false;
let databaseInitialized = false;

export function cancelSearch() {
    searchCancelled = true;
}

export function isSearchRunning() {
    return !searchCancelled;
}

// =====================================================
// INITIALIZATION
// =====================================================

/**
 * Initialize the graph database with known families
 */
export function initializeDatabase(maxN = 7) {
    if (databaseInitialized) return;
    
    // Try to load from localStorage first
    const loaded = loadDatabase();
    
    if (!loaded) {
        // Seed with known families
        seedKnownFamilies(maxN);
        saveDatabase();
    }
    
    databaseInitialized = true;
}

/**
 * Force re-initialization (clears cache)
 */
export function resetDatabase() {
    clearDatabase();
    databaseInitialized = false;
    initializeDatabase();
}

// =====================================================
// GRAPH ENUMERATION
// =====================================================

/**
 * Generate all possible edge combinations for n vertices
 */
function* generateAllEdgeSets(n) {
    const possibleEdges = [];
    for (let i = 0; i < n; i++) {
        for (let j = i + 1; j < n; j++) {
            possibleEdges.push([i, j]);
        }
    }
    
    const numEdges = possibleEdges.length;
    const totalCombinations = 1 << numEdges;
    
    for (let mask = 0; mask < totalCombinations; mask++) {
        const edges = [];
        for (let i = 0; i < numEdges; i++) {
            if (mask & (1 << i)) {
                edges.push(possibleEdges[i]);
            }
        }
        yield edges;
    }
}

/**
 * Check if graph is connected using BFS
 */
function isConnected(n, edges) {
    if (n <= 1) return true;
    if (edges.length < n - 1) return false;
    
    const adj = Array.from({ length: n }, () => []);
    for (const [i, j] of edges) {
        adj[i].push(j);
        adj[j].push(i);
    }
    
    const visited = new Set([0]);
    const queue = [0];
    
    while (queue.length > 0) {
        const v = queue.shift();
        for (const u of adj[v]) {
            if (!visited.has(u)) {
                visited.add(u);
                queue.push(u);
            }
        }
    }
    
    return visited.size === n;
}

/**
 * Check if graph is regular
 */
function isRegular(n, edges) {
    if (n === 0) return true;
    
    const degrees = new Array(n).fill(0);
    for (const [i, j] of edges) {
        degrees[i]++;
        degrees[j]++;
    }
    
    const firstDegree = degrees[0];
    return degrees.every(d => d === firstDegree);
}

/**
 * Make skew-symmetric adjacency matrix from edges
 */
function makeSkewSymmetricMatrix(n, edges) {
    const A = Array(n).fill(null).map(() => Array(n).fill(0));
    for (const [i, j] of edges) {
        A[i][j] = 1;
        A[j][i] = -1;
    }
    return A;
}

/**
 * Compute characteristic polynomial coefficients using Faddeev-LeVerrier
 */
function computeCharacteristicPolynomial(matrix) {
    const n = matrix.length;
    if (n === 0) return [1];
    
    const coeffs = new Array(n + 1).fill(0);
    coeffs[0] = 1;
    
    let M = matrix.map(row => [...row]);
    
    for (let k = 1; k <= n; k++) {
        let trace = 0;
        for (let i = 0; i < n; i++) {
            trace += M[i][i];
        }
        
        coeffs[k] = -trace / k;
        
        if (k < n) {
            for (let i = 0; i < n; i++) {
                M[i][i] += coeffs[k];
            }
            
            const newM = Array(n).fill(null).map(() => Array(n).fill(0));
            for (let i = 0; i < n; i++) {
                for (let j = 0; j < n; j++) {
                    for (let l = 0; l < n; l++) {
                        newM[i][j] += matrix[i][l] * M[l][j];
                    }
                }
            }
            M = newM;
        }
    }
    
    return coeffs;
}

// =====================================================
// EIGENVALUE ANALYSIS
// =====================================================

/**
 * Analyze eigenvalues for closed forms using both algebraic and numerical methods
 * Returns: { analytic: boolean, eigenvalues: [], reason?: string, method?: string }
 * 
 * Strategy:
 * 1. First try algebraic factorization of characteristic polynomial
 *    - This works well for mechanism/pendulum families with even/odd power structure
 * 2. Fall back to numerical eigenvalues + pattern matching if factorization fails
 */
function analyzeGraphEigenvalues(n, edges) {
    const matrix = makeSkewSymmetricMatrix(n, edges);
    
    // ===== Method 1: Algebraic Factorization =====
    // Compute exact characteristic polynomial and factor it
    try {
        const coeffs = computeCharacteristicPolynomial(matrix);
        
        // Try enhanced factorization with μ = λ² substitution
        const factorResult = PolynomialFactorizer.factorWithMuSubstitution(coeffs);
        
        if (factorResult.allExact && factorResult.roots.length > 0) {
            // Convert roots to eigenvalue format
            const eigenvalues = [];
            const seen = new Map();
            
            for (const root of factorResult.roots) {
                // Skip imaginary eigenvalues for our purposes
                if (root.isImaginary) continue;
                
                const key = root.value.toFixed(9);
                if (seen.has(key)) {
                    seen.get(key).multiplicity++;
                } else {
                    seen.set(key, {
                        value: root.value,
                        form: root.form,
                        isNice: root.exact,
                        multiplicity: 1
                    });
                }
            }
            
            eigenvalues.push(...seen.values());
            eigenvalues.sort((a, b) => b.value - a.value);
            
            // Verify we got the right count
            const totalMult = eigenvalues.reduce((s, e) => s + e.multiplicity, 0);
            if (totalMult === n) {
                return {
                    analytic: true,
                    eigenvalues: eigenvalues,
                    reason: null,
                    method: 'algebraic_factorization',
                    factorization: factorResult.factorization,
                    usedMuSubstitution: factorResult.usedMuSubstitution
                };
            }
        }
        
        // Check if factorization found most roots exactly
        const exactRoots = factorResult.roots.filter(r => r.exact && !r.isImaginary);
        const nonExactRoots = factorResult.roots.filter(r => !r.exact && !r.isImaginary);
        
        if (exactRoots.length > 0 && nonExactRoots.length <= 2) {
            // Partial success - try pattern matching on remaining roots
            let allGood = true;
            const enhancedRoots = [...exactRoots];
            
            for (const root of nonExactRoots) {
                const form = SpectralEngine.identifyClosedForm(root.value, n);
                if (form.isExact) {
                    enhancedRoots.push({ value: root.value, form: form.formula, exact: true });
                } else {
                    allGood = false;
                    break;
                }
            }
            
            if (allGood) {
                // Build eigenvalue list from enhanced roots
                const eigenvalues = [];
                const seen = new Map();
                
                for (const root of enhancedRoots) {
                    const key = root.value.toFixed(9);
                    if (seen.has(key)) {
                        seen.get(key).multiplicity++;
                    } else {
                        seen.set(key, {
                            value: root.value,
                            form: root.form,
                            isNice: true,
                            multiplicity: 1
                        });
                    }
                }
                
                eigenvalues.push(...seen.values());
                eigenvalues.sort((a, b) => b.value - a.value);
                
                const totalMult = eigenvalues.reduce((s, e) => s + e.multiplicity, 0);
                if (totalMult === n) {
                    return {
                        analytic: true,
                        eigenvalues: eigenvalues,
                        reason: null,
                        method: 'algebraic_with_pattern_matching',
                        factorization: factorResult.factorization
                    };
                }
            }
        }
    } catch (e) {
        // Factorization failed, continue to Chebyshev method
        console.log(`Algebraic factorization failed for n=${n}: ${e.message}`);
    }
    
    // ===== Method 2: Chebyshev Polynomial Factorization =====
    // Try to identify eigenvalues as 2cos(kπ/m) patterns
    try {
        const coeffs = computeCharacteristicPolynomial(matrix);
        const chebyResult = ChebyshevFactorizer.factorize(coeffs, {
            maxDenominator: Math.max(50, 2 * n + 10),
            tolerance: 1e-8
        });
        
        if (chebyResult.success && chebyResult.roots.length > 0) {
            // Count how many roots are exact
            const exactCount = chebyResult.roots.filter(r => r.exact).length;
            const totalCount = chebyResult.roots.length;
            
            // Accept if all roots are exact, or if most are exact (>80%)
            if (exactCount === totalCount || exactCount >= totalCount * 0.8) {
                const eigenvalues = [];
                const seen = new Map();
                
                for (const root of chebyResult.roots) {
                    if (root.isImaginary) continue;
                    
                    const key = root.value.toFixed(9);
                    if (seen.has(key)) {
                        seen.get(key).multiplicity++;
                    } else {
                        seen.set(key, {
                            value: root.value,
                            form: root.form,
                            isNice: root.exact,
                            multiplicity: 1,
                            chebyshev: root.chebyshev
                        });
                    }
                }
                
                eigenvalues.push(...seen.values());
                eigenvalues.sort((a, b) => b.value - a.value);
                
                const totalMult = eigenvalues.reduce((s, e) => s + e.multiplicity, 0);
                if (totalMult === n) {
                    return {
                        analytic: exactCount === totalCount,
                        eigenvalues: eigenvalues,
                        reason: exactCount === totalCount ? null : 'partial_chebyshev',
                        method: 'chebyshev_factorization',
                        chebyshevParameter: chebyResult.chebyshevParameter,
                        exactRatio: exactCount / totalCount
                    };
                }
            }
        }
    } catch (e) {
        // Chebyshev factorization failed, continue to numerical method
        console.log(`Chebyshev factorization failed for n=${n}: ${e.message}`);
    }
    
    // ===== Method 3: Numerical Eigenvalues + Pattern Matching =====
    const skewEigs = computeSkewSymmetricEigenvalues(matrix);
    
    if (!skewEigs || skewEigs.length === 0) {
        return { analytic: false, reason: 'no_eigenvalues', method: 'numerical' };
    }
    
    // Get imaginary parts (skew-symmetric has pure imaginary eigenvalues)
    const imagParts = skewEigs.map(e => e.imag);
    
    // Analyze for closed forms using pattern matching
    const analysis = analyzeEigenvaluesForClosedForms(imagParts);
    
    return {
        analytic: analysis.allAnalytic,
        eigenvalues: analysis.eigenvalues,
        reason: analysis.allAnalytic ? null : 'not_closed_form',
        method: 'numerical_pattern_matching'
    };
}

// =====================================================
// HIERARCHICAL SEARCH
// =====================================================

/**
 * Build database incrementally from n=2 up to target
 */
export async function buildDatabaseUpTo(targetN, progressCallback = null) {
    initializeDatabase(targetN);
    
    const results = {
        builtLevels: [],
        totalAnalytic: 0,
        totalNonAnalytic: 0,
        productGraphsFound: 0
    };
    
    for (let n = 2; n <= targetN; n++) {
        if (progressCallback) {
            progressCallback({
                phase: 'building',
                currentN: n,
                targetN,
                message: `Building database for n=${n}...`
            });
        }
        
        // Check if we already have results for this n
        if (hasResultsForN(n)) {
            const existing = getAnalyticGraphs(n);
            results.builtLevels.push({ n, analytic: existing.size, fromCache: true });
            results.totalAnalytic += existing.size;
            continue;
        }
        
        // Pre-compute product graphs if n is composite
        if (n >= 4) {
            const productCount = precomputeProductGraphs(n, progressCallback);
            results.productGraphsFound += productCount;
            
            if (progressCallback && productCount > 0) {
                progressCallback({
                    phase: 'products',
                    currentN: n,
                    message: `Found ${productCount} product graphs for n=${n}`
                });
            }
        }
        
        // Search remaining graphs
        const searchResult = await findAnalyticGraphsInternal(n, {
            connectedOnly: false,  // Search all for database building
            useDatabase: true
        }, progressCallback);
        
        results.builtLevels.push({
            n,
            analytic: searchResult.analyticCount,
            nonAnalytic: searchResult.nonAnalyticCount,
            fromCache: false
        });
        
        results.totalAnalytic += searchResult.analyticCount;
        results.totalNonAnalytic += searchResult.nonAnalyticCount;
        
        // Save after each level
        saveDatabase();
    }
    
    return results;
}

/**
 * Internal search function with database integration
 */
async function findAnalyticGraphsInternal(n, options, progressCallback) {
    initializeForN(n);
    
    const {
        connectedOnly = true,
        regularOnly = false,
        minEdges = 0,
        maxEdges = Infinity,
        maxUniqueGraphs = 50000,
        useDatabase = true
    } = options;
    
    const startTime = performance.now();
    const stats = {
        totalChecked: 0,
        uniqueGraphs: 0,
        skippedDisconnected: 0,
        resolvedByProduct: 0,
        resolvedByDisconnected: 0,
        resolvedByPolyCache: 0,
        analyzedFresh: 0,
        analyticCount: 0,
        nonAnalyticCount: 0
    };
    
    const analyticResults = [];
    const seenCanonical = new Set();
    const seenPolynomials = new Map();
    
    const possibleEdges = [];
    for (let i = 0; i < n; i++) {
        for (let j = i + 1; j < n; j++) {
            possibleEdges.push([i, j]);
        }
    }
    
    const numEdges = possibleEdges.length;
    const totalCombinations = 1 << numEdges;
    const updateInterval = Math.max(1, Math.floor(totalCombinations / 1000));
    
    for (let mask = 0; mask < totalCombinations; mask++) {
        // Check cancellation
        if (searchCancelled) break;
        
        // Progress update - show more informative stats
        if (progressCallback && mask % updateInterval === 0) {
            let msg = `Checked ${mask.toLocaleString()}/${totalCombinations.toLocaleString()}`;
            if (connectedOnly && stats.skippedDisconnected > 0) {
                msg += ` (${stats.skippedDisconnected.toLocaleString()} disconnected skipped)`;
            }
            msg += ` → ${stats.analyticCount} analytic`;
            
            // Show optimization stats
            const optimized = stats.resolvedByProduct + stats.resolvedByDisconnected + stats.resolvedByPolyCache;
            if (optimized > 0) {
                msg += ` (${optimized} instant)`;
            }
            
            progressCallback({
                phase: 'searching',
                current: mask,
                total: totalCombinations,
                stats: { ...stats },
                message: msg
            });
        }
        
        // Allow UI updates and memory management
        if (mask % 10000 === 0) {
            await new Promise(resolve => setTimeout(resolve, 0));
        }
        
        // Periodic memory cleanup for large n
        if (n >= 8 && mask % 1000000 === 0 && mask > 0) {
            // Clear local polynomial cache periodically - database still has it
            if (seenPolynomials.size > 50000) {
                console.log(`  Memory cleanup: clearing ${seenPolynomials.size} cached polynomials`);
                seenPolynomials.clear();
            }
        }
        
        stats.totalChecked++;
        
        // Generate edges for this combination
        const edges = [];
        for (let i = 0; i < numEdges; i++) {
            if (mask & (1 << i)) {
                edges.push(possibleEdges[i]);
            }
        }
        
        // Apply filters
        if (edges.length < minEdges || edges.length > maxEdges) continue;
        if (regularOnly && !isRegular(n, edges)) continue;
        
        // Check connectivity
        const connected = isConnected(n, edges);
        if (connectedOnly && !connected) {
            stats.skippedDisconnected++;
            continue;
        }
        
        // Compute canonical hash
        const canonHash = computeCanonicalHash(n, edges);
        if (seenCanonical.has(canonHash)) continue;
        seenCanonical.add(canonHash);
        
        stats.uniqueGraphs++;
        
        // Safety limit
        if (stats.uniqueGraphs > maxUniqueGraphs) break;
        
        // ========== OPTIMIZATION 1: Check product graph cache ==========
        if (useDatabase) {
            const productResult = checkProductGraph(n, canonHash);
            if (productResult) {
                stats.resolvedByProduct++;
                stats.analyticCount++;
                
                analyticResults.push({
                    n,
                    edges: [...edges],
                    edgeCount: edges.length,
                    canonHash,
                    eigenvalues: productResult.eigenvalues,
                    family: productResult.family,
                    fromProduct: true,
                    productType: productResult.productType
                });
                
                storeAnalyticGraph(n, canonHash, {
                    edges,
                    eigenvalues: productResult.eigenvalues,
                    family: productResult.family
                });
                
                continue;
            }
        }
        
        // ========== OPTIMIZATION 2: Disconnected graph resolution ==========
        if (!connected && useDatabase) {
            const disconnResult = resolveDisconnectedGraph(n, edges);
            if (disconnResult.resolved) {
                stats.resolvedByDisconnected++;
                
                if (disconnResult.analytic) {
                    stats.analyticCount++;
                    
                    analyticResults.push({
                        n,
                        edges: [...edges],
                        edgeCount: edges.length,
                        canonHash,
                        eigenvalues: disconnResult.eigenvalues,
                        family: disconnResult.family || `Disconnected (${disconnResult.components} components)`,
                        fromDisconnected: true
                    });
                    
                    storeAnalyticGraph(n, canonHash, {
                        edges,
                        eigenvalues: disconnResult.eigenvalues,
                        family: disconnResult.family
                    });
                } else {
                    stats.nonAnalyticCount++;
                }
                
                continue;
            }
        }
        
        // ========== OPTIMIZATION 3: Polynomial cache ==========
        const matrix = makeSkewSymmetricMatrix(n, edges);
        const polyCoeffs = computeCharacteristicPolynomial(matrix);
        const polyHash = computePolynomialHash(polyCoeffs);
        
        // Check if we've seen this polynomial
        if (seenPolynomials.has(polyHash)) {
            const prevResult = seenPolynomials.get(polyHash);
            stats.resolvedByPolyCache++;
            
            if (prevResult.analytic) {
                stats.analyticCount++;
                
                analyticResults.push({
                    n,
                    edges: [...edges],
                    edgeCount: edges.length,
                    canonHash,
                    eigenvalues: prevResult.eigenvalues,
                    family: identifyFamily(n, edges),
                    fromPolyCache: true
                });
                
                storeAnalyticGraph(n, canonHash, {
                    edges,
                    eigenvalues: prevResult.eigenvalues,
                    family: identifyFamily(n, edges)
                });
            } else {
                stats.nonAnalyticCount++;
            }
            
            continue;
        }
        
        // Check database polynomial cache
        if (useDatabase) {
            const cachedPoly = checkPolynomialCache(n, polyHash);
            if (cachedPoly) {
                stats.resolvedByPolyCache++;
                seenPolynomials.set(polyHash, cachedPoly);
                
                if (cachedPoly.analytic) {
                    stats.analyticCount++;
                    
                    analyticResults.push({
                        n,
                        edges: [...edges],
                        edgeCount: edges.length,
                        canonHash,
                        eigenvalues: cachedPoly.eigenvalues,
                        family: identifyFamily(n, edges),
                        fromPolyCache: true
                    });
                    
                    storeAnalyticGraph(n, canonHash, {
                        edges,
                        eigenvalues: cachedPoly.eigenvalues,
                        family: identifyFamily(n, edges)
                    });
                } else {
                    stats.nonAnalyticCount++;
                }
                
                continue;
            }
        }
        
        // ========== FRESH ANALYSIS (expensive) ==========
        stats.analyzedFresh++;
        
        const analysis = analyzeGraphEigenvalues(n, edges);
        
        // Cache the polynomial result
        seenPolynomials.set(polyHash, {
            analytic: analysis.analytic,
            eigenvalues: analysis.eigenvalues
        });
        
        if (useDatabase) {
            cachePolynomialResult(n, polyHash, {
                analytic: analysis.analytic,
                eigenvalues: analysis.eigenvalues
            });
        }
        
        if (analysis.analytic) {
            stats.analyticCount++;
            
            const family = identifyFamily(n, edges);
            
            analyticResults.push({
                n,
                edges: [...edges],
                edgeCount: edges.length,
                canonHash,
                eigenvalues: analysis.eigenvalues,
                family,
                freshAnalysis: true
            });
            
            if (useDatabase) {
                storeAnalyticGraph(n, canonHash, {
                    edges,
                    eigenvalues: analysis.eigenvalues,
                    family
                });
            }
        } else {
            stats.nonAnalyticCount++;
        }
    }
    
    // Save database
    if (useDatabase) {
        saveDatabase();
    }
    
    return {
        n,
        totalChecked: stats.totalChecked,
        totalUnique: stats.uniqueGraphs,
        analyticCount: stats.analyticCount,
        nonAnalyticCount: stats.nonAnalyticCount,
        elapsed: (performance.now() - startTime) / 1000,
        graphs: analyticResults,
        stats,
        cancelled: searchCancelled
    };
}

// =====================================================
// PUBLIC API
// =====================================================

/**
 * Find all graphs with analytic eigenvalues for n vertices
 * Main public function with full optimization
 */
export async function findAnalyticGraphs(n, options = null, progressCallback = null) {
    searchCancelled = false;
    
    // Handle legacy call signature
    if (typeof options === 'function') {
        progressCallback = options;
        options = {};
    }
    options = options || {};
    progressCallback = progressCallback || options.progressCallback;
    
    // Initialize database
    initializeDatabase(Math.max(n, 7));
    
    // Reset stats for fresh search
    resetStats();
    
    const {
        connectedOnly = true,
        regularOnly = false,
        minEdges = 0,
        maxEdges = Infinity,
        maxUniqueGraphs = 50000,
        buildIncremental = true  // Build smaller n first for better caching
    } = options;
    
    const startTime = performance.now();
    
    // Log database status
    console.log(`findAnalyticGraphs: n=${n}, connectedOnly=${connectedOnly}, buildIncremental=${buildIncremental}`);
    for (let k = 2; k <= Math.min(n, 7); k++) {
        const hasResults = hasResultsForN(k);
        const count = hasResults ? getAnalyticGraphs(k)?.size || 0 : 0;
        console.log(`  Database n=${k}: ${hasResults ? `${count} analytic graphs` : 'empty'}`);
    }
    
    // Build database incrementally if requested and n > 4
    if (buildIncremental && n > 4) {
        if (progressCallback) {
            progressCallback({
                status: 'building',
                message: `Building database from n=2 to n=${n-1}...`
            });
        }
        
        // Build up to n-1 first
        // For small n, check against known total graph counts
        // Analytic graphs as fraction of total non-isomorphic graphs:
        // n=2: 2 total (2 analytic), n=3: 4 total (4 analytic), n=4: 11 total (~10 analytic)
        // n=5: 34 total (~20 analytic), n=6: 156 total (~50 analytic), n=7: 1044 total (~120 analytic)
        let builtCount = 0;
        for (let k = 2; k < n; k++) {
            if (searchCancelled) break;
            
            // Check if we need to build this level
            const existingCount = hasResultsForN(k) ? (getAnalyticGraphs(k)?.size || 0) : 0;
            
            // Minimum expected analytic graphs per vertex count
            // These are based on actual counts - set low enough to not rebuild unnecessarily
            const minExpected = {
                2: 2,   // All 2 graphs are analytic
                3: 4,   // All 4 graphs are analytic  
                4: 8,   // Most of 11 total are analytic
                5: 15,  // About half of 34
                6: 40,  // About a quarter of 156
                7: 100  // About 10% of 1044
            }[k] || 50;
            
            // Build if we have too few results (likely just seeded families)
            if (existingCount < minExpected) {
                console.log(`  Building database for n=${k} (have ${existingCount}, need ${minExpected}+)...`);
                await findAnalyticGraphsInternal(k, { 
                    connectedOnly: false, 
                    useDatabase: true,
                    maxUniqueGraphs: 100000
                }, (prog) => {
                    if (progressCallback) {
                        progressCallback({
                            status: 'building',
                            message: `Building n=${k}: ${prog.message}`
                        });
                    }
                });
                builtCount++;
            } else {
                console.log(`  Database n=${k}: already has ${existingCount} graphs (sufficient)`);
            }
        }
        
        if (builtCount > 0) {
            console.log(`  Built ${builtCount} database levels`);
        }
        
        // Pre-compute products for target n
        if (!searchCancelled) {
            const productCount = precomputeProductGraphs(n);
            console.log(`  Pre-computed ${productCount} product graphs for n=${n}`);
            if (progressCallback && productCount > 0) {
                progressCallback({
                    status: 'products',
                    message: `Pre-computed ${productCount} product graphs for n=${n}`
                });
            }
        }
    }
    
    // Main search for target n
    if (progressCallback) {
        progressCallback({
            status: 'searching',
            message: `Searching for n=${n}...`
        });
    }
    
    const result = await findAnalyticGraphsInternal(n, {
        connectedOnly,
        regularOnly,
        minEdges,
        maxEdges,
        maxUniqueGraphs,
        useDatabase: true
    }, (prog) => {
        if (progressCallback) {
            progressCallback({
                status: prog.phase || 'searching',
                message: prog.message,
                progress: prog.current ? prog.current / prog.total : undefined
            });
        }
    });
    
    // Add database stats
    result.dbStats = getStats();
    result.elapsed = (performance.now() - startTime) / 1000;
    result.filters = { connectedOnly, regularOnly, minEdges, maxEdges };
    
    return result;
}

// =====================================================
// GRAPH FAMILY IDENTIFICATION
// =====================================================

function identifyFamily(n, edges) {
    const m = edges.length;
    
    if (m === 0) return `Empty E_${n}`;
    if (m === n * (n - 1) / 2) return `Complete K_${n}`;
    
    // Build adjacency for analysis
    const adj = Array(n).fill(null).map(() => new Set());
    for (const [i, j] of edges) {
        adj[i].add(j);
        adj[j].add(i);
    }
    
    const degrees = adj.map(s => s.size).sort((a, b) => b - a);
    const connected = isConnected(n, edges);
    
    if (!connected) {
        const components = findConnectedComponents(n, edges);
        return `Disconnected (${components.length} components)`;
    }
    
    // Path
    if (m === n - 1 && degrees[0] === 2 && degrees[n-1] === 1 && degrees[n-2] === 1) {
        return `Path P_${n}`;
    }
    
    // Star
    if (m === n - 1 && degrees[0] === n - 1 && degrees.slice(1).every(d => d === 1)) {
        return `Star S_${n}`;
    }
    
    // Cycle
    if (m === n && degrees.every(d => d === 2)) {
        return `Cycle C_${n}`;
    }
    
    // Regular
    if (new Set(degrees).size === 1 && degrees[0] > 0) {
        return `${degrees[0]}-regular graph`;
    }
    
    // Tree
    if (m === n - 1) {
        return `Tree on ${n} vertices`;
    }
    
    return null;
}

// =====================================================
// GRAPH LOADING
// =====================================================

/**
 * Load a graph from search results into the visualization
 */
export function loadGraphFromResult(result, layoutType = 'circle') {
    console.log('loadGraphFromResult called with:', result, 'layout:', layoutType);
    
    if (!result) {
        console.error('loadGraphFromResult: result is null/undefined');
        return null;
    }
    
    if (result.n === undefined || result.n === null) {
        console.error('loadGraphFromResult: result.n is missing', result);
        return null;
    }
    
    if (!result.edges) {
        console.error('loadGraphFromResult: result.edges is missing', result);
        return null;
    }
    
    if (!Array.isArray(result.edges)) {
        console.error('loadGraphFromResult: result.edges is not an array', result.edges);
        return null;
    }
    
    const n = result.n;
    const edges = result.edges;
    
    console.log(`loadGraphFromResult: Loading graph with n=${n}, ${edges.length} edges`);
    
    // Clear current graph
    clearGraph();
    
    // CRITICAL: Initialize adjacency matrices BEFORE adding edges
    // clearGraph() leaves these as empty arrays, which breaks addEdge()
    state.adjacencyMatrix = Array(n).fill(null).map(() => Array(n).fill(0));
    state.symmetricAdjMatrix = Array(n).fill(null).map(() => Array(n).fill(0));
    
    // Get layout positions
    let positions;
    switch (layoutType) {
        case 'sphere':
            positions = getSpherePositions(n, 25);
            break;
        case 'concentric2':
            positions = getConcentricCirclePositions2(n, 30, 15);
            break;
        case 'concentric3':
            positions = getConcentricCirclePositions3(n, 35, 25, 15);
            break;
        case 'sphere2':
            positions = getConcentricSpherePositions2(n, 30, 15);
            break;
        case 'circle':
        default:
            positions = getCirclePositions(n, 30);
    }
    
    console.log('loadGraphFromResult: Got positions:', positions?.length);
    
    // Create vertices
    for (let i = 0; i < n; i++) {
        createVertex(positions[i], i);
    }
    
    console.log('loadGraphFromResult: Created', n, 'vertices, now adding edges...');
    
    // Create edges
    let edgesCreated = 0;
    for (const edge of edges) {
        if (Array.isArray(edge) && edge.length >= 2) {
            const [i, j] = edge;
            addEdge(i, j);
            edgesCreated++;
        } else {
            console.warn('loadGraphFromResult: Invalid edge format:', edge);
        }
    }
    
    console.log('loadGraphFromResult: Created', edgesCreated, 'edges');
    
    return { vertices: n, edges: edgesCreated };
}

// =====================================================
// EXPORTS (getDatabaseStats is an alias)
// =====================================================

export { getStats as getDatabaseStats };
