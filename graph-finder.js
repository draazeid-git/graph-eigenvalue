/**
 * Graph Finder Module
 * Finds all non-isomorphic graphs with closed-form eigenvalues
 * Integrated into the web visualization tool
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
    subscript
} from './spectral-analysis.js';

// =====================================================
// SEARCH STATE (for cancellation)
// =====================================================

let searchCancelled = false;

export function cancelSearch() {
    searchCancelled = true;
}

export function isSearchRunning() {
    return !searchCancelled;
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
    const totalCombinations = 1 << numEdges; // 2^numEdges
    
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
 * Compute a canonical form for isomorphism detection
 * Uses degree sequence + edge degree pairs + triangle count + neighbor degree sums
 * This catches ~99% of isomorphisms for small graphs
 */
function computeCanonicalForm(n, edges) {
    if (edges.length === 0) {
        return JSON.stringify({ degrees: Array(n).fill(0), edgeDegrees: [], triangles: 0, m: 0 });
    }
    
    // Build adjacency
    const adj = Array.from({ length: n }, () => new Set());
    for (const [i, j] of edges) {
        adj[i].add(j);
        adj[j].add(i);
    }
    
    // Degree sequence (sorted descending)
    const degrees = adj.map(s => s.size).sort((a, b) => b - a);
    
    // Edge degree pairs (sorted)
    const edgeDegrees = edges.map(([i, j]) => {
        const di = adj[i].size, dj = adj[j].size;
        return di <= dj ? [di, dj] : [dj, di];
    }).sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    
    // Count triangles (strong isomorphism invariant)
    let triangles = 0;
    for (const [i, j] of edges) {
        for (const k of adj[i]) {
            if (k > j && adj[j].has(k)) {
                triangles++;
            }
        }
    }
    
    // Neighbor degree sequence for each vertex (sorted), then sorted
    const neighborDegSums = [];
    for (let i = 0; i < n; i++) {
        let sum = 0;
        for (const j of adj[i]) {
            sum += adj[j].size;
        }
        neighborDegSums.push(sum);
    }
    neighborDegSums.sort((a, b) => b - a);
    
    return JSON.stringify({ degrees, edgeDegrees, triangles, neighborDegSums, m: edges.length });
}

/**
 * Check if graph is connected using BFS
 */
function isConnected(n, edges) {
    if (n <= 1) return true;
    if (edges.length < n - 1) return false; // Not enough edges to connect
    
    // Build adjacency list
    const adj = Array.from({ length: n }, () => []);
    for (const [i, j] of edges) {
        adj[i].push(j);
        adj[j].push(i);
    }
    
    // BFS from vertex 0
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
 * Enumerate unique graphs (up to isomorphism)
 * @param {number} n - Number of vertices
 * @param {Object} options - Filter options
 * @param {boolean} options.connectedOnly - Only include connected graphs
 * @param {boolean} options.regularOnly - Only include regular graphs
 * @param {number} options.minEdges - Minimum edge count
 * @param {number} options.maxEdges - Maximum edge count
 * @param {function} progressCallback - Progress callback
 */
async function enumerateUniqueGraphs(n, options = {}, progressCallback = null) {
    // Handle legacy call signature: enumerateUniqueGraphs(n, progressCallback)
    if (typeof options === 'function') {
        progressCallback = options;
        options = {};
    }
    
    const {
        connectedOnly = false,
        regularOnly = false,
        minEdges = 0,
        maxEdges = Infinity,
        maxResults = Infinity  // Limit number of unique graphs found
    } = options;
    
    const seen = new Set();
    const uniqueGraphs = [];
    let total = 0;
    let skippedDisconnected = 0;
    let skippedIrregular = 0;
    let skippedEdgeCount = 0;
    const totalPossible = 1 << (n * (n - 1) / 2);
    
    for (const edges of generateAllEdgeSets(n)) {
        // Check for cancellation
        if (searchCancelled) {
            return { graphs: uniqueGraphs, cancelled: true, total, skippedDisconnected };
        }
        
        // Check max results limit
        if (uniqueGraphs.length >= maxResults) {
            return { graphs: uniqueGraphs, limitReached: true, total, skippedDisconnected };
        }
        
        total++;
        
        // Yield to UI every 500 graphs to prevent "Page Unresponsive"
        if (total % 500 === 0) {
            if (progressCallback) {
                progressCallback(total, totalPossible, {
                    found: uniqueGraphs.length,
                    skippedDisconnected,
                    skippedIrregular,
                    skippedEdgeCount
                });
            }
            // Yield control to browser
            await new Promise(resolve => setTimeout(resolve, 0));
        }
        
        // Edge count filter (very fast, do first)
        const edgeCount = edges.length;
        if (edgeCount < minEdges || edgeCount > maxEdges) {
            skippedEdgeCount++;
            continue;
        }
        
        // Connected filter (fast BFS, do before expensive canonical form)
        if (connectedOnly && !isConnected(n, edges)) {
            skippedDisconnected++;
            continue;
        }
        
        // Regular filter
        if (regularOnly) {
            const degrees = Array(n).fill(0);
            for (const [i, j] of edges) {
                degrees[i]++;
                degrees[j]++;
            }
            const firstDegree = degrees[0];
            const isRegular = degrees.every(d => d === firstDegree);
            if (!isRegular) {
                skippedIrregular++;
                continue;
            }
        }
        
        const canon = computeCanonicalForm(n, edges);
        
        if (!seen.has(canon)) {
            seen.add(canon);
            uniqueGraphs.push({
                edges: edges,
                canonical: canon
            });
        }
    }
    
    return { 
        graphs: uniqueGraphs, 
        cancelled: false, 
        limitReached: false,
        total, 
        skippedDisconnected 
    };
}

// =====================================================
// EIGENVALUE ANALYSIS
// =====================================================

/**
 * Build skew-symmetric adjacency matrix from edges
 */
function buildSkewSymmetricMatrix(n, edges) {
    const A = Array.from({ length: n }, () => Array(n).fill(0));
    for (const [i, j] of edges) {
        A[i][j] = 1;
        A[j][i] = -1;
    }
    return A;
}

/**
 * Build symmetric adjacency matrix from edges
 */
function buildSymmetricMatrix(n, edges) {
    const A = Array.from({ length: n }, () => Array(n).fill(0));
    for (const [i, j] of edges) {
        A[i][j] = 1;
        A[j][i] = 1;
    }
    return A;
}

/**
 * Compute characteristic polynomial coefficients
 * Returns array [a_n, a_{n-1}, ..., a_1, a_0] for det(A - xI)
 */
function computeCharPolyCoeffs(matrix) {
    const n = matrix.length;
    if (n === 0) return [1];
    
    // Use Faddeev-LeVerrier algorithm
    const coeffs = [1]; // Leading coefficient is always 1
    let M = matrix.map(row => [...row]);
    
    for (let k = 1; k <= n; k++) {
        // Compute trace of M
        let trace = 0;
        for (let i = 0; i < n; i++) {
            trace += M[i][i];
        }
        
        // c_k = -trace(M) / k
        const ck = -trace / k;
        coeffs.push(ck);
        
        if (k < n) {
            // M = A * (M + c_k * I)
            const temp = Array.from({ length: n }, () => Array(n).fill(0));
            for (let i = 0; i < n; i++) {
                M[i][i] += ck;
            }
            for (let i = 0; i < n; i++) {
                for (let j = 0; j < n; j++) {
                    for (let l = 0; l < n; l++) {
                        temp[i][j] += matrix[i][l] * M[l][j];
                    }
                }
            }
            M = temp;
        }
    }
    
    return coeffs;
}

/**
 * Identify graph family
 */
function identifyGraphFamily(n, edges) {
    const m = edges.length;
    
    // Build adjacency
    const adj = Array.from({ length: n }, () => new Set());
    for (const [i, j] of edges) {
        adj[i].add(j);
        adj[j].add(i);
    }
    const degrees = adj.map(s => s.size);
    
    // Empty graph
    if (m === 0) return `Empty graph E${subscript(n)}`;
    
    // Complete graph
    if (m === n * (n - 1) / 2) return `Complete graph K${subscript(n)}`;
    
    // Check connectivity
    const visited = new Set();
    const stack = [0];
    while (stack.length > 0) {
        const node = stack.pop();
        if (!visited.has(node)) {
            visited.add(node);
            for (const neighbor of adj[node]) {
                if (!visited.has(neighbor)) {
                    stack.push(neighbor);
                }
            }
        }
    }
    const connected = visited.size === n;
    
    // Path graph
    if (m === n - 1 && connected) {
        const degreeCount = {};
        for (const d of degrees) {
            degreeCount[d] = (degreeCount[d] || 0) + 1;
        }
        if (degreeCount[1] === 2 && (degreeCount[2] || 0) === n - 2) {
            return `Path graph P${subscript(n)}`;
        }
        // Star graph
        if (degrees.includes(n - 1) && degrees.filter(d => d === 1).length === n - 1) {
            return `Star graph K${subscript(1)},${subscript(n-1)}`;
        }
    }
    
    // Cycle graph
    if (m === n && connected && degrees.every(d => d === 2)) {
        return `Cycle graph C${subscript(n)}`;
    }
    
    // Regular graph
    if (degrees.every(d => d === degrees[0]) && degrees[0] > 0) {
        return `${degrees[0]}-regular graph`;
    }
    
    // Check for complete bipartite
    // ... could add more family detection
    
    return null;
}

// =====================================================
// MAIN FINDER FUNCTION
// =====================================================

/**
 * Find all graphs with analytic eigenvalues for n vertices
 * @param {number} n - Number of vertices
 * @param {Object} options - Search options
 * @param {boolean} options.connectedOnly - Only search connected graphs (default: true)
 * @param {boolean} options.regularOnly - Only search regular graphs (default: false)
 * @param {number} options.minEdges - Minimum edge count (default: 0)
 * @param {number} options.maxEdges - Maximum edge count (default: Infinity)
 * @param {number} options.maxUniqueGraphs - Stop after finding this many unique graphs (default: 10000)
 * @param {function} options.progressCallback - Progress callback (legacy support)
 * @param {function} progressCallback - Progress callback (legacy parameter)
 * @returns {Promise} - Resolves to results object
 */
export async function findAnalyticGraphs(n, options = null, progressCallback = null) {
    // Reset cancel flag
    searchCancelled = false;
    
    // Handle legacy call signature: findAnalyticGraphs(n, progressCallback)
    if (typeof options === 'function') {
        progressCallback = options;
        options = {};
    }
    options = options || {};
    progressCallback = progressCallback || options.progressCallback;
    
    const {
        connectedOnly = true,  // Default to connected graphs only (much faster)
        regularOnly = false,
        minEdges = 0,
        maxEdges = Infinity,
        maxUniqueGraphs = 10000  // Safety limit
    } = options;
    
    const startTime = performance.now();
    
    if (progressCallback) {
        const filterDesc = [];
        if (connectedOnly) filterDesc.push('connected');
        if (regularOnly) filterDesc.push('regular');
        const filterStr = filterDesc.length ? ` (${filterDesc.join(', ')} only)` : '';
        progressCallback({ status: 'enumerating', message: `Enumerating graphs for n=${n}${filterStr}...` });
    }
    
    // Enumerate unique graphs with filters applied (async)
    const enumResult = await enumerateUniqueGraphs(n, { 
        connectedOnly, regularOnly, minEdges, maxEdges, maxResults: maxUniqueGraphs 
    }, (current, total, stats) => {
            if (progressCallback) {
                let msg = `Checked ${current.toLocaleString()} of ${total.toLocaleString()} graphs, found ${stats.found} unique`;
                if (connectedOnly && stats.skippedDisconnected > 0) {
                    msg += ` (skipped ${stats.skippedDisconnected.toLocaleString()} disconnected)`;
                }
                progressCallback({ 
                    status: 'enumerating', 
                    message: msg,
                    progress: current / total
                });
            }
        }
    );
    
    // Check if cancelled or limit reached
    if (enumResult.cancelled) {
        return {
            n: n,
            totalUnique: enumResult.graphs.length,
            totalPolynomials: 0,
            analyticCount: 0,
            elapsed: (performance.now() - startTime) / 1000,
            graphs: [],
            cancelled: true,
            filters: { connectedOnly, regularOnly, minEdges, maxEdges }
        };
    }
    
    const uniqueGraphs = enumResult.graphs;
    
    if (progressCallback) {
        let msg = `Analyzing ${uniqueGraphs.length} unique graphs...`;
        if (enumResult.limitReached) {
            msg += ` (limit of ${maxUniqueGraphs.toLocaleString()} reached)`;
        }
        progressCallback({ status: 'analyzing', message: msg });
    }
    
    // Group by eigenvalues (more stable than polynomial coefficients)
    // Using eigenvalue signature instead of Faddeev-LeVerrier polynomial
    const eigGroups = new Map();
    const eigTolerance = 1e-4;
    
    function getEigenvalueKey(eigenvalues) {
        // Sort eigenvalues and round to reasonable precision for grouping
        const sorted = [...eigenvalues].sort((a, b) => b - a);
        // Use a coarser precision for grouping to handle numerical noise
        return sorted.map(e => e.toFixed(4)).join(',');
    }
    
    for (let i = 0; i < uniqueGraphs.length; i++) {
        // Check for cancellation
        if (searchCancelled) {
            return {
                n, totalUnique: uniqueGraphs.length, totalPolynomials: eigGroups.size,
                analyticCount: 0, elapsed: (performance.now() - startTime) / 1000,
                graphs: [], cancelled: true, filters: { connectedOnly, regularOnly, minEdges, maxEdges }
            };
        }
        
        const { edges } = uniqueGraphs[i];
        const symMatrix = buildSymmetricMatrix(n, edges);
        const symEigs = computeEigenvaluesNumerical(symMatrix);
        const eigKey = getEigenvalueKey(symEigs);
        
        if (!eigGroups.has(eigKey)) {
            eigGroups.set(eigKey, {
                eigenvalues: symEigs,
                graphs: []
            });
        }
        eigGroups.get(eigKey).graphs.push(edges);
        
        // Yield to UI every 50 graphs
        if (i % 50 === 0) {
            if (progressCallback) {
                progressCallback({
                    status: 'analyzing',
                    message: `Computing eigenvalues: ${i + 1} of ${uniqueGraphs.length} graphs...`,
                    progress: i / uniqueGraphs.length
                });
            }
            await new Promise(resolve => setTimeout(resolve, 0));
        }
    }
    
    if (progressCallback) {
        progressCallback({ status: 'solving', message: `Analyzing ${eigGroups.size} unique spectra for closed forms...` });
    }
    
    // Find graphs with analytic eigenvalues
    const results = [];
    let groupIndex = 0;
    const totalGroups = eigGroups.size;
    
    for (const [eigKey, { eigenvalues: symEigs, graphs }] of eigGroups) {
        // Check for cancellation
        if (searchCancelled) {
            return {
                n, totalUnique: uniqueGraphs.length, totalPolynomials: eigGroups.size,
                analyticCount: results.length, elapsed: (performance.now() - startTime) / 1000,
                graphs: results, cancelled: true, filters: { connectedOnly, regularOnly, minEdges, maxEdges }
            };
        }
        
        groupIndex++;
        
        const edges = graphs[0]; // Representative graph
        const skewMatrix = buildSkewSymmetricMatrix(n, edges);
        const skewEigs = computeSkewSymmetricEigenvalues(skewMatrix);
        
        // Analyze for closed forms
        const symAnalysis = analyzeEigenvaluesForClosedForms(symEigs);
        const skewImagParts = skewEigs.map(e => e.imag);
        const skewAnalysis = analyzeEigenvaluesForClosedForms(skewImagParts);
        
        // Only include if symmetric eigenvalues have nice forms
        if (symAnalysis.allAnalytic) {
            const family = identifyGraphFamily(n, edges);
            
            results.push({
                n: n,
                edges: edges,
                edgeCount: edges.length,
                family: family,
                symmetricEigenvalues: symAnalysis.eigenvalues,
                skewEigenvalues: skewAnalysis.eigenvalues.map(e => ({
                    ...e,
                    form: e.value === 0 ? '0' : `±${e.form}i`
                })),
                isomorphismClassSize: graphs.length
            });
        }
        
        // Yield to UI every 20 groups
        if (groupIndex % 20 === 0) {
            if (progressCallback) {
                progressCallback({
                    status: 'solving',
                    message: `Analyzing spectra: ${groupIndex} of ${totalGroups}, found ${results.length} analytic...`,
                    progress: groupIndex / totalGroups
                });
            }
            await new Promise(resolve => setTimeout(resolve, 0));
        }
    }
    
    // Sort by edge count
    results.sort((a, b) => a.edgeCount - b.edgeCount);
    
    const elapsed = (performance.now() - startTime) / 1000;
    
    if (progressCallback) {
        progressCallback({ 
            status: 'complete', 
            message: `Found ${results.length} graphs with analytic eigenvalues in ${elapsed.toFixed(2)}s`
        });
    }
    
    return {
        n: n,
        totalUnique: uniqueGraphs.length,
        totalPolynomials: eigGroups.size,
        analyticCount: results.length,
        elapsed: elapsed,
        graphs: results,
        filters: { connectedOnly, regularOnly, minEdges, maxEdges }
    };
}

/**
 * Format polynomial from coefficients
 */
function formatPolynomialFromCoeffs(coeffs) {
    const n = coeffs.length - 1;
    let terms = [];
    
    for (let i = 0; i <= n; i++) {
        const coeff = coeffs[i];
        const power = n - i;
        
        if (Math.abs(coeff) < 1e-10) continue;
        
        let term = '';
        const absCoeff = Math.abs(coeff);
        const roundCoeff = Math.round(absCoeff);
        
        // Coefficient
        if (power === 0 || Math.abs(absCoeff - 1) > 1e-10) {
            if (Math.abs(absCoeff - roundCoeff) < 1e-10) {
                term = String(roundCoeff);
            } else {
                term = absCoeff.toFixed(2);
            }
        }
        
        // Variable
        if (power > 0) {
            term += 'λ';
            if (power > 1) {
                term += superscript(power);
            }
        }
        
        // Sign
        if (terms.length === 0) {
            if (coeff < 0) term = '-' + term;
        } else {
            term = (coeff >= 0 ? ' + ' : ' - ') + term;
        }
        
        terms.push(term);
    }
    
    return terms.join('') || '0';
}

function superscript(num) {
    const sups = '⁰¹²³⁴⁵⁶⁷⁸⁹';
    return String(num).split('').map(d => sups[parseInt(d)]).join('');
}

// =====================================================
// GRAPH LOADING
// =====================================================

/**
 * Load a discovered graph into the visualization
 * @param {Object} result - Graph result from search
 * @param {Object} layoutOptions - Layout options
 * @param {string} layoutOptions.type - 'circle', 'sphere', 'concentric-2', 'concentric-3', 'concentric-spheres-2'
 * @param {number} layoutOptions.radius - Layout radius (default: 40)
 * @param {number} layoutOptions.innerRatio - Inner circle ratio for concentric layouts (default: 50)
 * @param {number} layoutOptions.middleRatio - Middle circle ratio for 3-ring layouts (default: 70)
 * @param {string} layoutOptions.customSplit - Custom split like "3,5" for concentric layouts
 */
export function loadGraphFromResult(result, layoutOptions = {}) {
    const n = result.n;
    const edges = result.edges;
    
    const {
        type = 'circle',
        radius = 40,
        innerRatio = 50,
        middleRatio = 70,
        customSplit = null
    } = layoutOptions;
    
    // Clear existing graph
    clearGraph();
    
    // CRITICAL: Initialize adjacency matrices BEFORE adding edges
    state.adjacencyMatrix = Array(n).fill(null).map(() => Array(n).fill(0));
    state.symmetricAdjMatrix = Array(n).fill(null).map(() => Array(n).fill(0));
    
    // Get positions based on layout type
    let positions;
    const splitMode = customSplit ? 'custom' : 'half';
    
    switch (type) {
        case 'sphere':
            positions = getSpherePositions(n, radius);
            break;
        case 'concentric-2':
            positions = getConcentricCirclePositions2(n, radius, innerRatio, splitMode, customSplit);
            break;
        case 'concentric-3':
            positions = getConcentricCirclePositions3(n, radius, innerRatio, middleRatio, splitMode, customSplit);
            break;
        case 'concentric-spheres-2':
            positions = getConcentricSpherePositions2(n, radius, innerRatio, splitMode, customSplit);
            break;
        case 'circle':
        default:
            positions = getCirclePositions(n, radius);
            break;
    }
    
    // Create vertices
    for (let i = 0; i < n; i++) {
        createVertex(positions[i], i);
    }
    
    // Add edges
    for (const [i, j] of edges) {
        addEdge(i, j);
    }
    
    return { vertices: n, edges: edges.length };
}

// =====================================================
// SEARCH SPACE ESTIMATION
// =====================================================

/**
 * Estimate the search space size and savings from filtering
 * @param {number} n - Number of vertices
 * @param {boolean} connectedOnly - Whether connected-only filter is applied
 */
export function estimateSearchSpace(n, connectedOnly = false) {
    const maxEdges = n * (n - 1) / 2;
    const totalGraphs = Math.pow(2, maxEdges);
    
    // Approximate proportion of connected graphs
    // Based on known asymptotic results
    const connectedRatios = {
        1: 1.0, 2: 0.5, 3: 0.5, 4: 0.41, 5: 0.24, 
        6: 0.17, 7: 0.10, 8: 0.06, 9: 0.035, 10: 0.02
    };
    const ratio = connectedRatios[n] || 0.01;
    const estimatedConnected = Math.round(totalGraphs * ratio);
    
    return {
        n,
        totalGraphs,
        estimatedConnected,
        connectedRatio: ratio,
        savings: connectedOnly 
            ? `~${Math.round((1 - ratio) * 100)}% fewer graphs to check`
            : 'none (checking all graphs)'
    };
}

// =====================================================
// EXPORT FOR UI
// =====================================================

export { 
    buildSkewSymmetricMatrix, 
    buildSymmetricMatrix, 
    identifyGraphFamily
};
