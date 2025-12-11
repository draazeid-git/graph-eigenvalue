/**
 * Comprehensive Graph Family Test Suite
 * 
 * Tests all graph families with larger node counts (default n=20 where applicable)
 * to verify that analytic/trigonometric eigenvalue formulas are correctly detected
 * and match numerical computations.
 * 
 * Run with: node test-graph-families.js
 */

// ============================================================================
// GRAPH GENERATION FUNCTIONS
// ============================================================================

/**
 * Generate adjacency matrix for Path Pn
 */
function generatePath(n) {
    const adj = Array(n).fill(null).map(() => Array(n).fill(0));
    for (let i = 0; i < n - 1; i++) {
        adj[i][i + 1] = 1;
        adj[i + 1][i] = -1;
    }
    return adj;
}

/**
 * Generate adjacency matrix for Cycle Cn (consistent orientation)
 */
function generateCycle(n) {
    const adj = Array(n).fill(null).map(() => Array(n).fill(0));
    for (let i = 0; i < n; i++) {
        const next = (i + 1) % n;
        adj[i][next] = 1;
        adj[next][i] = -1;
    }
    return adj;
}

/**
 * Generate adjacency matrix for Star Sn (n vertices, center is vertex 0)
 */
function generateStar(n) {
    const adj = Array(n).fill(null).map(() => Array(n).fill(0));
    for (let i = 1; i < n; i++) {
        adj[0][i] = 1;
        adj[i][0] = -1;
    }
    return adj;
}

/**
 * Generate adjacency matrix for Complete Kn
 */
function generateComplete(n) {
    const adj = Array(n).fill(null).map(() => Array(n).fill(0));
    for (let i = 0; i < n; i++) {
        for (let j = i + 1; j < n; j++) {
            adj[i][j] = 1;
            adj[j][i] = -1;
        }
    }
    return adj;
}

/**
 * Generate adjacency matrix for Complete Bipartite Km,k
 */
function generateCompleteBipartite(m, k) {
    const n = m + k;
    const adj = Array(n).fill(null).map(() => Array(n).fill(0));
    // Partition A: vertices 0..m-1, Partition B: vertices m..n-1
    for (let i = 0; i < m; i++) {
        for (let j = m; j < n; j++) {
            adj[i][j] = 1;
            adj[j][i] = -1;
        }
    }
    return adj;
}

/**
 * Generate adjacency matrix for Grid m×k
 */
function generateGrid(m, k) {
    const n = m * k;
    const adj = Array(n).fill(null).map(() => Array(n).fill(0));
    
    for (let row = 0; row < m; row++) {
        for (let col = 0; col < k; col++) {
            const v = row * k + col;
            // Right neighbor
            if (col < k - 1) {
                adj[v][v + 1] = 1;
                adj[v + 1][v] = -1;
            }
            // Down neighbor
            if (row < m - 1) {
                adj[v][v + k] = 1;
                adj[v + k][v] = -1;
            }
        }
    }
    return adj;
}

/**
 * Generate adjacency matrix for Ladder Ln (2×n grid)
 */
function generateLadder(n) {
    return generateGrid(2, n);
}

/**
 * Generate adjacency matrix for Wheel Wn (n-1 cycle + center)
 */
function generateWheel(n) {
    const adj = Array(n).fill(null).map(() => Array(n).fill(0));
    // Vertex 0 is center, vertices 1..n-1 form the rim
    const rimSize = n - 1;
    
    // Connect center to all rim vertices
    for (let i = 1; i < n; i++) {
        adj[0][i] = 1;
        adj[i][0] = -1;
    }
    
    // Connect rim vertices in a cycle
    for (let i = 1; i < n; i++) {
        const next = (i < n - 1) ? i + 1 : 1;
        adj[i][next] = 1;
        adj[next][i] = -1;
    }
    
    return adj;
}

/**
 * Generate adjacency matrix for Prism (two n-cycles connected)
 */
function generatePrism(n) {
    const total = 2 * n;
    const adj = Array(total).fill(null).map(() => Array(total).fill(0));
    
    // Top cycle: vertices 0..n-1
    for (let i = 0; i < n; i++) {
        const next = (i + 1) % n;
        adj[i][next] = 1;
        adj[next][i] = -1;
    }
    
    // Bottom cycle: vertices n..2n-1
    for (let i = 0; i < n; i++) {
        const v = n + i;
        const next = n + ((i + 1) % n);
        adj[v][next] = 1;
        adj[next][v] = -1;
    }
    
    // Vertical edges connecting the two cycles
    for (let i = 0; i < n; i++) {
        adj[i][n + i] = 1;
        adj[n + i][i] = -1;
    }
    
    return adj;
}

/**
 * Generate adjacency matrix for Hypercube Qd
 */
function generateHypercube(d) {
    const n = Math.pow(2, d);
    const adj = Array(n).fill(null).map(() => Array(n).fill(0));
    
    for (let v = 0; v < n; v++) {
        for (let bit = 0; bit < d; bit++) {
            const u = v ^ (1 << bit);  // Flip bit
            if (u > v) {
                adj[v][u] = 1;
                adj[u][v] = -1;
            }
        }
    }
    return adj;
}

/**
 * Generate S'p tree (depth 2, p branches from center, one extra vertex on one branch)
 * Total vertices: p + 2
 */
function generateStarPath(p) {
    const n = p + 2;
    const adj = Array(n).fill(null).map(() => Array(n).fill(0));
    
    // Center is vertex 0, leaves are 1..p, extra vertex is p+1 attached to vertex 1
    for (let i = 1; i <= p; i++) {
        adj[0][i] = 1;
        adj[i][0] = -1;
    }
    // Extra edge from vertex 1 to vertex p+1
    adj[1][p + 1] = 1;
    adj[p + 1][1] = -1;
    
    return adj;
}

/**
 * Generate S²p tree (double star: two centers connected, each with p/2 leaves)
 */
function generateDoubleStar(p) {
    const halfP = Math.floor(p / 2);
    const n = p + 2;  // 2 centers + p leaves
    const adj = Array(n).fill(null).map(() => Array(n).fill(0));
    
    // Centers are vertices 0 and 1
    adj[0][1] = 1;
    adj[1][0] = -1;
    
    // Leaves of center 0: vertices 2..halfP+1
    for (let i = 2; i <= halfP + 1; i++) {
        adj[0][i] = 1;
        adj[i][0] = -1;
    }
    
    // Leaves of center 1: vertices halfP+2..n-1
    for (let i = halfP + 2; i < n; i++) {
        adj[1][i] = 1;
        adj[i][1] = -1;
    }
    
    return adj;
}

/**
 * Generate Sᵈp tree (depth d, p branches at each level from spine)
 * Total vertices: d*p + 1
 */
function generateGeneralStarTree(d, p) {
    const n = d * p + 1;
    const adj = Array(n).fill(null).map(() => Array(n).fill(0));
    
    // Vertex 0 is the center
    // Build p branches of depth d
    let vertexIndex = 1;
    
    for (let branch = 0; branch < p; branch++) {
        let parent = 0;
        for (let level = 1; level <= d; level++) {
            adj[parent][vertexIndex] = 1;
            adj[vertexIndex][parent] = -1;
            parent = vertexIndex;
            vertexIndex++;
        }
    }
    
    return adj;
}

/**
 * Generate Binary Tree of depth d
 * Total vertices: 2^(d+1) - 1
 */
function generateBinaryTree(depth) {
    const n = Math.pow(2, depth + 1) - 1;
    const adj = Array(n).fill(null).map(() => Array(n).fill(0));
    
    for (let i = 0; i < n; i++) {
        const leftChild = 2 * i + 1;
        const rightChild = 2 * i + 2;
        
        if (leftChild < n) {
            adj[i][leftChild] = 1;
            adj[leftChild][i] = -1;
        }
        if (rightChild < n) {
            adj[i][rightChild] = 1;
            adj[rightChild][i] = -1;
        }
    }
    return adj;
}

/**
 * Generate Cuboid a×b×c (Cartesian product of paths)
 */
function generateCuboid(a, b, c) {
    const n = a * b * c;
    const adj = Array(n).fill(null).map(() => Array(n).fill(0));
    
    // Map (x,y,z) to linear index
    const idx = (x, y, z) => x * b * c + y * c + z;
    
    for (let x = 0; x < a; x++) {
        for (let y = 0; y < b; y++) {
            for (let z = 0; z < c; z++) {
                const v = idx(x, y, z);
                // Connect to neighbors in +x, +y, +z directions
                if (x < a - 1) {
                    const u = idx(x + 1, y, z);
                    adj[v][u] = 1;
                    adj[u][v] = -1;
                }
                if (y < b - 1) {
                    const u = idx(x, y + 1, z);
                    adj[v][u] = 1;
                    adj[u][v] = -1;
                }
                if (z < c - 1) {
                    const u = idx(x, y, z + 1);
                    adj[v][u] = 1;
                    adj[u][v] = -1;
                }
            }
        }
    }
    return adj;
}

/**
 * Generate Crown Graph (complete bipartite minus perfect matching)
 */
function generateCrown(n) {
    // n vertices in each partition, so 2n total
    const total = 2 * n;
    const adj = Array(total).fill(null).map(() => Array(total).fill(0));
    
    // Partition A: 0..n-1, Partition B: n..2n-1
    for (let i = 0; i < n; i++) {
        for (let j = 0; j < n; j++) {
            if (i !== j) {  // Skip the matching edge
                adj[i][n + j] = 1;
                adj[n + j][i] = -1;
            }
        }
    }
    return adj;
}

/**
 * Generate Circular Ladder (Möbius with twist=0)
 */
function generateCircularLadder(n) {
    const total = 2 * n;
    const adj = Array(total).fill(null).map(() => Array(total).fill(0));
    
    // Inner ring: 0..n-1
    for (let i = 0; i < n; i++) {
        const next = (i + 1) % n;
        adj[i][next] = 1;
        adj[next][i] = -1;
    }
    
    // Outer ring: n..2n-1
    for (let i = 0; i < n; i++) {
        const v = n + i;
        const next = n + ((i + 1) % n);
        adj[v][next] = 1;
        adj[next][v] = -1;
    }
    
    // Spokes
    for (let i = 0; i < n; i++) {
        adj[i][n + i] = 1;
        adj[n + i][i] = -1;
    }
    
    return adj;
}

/**
 * Generate Petersen Graph (10 vertices)
 */
function generatePetersen() {
    const adj = Array(10).fill(null).map(() => Array(10).fill(0));
    
    // Outer pentagon: 0-1-2-3-4-0
    const outerEdges = [[0,1],[1,2],[2,3],[3,4],[4,0]];
    // Inner pentagram: 5-7-9-6-8-5
    const innerEdges = [[5,7],[7,9],[9,6],[6,8],[8,5]];
    // Spokes: 0-5, 1-6, 2-7, 3-8, 4-9
    const spokeEdges = [[0,5],[1,6],[2,7],[3,8],[4,9]];
    
    const allEdges = [...outerEdges, ...innerEdges, ...spokeEdges];
    for (const [i, j] of allEdges) {
        adj[i][j] = 1;
        adj[j][i] = -1;
    }
    
    return adj;
}

/**
 * Generate Lollipop Graph (complete Km + path of length l attached)
 */
function generateLollipop(m, l) {
    const n = m + l;
    const adj = Array(n).fill(null).map(() => Array(n).fill(0));
    
    // Complete graph on vertices 0..m-1
    for (let i = 0; i < m; i++) {
        for (let j = i + 1; j < m; j++) {
            adj[i][j] = 1;
            adj[j][i] = -1;
        }
    }
    
    // Path from vertex m-1 to vertex n-1
    for (let i = m - 1; i < n - 1; i++) {
        adj[i][i + 1] = 1;
        adj[i + 1][i] = -1;
    }
    
    return adj;
}

// ============================================================================
// NUMERICAL EIGENVALUE COMPUTATION
// ============================================================================

/**
 * Compute eigenvalues of symmetric matrix using Jacobi iteration
 */
function computeSymmetricEigenvalues(matrix) {
    const n = matrix.length;
    if (n === 0) return [];
    if (n === 1) return [matrix[0][0]];
    
    let A = matrix.map(row => [...row]);
    
    for (let iter = 0; iter < 500 * n; iter++) {
        let maxVal = 0, maxI = 0, maxJ = 1;
        for (let i = 0; i < n; i++) {
            for (let j = i + 1; j < n; j++) {
                if (Math.abs(A[i][j]) > maxVal) {
                    maxVal = Math.abs(A[i][j]);
                    maxI = i;
                    maxJ = j;
                }
            }
        }
        
        if (maxVal < 1e-14) break;
        
        const i = maxI, j = maxJ;
        const diff = A[j][j] - A[i][i];
        let t;
        if (Math.abs(diff) < 1e-15) {
            t = 1;
        } else {
            const phi = diff / (2 * A[i][j]);
            t = 1 / (Math.abs(phi) + Math.sqrt(phi * phi + 1));
            if (phi < 0) t = -t;
        }
        
        const c = 1 / Math.sqrt(1 + t * t);
        const s = t * c;
        
        const Ai = [...A[i]];
        const Aj = [...A[j]];
        
        for (let k = 0; k < n; k++) {
            if (k !== i && k !== j) {
                A[i][k] = c * Ai[k] - s * Aj[k];
                A[k][i] = A[i][k];
                A[j][k] = s * Ai[k] + c * Aj[k];
                A[k][j] = A[j][k];
            }
        }
        
        A[i][i] = c * c * Ai[i] - 2 * s * c * Ai[j] + s * s * Aj[j];
        A[j][j] = s * s * Ai[i] + 2 * s * c * Ai[j] + c * c * Aj[j];
        A[i][j] = 0;
        A[j][i] = 0;
    }
    
    const eigenvalues = [];
    for (let i = 0; i < n; i++) {
        eigenvalues.push(A[i][i]);
    }
    return eigenvalues.sort((a, b) => b - a);
}

/**
 * Compute skew-symmetric spectrum via eigenvalues of -B²
 * For skew-symmetric B, eigenvalues are ±iσ
 * Eigenvalues of -B² = B^T B are σ² (each σ appears twice for ± pair)
 * Returns |Im(λ)| for all eigenvalues, sorted descending
 */
function computeSkewSpectrum(B) {
    const n = B.length;
    if (n === 0) return [];
    if (n === 1) return [0];
    
    // Compute B^T B (= -B² for skew-symmetric B since B^T = -B)
    // B^T B has eigenvalues σ² where ±iσ are eigenvalues of B
    const BtB = Array(n).fill(null).map(() => Array(n).fill(0));
    for (let i = 0; i < n; i++) {
        for (let j = 0; j < n; j++) {
            let sum = 0;
            for (let k = 0; k < n; k++) {
                sum += B[k][i] * B[k][j];  // B^T[i][k] * B[k][j]
            }
            BtB[i][j] = sum;
        }
    }
    
    // Compute eigenvalues of B^T B (symmetric positive semi-definite)
    const eigsSquared = computeSymmetricEigenvalues(BtB);
    
    // Take sqrt to get |Im(λ)|
    const spectrum = [];
    for (const sigma2 of eigsSquared) {
        const sigma = Math.sqrt(Math.max(0, sigma2));
        spectrum.push(sigma);
    }
    
    return spectrum.sort((a, b) => b - a);
}

// ============================================================================
// GRAPH INVARIANTS AND DETECTION (Simplified standalone version)
// ============================================================================

function computeInvariants(adj) {
    const n = adj.length;
    
    // Build symmetric version
    const symAdj = Array(n).fill(null).map(() => Array(n).fill(0));
    for (let i = 0; i < n; i++) {
        for (let j = 0; j < n; j++) {
            if (adj[i][j] !== 0 || adj[j][i] !== 0) {
                symAdj[i][j] = 1;
            }
        }
    }
    
    // Compute degrees
    const degrees = [];
    let totalEdges = 0;
    for (let i = 0; i < n; i++) {
        let deg = 0;
        for (let j = 0; j < n; j++) {
            if (symAdj[i][j] === 1) {
                deg++;
                if (j > i) totalEdges++;
            }
        }
        degrees.push(deg);
    }
    
    const minDeg = Math.min(...degrees);
    const maxDeg = Math.max(...degrees);
    const isRegular = minDeg === maxDeg;
    
    // Degree counts
    const degreeCount = {};
    degrees.forEach(d => {
        degreeCount[d] = (degreeCount[d] || 0) + 1;
    });
    
    // Connectivity
    const visited = new Set([0]);
    const queue = [0];
    while (queue.length > 0) {
        const v = queue.shift();
        for (let u = 0; u < n; u++) {
            if (symAdj[v][u] === 1 && !visited.has(u)) {
                visited.add(u);
                queue.push(u);
            }
        }
    }
    const isConnected = visited.size === n;
    
    // Bipartiteness
    const color = new Array(n).fill(-1);
    let isBipartite = true;
    color[0] = 0;
    const bfsQueue = [0];
    const partA = [], partB = [];
    
    while (bfsQueue.length > 0 && isBipartite) {
        const v = bfsQueue.shift();
        (color[v] === 0 ? partA : partB).push(v);
        for (let u = 0; u < n; u++) {
            if (symAdj[v][u] === 1) {
                if (color[u] === -1) {
                    color[u] = 1 - color[v];
                    bfsQueue.push(u);
                } else if (color[u] === color[v]) {
                    isBipartite = false;
                }
            }
        }
    }
    
    const isTree = isConnected && totalEdges === n - 1;
    
    return {
        n,
        edges: totalEdges,
        degrees,
        minDeg,
        maxDeg,
        degreeCount,
        isRegular,
        isConnected,
        isBipartite,
        partA,
        partB,
        isTree,
        adj: symAdj,
        directedAdj: adj
    };
}

// ============================================================================
// ANALYTIC EIGENVALUE FORMULAS
// These return |Im(λ)| values (the spectrum from -A² eigenvalues)
// For an n-vertex graph, we get n values (the √ of -A² eigenvalues)
// ============================================================================

/**
 * Path Pn: For skew-symmetric tridiagonal with ±1 off-diagonal
 * Eigenvalues are ±i * 2cos(kπ/(n+1)), k = 1,...,floor(n/2)
 * Plus 0 for odd n
 * So |Im(λ)| = 2cos(kπ/(n+1)) (each appears twice for ±)
 */
function analyticPath(n) {
    const eigs = [];
    for (let k = 1; k <= Math.floor(n / 2); k++) {
        const val = 2 * Math.cos(k * Math.PI / (n + 1));
        eigs.push(val);
        eigs.push(val);  // ±i pair both give same |Im|
    }
    if (n % 2 === 1) eigs.push(0);  // Zero eigenvalue for odd n
    return eigs.sort((a, b) => b - a);
}

/**
 * Cycle Cn: For consistently oriented cycle
 * Eigenvalues are 2i * sin(2kπ/n), k = 0,...,n-1
 * So |Im(λ)| = 2|sin(2kπ/n)|
 */
function analyticCycle(n) {
    const eigs = [];
    for (let k = 0; k < n; k++) {
        eigs.push(2 * Math.abs(Math.sin(2 * k * Math.PI / n)));
    }
    return eigs.sort((a, b) => b - a);
}

/**
 * Star Sn: Center connected to n-1 leaves
 * Eigenvalues: ±i√(n-1), and 0 with multiplicity n-2
 * So |Im(λ)|: √(n-1) (twice), 0 (n-2 times)
 */
function analyticStar(n) {
    const sqrtN1 = Math.sqrt(n - 1);
    const eigs = [sqrtN1, sqrtN1];  // +i√(n-1) and -i√(n-1) both give √(n-1)
    for (let i = 0; i < n - 2; i++) eigs.push(0);
    return eigs.sort((a, b) => b - a);
}

/**
 * Complete Kn: Tournament orientation
 * Eigenvalues: ±i * cot((2k-1)π/(2n)), k = 1,...,floor(n/2)
 * For odd n, also 0
 */
function analyticComplete(n) {
    const eigs = [];
    for (let k = 1; k <= Math.floor(n / 2); k++) {
        const val = Math.abs(1 / Math.tan((2 * k - 1) * Math.PI / (2 * n)));
        eigs.push(val);
        eigs.push(val);  // ±i pair both give same |Im|
    }
    if (n % 2 === 1) eigs.push(0);
    return eigs.sort((a, b) => b - a);
}

/**
 * Complete Bipartite Km,k: All edges from A to B
 * Eigenvalues: ±i√(mk), and 0 with multiplicity m+k-2
 */
function analyticCompleteBipartite(m, k) {
    const n = m + k;
    const sqrtMK = Math.sqrt(m * k);
    const eigs = [sqrtMK, sqrtMK];  // ±i√(mk) both give √(mk)
    for (let i = 0; i < n - 2; i++) eigs.push(0);
    return eigs.sort((a, b) => b - a);
}

/**
 * Grid m×k = Pm × Pk (Cartesian product)
 * Symmetric eigenvalues: 2cos(iπ/(m+1)) + 2cos(jπ/(k+1))
 * But for skew-symmetric... this is more complex
 * For grids, the skew-symmetric spectrum depends on orientation
 * With "row-major" orientation, we need different formula
 */
function analyticGrid(m, k) {
    // For grids, the skew-symmetric structure is complex
    // Use numerical fallback for now
    return null;
}

/**
 * Ladder Ln = 2×n grid
 * Same complexity as general grid
 */
function analyticLadder(n) {
    return null;  // Complex orientation-dependent
}

/**
 * Hypercube Qd: d-dimensional hypercube
 * Symmetric eigenvalues: d - 2k with multiplicity C(d,k)
 * Skew-symmetric eigenvalues depend on orientation
 */
function analyticHypercube(d) {
    return null;  // Orientation-dependent
}

/**
 * Cuboid = Pa × Pb × Pc
 * Same as grid - orientation dependent
 */
function analyticCuboid(a, b, c) {
    return null;  // Orientation-dependent
}

function binomial(n, k) {
    if (k < 0 || k > n) return 0;
    if (k === 0 || k === n) return 1;
    let result = 1;
    for (let i = 0; i < k; i++) {
        result = result * (n - i) / (i + 1);
    }
    return Math.round(result);
}

/**
 * Wheel Wn: Center + (n-1) cycle
 * Complex eigenvalue structure - use numerical
 */
function analyticWheel(n) {
    return null;
}

/**
 * S'p Tree (Star-Path): depth 2 tree with p branches, one extended
 * The eigenvalue formula needs careful derivation from characteristic polynomial
 * For now, mark as needing verification
 */
function analyticStarPath(p) {
    return null;  // Formula needs verification
}

/**
 * S²p Tree (Double Star): two centers connected, each with branches
 * The eigenvalue formula needs careful derivation
 */
function analyticDoubleStar(p) {
    return null;  // Formula needs verification
}

// ============================================================================
// TEST EXECUTION
// ============================================================================

function compareEigenvalues(numerical, analytic, tolerance = 1e-4) {
    if (!analytic) return { match: false, reason: 'No analytic formula' };
    if (numerical.length !== analytic.length) {
        return { match: false, reason: `Length mismatch: ${numerical.length} vs ${analytic.length}` };
    }
    
    const sortedNum = [...numerical].sort((a, b) => b - a);
    const sortedAna = [...analytic].sort((a, b) => b - a);
    
    let maxDiff = 0;
    let maxDiffIdx = -1;
    
    for (let i = 0; i < sortedNum.length; i++) {
        const diff = Math.abs(sortedNum[i] - sortedAna[i]);
        if (diff > maxDiff) {
            maxDiff = diff;
            maxDiffIdx = i;
        }
    }
    
    if (maxDiff <= tolerance) {
        return { match: true, maxDiff };
    } else {
        return {
            match: false,
            reason: `Max diff ${maxDiff.toFixed(6)} at index ${maxDiffIdx}: num=${sortedNum[maxDiffIdx].toFixed(4)} vs ana=${sortedAna[maxDiffIdx].toFixed(4)}`
        };
    }
}

function runTest(name, adj, analyticFn, params = null) {
    const n = adj.length;
    const numerical = computeSkewSpectrum(adj);
    const analytic = analyticFn ? (params ? analyticFn(...params) : analyticFn(n)) : null;
    const inv = computeInvariants(adj);
    
    const result = compareEigenvalues(numerical, analytic);
    
    const status = result.match ? '✓' : '✗';
    const details = result.match ? `max diff: ${result.maxDiff?.toExponential(2) || 'N/A'}` : result.reason;
    
    console.log(`${status} ${name.padEnd(40)} n=${String(n).padStart(3)}  ${details}`);
    
    return result.match;
}

function runAllTests() {
    console.log('='.repeat(80));
    console.log('GRAPH FAMILY EIGENVALUE VERIFICATION TEST SUITE');
    console.log('='.repeat(80));
    console.log('');
    
    let passed = 0;
    let failed = 0;
    let skipped = 0;
    
    // Test paths
    console.log('--- PATHS ---');
    for (const n of [5, 10, 15, 20, 25]) {
        if (runTest(`Path P${n}`, generatePath(n), analyticPath)) passed++; else failed++;
    }
    
    // Test cycles
    console.log('\n--- CYCLES (consistent orientation) ---');
    for (const n of [5, 10, 15, 20, 25]) {
        if (runTest(`Cycle C${n}`, generateCycle(n), analyticCycle)) passed++; else failed++;
    }
    
    // Test stars
    console.log('\n--- STARS ---');
    for (const n of [5, 10, 15, 20, 25]) {
        if (runTest(`Star S${n}`, generateStar(n), analyticStar)) passed++; else failed++;
    }
    
    // Test complete graphs
    console.log('\n--- COMPLETE GRAPHS ---');
    for (const n of [5, 8, 10, 12, 15]) {
        if (runTest(`Complete K${n}`, generateComplete(n), analyticComplete)) passed++; else failed++;
    }
    
    // Test complete bipartite
    console.log('\n--- COMPLETE BIPARTITE ---');
    for (const [m, k] of [[3, 3], [4, 5], [5, 6], [6, 7], [8, 10]]) {
        if (runTest(`Complete Bipartite K${m},${k}`, generateCompleteBipartite(m, k), analyticCompleteBipartite, [m, k])) passed++; else failed++;
    }
    
    // Test grids
    console.log('\n--- GRIDS ---');
    for (const [m, k] of [[3, 4], [4, 5], [5, 5], [4, 6], [5, 6]]) {
        if (runTest(`Grid ${m}×${k}`, generateGrid(m, k), analyticGrid, [m, k])) passed++; else failed++;
    }
    
    // Test ladders
    console.log('\n--- LADDERS ---');
    for (const n of [5, 8, 10, 12, 15]) {
        if (runTest(`Ladder L${n}`, generateLadder(n), analyticLadder, [n])) passed++; else failed++;
    }
    
    // Test hypercubes
    console.log('\n--- HYPERCUBES ---');
    for (const d of [2, 3, 4, 5]) {
        const n = Math.pow(2, d);
        if (runTest(`Hypercube Q${d} (n=${n})`, generateHypercube(d), analyticHypercube, [d])) passed++; else failed++;
    }
    
    // Test cuboids
    console.log('\n--- CUBOIDS ---');
    for (const [a, b, c] of [[2, 2, 3], [2, 3, 3], [2, 3, 4], [3, 3, 3], [2, 2, 5]]) {
        const n = a * b * c;
        if (runTest(`Cuboid ${a}×${b}×${c} (n=${n})`, generateCuboid(a, b, c), analyticCuboid, [a, b, c])) passed++; else failed++;
    }
    
    // Test wheels (no simple formula)
    console.log('\n--- WHEELS (numerical only) ---');
    for (const n of [5, 8, 10, 12]) {
        runTest(`Wheel W${n}`, generateWheel(n), null);
        skipped++;
    }
    
    // Test prisms (no simple formula implemented)
    console.log('\n--- PRISMS (numerical only) ---');
    for (const n of [4, 5, 6, 8]) {
        runTest(`Prism Y${n}`, generatePrism(n), null);
        skipped++;
    }
    
    // Test special graphs
    console.log('\n--- SPECIAL GRAPHS ---');
    runTest('Petersen Graph', generatePetersen(), null);
    skipped++;
    
    // Test S'p trees (Star-Path, depth 2)
    console.log('\n--- S\'p TREES (depth 2) ---');
    for (const p of [3, 4, 5, 6, 8]) {
        if (runTest(`S'${p} Tree (n=${p+2})`, generateStarPath(p), analyticStarPath, [p])) passed++; else failed++;
    }
    
    // Test S²p trees (Double Star, depth 3)  
    console.log('\n--- S²p TREES (double star) ---');
    for (const p of [4, 6, 8, 10]) {
        if (runTest(`S²${p} Tree (n=${p+2})`, generateDoubleStar(p), analyticDoubleStar, [p])) passed++; else failed++;
    }
    
    // Test Binary Trees
    console.log('\n--- BINARY TREES ---');
    for (const d of [2, 3, 4]) {
        const n = Math.pow(2, d + 1) - 1;
        if (runTest(`Binary Tree depth ${d} (n=${n})`, generateBinaryTree(d), null)) skipped++; else skipped++;
    }
    
    // Summary
    console.log('\n' + '='.repeat(80));
    console.log('SUMMARY');
    console.log('='.repeat(80));
    console.log(`Passed:  ${passed}`);
    console.log(`Failed:  ${failed}`);
    console.log(`Skipped: ${skipped} (no analytic formula implemented)`);
    console.log(`Total:   ${passed + failed + skipped}`);
    
    if (failed > 0) {
        console.log('\n⚠️  SOME TESTS FAILED - Review formulas!');
        process.exit(1);
    } else {
        console.log('\n✓ All tests with analytic formulas passed!');
    }
}

// Run tests
runAllTests();
