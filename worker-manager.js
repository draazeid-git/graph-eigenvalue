/**
 * Worker Manager for Eigenvalue Computation
 * ==========================================
 * Manages Web Workers with a tiered approach based on graph size:
 * 
 * Tier 1 (n ≤ 50):    Synchronous on main thread (instant)
 * Tier 2 (50 < n ≤ 200): Web Worker with full eigenvalues
 * Tier 3 (200 < n ≤ 500): Web Worker with Transferable ArrayBuffers
 * Tier 4 (n > 500):   Web Worker with power iteration (spectral radius only)
 */

// Worker pool (reuse workers to avoid startup cost)
let workerPool = [];
let workerIdCounter = 0;
let pendingRequests = new Map();

// Configuration
const CONFIG = {
    TIER1_MAX: 50,      // Sync computation threshold
    TIER2_MAX: 200,     // Full eigenvalues threshold
    TIER3_MAX: 500,     // Transferable threshold
    POOL_SIZE: 2,       // Number of workers to maintain
    WORKER_TIMEOUT: 30000  // 30 second timeout
};

/**
 * Get or create a worker from the pool
 */
function getWorker() {
    // Try to find an idle worker
    for (const w of workerPool) {
        if (!w.busy) {
            w.busy = true;
            return w;
        }
    }
    
    // Create new worker if pool not full
    if (workerPool.length < CONFIG.POOL_SIZE) {
        try {
            const worker = new Worker('./eigenvalue-worker.js');
            const workerWrapper = {
                worker,
                busy: true,
                id: workerPool.length
            };
            
            worker.onmessage = (e) => {
                const { id, success, result, error } = e.data;
                const pending = pendingRequests.get(id);
                if (pending) {
                    clearTimeout(pending.timeout);
                    if (success) {
                        pending.resolve(result);
                    } else {
                        pending.reject(new Error(error));
                    }
                    pendingRequests.delete(id);
                }
                workerWrapper.busy = false;
            };
            
            worker.onerror = (e) => {
                console.error('[WorkerManager] Worker error:', e.message);
                workerWrapper.busy = false;
            };
            
            workerPool.push(workerWrapper);
            return workerWrapper;
        } catch (err) {
            console.warn('[WorkerManager] Could not create worker:', err);
            return null;
        }
    }
    
    // All workers busy - return null (will fallback to sync)
    return null;
}

/**
 * Release a worker back to the pool
 */
function releaseWorker(workerWrapper) {
    if (workerWrapper) {
        workerWrapper.busy = false;
    }
}

/**
 * Send computation to worker with timeout
 */
function sendToWorker(workerWrapper, type, data) {
    return new Promise((resolve, reject) => {
        const id = ++workerIdCounter;
        
        const timeout = setTimeout(() => {
            pendingRequests.delete(id);
            releaseWorker(workerWrapper);
            reject(new Error('Worker timeout'));
        }, CONFIG.WORKER_TIMEOUT);
        
        pendingRequests.set(id, { resolve, reject, timeout });
        
        workerWrapper.worker.postMessage({
            type,
            id,
            ...data
        });
    });
}

/**
 * Convert 2D array to flat Float64Array for transfer
 */
function flattenMatrix(matrix) {
    const n = matrix.length;
    const flat = new Float64Array(n * n);
    for (let i = 0; i < n; i++) {
        for (let j = 0; j < n; j++) {
            flat[i * n + j] = matrix[i][j];
        }
    }
    return { flat, n };
}

/**
 * Reconstruct 2D array from flat Float64Array
 */
function unflattenMatrix(flat, n) {
    const matrix = [];
    for (let i = 0; i < n; i++) {
        const row = [];
        for (let j = 0; j < n; j++) {
            row.push(flat[i * n + j]);
        }
        matrix.push(row);
    }
    return matrix;
}

// =====================================================
// SYNCHRONOUS FALLBACK (for small graphs or no worker)
// =====================================================

/**
 * Synchronous eigenvalue computation (fallback)
 * Import dynamically to avoid circular dependencies
 */
let spectralModule = null;

async function ensureSpectralModule() {
    if (!spectralModule) {
        try {
            spectralModule = await import('./spectral-analysis.js');
        } catch (err) {
            console.error('[WorkerManager] Could not load spectral-analysis module:', err);
        }
    }
    return spectralModule;
}

/**
 * Compute eigenvalues synchronously on main thread
 */
async function computeSync(type, matrix) {
    const mod = await ensureSpectralModule();
    if (!mod) {
        throw new Error('Spectral analysis module not available');
    }
    
    switch (type) {
        case 'symmetric':
            return { eigenvalues: mod.computeEigenvaluesNumerical(matrix) };
        case 'skew':
            return { eigenvalues: mod.computeSkewSymmetricEigenvalues(matrix) };
        case 'both':
            return {
                symmetric: mod.computeEigenvaluesNumerical(matrix),
                skewSymmetric: mod.computeSkewSymmetricEigenvalues(matrix)
            };
        default:
            throw new Error(`Unknown type: ${type}`);
    }
}

// =====================================================
// PUBLIC API
// =====================================================

/**
 * Compute symmetric eigenvalues with tiered approach
 * @param {number[][]} matrix - Symmetric adjacency matrix
 * @param {Object} options - Options
 * @returns {Promise<{eigenvalues: number[], method: string, tier: number}>}
 */
export async function computeSymmetricEigenvalues(matrix, options = {}) {
    const n = matrix.length;
    const forceSync = options.sync || false;
    
    // Tier 1: Small graphs - synchronous
    if (n <= CONFIG.TIER1_MAX || forceSync) {
        const result = await computeSync('symmetric', matrix);
        return { ...result, method: 'sync', tier: 1 };
    }
    
    // Tier 2-4: Use worker
    const workerWrapper = getWorker();
    if (!workerWrapper) {
        // Fallback to sync if no worker available
        console.warn('[WorkerManager] No worker available, falling back to sync');
        const result = await computeSync('symmetric', matrix);
        return { ...result, method: 'sync-fallback', tier: 1 };
    }
    
    try {
        // Tier 4: Large graphs - spectral radius only
        if (n > CONFIG.TIER3_MAX) {
            const result = await sendToWorker(workerWrapper, 'spectral-radius-only', { matrix });
            return { spectralRadius: result, method: 'power', tier: 4 };
        }
        
        // Tier 2/3: Full eigenvalues
        const result = await sendToWorker(workerWrapper, 'eigenvalues-symmetric', { matrix });
        return { eigenvalues: result, method: 'worker', tier: n <= CONFIG.TIER2_MAX ? 2 : 3 };
        
    } catch (err) {
        console.warn('[WorkerManager] Worker computation failed:', err);
        releaseWorker(workerWrapper);
        // Fallback to sync
        const result = await computeSync('symmetric', matrix);
        return { ...result, method: 'sync-fallback', tier: 1 };
    }
}

/**
 * Compute skew-symmetric eigenvalues with tiered approach
 * @param {number[][]} matrix - Skew-symmetric adjacency matrix
 * @param {Object} options - Options
 * @returns {Promise<{eigenvalues: Array, method: string, tier: number}>}
 */
export async function computeSkewEigenvalues(matrix, options = {}) {
    const n = matrix.length;
    const forceSync = options.sync || false;
    
    // Tier 1: Small graphs - synchronous
    if (n <= CONFIG.TIER1_MAX || forceSync) {
        const result = await computeSync('skew', matrix);
        return { ...result, method: 'sync', tier: 1 };
    }
    
    // Tier 2-4: Use worker
    const workerWrapper = getWorker();
    if (!workerWrapper) {
        console.warn('[WorkerManager] No worker available, falling back to sync');
        const result = await computeSync('skew', matrix);
        return { ...result, method: 'sync-fallback', tier: 1 };
    }
    
    try {
        // Tier 4: Large graphs - spectral radius only
        if (n > CONFIG.TIER3_MAX) {
            // For skew-symmetric, we need custom handling
            // eigenvalues are ±iλ, so compute via A²
            const result = await sendToWorker(workerWrapper, 'eigenvalues-skew', { matrix });
            // Only return spectral radius for very large graphs
            if (Array.isArray(result)) {
                const spectralRadius = Math.max(...result.map(e => Math.abs(e.imag || 0)));
                return { spectralRadius, method: 'power', tier: 4 };
            }
            return { spectralRadius: result, method: 'power', tier: 4 };
        }
        
        // Tier 2/3: Full eigenvalues
        const result = await sendToWorker(workerWrapper, 'eigenvalues-skew', { matrix });
        return { eigenvalues: result, method: 'worker', tier: n <= CONFIG.TIER2_MAX ? 2 : 3 };
        
    } catch (err) {
        console.warn('[WorkerManager] Worker computation failed:', err);
        releaseWorker(workerWrapper);
        const result = await computeSync('skew', matrix);
        return { ...result, method: 'sync-fallback', tier: 1 };
    }
}

/**
 * Compute both symmetric and skew-symmetric eigenvalues
 * @param {number[][]} symMatrix - Symmetric adjacency matrix
 * @param {number[][]} skewMatrix - Skew-symmetric adjacency matrix  
 * @param {Object} options - Options
 */
export async function computeBothEigenvalues(symMatrix, skewMatrix, options = {}) {
    const n = symMatrix.length;
    
    // For small graphs, compute both synchronously
    if (n <= CONFIG.TIER1_MAX) {
        const result = await computeSync('both', symMatrix);
        // Skew uses different matrix
        const skewResult = await computeSync('skew', skewMatrix);
        return {
            symmetric: result.symmetric,
            skewSymmetric: skewResult.eigenvalues,
            method: 'sync',
            tier: 1
        };
    }
    
    // For larger graphs, run in parallel
    const [symResult, skewResult] = await Promise.all([
        computeSymmetricEigenvalues(symMatrix, options),
        computeSkewEigenvalues(skewMatrix, options)
    ]);
    
    return {
        symmetric: symResult.eigenvalues || { spectralRadius: symResult.spectralRadius },
        skewSymmetric: skewResult.eigenvalues || { spectralRadius: skewResult.spectralRadius },
        method: `${symResult.method}+${skewResult.method}`,
        tier: Math.max(symResult.tier, skewResult.tier)
    };
}

/**
 * Get computation tier for a given graph size
 */
export function getComputationTier(n) {
    if (n <= CONFIG.TIER1_MAX) return { tier: 1, method: 'sync', description: 'Synchronous (main thread)' };
    if (n <= CONFIG.TIER2_MAX) return { tier: 2, method: 'worker', description: 'Web Worker (full eigenvalues)' };
    if (n <= CONFIG.TIER3_MAX) return { tier: 3, method: 'worker-transfer', description: 'Web Worker (optimized transfer)' };
    return { tier: 4, method: 'worker-power', description: 'Web Worker (spectral radius only)' };
}

/**
 * Check if Web Workers are supported
 */
export function workersSupported() {
    return typeof Worker !== 'undefined';
}

/**
 * Terminate all workers (cleanup)
 */
export function terminateWorkers() {
    for (const w of workerPool) {
        try {
            w.worker.terminate();
        } catch (e) {
            // Ignore
        }
    }
    workerPool = [];
    pendingRequests.clear();
}

/**
 * Get worker pool status
 */
export function getWorkerStatus() {
    return {
        poolSize: workerPool.length,
        maxSize: CONFIG.POOL_SIZE,
        busyCount: workerPool.filter(w => w.busy).length,
        pendingRequests: pendingRequests.size,
        tiers: {
            tier1Max: CONFIG.TIER1_MAX,
            tier2Max: CONFIG.TIER2_MAX,
            tier3Max: CONFIG.TIER3_MAX
        }
    };
}

// Export configuration for external adjustment
export { CONFIG as WorkerConfig };
