/**
 * Physics Engine Module: Realizability, Rectification, and Energy Conservation
 * ==============================================================================
 * 
 * This module implements a port-Hamiltonian formalism for graph-theoretic analysis.
 * It provides tools to verify whether a graph represents a physically realizable
 * mechanical network and rectify it if not.
 * 
 * MATHEMATICAL FOUNDATION:
 * ------------------------
 * For a system with N absolute states (node momenta) and M relative states (edge elongations):
 *   - The augmented adjacency matrix A has block structure:
 *     A = [  0    B  ]  ∈ ℝ⁽ᴺ⁺ᴹ⁾ˣ⁽ᴺ⁺ᴹ⁾
 *         [ -Bᵀ   0  ]
 *   
 *   - B ∈ ℝᴺˣᴹ is the Node-Edge Incidence Matrix
 *   - N = number of absolute states (masses/nodes)
 *   - M = number of relative states (springs/edges)
 * 
 * PHYSICAL REALIZABILITY:
 * -----------------------
 * Newton's 3rd Law: For each edge (column in B), forces on connected nodes must 
 * be equal and opposite.
 * 
 * In the B-matrix, each column must have:
 *   - Exactly 2 non-zero entries
 *   - Column sum = 0 (one +1 and one -1)
 * 
 * TWO MODES OF OPERATION:
 * -----------------------
 * 1. PRE-AUGMENTED MODE (nNodes specified):
 *    - Matrix is already in (N+M)×(N+M) block form
 *    - B-block is extracted and audited directly
 *    - Use for: Bipartite graphs, pre-constructed systems
 * 
 * 2. STANDARD GRAPH MODE (nNodes = null):
 *    - Matrix is standard n×n adjacency matrix
 *    - Augmented matrix is CONSTRUCTED from edges
 *    - B is built correctly, so audit always passes
 *    - Use for: Regular graphs (cycles, complete, etc.)
 * 
 * VERSION: 3.0.0 - Dual mode with explicit N parameter
 * AUTHOR: Zeid-Rosenberg Eigenvalue Explorer
 */

import { state } from './graph-core.js';

// =====================================================
// SYSTEM PARTITION CLASS (Core B-matrix extraction)
// =====================================================

/**
 * SystemPartition: Extracts B matrix from pre-augmented adjacency matrix
 * 
 * Use this when you ALREADY have an (N+M)×(N+M) matrix in block form.
 * You must specify N (number of absolute states) explicitly.
 */
export class SystemPartition {
    constructor(adjacencyMatrix, nNodes) {
        this.A = adjacencyMatrix;
        this.N = nNodes;  // Number of Absolute States (Nodes)
        this.M = adjacencyMatrix.length - nNodes;  // Number of Relative States (Edges)
        
        // Extract B immediately
        this.B = this.extractB();
    }
    
    /**
     * Extracts the B matrix (Top-Right Block)
     * Location: Rows 0 to N-1, Columns N to N+M-1
     */
    extractB() {
        const B = [];
        for (let i = 0; i < this.N; i++) {
            const row = [];
            for (let j = this.N; j < this.A.length; j++) {
                row.push(this.A[i][j]);
            }
            B.push(row);
        }
        return B;
    }
    
    /**
     * Audit for Physical Realizability
     * Returns true if B is a valid Node-Edge Incidence Matrix
     * 
     * Each column must have:
     *   - Exactly 2 non-zero entries
     *   - Column sum = 0
     */
    isRealizable() {
        for (let col = 0; col < this.M; col++) {
            let colSum = 0;
            let nonZeroCount = 0;
            for (let row = 0; row < this.N; row++) {
                if (this.B[row][col] !== 0) {
                    colSum += this.B[row][col];
                    nonZeroCount++;
                }
            }
            // Realizability Rule: Col sum must be 0 and have exactly 2 entries
            if (colSum !== 0 || nonZeroCount !== 2) return false;
        }
        return true;
    }
    
    /**
     * The Hamiltonian (Total Energy)
     * H = 0.5 * ( ||p||² + ||q||² )
     */
    calculateHamiltonian(stateVector) {
        // stateVector is [p1...pN, q1...qM]
        const sumSq = stateVector.reduce((acc, val) => acc + (val * val), 0);
        return 0.5 * sumSq;
    }
}

// =====================================================
// PHYSICS ENGINE CLASS (Full featured)
// =====================================================

/**
 * PhysicsEngine: Core class for linear system realizability analysis
 * 
 * Checks whether a skew-symmetric matrix represents a physically realizable
 * linear system (port-Hamiltonian form with valid incidence matrix B).
 * 
 * @param {number[][]} adjacencyMatrix - Input skew-symmetric adjacency matrix
 * @param {number|null} nNodes - Number of absolute states (N)
 * @param {number[]|null} pIndices - Custom indices for p (momentum) states
 * @param {number[]|null} qIndices - Custom indices for q (displacement) states
 */
export class PhysicsEngine {
    constructor(adjacencyMatrix = null, nNodes = null, pIndices = null, qIndices = null) {
        // Use provided matrix or get from graph state
        this.sourceMatrix = adjacencyMatrix || state.adjacencyMatrix;
        
        // Deep copy the matrix so we can modify it during rectification
        this.fullMatrix = this.sourceMatrix.map(row => row ? [...row] : []);
        
        const matrixSize = this.sourceMatrix.length;
        
        // Check for custom partition mode
        const hasCustomPartition = pIndices !== null && qIndices !== null && 
                                   pIndices.length > 0 && qIndices.length > 0;
        
        if (hasCustomPartition) {
            // CUSTOM PARTITION MODE: User specifies which indices are p vs q
            this.pIndices = [...pIndices].sort((a, b) => a - b);
            this.qIndices = [...qIndices].sort((a, b) => a - b);
            this.N = this.pIndices.length;
            this.M = this.qIndices.length;
            this.B = this._extractBBlockCustom();
            this.mode = 'custom partition';
        } else {
            // SEQUENTIAL PARTITION MODE: First N indices are p, rest are q
            this.N = nNodes !== null ? nNodes : Math.floor(matrixSize / 2);
            this.M = matrixSize - this.N;
            this.pIndices = Array.from({ length: this.N }, (_, i) => i);
            this.qIndices = Array.from({ length: this.M }, (_, i) => this.N + i);
            this.B = this._extractBBlock();
            this.mode = 'sequential';
        }
        
        // State vector for dynamics (default: unit excitation)
        this.stateVector = new Array(this.N + this.M).fill(1.0);
        
        // Column analysis cache
        this.columnAnalysis = null;
    }
    
    // =====================================================
    // STATIC: AUTOMATIC PARTITION DISCOVERY
    // =====================================================
    
    /**
     * Discover if a valid bipartite partition exists for the graph.
     * A graph is realizable as a port-Hamiltonian system if and only if
     * it is bipartite (can be 2-colored so every edge connects different colors).
     * 
     * Uses BFS to attempt 2-coloring of the graph.
     * 
     * @param {number[][]} adjacencyMatrix - The skew-symmetric adjacency matrix
     * @returns {Object} Result with:
     *   - isBipartite: boolean
     *   - pIndices: array of p-node indices (if bipartite)
     *   - qIndices: array of q-node indices (if bipartite)
     *   - reason: string explaining the result
     */
    static discoverBipartitePartition(adjacencyMatrix) {
        const n = adjacencyMatrix.length;
        if (n === 0) {
            return { isBipartite: false, pIndices: [], qIndices: [], reason: 'Empty graph' };
        }
        
        // Build undirected adjacency list from skew-symmetric matrix
        // An edge exists if A[i][j] != 0 (either +1 or -1)
        const adjList = [];
        for (let i = 0; i < n; i++) {
            adjList[i] = [];
            for (let j = 0; j < n; j++) {
                if (adjacencyMatrix[i] && adjacencyMatrix[i][j] !== 0) {
                    adjList[i].push(j);
                }
            }
        }
        
        // Color array: -1 = unvisited, 0 = p-set, 1 = q-set
        const color = new Array(n).fill(-1);
        const pIndices = [];
        const qIndices = [];
        
        // BFS for each connected component
        for (let start = 0; start < n; start++) {
            if (color[start] !== -1) continue; // Already visited
            
            // BFS from this node
            const queue = [start];
            color[start] = 0; // Start with p-set
            
            while (queue.length > 0) {
                const node = queue.shift();
                const nodeColor = color[node];
                const neighborColor = 1 - nodeColor; // Opposite color
                
                for (const neighbor of adjList[node]) {
                    if (color[neighbor] === -1) {
                        // Unvisited - assign opposite color
                        color[neighbor] = neighborColor;
                        queue.push(neighbor);
                    } else if (color[neighbor] === nodeColor) {
                        // Same color as current node - NOT BIPARTITE
                        // Found an odd cycle
                        return {
                            isBipartite: false,
                            pIndices: [],
                            qIndices: [],
                            reason: `Odd cycle detected: nodes ${node} and ${neighbor} conflict`,
                            conflictEdge: [node, neighbor]
                        };
                    }
                    // else: neighbor already has correct opposite color, continue
                }
            }
        }
        
        // Successfully 2-colored - build partition sets
        for (let i = 0; i < n; i++) {
            if (color[i] === 0) {
                pIndices.push(i);
            } else {
                qIndices.push(i);
            }
        }
        
        // Ensure p is the smaller or equal set (convention)
        if (pIndices.length > qIndices.length) {
            return {
                isBipartite: true,
                pIndices: qIndices,
                qIndices: pIndices,
                reason: `Bipartite graph: ${qIndices.length} p-nodes, ${pIndices.length} q-nodes`
            };
        }
        
        return {
            isBipartite: true,
            pIndices: pIndices,
            qIndices: qIndices,
            reason: `Bipartite graph: ${pIndices.length} p-nodes, ${qIndices.length} q-nodes`
        };
    }
    
    /**
     * Check if a graph (given by adjacency matrix) is connected.
     * Uses BFS to count reachable nodes from node 0.
     * 
     * @param {number[][]} adjacencyMatrix - The adjacency matrix
     * @returns {Object} { isConnected: boolean, componentCount: number, components: number[][] }
     */
    static checkConnectivity(adjacencyMatrix) {
        const n = adjacencyMatrix.length;
        if (n === 0) {
            return { isConnected: true, componentCount: 0, components: [] };
        }
        if (n === 1) {
            return { isConnected: true, componentCount: 1, components: [[0]] };
        }
        
        // Build undirected adjacency list
        const adjList = [];
        for (let i = 0; i < n; i++) {
            adjList[i] = [];
            for (let j = 0; j < n; j++) {
                if (adjacencyMatrix[i] && adjacencyMatrix[i][j] !== 0) {
                    adjList[i].push(j);
                }
            }
        }
        
        const visited = new Array(n).fill(false);
        const components = [];
        
        // BFS for each unvisited node
        for (let start = 0; start < n; start++) {
            if (visited[start]) continue;
            
            const component = [];
            const queue = [start];
            visited[start] = true;
            
            while (queue.length > 0) {
                const node = queue.shift();
                component.push(node);
                
                for (const neighbor of adjList[node]) {
                    if (!visited[neighbor]) {
                        visited[neighbor] = true;
                        queue.push(neighbor);
                    }
                }
            }
            
            components.push(component);
        }
        
        return {
            isConnected: components.length === 1,
            componentCount: components.length,
            components: components
        };
    }
    
    /**
     * Create a PhysicsEngine with automatically discovered optimal partition.
     * If the graph is bipartite, tries both partition orientations to find
     * one that is physically realizable.
     * If not bipartite, falls back to sequential partition.
     * 
     * @param {number[][]} adjacencyMatrix - The skew-symmetric adjacency matrix
     * @returns {Object} { engine: PhysicsEngine, discovery: discoveryResult }
     */
    static createWithOptimalPartition(adjacencyMatrix) {
        const discovery = PhysicsEngine.discoverBipartitePartition(adjacencyMatrix);
        
        if (discovery.isBipartite && discovery.pIndices.length > 0 && discovery.qIndices.length > 0) {
            // Try the discovered partition first
            const engine1 = new PhysicsEngine(
                adjacencyMatrix, 
                null, 
                discovery.pIndices, 
                discovery.qIndices
            );
            const audit1 = engine1.audit();
            
            if (audit1.isPhysical) {
                engine1.mode = 'auto-bipartite';
                return { engine: engine1, discovery };
            }
            
            // Try swapped partition (p↔q)
            const engine2 = new PhysicsEngine(
                adjacencyMatrix, 
                null, 
                discovery.qIndices,  // swap
                discovery.pIndices   // swap
            );
            const audit2 = engine2.audit();
            
            if (audit2.isPhysical) {
                engine2.mode = 'auto-bipartite (swapped)';
                // Update discovery to reflect the swap
                const swappedDiscovery = {
                    ...discovery,
                    pIndices: discovery.qIndices,
                    qIndices: discovery.pIndices,
                    reason: discovery.reason + ' (swapped for realizability)'
                };
                return { engine: engine2, discovery: swappedDiscovery };
            }
            
            // Neither worked - return the one with fewer violations
            const v1 = audit1.violations.length;
            const v2 = audit2.violations.length;
            
            if (v2 < v1) {
                engine2.mode = 'auto-bipartite (swapped, not realizable)';
                const swappedDiscovery = {
                    ...discovery,
                    pIndices: discovery.qIndices,
                    qIndices: discovery.pIndices
                };
                return { engine: engine2, discovery: swappedDiscovery };
            }
            
            engine1.mode = 'auto-bipartite (not realizable)';
            return { engine: engine1, discovery };
        } else {
            // Fall back to sequential partition
            const engine = new PhysicsEngine(adjacencyMatrix, Math.floor(adjacencyMatrix.length / 2));
            engine.mode = 'sequential (graph not bipartite)';
            return { engine, discovery };
        }
    }
    
    /**
     * Extract the B-block from matrix (sequential partition)
     * B = fullMatrix[0:N, N:N+M]
     */
    _extractBBlock() {
        const B = [];
        for (let i = 0; i < this.N; i++) {
            const row = [];
            for (let j = this.N; j < this.N + this.M; j++) {
                row.push(this.fullMatrix[i][j]);
            }
            B.push(row);
        }
        return B;
    }
    
    /**
     * Extract the B-block using custom partition indices
     * B[i][j] = fullMatrix[pIndices[i]][qIndices[j]]
     */
    _extractBBlockCustom() {
        const B = [];
        for (let i = 0; i < this.pIndices.length; i++) {
            const row = [];
            for (let j = 0; j < this.qIndices.length; j++) {
                row.push(this.fullMatrix[this.pIndices[i]][this.qIndices[j]]);
            }
            B.push(row);
        }
        return B;
    }
    
    /**
     * Get the B-block matrix
     */
    getBMatrix() {
        return this.B;
    }
    
    /**
     * Format the full system matrix A for display with block structure
     * Shows the augmented matrix with clear separation between blocks:
     * 
     *   A = [  0    B  ]
     *       [ -Bᵀ   0  ]
     * 
     * This visualization explains realizability - each column of B
     * must have exactly one +1 and one -1 (Newton's 3rd Law)
     */
    formatBMatrix() {
        return this.formatSystemMatrixDisplay();
    }
    
    /**
     * Format the full augmented system matrix with block separators
     */
    formatSystemMatrixDisplay() {
        const dim = this.N + this.M;
        const J = this.getSystemMatrix();
        
        let text = `System Matrix A (${dim}×${dim}):\n`;
        text += `Structure: A = [ 0  B ; -Bᵀ 0 ]\n`;
        text += `N = ${this.N} (p states), M = ${this.M} (q states)\n`;
        text += `p indices: {${this.pIndices.join(', ')}}\n`;
        text += `q indices: {${this.qIndices.join(', ')}}\n\n`;
        
        // Calculate column width
        const colWidth = 4;
        
        // Header row with state labels
        text += '     ';
        for (let j = 0; j < this.N; j++) {
            text += `p${j}`.padStart(colWidth);
        }
        text += ' │';
        for (let j = 0; j < this.M; j++) {
            text += `q${j}`.padStart(colWidth);
        }
        text += '\n';
        
        // Separator line under header
        text += '    ';
        text += '─'.repeat(this.N * colWidth);
        text += '─┼';
        text += '─'.repeat(this.M * colWidth);
        text += '\n';
        
        // Matrix rows
        for (let i = 0; i < dim; i++) {
            // Row label
            if (i < this.N) {
                text += `p${i}`.padStart(3) + ' │';
            } else {
                text += `q${i - this.N}`.padStart(3) + ' │';
            }
            
            // Values for p columns (left block)
            for (let j = 0; j < this.N; j++) {
                const val = J[i][j];
                text += this._formatMatrixValue(val, colWidth);
            }
            
            // Vertical separator
            text += ' │';
            
            // Values for q columns (right block)
            for (let j = this.N; j < dim; j++) {
                const val = J[i][j];
                text += this._formatMatrixValue(val, colWidth);
            }
            
            // Show connection count for p-rows
            if (i < this.N) {
                const connCount = this._countNodeConnections(i);
                text += `  (${connCount} conn)`;
            }
            
            text += '\n';
            
            // Horizontal separator between p and q rows
            if (i === this.N - 1) {
                text += '    ';
                text += '─'.repeat(this.N * colWidth);
                text += '─┼';
                text += '─'.repeat(this.M * colWidth);
                text += '\n';
            }
        }
        
        // Block explanation
        text += '\nBlocks:\n';
        text += '  Top-right (B):    Each column needs exactly one +1 and one -1\n';
        text += '  Bottom-left (-Bᵀ): Transpose ensures skew-symmetry\n';
        
        return text;
    }
    
    /**
     * Format a single matrix value for display
     * @private
     */
    _formatMatrixValue(val, width = 4) {
        if (val === 0) {
            return '0'.padStart(width);
        } else if (val === 1) {
            return '+1'.padStart(width);
        } else if (val === -1) {
            return '-1'.padStart(width);
        } else if (Number.isInteger(val)) {
            return val.toString().padStart(width);
        } else {
            return val.toFixed(1).padStart(width);
        }
    }
    
    /**
     * Format just the B-block (incidence matrix) for compact display
     */
    formatBBlockOnly() {
        let text = `B-Block (${this.N}×${this.M}):\n`;
        text += 'Valid columns: 2 non-zeros summing to 0, OR 1 non-zero (⏚ grounded)\n\n';
        
        // Analyze columns first to determine which are grounded
        const colAnalysis = this.analyzeColumns();
        
        // Header
        text += '    ';
        for (let j = 0; j < this.M; j++) {
            text += `q${j}`.padStart(4);
        }
        text += '   Σ\n';
        text += '   ' + '─'.repeat(this.M * 4 + 5) + '\n';
        
        // Rows
        for (let i = 0; i < this.N; i++) {
            text += `p${i}`.padStart(3) + ' │';
            for (let j = 0; j < this.M; j++) {
                text += this._formatMatrixValue(this.B[i][j], 4);
            }
            text += '\n';
        }
        
        // Column sums with grounded indicator
        text += '   ' + '─'.repeat(this.M * 4 + 5) + '\n';
        text += ' Σ  │';
        for (let j = 0; j < this.M; j++) {
            let sum = 0;
            let nonZero = 0;
            for (let i = 0; i < this.N; i++) {
                if (this.B[i][j] !== 0) {
                    sum += this.B[i][j];
                    nonZero++;
                }
            }
            // Show status: ✓0 for standard spring, ⏚ for grounded, value for invalid
            let sumStr;
            if (sum === 0 && nonZero === 2) {
                sumStr = '✓0';  // Valid standard spring
            } else if (Math.abs(sum) === 1 && nonZero === 1) {
                sumStr = '⏚' + (sum > 0 ? '+' : '-');  // Valid grounded spring
            } else if (nonZero === 0) {
                sumStr = '∅';   // Disconnected
            } else {
                sumStr = sum.toString();  // Invalid
            }
            text += sumStr.padStart(4);
        }
        text += '\n';
        
        // Summary
        const grounded = colAnalysis.filter(c => c.isGrounded).length;
        const standard = colAnalysis.filter(c => c.isValid && !c.isGrounded).length;
        const invalid = colAnalysis.filter(c => !c.isValid).length;
        
        if (grounded > 0) {
            text += `\n⏚ = grounded to reference (${grounded} spring${grounded > 1 ? 's' : ''})\n`;
        }
        if (standard > 0) {
            text += `✓ = mass-to-mass spring (${standard} spring${standard > 1 ? 's' : ''})\n`;
        }
        if (invalid > 0) {
            text += `✗ = invalid (${invalid} column${invalid > 1 ? 's' : ''})\n`;
        }
        
        return text;
    }
    
    // =====================================================
    // 1. AUDIT: CHECK PHYSICAL REALIZABILITY
    // =====================================================
    
    /**
     * Analyze each column of the B-matrix
     * Returns detailed per-column breakdown
     * 
     * Valid configurations:
     * - 2 non-zeros summing to 0: Spring between two masses (+1, -1)
     * - 1 non-zero (±1): Spring connected to ground (grounded spring)
     * - 0 non-zeros: Disconnected (invalid)
     * - >2 non-zeros: Hyperedge (invalid for simple spring)
     */
    analyzeColumns() {
        const analysis = [];
        
        for (let col = 0; col < this.M; col++) {
            let sum = 0;
            let positiveCount = 0;
            let negativeCount = 0;
            let nonZeroCount = 0;
            const participants = [];
            
            for (let row = 0; row < this.N; row++) {
                const val = this.B[row][col];
                if (val !== 0) {
                    sum += val;
                    nonZeroCount++;
                    // Store actual pIndex if custom partition
                    const actualNodeIndex = this.pIndices ? this.pIndices[row] : row;
                    participants.push({ node: actualNodeIndex, localRow: row, value: val });
                    
                    if (val > 0) positiveCount++;
                    if (val < 0) negativeCount++;
                }
            }
            
            // Realizability Rules:
            // 1. Standard spring: exactly 2 non-zeros, sum = 0 (one +1, one -1)
            // 2. Grounded spring: exactly 1 non-zero, |sum| = 1 (connected to ground)
            const isStandardSpring = (sum === 0) && (nonZeroCount === 2);
            const isGroundedSpring = (nonZeroCount === 1) && (Math.abs(sum) === 1);
            const isValid = isStandardSpring || isGroundedSpring;
            
            // Get actual column index from qIndices if custom partition
            const actualColIndex = this.qIndices ? this.qIndices[col] : (this.isPreAugmented ? this.N + col : col);
            
            analysis.push({
                columnIndex: col,
                globalIndex: actualColIndex,
                sum: sum,
                positiveCount: positiveCount,
                negativeCount: negativeCount,
                nonZeroCount: nonZeroCount,
                participants: participants,
                isValid: isValid,
                isGrounded: isGroundedSpring,
                violation: !isValid ? this._describeViolation(sum, positiveCount, negativeCount, nonZeroCount) : null
            });
        }
        
        this.columnAnalysis = analysis;
        return analysis;
    }
    
    /**
     * Describe the type of violation for a column
     */
    _describeViolation(sum, posCount, negCount, nonZeroCount) {
        if (nonZeroCount === 0) {
            return 'Disconnected: no connections to any mass';
        } else if (nonZeroCount === 1 && Math.abs(sum) !== 1) {
            return `Invalid grounded: single connection but sum=${sum} (need ±1)`;
        } else if (nonZeroCount > 2) {
            return `Hyperedge: ${nonZeroCount} connections (max 2 for spring)`;
        } else if (nonZeroCount === 2 && sum !== 0) {
            return `Newton violation: sum=${sum} ≠ 0 (need +1 and -1)`;
        }
        return 'Unknown violation';
    }
    
    /**
     * Debug method: Compare B-matrix with what should be extracted from fullMatrix
     * Useful for verifying rectification worked correctly
     */
    verifyBMatrixConsistency() {
        const issues = [];
        
        // Re-extract B from fullMatrix
        const freshB = [];
        for (let i = 0; i < this.N; i++) {
            const row = [];
            for (let j = 0; j < this.M; j++) {
                const fullRow = this.pIndices[i];
                const fullCol = this.qIndices[j];
                row.push(this.fullMatrix[fullRow][fullCol]);
            }
            freshB.push(row);
        }
        
        // Compare with stored B
        for (let i = 0; i < this.N; i++) {
            for (let j = 0; j < this.M; j++) {
                if (this.B[i][j] !== freshB[i][j]) {
                    issues.push({
                        row: i,
                        col: j,
                        storedValue: this.B[i][j],
                        extractedValue: freshB[i][j]
                    });
                }
            }
        }
        
        return {
            isConsistent: issues.length === 0,
            issues: issues,
            storedB: this.B,
            freshB: freshB
        };
    }
    
    /**
     * Quick realizability check
     * Valid configurations per column:
     * - Standard spring: 2 non-zeros, sum = 0
     * - Grounded spring: 1 non-zero, |sum| = 1
     */
    isRealizable() {
        for (let col = 0; col < this.M; col++) {
            let colSum = 0;
            let nonZeroCount = 0;
            for (let row = 0; row < this.N; row++) {
                if (this.B[row][col] !== 0) {
                    colSum += this.B[row][col];
                    nonZeroCount++;
                }
            }
            // Standard spring: sum=0, count=2
            const isStandardSpring = (colSum === 0 && nonZeroCount === 2);
            // Grounded spring: |sum|=1, count=1
            const isGroundedSpring = (Math.abs(colSum) === 1 && nonZeroCount === 1);
            
            if (!isStandardSpring && !isGroundedSpring) return false;
        }
        return true;
    }
    
    /**
     * Audit the system for physical realizability
     * 
     * @returns {Object} Detailed audit report
     */
    audit() {
        const columnAnalysis = this.analyzeColumns();
        
        const violations = [];
        const warnings = [];
        
        // === NEW CHECK: Diagonal Block Violations (p-p and q-q connections) ===
        // A port-Hamiltonian system requires A = [0, B; -Bᵀ, 0]
        // The diagonal blocks MUST be zero - no p-p or q-q connections allowed
        
        const ppViolations = [];
        const qqViolations = [];
        
        // Check p-p block (connections between p-nodes)
        for (let i = 0; i < this.N; i++) {
            for (let j = i + 1; j < this.N; j++) {
                const pi = this.pIndices[i];
                const pj = this.pIndices[j];
                const val = this.fullMatrix[pi] ? this.fullMatrix[pi][pj] : 0;
                if (val !== 0) {
                    ppViolations.push({
                        from: pi,
                        to: pj,
                        value: val
                    });
                }
            }
        }
        
        // Check q-q block (connections between q-nodes)
        for (let i = 0; i < this.M; i++) {
            for (let j = i + 1; j < this.M; j++) {
                const qi = this.qIndices[i];
                const qj = this.qIndices[j];
                const val = this.fullMatrix[qi] ? this.fullMatrix[qi][qj] : 0;
                if (val !== 0) {
                    qqViolations.push({
                        from: qi,
                        to: qj,
                        value: val
                    });
                }
            }
        }
        
        // Add violations for diagonal blocks
        if (ppViolations.length > 0) {
            const edgeList = ppViolations.slice(0, 3).map(v => `${v.from}↔${v.to}`).join(', ');
            const moreText = ppViolations.length > 3 ? ` (+${ppViolations.length - 3} more)` : '';
            violations.push({
                type: 'DIAGONAL_BLOCK_VIOLATION',
                blockType: 'p-p',
                count: ppViolations.length,
                edges: ppViolations,
                message: `${ppViolations.length} p-p edge(s): ${edgeList}${moreText} — momentum nodes cannot connect to each other`
            });
        }
        
        if (qqViolations.length > 0) {
            const edgeList = qqViolations.slice(0, 3).map(v => `${v.from}↔${v.to}`).join(', ');
            const moreText = qqViolations.length > 3 ? ` (+${qqViolations.length - 3} more)` : '';
            violations.push({
                type: 'DIAGONAL_BLOCK_VIOLATION',
                blockType: 'q-q',
                count: qqViolations.length,
                edges: qqViolations,
                message: `${qqViolations.length} q-q edge(s): ${edgeList}${moreText} — displacement nodes cannot connect to each other`
            });
        }
        
        // Check each column (Newton's 3rd Law)
        for (const col of columnAnalysis) {
            if (!col.isValid) {
                violations.push({
                    type: 'NEWTON_VIOLATION',
                    column: col.columnIndex,
                    globalIndex: col.globalIndex,
                    sum: col.sum,
                    participants: col.participants,
                    nonZeroCount: col.nonZeroCount,
                    message: `Col ${col.globalIndex}: ${col.violation}`
                });
            }
        }
        
        // Check skew-symmetry between B and -Bᵀ blocks (only for pre-augmented)
        if (this.isPreAugmented) {
            let maxSkewError = 0;
            for (let i = 0; i < this.N; i++) {
                for (let j = 0; j < this.M; j++) {
                    const topRight = this.fullMatrix[i][this.N + j];
                    const bottomLeft = this.fullMatrix[this.N + j][i];
                    const error = Math.abs(topRight + bottomLeft);
                    if (error > maxSkewError) {
                        maxSkewError = error;
                    }
                }
            }
            
            if (maxSkewError > 1e-10) {
                warnings.push({
                    type: 'SKEW_SYMMETRY_WARNING',
                    maxError: maxSkewError,
                    message: `B ≠ -Bᵀ: max error = ${maxSkewError.toFixed(4)}`
                });
            }
        }
        
        // Check connectivity of the full graph
        const connectivity = PhysicsEngine.checkConnectivity(this.fullMatrix);
        if (!connectivity.isConnected) {
            violations.push({
                type: 'CONNECTIVITY_VIOLATION',
                componentCount: connectivity.componentCount,
                components: connectivity.components,
                message: `Graph disconnected: ${connectivity.componentCount} components`
            });
        }
        
        // Determine status
        let statusColor;
        if (violations.length === 0 && warnings.length === 0) {
            statusColor = 'GREEN';
        } else if (violations.length === 0) {
            statusColor = 'YELLOW';
        } else {
            statusColor = 'ORANGE';
        }
        
        // Count spring types
        const groundedSprings = columnAnalysis.filter(c => c.isGrounded).length;
        const standardSprings = columnAnalysis.filter(c => c.isValid && !c.isGrounded).length;
        
        return {
            isPhysical: violations.length === 0,
            isStrictlyPhysical: violations.length === 0 && warnings.length === 0,
            isConnected: connectivity.isConnected,
            violations: violations,
            warnings: warnings,
            statusColor: statusColor,
            mode: this.mode,
            summary: {
                nodeCount: this.N,
                edgeCount: this.M,
                stateSpaceDim: this.N + this.M,
                violationCount: violations.length,
                warningCount: warnings.length,
                validColumns: columnAnalysis.filter(c => c.isValid).length,
                invalidColumns: columnAnalysis.filter(c => !c.isValid).length,
                standardSprings: standardSprings,
                groundedSprings: groundedSprings,
                componentCount: connectivity.componentCount,
                ppEdgeCount: ppViolations.length,
                qqEdgeCount: qqViolations.length,
                diagonalBlockViolations: ppViolations.length + qqViolations.length
            },
            columnAnalysis: columnAnalysis,
            diagonalBlockAnalysis: {
                ppEdges: ppViolations,
                qqEdges: qqViolations,
                hasDiagonalViolations: ppViolations.length > 0 || qqViolations.length > 0
            }
        };
    }
    
    // =====================================================
    // 2. RECTIFY: THE DIVERGENCE HEURISTIC
    // =====================================================
    
    /**
     * Calculate the "divergence" (flow imbalance) at a node
     * Divergence = sum of row in B-matrix
     * 
     * @param {number} nodeIdx - Index of the node (0 to N-1)
     * @returns {number} Nodal divergence
     */
    calculateNodalDivergence(nodeIdx) {
        if (nodeIdx < 0 || nodeIdx >= this.N) return 0;
        let divergence = 0;
        for (let j = 0; j < this.M; j++) {
            divergence += this.B[nodeIdx][j];
        }
        return divergence;
    }
    
    /**
     * Get divergence for all absolute state nodes
     * @returns {number[]} Array of nodal divergences
     */
    getAllDivergences() {
        const divergences = [];
        for (let i = 0; i < this.N; i++) {
            divergences.push(this.calculateNodalDivergence(i));
        }
        return divergences;
    }
    
    /**
     * Generalized Auto-Rectification Process
     * Converts a non-physical skew-symmetric matrix into a port-Hamiltonian system.
     * 
     * This algorithm:
     * 1. Enforces sparsity: Each edge connects exactly 2 nodes
     * 2. Enforces Newtonian balance: Column sums to 0 with one +1 and one -1
     * 
     * Uses nodal divergence heuristic to choose source/sink assignment.
     * 
     * @returns {Object} Rectification report with details of changes made
     */
    autoRectify() {
        const auditBefore = this.audit();
        const changes = [];
        const pruned = [];
        const clearedDiagonal = [];
        
        if (auditBefore.isPhysical) {
            return {
                success: true,
                alreadyPhysical: true,
                changes: [],
                pruned: [],
                clearedDiagonal: [],
                auditBefore: auditBefore,
                auditAfter: auditBefore
            };
        }
        
        // === PRE-CHECK: Would clearing diagonal blocks disconnect the graph? ===
        // Count how many edges would remain after clearing p-p and q-q connections
        const pSet = new Set(this.pIndices);
        const qSet = new Set(this.qIndices);
        
        // Simulate clearing diagonal blocks and check connectivity
        const simulatedMatrix = this.fullMatrix.map(row => [...row]);
        let diagonalEdgesCount = 0;
        
        // Clear p-p connections in simulation
        for (let i = 0; i < this.N; i++) {
            for (let j = 0; j < this.N; j++) {
                if (i !== j) {
                    const pi = this.pIndices[i];
                    const pj = this.pIndices[j];
                    if (simulatedMatrix[pi] && simulatedMatrix[pi][pj] !== 0) {
                        simulatedMatrix[pi][pj] = 0;
                        diagonalEdgesCount++;
                    }
                }
            }
        }
        
        // Clear q-q connections in simulation
        for (let i = 0; i < this.M; i++) {
            for (let j = 0; j < this.M; j++) {
                if (i !== j) {
                    const qi = this.qIndices[i];
                    const qj = this.qIndices[j];
                    if (simulatedMatrix[qi] && simulatedMatrix[qi][qj] !== 0) {
                        simulatedMatrix[qi][qj] = 0;
                        diagonalEdgesCount++;
                    }
                }
            }
        }
        
        // Check if simulated clearing would disconnect the graph
        if (diagonalEdgesCount > 0) {
            const simulatedConnectivity = PhysicsEngine.checkConnectivity(simulatedMatrix);
            
            if (!simulatedConnectivity.isConnected) {
                // Rectification would disconnect! Check if a better partition exists
                const discovery = PhysicsEngine.discoverBipartitePartition(this.fullMatrix);
                
                if (discovery.isBipartite) {
                    // Graph IS bipartite - suggest the optimal partition
                    console.log('[Physics] Current partition incompatible with graph structure');
                    console.log('[Physics] Bipartite partition available:', discovery);
                    
                    return {
                        success: false,
                        wouldDisconnect: true,
                        reason: 'partition_incompatible',
                        message: `Current partition would remove ${diagonalEdgesCount / 2} edges and create ${simulatedConnectivity.componentCount} disconnected components`,
                        suggestedPartition: {
                            pIndices: discovery.pIndices,
                            qIndices: discovery.qIndices,
                            reason: discovery.reason
                        },
                        connectivity: simulatedConnectivity,
                        auditBefore: auditBefore
                    };
                } else {
                    // Graph is NOT bipartite - cannot be made realizable via partition change
                    console.log('[Physics] Graph is not bipartite:', discovery.reason);
                    
                    return {
                        success: false,
                        wouldDisconnect: true,
                        reason: 'not_bipartite',
                        message: `Graph is not bipartite (${discovery.reason}). Cannot find a partition where all edges connect p to q nodes.`,
                        connectivity: simulatedConnectivity,
                        auditBefore: auditBefore
                    };
                }
            }
        }
        
        // === PROCEED WITH RECTIFICATION ===
        // 0. ENFORCE BLOCK STRUCTURE: Clear diagonal blocks
        // A port-Hamiltonian system has structure [0, B; -B', 0]
        // The diagonal blocks (p-p connections and q-q connections) must be zero
        
        // Clear p-p block (top-left: connections between p-nodes)
        for (let i = 0; i < this.N; i++) {
            for (let j = 0; j < this.N; j++) {
                if (i !== j) {
                    const pi = this.pIndices[i];
                    const pj = this.pIndices[j];
                    if (this.fullMatrix[pi] && this.fullMatrix[pi][pj] !== 0) {
                        clearedDiagonal.push({
                            type: 'p-p',
                            from: pi,
                            to: pj,
                            oldValue: this.fullMatrix[pi][pj]
                        });
                        this.fullMatrix[pi][pj] = 0;
                    }
                }
            }
        }
        
        // Clear q-q block (bottom-right: connections between q-nodes)
        for (let i = 0; i < this.M; i++) {
            for (let j = 0; j < this.M; j++) {
                if (i !== j) {
                    const qi = this.qIndices[i];
                    const qj = this.qIndices[j];
                    if (this.fullMatrix[qi] && this.fullMatrix[qi][qj] !== 0) {
                        clearedDiagonal.push({
                            type: 'q-q',
                            from: qi,
                            to: qj,
                            oldValue: this.fullMatrix[qi][qj]
                        });
                        this.fullMatrix[qi][qj] = 0;
                    }
                }
            }
        }
        
        if (clearedDiagonal.length > 0) {
            console.log(`[Physics] Cleared ${clearedDiagonal.length} diagonal block entries (p-p and q-q connections)`);
        }
        
        // 1. CALCULATE GLOBAL NODAL DIVERGENCE
        // Sum of each row in B represents the 'net flow' at each node
        const divergences = this.getAllDivergences();
        
        // 2. ITERATE THROUGH EVERY EDGE (COLUMN)
        for (let col = 0; col < this.M; col++) {
            let participants = [];
            for (let row = 0; row < this.N; row++) {
                if (this.B[row][col] !== 0) {
                    participants.push(row);
                }
            }
            
            // --- STEP A: ENFORCE SPARSITY ---
            // A physical spring/edge only connects exactly 2 nodes.
            // If more than 2 exist (Hyper-edge), we must prune to exactly 2.
            // 
            // FAIR DISTRIBUTION HEURISTIC:
            // Instead of always keeping the first 2 participants (which would
            // always disconnect higher-indexed nodes), we keep the 2 nodes
            // with the FEWEST remaining connections to ensure fair distribution.
            if (participants.length > 2) {
                // Sort participants by their current connection count (ascending)
                // Nodes with fewer connections get priority to keep this connection
                const participantsByConnections = participants
                    .map(nodeIdx => ({
                        node: nodeIdx,
                        connections: this._countNodeConnections(nodeIdx)
                    }))
                    .sort((a, b) => a.connections - b.connections);
                
                // Keep the 2 nodes with fewest connections
                const keepNodes = new Set([
                    participantsByConnections[0].node,
                    participantsByConnections[1].node
                ]);
                
                // Prune all others
                for (const nodeIdx of participants) {
                    if (!keepNodes.has(nodeIdx)) {
                        const oldValue = this.B[nodeIdx][col];
                        
                        // Update B-block
                        this.B[nodeIdx][col] = 0;
                        
                        // Update full matrix (maintaining skew-symmetry)
                        this._updateMatrixEntry(nodeIdx, col, 0);
                        
                        pruned.push({
                            column: col,
                            globalIndex: this._getGlobalColIndex(col),
                            node: nodeIdx,
                            oldValue: oldValue,
                            reason: 'Hyper-edge pruning (>2 connections)'
                        });
                    }
                }
                
                participants = Array.from(keepNodes);
            }
            
            // --- STEP B: ENFORCE NEWTONIAN BALANCE (SIGN FLIP) ---
            if (participants.length === 2) {
                const [n1, n2] = participants;
                
                // Use the Nodal Divergence Heuristic:
                // The node with the higher positive divergence becomes the 'Source' (-1).
                // The other becomes the 'Sink' (+1).
                let source, sink;
                if (divergences[n1] >= divergences[n2]) {
                    source = n1;
                    sink = n2;
                } else {
                    source = n2;
                    sink = n1;
                }
                
                // Check if already correct
                const currentSourceVal = this.B[source][col];
                const currentSinkVal = this.B[sink][col];
                
                if (currentSourceVal !== -1 || currentSinkVal !== 1) {
                    // Record old values
                    const oldSourceVal = this.B[source][col];
                    const oldSinkVal = this.B[sink][col];
                    
                    // Apply changes to the B-block
                    this.B[source][col] = -1;
                    this.B[sink][col] = 1;
                    
                    // Update full matrix (maintaining skew-symmetry)
                    this._updateMatrixEntry(source, col, -1);
                    this._updateMatrixEntry(sink, col, 1);
                    
                    // Recompute divergences after change
                    divergences[source] = this.calculateNodalDivergence(source);
                    divergences[sink] = this.calculateNodalDivergence(sink);
                    
                    changes.push({
                        column: col,
                        globalIndex: this._getGlobalColIndex(col),
                        source: source,
                        sink: sink,
                        oldValues: { [source]: oldSourceVal, [sink]: oldSinkVal },
                        newValues: { [source]: -1, [sink]: 1 }
                    });
                }
            } else if (participants.length === 1) {
                // Dangling edge - cannot be rectified without adding connections
                // For now, just note it
                changes.push({
                    column: col,
                    globalIndex: this._getGlobalColIndex(col),
                    issue: 'Dangling edge (only 1 connection)',
                    node: participants[0],
                    unrectifiable: true
                });
            } else if (participants.length === 0) {
                // Disconnected edge - no action needed
            }
        }
        
        // Invalidate cached matrices after modification
        this.invalidateSystemMatrix();
        this.invalidateCayleyCache();
        
        // Re-run audit (includes connectivity check)
        const auditAfter = this.audit();
        
        // Check if rectification disconnected the graph
        const connectivityAfter = PhysicsEngine.checkConnectivity(this.fullMatrix);
        
        return {
            success: auditAfter.isPhysical && connectivityAfter.isConnected,
            alreadyPhysical: false,
            changes: changes,
            pruned: pruned,
            clearedDiagonal: clearedDiagonal,
            auditBefore: auditBefore,
            auditAfter: auditAfter,
            connectivity: connectivityAfter,
            summary: {
                edgesRectified: changes.filter(c => !c.unrectifiable).length,
                edgesPruned: pruned.length,
                diagonalCleared: clearedDiagonal.length,
                unrectifiable: changes.filter(c => c.unrectifiable).length,
                isConnected: connectivityAfter.isConnected,
                componentCount: connectivityAfter.componentCount
            }
        };
    }
    
    /**
     * Helper to get the global column index
     */
    _getGlobalColIndex(col) {
        if (this.qIndices) {
            return this.qIndices[col];
        }
        return this.isPreAugmented ? this.N + col : col;
    }
    
    /**
     * Helper to update entries while maintaining Skew-Symmetry
     * Updates both the B-block position and its transpose.
     * 
     * @param {number} bRow - Row index in B matrix (0 to N-1)
     * @param {number} bCol - Column index in B matrix (0 to M-1)  
     * @param {number} val - Value to set
     */
    _updateMatrixEntry(bRow, bCol, val) {
        // Map B-matrix indices to full matrix indices
        const fullRow = this.pIndices[bRow];  // Row in p-block
        const fullCol = this.qIndices[bCol];  // Column in q-block
        
        // Validate indices are within bounds
        const matrixSize = this.fullMatrix.length;
        if (fullRow >= matrixSize || fullCol >= matrixSize) {
            console.error(`[Physics] _updateMatrixEntry out of bounds: fullRow=${fullRow}, fullCol=${fullCol}, matrixSize=${matrixSize}`);
            console.error(`[Physics] bRow=${bRow}, bCol=${bCol}, pIndices=[${this.pIndices}], qIndices=[${this.qIndices}]`);
            return;
        }
        
        // Update B-block position: A[p_i][q_j] = val
        this.fullMatrix[fullRow][fullCol] = val;
        
        // Update transpose position: A[q_j][p_i] = -val (skew-symmetry)
        this.fullMatrix[fullCol][fullRow] = -val;
    }
    
    /**
     * Count how many non-zero connections a p-node has in the B matrix
     * Used by fair pruning heuristic to distribute connections evenly.
     * 
     * @param {number} nodeIdx - Row index in B matrix (0 to N-1)
     * @returns {number} Count of non-zero entries in that row
     */
    _countNodeConnections(nodeIdx) {
        if (nodeIdx < 0 || nodeIdx >= this.N) return 0;
        let count = 0;
        for (let j = 0; j < this.M; j++) {
            if (this.B[nodeIdx][j] !== 0) {
                count++;
            }
        }
        return count;
    }
    
    /**
     * Get the rectified matrix (for updating the graph state)
     * @returns {number[][]} The full matrix after rectification
     */
    getRectifiedMatrix() {
        return this.fullMatrix;
    }
    
    // =====================================================
    // 3. SYSTEM MATRIX FOR DYNAMICS
    // =====================================================
    
    /**
     * Build the properly ordered system matrix J for dynamics
     * 
     * For state vector x = [p | q]ᵀ where p ∈ ℝᴺ and q ∈ ℝᴹ,
     * the system matrix J has block structure:
     * 
     *   J = [  0    B  ]  ∈ ℝ⁽ᴺ⁺ᴹ⁾ˣ⁽ᴺ⁺ᴹ⁾
     *       [ -Bᵀ   0  ]
     * 
     * This ensures ẋ = Jx correctly couples p and q states
     * regardless of the original matrix ordering.
     * 
     * @returns {number[][]} The (N+M)×(N+M) system matrix
     */
    buildSystemMatrix() {
        const dim = this.N + this.M;
        
        // Initialize with zeros
        const J = [];
        for (let i = 0; i < dim; i++) {
            J[i] = new Array(dim).fill(0);
        }
        
        // Fill B block (top-right): J[i][N+j] = B[i][j]
        for (let i = 0; i < this.N; i++) {
            for (let j = 0; j < this.M; j++) {
                J[i][this.N + j] = this.B[i][j];
            }
        }
        
        // Fill -Bᵀ block (bottom-left): J[N+j][i] = -B[i][j]
        for (let i = 0; i < this.N; i++) {
            for (let j = 0; j < this.M; j++) {
                J[this.N + j][i] = -this.B[i][j];
            }
        }
        
        return J;
    }
    
    /**
     * Get or build the system matrix (cached for performance)
     */
    getSystemMatrix() {
        if (!this._systemMatrix) {
            this._systemMatrix = this.buildSystemMatrix();
        }
        return this._systemMatrix;
    }
    
    /**
     * Invalidate cached system matrix (call after B changes)
     */
    invalidateSystemMatrix() {
        this._systemMatrix = null;
    }
    
    /**
     * Format the system matrix J for display
     * Useful for debugging and verifying correct partition ordering
     */
    formatSystemMatrix() {
        const J = this.getSystemMatrix();
        const dim = this.N + this.M;
        
        let text = `System Matrix J (${dim}×${dim}) [${this.mode}]:\n`;
        text += `State vector order: x = [p₀..p_{${this.N-1}} | q₀..q_{${this.M-1}}]ᵀ\n`;
        
        if (this.mode === 'custom partition') {
            text += `p maps to original indices: {${this.pIndices.join(', ')}}\n`;
            text += `q maps to original indices: {${this.qIndices.join(', ')}}\n`;
        }
        
        text += '\n';
        
        // Header with state labels
        text += '     ';
        for (let j = 0; j < dim; j++) {
            const label = j < this.N ? `p${j}` : `q${j - this.N}`;
            text += label.padStart(4);
        }
        text += '\n';
        
        // Matrix rows
        for (let i = 0; i < dim; i++) {
            const rowLabel = i < this.N ? `p${i}` : `q${i - this.N}`;
            text += rowLabel.padStart(4) + ' ';
            for (let j = 0; j < dim; j++) {
                const val = J[i][j];
                if (val === 0) {
                    text += '  . ';
                } else if (val === 1) {
                    text += ' +1 ';
                } else if (val === -1) {
                    text += ' -1 ';
                } else {
                    text += val.toFixed(1).padStart(4);
                }
            }
            text += '\n';
            
            // Separator between p and q blocks
            if (i === this.N - 1) {
                text += '     ' + '────'.repeat(dim) + '\n';
            }
        }
        
        return text;
    }

    // =====================================================
    // 5. HAMILTONIAN: ENERGY CALCULATION
    // =====================================================
    
    /**
     * Compute the Hamiltonian (total energy)
     * 
     * For a physically realizable system, H(x) is an invariant:
     *   H(x) = ½xᵀx = ½Σpᵢ² + ½Σqⱼ²
     * 
     * where:
     *   - pᵢ are node states (kinetic energy: ½mp²/2m = p²/2m, here m=1)
     *   - qⱼ are edge states (potential energy: ½kq², here k=1)
     * 
     * @param {number[]} stateVec - Optional state vector (uses internal if not provided)
     * @returns {Object} Energy breakdown
     */
    getHamiltonian(stateVec = null) {
        const x = stateVec || this.stateVector;
        const n = this.N;
        const m = this.M;
        
        let kineticEnergy = 0;   // From absolute states (nodes)
        let potentialEnergy = 0; // From relative states (edges)
        
        for (let i = 0; i < n + m; i++) {
            const componentEnergy = 0.5 * x[i] * x[i];
            
            if (i < n) {
                kineticEnergy += componentEnergy;
            } else {
                potentialEnergy += componentEnergy;
            }
        }
        
        return {
            total: kineticEnergy + potentialEnergy,
            kinetic: kineticEnergy,
            potential: potentialEnergy,
            kineticPerNode: kineticEnergy / n,
            potentialPerEdge: m > 0 ? potentialEnergy / m : 0
        };
    }
    
    /**
     * Time derivative of state: ẋ = Jx (using properly ordered system matrix)
     * 
     * Uses the block-structured system matrix J = [0, B; -Bᵀ, 0]
     * which correctly couples p and q states regardless of original ordering.
     * 
     * @param {number[]} stateVec - Current state vector
     * @returns {number[]} State derivative
     */
    computeStateDerivative(stateVec = null) {
        const x = stateVec || this.stateVector;
        const dim = this.N + this.M;
        const dxdt = new Array(dim).fill(0);
        
        // Use the properly ordered system matrix
        const J = this.getSystemMatrix();
        
        for (let i = 0; i < dim; i++) {
            for (let j = 0; j < dim; j++) {
                dxdt[i] += J[i][j] * x[j];
            }
        }
        
        return dxdt;
    }
    
    /**
     * Verify energy conservation: dH/dt = xᵀAx should equal 0 for skew-symmetric A
     * 
     * @param {number[]} stateVec - Current state vector
     * @returns {Object} Conservation check result
     */
    checkEnergyConservation(stateVec = null) {
        const x = stateVec || this.stateVector;
        const dxdt = this.computeStateDerivative(x);
        
        // dH/dt = xᵀẋ = xᵀAx
        let dHdt = 0;
        for (let i = 0; i < x.length; i++) {
            dHdt += x[i] * dxdt[i];
        }
        
        return {
            dHdt: dHdt,
            isConserved: Math.abs(dHdt) < 1e-10,
            message: Math.abs(dHdt) < 1e-10 
                ? 'Energy is conserved (dH/dt ≈ 0)' 
                : `Energy is NOT conserved: dH/dt = ${dHdt.toExponential(4)}`
        };
    }
    
    /**
     * Step the simulation using Cayley transform (energy-conserving)
     * 
     * The Cayley transform C(A,dt) = (I - (dt/2)A)^(-1) (I + (dt/2)A)
     * is orthogonal for skew-symmetric A, meaning ||Cx|| = ||x||
     * This exactly preserves the Hamiltonian H = ½||x||²
     * 
     * @param {number} dt - Time step
     */
    /**
     * Optimized Cayley Step using Block Inversion (Schur Complement)
     * Exploits the port-Hamiltonian structure: J = [[0, B], [-B^T, 0]]
     * Reduces complexity from O((N+M)³) to O(N³) where N < M typically
     * 
     * The Cayley transform (I - kJ)^(-1)(I + kJ) is computed efficiently using:
     * - Schur complement S = I + k²BB^T (N×N matrix)
     * - Block formulas for the update
     */
    stepCayley(dt) {
        const { N, M } = { N: this.N, M: this.M };
        
        // If no proper partition, fall back to generic method
        if (N === 0 || M === 0) {
            return this._stepCayleyGeneric(dt);
        }
        
        const k = dt / 2;
        const kSq = k * k;
        
        // 1. Get or compute cached B matrix
        const B = this.B;  // N x M matrix
        
        // 2. Compute Schur complement: S = I + k²BB^T (N×N matrix)
        // This is the key optimization - invert N×N instead of (N+M)×(N+M)
        const S = this._computeSchurComplement(B, kSq, N, M);
        
        // 3. Invert the N×N Schur system
        const S_inv = this._invertMatrix(S);
        if (!S_inv) {
            console.warn("[Cayley] Schur inversion failed, falling back to generic");
            return this._stepCayleyGeneric(dt);
        }
        
        // 4. Partition current state vector x = [p, q]
        // p: momentum (indices from pIndices), q: displacement (indices from qIndices)
        const p = new Array(N);
        const q = new Array(M);
        for (let i = 0; i < N; i++) {
            p[i] = this.stateVector[i];
        }
        for (let j = 0; j < M; j++) {
            q[j] = this.stateVector[N + j];
        }
        
        // 5. Compute p_next = S^(-1) * [(I - k²BB^T)p + 2kBq]
        const p_next = this._computeNextP(p, q, B, S_inv, k, kSq, N, M);
        
        // 6. Compute q_next = q - k*B^T*(p + p_next)  [minus from -B^T in J]
        const q_next = this._computeNextQ(p, p_next, q, B, k, N, M);
        
        // 7. Reconstruct state vector
        for (let i = 0; i < N; i++) {
            this.stateVector[i] = p_next[i];
        }
        for (let j = 0; j < M; j++) {
            this.stateVector[N + j] = q_next[j];
        }
    }
    
    /**
     * Compute Schur complement: S = I + k²BB^T
     * Result is an N×N matrix
     * @private
     */
    _computeSchurComplement(B, kSq, N, M) {
        const S = Array.from({ length: N }, () => new Array(N).fill(0));
        
        for (let i = 0; i < N; i++) {
            S[i][i] = 1.0;  // Identity component
            for (let j = 0; j < N; j++) {
                // Compute (BB^T)[i][j] = sum_l B[i][l] * B[j][l]
                let bbT = 0;
                for (let l = 0; l < M; l++) {
                    bbT += B[i][l] * B[j][l];
                }
                S[i][j] += kSq * bbT;
            }
        }
        return S;
    }
    
    /**
     * Compute next momentum: p_next = S^(-1) * [(I - k²BB^T)p + 2kBq]
     * @private
     */
    _computeNextP(p, q, B, S_inv, k, kSq, N, M) {
        // Step 1: Compute (I - k²BB^T)p
        // First compute BB^T * p
        const BBTp = new Array(N).fill(0);
        for (let i = 0; i < N; i++) {
            // (BB^T * p)[i] = sum_j (BB^T)[i][j] * p[j]
            //               = sum_j sum_l B[i][l]*B[j][l] * p[j]
            for (let j = 0; j < N; j++) {
                let bbT_ij = 0;
                for (let l = 0; l < M; l++) {
                    bbT_ij += B[i][l] * B[j][l];
                }
                BBTp[i] += bbT_ij * p[j];
            }
        }
        
        // term1 = p - k²(BB^T)p
        const term1 = new Array(N);
        for (let i = 0; i < N; i++) {
            term1[i] = p[i] - kSq * BBTp[i];
        }
        
        // Step 2: Compute 2kBq
        const Bq = new Array(N).fill(0);
        for (let i = 0; i < N; i++) {
            for (let l = 0; l < M; l++) {
                Bq[i] += B[i][l] * q[l];
            }
        }
        
        // rhs = term1 + 2k*Bq
        const rhs = new Array(N);
        for (let i = 0; i < N; i++) {
            rhs[i] = term1[i] + 2 * k * Bq[i];
        }
        
        // Step 3: p_next = S^(-1) * rhs
        const p_next = new Array(N).fill(0);
        for (let i = 0; i < N; i++) {
            for (let j = 0; j < N; j++) {
                p_next[i] += S_inv[i][j] * rhs[j];
            }
        }
        
        return p_next;
    }
    
    /**
     * Compute next displacement: q_next = q - k*B^T*(p + p_next)
     * Note: The minus sign comes from J = [[0, B], [-B^T, 0]]
     * @private
     */
    _computeNextQ(p, p_next, q, B, k, N, M) {
        // Compute p + p_next
        const p_sum = new Array(N);
        for (let i = 0; i < N; i++) {
            p_sum[i] = p[i] + p_next[i];
        }
        
        // Compute B^T * p_sum
        const BTp = new Array(M).fill(0);
        for (let j = 0; j < M; j++) {
            for (let i = 0; i < N; i++) {
                BTp[j] += B[i][j] * p_sum[i];  // B^T[j][i] = B[i][j]
            }
        }
        
        // q_next = q - k*B^T*(p + p_next)  [MINUS sign from -B^T in J matrix]
        const q_next = new Array(M);
        for (let j = 0; j < M; j++) {
            q_next[j] = q[j] - k * BTp[j];
        }
        
        return q_next;
    }
    
    /**
     * Generic Cayley step (fallback for non-standard systems)
     * Uses full (N+M)×(N+M) matrix inversion
     * @private
     */
    _stepCayleyGeneric(dt) {
        const dim = this.N + this.M;
        
        // Compute Cayley matrix if not cached or dt changed
        if (!this._cayleyMatrix || Math.abs(this._cayleyDt - dt) > 1e-12) {
            this._cayleyMatrix = this._computeCayleyMatrix(dt);
            this._cayleyDt = dt;
        }
        
        if (!this._cayleyMatrix) {
            // Fallback to Euler if Cayley fails
            const dxdt = this.computeStateDerivative();
            for (let i = 0; i < dim; i++) {
                this.stateVector[i] += dxdt[i] * dt;
            }
            return;
        }
        
        // Apply: x(t+dt) = C * x(t)
        const newState = new Array(dim).fill(0);
        for (let i = 0; i < dim; i++) {
            for (let j = 0; j < dim; j++) {
                newState[i] += this._cayleyMatrix[i][j] * this.stateVector[j];
            }
        }
        this.stateVector = newState;
    }
    
    /**
     * Compute Cayley transform matrix: C = (I - kJ)^(-1) (I + kJ) where k = dt/2
     * Uses the properly ordered system matrix J for correct dynamics.
     * @private
     */
    _computeCayleyMatrix(dt) {
        const n = this.N + this.M;
        if (n === 0) return null;
        
        // Use the properly ordered system matrix
        const J = this.getSystemMatrix();
        const k = dt / 2;
        
        // I - kJ
        const ImkJ = [];
        for (let i = 0; i < n; i++) {
            ImkJ[i] = [];
            for (let j = 0; j < n; j++) {
                ImkJ[i][j] = (i === j ? 1 : 0) - k * J[i][j];
            }
        }
        
        // I + kJ  
        const IpkJ = [];
        for (let i = 0; i < n; i++) {
            IpkJ[i] = [];
            for (let j = 0; j < n; j++) {
                IpkJ[i][j] = (i === j ? 1 : 0) + k * J[i][j];
            }
        }
        
        // Invert (I - kJ)
        const inv = this._invertMatrix(ImkJ);
        if (!inv) return null;
        
        // Result = inv * IpkJ
        return this._multiplyMatrices(inv, IpkJ);
    }
    
    /**
     * Matrix inversion using Gaussian elimination with partial pivoting
     * @private
     */
    _invertMatrix(M) {
        const n = M.length;
        
        // Create augmented matrix [M | I]
        const aug = [];
        for (let i = 0; i < n; i++) {
            aug[i] = [];
            for (let j = 0; j < n; j++) aug[i][j] = M[i][j];
            for (let j = 0; j < n; j++) aug[i][n + j] = (i === j) ? 1 : 0;
        }
        
        // Gaussian elimination with partial pivoting
        for (let col = 0; col < n; col++) {
            let maxRow = col;
            for (let row = col + 1; row < n; row++) {
                if (Math.abs(aug[row][col]) > Math.abs(aug[maxRow][col])) maxRow = row;
            }
            
            [aug[col], aug[maxRow]] = [aug[maxRow], aug[col]];
            
            if (Math.abs(aug[col][col]) < 1e-12) return null;
            
            const pivot = aug[col][col];
            for (let j = 0; j < 2 * n; j++) aug[col][j] /= pivot;
            
            for (let row = 0; row < n; row++) {
                if (row !== col) {
                    const factor = aug[row][col];
                    for (let j = 0; j < 2 * n; j++) aug[row][j] -= factor * aug[col][j];
                }
            }
        }
        
        // Extract inverse
        const inv = [];
        for (let i = 0; i < n; i++) {
            inv[i] = [];
            for (let j = 0; j < n; j++) inv[i][j] = aug[i][n + j];
        }
        return inv;
    }
    
    /**
     * Matrix multiplication
     * @private
     */
    _multiplyMatrices(A, B) {
        const n = A.length;
        const result = [];
        for (let i = 0; i < n; i++) {
            result[i] = [];
            for (let j = 0; j < n; j++) {
                result[i][j] = 0;
                for (let k = 0; k < n; k++) {
                    result[i][j] += A[i][k] * B[k][j];
                }
            }
        }
        return result;
    }
    
    /**
     * Invalidate the cached Cayley matrix (call after matrix changes)
     */
    invalidateCayleyCache() {
        this._cayleyMatrix = null;
        this._cayleyDt = 0;
    }
    
    // =====================================================
    // 6. UTILITY METHODS
    // =====================================================
    
    /**
     * Get the full adjacency matrix
     * @returns {number[][]} (N+M) × (N+M) matrix
     */
    getFullMatrix() {
        return this.fullMatrix;
    }
    
    /**
     * Get the B-block (incidence-like matrix)
     * @returns {number[][]} N × M matrix
     */
    getIncidenceMatrix() {
        return this.B;
    }
    
    /**
     * Get system dimensions
     * @returns {Object} {N, M, totalDim}
     */
    getDimensions() {
        return {
            N: this.N,
            M: this.M,
            totalDim: this.N + this.M
        };
    }
    
    /**
     * Set state vector for dynamics
     * @param {number[]} newState - New state vector
     */
    setStateVector(newState) {
        if (newState.length === this.N + this.M) {
            this.stateVector = [...newState];
        }
    }
    
    /**
     * Initialize state vector with a "pluck" pattern
     * @param {string} pattern - 'uniform', 'random', 'first', 'alternating'
     * @param {number} amplitude - Initial amplitude (default 1.0)
     */
    initializeState(pattern = 'uniform', amplitude = 1.0) {
        const dim = this.N + this.M;
        this.stateVector = new Array(dim).fill(0);
        
        switch (pattern) {
            case 'uniform':
                this.stateVector = new Array(dim).fill(amplitude);
                break;
            case 'random':
                for (let i = 0; i < dim; i++) {
                    this.stateVector[i] = (Math.random() - 0.5) * 2 * amplitude;
                }
                break;
            case 'first':
                this.stateVector[0] = amplitude;
                break;
            case 'alternating':
                for (let i = 0; i < dim; i++) {
                    this.stateVector[i] = (i % 2 === 0 ? 1 : -1) * amplitude;
                }
                break;
            case 'nodes_only':
                for (let i = 0; i < this.N; i++) {
                    this.stateVector[i] = amplitude;
                }
                break;
            case 'edges_only':
                for (let i = this.N; i < dim; i++) {
                    this.stateVector[i] = amplitude;
                }
                break;
            default:
                this.stateVector = new Array(dim).fill(amplitude);
        }
    }
    
    /**
     * Format audit report as readable text
     * @param {Object} report - Audit report from audit()
     * @returns {string} Formatted report
     */
    static formatAuditReport(report) {
        let text = '';
        text += '═══════════════════════════════════════════════════════\n';
        text += '           PHYSICAL REALIZABILITY AUDIT\n';
        text += '═══════════════════════════════════════════════════════\n\n';
        
        text += `Status: ${report.statusColor === 'GREEN' ? '✓ PHYSICAL' : '✗ NON-PHYSICAL'}\n`;
        text += `Nodes (N): ${report.summary.nodeCount}\n`;
        text += `Edges (M): ${report.summary.edgeCount}\n`;
        text += `State Space Dimension: ${report.summary.stateSpaceDim}\n\n`;
        
        if (report.violations.length > 0) {
            text += '───────────────────────────────────────────────────────\n';
            text += 'VIOLATIONS:\n';
            text += '───────────────────────────────────────────────────────\n';
            for (const v of report.violations) {
                text += `  • ${v.message}\n`;
            }
            text += '\n';
        }
        
        if (report.warnings.length > 0) {
            text += '───────────────────────────────────────────────────────\n';
            text += 'WARNINGS:\n';
            text += '───────────────────────────────────────────────────────\n';
            for (const w of report.warnings) {
                text += `  ⚠ ${w.message}\n`;
            }
            text += '\n';
        }
        
        if (report.isPhysical) {
            text += '───────────────────────────────────────────────────────\n';
            text += '✓ System satisfies Newton\'s 3rd Law\n';
            text += '✓ Energy conservation guaranteed (dH/dt = 0)\n';
            text += '───────────────────────────────────────────────────────\n';
        }
        
        return text;
    }
    
    /**
     * Print the augmented matrix in a readable format
     * @returns {string} Formatted matrix string
     */
    formatAugmentedMatrix() {
        const dim = this.N + this.M;
        let text = '';
        
        text += `Augmented System Matrix J (${dim}×${dim}):\n`;
        text += '┌' + '─'.repeat(dim * 4 + 1) + '┐\n';
        
        for (let i = 0; i < dim; i++) {
            text += '│ ';
            for (let j = 0; j < dim; j++) {
                const val = this.matrix[i][j];
                if (val === 0) {
                    text += '  . ';
                } else if (val === 1) {
                    text += ' +1 ';
                } else if (val === -1) {
                    text += ' -1 ';
                } else {
                    text += val.toFixed(1).padStart(4);
                }
            }
            text += '│';
            
            // Row labels
            if (i < this.N) {
                text += ` p${i} (node ${i})`;
            } else {
                text += ` q${i - this.N} (edge ${i - this.N})`;
            }
            text += '\n';
            
            // Separator between node and edge blocks
            if (i === this.N - 1) {
                text += '├' + '─'.repeat(dim * 4 + 1) + '┤\n';
            }
        }
        
        text += '└' + '─'.repeat(dim * 4 + 1) + '┘\n';
        
        return text;
    }
}


// =====================================================
// CONVENIENCE FUNCTIONS FOR INTEGRATION
// =====================================================

/**
 * Quick audit of current graph in global state
 * @returns {Object} Audit report
 */
export function auditCurrentGraph() {
    const engine = new PhysicsEngine();
    return engine.audit();
}

/**
 * Quick rectification of current graph
 * @returns {Object} Rectification report
 */
export function rectifyCurrentGraph() {
    const engine = new PhysicsEngine();
    return engine.autoRectify();
}

/**
 * Get physics engine instance for current graph
 * @returns {PhysicsEngine} Engine instance
 */
export function getPhysicsEngine() {
    return new PhysicsEngine();
}

/**
 * Check if a matrix represents a physically realizable system
 * @param {number[][]} matrix - Adjacency matrix to check
 * @returns {boolean} True if physically realizable
 */
export function isPhysicallyRealizable(matrix) {
    const engine = new PhysicsEngine(matrix);
    const report = engine.audit();
    return report.isPhysical;
}


// =====================================================
// UI INTEGRATION HELPERS
// =====================================================

/**
 * Create a status badge HTML element
 * @param {Object} auditReport - Report from audit()
 * @returns {string} HTML string for status badge
 */
export function createStatusBadge(auditReport) {
    const colors = {
        'GREEN': { bg: '#10b981', text: '#ffffff', label: 'PHYSICAL' },
        'YELLOW': { bg: '#f59e0b', text: '#000000', label: 'MINOR ISSUES' },
        'ORANGE': { bg: '#f97316', text: '#ffffff', label: 'NON-PHYSICAL' },
        'RED': { bg: '#ef4444', text: '#ffffff', label: 'CRITICAL' }
    };
    
    const style = colors[auditReport.statusColor] || colors['ORANGE'];
    
    return `<span style="
        background-color: ${style.bg};
        color: ${style.text};
        padding: 2px 8px;
        border-radius: 4px;
        font-size: 12px;
        font-weight: bold;
    ">${style.label}</span>`;
}

/**
 * Create a detailed audit panel HTML
 * @param {Object} auditReport - Report from audit()
 * @returns {string} HTML string for audit panel
 */
export function createAuditPanel(auditReport) {
    const badge = createStatusBadge(auditReport);
    
    let html = `
        <div style="font-family: monospace; padding: 10px; background: #1a1a2e; border-radius: 8px;">
            <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 10px;">
                <span style="font-size: 16px; font-weight: bold; color: #e0e0e0;">
                    Physical Realizability
                </span>
                ${badge}
            </div>
            
            <div style="color: #9ca3af; font-size: 12px;">
                <div>Nodes (N): ${auditReport.summary.nodeCount}</div>
                <div>Edges (M): ${auditReport.summary.edgeCount}</div>
                <div>State Dimension: ${auditReport.summary.stateSpaceDim}</div>
            </div>
    `;
    
    if (auditReport.violations.length > 0) {
        html += `
            <div style="margin-top: 10px; padding: 8px; background: #2d1f1f; border-radius: 4px;">
                <div style="color: #f87171; font-weight: bold; margin-bottom: 5px;">
                    Violations (${auditReport.violations.length}):
                </div>
                <ul style="color: #fca5a5; margin: 0; padding-left: 20px; font-size: 11px;">
        `;
        for (const v of auditReport.violations) {
            html += `<li>${v.message}</li>`;
        }
        html += '</ul></div>';
    }
    
    if (auditReport.isPhysical) {
        html += `
            <div style="margin-top: 10px; padding: 8px; background: #1f2d1f; border-radius: 4px;">
                <div style="color: #4ade80;">
                    ✓ Newton's 3rd Law satisfied<br>
                    ✓ Energy conservation guaranteed
                </div>
            </div>
        `;
    }
    
    html += '</div>';
    return html;
}


// =====================================================
// EXPORT MODULE INFO
// =====================================================

export const MODULE_INFO = {
    name: 'physics-engine',
    version: '1.0.0',
    description: 'Port-Hamiltonian realizability analysis for graph-theoretic systems',
    exports: [
        'PhysicsEngine',
        'auditCurrentGraph',
        'rectifyCurrentGraph',
        'getPhysicsEngine',
        'isPhysicallyRealizable',
        'createStatusBadge',
        'createAuditPanel'
    ]
};
