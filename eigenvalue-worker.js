/**
 * Eigenvalue Computation Web Worker
 * ==================================
 * Offloads heavy matrix computations from the main thread.
 * 
 * Supports:
 * - Full eigenvalue computation (symmetric and skew-symmetric)
 * - Power iteration for spectral radius only (fast, for large graphs)
 * - Transferable ArrayBuffers for efficient data transfer
 */

// Message handler
self.onmessage = function(e) {
    const { type, id, matrix, options } = e.data;
    
    try {
        let result;
        
        switch (type) {
            case 'eigenvalues-symmetric':
                result = computeEigenvaluesNumeric(matrix);
                break;
                
            case 'eigenvalues-skew':
                result = computeSkewSymmetricEigenvalues(matrix);
                break;
                
            case 'eigenvalues-both':
                result = {
                    symmetric: computeEigenvaluesNumeric(matrix),
                    skewSymmetric: computeSkewSymmetricEigenvalues(matrix)
                };
                break;
                
            case 'spectral-radius-only':
                // Fast power iteration - just get largest eigenvalue
                result = computeSpectralRadiusFast(matrix, options?.iterations || 100);
                break;
                
            case 'characteristic-polynomial':
                result = computeCharacteristicPolynomial(matrix);
                break;
                
            default:
                throw new Error(`Unknown computation type: ${type}`);
        }
        
        self.postMessage({ id, success: true, result });
        
    } catch (error) {
        self.postMessage({ id, success: false, error: error.message });
    }
};

// =====================================================
// EIGENVALUE COMPUTATION (Numeric, QR Algorithm)
// =====================================================

/**
 * Compute eigenvalues of a symmetric matrix using QR algorithm
 * @param {number[][]} matrix - Symmetric matrix
 * @returns {number[]} Eigenvalues sorted by absolute value (descending)
 */
function computeEigenvaluesNumeric(matrix) {
    const n = matrix.length;
    if (n === 0) return [];
    if (n === 1) return [matrix[0][0]];
    
    // Deep copy matrix
    let A = matrix.map(row => [...row]);
    
    // Reduce to tridiagonal form using Householder reflections
    A = toTridiagonal(A);
    
    // QR iteration on tridiagonal matrix
    const maxIter = 30 * n;
    const tol = 1e-10;
    
    for (let iter = 0; iter < maxIter; iter++) {
        // Check for convergence (off-diagonal elements near zero)
        let maxOff = 0;
        for (let i = 0; i < n - 1; i++) {
            maxOff = Math.max(maxOff, Math.abs(A[i][i + 1]));
        }
        if (maxOff < tol) break;
        
        // Wilkinson shift for faster convergence
        const d = (A[n-2][n-2] - A[n-1][n-1]) / 2;
        const sign = d >= 0 ? 1 : -1;
        const shift = A[n-1][n-1] - sign * A[n-1][n-2] * A[n-1][n-2] / 
                      (Math.abs(d) + Math.sqrt(d*d + A[n-1][n-2]*A[n-1][n-2]));
        
        // Apply shift
        for (let i = 0; i < n; i++) {
            A[i][i] -= shift;
        }
        
        // QR decomposition and multiplication (implicit for tridiagonal)
        qrStepTridiagonal(A);
        
        // Remove shift
        for (let i = 0; i < n; i++) {
            A[i][i] += shift;
        }
    }
    
    // Extract eigenvalues from diagonal
    const eigenvalues = [];
    for (let i = 0; i < n; i++) {
        eigenvalues.push(A[i][i]);
    }
    
    // Sort by absolute value descending
    eigenvalues.sort((a, b) => Math.abs(b) - Math.abs(a));
    
    return eigenvalues;
}

/**
 * Reduce symmetric matrix to tridiagonal form using Householder reflections
 */
function toTridiagonal(A) {
    const n = A.length;
    
    for (let k = 0; k < n - 2; k++) {
        // Compute Householder vector for column k
        let sigma = 0;
        for (let i = k + 1; i < n; i++) {
            sigma += A[i][k] * A[i][k];
        }
        
        if (sigma < 1e-15) continue;
        
        const alpha = A[k + 1][k] >= 0 ? -Math.sqrt(sigma) : Math.sqrt(sigma);
        const r = Math.sqrt(0.5 * (alpha * alpha - A[k + 1][k] * alpha));
        
        if (Math.abs(r) < 1e-15) continue;
        
        // Householder vector
        const v = new Array(n).fill(0);
        v[k + 1] = (A[k + 1][k] - alpha) / (2 * r);
        for (let i = k + 2; i < n; i++) {
            v[i] = A[i][k] / (2 * r);
        }
        
        // Apply transformation: A = (I - 2vv^T) * A * (I - 2vv^T)
        // First: A = A - 2v(v^T * A)
        const vTA = new Array(n).fill(0);
        for (let j = 0; j < n; j++) {
            for (let i = 0; i < n; i++) {
                vTA[j] += v[i] * A[i][j];
            }
        }
        for (let i = 0; i < n; i++) {
            for (let j = 0; j < n; j++) {
                A[i][j] -= 2 * v[i] * vTA[j];
            }
        }
        
        // Second: A = A - 2(A * v)v^T
        const Av = new Array(n).fill(0);
        for (let i = 0; i < n; i++) {
            for (let j = 0; j < n; j++) {
                Av[i] += A[i][j] * v[j];
            }
        }
        for (let i = 0; i < n; i++) {
            for (let j = 0; j < n; j++) {
                A[i][j] -= 2 * Av[i] * v[j];
            }
        }
    }
    
    // Zero out numerical noise
    for (let i = 0; i < n; i++) {
        for (let j = 0; j < n; j++) {
            if (Math.abs(i - j) > 1) {
                A[i][j] = 0;
            }
        }
    }
    
    return A;
}

/**
 * Single QR step for tridiagonal matrix (implicit, using Givens rotations)
 */
function qrStepTridiagonal(A) {
    const n = A.length;
    
    for (let i = 0; i < n - 1; i++) {
        // Givens rotation to zero A[i+1][i] in R
        const a = A[i][i];
        const b = A[i + 1][i];
        const r = Math.sqrt(a * a + b * b);
        
        if (r < 1e-15) continue;
        
        const c = a / r;
        const s = b / r;
        
        // Apply rotation to rows i and i+1
        for (let j = 0; j < n; j++) {
            const temp1 = c * A[i][j] + s * A[i + 1][j];
            const temp2 = -s * A[i][j] + c * A[i + 1][j];
            A[i][j] = temp1;
            A[i + 1][j] = temp2;
        }
        
        // Apply rotation to columns i and i+1
        for (let j = 0; j < n; j++) {
            const temp1 = c * A[j][i] + s * A[j][i + 1];
            const temp2 = -s * A[j][i] + c * A[j][i + 1];
            A[j][i] = temp1;
            A[j][i + 1] = temp2;
        }
    }
}

// =====================================================
// SKEW-SYMMETRIC EIGENVALUE COMPUTATION
// =====================================================

/**
 * Compute eigenvalues of skew-symmetric matrix
 * For skew-symmetric A, eigenvalues are pure imaginary: ±iλ
 * We compute via A² which has real eigenvalues -λ²
 * 
 * @param {number[][]} matrix - Skew-symmetric matrix (A[i][j] = -A[j][i])
 * @returns {Array<{real: number, imag: number}>} Eigenvalues as complex numbers
 */
function computeSkewSymmetricEigenvalues(matrix) {
    const n = matrix.length;
    if (n === 0) return [];
    
    // Compute A² (which is symmetric negative semi-definite)
    const A2 = new Array(n).fill(null).map(() => new Array(n).fill(0));
    for (let i = 0; i < n; i++) {
        for (let j = 0; j < n; j++) {
            for (let k = 0; k < n; k++) {
                A2[i][j] += matrix[i][k] * matrix[k][j];
            }
        }
    }
    
    // Eigenvalues of A² are -λ² where ±iλ are eigenvalues of A
    // So eigenvalues of -A² are λ² (non-negative)
    const negA2 = A2.map(row => row.map(x => -x));
    const eigenvaluesSquared = computeEigenvaluesNumeric(negA2);
    
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
    
    // Sort by imaginary part descending
    eigenvalues.sort((a, b) => b.imag - a.imag);
    
    return eigenvalues;
}

// =====================================================
// FAST SPECTRAL RADIUS (Power Iteration)
// =====================================================

/**
 * Compute spectral radius using power iteration
 * Much faster than full eigenvalue computation for large matrices
 * O(n² * iterations) vs O(n³) for full computation
 * 
 * @param {number[][]} matrix - Input matrix
 * @param {number} maxIter - Maximum iterations (default 100)
 * @returns {{spectralRadius: number, converged: boolean, iterations: number}}
 */
function computeSpectralRadiusFast(matrix, maxIter = 100) {
    const n = matrix.length;
    if (n === 0) return { spectralRadius: 0, converged: true, iterations: 0 };
    
    // For skew-symmetric matrices, we compute on A² (which has real eigenvalues)
    // and take sqrt of largest
    
    // Check if matrix is skew-symmetric
    let isSkew = true;
    for (let i = 0; i < n && isSkew; i++) {
        for (let j = i; j < n && isSkew; j++) {
            if (Math.abs(matrix[i][j] + matrix[j][i]) > 1e-10) {
                isSkew = false;
            }
        }
    }
    
    let workMatrix = matrix;
    if (isSkew) {
        // Compute A² for skew-symmetric case
        workMatrix = new Array(n).fill(null).map(() => new Array(n).fill(0));
        for (let i = 0; i < n; i++) {
            for (let j = 0; j < n; j++) {
                for (let k = 0; k < n; k++) {
                    workMatrix[i][j] += matrix[i][k] * matrix[k][j];
                }
            }
        }
        // Negate to get positive eigenvalues
        for (let i = 0; i < n; i++) {
            for (let j = 0; j < n; j++) {
                workMatrix[i][j] = -workMatrix[i][j];
            }
        }
    }
    
    // Initialize random vector
    let v = new Array(n);
    for (let i = 0; i < n; i++) {
        v[i] = Math.random() - 0.5;
    }
    
    // Normalize
    let norm = Math.sqrt(v.reduce((s, x) => s + x * x, 0));
    v = v.map(x => x / norm);
    
    let lambda = 0;
    let converged = false;
    let iter = 0;
    const tol = 1e-10;
    
    for (iter = 0; iter < maxIter; iter++) {
        // w = A * v
        const w = new Array(n).fill(0);
        for (let i = 0; i < n; i++) {
            for (let j = 0; j < n; j++) {
                w[i] += workMatrix[i][j] * v[j];
            }
        }
        
        // Compute Rayleigh quotient: λ = v^T * w
        const newLambda = v.reduce((s, vi, i) => s + vi * w[i], 0);
        
        // Check convergence
        if (Math.abs(newLambda - lambda) < tol * Math.max(1, Math.abs(lambda))) {
            converged = true;
            lambda = newLambda;
            break;
        }
        
        lambda = newLambda;
        
        // Normalize w to get new v
        norm = Math.sqrt(w.reduce((s, x) => s + x * x, 0));
        if (norm < 1e-15) {
            // Matrix might be nilpotent or near-zero
            converged = true;
            lambda = 0;
            break;
        }
        v = w.map(x => x / norm);
    }
    
    // For skew-symmetric, we computed on A², so take sqrt
    const spectralRadius = isSkew ? Math.sqrt(Math.max(0, lambda)) : Math.abs(lambda);
    
    return {
        spectralRadius,
        converged,
        iterations: iter + 1
    };
}

// =====================================================
// CHARACTERISTIC POLYNOMIAL
// =====================================================

/**
 * Compute characteristic polynomial using Faddeev-LeVerrier algorithm
 * Returns coefficients [c₀, c₁, ..., cₙ] where det(λI - A) = c₀ + c₁λ + ... + cₙλⁿ
 */
function computeCharacteristicPolynomial(matrix) {
    const n = matrix.length;
    if (n === 0) return [1];
    
    const coeffs = new Array(n + 1).fill(0);
    coeffs[n] = 1;  // Leading coefficient
    
    // M₀ = I, c_n = 1
    let M = matrix.map(row => [...row]);
    
    for (let k = 1; k <= n; k++) {
        // c_{n-k} = -trace(M) / k
        let trace = 0;
        for (let i = 0; i < n; i++) {
            trace += M[i][i];
        }
        coeffs[n - k] = -trace / k;
        
        if (k < n) {
            // M_{k} = A * (M_{k-1} + c_{n-k+1} * I)
            // Add coefficient to diagonal
            for (let i = 0; i < n; i++) {
                M[i][i] += coeffs[n - k + 1];
            }
            
            // Multiply by A
            const newM = new Array(n).fill(null).map(() => new Array(n).fill(0));
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

// Signal that worker is ready
self.postMessage({ type: 'ready' });
