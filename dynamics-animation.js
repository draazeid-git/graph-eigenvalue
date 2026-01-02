/**
 * Dynamics Animation Module
 * Handles simulation integration, phase diagrams, and visual updates
 * 
 * v35: Added SparseMatrix class with SpMV for O(m) dynamics on sparse graphs
 *      Enables n > 100 for Path, Cycle, Star, and other sparse graph families
 */

import * as THREE from 'three';
import { 
    state, VERTEX_RADIUS, 
    interpolateYellowBlue, interpolateRedGreen, 
    interpolatePowerColor, updateVertexPowerRing,
    updateFaceMeshes
} from './graph-core.js';

// Base vertex radius for scaling
const BASE_VERTEX_RADIUS = VERTEX_RADIUS;

// Teaching mode: freeze nodes to show only edge exchange
let freezeNodesMode = false;

// =====================================================
// SPARSE MATRIX CLASS (CSR Format)
// =====================================================

/**
 * Compressed Sparse Row (CSR) matrix for efficient SpMV operations.
 * For a graph with n vertices and m edges:
 *   - Dense storage: O(n²)
 *   - CSR storage: O(n + 2m) for symmetric adjacency
 *   - Dense SpMV: O(n²)
 *   - Sparse SpMV: O(m)
 * 
 * This enables dynamics simulation for n > 100 on sparse graphs.
 */
class SparseMatrix {
    /**
     * Create a sparse matrix from a dense matrix or edge list
     * @param {number} n - Matrix dimension
     */
    constructor(n) {
        this.n = n;
        this.rowPtr = new Int32Array(n + 1);  // Row pointers
        this.colIdx = null;  // Column indices (allocated on build)
        this.values = null;  // Non-zero values (allocated on build)
        this.nnz = 0;  // Number of non-zeros
        this._density = 0;  // Fraction of non-zeros
    }
    
    /**
     * Build CSR representation from dense matrix
     * @param {number[][]} dense - Dense matrix
     * @returns {SparseMatrix} this (for chaining)
     */
    fromDense(dense) {
        const n = this.n;
        
        // First pass: count non-zeros per row
        let totalNnz = 0;
        for (let i = 0; i < n; i++) {
            let rowNnz = 0;
            for (let j = 0; j < n; j++) {
                if (dense[i][j] !== 0) rowNnz++;
            }
            this.rowPtr[i + 1] = this.rowPtr[i] + rowNnz;
            totalNnz += rowNnz;
        }
        
        this.nnz = totalNnz;
        this._density = totalNnz / (n * n);
        this.colIdx = new Int32Array(totalNnz);
        this.values = new Float64Array(totalNnz);
        
        // Second pass: fill arrays
        let idx = 0;
        for (let i = 0; i < n; i++) {
            for (let j = 0; j < n; j++) {
                if (dense[i][j] !== 0) {
                    this.colIdx[idx] = j;
                    this.values[idx] = dense[i][j];
                    idx++;
                }
            }
        }
        
        return this;
    }
    
    /**
     * Build CSR representation from edge list (for adjacency matrix)
     * @param {Array<[number, number]>} edges - Array of [i, j] edges
     * @param {boolean} symmetric - If true, add both (i,j) and (j,i)
     * @returns {SparseMatrix} this
     */
    fromEdges(edges, symmetric = true) {
        const n = this.n;
        
        // Count edges per row
        const rowCounts = new Int32Array(n);
        for (const [i, j] of edges) {
            if (i >= 0 && i < n && j >= 0 && j < n) {
                rowCounts[i]++;
                if (symmetric && i !== j) rowCounts[j]++;
            }
        }
        
        // Build row pointers
        this.rowPtr[0] = 0;
        for (let i = 0; i < n; i++) {
            this.rowPtr[i + 1] = this.rowPtr[i] + rowCounts[i];
        }
        
        this.nnz = this.rowPtr[n];
        this._density = this.nnz / (n * n);
        this.colIdx = new Int32Array(this.nnz);
        this.values = new Float64Array(this.nnz);
        
        // Fill with 1s for adjacency, track position per row
        const rowPos = new Int32Array(n);
        for (let i = 0; i < n; i++) rowPos[i] = this.rowPtr[i];
        
        for (const [i, j] of edges) {
            if (i >= 0 && i < n && j >= 0 && j < n) {
                this.colIdx[rowPos[i]] = j;
                this.values[rowPos[i]] = 1;
                rowPos[i]++;
                
                if (symmetric && i !== j) {
                    this.colIdx[rowPos[j]] = i;
                    this.values[rowPos[j]] = 1;
                    rowPos[j]++;
                }
            }
        }
        
        // Sort column indices within each row (optional, but good for cache)
        for (let i = 0; i < n; i++) {
            const start = this.rowPtr[i];
            const end = this.rowPtr[i + 1];
            // Simple insertion sort (rows are usually small)
            for (let j = start + 1; j < end; j++) {
                const col = this.colIdx[j];
                const val = this.values[j];
                let k = j - 1;
                while (k >= start && this.colIdx[k] > col) {
                    this.colIdx[k + 1] = this.colIdx[k];
                    this.values[k + 1] = this.values[k];
                    k--;
                }
                this.colIdx[k + 1] = col;
                this.values[k + 1] = val;
            }
        }
        
        return this;
    }
    
    /**
     * Sparse Matrix-Vector Multiplication: y = A * x
     * Time complexity: O(nnz) instead of O(n²)
     * 
     * @param {Float64Array|number[]} x - Input vector
     * @param {Float64Array} y - Output vector (optional, will be created if null)
     * @returns {Float64Array} Result vector y = A*x
     */
    multiply(x, y = null) {
        const n = this.n;
        if (!y) y = new Float64Array(n);
        
        for (let i = 0; i < n; i++) {
            let sum = 0;
            const rowStart = this.rowPtr[i];
            const rowEnd = this.rowPtr[i + 1];
            
            for (let k = rowStart; k < rowEnd; k++) {
                sum += this.values[k] * x[this.colIdx[k]];
            }
            y[i] = sum;
        }
        
        return y;
    }
    
    /**
     * Compute y = A*x and derivatives for dynamics
     * Uses in-place update for efficiency
     * @param {Float64Array} x - State vector
     * @param {Float64Array} dxdt - Derivative vector (output)
     */
    computeDerivative(x, dxdt) {
        const n = this.n;
        for (let i = 0; i < n; i++) {
            let sum = 0;
            const rowStart = this.rowPtr[i];
            const rowEnd = this.rowPtr[i + 1];
            
            for (let k = rowStart; k < rowEnd; k++) {
                sum += this.values[k] * x[this.colIdx[k]];
            }
            dxdt[i] = sum;
        }
    }
    
    /**
     * Check if matrix is sparse enough to benefit from SpMV
     * Rule of thumb: sparse methods win when density < ~10%
     * @returns {boolean}
     */
    isSparse() {
        return this._density < 0.1;
    }
    
    /**
     * Get density (fraction of non-zeros)
     */
    get density() {
        return this._density;
    }
    
    /**
     * Get graph statistics for logging
     */
    getStats() {
        const maxEdgesPerRow = Math.max(
            ...Array.from({ length: this.n }, (_, i) => 
                this.rowPtr[i + 1] - this.rowPtr[i]
            )
        );
        const avgEdgesPerRow = this.nnz / this.n;
        
        return {
            n: this.n,
            nnz: this.nnz,
            density: this._density,
            maxDegree: maxEdgesPerRow,
            avgDegree: avgEdgesPerRow,
            isSparse: this.isSparse(),
            memoryRatio: (this.nnz * 12) / (this.n * this.n * 8)  // CSR vs dense
        };
    }
}

// Sparse matrix cache
let sparseAdjMatrix = null;
let sparseMatrixValid = false;

/**
 * Get or build sparse adjacency matrix
 * @returns {SparseMatrix|null}
 */
function getSparseMatrix() {
    const n = state.adjacencyMatrix?.length || 0;
    if (n === 0) return null;
    
    if (!sparseMatrixValid || !sparseAdjMatrix || sparseAdjMatrix.n !== n) {
        sparseAdjMatrix = new SparseMatrix(n).fromDense(state.adjacencyMatrix);
        sparseMatrixValid = true;
        
        const stats = sparseAdjMatrix.getStats();
        console.log(`SparseMatrix built: n=${stats.n}, nnz=${stats.nnz}, ` +
                    `density=${(stats.density*100).toFixed(1)}%, ` +
                    `avgDegree=${stats.avgDegree.toFixed(1)}, ` +
                    `using ${stats.isSparse ? 'SPARSE' : 'DENSE'} mode`);
    }
    
    return sparseAdjMatrix;
}

/**
 * Invalidate sparse matrix cache (call when graph changes)
 */
export function invalidateSparseMatrix() {
    sparseMatrixValid = false;
    sparseAdjMatrix = null;
}

// =====================================================
// DYNAMICS STATE
// =====================================================

let dynamicsRunning = false;
let dynamicsAnimationId = null;
let simulationTime = 0;
let nodeStates = [];
let nodeDerivatives = [];

// Callback for enhanced visualization updates
let dynamicsUpdateCallback = null;

// =====================================================
// EIGENMODE ANIMATION STATE
// =====================================================

// Eigenmode animation: visualize a single eigenmode's oscillation pattern
let eigenmodeActive = false;
let eigenmodeData = null;  // { eigenvalue, eigenvector: {real, imag}, frequency, formula }
let eigenmodePhase = 0;    // Current phase of oscillation

// Store original vertex positions for eigenmode vertex displacement
let originalVertexPositions = null;

/**
 * Start eigenmode animation for a specific eigenvalue/eigenvector pair.
 * The animation shows x(t) = Re(e^{iωt} · v) where v is the eigenvector.
 * Vertices physically oscillate and edges stretch/compress accordingly.
 * 
 * @param {Object} eigenmode - { eigenvalue: {real, imag}, eigenvector: {real, imag}, formula? }
 */
export function startEigenmodeAnimation(eigenmode) {
    if (!eigenmode || !eigenmode.eigenvector) {
        console.error('Invalid eigenmode data');
        return;
    }
    
    const n = state.vertexMeshes.length;
    if (n === 0) return;
    
    // Check for NaN in eigenvector and use fallback if needed
    let vReal = eigenmode.eigenvector.real;
    let vImag = eigenmode.eigenvector.imag;
    
    const hasNaN = vReal.some(x => isNaN(x)) || (vImag && vImag.some(x => isNaN(x)));
    if (hasNaN) {
        console.warn('Eigenvector contains NaN, using fallback wave pattern');
        // Generate a simple standing wave pattern
        const modeIndex = eigenmode.modeIndex || 0;
        vReal = new Array(n);
        vImag = new Array(n);
        for (let i = 0; i < n; i++) {
            vReal[i] = Math.cos(2 * Math.PI * (modeIndex + 1) * i / n);
            vImag[i] = Math.sin(2 * Math.PI * (modeIndex + 1) * i / n);
        }
        eigenmode.eigenvector.real = vReal;
        eigenmode.eigenvector.imag = vImag;
        eigenmode.formula = `fallback mode ${modeIndex + 1}`;
    }
    
    // Stop any running dynamics first
    stopDynamics();
    
    // Store original vertex positions for restoration later
    originalVertexPositions = [];
    for (let i = 0; i < n; i++) {
        originalVertexPositions.push(state.vertexMeshes[i].position.clone());
    }
    
    // Store eigenmode data
    eigenmodeData = eigenmode;
    eigenmodeActive = true;
    eigenmodePhase = 0;
    
    // Initialize node states from eigenvector (real part at t=0)
    nodeStates = new Float64Array(n);
    nodeDerivatives = new Float64Array(n);
    
    // Normalize eigenvector for display
    vReal = eigenmode.eigenvector.real;
    vImag = eigenmode.eigenvector.imag;
    let maxAmp = 0;
    for (let i = 0; i < n; i++) {
        const amp = Math.sqrt(vReal[i] * vReal[i] + (vImag[i] || 0) * (vImag[i] || 0));
        if (amp > maxAmp) maxAmp = amp;
    }
    
    // Scale for visibility - larger displacement for better visualization
    const scale = maxAmp > 0 ? 1.0 / maxAmp : 1;
    eigenmodeData.scale = scale;
    eigenmodeData.maxAmplitude = maxAmp;
    
    // Displacement amplitude (in world units) - scales with graph size
    const avgDist = computeAverageVertexDistance();
    eigenmodeData.displacementScale = avgDist * 0.3;  // 30% of average vertex distance
    
    // Compute frequency from eigenvalue
    // For skew-symmetric: eigenvalue is iω, frequency = |ω|
    // For symmetric: eigenvalue is real, we use |λ| as frequency for visualization
    const omega = eigenmode.eigenvalue.imag !== 0 ? 
        Math.abs(eigenmode.eigenvalue.imag) : 
        Math.abs(eigenmode.eigenvalue.real);
    // Use minimum frequency for visibility
    eigenmodeData.frequency = Math.max(omega, 0.5);
    
    // Log eigenmode info
    const evStr = eigenmode.eigenvalue.imag !== 0 ?
        `${eigenmode.eigenvalue.imag >= 0 ? '+' : ''}${eigenmode.eigenvalue.imag.toFixed(4)}i` :
        eigenmode.eigenvalue.real.toFixed(4);
    console.log(`Eigenmode animation started: λ = ${evStr}, ω = ${eigenmodeData.frequency.toFixed(4)}, formula = ${eigenmode.formula || 'numerical'}`);
    console.log(`Vertex displacement mode: amplitude = ${eigenmodeData.displacementScale.toFixed(2)} units`);
    
    simulationTime = 0;
    dynamicsRunning = true;
    
    if (startDynamicsBtn) startDynamicsBtn.style.display = 'none';
    if (stopDynamicsBtn) stopDynamicsBtn.style.display = 'block';
    
    runEigenmodeAnimation();
}

/**
 * Compute average distance between connected vertices
 */
function computeAverageVertexDistance() {
    const n = state.vertexMeshes.length;
    if (n < 2) return 10;
    
    let totalDist = 0;
    let count = 0;
    
    for (const edge of state.edgeObjects) {
        const p1 = state.vertexMeshes[edge.from].position;
        const p2 = state.vertexMeshes[edge.to].position;
        totalDist += p1.distanceTo(p2);
        count++;
    }
    
    return count > 0 ? totalDist / count : 10;
}

/**
 * Eigenmode animation loop.
 * x(t) = Re(e^{iωt} · v) = cos(ωt)·vReal - sin(ωt)·vImag
 * 
 * Vertices are displaced along a direction based on their eigenvector component.
 * Edges stretch/compress to follow vertex positions.
 */
function runEigenmodeAnimation() {
    if (!dynamicsRunning || !eigenmodeActive) return;
    
    const speed = dynamicsSpeedInput ? parseInt(dynamicsSpeedInput.value) / 10 : 1;
    const dt = 0.016 * speed;  // Frame time
    
    const n = nodeStates.length;
    const vReal = eigenmodeData.eigenvector.real;
    const vImag = eigenmodeData.eigenvector.imag || new Array(n).fill(0);
    const omega = eigenmodeData.frequency;
    const scale = eigenmodeData.scale;
    const dispScale = eigenmodeData.displacementScale;
    
    // Update phase
    eigenmodePhase += omega * dt;
    simulationTime += dt;
    
    // Compute x(t) = cos(ωt)·vReal - sin(ωt)·vImag
    const cosPhase = Math.cos(eigenmodePhase);
    const sinPhase = Math.sin(eigenmodePhase);
    
    for (let i = 0; i < n; i++) {
        nodeStates[i] = scale * (cosPhase * vReal[i] - sinPhase * vImag[i]);
        // Derivative: dx/dt = -ω·sin(ωt)·vReal - ω·cos(ωt)·vImag
        nodeDerivatives[i] = scale * omega * (-sinPhase * vReal[i] - cosPhase * vImag[i]);
    }
    
    // Update vertex positions (displacement mode)
    updateEigenmodeVertexPositions(dispScale);
    
    // Update edge geometry to follow vertices
    updateEdgeGeometry();
    
    // Update face meshes to follow vertices (for polyhedron surfaces)
    updateFaceMeshes();
    
    // Update vertex colors based on state
    updateEigenmodeVertexColors();
    
    updateEigenmodeDisplay();
    
    if (phaseEnabledCheckbox && phaseEnabledCheckbox.checked) {
        updatePhaseDiagram();
    }
    
    if (dynamicsUpdateCallback) {
        dynamicsUpdateCallback();
    }
    
    dynamicsAnimationId = requestAnimationFrame(runEigenmodeAnimation);
}

/**
 * Update vertex positions based on eigenmode displacement
 * Each vertex moves along a direction determined by its eigenvector component
 */
function updateEigenmodeVertexPositions(dispScale) {
    const n = state.vertexMeshes.length;
    if (!originalVertexPositions || originalVertexPositions.length !== n) return;
    
    for (let i = 0; i < n; i++) {
        const mesh = state.vertexMeshes[i];
        const origPos = originalVertexPositions[i];
        const displacement = nodeStates[i] * dispScale;
        
        // Displacement direction: radial from graph center, or use eigenvector direction
        // For 2D-like graphs, displace perpendicular to the plane
        // For general graphs, displace radially from centroid
        
        // Compute graph centroid
        let cx = 0, cy = 0, cz = 0;
        for (let j = 0; j < n; j++) {
            cx += originalVertexPositions[j].x;
            cy += originalVertexPositions[j].y;
            cz += originalVertexPositions[j].z;
        }
        cx /= n; cy /= n; cz /= n;
        
        // Direction from centroid to this vertex
        let dx = origPos.x - cx;
        let dy = origPos.y - cy;
        let dz = origPos.z - cz;
        const dist = Math.sqrt(dx*dx + dy*dy + dz*dz);
        
        if (dist > 0.01) {
            // Normalize and scale by displacement
            dx /= dist; dy /= dist; dz /= dist;
        } else {
            // Vertex at centroid - displace along Y
            dx = 0; dy = 1; dz = 0;
        }
        
        // Apply displacement
        mesh.position.x = origPos.x + dx * displacement;
        mesh.position.y = origPos.y + dy * displacement;
        mesh.position.z = origPos.z + dz * displacement;
    }
}

/**
 * Update edge geometry to follow current vertex positions
 */
function updateEdgeGeometry() {
    for (const edge of state.edgeObjects) {
        if (!edge.arrow) continue;
        
        const fromMesh = state.vertexMeshes[edge.from];
        const toMesh = state.vertexMeshes[edge.to];
        
        if (!fromMesh || !toMesh) continue;
        
        const fromPos = fromMesh.position;
        const toPos = toMesh.position;
        
        // Compute direction and length
        const dir = new THREE.Vector3().subVectors(toPos, fromPos);
        const length = dir.length();
        
        if (length > 0.01) {
            dir.normalize();
            
            // Update arrow position and direction
            edge.arrow.position.copy(fromPos);
            edge.arrow.setDirection(dir);
            // Thin arrows - length * 0.1 for head length, length * 0.03 for head radius
            edge.arrow.setLength(length * 0.9, length * 0.1, length * 0.03);
            
            // Color based on edge stretch/compression
            const origFromPos = originalVertexPositions[edge.from];
            const origToPos = originalVertexPositions[edge.to];
            const origLength = origFromPos.distanceTo(origToPos);
            const stretchRatio = length / origLength;
            
            // Red = compressed, Blue = stretched, White = neutral
            const color = new THREE.Color();
            if (stretchRatio < 1) {
                // Compressed: white to red
                const t = 1 - stretchRatio;
                color.setRGB(1, 1 - t * 0.7, 1 - t * 0.7);
            } else {
                // Stretched: white to blue
                const t = Math.min(stretchRatio - 1, 1);
                color.setRGB(1 - t * 0.7, 1 - t * 0.7, 1);
            }
            
            edge.arrow.setColor(color);
        }
    }
}

/**
 * Update vertex colors based on eigenmode state
 */
function updateEigenmodeVertexColors() {
    const n = state.vertexMeshes.length;
    
    // Find max amplitude for normalization
    let maxAmp = 0.001;
    for (let i = 0; i < n; i++) {
        if (Math.abs(nodeStates[i]) > maxAmp) maxAmp = Math.abs(nodeStates[i]);
    }
    
    for (let i = 0; i < n; i++) {
        const mesh = state.vertexMeshes[i];
        const amp = nodeStates[i] / maxAmp;  // -1 to +1
        
        // Color: negative (blue) → neutral (white) → positive (red/orange)
        const color = new THREE.Color();
        if (amp < 0) {
            // Blue for negative
            const t = -amp;
            color.setRGB(0.3 + 0.7 * (1 - t), 0.5 + 0.5 * (1 - t), 1.0);
        } else {
            // Orange/red for positive
            const t = amp;
            color.setRGB(1.0, 0.7 - 0.5 * t, 0.3 - 0.2 * t);
        }
        
        mesh.material.color.copy(color);
        mesh.material.emissive.copy(color).multiplyScalar(0.3);
        
        // Scale based on amplitude
        const scaleMultiplier = 1.0 + Math.abs(amp) * 0.3;
        mesh.scale.setScalar(scaleMultiplier);
    }
}

/**
 * Update eigenmode-specific display info
 */
function updateEigenmodeDisplay() {
    if (dynamicsTimeDisplay) {
        dynamicsTimeDisplay.textContent = `t = ${simulationTime.toFixed(3)}`;
    }
    
    // Show eigenmode info
    if (dynamicsEnergyDisplay && eigenmodeData) {
        const periodStr = eigenmodeData.frequency > 0.001 ? 
            `T = ${(2 * Math.PI / eigenmodeData.frequency).toFixed(3)}` : 
            'T = ∞';
        dynamicsEnergyDisplay.textContent = `Mode: ${eigenmodeData.formula || 'λ'} | ${periodStr}`;
    }
    
    // Max amplitude display
    if (dynamicsMaxStateDisplay) {
        let maxState = 0;
        for (let i = 0; i < nodeStates.length; i++) {
            if (Math.abs(nodeStates[i]) > maxState) maxState = Math.abs(nodeStates[i]);
        }
        dynamicsMaxStateDisplay.textContent = `|x|_max = ${maxState.toFixed(4)}`;
    }
}

/**
 * Stop eigenmode animation and restore original vertex positions
 */
export function stopEigenmodeAnimation() {
    // Restore original vertex positions
    if (originalVertexPositions && state.vertexMeshes.length === originalVertexPositions.length) {
        for (let i = 0; i < state.vertexMeshes.length; i++) {
            state.vertexMeshes[i].position.copy(originalVertexPositions[i]);
            // Reset color and scale
            state.vertexMeshes[i].material.color.setHex(0x00ff88);
            state.vertexMeshes[i].material.emissive.setHex(0x004422);
            state.vertexMeshes[i].scale.setScalar(1.0);
        }
        // Update edge geometry to match restored positions
        for (const edge of state.edgeObjects) {
            if (!edge.arrow) continue;
            const fromPos = state.vertexMeshes[edge.from].position;
            const toPos = state.vertexMeshes[edge.to].position;
            const dir = new THREE.Vector3().subVectors(toPos, fromPos);
            const length = dir.length();
            if (length > 0.01) {
                dir.normalize();
                edge.arrow.position.copy(fromPos);
                edge.arrow.setDirection(dir);
                // Thin arrows - length * 0.1 for head length, length * 0.03 for head radius
                edge.arrow.setLength(length * 0.9, length * 0.1, length * 0.03);
                edge.arrow.setColor(new THREE.Color(0x00ffff));  // Reset to cyan
            }
        }
        
        // Update face meshes to match restored positions
        updateFaceMeshes();
    }
    
    originalVertexPositions = null;
    eigenmodeActive = false;
    eigenmodeData = null;
    eigenmodePhase = 0;
    stopDynamics();
}

/**
 * Check if eigenmode animation is active
 */
export function isEigenmodeActive() {
    return eigenmodeActive;
}

/**
 * Get current eigenmode data
 */
export function getEigenmodeData() {
    return eigenmodeData;
}

// =====================================================
// END EIGENMODE ANIMATION
// =====================================================

// Cached rotation matrices
let cayleyMatrix = null;
let cayleyDt = 0;
let rodriguesCache = null;
let rodriguesCacheDt = 0;

// Phase diagram state
let phaseTrail = [];
const PHASE_TRAIL_LENGTH = 500;
const PHASE_SCALE = 2.5;

// Rodrigues optimization buffers
let rodriguesBuffers = null;
let rodriguesBufferSize = 0;

// DOM element references (set via initDynamics)
let integratorSelect, dynamicsSpeedInput, dynamicsSpeedLabel;
let arrowScaleInput, arrowMinLengthInput;
let dynamicsTimeDisplay, dynamicsMaxStateDisplay, dynamicsMaxFlowDisplay, dynamicsEnergyDisplay;
let startDynamicsBtn, stopDynamicsBtn;
let phaseModeSelect, animationModeSelect, phaseNodeISelect, phaseNodeJSelect;
let phaseEnabledCheckbox, phaseCanvas, phaseCtx;
let phaseHint, phaseAxisLabels, phaseXLabel, phaseYLabel, phaseModeHint;
let timestepSelect; // User-selectable integration time step

// =====================================================
// MATRIX HELPER FUNCTIONS
// =====================================================

function identityMatrix(n) {
    const I = [];
    for (let i = 0; i < n; i++) {
        I[i] = [];
        for (let j = 0; j < n; j++) {
            I[i][j] = (i === j) ? 1 : 0;
        }
    }
    return I;
}

function scaleMatrix(M, s) {
    const n = M.length;
    const result = [];
    for (let i = 0; i < n; i++) {
        result[i] = [];
        for (let j = 0; j < n; j++) {
            result[i][j] = M[i][j] * s;
        }
    }
    return result;
}

function addMatrices(A, B) {
    const n = A.length;
    const result = [];
    for (let i = 0; i < n; i++) {
        result[i] = [];
        for (let j = 0; j < n; j++) {
            result[i][j] = A[i][j] + B[i][j];
        }
    }
    return result;
}

function multiplyMatrices(A, B) {
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

function multiplyMatrixVector(M, v) {
    const n = M.length;
    const result = [];
    for (let i = 0; i < n; i++) {
        result[i] = 0;
        for (let j = 0; j < n; j++) {
            result[i] += M[i][j] * v[j];
        }
    }
    return result;
}

// =====================================================
// INTEGRATORS
// =====================================================

function ensureRodriguesBuffers(n) {
    if (rodriguesBufferSize !== n) {
        rodriguesBuffers = {
            tA: Array(n).fill(null).map(() => Array(n).fill(0)),
            expA: Array(n).fill(null).map(() => Array(n).fill(0)),
            term: Array(n).fill(null).map(() => Array(n).fill(0)),
            temp: Array(n).fill(null).map(() => Array(n).fill(0))
        };
        rodriguesBufferSize = n;
    }
}

// Rodrigues: Matrix exponential exp(dt*A) using scaling and squaring
// Optimized with pre-allocated buffers and in-place operations
function computeRodriguesMatrix(dt) {
    const n = state.adjacencyMatrix.length;
    if (n === 0) return null;
    
    const A = state.adjacencyMatrix;
    ensureRodriguesBuffers(n);
    const { tA, expA, term, temp } = rodriguesBuffers;
    
    // Compute matrix infinity norm
    let normA = 0;
    for (let i = 0; i < n; i++) {
        let rowSum = 0;
        for (let j = 0; j < n; j++) {
            rowSum += Math.abs(A[i][j]);
        }
        if (rowSum > normA) normA = rowSum;
    }
    
    // Number of squarings needed to make norm small
    const scaledNorm = normA * Math.abs(dt);
    const numSquarings = Math.max(0, Math.ceil(Math.log2(scaledNorm + 1)));
    const scaledDt = dt / (1 << numSquarings);
    
    // Initialize tA = scaledDt * A, expA = I, term = I
    for (let i = 0; i < n; i++) {
        for (let j = 0; j < n; j++) {
            tA[i][j] = scaledDt * A[i][j];
            expA[i][j] = (i === j) ? 1 : 0;
            term[i][j] = (i === j) ? 1 : 0;
        }
    }
    
    // Taylor series with in-place operations (6 terms usually sufficient with scaling)
    const numTerms = 6;
    for (let k = 1; k <= numTerms; k++) {
        const invK = 1.0 / k;
        // temp = term * tA
        for (let i = 0; i < n; i++) {
            for (let j = 0; j < n; j++) {
                let sum = 0;
                for (let m = 0; m < n; m++) {
                    sum += term[i][m] * tA[m][j];
                }
                temp[i][j] = sum * invK;
            }
        }
        // term = temp, expA += term
        for (let i = 0; i < n; i++) {
            for (let j = 0; j < n; j++) {
                term[i][j] = temp[i][j];
                expA[i][j] += term[i][j];
            }
        }
    }
    
    // Square s times in-place: exp(dt*A) = (exp(dt*A/2^s))^(2^s)
    for (let s = 0; s < numSquarings; s++) {
        // temp = expA * expA
        for (let i = 0; i < n; i++) {
            for (let j = 0; j < n; j++) {
                let sum = 0;
                for (let m = 0; m < n; m++) {
                    sum += expA[i][m] * expA[m][j];
                }
                temp[i][j] = sum;
            }
        }
        // expA = temp
        for (let i = 0; i < n; i++) {
            for (let j = 0; j < n; j++) {
                expA[i][j] = temp[i][j];
            }
        }
    }
    
    // Return a copy (caller expects ownership)
    const result = [];
    for (let i = 0; i < n; i++) {
        result[i] = expA[i].slice();
    }
    return result;
}

// Cayley: (I - kA)^(-1) * (I + kA)
function computeCayleyMatrix(dt) {
    const n = state.adjacencyMatrix.length;
    if (n === 0) return null;
    
    const A = state.adjacencyMatrix;
    const k = dt / 2;
    
    // I - kA
    const ImkA = [];
    for (let i = 0; i < n; i++) {
        ImkA[i] = [];
        for (let j = 0; j < n; j++) {
            ImkA[i][j] = (i === j ? 1 : 0) - k * A[i][j];
        }
    }
    
    // I + kA
    const IpkA = [];
    for (let i = 0; i < n; i++) {
        IpkA[i] = [];
        for (let j = 0; j < n; j++) {
            IpkA[i][j] = (i === j ? 1 : 0) + k * A[i][j];
        }
    }
    
    // Invert (I - kA)
    const inv = invertMatrix(ImkA);
    if (!inv) return identityMatrix(n);
    
    // Result = inv * IpkA
    return multiplyMatrices(inv, IpkA);
}

function invertMatrix(M) {
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

function integrateTrapezoidal(dt) {
    const n = nodeStates.length;
    const A = state.adjacencyMatrix;
    const sparseA = getSparseMatrix();
    const useSparse = sparseA && sparseA.isSparse();
    
    // Predictor (Euler): x_pred = x + dt * A * x
    let predictor;
    if (useSparse) {
        predictor = new Float64Array(n);
        const Ax = new Float64Array(n);
        sparseA.computeDerivative(nodeStates, Ax);
        for (let i = 0; i < n; i++) {
            predictor[i] = nodeStates[i] + dt * Ax[i];
        }
    } else {
        predictor = Array(n).fill(0);
        for (let i = 0; i < n; i++) {
            predictor[i] = nodeStates[i];
            for (let j = 0; j < n; j++) {
                predictor[i] += dt * A[i][j] * nodeStates[j];
            }
        }
    }
    
    // Corrector: x_new = x + 0.5 * dt * (A*x + A*x_pred)
    let corrector;
    if (useSparse) {
        corrector = new Float64Array(n);
        const Apred = new Float64Array(n);
        sparseA.computeDerivative(predictor, Apred);
        for (let i = 0; i < n; i++) {
            corrector[i] = nodeStates[i] + 0.5 * dt * (nodeDerivatives[i] + Apred[i]);
        }
    } else {
        corrector = Array(n).fill(0);
        for (let i = 0; i < n; i++) {
            let derivPredictor = 0;
            for (let j = 0; j < n; j++) {
                derivPredictor += A[i][j] * predictor[j];
            }
            corrector[i] = nodeStates[i] + 0.5 * dt * (nodeDerivatives[i] + derivPredictor);
        }
    }
    
    return corrector;
}

// =====================================================
// DYNAMICS CONTROL
// =====================================================

export function initDynamics(elements) {
    // Store DOM references
    integratorSelect = elements.integratorSelect;
    timestepSelect = elements.timestepSelect;
    dynamicsSpeedInput = elements.dynamicsSpeedInput;
    dynamicsSpeedLabel = elements.dynamicsSpeedLabel;
    arrowScaleInput = elements.arrowScaleInput;
    arrowMinLengthInput = elements.arrowMinLengthInput;
    dynamicsTimeDisplay = elements.dynamicsTimeDisplay;
    dynamicsMaxStateDisplay = elements.dynamicsMaxStateDisplay;
    dynamicsMaxFlowDisplay = elements.dynamicsMaxFlowDisplay;
    dynamicsEnergyDisplay = elements.dynamicsEnergyDisplay;
    startDynamicsBtn = elements.startDynamicsBtn;
    stopDynamicsBtn = elements.stopDynamicsBtn;
    phaseModeSelect = elements.phaseModeSelect;
    animationModeSelect = elements.animationModeSelect;
    phaseNodeISelect = elements.phaseNodeISelect;
    phaseNodeJSelect = elements.phaseNodeJSelect;
    phaseEnabledCheckbox = elements.phaseEnabledCheckbox;
    phaseCanvas = elements.phaseCanvas;
    phaseHint = elements.phaseHint;
    phaseAxisLabels = elements.phaseAxisLabels;
    phaseXLabel = elements.phaseXLabel;
    phaseYLabel = elements.phaseYLabel;
    phaseModeHint = elements.phaseModeHint;
    
    if (phaseCanvas) {
        phaseCtx = phaseCanvas.getContext('2d');
    }
}

export function startDynamics() {
    if (dynamicsRunning) return;
    
    const n = state.vertexMeshes.length;
    if (n === 0) return;
    
    // Initialize states with eigenmode-like pattern
    nodeStates = [];
    nodeDerivatives = Array(n).fill(0);
    
    for (let i = 0; i < n; i++) {
        nodeStates.push(Math.sin(2 * Math.PI * i / n + Math.random() * 0.5));
    }
    
    // Normalize
    const norm = Math.sqrt(nodeStates.reduce((s, x) => s + x * x, 0));
    if (norm > 0) {
        nodeStates = nodeStates.map(x => x / norm * 2);
    }
    
    simulationTime = 0;
    dynamicsRunning = true;
    
    // Reset all caches including sparse matrix
    cayleyMatrix = null;
    cayleyDt = 0;
    rodriguesCache = null;
    rodriguesCacheDt = 0;
    invalidateSparseMatrix();
    
    // Build sparse matrix and log mode
    const sparseA = getSparseMatrix();
    if (sparseA) {
        const stats = sparseA.getStats();
        console.log(`Dynamics starting with n=${n}, mode=${stats.isSparse ? 'SPARSE (SpMV)' : 'DENSE'}, ` +
                    `density=${(stats.density * 100).toFixed(1)}%`);
    }
    
    if (startDynamicsBtn) startDynamicsBtn.style.display = 'none';
    if (stopDynamicsBtn) stopDynamicsBtn.style.display = 'block';
    
    runDynamics();
}

export function stopDynamics() {
    dynamicsRunning = false;
    
    // Clear eigenmode state
    eigenmodeActive = false;
    
    if (dynamicsAnimationId) {
        cancelAnimationFrame(dynamicsAnimationId);
        dynamicsAnimationId = null;
    }
    if (startDynamicsBtn) startDynamicsBtn.style.display = 'block';
    if (stopDynamicsBtn) stopDynamicsBtn.style.display = 'none';
}

function runDynamics() {
    if (!dynamicsRunning) return;
    
    const speed = dynamicsSpeedInput ? parseInt(dynamicsSpeedInput.value) / 10 : 1;
    
    // Get user-selected integration timestep
    const baseTimestep = timestepSelect ? parseFloat(timestepSelect.value) : 1e-7;
    
    // Frame time target (how much simulation time per rendered frame)
    const frameTimeTarget = 0.016 * speed;
    
    // Number of integration sub-steps per frame
    // For exact integrators (Rodrigues, Cayley), fewer steps are fine
    // For trapezoidal, more steps improve accuracy
    const integrator = integratorSelect ? integratorSelect.value : 'cayley';
    
    let stepsPerFrame, dt;
    if (integrator === 'trapezoidal') {
        // For trapezoidal, use smaller steps for better accuracy
        dt = baseTimestep * 1000; // Scale to reasonable range
        stepsPerFrame = Math.max(1, Math.round(frameTimeTarget / dt));
    } else {
        // For exact integrators, we can use larger steps
        // but still allow user to control precision
        dt = baseTimestep * 10000; // Scale up for exact methods
        stepsPerFrame = Math.max(1, Math.round(frameTimeTarget / dt));
    }
    
    // Limit max steps to prevent slowdown
    stepsPerFrame = Math.min(stepsPerFrame, 100);
    
    const n = nodeStates.length;
    const A = state.adjacencyMatrix;
    
    // Get sparse matrix and check if we should use sparse operations
    const sparseA = getSparseMatrix();
    const useSparse = sparseA && sparseA.isSparse();
    
    // Convert to Float64Array for sparse operations (only once per dynamics start)
    if (useSparse && !(nodeStates instanceof Float64Array)) {
        nodeStates = Float64Array.from(nodeStates);
        nodeDerivatives = new Float64Array(n);
    }
    
    // Run multiple integration steps per frame
    for (let step = 0; step < stepsPerFrame; step++) {
        // Compute derivatives: dx/dt = A * x
        if (useSparse) {
            // Sparse Matrix-Vector: O(nnz) instead of O(n²)
            sparseA.computeDerivative(nodeStates, nodeDerivatives);
        } else {
            // Dense fallback: O(n²)
            for (let i = 0; i < n; i++) {
                nodeDerivatives[i] = 0;
                for (let j = 0; j < n; j++) {
                    nodeDerivatives[i] += A[i][j] * nodeStates[j];
                }
            }
        }
        
        // Integrate based on method
        if (integrator === 'rodrigues') {
            if (!rodriguesCache || Math.abs(rodriguesCacheDt - dt) > 1e-12) {
                rodriguesCache = computeRodriguesMatrix(dt);
                rodriguesCacheDt = dt;
            }
            if (rodriguesCache) {
                nodeStates = multiplyMatrixVector(rodriguesCache, nodeStates);
            }
        } else if (integrator === 'cayley') {
            if (!cayleyMatrix || Math.abs(cayleyDt - dt) > 1e-12) {
                cayleyMatrix = computeCayleyMatrix(dt);
                cayleyDt = dt;
            }
            if (cayleyMatrix) {
                nodeStates = multiplyMatrixVector(cayleyMatrix, nodeStates);
            }
        } else {
            nodeStates = integrateTrapezoidal(dt);
        }
        
        simulationTime += dt;
    }
    
    updateDynamicsVisuals();
    updateDynamicsDisplay();
    
    if (phaseEnabledCheckbox && phaseEnabledCheckbox.checked) {
        updatePhaseDiagram();
    }
    
    // Call enhanced visualization callback if set
    if (dynamicsUpdateCallback) {
        dynamicsUpdateCallback();
    }
    
    dynamicsAnimationId = requestAnimationFrame(runDynamics);
}

export function resetDynamics() {
    stopDynamics();
    resetDynamicsVisuals();
}

export function invalidateCaches() {
    cayleyMatrix = null;
    cayleyDt = 0;
    rodriguesCache = null;
    rodriguesCacheDt = 0;
    // Also invalidate sparse matrix when graph changes
    invalidateSparseMatrix();
}

export function isDynamicsRunning() {
    return dynamicsRunning;
}

export function getNodeStates() {
    return nodeStates;
}

export function getNodeDerivatives() {
    return nodeDerivatives;
}

// =====================================================
// VISUAL UPDATES
// =====================================================

function updateDynamicsVisuals() {
    const n = state.vertexMeshes.length;
    const animMode = animationModeSelect ? animationModeSelect.value : 'displacement';
    
    // Dynamic scaling based on node count
    // For small graphs (<=5): full size
    // For medium graphs (6-15): scale down gradually
    // For large graphs (>15): compact arrows
    const nodeScaleFactor = n <= 5 ? 1.0 : n <= 15 ? 1.0 - (n - 5) * 0.04 : 0.6;
    
    const baseArrowScale = arrowScaleInput ? parseInt(arrowScaleInput.value) || 30 : 30;
    const arrowScale = baseArrowScale * nodeScaleFactor;
    
    const baseMinLength = arrowMinLengthInput ? parseInt(arrowMinLengthInput.value) || 8 : 8;
    const minLength = Math.max(3, baseMinLength * nodeScaleFactor);
    const maxLength = 40 * nodeScaleFactor;
    
    if (animMode === 'power') {
        // POWER MODE: Visualize true edge-wise energy exchange
        // 
        // Physics: For ẋ = Ax with energy E_i = ½x_i²
        // Node power: P_i = x_i·ẋ_i = Σ_j A_ij·x_i·x_j
        // 
        // Edge power flow: P_ij = A_ij · x_i · x_j
        // This is the power flowing INTO node i FROM node j along edge (i,j)
        // 
        // For skew-symmetric A: P_ij = -P_ji (conservation)
        // - P_ij > 0: energy flows j → i (arrow points j→i)
        // - P_ij < 0: energy flows i → j (arrow points i→j)
        
        const A = state.adjacencyMatrix;
        
        // Neutral color for freeze mode
        const neutralColor = new THREE.Color(0x94A3B8);
        
        // First pass: compute node powers for vertex visualization
        let globalMaxNodePower = 0.001;
        const nodePowers = [];
        for (let i = 0; i < n; i++) {
            const Pi = nodeStates[i] * nodeDerivatives[i];
            nodePowers.push(Pi);
            const absP = Math.abs(Pi);
            if (absP > globalMaxNodePower) globalMaxNodePower = absP;
        }
        
        // Update vertex colors, scale, and power rings
        for (let i = 0; i < n; i++) {
            const Pi = nodePowers[i];
            const absP = Math.abs(Pi);
            const sign = Pi >= 0 ? 1 : -1;
            const normalizedP = absP / globalMaxNodePower;
            
            if (freezeNodesMode) {
                // Freeze mode: neutral gray, no scaling
                state.vertexMeshes[i].material.color.copy(neutralColor);
                state.vertexMeshes[i].material.emissive.copy(neutralColor).multiplyScalar(0.2);
                state.vertexMeshes[i].scale.setScalar(1.0);
                // Hide power ring in freeze mode
                updateVertexPowerRing(state.vertexMeshes[i], 0, neutralColor);
            } else {
                // Normal mode: cyan/coral coloring with power ring
                const color = interpolatePowerColor(sign * normalizedP);
                
                state.vertexMeshes[i].material.color.copy(color);
                state.vertexMeshes[i].material.emissive.copy(color).multiplyScalar(0.25 + normalizedP * 0.25);
                
                // Scale vertex based on power
                const scaleMultiplier = sign > 0 
                    ? 1.0 + normalizedP * 0.5
                    : 1.0 - normalizedP * 0.4;
                
                const currentScale = state.vertexMeshes[i].scale.x;
                const smoothedScale = currentScale + (scaleMultiplier - currentScale) * 0.15;
                state.vertexMeshes[i].scale.setScalar(smoothedScale);
                
                // Update power ring: brightness proportional to |P_i|
                updateVertexPowerRing(state.vertexMeshes[i], normalizedP, color);
            }
        }
        
        // First pass for edges: compute TRUE edge power P_ij = A_ij · x_i · x_j
        const edgePowers = [];
        let globalMaxEdgePower = 0.001;
        
        for (let idx = 0; idx < state.edgeObjects.length; idx++) {
            const edge = state.edgeObjects[idx];
            const i = edge.from;
            const j = edge.to;
            
            // True edge power flow: P_ij = A_ij · x_i · x_j
            const A_ij = A[i][j];
            const x_i = nodeStates[i];
            const x_j = nodeStates[j];
            const P_ij = A_ij * x_i * x_j;
            
            edgePowers.push(P_ij);
            
            const absP = Math.abs(P_ij);
            if (absP > globalMaxEdgePower) globalMaxEdgePower = absP;
        }
        
        // Second pass: update arrows based on true edge power
        for (let idx = 0; idx < state.edgeObjects.length; idx++) {
            const edge = state.edgeObjects[idx];
            if (!edge.arrow) continue;
            
            const i = edge.from;
            const j = edge.to;
            const fromPos = state.vertexMeshes[i].position;
            const toPos = state.vertexMeshes[j].position;
            
            const P_ij = edgePowers[idx];
            const absP = Math.abs(P_ij);
            
            // Normalize by global max for consistent scaling
            const normalizedP = absP / globalMaxEdgePower;
            
            // Arrow color: warm gradient based on power magnitude
            // Low power: cool blue-gray → High power: warm amber
            const color = new THREE.Color();
            color.setRGB(
                0.4 + normalizedP * 0.55,     // R: 0.4 → 0.95
                0.45 + normalizedP * 0.35,    // G: 0.45 → 0.8
                0.6 - normalizedP * 0.35      // B: 0.6 → 0.25
            );
            
            // Length proportional to power magnitude
            const length = minLength + normalizedP * arrowScale;
            const clampedLength = Math.max(minLength, Math.min(length, maxLength));
            
            // Head size proportional to length
            const headLength = Math.max(3, clampedLength * 0.35);
            const headRadius = Math.max(1.5, clampedLength * 0.18);
            
            // Direction based on power flow
            const edgeDir = new THREE.Vector3().subVectors(toPos, fromPos).normalize();
            let arrowDir, arrowStart;
            
            const fromScale = freezeNodesMode ? 1.0 : state.vertexMeshes[i].scale.x;
            const toScale = freezeNodesMode ? 1.0 : state.vertexMeshes[j].scale.x;
            
            if (P_ij > 0) {
                // Power flows j → i
                arrowDir = edgeDir.clone().negate();
                const scaledRadius = VERTEX_RADIUS * toScale + 0.5;
                arrowStart = toPos.clone().add(arrowDir.clone().multiplyScalar(scaledRadius));
            } else {
                // Power flows i → j
                arrowDir = edgeDir;
                const scaledRadius = VERTEX_RADIUS * fromScale + 0.5;
                arrowStart = fromPos.clone().add(edgeDir.clone().multiplyScalar(scaledRadius));
            }
            
            edge.arrow.setColor(color);
            edge.arrow.setDirection(arrowDir);
            edge.arrow.position.copy(arrowStart);
            edge.arrow.setLength(clampedLength, headLength, headRadius * 0.7);
            
            // Set arrow glow proportional to power
            if (edge.arrow.setGlow) {
                edge.arrow.setGlow(normalizedP);
            }
        }
        
    } else {
        // DISPLACEMENT MODE: cyan/magenta based on state value
        
        // Update vertex colors and reset scale
        for (let i = 0; i < n; i++) {
            const value = nodeStates[i];
            const absValue = Math.abs(value);
            
            // Cyan for positive, magenta for negative
            const hue = value >= 0 ? 0.5 : 0.83;
            const saturation = Math.min(absValue, 1.5) / 1.5;
            const lightness = 0.3 + saturation * 0.4;
            
            state.vertexMeshes[i].material.color.setHSL(hue, saturation, lightness);
            state.vertexMeshes[i].material.emissive.setHSL(hue, saturation * 0.5, lightness * 0.3);
            
            // Reset vertex scale smoothly to 1.0 in displacement mode
            const currentScale = state.vertexMeshes[i].scale.x;
            if (Math.abs(currentScale - 1.0) > 0.01) {
                const smoothedScale = currentScale + (1.0 - currentScale) * 0.1;
                state.vertexMeshes[i].scale.setScalar(smoothedScale);
            }
        }
        
        // Update edge arrows based on product xᵢxⱼ
        for (let edgeIdx = 0; edgeIdx < state.edgeObjects.length; edgeIdx++) {
            const edge = state.edgeObjects[edgeIdx];
            if (!edge.arrow) continue;
            
            const i = edge.from, j = edge.to;
            const fromPos = state.vertexMeshes[i].position;
            const toPos = state.vertexMeshes[j].position;
            
            const flowValue = nodeStates[i] * nodeStates[j];
            const magnitude = Math.abs(flowValue);
            const direction = Math.sign(flowValue);
            
            const normalizedMag = Math.min(magnitude, 1.5) / 1.5;
            const color = interpolateYellowBlue(direction * normalizedMag, 0.4 + normalizedMag * 0.6);
            
            const edgeDir = new THREE.Vector3().subVectors(toPos, fromPos).normalize();
            const edgeLength = fromPos.distanceTo(toPos);
            
            const arrowDir = direction >= 0 ? edgeDir.clone() : edgeDir.clone().negate();
            const arrowStart = (direction >= 0 ? fromPos : toPos).clone().add(arrowDir.clone().multiplyScalar(VERTEX_RADIUS + 0.5));
            
            const scaledPart = magnitude * arrowScale;
            const maxLen = edgeLength - 2 * VERTEX_RADIUS - 3;
            const arrowLength = Math.max(minLength * 0.5, Math.min(minLength + scaledPart, maxLen));
            
            const headLength = Math.max(1.5, Math.min(arrowLength * 0.3, 5));
            const headRadius = Math.max(1, Math.min(arrowLength * 0.2, 3));
            
            edge.arrow.setColor(color);
            edge.arrow.setDirection(arrowDir);
            edge.arrow.position.copy(arrowStart);
            edge.arrow.setLength(arrowLength, headLength, headRadius);
        }
    }
}

function updateDynamicsDisplay() {
    const maxState = Math.max(...nodeStates.map(Math.abs));
    
    let maxFlow = 0;
    for (const edge of state.edgeObjects) {
        const flow = Math.abs(nodeStates[edge.from] * nodeStates[edge.to]);
        maxFlow = Math.max(maxFlow, flow);
    }
    
    const energy = nodeStates.reduce((sum, x) => sum + x * x, 0);
    
    if (dynamicsTimeDisplay) dynamicsTimeDisplay.textContent = simulationTime.toFixed(2);
    if (dynamicsMaxStateDisplay) dynamicsMaxStateDisplay.textContent = maxState.toFixed(2);
    if (dynamicsMaxFlowDisplay) dynamicsMaxFlowDisplay.textContent = maxFlow.toFixed(2);
    if (dynamicsEnergyDisplay) dynamicsEnergyDisplay.textContent = energy.toFixed(4);
}

export function resetDynamicsVisuals() {
    const n = state.vertexMeshes.length;
    nodeStates = Array(n).fill(0);
    nodeDerivatives = Array(n).fill(0);
    simulationTime = 0;
    
    // Reset caches
    cayleyMatrix = null;
    rodriguesCache = null;
    
    // Reset vertex colors, scale, AND power rings
    for (let i = 0; i < n; i++) {
        state.vertexMeshes[i].material.color.setHSL(0.5, 0, 0.4);
        state.vertexMeshes[i].material.emissive.setHSL(0.5, 0, 0.1);
        state.vertexMeshes[i].scale.setScalar(1.0); // Reset to base size
        
        // Hide power ring
        const ring = state.vertexMeshes[i].userData.powerRing;
        if (ring && ring.material) {
            ring.material.opacity = 0;
        }
    }
    
    // Reset arrows
    for (const edge of state.edgeObjects) {
        if (edge.arrow) {
            edge.arrow.setColor(new THREE.Color(0.5, 0.5, 0.5));
        }
    }
    
    if (dynamicsTimeDisplay) dynamicsTimeDisplay.textContent = '0.00';
    if (dynamicsMaxStateDisplay) dynamicsMaxStateDisplay.textContent = '0.00';
    if (dynamicsMaxFlowDisplay) dynamicsMaxFlowDisplay.textContent = '0.00';
    if (dynamicsEnergyDisplay) dynamicsEnergyDisplay.textContent = '0.0000';
}

// =====================================================
// PHASE DIAGRAM
// =====================================================

export function updatePhaseNodeSelectors() {
    if (!phaseNodeISelect || !phaseNodeJSelect) return;
    
    const n = state.vertexMeshes.length;
    phaseNodeISelect.innerHTML = '';
    phaseNodeJSelect.innerHTML = '';
    
    for (let i = 0; i < n; i++) {
        phaseNodeISelect.innerHTML += `<option value="${i}">${i}</option>`;
        phaseNodeJSelect.innerHTML += `<option value="${i}">${i}</option>`;
    }
    
    if (n > 1) phaseNodeJSelect.value = '1';
}

export function clearPhaseTrail() {
    phaseTrail = [];
    if (phaseCtx) clearPhaseCanvas();
}

function clearPhaseCanvas() {
    if (!phaseCanvas || !phaseCtx) return;
    const w = phaseCanvas.width, h = phaseCanvas.height;
    phaseCtx.fillStyle = '#0a0a15';
    phaseCtx.fillRect(0, 0, w, h);
    phaseCtx.strokeStyle = '#333';
    phaseCtx.beginPath();
    phaseCtx.moveTo(w/2, 0); phaseCtx.lineTo(w/2, h);
    phaseCtx.moveTo(0, h/2); phaseCtx.lineTo(w, h/2);
    phaseCtx.stroke();
}

function getPhaseScale() {
    if (phaseTrail.length === 0) return PHASE_SCALE;
    
    let maxX = 0, maxY = 0;
    for (const p of phaseTrail) {
        maxX = Math.max(maxX, Math.abs(p.x));
        maxY = Math.max(maxY, Math.abs(p.y));
    }
    
    const scale = Math.max(maxX, maxY, 0.5) * 1.2;
    return Math.max(scale, 0.1);
}

function updatePhaseDiagram() {
    if (!phaseCanvas || !phaseCtx || nodeStates.length === 0) return;
    if (nodeDerivatives.length === 0) return;
    
    const nodeI = parseInt(phaseNodeISelect.value);
    const nodeJ = parseInt(phaseNodeJSelect.value);
    const mode = phaseModeSelect ? phaseModeSelect.value : 'displacement';
    
    if (nodeI >= nodeStates.length || nodeJ >= nodeStates.length) return;
    
    const xi = nodeStates[nodeI];
    const xj = nodeStates[nodeJ];
    const dxi = nodeDerivatives[nodeI];
    const dxj = nodeDerivatives[nodeJ];
    
    // Get adjacency matrix entry for edge power calculation
    const A = state.adjacencyMatrix;
    const A_ij = (A && A[nodeI] && A[nodeI][nodeJ] !== undefined) ? A[nodeI][nodeJ] : 0;
    
    let plotX, plotY;
    
    switch (mode) {
        case 'displacement':
            plotX = xi;
            plotY = xj;
            break;
        case 'velocity':
            plotX = xi;
            plotY = dxj;
            break;
        case 'node-power':
            plotX = xi;
            plotY = xi * dxi;
            break;
        case 'power-power':
            plotX = xi * dxi;
            plotY = xj * dxj;
            break;
        case 'edge-power':
            // True edge power: P_ij = A_ij · x_i · x_j
            plotX = xi;
            plotY = A_ij * xi * xj;
            break;
        default:
            plotX = xi;
            plotY = xj;
    }
    
    phaseTrail.push({ x: plotX, y: plotY, time: simulationTime });
    
    if (phaseTrail.length > PHASE_TRAIL_LENGTH) {
        phaseTrail.shift();
    }
    
    drawPhaseDiagram();
}

function drawPhaseDiagram() {
    if (!phaseCanvas || !phaseCtx) return;
    
    const w = phaseCanvas.width;
    const h = phaseCanvas.height;
    
    clearPhaseCanvas();
    
    if (phaseTrail.length < 2) return;
    
    const mode = phaseModeSelect ? phaseModeSelect.value : 'displacement';
    const scale = (mode === 'displacement') ? PHASE_SCALE : getPhaseScale();
    
    // Draw trail with fading color
    for (let i = 1; i < phaseTrail.length; i++) {
        const p0 = phaseTrail[i - 1];
        const p1 = phaseTrail[i];
        
        const x0 = w/2 + (p0.x / scale) * (w/2);
        const y0 = h/2 - (p0.y / scale) * (h/2);
        const x1 = w/2 + (p1.x / scale) * (w/2);
        const y1 = h/2 - (p1.y / scale) * (h/2);
        
        const alpha = 0.3 + 0.7 * (i / phaseTrail.length);
        
        let hue;
        switch (mode) {
            case 'velocity':
                hue = 120 - (i / phaseTrail.length) * 60;
                break;
            case 'node-power':
                hue = 300 - (i / phaseTrail.length) * 60;
                break;
            case 'power-power':
                hue = 270 - (i / phaseTrail.length) * 90;
                break;
            case 'edge-power':
                hue = 30 + (i / phaseTrail.length) * 30;
                break;
            default:
                hue = 180 - (i / phaseTrail.length) * 60;
        }
        
        phaseCtx.strokeStyle = `hsla(${hue}, 100%, 60%, ${alpha})`;
        phaseCtx.lineWidth = 1 + (i / phaseTrail.length);
        
        phaseCtx.beginPath();
        phaseCtx.moveTo(x0, y0);
        phaseCtx.lineTo(x1, y1);
        phaseCtx.stroke();
    }
    
    // Draw current point
    const current = phaseTrail[phaseTrail.length - 1];
    const cx = w/2 + (current.x / scale) * (w/2);
    const cy = h/2 - (current.y / scale) * (h/2);
    
    phaseCtx.fillStyle = '#fff';
    phaseCtx.beginPath();
    phaseCtx.arc(cx, cy, 4, 0, Math.PI * 2);
    phaseCtx.fill();
    
    phaseCtx.fillStyle = '#888';
    phaseCtx.font = '9px Arial';
    phaseCtx.fillText(`(${current.x.toFixed(2)}, ${current.y.toFixed(2)})`, 5, h - 5);
}

export function updatePhaseLabels() {
    if (!phaseModeSelect || !phaseXLabel || !phaseYLabel) return;
    const mode = phaseModeSelect.value;
    const i = phaseNodeISelect ? phaseNodeISelect.value : '0';
    const j = phaseNodeJSelect ? phaseNodeJSelect.value : '1';
    
    switch (mode) {
        case 'displacement':
            phaseXLabel.textContent = `x${i}`;
            phaseYLabel.textContent = `x${j}`;
            if (phaseModeHint) phaseModeHint.textContent = 'Ellipse shape = phase relationship';
            break;
        case 'velocity':
            phaseXLabel.textContent = `x${i}`;
            phaseYLabel.textContent = `ẋ${j}`;
            if (phaseModeHint) phaseModeHint.textContent = 'Shows velocity vs displacement';
            break;
        case 'node-power':
            phaseXLabel.textContent = `x${i}`;
            phaseYLabel.textContent = `x${i}·ẋ${i}`;
            if (phaseModeHint) phaseModeHint.textContent = 'Power = rate of energy change at node';
            break;
        case 'power-power':
            phaseXLabel.textContent = `x${i}·ẋ${i}`;
            phaseYLabel.textContent = `x${j}·ẋ${j}`;
            if (phaseModeHint) phaseModeHint.textContent = 'Power at node i vs power at node j';
            break;
        case 'edge-power':
            phaseXLabel.textContent = `x${i}`;
            phaseYLabel.textContent = `P${i}${j} = A${i}${j}·x${i}·x${j}`;
            if (phaseModeHint) phaseModeHint.textContent = 'Edge power Pᵢⱼ = Aᵢⱼ·xᵢ·xⱼ';
            break;
    }
}

export function togglePhaseDiagram() {
    if (!phaseCanvas) return;
    const show = phaseEnabledCheckbox ? phaseEnabledCheckbox.checked : false;
    phaseCanvas.style.display = show ? 'block' : 'none';
    if (phaseHint) phaseHint.style.display = show ? 'block' : 'none';
    if (phaseAxisLabels) phaseAxisLabels.style.display = show ? 'block' : 'none';
    if (show) {
        updatePhaseLabels();
        clearPhaseTrail();
    }
}

// Export dynamics state for enhanced visualization
export function getDynamicsState() {
    if (!dynamicsRunning) return null;
    
    // Compute total energy
    let energy = 0;
    for (let i = 0; i < nodeStates.length; i++) {
        energy += nodeStates[i] * nodeStates[i];
    }
    
    return {
        nodeStates: [...nodeStates],
        nodeDerivatives: [...nodeDerivatives],
        simulationTime: simulationTime,
        phaseTrail: [...phaseTrail],
        energy: energy,
        running: dynamicsRunning
    };
}

// Set callback for enhanced visualization updates
export function setDynamicsUpdateCallback(callback) {
    dynamicsUpdateCallback = callback;
}

// Teaching mode: freeze nodes to show only edge exchange
export function setFreezeNodesMode(enabled) {
    freezeNodesMode = enabled;
}

export function getFreezeNodesMode() {
    return freezeNodesMode;
}
