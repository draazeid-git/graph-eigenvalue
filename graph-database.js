/**
 * Graph Database Module
 * =====================
 * Hierarchical caching system for analytic graph search optimization.
 * 
 * Key optimizations:
 * 1. Cache analytic/non-analytic results by vertex count
 * 2. Product graph pre-computation (Cartesian, Tensor)
 * 3. Disconnected component instant-classification
 * 4. Polynomial hash caching across isomorphic graphs
 */

// =====================================================
// DATABASE STRUCTURE
// =====================================================

/**
 * Hierarchical database storing results for each vertex count
 * Structure:
 *   analyticGraphs[n] = Map(canonicalHash -> { edges, eigenvalues, family, ... })
 *   nonAnalyticPolys[n] = Set(polynomialHash)
 *   polynomialCache[n] = Map(polynomialHash -> { analytic: bool, eigenvalues?, reason? })
 */
const graphDatabase = {
    // Analytic graphs indexed by vertex count
    analyticGraphs: new Map(),  // n -> Map(canonHash -> graphData)
    
    // Non-analytic polynomial hashes (just need to know it failed)
    nonAnalyticPolys: new Map(), // n -> Set(polyHash)
    
    // Polynomial results cache (avoid re-solving same polynomial)
    polynomialCache: new Map(),  // n -> Map(polyHash -> result)
    
    // Product graphs that are known analytic (computed, not solved)
    productGraphs: new Map(),    // n -> Map(canonHash -> { factors, eigenvalues })
    
    // Statistics
    stats: {
        cacheHits: 0,
        cacheMisses: 0,
        productMatches: 0,
        disconnectedResolved: 0,
        polynomialReuses: 0
    }
};

// Initialize database for vertex count n
function initializeForN(n) {
    if (!graphDatabase.analyticGraphs.has(n)) {
        graphDatabase.analyticGraphs.set(n, new Map());
    }
    if (!graphDatabase.nonAnalyticPolys.has(n)) {
        graphDatabase.nonAnalyticPolys.set(n, new Set());
    }
    if (!graphDatabase.polynomialCache.has(n)) {
        graphDatabase.polynomialCache.set(n, new Map());
    }
    if (!graphDatabase.productGraphs.has(n)) {
        graphDatabase.productGraphs.set(n, new Map());
    }
}

// =====================================================
// CANONICAL FORM & HASHING
// =====================================================

/**
 * Compute canonical hash for a graph (for isomorphism detection)
 * Uses degree sequence + edge structure hash
 */
export function computeCanonicalHash(n, edges) {
    if (edges.length === 0) {
        return `E${n}`;  // Empty graph
    }
    
    // Build adjacency
    const adj = Array(n).fill(null).map(() => new Set());
    for (const [i, j] of edges) {
        adj[i].add(j);
        adj[j].add(i);
    }
    
    // Degree sequence (sorted descending)
    const degrees = adj.map(s => s.size).sort((a, b) => b - a);
    
    // Edge degree pairs
    const edgeDegrees = edges.map(([i, j]) => {
        const di = adj[i].size, dj = adj[j].size;
        return di <= dj ? `${di}-${dj}` : `${dj}-${di}`;
    }).sort();
    
    // Neighborhood structure (2-hop signature)
    const neighborSigs = [];
    for (let i = 0; i < n; i++) {
        const neighbors = [...adj[i]].sort((a, b) => a - b);
        const neighborDegs = neighbors.map(j => adj[j].size).sort((a, b) => b - a);
        neighborSigs.push(neighborDegs.join(','));
    }
    neighborSigs.sort();
    
    return `n${n}e${edges.length}:${degrees.join(',')}|${edgeDegrees.join(';')}|${neighborSigs.join('/')}`;
}

/**
 * Compute polynomial hash from coefficients
 */
export function computePolynomialHash(coefficients) {
    // Round coefficients to avoid floating point issues
    const rounded = coefficients.map(c => Math.round(c * 1e10) / 1e10);
    return rounded.join(',');
}

// =====================================================
// DATABASE OPERATIONS
// =====================================================

/**
 * Check if we have a cached result for this polynomial
 */
export function checkPolynomialCache(n, polyHash) {
    initializeForN(n);
    const cache = graphDatabase.polynomialCache.get(n);
    if (cache.has(polyHash)) {
        graphDatabase.stats.polynomialReuses++;
        return cache.get(polyHash);
    }
    return null;
}

/**
 * Store polynomial analysis result
 */
export function cachePolynomialResult(n, polyHash, result) {
    initializeForN(n);
    graphDatabase.polynomialCache.get(n).set(polyHash, result);
    
    if (!result.analytic) {
        graphDatabase.nonAnalyticPolys.get(n).add(polyHash);
    }
}

/**
 * Store an analytic graph
 */
export function storeAnalyticGraph(n, canonHash, graphData) {
    initializeForN(n);
    graphDatabase.analyticGraphs.get(n).set(canonHash, graphData);
}

/**
 * Get all analytic graphs for vertex count n
 */
export function getAnalyticGraphs(n) {
    initializeForN(n);
    return graphDatabase.analyticGraphs.get(n);
}

/**
 * Check if database has results for n
 */
export function hasResultsForN(n) {
    return graphDatabase.analyticGraphs.has(n) && 
           graphDatabase.analyticGraphs.get(n).size > 0;
}

/**
 * Get database statistics
 */
export function getStats() {
    const stats = { ...graphDatabase.stats };
    stats.analyticByN = {};
    stats.nonAnalyticByN = {};
    
    for (const [n, graphs] of graphDatabase.analyticGraphs) {
        stats.analyticByN[n] = graphs.size;
    }
    for (const [n, polys] of graphDatabase.nonAnalyticPolys) {
        stats.nonAnalyticByN[n] = polys.size;
    }
    
    return stats;
}

/**
 * Reset statistics
 */
export function resetStats() {
    graphDatabase.stats = {
        cacheHits: 0,
        cacheMisses: 0,
        productMatches: 0,
        disconnectedResolved: 0,
        polynomialReuses: 0
    };
}

// =====================================================
// PRODUCT GRAPH COMPUTATIONS
// =====================================================

/**
 * Compute Cartesian product G □ H
 * Vertices: V(G) × V(H)
 * Edges: (g1,h)-(g2,h) if g1-g2 in G, or (g,h1)-(g,h2) if h1-h2 in H
 * 
 * Eigenvalues: λᵢ(G) + μⱼ(H) for all i,j
 */
export function cartesianProduct(edgesG, nG, edgesH, nH) {
    const nProduct = nG * nH;
    const productEdges = [];
    
    // Helper to convert (g, h) pair to product vertex index
    const idx = (g, h) => g * nH + h;
    
    // Build adjacency for G and H
    const adjG = Array(nG).fill(null).map(() => new Set());
    for (const [i, j] of edgesG) {
        adjG[i].add(j);
        adjG[j].add(i);
    }
    
    const adjH = Array(nH).fill(null).map(() => new Set());
    for (const [i, j] of edgesH) {
        adjH[i].add(j);
        adjH[j].add(i);
    }
    
    // Add edges from G (for each h, copy G structure)
    for (let h = 0; h < nH; h++) {
        for (const [g1, g2] of edgesG) {
            const v1 = idx(g1, h);
            const v2 = idx(g2, h);
            if (v1 < v2) productEdges.push([v1, v2]);
            else productEdges.push([v2, v1]);
        }
    }
    
    // Add edges from H (for each g, copy H structure)
    for (let g = 0; g < nG; g++) {
        for (const [h1, h2] of edgesH) {
            const v1 = idx(g, h1);
            const v2 = idx(g, h2);
            if (v1 < v2) productEdges.push([v1, v2]);
            else productEdges.push([v2, v1]);
        }
    }
    
    return { n: nProduct, edges: productEdges };
}

/**
 * Compute Tensor/Kronecker product G ⊗ H
 * Vertices: V(G) × V(H)
 * Edges: (g1,h1)-(g2,h2) if g1-g2 in G AND h1-h2 in H
 * 
 * Eigenvalues: λᵢ(G) · μⱼ(H) for all i,j
 */
export function tensorProduct(edgesG, nG, edgesH, nH) {
    const nProduct = nG * nH;
    const productEdges = [];
    
    const idx = (g, h) => g * nH + h;
    
    // For each edge in G and each edge in H, create product edge
    for (const [g1, g2] of edgesG) {
        for (const [h1, h2] of edgesH) {
            // (g1,h1)-(g2,h2)
            let v1 = idx(g1, h1);
            let v2 = idx(g2, h2);
            if (v1 < v2) productEdges.push([v1, v2]);
            else productEdges.push([v2, v1]);
            
            // (g1,h2)-(g2,h1)
            v1 = idx(g1, h2);
            v2 = idx(g2, h1);
            if (v1 < v2) productEdges.push([v1, v2]);
            else productEdges.push([v2, v1]);
        }
    }
    
    // Remove duplicates
    const uniqueEdges = [...new Set(productEdges.map(e => e.join(',')))].map(s => s.split(',').map(Number));
    
    return { n: nProduct, edges: uniqueEdges };
}

/**
 * Compute product eigenvalues (sum for Cartesian, product for Tensor)
 */
export function computeProductEigenvalues(eigsG, eigsH, type = 'cartesian') {
    const result = [];
    
    for (const λ of eigsG) {
        for (const μ of eigsH) {
            if (type === 'cartesian') {
                // Cartesian: λ + μ
                result.push({
                    value: λ.value + μ.value,
                    formula: `(${λ.formula}) + (${μ.formula})`,
                    fromProduct: true
                });
            } else if (type === 'tensor') {
                // Tensor: λ * μ
                result.push({
                    value: λ.value * μ.value,
                    formula: `(${λ.formula}) × (${μ.formula})`,
                    fromProduct: true
                });
            }
        }
    }
    
    // Sort by absolute value descending
    result.sort((a, b) => Math.abs(b.value) - Math.abs(a.value));
    
    return result;
}

/**
 * Pre-compute all product graphs for target vertex count n
 * using smaller analytic graphs
 */
export function precomputeProductGraphs(targetN, progressCallback = null) {
    initializeForN(targetN);
    const productCache = graphDatabase.productGraphs.get(targetN);
    
    // Find all factorizations of targetN
    const factorizations = findFactorizations(targetN);
    
    let computed = 0;
    const totalEstimate = factorizations.length * 10; // Rough estimate
    
    for (const factors of factorizations) {
        if (factors.length === 2) {
            const [n1, n2] = factors;
            
            // Get analytic graphs for each factor size
            const graphs1 = getAnalyticGraphs(n1);
            const graphs2 = getAnalyticGraphs(n2);
            
            if (!graphs1 || !graphs2) continue;
            
            // Compute Cartesian products
            for (const [hash1, g1] of graphs1) {
                for (const [hash2, g2] of graphs2) {
                    // Cartesian product
                    const cartesian = cartesianProduct(g1.edges, n1, g2.edges, n2);
                    const cartHash = computeCanonicalHash(cartesian.n, cartesian.edges);
                    
                    if (!productCache.has(cartHash)) {
                        const productEigs = computeProductEigenvalues(
                            g1.eigenvalues, g2.eigenvalues, 'cartesian'
                        );
                        
                        productCache.set(cartHash, {
                            edges: cartesian.edges,
                            eigenvalues: productEigs,
                            productType: 'cartesian',
                            factors: [
                                { n: n1, family: g1.family },
                                { n: n2, family: g2.family }
                            ],
                            family: `${g1.family || `G(${n1})`} □ ${g2.family || `G(${n2})`}`
                        });
                    }
                    
                    // Tensor product (if it has edges)
                    if (g1.edges.length > 0 && g2.edges.length > 0) {
                        const tensor = tensorProduct(g1.edges, n1, g2.edges, n2);
                        if (tensor.edges.length > 0) {
                            const tensHash = computeCanonicalHash(tensor.n, tensor.edges);
                            
                            if (!productCache.has(tensHash)) {
                                const tensorEigs = computeProductEigenvalues(
                                    g1.eigenvalues, g2.eigenvalues, 'tensor'
                                );
                                
                                productCache.set(tensHash, {
                                    edges: tensor.edges,
                                    eigenvalues: tensorEigs,
                                    productType: 'tensor',
                                    factors: [
                                        { n: n1, family: g1.family },
                                        { n: n2, family: g2.family }
                                    ],
                                    family: `${g1.family || `G(${n1})`} ⊗ ${g2.family || `G(${n2})`}`
                                });
                            }
                        }
                    }
                    
                    computed++;
                    if (progressCallback && computed % 100 === 0) {
                        progressCallback({
                            phase: 'products',
                            computed,
                            message: `Pre-computing products: ${computed} checked, ${productCache.size} found`
                        });
                    }
                }
            }
        }
    }
    
    return productCache.size;
}

/**
 * Check if a graph is a known product graph
 */
export function checkProductGraph(n, canonHash) {
    initializeForN(n);
    const cache = graphDatabase.productGraphs.get(n);
    if (cache && cache.has(canonHash)) {
        graphDatabase.stats.productMatches++;
        return cache.get(canonHash);
    }
    return null;
}

/**
 * Find all ways to factor n into pairs (for 2-factor products)
 */
function findFactorizations(n) {
    const result = [];
    for (let i = 2; i <= Math.sqrt(n); i++) {
        if (n % i === 0) {
            result.push([i, n / i]);
        }
    }
    return result;
}

// =====================================================
// DISCONNECTED GRAPH HANDLING
// =====================================================

/**
 * Find connected components of a graph
 */
export function findConnectedComponents(n, edges) {
    const adj = Array(n).fill(null).map(() => []);
    for (const [i, j] of edges) {
        adj[i].push(j);
        adj[j].push(i);
    }
    
    const visited = new Array(n).fill(false);
    const components = [];
    
    for (let start = 0; start < n; start++) {
        if (visited[start]) continue;
        
        const component = [];
        const stack = [start];
        
        while (stack.length > 0) {
            const v = stack.pop();
            if (visited[v]) continue;
            visited[v] = true;
            component.push(v);
            
            for (const neighbor of adj[v]) {
                if (!visited[neighbor]) {
                    stack.push(neighbor);
                }
            }
        }
        
        components.push(component.sort((a, b) => a - b));
    }
    
    return components;
}

/**
 * Extract subgraph for a component
 */
export function extractComponentGraph(vertices, allEdges) {
    const vertexSet = new Set(vertices);
    const vertexMap = new Map();
    vertices.forEach((v, i) => vertexMap.set(v, i));
    
    const componentEdges = [];
    for (const [i, j] of allEdges) {
        if (vertexSet.has(i) && vertexSet.has(j)) {
            const newI = vertexMap.get(i);
            const newJ = vertexMap.get(j);
            componentEdges.push(newI < newJ ? [newI, newJ] : [newJ, newI]);
        }
    }
    
    return { n: vertices.length, edges: componentEdges };
}

/**
 * Try to resolve disconnected graph using component lookup
 * Returns: { resolved: bool, analytic?: bool, eigenvalues?: [], reason?: string }
 */
export function resolveDisconnectedGraph(n, edges) {
    const components = findConnectedComponents(n, edges);
    
    if (components.length === 1) {
        return { resolved: false, reason: 'connected' };
    }
    
    const componentResults = [];
    
    for (const componentVertices of components) {
        const compGraph = extractComponentGraph(componentVertices, edges);
        const compHash = computeCanonicalHash(compGraph.n, compGraph.edges);
        
        // Check if this component is in our analytic database
        const analyticCache = getAnalyticGraphs(compGraph.n);
        if (analyticCache && analyticCache.has(compHash)) {
            componentResults.push({
                analytic: true,
                eigenvalues: analyticCache.get(compHash).eigenvalues,
                family: analyticCache.get(compHash).family
            });
            continue;
        }
        
        // Check polynomial cache for non-analytic
        // (We'd need to compute polynomial here, which defeats the purpose)
        // For now, return unresolved if component not in database
        
        return { resolved: false, reason: 'component_not_in_database' };
    }
    
    // All components resolved! Combine eigenvalues (disjoint union = multiset union)
    graphDatabase.stats.disconnectedResolved++;
    
    const combinedEigenvalues = [];
    const componentFamilies = [];
    
    for (const result of componentResults) {
        combinedEigenvalues.push(...result.eigenvalues);
        if (result.family) componentFamilies.push(result.family);
    }
    
    // Sort eigenvalues
    combinedEigenvalues.sort((a, b) => Math.abs(b.value) - Math.abs(a.value));
    
    return {
        resolved: true,
        analytic: true,
        eigenvalues: combinedEigenvalues,
        family: componentFamilies.length > 0 ? componentFamilies.join(' ∪ ') : null,
        components: components.length
    };
}

// =====================================================
// SEEDING WITH KNOWN FAMILIES
// =====================================================

/**
 * Seed the database with known analytic graph families
 */
export function seedKnownFamilies(maxN = 7) {
    for (let n = 2; n <= maxN; n++) {
        initializeForN(n);
        
        // Empty graph E_n
        const emptyEdges = [];
        const emptyHash = computeCanonicalHash(n, emptyEdges);
        storeAnalyticGraph(n, emptyHash, {
            edges: emptyEdges,
            eigenvalues: Array(n).fill({ value: 0, formula: '0' }),
            family: `Empty E_${n}`,
            knownFamily: true
        });
        
        // Complete graph K_n
        const completeEdges = [];
        for (let i = 0; i < n; i++) {
            for (let j = i + 1; j < n; j++) {
                completeEdges.push([i, j]);
            }
        }
        const completeHash = computeCanonicalHash(n, completeEdges);
        const completeEigs = computeCompleteGraphEigenvalues(n);
        storeAnalyticGraph(n, completeHash, {
            edges: completeEdges,
            eigenvalues: completeEigs,
            family: `Complete K_${n}`,
            knownFamily: true
        });
        
        // Path graph P_n (for n >= 2)
        if (n >= 2) {
            const pathEdges = [];
            for (let i = 0; i < n - 1; i++) {
                pathEdges.push([i, i + 1]);
            }
            const pathHash = computeCanonicalHash(n, pathEdges);
            const pathEigs = computePathGraphEigenvalues(n);
            storeAnalyticGraph(n, pathHash, {
                edges: pathEdges,
                eigenvalues: pathEigs,
                family: `Path P_${n}`,
                knownFamily: true
            });
        }
        
        // Cycle graph C_n (for n >= 3)
        if (n >= 3) {
            const cycleEdges = [];
            for (let i = 0; i < n; i++) {
                cycleEdges.push([i, (i + 1) % n]);
            }
            // Normalize edge format
            const normalizedCycle = cycleEdges.map(([i, j]) => i < j ? [i, j] : [j, i]);
            const cycleHash = computeCanonicalHash(n, normalizedCycle);
            const cycleEigs = computeCycleGraphEigenvalues(n);
            storeAnalyticGraph(n, cycleHash, {
                edges: normalizedCycle,
                eigenvalues: cycleEigs,
                family: `Cycle C_${n}`,
                knownFamily: true
            });
        }
        
        // Star graph S_n (for n >= 3)
        if (n >= 3) {
            const starEdges = [];
            for (let i = 1; i < n; i++) {
                starEdges.push([0, i]);
            }
            const starHash = computeCanonicalHash(n, starEdges);
            const starEigs = computeStarGraphEigenvalues(n);
            storeAnalyticGraph(n, starHash, {
                edges: starEdges,
                eigenvalues: starEigs,
                family: `Star S_${n}`,
                knownFamily: true
            });
        }
    }
}

/**
 * Compute eigenvalues for complete graph K_n (skew-symmetric)
 * λ_k = ±i·cot((2k-1)π/2n), k = 1,...,floor(n/2)
 */
function computeCompleteGraphEigenvalues(n) {
    const eigs = [];
    for (let k = 1; k <= Math.floor(n / 2); k++) {
        const val = 1 / Math.tan((2 * k - 1) * Math.PI / (2 * n));
        eigs.push({ value: val, formula: `cot(${2*k-1}π/${2*n})` });
        eigs.push({ value: -val, formula: `-cot(${2*k-1}π/${2*n})` });
    }
    if (n % 2 === 1) {
        eigs.push({ value: 0, formula: '0' });
    }
    return eigs;
}

/**
 * Compute eigenvalues for path graph P_n (skew-symmetric)
 * λ_k = ±i·2cos(kπ/(n+1)), k = 1,...,n
 */
function computePathGraphEigenvalues(n) {
    const eigs = [];
    for (let k = 1; k <= n; k++) {
        const val = 2 * Math.cos(k * Math.PI / (n + 1));
        eigs.push({ value: val, formula: `2cos(${k}π/${n+1})` });
    }
    return eigs;
}

/**
 * Compute eigenvalues for cycle graph C_n (skew-symmetric)
 * λ_k = ±i·2sin(2kπ/n), k = 0,...,n-1
 */
function computeCycleGraphEigenvalues(n) {
    const eigs = [];
    for (let k = 0; k < n; k++) {
        const val = 2 * Math.sin(2 * k * Math.PI / n);
        eigs.push({ value: val, formula: `2sin(${2*k}π/${n})` });
    }
    return eigs;
}

/**
 * Compute eigenvalues for star graph S_n (skew-symmetric)
 * λ = ±i·√(n-1), plus (n-2) zeros
 */
function computeStarGraphEigenvalues(n) {
    const eigs = [];
    const sqrtVal = Math.sqrt(n - 1);
    eigs.push({ value: sqrtVal, formula: `√${n-1}` });
    eigs.push({ value: -sqrtVal, formula: `-√${n-1}` });
    for (let i = 0; i < n - 2; i++) {
        eigs.push({ value: 0, formula: '0' });
    }
    return eigs;
}

// =====================================================
// PERSISTENCE (LocalStorage)
// =====================================================

const STORAGE_KEY = 'graphAnalyticDatabase';

/**
 * Save database to localStorage
 */
export function saveDatabase() {
    try {
        const data = {
            version: 2,
            analyticGraphs: {},
            nonAnalyticPolys: {},
            polynomialCache: {},
            productGraphs: {}
        };
        
        for (const [n, map] of graphDatabase.analyticGraphs) {
            data.analyticGraphs[n] = Object.fromEntries(map);
        }
        for (const [n, set] of graphDatabase.nonAnalyticPolys) {
            data.nonAnalyticPolys[n] = [...set];
        }
        for (const [n, map] of graphDatabase.polynomialCache) {
            data.polynomialCache[n] = Object.fromEntries(map);
        }
        for (const [n, map] of graphDatabase.productGraphs) {
            data.productGraphs[n] = Object.fromEntries(map);
        }
        
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
        return true;
    } catch (e) {
        console.warn('Failed to save graph database:', e);
        return false;
    }
}

/**
 * Load database from localStorage
 */
export function loadDatabase() {
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (!stored) return false;
        
        const data = JSON.parse(stored);
        if (data.version !== 2) {
            console.warn('Database version mismatch, clearing');
            localStorage.removeItem(STORAGE_KEY);
            return false;
        }
        
        for (const [n, obj] of Object.entries(data.analyticGraphs)) {
            graphDatabase.analyticGraphs.set(parseInt(n), new Map(Object.entries(obj)));
        }
        for (const [n, arr] of Object.entries(data.nonAnalyticPolys)) {
            graphDatabase.nonAnalyticPolys.set(parseInt(n), new Set(arr));
        }
        for (const [n, obj] of Object.entries(data.polynomialCache)) {
            graphDatabase.polynomialCache.set(parseInt(n), new Map(Object.entries(obj)));
        }
        for (const [n, obj] of Object.entries(data.productGraphs)) {
            graphDatabase.productGraphs.set(parseInt(n), new Map(Object.entries(obj)));
        }
        
        return true;
    } catch (e) {
        console.warn('Failed to load graph database:', e);
        return false;
    }
}

/**
 * Clear database
 */
export function clearDatabase() {
    graphDatabase.analyticGraphs.clear();
    graphDatabase.nonAnalyticPolys.clear();
    graphDatabase.polynomialCache.clear();
    graphDatabase.productGraphs.clear();
    resetStats();
    localStorage.removeItem(STORAGE_KEY);
}

// =====================================================
// EXPORTS
// =====================================================

export {
    graphDatabase,
    initializeForN
};
