/**
 * Eigenvalue Worker Manager
 * =========================
 * Manages Web Workers for eigenvalue computation with tiered approach:
 * 
 * - n ≤ 50:    Compute on main thread (instant)
 * - 50 < n ≤ 200:  Use Web Worker with standard postMessage
 * - 200 < n ≤ 500: Use Web Worker with Transferable ArrayBuffer
 * - n > 500:   Use Web Worker with power iteration only
 */

// Worker pool
let workerPool = [];
let workerReady = [];
let pendingRequests = new Map();
let requestIdCounter = 0;
const MAX_WORKERS = 2;  // Typically 2 is enough, matches most dual-core setups

// Thresholds for tiered approach
const THRESHOLDS = {
    MAIN_THREAD_MAX: 50,      // Compute on main thread for n ≤ 50
    STANDARD_TRANSFER_MAX: 200, // Standard postMessage for n ≤ 200
    FULL_EIGEN_MAX: 500,      // Full eigenvalues for n ≤ 500
    // n > 500: power iteration only
};

// Performance tracking
const perfStats = {
    mainThreadCalls: 0,
    workerCalls: 0,
    powerIterationCalls: 0,
    totalMainThreadTime: 0,
    totalWorkerTime: 0,
    averageLatency: 0
};

/**
 * Initialize the worker pool
 * Call this once at app startup
 */
export function initWorkerPool() {
    if (workerPool.length > 0) {
        console.log('[WorkerManager] Pool already initialized');
        return Promise.resolve();
    }
    
    console.log(`[WorkerManager] Initializing pool with ${MAX_WORKERS} workers...`);
    
    const initPromises = [];
    
    for (let i = 0; i < MAX_WORKERS; i++) {
        const promise = new Promise((resolve, reject) => {
            try {
                const worker = new Worker('./eigenvalue-worker.js');
                
                worker.onmessage = (e) => {
                    if (e.data.type === 'ready') {
                        console.log(`[WorkerManager] Worker ${i} ready`);
                        workerReady[i] = true;
                        resolve();
                    } else if (e.data.id !== undefined) {
                        // Response to a computation request
                        handleWorkerResponse(e.data);
                    }
                };
                
                worker.onerror = (error) => {
                    console.error(`[WorkerManager] Worker ${i} error:`, error);
                    workerReady[i] = false;
                };
                
                workerPool[i] = worker;
                workerReady[i] = false;
                
            } catch (err) {
                console.warn(`[WorkerManager] Failed to create worker ${i}:`, err);
                reject(err);
            }
        });
        
        initPromises.push(promise);
    }
    
    return Promise.allSettled(initPromises).then(results => {
        const successful = results.filter(r => r.status === 'fulfilled').length;
        console.log(`[WorkerManager] Pool initialized: ${successful}/${MAX_WORKERS} workers ready`);
        
        if (successful === 0) {
            console.warn('[WorkerManager] No workers available, will use main thread only');
        }
    });
}

/**
 * Terminate all workers
 * Call this on app shutdown
 */
export function terminateWorkers() {
    workerPool.forEach((worker, i) => {
        if (worker) {
            worker.terminate();
            console.log(`[WorkerManager] Worker ${i} terminated`);
        }
    });
    workerPool = [];
    workerReady = [];
    pendingRequests.clear();
}

/**
 * Handle response from worker
 */
function handleWorkerResponse(data) {
    const { id, success, result, error } = data;
    
    const pending = pendingRequests.get(id);
    if (!pending) {
        console.warn(`[WorkerManager] Received response for unknown request ${id}`);
        return;
    }
    
    pendingRequests.delete(id);
    
    // Track timing
    const elapsed = performance.now() - pending.startTime;
    perfStats.workerCalls++;
    perfStats.totalWorkerTime += elapsed;
    perfStats.averageLatency = perfStats.totalWorkerTime / perfStats.workerCalls;
    
    if (success) {
        pending.resolve(result);
    } else {
        pending.reject(new Error(error));
    }
}

/**
 * Get an available worker
 */
function getAvailableWorker() {
    for (let i = 0; i < workerPool.length; i++) {
        if (workerReady[i]) {
            return workerPool[i];
        }
    }
    return null;
}

/**
 * Send computation to worker
 */
function sendToWorker(type, matrix, options = {}) {
    return new Promise((resolve, reject) => {
        const worker = getAvailableWorker();
        
        if (!worker) {
            reject(new Error('No worker available'));
            return;
        }
        
        const id = ++requestIdCounter;
        const n = matrix.length;
        
        pendingRequests.set(id, {
            resolve,
            reject,
            startTime: performance.now(),
            type,
            n
        });
        
        // Decide transfer method based on size
        if (n > THRESHOLDS.STANDARD_TRANSFER_MAX) {
            // Use Transferable ArrayBuffer for large matrices
            const flatMatrix = new Float64Array(n * n);
            for (let i = 0; i < n; i++) {
                for (let j = 0; j < n; j++) {
                    flatMatrix[i * n + j] = matrix[i][j];
                }
            }
            
            worker.postMessage(
                { type, id, matrix: flatMatrix, n, options, isFlat: true },
                [flatMatrix.buffer]  // Transfer ownership
            );
        } else {
            // Standard postMessage with structured clone
            worker.postMessage({ type, id, matrix, options, isFlat: false });
        }
    });
}

// =====================================================
// MAIN THREAD FALLBACK IMPLEMENTATIONS
// =====================================================

/**
 * Simple eigenvalue computation for main thread (small matrices)
 * Uses power iteration for spectral radius + basic QR for full spectrum
 */
function computeEigenvaluesMainThread(matrix) {
    const n = matrix.length;
    if (n === 0) return [];
    if (n === 1) return [matrix[0][0]];
    
    // For very small matrices, use direct methods
    if (n === 2) {
        const a = matrix[0][0], b = matrix[0][1];
        const c = matrix[1][0], d = matrix[1][1];
        const trace = a + d;
        const det = a * d - b * c;
        const disc = trace * trace - 4 * det;
        if (disc >= 0) {
            const sqrtDisc = Math.sqrt(disc);
            return [(trace + sqrtDisc) / 2, (trace - sqrtDisc) / 2];
        } else {
            // Complex eigenvalues - return real parts
            return [trace / 2, trace / 2];
        }
    }
    
    // Use simple power iteration + deflation for small matrices
    return powerIterationWithDeflation(matrix);
}

/**
 * Power iteration with deflation to get all eigenvalues
 */
function powerIterationWithDeflation(A) {
    const n = A.length;
    const eigenvalues = [];
    let matrix = A.map(row => [...row]);
    
    for (let k = 0; k < n; k++) {
        // Find largest eigenvalue of current matrix
        const result = powerIteration(matrix, 50);
        eigenvalues.push(result.eigenvalue);
        
        if (matrix.length <= 1) break;
        
        // Deflate: remove the found eigenvalue
        // A' = A - λ * v * v^T (where v is normalized eigenvector)
        const v = result.eigenvector;
        const lambda = result.eigenvalue;
        
        const newN = matrix.length;
        for (let i = 0; i < newN; i++) {
            for (let j = 0; j < newN; j++) {
                matrix[i][j] -= lambda * v[i] * v[j];
            }
        }
    }
    
    return eigenvalues.sort((a, b) => Math.abs(b) - Math.abs(a));
}

/**
 * Basic power iteration
 */
function powerIteration(matrix, maxIter) {
    const n = matrix.length;
    if (n === 0) return { eigenvalue: 0, eigenvector: [] };
    
    // Random initial vector
    let v = Array(n).fill(0).map(() => Math.random() - 0.5);
    let norm = Math.sqrt(v.reduce((s, x) => s + x * x, 0));
    v = v.map(x => x / norm);
    
    let lambda = 0;
    
    for (let iter = 0; iter < maxIter; iter++) {
        // w = A * v
        const w = Array(n).fill(0);
        for (let i = 0; i < n; i++) {
            for (let j = 0; j < n; j++) {
                w[i] += matrix[i][j] * v[j];
            }
        }
        
        // Rayleigh quotient
        lambda = v.reduce((s, vi, i) => s + vi * w[i], 0);
        
        // Normalize
        norm = Math.sqrt(w.reduce((s, x) => s + x * x, 0));
        if (norm < 1e-15) break;
        v = w.map(x => x / norm);
    }
    
    return { eigenvalue: lambda, eigenvector: v };
}

/**
 * Compute skew-symmetric eigenvalues on main thread
 */
function computeSkewEigenvaluesMainThread(matrix) {
    const n = matrix.length;
    if (n === 0) return [];
    
    // Compute A²
    const A2 = Array(n).fill(null).map(() => Array(n).fill(0));
    for (let i = 0; i < n; i++) {
        for (let j = 0; j < n; j++) {
            for (let k = 0; k < n; k++) {
                A2[i][j] += matrix[i][k] * matrix[k][j];
            }
        }
    }
    
    // Eigenvalues of -A² are λ²
    const negA2 = A2.map(row => row.map(x => -x));
    const eigenvaluesSquared = computeEigenvaluesMainThread(negA2);
    
    // Convert to imaginary eigenvalues
    const eigenvalues = [];
    for (const lambda2 of eigenvaluesSquared) {
        const lambda = Math.sqrt(Math.max(0, lambda2));
        if (lambda > 1e-10) {
            eigenvalues.push({ real: 0, imag: lambda });
            eigenvalues.push({ real: 0, imag: -lambda });
        } else {
            eigenvalues.push({ real: 0, imag: 0 });
        }
    }
    
    eigenvalues.sort((a, b) => b.imag - a.imag);
    return eigenvalues;
}

// =====================================================
// PUBLIC API
// =====================================================

/**
 * Compute symmetric eigenvalues with automatic tiering
 * @param {number[][]} matrix - Symmetric adjacency matrix
 * @returns {Promise<number[]>} Eigenvalues sorted by absolute value
 */
export async function computeEigenvalues(matrix) {
    const n = matrix.length;
    const startTime = performance.now();
    
    // Tier 1: Main thread for small matrices
    if (n <= THRESHOLDS.MAIN_THREAD_MAX) {
        perfStats.mainThreadCalls++;
        const result = computeEigenvaluesMainThread(matrix);
        perfStats.totalMainThreadTime += performance.now() - startTime;
        return result;
    }
    
    // Tier 2-4: Use worker if available
    if (workerPool.length > 0 && getAvailableWorker()) {
        try {
            if (n > THRESHOLDS.FULL_EIGEN_MAX) {
                // Tier 4: Power iteration only for very large matrices
                perfStats.powerIterationCalls++;
                const result = await sendToWorker('spectral-radius-only', matrix);
                return [result.spectralRadius];  // Only return spectral radius
            } else {
                // Tier 2-3: Full eigenvalues
                return await sendToWorker('eigenvalues-symmetric', matrix);
            }
        } catch (err) {
            console.warn('[WorkerManager] Worker failed, falling back to main thread:', err);
        }
    }
    
    // Fallback: main thread
    console.warn(`[WorkerManager] Computing n=${n} on main thread (no worker available)`);
    perfStats.mainThreadCalls++;
    const result = computeEigenvaluesMainThread(matrix);
    perfStats.totalMainThreadTime += performance.now() - startTime;
    return result;
}

/**
 * Compute skew-symmetric eigenvalues with automatic tiering
 * @param {number[][]} matrix - Skew-symmetric adjacency matrix
 * @returns {Promise<Array<{real: number, imag: number}>>} Eigenvalues
 */
export async function computeSkewSymmetricEigenvaluesAsync(matrix) {
    const n = matrix.length;
    const startTime = performance.now();
    
    // Tier 1: Main thread for small matrices
    if (n <= THRESHOLDS.MAIN_THREAD_MAX) {
        perfStats.mainThreadCalls++;
        const result = computeSkewEigenvaluesMainThread(matrix);
        perfStats.totalMainThreadTime += performance.now() - startTime;
        return result;
    }
    
    // Tier 2-4: Use worker if available
    if (workerPool.length > 0 && getAvailableWorker()) {
        try {
            if (n > THRESHOLDS.FULL_EIGEN_MAX) {
                // Tier 4: Power iteration only
                perfStats.powerIterationCalls++;
                const result = await sendToWorker('spectral-radius-only', matrix);
                // Return just spectral radius as imaginary eigenvalue
                const rho = result.spectralRadius;
                return [
                    { real: 0, imag: rho },
                    { real: 0, imag: -rho }
                ];
            } else {
                // Tier 2-3: Full eigenvalues
                return await sendToWorker('eigenvalues-skew', matrix);
            }
        } catch (err) {
            console.warn('[WorkerManager] Worker failed, falling back to main thread:', err);
        }
    }
    
    // Fallback: main thread
    console.warn(`[WorkerManager] Computing skew n=${n} on main thread (no worker available)`);
    perfStats.mainThreadCalls++;
    const result = computeSkewEigenvaluesMainThread(matrix);
    perfStats.totalMainThreadTime += performance.now() - startTime;
    return result;
}

/**
 * Compute both symmetric and skew-symmetric eigenvalues
 * More efficient when you need both
 */
export async function computeBothEigenvalues(symmetricMatrix, skewMatrix) {
    const n = symmetricMatrix.length;
    
    if (n <= THRESHOLDS.MAIN_THREAD_MAX) {
        return {
            symmetric: computeEigenvaluesMainThread(symmetricMatrix),
            skewSymmetric: computeSkewEigenvaluesMainThread(skewMatrix)
        };
    }
    
    // For larger matrices, compute in parallel
    const [symmetric, skewSymmetric] = await Promise.all([
        computeEigenvalues(symmetricMatrix),
        computeSkewSymmetricEigenvaluesAsync(skewMatrix)
    ]);
    
    return { symmetric, skewSymmetric };
}

/**
 * Get performance statistics
 */
export function getPerformanceStats() {
    return {
        ...perfStats,
        workersAvailable: workerPool.filter((_, i) => workerReady[i]).length,
        totalWorkers: workerPool.length,
        pendingRequests: pendingRequests.size
    };
}

/**
 * Check if workers are available
 */
export function workersAvailable() {
    return workerPool.length > 0 && workerReady.some(r => r);
}

/**
 * Get tier info for a given matrix size
 */
export function getTierInfo(n) {
    if (n <= THRESHOLDS.MAIN_THREAD_MAX) {
        return { tier: 1, method: 'main-thread', description: 'Direct computation (instant)' };
    } else if (n <= THRESHOLDS.STANDARD_TRANSFER_MAX) {
        return { tier: 2, method: 'worker-standard', description: 'Web Worker with standard transfer' };
    } else if (n <= THRESHOLDS.FULL_EIGEN_MAX) {
        return { tier: 3, method: 'worker-transferable', description: 'Web Worker with Transferable ArrayBuffer' };
    } else {
        return { tier: 4, method: 'worker-power-iteration', description: 'Web Worker with power iteration only' };
    }
}
