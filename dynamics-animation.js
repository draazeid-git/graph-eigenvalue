/**
 * Dynamics Animation Module
 * Handles simulation integration, phase diagrams, and visual updates
 */

import * as THREE from 'three';
import { state, VERTEX_RADIUS, interpolateYellowBlue } from './graph-core.js';

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
    
    // Predictor (Euler)
    const predictor = Array(n).fill(0);
    for (let i = 0; i < n; i++) {
        predictor[i] = nodeStates[i];
        for (let j = 0; j < n; j++) {
            predictor[i] += dt * A[i][j] * nodeStates[j];
        }
    }
    
    // Corrector
    const corrector = Array(n).fill(0);
    for (let i = 0; i < n; i++) {
        let derivPredictor = 0;
        for (let j = 0; j < n; j++) {
            derivPredictor += A[i][j] * predictor[j];
        }
        corrector[i] = nodeStates[i] + 0.5 * dt * (nodeDerivatives[i] + derivPredictor);
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
    
    // Reset caches
    cayleyMatrix = null;
    cayleyDt = 0;
    rodriguesCache = null;
    rodriguesCacheDt = 0;
    
    if (startDynamicsBtn) startDynamicsBtn.style.display = 'none';
    if (stopDynamicsBtn) stopDynamicsBtn.style.display = 'block';
    
    runDynamics();
}

export function stopDynamics() {
    dynamicsRunning = false;
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
    
    // Run multiple integration steps per frame
    for (let step = 0; step < stepsPerFrame; step++) {
        // Compute derivatives: dx/dt = A * x
        for (let i = 0; i < n; i++) {
            nodeDerivatives[i] = 0;
            for (let j = 0; j < n; j++) {
                nodeDerivatives[i] += A[i][j] * nodeStates[j];
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
    
    const arrowScale = arrowScaleInput ? parseInt(arrowScaleInput.value) || 30 : 30;
    const minLength = arrowMinLengthInput ? parseInt(arrowMinLengthInput.value) || 8 : 8;
    const maxLength = 40;
    
    if (animMode === 'power') {
        // POWER MODE: Visualize energy flow through edges
        // For each directed edge i→j, we show the power flow based on
        // the source node's power: P_i = x_i * ẋ_i
        // - When P_i < 0: node i is losing energy → arrow points i→j (forward)
        // - When P_i > 0: node i is gaining energy → arrow points j→i (backward)
        
        // First pass: compute all powers and find global max for node power
        let globalMaxNodePower = 0.001;
        for (let i = 0; i < n; i++) {
            const Pi = Math.abs(nodeStates[i] * nodeDerivatives[i]);
            if (Pi > globalMaxNodePower) globalMaxNodePower = Pi;
        }
        
        // Update vertex colors with globally normalized power
        for (let i = 0; i < n; i++) {
            const Pi = nodeStates[i] * nodeDerivatives[i];
            const absP = Math.abs(Pi);
            const sign = Pi >= 0 ? 1 : -1;
            const normalizedP = absP / globalMaxNodePower;
            
            // Yellow for gaining energy, blue for losing energy
            const hue = sign > 0 ? 55/360 : 210/360;
            const saturation = Math.min(0.4 + normalizedP * 0.6, 1);
            const lightness = 0.4 + normalizedP * 0.2;
            
            state.vertexMeshes[i].material.color.setHSL(hue, saturation, lightness);
            state.vertexMeshes[i].material.emissive.setHSL(hue, saturation, 0.3 + normalizedP * 0.2);
        }
        
        // First pass for edges: compute all powers and find global max
        const instantPowers = [];
        let globalMaxEdgePower = 0.001;
        
        for (let idx = 0; idx < state.edgeObjects.length; idx++) {
            const edge = state.edgeObjects[idx];
            const i = edge.from;
            const j = edge.to;
            
            const xi = nodeStates[i];
            const dxi = nodeDerivatives[i] || 0;
            
            // Source node power (negative = losing energy = sending)
            const Pi = xi * dxi;
            
            // Use negative of source power: positive means energy flows i→j
            const flowPower = -Pi;
            instantPowers.push(flowPower);
            
            const absP = Math.abs(flowPower);
            if (absP > globalMaxEdgePower) globalMaxEdgePower = absP;
        }
        
        // Second pass: update arrows using global normalization
        for (let idx = 0; idx < state.edgeObjects.length; idx++) {
            const edge = state.edgeObjects[idx];
            if (!edge.arrow) continue;
            
            const i = edge.from;
            const j = edge.to;
            const fromPos = state.vertexMeshes[i].position;
            const toPos = state.vertexMeshes[j].position;
            
            const P = instantPowers[idx];
            const absP = Math.abs(P);
            const sign = P >= 0 ? 1 : -1;
            
            // Normalize by global max for consistent scaling across all edges
            const normalizedP = absP / globalMaxEdgePower;
            
            // Smooth yellow-blue color transition
            const color = interpolateYellowBlue(sign * normalizedP, 0.5 + normalizedP * 0.5);
            
            // Length proportional to power magnitude
            const length = minLength + normalizedP * arrowScale;
            const clampedLength = Math.max(minLength, Math.min(length, maxLength));
            
            // Head size proportional to length
            const headLength = Math.max(2, clampedLength * 0.3);
            const headRadius = Math.max(1, clampedLength * 0.15);
            
            // Direction: positive = from→to, negative = to→from
            const edgeDir = new THREE.Vector3().subVectors(toPos, fromPos).normalize();
            let arrowDir, arrowStart;
            
            if (sign >= 0) {
                arrowDir = edgeDir;
                arrowStart = fromPos.clone().add(edgeDir.clone().multiplyScalar(VERTEX_RADIUS + 0.5));
            } else {
                arrowDir = edgeDir.clone().negate();
                arrowStart = toPos.clone().add(arrowDir.clone().multiplyScalar(VERTEX_RADIUS + 0.5));
            }
            
            edge.arrow.setColor(color);
            edge.arrow.setDirection(arrowDir);
            edge.arrow.position.copy(arrowStart);
            edge.arrow.setLength(clampedLength, headLength, headRadius * 0.7);
        }
        
    } else {
        // DISPLACEMENT MODE: cyan/magenta based on state value
        
        // Update vertex colors
        for (let i = 0; i < n; i++) {
            const value = nodeStates[i];
            const absValue = Math.abs(value);
            
            // Cyan for positive, magenta for negative
            const hue = value >= 0 ? 0.5 : 0.83;
            const saturation = Math.min(absValue, 1.5) / 1.5;
            const lightness = 0.3 + saturation * 0.4;
            
            state.vertexMeshes[i].material.color.setHSL(hue, saturation, lightness);
            state.vertexMeshes[i].material.emissive.setHSL(hue, saturation * 0.5, lightness * 0.3);
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
    
    // Reset vertex colors
    for (let i = 0; i < n; i++) {
        state.vertexMeshes[i].material.color.setHSL(0.5, 0, 0.4);
        state.vertexMeshes[i].material.emissive.setHSL(0.5, 0, 0.1);
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
            plotX = xi;
            plotY = xi * dxj - xj * dxi;
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
            phaseYLabel.textContent = `x${i}ẋ${j} - x${j}ẋ${i}`;
            if (phaseModeHint) phaseModeHint.textContent = 'Power flow along edge i→j';
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
