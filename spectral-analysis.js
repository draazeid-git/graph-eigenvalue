/**
 * Spectral Analysis Module
 * ========================
 * Graph type detection, eigenvalue computation, characteristic polynomial
 * 
 * Enhanced with:
 * - Souriau-Frame-Faddeev (SFF) for exact polynomial generation using BigInt
 * - Hybrid pattern detection combining graph-aware denominators with comprehensive forms
 * - Robust closed-form eigenvalue identification
 * 
 * v35: Hybrid SFF + comprehensive pattern matching
 */

import { state } from './graph-core.js';

// =====================================================
// SPECTRAL ENGINE - EXACT ARITHMETIC CORE (SFF)
// =====================================================

/**
 * Exact Engine for matrices with integer entries.
 * Uses BigInt for intermediate calculations to prevent floating-point drift.
 */
export class SpectralEngine {
    /**
     * Computes the characteristic polynomial exactly using Souriau-Frame-Faddeev method.
     * For matrices with {-1, 0, 1} entries (like adjacency and skew-adjacency matrices).
     * 
     * Returns coefficients [c₀, c₁, ..., cₙ] where det(λI - A) = c₀λⁿ + c₁λⁿ⁻¹ + ... + cₙ
     * 
     * @param {number[][]} matrix - Square matrix with integer entries
     * @returns {number[]} Characteristic polynomial coefficients
     */
    static computeExactPolynomial(matrix) {
        const n = matrix.length;
        if (n === 0) return [1];
        
        const coeffs = new Array(n + 1).fill(0n);
        coeffs[0] = 1n;  // Leading coefficient is always 1
        
        // Convert matrix to BigInt for exact integer arithmetic
        let M = matrix.map(row => row.map(val => BigInt(Math.round(val))));
        const A = matrix.map(row => row.map(val => BigInt(Math.round(val))));  // Keep original
        
        for (let k = 1; k <= n; k++) {
            // 1. Calculate trace(M^k)
            let traceM = 0n;
            for (let i = 0; i < n; i++) {
                traceM += M[i][i];
            }
            
            // 2. Newton's identity: c_k = -1/k * (trace(M^k) + c₁*trace(M^(k-1)) + ... + c_(k-1)*trace(M))
            // For SFF, this simplifies to: c_k = -trace(M_k) / k
            coeffs[k] = -traceM / BigInt(k);
            
            if (k < n) {
                // 3. Compute M_{k+1} = A * (M_k + c_k * I)
                const nextM = Array(n).fill(null).map(() => Array(n).fill(0n));
                for (let i = 0; i < n; i++) {
                    for (let j = 0; j < n; j++) {
                        for (let l = 0; l < n; l++) {
                            // (M_k + c_k * I)[l][j]
                            const val = (l === j) ? M[l][j] + coeffs[k] : M[l][j];
                            nextM[i][j] += A[i][l] * val;
                        }
                    }
                }
                M = nextM;
            }
        }
        
        return coeffs.map(c => Number(c));
    }
    
    /**
     * Generate graph-aware denominators for trigonometric pattern detection.
     * Prioritizes denominators that commonly appear in graph eigenvalues.
     * 
     * @param {number} n - Number of vertices in the graph
     * @returns {number[]} Array of denominators to check, sorted by priority
     */
    static getGraphDenominators(n) {
        const denominators = new Set();
        
        // High priority: directly related to graph size
        denominators.add(n);           // Cycle eigenvalues: 2cos(2πk/n)
        denominators.add(n + 1);       // Path eigenvalues: 2cos(kπ/(n+1))
        denominators.add(2 * n);       // Half-angle forms
        denominators.add(n - 1);       // Wheel rim eigenvalues
        
        // Mass-spring system denominators
        // For bipartite graph with n nodes, if half are masses (m = floor(n/2)):
        // Eigenvalues follow 2sin(kπ/(m+1)) or 2sin(kπ/(2m+2)) patterns
        const halfN = Math.floor(n / 2);
        denominators.add(halfN);
        denominators.add(halfN + 1);
        denominators.add(halfN + 2);
        denominators.add(2 * halfN);
        denominators.add(2 * halfN + 1);
        denominators.add(2 * halfN + 2);
        denominators.add(2 * (halfN + 1));  // 2(m+1) for mass-spring chains
        
        // For cantilever-type systems: denominators 2m+1, 2m+2, 2m+3
        for (let m = Math.max(2, halfN - 3); m <= halfN + 3; m++) {
            denominators.add(2 * m + 1);
            denominators.add(2 * m + 2);
            denominators.add(2 * m + 3);
        }
        
        // Mechanism and Pendulum specific denominators
        // For n-bar mechanism: cells = (n-4)/5, try denominators related to cells
        // For n-link pendulum: links = (n-1)/5, try denominators 2*links+1
        if ((n - 4) % 5 === 0) {
            const cells = (n - 4) / 5;
            denominators.add(2 * cells + 3);   // Mechanism pattern
            denominators.add(4 * cells + 2);   // Extended pattern
        }
        if ((n - 1) % 5 === 0) {
            const links = (n - 1) / 5;
            denominators.add(2 * links + 1);   // Pendulum Chebyshev parameter (e.g., 7 for 3-link)
            denominators.add(2 * links + 3);   // Extended pattern
            denominators.add(4 * links + 1);   // Larger pendulums
        }
        
        // Medium priority: common small denominators
        [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 14, 15, 18, 20].forEach(d => denominators.add(d));
        
        // Extended range for larger graphs - go higher to catch mass-spring patterns
        const maxDenom = Math.max(60, n + 10, halfN * 2 + 5);
        for (let d = 2; d <= maxDenom; d++) {
            denominators.add(d);
        }
        
        // Sort with graph-related denominators first
        const graphRelated = [n, n + 1, 2 * n, n - 1, halfN + 1, 2 * halfN + 2].filter(d => d > 1);
        const others = [...denominators].filter(d => !graphRelated.includes(d) && d > 1).sort((a, b) => a - b);
        
        return [...graphRelated, ...others];
    }
    
    /**
     * Identifies if a numerical eigenvalue corresponds to a closed form.
     * Combines graph-aware denominators with comprehensive pattern detection.
     * 
     * @param {number} value - Numerical eigenvalue
     * @param {number} n - Number of vertices (for graph-aware denominators)
     * @param {number} tolerance - Matching tolerance (default 1e-9)
     * @returns {Object} { type, formula, isExact, ... }
     */
    static identifyClosedForm(value, n = 10, tolerance = 1e-9) {
        const absVal = Math.abs(value);
        const sign = value >= 0 ? '' : '-';
        
        // ===== EXACT MATCHES (high confidence) =====
        
        // Zero
        if (absVal < tolerance) {
            return { type: 'zero', formula: '0', isExact: true, value: 0 };
        }
        
        // Integers (up to reasonable range)
        for (let k = 1; k <= 100; k++) {
            if (Math.abs(absVal - k) < tolerance) {
                return { type: 'integer', formula: sign + k, isExact: true, value: value > 0 ? k : -k };
            }
        }
        
        // Simple fractions (p/q where q ≤ 12)
        for (let q = 2; q <= 12; q++) {
            for (let p = 1; p < q; p++) {
                if (SpectralEngine.gcd(p, q) !== 1) continue;  // Skip non-reduced fractions
                if (Math.abs(absVal - p / q) < tolerance) {
                    return { type: 'fraction', formula: `${sign}${p}/${q}`, isExact: true, value: value > 0 ? p/q : -p/q };
                }
            }
        }
        
        // ===== RADICAL FORMS =====
        
        // Simple square roots: √k
        for (let k = 2; k <= 100; k++) {
            const sqrtK = Math.sqrt(k);
            if (Math.abs(absVal - sqrtK) < tolerance) {
                // Check if perfect square (simplify √4 = 2)
                const sqrtInt = Math.round(sqrtK);
                if (Math.abs(sqrtK - sqrtInt) < tolerance) {
                    return { type: 'integer', formula: sign + sqrtInt, isExact: true, value: value > 0 ? sqrtInt : -sqrtInt };
                }
                return { type: 'radical', formula: `${sign}√${k}`, isExact: true, radicand: k };
            }
        }
        
        // Forms: (a ± √b) / c  - covers golden ratio and many graph eigenvalues
        for (let a = 0; a <= 10; a++) {
            for (let b = 1; b <= 50; b++) {
                const sqrtB = Math.sqrt(b);
                for (let c = 1; c <= 4; c++) {
                    // (a + √b) / c
                    const val1 = (a + sqrtB) / c;
                    if (Math.abs(absVal - val1) < tolerance) {
                        const formula = c === 1 ? 
                            (a === 0 ? `${sign}√${b}` : `${sign}(${a}+√${b})`) :
                            (a === 0 ? `${sign}√${b}/${c}` : `${sign}(${a}+√${b})/${c}`);
                        return { type: 'radical_sum', formula, isExact: true, a, b, c, plusMinus: '+' };
                    }
                    
                    // (a - √b) / c (when a > √b)
                    if (a > sqrtB) {
                        const val2 = (a - sqrtB) / c;
                        if (Math.abs(absVal - val2) < tolerance) {
                            const formula = c === 1 ?
                                `${sign}(${a}-√${b})` :
                                `${sign}(${a}-√${b})/${c}`;
                            return { type: 'radical_sum', formula, isExact: true, a, b, c, plusMinus: '-' };
                        }
                    }
                }
            }
        }
        
        // Nested radicals: √(a ± √b)
        for (let a = 1; a <= 15; a++) {
            for (let b = 1; b <= 30; b++) {
                const sqrtB = Math.sqrt(b);
                if (a + sqrtB > 0) {
                    const val1 = Math.sqrt(a + sqrtB);
                    if (Math.abs(absVal - val1) < tolerance) {
                        return { type: 'nested_radical', formula: `${sign}√(${a}+√${b})`, isExact: true, a, b, plusMinus: '+' };
                    }
                }
                if (a - sqrtB > 0) {
                    const val2 = Math.sqrt(a - sqrtB);
                    if (Math.abs(absVal - val2) < tolerance) {
                        return { type: 'nested_radical', formula: `${sign}√(${a}-√${b})`, isExact: true, a, b, plusMinus: '-' };
                    }
                }
            }
        }
        
        // ===== TRIGONOMETRIC FORMS (graph-aware) =====
        
        const denominators = SpectralEngine.getGraphDenominators(n);
        
        for (const m of denominators) {
            if (m < 2) continue;
            
            for (let k = 0; k <= m; k++) {
                const angle = (k * Math.PI) / m;
                
                // 2cos(kπ/m) - Path, Tree eigenvalues
                const cos2 = 2 * Math.cos(angle);
                if (Math.abs(value - cos2) < tolerance) {
                    // Simplify special cases
                    if (k === 0) return { type: 'integer', formula: '2', isExact: true, value: 2 };
                    if (k === m) return { type: 'integer', formula: '-2', isExact: true, value: -2 };
                    if (2 * k === m) return { type: 'zero', formula: '0', isExact: true, value: 0 };
                    return { type: 'trig', func: 'cos', k, m, formula: `2cos(${k}π/${m})`, isExact: true };
                }
                
                // 2sin(kπ/m) - Cycle-related
                const sin2 = 2 * Math.sin(angle);
                if (Math.abs(value - sin2) < tolerance) {
                    if (k === 0 || k === m) return { type: 'zero', formula: '0', isExact: true, value: 0 };
                    if (2 * k === m) return { type: 'integer', formula: '2', isExact: true, value: 2 };
                    return { type: 'trig', func: 'sin', k, m, formula: `2sin(${k}π/${m})`, isExact: true };
                }
                if (Math.abs(value + sin2) < tolerance && k > 0 && k < m) {
                    return { type: 'trig', func: 'sin', k, m, formula: `-2sin(${k}π/${m})`, isExact: true, negative: true };
                }
                
                // cos(kπ/m) and sin(kπ/m) without the factor of 2
                const cosVal = Math.cos(angle);
                const sinVal = Math.sin(angle);
                
                if (Math.abs(absVal - Math.abs(cosVal)) < tolerance && Math.abs(cosVal) > tolerance) {
                    const s = (value > 0) === (cosVal > 0) ? '' : '-';
                    return { type: 'trig', func: 'cos', k, m, formula: `${s}cos(${k}π/${m})`, isExact: true };
                }
                if (Math.abs(absVal - Math.abs(sinVal)) < tolerance && Math.abs(sinVal) > tolerance) {
                    const s = (value > 0) === (sinVal > 0) ? '' : '-';
                    return { type: 'trig', func: 'sin', k, m, formula: `${s}sin(${k}π/${m})`, isExact: true };
                }
                
                // 1 + 2cos(kπ/m) - Wheel graph eigenvalues
                const wheelVal = 1 + 2 * Math.cos(angle);
                if (Math.abs(value - wheelVal) < tolerance) {
                    return { type: 'trig_sum', formula: `1+2cos(${k}π/${m})`, isExact: true, k, m };
                }
                
                // cot(kπ/m) - Less common but can appear
                if (Math.abs(sinVal) > 0.01) {
                    const cotVal = cosVal / sinVal;
                    if (Math.abs(value - cotVal) < tolerance) {
                        return { type: 'trig', func: 'cot', k, m, formula: `cot(${k}π/${m})`, isExact: true };
                    }
                }
            }
        }
        
        // ===== SPECIAL CONSTANTS =====
        
        // Golden ratio φ = (1+√5)/2 ≈ 1.618
        const phi = (1 + Math.sqrt(5)) / 2;
        const psi = (1 - Math.sqrt(5)) / 2;  // ≈ -0.618
        
        if (Math.abs(value - phi) < tolerance) return { type: 'constant', formula: '(1+√5)/2', isExact: true, name: 'φ' };
        if (Math.abs(value - psi) < tolerance) return { type: 'constant', formula: '(1-√5)/2', isExact: true, name: 'ψ' };
        if (Math.abs(value + phi) < tolerance) return { type: 'constant', formula: '-(1+√5)/2', isExact: true, name: '-φ' };
        if (Math.abs(value + psi) < tolerance) return { type: 'constant', formula: '-(1-√5)/2', isExact: true, name: '-ψ' };
        
        // √2, √3, √5 common in regular graphs
        if (Math.abs(absVal - Math.SQRT2) < tolerance) return { type: 'radical', formula: sign + '√2', isExact: true };
        if (Math.abs(absVal - Math.sqrt(3)) < tolerance) return { type: 'radical', formula: sign + '√3', isExact: true };
        if (Math.abs(absVal - Math.sqrt(5)) < tolerance) return { type: 'radical', formula: sign + '√5', isExact: true };
        
        // 1 + √2, 1 + √3, etc. (common in wheel/gear graphs)
        for (let base = 1; base <= 5; base++) {
            for (let rad = 2; rad <= 20; rad++) {
                const sqrtRad = Math.sqrt(rad);
                if (Math.abs(absVal - (base + sqrtRad)) < tolerance) {
                    return { type: 'radical_sum', formula: `${sign}(${base}+√${rad})`, isExact: true };
                }
                if (base > sqrtRad && Math.abs(absVal - (base - sqrtRad)) < tolerance) {
                    return { type: 'radical_sum', formula: `${sign}(${base}-√${rad})`, isExact: true };
                }
            }
        }
        
        // ===== MECHANISM/PENDULUM EIGENVALUE FORMS =====
        // For eigenvalues > 2, try forms like √((a ± √b)/c)
        // These arise from solving quartic factors in λ² via quadratic formula
        
        if (absVal > 2) {
            // Try √((a + √b)/c) forms
            for (let a = 3; a <= 30; a++) {
                for (let b = 1; b <= 100; b++) {
                    const sqrtB = Math.sqrt(b);
                    for (let c = 1; c <= 4; c++) {
                        // √((a + √b)/c)
                        if (a + sqrtB > 0) {
                            const val = Math.sqrt((a + sqrtB) / c);
                            if (Math.abs(absVal - val) < tolerance) {
                                const formula = c === 1 ? 
                                    `${sign}√(${a}+√${b})` :
                                    `${sign}√((${a}+√${b})/${c})`;
                                return { type: 'nested_radical_div', formula, isExact: true, a, b, c, plusMinus: '+' };
                            }
                        }
                        
                        // √((a - √b)/c) when a > √b
                        if (a > sqrtB) {
                            const val = Math.sqrt((a - sqrtB) / c);
                            if (Math.abs(absVal - val) < tolerance) {
                                const formula = c === 1 ?
                                    `${sign}√(${a}-√${b})` :
                                    `${sign}√((${a}-√${b})/${c})`;
                                return { type: 'nested_radical_div', formula, isExact: true, a, b, c, plusMinus: '-' };
                            }
                        }
                    }
                }
            }
            
            // Try 2cosh(kπ/m) forms for large eigenvalues (hyperbolic analog of Chebyshev)
            // 2cosh(x) = e^x + e^{-x}, relates to certain infinite graphs
            for (let m = 2; m <= 20; m++) {
                for (let k = 1; k < m; k++) {
                    const cosh2 = 2 * Math.cosh(k * Math.PI / m);
                    if (Math.abs(absVal - cosh2) < tolerance) {
                        return { type: 'hyperbolic', formula: `${sign}2cosh(${k}π/${m})`, isExact: true, k, m };
                    }
                }
            }
        }
        
        // ===== NO MATCH - ALGEBRAIC (not recognized) =====
        return { 
            type: 'algebraic', 
            formula: value.toFixed(6), 
            isExact: false, 
            value: value,
            note: 'No closed form detected'
        };
    }
    
    /**
     * GCD helper using Euclidean algorithm
     */
    static gcd(a, b) {
        a = Math.abs(Math.round(a));
        b = Math.abs(Math.round(b));
        while (b !== 0) {
            const t = b;
            b = a % b;
            a = t;
        }
        return a;
    }
    
    /**
     * Analyze all eigenvalues for closed forms
     * 
     * @param {number[]} eigenvalues - Array of numerical eigenvalues
     * @param {number} n - Number of vertices for graph-aware detection
     * @param {number} tolerance - Matching tolerance
     * @returns {Object} { allAnalytic, eigenvalues: [{value, multiplicity, form, isExact}] }
     */
    static analyzeSpectrum(eigenvalues, n = null, tolerance = 1e-8) {
        if (!eigenvalues || eigenvalues.length === 0) {
            return { allAnalytic: true, eigenvalues: [] };
        }
        
        n = n || eigenvalues.length;
        
        // Group eigenvalues by value (with tolerance)
        const groups = [];
        for (const ev of eigenvalues) {
            const val = typeof ev === 'number' ? ev : (ev.value ?? ev.imag ?? 0);
            if (val === undefined || isNaN(val)) continue;
            
            let found = false;
            for (const group of groups) {
                if (Math.abs(group.value - val) < tolerance) {
                    group.count++;
                    found = true;
                    break;
                }
            }
            if (!found) {
                groups.push({ value: val, count: 1 });
            }
        }
        
        // Sort by value (descending)
        groups.sort((a, b) => b.value - a.value);
        
        // Analyze each unique eigenvalue
        const results = [];
        let allExact = true;
        
        for (const { value, count } of groups) {
            const detection = SpectralEngine.identifyClosedForm(value, n, tolerance);
            if (!detection.isExact) {
                allExact = false;
            }
            results.push({
                value: value,
                multiplicity: count,
                form: detection.formula,
                isExact: detection.isExact,
                type: detection.type
            });
        }
        
        return { allAnalytic: allExact, eigenvalues: results };
    }
    
    // =========================================================
    // EIGENVECTOR COMPUTATION
    // =========================================================
    
    /**
     * Compute eigenvector for a given eigenvalue using inverse iteration.
     * For skew-symmetric matrices, eigenvalues are purely imaginary (iω),
     * and eigenvectors are complex.
     * 
     * @param {number[][]} A - Matrix (adjacency or skew-adjacency)
     * @param {number} eigenvalue - Target eigenvalue (real for symmetric, imaginary part for skew)
     * @param {boolean} isSkew - If true, eigenvalue is imaginary (input is the imaginary part)
     * @param {number} maxIter - Maximum iterations
     * @returns {Object} { real: number[], imag: number[], eigenvalue, converged }
     */
    static computeEigenvector(A, eigenvalue, isSkew = false, maxIter = 100) {
        const n = A.length;
        if (n === 0) return null;
        
        // For skew-symmetric: eigenvalue is iω, we work with the imaginary part ω
        const omega = isSkew ? eigenvalue : 0;
        const lambda = isSkew ? 0 : eigenvalue;
        
        // Initialize with random vector
        let vReal = new Float64Array(n);
        let vImag = new Float64Array(n);
        for (let i = 0; i < n; i++) {
            vReal[i] = Math.sin(2 * Math.PI * i / n + 0.1);
            vImag[i] = Math.cos(2 * Math.PI * i / n + 0.2);
        }
        
        // Normalize
        let norm = 0;
        for (let i = 0; i < n; i++) {
            norm += vReal[i] * vReal[i] + vImag[i] * vImag[i];
        }
        norm = Math.sqrt(norm);
        for (let i = 0; i < n; i++) {
            vReal[i] /= norm;
            vImag[i] /= norm;
        }
        
        // Power iteration with shift: find eigenvector of (A - λI)
        // For skew-symmetric with eigenvalue iω: (A - iωI)v = 0
        // We iterate: v_{k+1} = A*v_k normalized, checking convergence
        
        const tolerance = 1e-10;
        let converged = false;
        
        for (let iter = 0; iter < maxIter; iter++) {
            // Compute A*v (complex multiplication for skew case)
            const newReal = new Float64Array(n);
            const newImag = new Float64Array(n);
            
            for (let i = 0; i < n; i++) {
                let sumReal = 0, sumImag = 0;
                for (let j = 0; j < n; j++) {
                    // A*v = A*(vReal + i*vImag)
                    sumReal += A[i][j] * vReal[j];
                    sumImag += A[i][j] * vImag[j];
                }
                
                if (isSkew) {
                    // For eigenvalue iω: we want (A - iωI)v ≈ 0
                    // A*v should be close to iω*v = -ω*vImag + iω*vReal
                    // Use A*v + ω*rotate90(v) to enhance eigenspace
                    newReal[i] = sumReal + omega * vImag[i];
                    newImag[i] = sumImag - omega * vReal[i];
                } else {
                    // For real eigenvalue: (A - λI)v ≈ 0
                    newReal[i] = sumReal - lambda * vReal[i];
                    newImag[i] = sumImag - lambda * vImag[i];
                }
            }
            
            // Normalize
            norm = 0;
            for (let i = 0; i < n; i++) {
                norm += newReal[i] * newReal[i] + newImag[i] * newImag[i];
            }
            norm = Math.sqrt(norm);
            
            if (norm < tolerance) {
                // Already in eigenspace
                converged = true;
                break;
            }
            
            // Check convergence (direction change)
            let diff = 0;
            for (let i = 0; i < n; i++) {
                const dr = newReal[i] / norm - vReal[i];
                const di = newImag[i] / norm - vImag[i];
                diff += dr * dr + di * di;
            }
            
            for (let i = 0; i < n; i++) {
                vReal[i] = newReal[i] / norm;
                vImag[i] = newImag[i] / norm;
            }
            
            if (Math.sqrt(diff) < tolerance) {
                converged = true;
                break;
            }
        }
        
        return {
            real: Array.from(vReal),
            imag: Array.from(vImag),
            eigenvalue: isSkew ? { real: 0, imag: omega } : { real: lambda, imag: 0 },
            converged
        };
    }
    
    /**
     * Compute eigenvectors for known graph families using analytical formulas.
     * These are exact and preferred over numerical methods.
     * 
     * @param {string} graphType - Graph type (cycle, path, star, complete, hypercube)
     * @param {number} n - Number of vertices
     * @param {number} k - Mode index (0 to n-1)
     * @param {boolean} forSkew - If true, return eigenvector for skew-adjacency matrix
     * @returns {Object} { real: number[], imag: number[], eigenvalue, formula }
     */
    static computeAnalyticEigenvector(graphType, n, k, forSkew = false) {
        const real = new Array(n).fill(0);
        const imag = new Array(n).fill(0);
        let eigenvalue, formula;
        
        switch (graphType) {
            case 'cycle':
                // Cycle Cₙ: v_k[j] = exp(2πijk/n)
                // Eigenvalue: 2cos(2πk/n) for symmetric, 2i·sin(2πk/n) for skew
                for (let j = 0; j < n; j++) {
                    const theta = 2 * Math.PI * j * k / n;
                    real[j] = Math.cos(theta) / Math.sqrt(n);
                    imag[j] = Math.sin(theta) / Math.sqrt(n);
                }
                if (forSkew) {
                    eigenvalue = { real: 0, imag: 2 * Math.sin(2 * Math.PI * k / n) };
                    formula = `2i·sin(2π·${k}/${n})`;
                } else {
                    eigenvalue = { real: 2 * Math.cos(2 * Math.PI * k / n), imag: 0 };
                    formula = `2cos(2π·${k}/${n})`;
                }
                break;
                
            case 'path':
                // Path Pₙ: v_k[j] = sin(πj(k+1)/(n+1)) (j = 1..n, k = 0..n-1)
                // Eigenvalue: 2cos(π(k+1)/(n+1))
                // Note: eigenvalue index k is 0-based, but formula uses 1-based (k+1)
                const kPath = k + 1;  // Convert to 1-based index
                for (let j = 0; j < n; j++) {
                    real[j] = Math.sin(Math.PI * (j + 1) * kPath / (n + 1));
                }
                // Normalize
                const normP = Math.sqrt(real.reduce((s, x) => s + x * x, 0));
                if (normP > 1e-10) {
                    for (let j = 0; j < n; j++) real[j] /= normP;
                }
                
                eigenvalue = { real: 2 * Math.cos(Math.PI * kPath / (n + 1)), imag: 0 };
                formula = `2cos(π·${kPath}/${n + 1})`;
                break;
                
            case 'star':
                // Star Sₙ: center at index 0, leaves at 1..n-1
                // Eigenvalues: ±√(n-1) (mult 1 each), 0 (mult n-2)
                // Eigenvector for √(n-1): center = √(n-1), leaves = 1 (normalized)
                if (k === 0) {
                    // Positive √(n-1)
                    const sqrtN1 = Math.sqrt(n - 1);
                    real[0] = sqrtN1 / Math.sqrt(n - 1 + (n - 1));
                    for (let j = 1; j < n; j++) {
                        real[j] = 1 / Math.sqrt(n - 1 + (n - 1));
                    }
                    eigenvalue = { real: sqrtN1, imag: 0 };
                    formula = `√${n - 1}`;
                } else if (k === n - 1) {
                    // Negative √(n-1)
                    const sqrtN1 = Math.sqrt(n - 1);
                    real[0] = sqrtN1 / Math.sqrt(n - 1 + (n - 1));
                    for (let j = 1; j < n; j++) {
                        real[j] = -1 / Math.sqrt(n - 1 + (n - 1));
                    }
                    eigenvalue = { real: -sqrtN1, imag: 0 };
                    formula = `-√${n - 1}`;
                } else {
                    // Zero eigenvalue: orthogonal to center, sum of leaves = 0
                    real[0] = 0;
                    real[1] = 1 / Math.sqrt(2);
                    real[k + 1 < n ? k + 1 : 2] = -1 / Math.sqrt(2);
                    eigenvalue = { real: 0, imag: 0 };
                    formula = '0';
                }
                break;
                
            case 'complete':
                // Complete Kₙ: eigenvalues n-1 (mult 1), -1 (mult n-1)
                if (k === 0) {
                    // All-ones eigenvector for n-1
                    for (let j = 0; j < n; j++) real[j] = 1 / Math.sqrt(n);
                    eigenvalue = { real: n - 1, imag: 0 };
                    formula = `${n - 1}`;
                } else {
                    // Orthogonal eigenvector for -1
                    real[0] = 1 / Math.sqrt(2);
                    real[k] = -1 / Math.sqrt(2);
                    eigenvalue = { real: -1, imag: 0 };
                    formula = '-1';
                }
                break;
                
            case 'hypercube':
                // Hypercube Qₐ: eigenvalues d-2j with multiplicity C(d,j)
                // Eigenvectors are tensor products of ±1 vectors
                // For simplicity, use numerical method
                return null;
                
            default:
                return null;
        }
        
        return { real, imag, eigenvalue, formula };
    }
    
    /**
     * Compute all eigenvectors for a matrix
     * Returns array of { eigenvalue, eigenvector: {real, imag}, formula? }
     */
    static computeAllEigenvectors(A, isSkew = false, graphType = null) {
        const n = A.length;
        if (n === 0) return [];
        
        const results = [];
        
        // Try analytical formulas first for known graph types
        if (graphType && ['cycle', 'path', 'star', 'complete'].includes(graphType)) {
            for (let k = 0; k < n; k++) {
                const ev = SpectralEngine.computeAnalyticEigenvector(graphType, n, k, isSkew);
                if (ev) {
                    results.push({
                        eigenvalue: ev.eigenvalue,
                        eigenvector: { real: ev.real, imag: ev.imag },
                        formula: ev.formula,
                        modeIndex: k,
                        isAnalytic: true
                    });
                }
            }
            return results;
        }
        
        // Fall back to numerical computation
        // First get eigenvalues
        const eigenvalues = [];
        if (isSkew) {
            // For skew-symmetric, eigenvalues are ±iω
            // Use characteristic polynomial or direct computation
            for (let i = 0; i < n; i++) {
                // Simplified: assume we have eigenvalues from elsewhere
                eigenvalues.push(i);  // Placeholder
            }
        }
        
        return results;
    }
}

// =====================================================
// POLYNOMIAL FACTORIZATION ENGINE
// =====================================================

/**
 * Symbolic Polynomial Factorization for Characteristic Polynomials
 * 
 * Given exact polynomial coefficients from SFF, this engine attempts to:
 * 1. Find all rational roots (Rational Root Theorem)
 * 2. Factor out linear terms (λ - k)
 * 3. Identify quadratic factors (λ² - k) giving ±√k roots
 * 4. Handle biquadratics (λ⁴ + aλ² + b) via μ = λ² substitution
 * 5. Detect cyclotomic-like factors for trigonometric eigenvalues
 * 
 * Returns symbolic factorization and exact algebraic roots when possible.
 */
export class PolynomialFactorizer {
    
    /**
     * Main entry point: Factor a characteristic polynomial and find exact roots
     * 
     * @param {number[]} coeffs - Polynomial coefficients [c₀, c₁, ..., cₙ] where p(λ) = c₀λⁿ + c₁λⁿ⁻¹ + ... + cₙ
     * @returns {Object} { factors: [], roots: [], factorization: string, allExact: boolean }
     */
    static factorCharacteristicPolynomial(coeffs) {
        if (!coeffs || coeffs.length === 0) {
            return { factors: [], roots: [], factorization: '1', allExact: true };
        }
        
        const n = coeffs.length - 1;  // Degree
        const factors = [];
        const roots = [];
        let remaining = [...coeffs];
        
        // Step 1: Factor out powers of λ (zero eigenvalues)
        const zeroResult = this.factorOutZeros(remaining);
        remaining = zeroResult.remaining;
        if (zeroResult.multiplicity > 0) {
            factors.push({ type: 'power', base: 'λ', exp: zeroResult.multiplicity });
            for (let i = 0; i < zeroResult.multiplicity; i++) {
                roots.push({ value: 0, form: '0', exact: true });
            }
        }
        
        // Step 2: Find integer roots using Rational Root Theorem
        const intResult = this.factorIntegerRoots(remaining);
        remaining = intResult.remaining;
        for (const root of intResult.roots) {
            factors.push({ type: 'linear', root: root.value });
            roots.push(root);
        }
        
        // Step 3: Look for quadratic factors of form (λ² - k)
        const quadResult = this.factorQuadraticRadicals(remaining);
        remaining = quadResult.remaining;
        for (const factor of quadResult.factors) {
            factors.push(factor);
        }
        roots.push(...quadResult.roots);
        
        // Step 4: Check for biquadratic patterns (λ⁴ + aλ² + b)
        const biquadResult = this.factorBiquadratics(remaining);
        remaining = biquadResult.remaining;
        for (const factor of biquadResult.factors) {
            factors.push(factor);
        }
        roots.push(...biquadResult.roots);
        
        // Step 5: Handle remaining polynomial numerically if needed
        if (remaining.length > 1 && !this.isConstant(remaining)) {
            const numRoots = this.findRootsNumerically(remaining);
            for (const val of numRoots) {
                // Try to identify closed form
                const form = SpectralEngine.identifyClosedForm(val, n);
                roots.push({
                    value: val,
                    form: form.isExact ? form.formula : val.toFixed(6),
                    exact: form.isExact
                });
            }
            if (numRoots.length > 0) {
                factors.push({ type: 'remainder', degree: remaining.length - 1, coeffs: remaining });
            }
        }
        
        // Build factorization string
        const factorization = this.buildFactorizationString(factors, coeffs);
        
        // Sort roots by value (descending)
        roots.sort((a, b) => b.value - a.value);
        
        return {
            factors,
            roots,
            factorization,
            allExact: roots.every(r => r.exact),
            originalDegree: n
        };
    }
    
    /**
     * Factor out powers of λ (finds multiplicity of zero as a root)
     */
    static factorOutZeros(coeffs) {
        let multiplicity = 0;
        let idx = coeffs.length - 1;
        
        // Count trailing zeros (constant term, then λ term, etc.)
        while (idx >= 0 && Math.abs(coeffs[idx]) < 1e-10) {
            multiplicity++;
            idx--;
        }
        
        if (multiplicity === 0) {
            return { remaining: coeffs, multiplicity: 0 };
        }
        
        // Remove the zero coefficients
        const remaining = coeffs.slice(0, coeffs.length - multiplicity);
        return { remaining, multiplicity };
    }
    
    /**
     * Find integer roots using Rational Root Theorem
     * For monic polynomials (leading coeff = 1), rational roots must divide the constant term
     */
    static factorIntegerRoots(coeffs) {
        if (coeffs.length <= 1) {
            return { remaining: coeffs, roots: [] };
        }
        
        const roots = [];
        let remaining = [...coeffs];
        
        // Get potential rational roots (divisors of constant term)
        const constantTerm = Math.abs(Math.round(remaining[remaining.length - 1]));
        const candidates = this.getDivisors(Math.max(constantTerm, 1));
        
        // Also try small integers regardless
        const toTry = new Set([...candidates, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
        
        let foundRoot = true;
        while (foundRoot && remaining.length > 1) {
            foundRoot = false;
            
            for (const k of toTry) {
                for (const sign of [1, -1]) {
                    const root = k * sign;
                    if (this.evaluatePolynomial(remaining, root) < 1e-9) {
                        // Found a root! Divide out (λ - root)
                        const quotient = this.syntheticDivision(remaining, root);
                        if (quotient) {
                            roots.push({ value: root, form: String(root), exact: true });
                            remaining = quotient;
                            foundRoot = true;
                            break;
                        }
                    }
                }
                if (foundRoot) break;
            }
        }
        
        return { remaining, roots };
    }
    
    /**
     * Look for quadratic factors of form (λ² - k) giving roots ±√k
     */
    static factorQuadraticRadicals(coeffs) {
        if (coeffs.length < 3) {
            return { remaining: coeffs, factors: [], roots: [] };
        }
        
        const factors = [];
        const roots = [];
        let remaining = [...coeffs];
        
        // Check if polynomial has only even powers (symmetric spectrum)
        const hasOnlyEvenPowers = this.hasOnlyEvenPowers(remaining);
        
        if (hasOnlyEvenPowers && remaining.length >= 3) {
            // Try to factor as polynomial in μ = λ²
            const muCoeffs = this.extractEvenPowerCoeffs(remaining);
            
            // Find integer roots of the μ polynomial (these give λ² = k, so λ = ±√k)
            for (let k = 1; k <= 50; k++) {
                if (Math.abs(this.evaluatePolynomial(muCoeffs, k)) < 1e-9) {
                    // k is a root of p(μ), so λ² - k is a factor
                    const quotient = this.divideByQuadratic(remaining, k);
                    if (quotient) {
                        factors.push({ type: 'quadratic', k, form: `(λ²-${k})` });
                        roots.push({ value: Math.sqrt(k), form: `√${k}`, exact: true });
                        roots.push({ value: -Math.sqrt(k), form: `-√${k}`, exact: true });
                        remaining = quotient;
                    }
                }
            }
        }
        
        return { remaining, factors, roots };
    }
    
    /**
     * Handle biquadratic factors: λ⁴ + aλ² + b
     * Substitute μ = λ² to get μ² + aμ + b = 0
     * Solve: μ = (-a ± √(a² - 4b)) / 2
     * Then λ = ±√μ
     */
    static factorBiquadratics(coeffs) {
        const factors = [];
        const roots = [];
        let remaining = [...coeffs];
        
        // Look for degree-4 factors with only even powers
        if (remaining.length === 5 && this.hasOnlyEvenPowers(remaining)) {
            // Polynomial is: c₀λ⁴ + c₂λ² + c₄ (with c₁ = c₃ = 0)
            const a = remaining[2] / remaining[0];  // Coefficient of λ²
            const b = remaining[4] / remaining[0];  // Constant term
            
            const discriminant = a * a - 4 * b;
            
            if (discriminant >= 0) {
                const sqrtDisc = Math.sqrt(discriminant);
                const mu1 = (-a + sqrtDisc) / 2;
                const mu2 = (-a - sqrtDisc) / 2;
                
                // Check if discriminant is a perfect integer
                const discInt = Math.round(discriminant);
                const isDiscExact = Math.abs(discriminant - discInt) < 1e-9;
                
                if (mu1 > 0) {
                    const lambda = Math.sqrt(mu1);
                    const form = this.formatBiquadraticRoot(a, discInt, isDiscExact, '+');
                    factors.push({ type: 'biquadratic_root', mu: mu1, form: form.factor });
                    roots.push({ value: lambda, form: form.pos, exact: isDiscExact });
                    roots.push({ value: -lambda, form: form.neg, exact: isDiscExact });
                }
                
                if (mu2 > 0 && Math.abs(mu1 - mu2) > 1e-9) {
                    const lambda = Math.sqrt(mu2);
                    const form = this.formatBiquadraticRoot(a, discInt, isDiscExact, '-');
                    factors.push({ type: 'biquadratic_root', mu: mu2, form: form.factor });
                    roots.push({ value: lambda, form: form.pos, exact: isDiscExact });
                    roots.push({ value: -lambda, form: form.neg, exact: isDiscExact });
                }
                
                remaining = [1];  // Fully factored
            }
        }
        
        return { remaining, factors, roots };
    }
    
    /**
     * Format a biquadratic root: √((−a ± √disc)/2)
     */
    static formatBiquadraticRoot(a, disc, isExact, sign) {
        if (!isExact) {
            return { factor: 'biquadratic', pos: '?', neg: '?' };
        }
        
        const aInt = Math.round(-a);
        const sqrtDisc = Math.sqrt(disc);
        const isDiscPerfectSquare = Math.abs(sqrtDisc - Math.round(sqrtDisc)) < 1e-9;
        
        let innerForm;
        if (isDiscPerfectSquare) {
            const sqrtDiscInt = Math.round(sqrtDisc);
            innerForm = sign === '+' ? 
                `(${aInt}+${sqrtDiscInt})/2` : 
                `(${aInt}-${sqrtDiscInt})/2`;
        } else {
            innerForm = sign === '+' ? 
                `(${aInt}+√${disc})/2` : 
                `(${aInt}-√${disc})/2`;
        }
        
        return {
            factor: `λ⁴${a >= 0 ? '+' : ''}${Math.round(a)}λ²${Math.round(a*a/4 - disc/4) >= 0 ? '+' : ''}...`,
            pos: `√(${innerForm})`,
            neg: `-√(${innerForm})`
        };
    }
    
    // ===== UTILITY METHODS =====
    
    /**
     * Evaluate polynomial at a point
     */
    static evaluatePolynomial(coeffs, x) {
        let result = 0;
        let power = 1;
        for (let i = coeffs.length - 1; i >= 0; i--) {
            result += coeffs[i] * power;
            power *= x;
        }
        return Math.abs(result);
    }
    
    /**
     * Synthetic division: divide polynomial by (λ - root)
     */
    static syntheticDivision(coeffs, root) {
        const n = coeffs.length - 1;
        const result = new Array(n).fill(0);
        
        result[0] = coeffs[0];
        for (let i = 1; i < n; i++) {
            result[i] = coeffs[i] + root * result[i - 1];
        }
        
        // Check remainder
        const remainder = coeffs[n] + root * result[n - 1];
        if (Math.abs(remainder) > 1e-9) {
            return null;  // Not an exact division
        }
        
        return result;
    }
    
    /**
     * Divide polynomial by (λ² - k)
     */
    static divideByQuadratic(coeffs, k) {
        const n = coeffs.length - 1;
        if (n < 2) return null;
        
        const result = new Array(n - 1).fill(0);
        result[0] = coeffs[0];
        result[1] = coeffs[1];
        
        for (let i = 2; i < n - 1; i++) {
            result[i] = coeffs[i] + k * result[i - 2];
        }
        
        // Check remainders
        const rem1 = coeffs[n - 1] + k * result[n - 3];
        const rem2 = coeffs[n] + k * result[n - 2];
        
        if (Math.abs(rem1) > 1e-9 || Math.abs(rem2) > 1e-9) {
            return null;
        }
        
        return result;
    }
    
    /**
     * Check if polynomial has only even powers of λ
     */
    static hasOnlyEvenPowers(coeffs) {
        for (let i = 1; i < coeffs.length; i += 2) {
            if (Math.abs(coeffs[i]) > 1e-10) {
                return false;
            }
        }
        return true;
    }
    
    /**
     * Extract coefficients for even powers only (for substitution μ = λ²)
     */
    static extractEvenPowerCoeffs(coeffs) {
        const result = [];
        for (let i = 0; i < coeffs.length; i += 2) {
            result.push(coeffs[i]);
        }
        return result;
    }
    
    /**
     * Get all divisors of n
     */
    static getDivisors(n) {
        const divisors = [];
        for (let i = 1; i <= Math.sqrt(n); i++) {
            if (n % i === 0) {
                divisors.push(i);
                if (i !== n / i) {
                    divisors.push(n / i);
                }
            }
        }
        return divisors.sort((a, b) => a - b);
    }
    
    /**
     * Check if polynomial is effectively constant
     */
    static isConstant(coeffs) {
        return coeffs.length <= 1 || 
               (coeffs.length === 2 && Math.abs(coeffs[0]) < 1e-10);
    }
    
    /**
     * Find roots numerically using companion matrix eigenvalues
     */
    static findRootsNumerically(coeffs) {
        if (coeffs.length <= 1) return [];
        if (coeffs.length === 2) {
            return [-coeffs[1] / coeffs[0]];
        }
        
        // Build companion matrix
        const n = coeffs.length - 1;
        const companion = Array(n).fill(null).map(() => Array(n).fill(0));
        
        // Normalize by leading coefficient
        const lead = coeffs[0];
        for (let i = 0; i < n - 1; i++) {
            companion[i][i + 1] = 1;
        }
        for (let i = 0; i < n; i++) {
            companion[n - 1][i] = -coeffs[n - i] / lead;
        }
        
        // Use power iteration or QR to find eigenvalues (simplified here)
        // For now, return empty - full implementation would use proper eigenvalue algorithm
        return [];
    }
    
    /**
     * Build human-readable factorization string
     */
    static buildFactorizationString(factors, originalCoeffs) {
        if (factors.length === 0) {
            return this.formatPolynomial(originalCoeffs);
        }
        
        const parts = [];
        
        for (const f of factors) {
            switch (f.type) {
                case 'power':
                    parts.push(f.exp === 1 ? 'λ' : `λ${this.superscript(f.exp)}`);
                    break;
                case 'linear':
                    if (f.root === 0) {
                        parts.push('λ');
                    } else if (f.root > 0) {
                        parts.push(`(λ-${f.root})`);
                    } else {
                        parts.push(`(λ+${-f.root})`);
                    }
                    break;
                case 'quadratic':
                    parts.push(`(λ²-${f.k})`);
                    break;
                case 'biquadratic_root':
                    parts.push(f.form);
                    break;
                case 'remainder':
                    parts.push(`[deg-${f.degree} factor]`);
                    break;
            }
        }
        
        return parts.join('');
    }
    
    /**
     * Format polynomial as string
     */
    static formatPolynomial(coeffs) {
        const n = coeffs.length - 1;
        const parts = [];
        
        for (let i = 0; i <= n; i++) {
            const c = coeffs[i];
            if (Math.abs(c) < 1e-10) continue;
            
            const power = n - i;
            let term = '';
            
            if (power === 0) {
                term = c >= 0 ? `+${Math.round(c)}` : `${Math.round(c)}`;
            } else if (power === 1) {
                if (Math.abs(c - 1) < 1e-10) term = '+λ';
                else if (Math.abs(c + 1) < 1e-10) term = '-λ';
                else term = c >= 0 ? `+${Math.round(c)}λ` : `${Math.round(c)}λ`;
            } else {
                const sup = this.superscript(power);
                if (Math.abs(c - 1) < 1e-10) term = `+λ${sup}`;
                else if (Math.abs(c + 1) < 1e-10) term = `-λ${sup}`;
                else term = c >= 0 ? `+${Math.round(c)}λ${sup}` : `${Math.round(c)}λ${sup}`;
            }
            
            parts.push(term);
        }
        
        let result = parts.join('');
        if (result.startsWith('+')) result = result.slice(1);
        return result || '0';
    }
    
    static superscript(n) {
        const supers = '⁰¹²³⁴⁵⁶⁷⁸⁹';
        return String(n).split('').map(d => supers[parseInt(d)] || d).join('');
    }
    
    // =====================================================
    // ENHANCED FACTORIZATION FOR MECHANISM/PENDULUM FAMILIES
    // =====================================================
    
    /**
     * Check if polynomial has only odd powers of λ (skew-symmetric property)
     * Such polynomials arise from skew-symmetric adjacency matrices
     */
    static hasOnlyOddPowers(coeffs) {
        for (let i = 0; i < coeffs.length; i += 2) {
            if (Math.abs(coeffs[i]) > 1e-10) {
                return false;
            }
        }
        return true;
    }
    
    /**
     * Extract coefficients for odd powers only
     * For p(λ) = c₁λⁿ + c₃λⁿ⁻² + ... (only odd powers)
     * Returns coefficients for q(μ) where μ = λ², so p(λ) = λ·q(λ²)
     */
    static extractOddPowerCoeffs(coeffs) {
        const result = [];
        for (let i = 1; i < coeffs.length; i += 2) {
            result.push(coeffs[i]);
        }
        return result;
    }
    
    /**
     * Advanced factorization using μ = λ² substitution
     * This handles polynomials with only even or only odd powers
     * which arise from symmetric/skew-symmetric graph matrices
     * 
     * Method:
     * 1. Factor out λ^k (zeros)
     * 2. Substitute μ = λ² to halve the effective degree
     * 3. Find rational roots of the μ-polynomial
     * 4. Factor μ-polynomial into quadratics using quadratic formula
     * 5. Convert back: each μ-root gives ±√μ as λ-eigenvalues
     * 
     * @param {number[]} coeffs - Polynomial coefficients
     * @returns {Object} Enhanced factorization result
     */
    static factorWithMuSubstitution(coeffs) {
        if (!coeffs || coeffs.length === 0) {
            return { factors: [], roots: [], factorization: '1', allExact: true };
        }
        
        const n = coeffs.length - 1;
        const factors = [];
        const roots = [];
        let remaining = [...coeffs];
        
        // Step 1: Factor out powers of λ (zero eigenvalues)
        const zeroResult = this.factorOutZeros(remaining);
        remaining = zeroResult.remaining;
        if (zeroResult.multiplicity > 0) {
            factors.push({ type: 'power', base: 'λ', exp: zeroResult.multiplicity });
            for (let i = 0; i < zeroResult.multiplicity; i++) {
                roots.push({ value: 0, form: '0', exact: true });
            }
        }
        
        // Step 2: Check if polynomial has only even or only odd powers
        const onlyEven = this.hasOnlyEvenPowers(remaining);
        const onlyOdd = this.hasOnlyOddPowers(remaining);
        
        if (onlyOdd && remaining.length > 1) {
            // Factor out one more λ and convert to even powers
            // p(λ) = λ·q(λ²) where q has only even powers in λ
            factors.push({ type: 'power', base: 'λ', exp: 1 });
            roots.push({ value: 0, form: '0', exact: true });
            remaining = this.extractOddPowerCoeffs(remaining);
        }
        
        if ((onlyEven || onlyOdd) && remaining.length > 1) {
            // Convert to μ-polynomial where μ = λ²
            let muCoeffs = onlyOdd ? remaining : this.extractEvenPowerCoeffs(remaining);
            
            // Apply iterative factorization to the μ-polynomial
            const muResult = this.factorMuPolynomial(muCoeffs);
            
            // Convert μ-roots back to λ-eigenvalues
            for (const muRoot of muResult.roots) {
                if (muRoot.exact) {
                    if (muRoot.value > 0) {
                        const lambdaRoots = this.muRootToLambdaRoots(muRoot);
                        roots.push(...lambdaRoots);
                        factors.push({
                            type: 'mu_factor',
                            muValue: muRoot.value,
                            muForm: muRoot.form,
                            lambdaForm: `(λ²-${muRoot.form})`
                        });
                    } else if (muRoot.value === 0) {
                        // μ = 0 means λ = 0 (already counted)
                    } else {
                        // μ < 0 means complex λ (imaginary)
                        const imag = Math.sqrt(-muRoot.value);
                        roots.push({ value: imag, form: `i√${-muRoot.value}`, exact: true, isImaginary: true });
                        roots.push({ value: -imag, form: `-i√${-muRoot.value}`, exact: true, isImaginary: true });
                    }
                } else {
                    // Non-exact μ root - try pattern matching on √μ
                    if (muRoot.value > 0) {
                        const lambda = Math.sqrt(muRoot.value);
                        const form = SpectralEngine.identifyClosedForm(lambda, n);
                        roots.push({ value: lambda, form: form.isExact ? form.formula : lambda.toFixed(6), exact: form.isExact });
                        roots.push({ value: -lambda, form: form.isExact ? `-${form.formula}` : (-lambda).toFixed(6), exact: form.isExact });
                    }
                }
            }
            
            // Add remaining μ-factors that weren't fully factored
            for (const f of muResult.factors) {
                if (f.type === 'quadratic_in_mu') {
                    factors.push({
                        type: 'quartic_in_lambda',
                        a: f.a,
                        b: f.b,
                        form: f.form
                    });
                }
            }
            
            remaining = muResult.remaining;
        } else {
            // Fall back to standard factorization for mixed-power polynomials
            const intResult = this.factorIntegerRoots(remaining);
            remaining = intResult.remaining;
            for (const root of intResult.roots) {
                factors.push({ type: 'linear', root: root.value });
                roots.push(root);
            }
            
            const quadResult = this.factorQuadraticRadicals(remaining);
            remaining = quadResult.remaining;
            factors.push(...quadResult.factors);
            roots.push(...quadResult.roots);
            
            const biquadResult = this.factorBiquadratics(remaining);
            remaining = biquadResult.remaining;
            factors.push(...biquadResult.factors);
            roots.push(...biquadResult.roots);
        }
        
        // Handle any remaining polynomial numerically
        if (remaining.length > 1 && !this.isConstant(remaining)) {
            const numRoots = this.findRootsNumerically(remaining);
            for (const val of numRoots) {
                const form = SpectralEngine.identifyClosedForm(val, n);
                roots.push({
                    value: val,
                    form: form.isExact ? form.formula : val.toFixed(6),
                    exact: form.isExact
                });
            }
            if (numRoots.length > 0) {
                factors.push({ type: 'remainder', degree: remaining.length - 1, coeffs: remaining });
            }
        }
        
        // Build factorization string
        const factorization = this.buildFactorizationString(factors, coeffs);
        
        // Sort roots by absolute value (descending)
        roots.sort((a, b) => Math.abs(b.value) - Math.abs(a.value));
        
        // Count total roots including multiplicities
        // allExact should be true ONLY if:
        // 1. All found roots are exact
        // 2. We found the right number of roots (matches polynomial degree)
        const totalRootsFound = roots.length;
        const polynomialDegree = n;
        const allRootsExact = roots.every(r => r.exact);
        const allRootsAccountedFor = totalRootsFound === polynomialDegree;
        
        return {
            factors,
            roots,
            factorization,
            allExact: allRootsExact && allRootsAccountedFor,
            originalDegree: polynomialDegree,
            foundRoots: totalRootsFound,
            usedMuSubstitution: onlyEven || onlyOdd
        };
    }
    
    /**
     * Factor a polynomial in μ (where μ = λ²)
     * This is the core of the mechanism/pendulum factorization
     * 
     * Steps:
     * 1. Find rational roots using Rational Root Theorem
     * 2. Factor remaining polynomial into irreducible quadratics
     * 3. Solve quadratics to get closed-form μ values
     */
    static factorMuPolynomial(muCoeffs) {
        const factors = [];
        const roots = [];
        let remaining = [...muCoeffs];
        
        // Step 1: Factor out μ^k (zeros) - these correspond to additional λ = 0
        const zeroResult = this.factorOutZeros(remaining);
        remaining = zeroResult.remaining;
        for (let i = 0; i < zeroResult.multiplicity; i++) {
            roots.push({ value: 0, form: '0', exact: true });
        }
        
        // Step 2: Find rational/integer roots of the μ-polynomial
        const intResult = this.factorIntegerRoots(remaining);
        remaining = intResult.remaining;
        for (const root of intResult.roots) {
            roots.push(root);
        }
        
        // Step 3: Factor remaining into irreducible quadratics
        // For a polynomial of degree 2k, try to find k quadratic factors
        while (remaining.length >= 3) {
            const quadResult = this.findQuadraticFactorInMu(remaining);
            if (quadResult.found) {
                remaining = quadResult.remaining;
                factors.push(quadResult.factor);
                roots.push(...quadResult.roots);
            } else {
                break;
            }
        }
        
        // If degree 2 remains, solve directly
        if (remaining.length === 3) {
            const a = remaining[0];
            const b = remaining[1];
            const c = remaining[2];
            const disc = b * b - 4 * a * c;
            
            if (disc >= 0) {
                const sqrtDisc = Math.sqrt(disc);
                const mu1 = (-b + sqrtDisc) / (2 * a);
                const mu2 = (-b - sqrtDisc) / (2 * a);
                
                const discInt = Math.round(disc);
                const isDiscExact = Math.abs(disc - discInt) < 1e-9;
                const bInt = Math.round(-b / a);
                
                if (isDiscExact) {
                    const sqrtDiscInt = Math.round(sqrtDisc);
                    const isPerfectSquare = Math.abs(sqrtDisc - sqrtDiscInt) < 1e-9;
                    
                    if (isPerfectSquare) {
                        roots.push({ value: mu1, form: `${(bInt + sqrtDiscInt) / 2}`, exact: true });
                        roots.push({ value: mu2, form: `${(bInt - sqrtDiscInt) / 2}`, exact: true });
                    } else {
                        roots.push({ value: mu1, form: `(${bInt}+√${discInt})/2`, exact: true });
                        roots.push({ value: mu2, form: `(${bInt}-√${discInt})/2`, exact: true });
                    }
                    factors.push({
                        type: 'quadratic_in_mu',
                        a: -b / a,
                        b: c / a,
                        form: `(μ²${b >= 0 ? '-' : '+'}${Math.abs(Math.round(b/a))}μ+${Math.round(c/a)})`
                    });
                } else {
                    roots.push({ value: mu1, form: mu1.toFixed(6), exact: false });
                    roots.push({ value: mu2, form: mu2.toFixed(6), exact: false });
                }
                remaining = [1];
            }
        }
        
        return { factors, roots, remaining };
    }
    
    /**
     * Find a quadratic factor of the μ-polynomial
     * Uses the fact that if μ² + pμ + q divides the polynomial,
     * we can find p, q by comparing coefficients
     */
    static findQuadraticFactorInMu(coeffs) {
        if (coeffs.length < 3) {
            return { found: false };
        }
        
        const degree = coeffs.length - 1;
        
        // Try integer values for the sum and product of roots
        // If μ₁ + μ₂ = -p and μ₁·μ₂ = q, then factor is μ² + pμ + q
        for (let p = -30; p <= 30; p++) {
            for (let q = -100; q <= 100; q++) {
                // Try to divide by μ² + pμ + q
                const quotient = this.divideByQuadraticMu(coeffs, p, q);
                if (quotient) {
                    // Found a factor! Solve for roots
                    const disc = p * p - 4 * q;
                    const roots = [];
                    
                    if (disc >= 0) {
                        const sqrtDisc = Math.sqrt(disc);
                        const mu1 = (-p + sqrtDisc) / 2;
                        const mu2 = (-p - sqrtDisc) / 2;
                        
                        const discInt = Math.round(disc);
                        const isDiscExact = Math.abs(disc - discInt) < 1e-9;
                        
                        if (isDiscExact) {
                            const sqrtDiscInt = Math.round(sqrtDisc);
                            const isPerfectSquare = Math.abs(sqrtDisc - sqrtDiscInt) < 1e-9;
                            
                            if (isPerfectSquare) {
                                roots.push({ value: mu1, form: String((-p + sqrtDiscInt) / 2), exact: true });
                                if (Math.abs(mu1 - mu2) > 1e-9) {
                                    roots.push({ value: mu2, form: String((-p - sqrtDiscInt) / 2), exact: true });
                                }
                            } else {
                                roots.push({ value: mu1, form: `(${-p}+√${discInt})/2`, exact: true });
                                if (Math.abs(mu1 - mu2) > 1e-9) {
                                    roots.push({ value: mu2, form: `(${-p}-√${discInt})/2`, exact: true });
                                }
                            }
                        } else {
                            roots.push({ value: mu1, form: mu1.toFixed(6), exact: false });
                            roots.push({ value: mu2, form: mu2.toFixed(6), exact: false });
                        }
                    }
                    
                    return {
                        found: true,
                        remaining: quotient,
                        factor: {
                            type: 'quadratic_in_mu',
                            a: -p,
                            b: q,
                            form: `(μ²${p >= 0 ? '+' : ''}${p}μ+${q})`
                        },
                        roots
                    };
                }
            }
        }
        
        return { found: false };
    }
    
    /**
     * Divide polynomial by (μ² + pμ + q)
     * Returns quotient if exact division, null otherwise
     */
    static divideByQuadraticMu(coeffs, p, q) {
        const n = coeffs.length - 1;
        if (n < 2) return null;
        
        const result = new Array(n - 1).fill(0);
        result[0] = coeffs[0];
        
        if (n >= 2) {
            result[1] = coeffs[1] - p * result[0];
        }
        
        for (let i = 2; i < n - 1; i++) {
            result[i] = coeffs[i] - p * result[i - 1] - q * result[i - 2];
        }
        
        // Check remainders
        const rem1 = coeffs[n - 1] - p * result[n - 3] - q * result[n - 4];
        const rem2 = coeffs[n] - q * result[n - 3];
        
        if (Math.abs(rem1) > 1e-6 || Math.abs(rem2) > 1e-6) {
            return null;
        }
        
        return result;
    }
    
    /**
     * Convert a μ-root to λ-roots
     * If μ = k, then λ = ±√k
     */
    static muRootToLambdaRoots(muRoot) {
        const roots = [];
        
        if (muRoot.value > 0) {
            const lambda = Math.sqrt(muRoot.value);
            
            // Try to simplify the form
            const muVal = muRoot.value;
            const muForm = muRoot.form;
            
            // Check if μ is a perfect square integer
            const sqrtMuVal = Math.sqrt(muVal);
            if (Math.abs(sqrtMuVal - Math.round(sqrtMuVal)) < 1e-9) {
                const intVal = Math.round(sqrtMuVal);
                roots.push({ value: lambda, form: String(intVal), exact: true });
                roots.push({ value: -lambda, form: String(-intVal), exact: true });
            } else if (muRoot.exact) {
                // μ is exact but not a perfect square
                // Form: ±√(muForm)
                roots.push({ value: lambda, form: `√(${muForm})`, exact: true });
                roots.push({ value: -lambda, form: `-√(${muForm})`, exact: true });
            } else {
                roots.push({ value: lambda, form: lambda.toFixed(6), exact: false });
                roots.push({ value: -lambda, form: (-lambda).toFixed(6), exact: false });
            }
        } else if (muRoot.value === 0) {
            roots.push({ value: 0, form: '0', exact: true });
        }
        // Note: negative μ gives imaginary λ, handled elsewhere
        
        return roots;
    }
}

/**
 * High-level function to analyze characteristic polynomial and find exact eigenvalues
 * This combines SFF exact computation with symbolic factorization
 * 
 * @param {number[][]} matrix - Adjacency or skew-adjacency matrix
 * @returns {Object} Analysis result with factorization and roots
 */
export function analyzeCharacteristicPolynomial(matrix) {
    // Step 1: Compute exact characteristic polynomial using SFF
    const coeffs = SpectralEngine.computeExactPolynomial(matrix);
    
    // Step 2: Try enhanced factorization with μ = λ² substitution first
    // This works better for mechanism/pendulum families
    let factorization = PolynomialFactorizer.factorWithMuSubstitution(coeffs);
    
    // If enhanced factorization didn't find all exact roots, try standard factorization
    if (!factorization.allExact) {
        const standardFactor = PolynomialFactorizer.factorCharacteristicPolynomial(coeffs);
        
        // Use whichever found more exact roots
        const enhancedExactCount = factorization.roots.filter(r => r.exact).length;
        const standardExactCount = standardFactor.roots.filter(r => r.exact).length;
        
        if (standardExactCount > enhancedExactCount) {
            factorization = standardFactor;
        }
    }
    
    // Step 3: Build result with all information
    return {
        polynomial: {
            coefficients: coeffs,
            formatted: PolynomialFactorizer.formatPolynomial(coeffs),
            degree: coeffs.length - 1
        },
        factorization: factorization.factorization,
        factors: factorization.factors,
        roots: factorization.roots,
        eigenvalues: factorization.roots.map(r => ({
            value: r.value,
            form: r.form,
            isExact: r.exact
        })),
        allExact: factorization.allExact,
        usedMuSubstitution: factorization.usedMuSubstitution,
        
        // Summary
        summary: {
            degree: coeffs.length - 1,
            numDistinctRoots: factorization.roots.length,
            hasZeroEigenvalue: factorization.roots.some(r => Math.abs(r.value) < 1e-10),
            spectralRadius: Math.max(...factorization.roots.map(r => Math.abs(r.value)))
        }
    };
}

// =====================================================
// SPECTRAL GAP ANALYSIS
// =====================================================

/**
 * Comprehensive Spectral Gap Analysis
 * 
 * The spectral gap measures how "well-connected" a graph is and relates to:
 * - Expansion properties (Cheeger inequality)
 * - Random walk mixing time
 * - Graph robustness and synchronization
 * 
 * Multiple gap definitions are computed for complete analysis.
 */
export class SpectralGapAnalyzer {
    
    /**
     * Compute all spectral gap metrics from eigenvalues
     * 
     * @param {number[]} eigenvalues - Adjacency matrix eigenvalues (sorted descending)
     * @param {number} n - Number of vertices
     * @param {Object} graphInfo - Optional graph type info { type, degree, ... }
     * @returns {Object} Comprehensive gap analysis
     */
    static analyze(eigenvalues, n, graphInfo = null) {
        if (!eigenvalues || eigenvalues.length < 2) {
            return {
                adjacencyGap: 0,
                normalizedGap: 0,
                algebraicConnectivity: null,
                interpretation: 'Insufficient eigenvalues for gap analysis'
            };
        }
        
        // Sort eigenvalues in descending order
        const sorted = [...eigenvalues].sort((a, b) => b - a);
        const λ1 = sorted[0];  // Largest eigenvalue (spectral radius for connected graphs)
        const λ2 = sorted[1];  // Second largest
        const λn = sorted[sorted.length - 1];  // Smallest
        
        // 1. Adjacency Spectral Gap: λ₁ - λ₂
        const adjacencyGap = λ1 - λ2;
        
        // 2. Absolute Spectral Gap: λ₁ - max(|λ₂|, |λₙ|)
        // Important for expansion: gap from largest to second largest in absolute value
        const sortedByAbs = [...eigenvalues].sort((a, b) => Math.abs(b) - Math.abs(a));
        const absoluteGap = Math.abs(sortedByAbs[0]) - Math.abs(sortedByAbs[1]);
        
        // 3. Normalized Gap: (λ₁ - λ₂) / λ₁
        // Useful for comparing graphs of different sizes
        const normalizedGap = λ1 > 0 ? adjacencyGap / λ1 : 0;
        
        // 4. Relative Gap: λ₂ / λ₁ (for expander analysis)
        // Smaller is better for expansion
        const relativeSecond = λ1 !== 0 ? λ2 / λ1 : 0;
        
        // 5. Spectral Width: λ₁ - λₙ (total spread)
        const spectralWidth = λ1 - λn;
        
        // Detect closed form for the gap
        const gapForm = SpectralEngine.identifyClosedForm(adjacencyGap, n);
        
        // Compute theoretical bounds and interpretations
        const analysis = {
            // Core metrics
            adjacencyGap,
            absoluteGap,
            normalizedGap,
            relativeSecond,
            spectralWidth,
            
            // Eigenvalue details
            λ1,
            λ2,
            λn,
            
            // Closed form
            gapFormula: gapForm.isExact ? gapForm.formula : adjacencyGap.toFixed(6),
            gapIsAnalytic: gapForm.isExact,
            
            // Interpretation
            interpretation: SpectralGapAnalyzer.interpret(adjacencyGap, normalizedGap, n, graphInfo),
            
            // Expansion quality (based on normalized gap)
            expansionQuality: SpectralGapAnalyzer.classifyExpansion(normalizedGap)
        };
        
        // Add known formula if graph type is recognized
        if (graphInfo?.type) {
            analysis.knownFormula = SpectralGapAnalyzer.getKnownFormula(graphInfo);
        }
        
        return analysis;
    }
    
    /**
     * Get known spectral gap formulas for common graph families
     */
    static getKnownFormula(graphInfo) {
        const { type, n, degree, dim } = graphInfo;
        
        const formulas = {
            'cycle': {
                formula: '4sin²(π/n)',
                value: 4 * Math.pow(Math.sin(Math.PI / n), 2),
                note: 'Gap → 0 as n → ∞ (poor expansion)'
            },
            'path': {
                formula: '2cos(π/(n+1)) - 2cos(2π/(n+1))',
                value: 2 * Math.cos(Math.PI / (n + 1)) - 2 * Math.cos(2 * Math.PI / (n + 1)),
                note: 'Gap → 0 as n → ∞'
            },
            'complete': {
                formula: 'n (all non-principal eigenvalues are -1)',
                value: n,  // λ₁ = n-1, λ₂ = -1, gap in usual sense is 0
                note: 'Maximum expansion (Ramanujan bound achieved)'
            },
            'star': {
                formula: '√(n-1)',
                value: Math.sqrt(n - 1),
                note: 'λ₁ = √(n-1), λ₂ = 0'
            },
            'hypercube': {
                formula: '2 (constant for all dimensions)',
                value: 2,
                note: `Q_${dim || '?'}: λ₁ = d, λ₂ = d-2, gap = 2`
            },
            'petersen': {
                formula: '2',
                value: 2,
                note: 'λ₁ = 3, λ₂ = 1, excellent expander'
            },
            'complete_bipartite': {
                formula: '√(mn) (for K_{m,n})',
                value: graphInfo.m && graphInfo.p ? Math.sqrt(graphInfo.m * graphInfo.p) : null,
                note: 'Bipartite graphs have symmetric spectrum'
            }
        };
        
        return formulas[type] || null;
    }
    
    /**
     * Classify expansion quality based on normalized spectral gap
     */
    static classifyExpansion(normalizedGap) {
        if (normalizedGap >= 0.5) return { quality: 'Excellent', rating: 5, description: 'Near-Ramanujan expander' };
        if (normalizedGap >= 0.3) return { quality: 'Good', rating: 4, description: 'Strong expansion properties' };
        if (normalizedGap >= 0.15) return { quality: 'Moderate', rating: 3, description: 'Reasonable connectivity' };
        if (normalizedGap >= 0.05) return { quality: 'Weak', rating: 2, description: 'Limited expansion' };
        return { quality: 'Poor', rating: 1, description: 'Near-disconnected or path-like' };
    }
    
    /**
     * Generate human-readable interpretation
     */
    static interpret(gap, normalizedGap, n, graphInfo) {
        const lines = [];
        
        // Basic gap info
        lines.push(`Spectral gap Δ = ${gap.toFixed(4)}`);
        
        // Normalized interpretation
        const pct = (normalizedGap * 100).toFixed(1);
        lines.push(`Normalized gap: ${pct}% of spectral radius`);
        
        // Expansion interpretation
        const expansion = SpectralGapAnalyzer.classifyExpansion(normalizedGap);
        lines.push(`Expansion: ${expansion.quality} - ${expansion.description}`);
        
        // Mixing time estimate (for random walks)
        if (normalizedGap > 0.001) {
            const mixingTime = Math.ceil(Math.log(n) / normalizedGap);
            lines.push(`Est. mixing time: O(${mixingTime}) steps`);
        }
        
        // Graph-specific notes
        if (graphInfo?.type === 'cycle' && n > 10) {
            lines.push('Note: Cycles have poor expansion (gap ~ 1/n²)');
        }
        if (graphInfo?.type === 'hypercube') {
            lines.push('Note: Hypercubes are excellent expanders (gap = 2)');
        }
        
        return lines.join('\n');
    }
    
    /**
     * Compute Laplacian eigenvalues from adjacency matrix
     * L = D - A where D is the degree matrix
     * 
     * @param {number[][]} adjMatrix - Adjacency matrix
     * @returns {number[]} Laplacian eigenvalues (sorted ascending)
     */
    static computeLaplacianEigenvalues(adjMatrix) {
        const n = adjMatrix.length;
        if (n === 0) return [];
        
        // Build Laplacian: L = D - A
        const L = Array(n).fill(null).map(() => Array(n).fill(0));
        
        for (let i = 0; i < n; i++) {
            let degree = 0;
            for (let j = 0; j < n; j++) {
                if (adjMatrix[i][j] !== 0) {
                    degree++;
                    L[i][j] = -adjMatrix[i][j];
                }
            }
            L[i][i] = degree;
        }
        
        // For small matrices, use power iteration or direct computation
        // For now, return null to indicate Laplacian analysis needs numerical solver
        return null;  // Would need numerical eigenvalue solver
    }
    
    /**
     * Estimate algebraic connectivity (Fiedler value) from graph structure
     * This is the second smallest Laplacian eigenvalue λ₂(L)
     * 
     * For known graph families, use exact formulas:
     */
    static estimateAlgebraicConnectivity(n, graphType, graphInfo = {}) {
        // Known formulas for algebraic connectivity
        switch (graphType) {
            case 'complete':
                return { value: n, formula: 'n', exact: true };
            case 'cycle':
                return { 
                    value: 2 * (1 - Math.cos(2 * Math.PI / n)), 
                    formula: '2(1 - cos(2π/n))',
                    exact: true 
                };
            case 'path':
                return { 
                    value: 2 * (1 - Math.cos(Math.PI / n)), 
                    formula: '2(1 - cos(π/n))',
                    exact: true 
                };
            case 'star':
                return { value: 1, formula: '1', exact: true };
            case 'complete_bipartite':
                const m = graphInfo.m || 1;
                const p = graphInfo.p || 1;
                return { 
                    value: Math.min(m, p), 
                    formula: `min(${m}, ${p})`,
                    exact: true 
                };
            case 'hypercube':
                return { value: 2, formula: '2', exact: true };
            default:
                return { value: null, formula: 'unknown', exact: false };
        }
    }
    
    /**
     * Cheeger inequality bounds
     * h(G)/2 ≤ λ₂(L_norm) ≤ 2h(G)
     * where h(G) is the Cheeger constant (edge expansion)
     */
    static cheegerBounds(algebraicConnectivity, maxDegree) {
        if (algebraicConnectivity === null || algebraicConnectivity === undefined) {
            return null;
        }
        
        // For normalized Laplacian, λ₂ ∈ [0, 2]
        // Cheeger: h²/2 ≤ λ₂ ≤ 2h
        const λ2 = algebraicConnectivity;
        
        return {
            cheegerLowerBound: λ2 / 2,
            cheegerUpperBound: Math.sqrt(2 * λ2),
            interpretation: `Edge expansion h(G) ∈ [${(λ2/2).toFixed(3)}, ${Math.sqrt(2*λ2).toFixed(3)}]`
        };
    }
}

/**
 * Convenience function to analyze spectral gap
 * @param {number[]} eigenvalues - Array of eigenvalues
 * @param {number} n - Number of vertices
 * @param {string} graphType - Optional graph type
 * @returns {Object} Gap analysis results
 */
export function analyzeSpectralGap(eigenvalues, n, graphType = null) {
    const graphInfo = graphType ? { type: graphType, n } : null;
    return SpectralGapAnalyzer.analyze(eigenvalues, n, graphInfo);
}

// =====================================================
// UTILITY FUNCTIONS
// =====================================================

export function subscript(num) {
    const subs = '₀₁₂₃₄₅₆₇₈₉';
    return String(num).split('').map(d => subs[parseInt(d)] || d).join('');
}

export function superscript(num) {
    const supers = '⁰¹²³⁴⁵⁶⁷⁸⁹';
    return String(num).split('').map(d => supers[parseInt(d)]).join('');
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

function gcd(a, b) {
    a = Math.abs(Math.round(a));
    b = Math.abs(Math.round(b));
    while (b !== 0) {
        const t = b;
        b = a % b;
        a = t;
    }
    return a;
}

// =====================================================
// GRAPH PROPERTY CHECKERS
// =====================================================

export function isConnected() {
    const n = state.vertexMeshes.length;
    if (n === 0) return true;
    
    // Safety check for matrix
    if (!state.symmetricAdjMatrix || state.symmetricAdjMatrix.length !== n) return false;
    
    const visited = new Set();
    const queue = [0];
    visited.add(0);
    
    while (queue.length > 0) {
        const v = queue.shift();
        if (!state.symmetricAdjMatrix[v]) continue;
        for (let u = 0; u < n; u++) {
            if (state.symmetricAdjMatrix[v][u] === 1 && !visited.has(u)) {
                visited.add(u);
                queue.push(u);
            }
        }
    }
    
    return visited.size === n;
}

export function checkPath() {
    const n = state.vertexMeshes.length;
    if (!state.symmetricAdjMatrix || state.symmetricAdjMatrix.length !== n) return false;
    
    const degrees = Array(n).fill(0);
    for (let i = 0; i < n; i++) {
        if (!state.symmetricAdjMatrix[i]) continue;
        for (let j = 0; j < n; j++) {
            if (state.symmetricAdjMatrix[i][j] === 1) degrees[i]++;
        }
    }
    const endpoints = [];
    for (let i = 0; i < n; i++) {
        if (degrees[i] === 1) endpoints.push(i);
        else if (degrees[i] !== 2) return false;
    }
    if (endpoints.length !== 2) return false;
    
    const visited = new Set();
    let current = endpoints[0];
    visited.add(current);
    for (let step = 0; step < n - 1; step++) {
        let found = false;
        for (let j = 0; j < n; j++) {
            if (state.symmetricAdjMatrix[current][j] === 1 && !visited.has(j)) {
                visited.add(j);
                current = j;
                found = true;
                break;
            }
        }
        if (!found) return false;
    }
    return visited.size === n;
}

export function checkCycle() {
    const n = state.vertexMeshes.length;
    const visited = new Set();
    let current = 0;
    let prev = -1;
    
    for (let i = 0; i < n; i++) {
        visited.add(current);
        let next = -1;
        for (let j = 0; j < n; j++) {
            if (state.symmetricAdjMatrix[current][j] === 1 && j !== prev) {
                next = j;
                break;
            }
        }
        if (next === -1) return false;
        if (visited.has(next) && i === n - 1 && next === 0) return true;
        if (visited.has(next)) return false;
        prev = current;
        current = next;
    }
    return false;
}

export function checkBipartite() {
    const n = state.vertexMeshes.length;
    if (n === 0) return { isBipartite: true, part1: [], part2: [] };
    
    // Safety check for matrix
    if (!state.symmetricAdjMatrix || state.symmetricAdjMatrix.length !== n) {
        return { isBipartite: false };
    }
    
    const color = Array(n).fill(-1);
    const part1 = [];
    const part2 = [];
    
    for (let start = 0; start < n; start++) {
        if (color[start] !== -1) continue;
        
        const queue = [start];
        color[start] = 0;
        
        while (queue.length > 0) {
            const v = queue.shift();
            (color[v] === 0 ? part1 : part2).push(v);
            
            if (!state.symmetricAdjMatrix[v]) continue;
            for (let u = 0; u < n; u++) {
                if (state.symmetricAdjMatrix[v][u] === 1) {
                    if (color[u] === -1) {
                        color[u] = 1 - color[v];
                        queue.push(u);
                    } else if (color[u] === color[v]) {
                        return { isBipartite: false };
                    }
                }
            }
        }
    }
    
    return { isBipartite: true, part1, part2 };
}

function checkCompleteBipartite(part1, part2) {
    for (const u of part1) {
        for (const v of part2) {
            if (state.symmetricAdjMatrix[u][v] !== 1) return false;
        }
    }
    for (const u of part1) {
        for (const v of part1) {
            if (u !== v && state.symmetricAdjMatrix[u][v] === 1) return false;
        }
    }
    for (const u of part2) {
        for (const v of part2) {
            if (u !== v && state.symmetricAdjMatrix[u][v] === 1) return false;
        }
    }
    return true;
}

function checkCompleteMultipartite() {
    const n = state.vertexMeshes.length;
    const parts = [];
    const assigned = Array(n).fill(-1);
    
    for (let i = 0; i < n; i++) {
        if (assigned[i] !== -1) continue;
        
        const nonNeighbors = [i];
        for (let j = i + 1; j < n; j++) {
            if (assigned[j] === -1 && state.symmetricAdjMatrix[i][j] === 0) {
                let isNonNeighborOfAll = true;
                for (const k of nonNeighbors) {
                    if (state.symmetricAdjMatrix[j][k] === 1) {
                        isNonNeighborOfAll = false;
                        break;
                    }
                }
                if (isNonNeighborOfAll) {
                    nonNeighbors.push(j);
                }
            }
        }
        
        for (const v of nonNeighbors) {
            assigned[v] = parts.length;
        }
        parts.push(nonNeighbors);
    }
    
    for (let i = 0; i < parts.length; i++) {
        for (let j = i + 1; j < parts.length; j++) {
            for (const u of parts[i]) {
                for (const v of parts[j]) {
                    if (state.symmetricAdjMatrix[u][v] !== 1) {
                        return { isCompleteMultipartite: false };
                    }
                }
            }
        }
    }
    
    return { isCompleteMultipartite: true, parts };
}

function checkCirculant() {
    const n = state.vertexMeshes.length;
    const connectionSet = new Set();
    
    for (let j = 1; j < n; j++) {
        if (state.symmetricAdjMatrix[0][j] === 1) {
            connectionSet.add(Math.min(j, n - j));
        }
    }
    
    for (let i = 1; i < n; i++) {
        for (let j = 0; j < n; j++) {
            const expected = connectionSet.has(Math.min((j - i + n) % n, (i - j + n) % n));
            const actual = state.symmetricAdjMatrix[i][j] === 1;
            if (expected !== actual) return { isCirculant: false };
        }
    }
    
    return { isCirculant: true, connectionSet: Array.from(connectionSet).sort((a, b) => a - b) };
}

function checkStronglyRegular() {
    const n = state.vertexMeshes.length;
    let k = 0;
    for (let j = 0; j < n; j++) {
        if (state.symmetricAdjMatrix[0][j] === 1) k++;
    }
    
    let lambda = -1, mu = -1;
    for (let i = 0; i < n; i++) {
        for (let j = i + 1; j < n; j++) {
            let commonNeighbors = 0;
            for (let v = 0; v < n; v++) {
                if (state.symmetricAdjMatrix[i][v] === 1 && state.symmetricAdjMatrix[j][v] === 1) {
                    commonNeighbors++;
                }
            }
            
            if (state.symmetricAdjMatrix[i][j] === 1) {
                if (lambda === -1) lambda = commonNeighbors;
                else if (lambda !== commonNeighbors) return { isSRG: false };
            } else {
                if (mu === -1) mu = commonNeighbors;
                else if (mu !== commonNeighbors) return { isSRG: false };
            }
        }
    }
    
    if (lambda === -1 || mu === -1) return { isSRG: false };
    
    return { isSRG: true, k, lambda, mu };
}

function checkCrown() {
    const n = state.vertexMeshes.length;
    const m = n / 2;
    
    const bipartite = checkBipartite();
    if (!bipartite.isBipartite) return false;
    if (bipartite.part1.length !== m || bipartite.part2.length !== m) return false;
    
    for (const u of bipartite.part1) {
        let degree = 0;
        for (let v = 0; v < n; v++) {
            if (state.symmetricAdjMatrix[u][v] === 1) degree++;
        }
        if (degree !== m - 1) return false;
    }
    
    return true;
}

function checkWheel() {
    const n = state.vertexMeshes.length;
    
    let hubCandidate = -1;
    for (let i = 0; i < n; i++) {
        let degree = 0;
        for (let j = 0; j < n; j++) {
            if (state.symmetricAdjMatrix[i][j] === 1) degree++;
        }
        if (degree === n - 1) {
            hubCandidate = i;
            break;
        }
    }
    
    if (hubCandidate === -1) return false;
    
    const rimNodes = [];
    for (let i = 0; i < n; i++) {
        if (i !== hubCandidate) rimNodes.push(i);
    }
    
    for (const node of rimNodes) {
        let rimDegree = 0;
        for (const other of rimNodes) {
            if (state.symmetricAdjMatrix[node][other] === 1) rimDegree++;
        }
        if (rimDegree !== 2) return false;
    }
    
    return true;
}

function checkStar() {
    const n = state.vertexMeshes.length;
    
    let centerCandidate = -1;
    for (let i = 0; i < n; i++) {
        let degree = 0;
        for (let j = 0; j < n; j++) {
            if (state.symmetricAdjMatrix[i][j] === 1) degree++;
        }
        if (degree === n - 1) {
            centerCandidate = i;
        } else if (degree !== 1) {
            return false;
        }
    }
    
    return centerCandidate !== -1;
}

function checkPrism() {
    const n = state.vertexMeshes.length;
    if (n < 6 || n % 2 !== 0) return false;
    
    const m = n / 2;
    
    for (let i = 0; i < n; i++) {
        let degree = 0;
        for (let j = 0; j < n; j++) {
            if (state.symmetricAdjMatrix[i][j] === 1) degree++;
        }
        if (degree !== 3) return false;
    }
    
    return true;
}

function checkLadder() {
    const n = state.vertexMeshes.length;
    if (n < 4 || n % 2 !== 0) return false;
    
    const m = n / 2;
    
    let endpoints = 0;
    let middleNodes = 0;
    
    for (let i = 0; i < n; i++) {
        let degree = 0;
        for (let j = 0; j < n; j++) {
            if (state.symmetricAdjMatrix[i][j] === 1) degree++;
        }
        if (degree === 2) endpoints++;
        else if (degree === 3) middleNodes++;
        else return false;
    }
    
    return endpoints === 4 && middleNodes === n - 4;
}

function checkFriendship() {
    const n = state.vertexMeshes.length;
    if (n < 3 || n % 2 === 0) return false;
    
    const k = (n - 1) / 2;
    
    let centerCandidate = -1;
    for (let i = 0; i < n; i++) {
        let degree = 0;
        for (let j = 0; j < n; j++) {
            if (state.symmetricAdjMatrix[i][j] === 1) degree++;
        }
        if (degree === n - 1) {
            if (centerCandidate !== -1) return false;
            centerCandidate = i;
        } else if (degree !== 2) {
            return false;
        }
    }
    
    if (centerCandidate === -1) return false;
    
    for (let i = 0; i < n; i++) {
        if (i === centerCandidate) continue;
        let pairFound = false;
        for (let j = 0; j < n; j++) {
            if (j !== centerCandidate && j !== i && state.symmetricAdjMatrix[i][j] === 1) {
                if (pairFound) return false;
                pairFound = true;
            }
        }
        if (!pairFound) return false;
    }
    
    return { isFriendship: true, k };
}

function checkPetersen() {
    const n = state.vertexMeshes.length;
    if (n !== 10) return false;
    
    for (let i = 0; i < n; i++) {
        let degree = 0;
        for (let j = 0; j < n; j++) {
            if (state.symmetricAdjMatrix[i][j] === 1) degree++;
        }
        if (degree !== 3) return false;
    }
    
    for (let i = 0; i < n; i++) {
        for (let j = i + 1; j < n; j++) {
            if (state.symmetricAdjMatrix[i][j] === 1) {
                let commonNeighbors = 0;
                for (let v = 0; v < n; v++) {
                    if (state.symmetricAdjMatrix[i][v] === 1 && state.symmetricAdjMatrix[j][v] === 1) {
                        commonNeighbors++;
                    }
                }
                if (commonNeighbors !== 0) return false;
            }
        }
    }
    
    return true;
}

function checkHypercube(dim) {
    const n = state.vertexMeshes.length;
    if (n !== Math.pow(2, dim)) return false;
    
    for (let i = 0; i < n; i++) {
        let degree = 0;
        for (let j = 0; j < n; j++) {
            if (state.symmetricAdjMatrix[i][j] === 1) degree++;
        }
        if (degree !== dim) return false;
    }
    
    return true;
}

function checkOctahedron() {
    const n = state.vertexMeshes.length;
    if (n !== 6) return false;
    
    for (let i = 0; i < n; i++) {
        let degree = 0;
        for (let j = 0; j < n; j++) {
            if (state.symmetricAdjMatrix[i][j] === 1) degree++;
        }
        if (degree !== 4) return false;
    }
    
    let nonEdges = 0;
    for (let i = 0; i < n; i++) {
        for (let j = i + 1; j < n; j++) {
            if (state.symmetricAdjMatrix[i][j] === 0) nonEdges++;
        }
    }
    
    return nonEdges === 3;
}

function checkIcosahedron() {
    const n = state.vertexMeshes.length;
    if (n !== 12) return false;
    
    for (let i = 0; i < n; i++) {
        let degree = 0;
        for (let j = 0; j < n; j++) {
            if (state.symmetricAdjMatrix[i][j] === 1) degree++;
        }
        if (degree !== 5) return false;
    }
    
    return true;
}

function checkDodecahedron() {
    const n = state.vertexMeshes.length;
    if (n !== 20) return false;
    
    for (let i = 0; i < n; i++) {
        let degree = 0;
        for (let j = 0; j < n; j++) {
            if (state.symmetricAdjMatrix[i][j] === 1) degree++;
        }
        if (degree !== 3) return false;
    }
    
    return true;
}

function checkMobiusKantor() {
    const n = state.vertexMeshes.length;
    if (n !== 16) return false;
    
    for (let i = 0; i < n; i++) {
        let degree = 0;
        for (let j = 0; j < n; j++) {
            if (state.symmetricAdjMatrix[i][j] === 1) degree++;
        }
        if (degree !== 3) return false;
    }
    
    return true;
}

// =====================================================
// GRAPH TYPE DETECTION
// =====================================================

export function detectGraphType() {
    const n = state.vertexMeshes.length;
    if (n === 0) return { type: 'empty', name: 'Empty Graph' };
    
    // Safety check for matrix
    if (!state.symmetricAdjMatrix || state.symmetricAdjMatrix.length !== n || !state.symmetricAdjMatrix[0]) {
        return { type: 'unknown', name: `Graph (n=${n})`, formula: 'Matrix not initialized' };
    }
    
    // Count edges
    let totalEdges = 0;
    for (let i = 0; i < n; i++) {
        if (!state.symmetricAdjMatrix[i]) continue;
        for (let j = i + 1; j < n; j++) {
            if (state.symmetricAdjMatrix[i][j] === 1) totalEdges++;
        }
    }
    
    // Check regularity and compute degrees array
    const degrees = [];
    let isRegular = true;
    let degree = 0;
    for (let j = 0; j < n; j++) {
        if (state.symmetricAdjMatrix[0][j] === 1) degree++;
    }
    degrees.push(degree);
    
    for (let i = 1; i < n; i++) {
        let d = 0;
        for (let j = 0; j < n; j++) {
            if (state.symmetricAdjMatrix[i][j] === 1) d++;
        }
        degrees.push(d);
        if (d !== degree) {
            isRegular = false;
        }
    }
    
    // Check bipartite
    const bipartiteInfo = checkBipartite();
    
    // === EMPTY GRAPH ===
    if (totalEdges === 0) {
        return {
            type: 'empty',
            name: `Empty Graph (n=${n})`,
            n: n,
            formula: 'λ = 0 (multiplicity n)',
            eigenvalues: [{ value: 0, multiplicity: n }],
            skewFormula: 'λ = 0 (multiplicity n)',
            skewEigenvalues: [{ real: 0, imag: 0, multiplicity: n }]
        };
    }
    
    // === COMPLETE GRAPH Kₙ ===
    if (totalEdges === n * (n - 1) / 2) {
        // Skew-symmetric eigenvalues: λₖ = ±i·cot((2k-1)π/2n), k = 1,...,floor(n/2)
        const skewEigenvalues = [];
        for (let k = 1; k <= Math.floor(n / 2); k++) {
            const val = 1 / Math.tan((2 * k - 1) * Math.PI / (2 * n));
            skewEigenvalues.push({ real: 0, imag: val, k: k });
            skewEigenvalues.push({ real: 0, imag: -val, k: k });
        }
        // For odd n, add zero eigenvalue
        if (n % 2 === 1) {
            skewEigenvalues.push({ real: 0, imag: 0, k: 0 });
        }
        
        const b1 = 1 / Math.tan(Math.PI / (2 * n));
        
        return {
            type: 'complete',
            name: `Complete Graph K${subscript(n)}`,
            n: n,
            formula: `Symmetric: λ = ${n-1} (×1), -1 (×${n-1})`,
            eigenvalues: [
                { value: n - 1, multiplicity: 1 },
                { value: -1, multiplicity: n - 1 }
            ],
            skewFormula: `λₖ = ±i·cot((2k-1)π/${2*n}), k = 1,...,${Math.floor(n/2)}`,
            skewEigenvalues: skewEigenvalues.sort((a, b) => b.imag - a.imag)
        };
    }
    
    // === CYCLE GRAPH Cₙ ===
    if (isRegular && degree === 2 && totalEdges === n && checkCycle()) {
        const eigenvalues = [];
        const skewEigenvalues = [];
        for (let k = 0; k < n; k++) {
            eigenvalues.push({ value: 2 * Math.cos(2 * Math.PI * k / n), k: k });
            skewEigenvalues.push({ real: 0, imag: 2 * Math.sin(2 * Math.PI * k / n), k: k });
        }
        return {
            type: 'cycle',
            name: `Cycle Graph C${subscript(n)}`,
            n: n,
            formula: `λₖ = 2cos(2πk/${n}), k = 0, 1, ..., ${n-1}`,
            eigenvalues: eigenvalues,
            skewFormula: `λₖ = 2i·sin(2πk/${n}), k = 0, 1, ..., ${n-1}`,
            skewEigenvalues: skewEigenvalues
        };
    }
    
    // === PATH GRAPH Pₙ ===
    if (totalEdges === n - 1 && checkPath()) {
        const eigenvalues = [];
        const skewEigenvalues = [];
        for (let k = 1; k <= n; k++) {
            eigenvalues.push({ value: 2 * Math.cos(Math.PI * k / (n + 1)), k: k });
            skewEigenvalues.push({ real: 0, imag: 2 * Math.sin(Math.PI * k / (n + 1)), k: k });
        }
        return {
            type: 'path',
            name: `Path Graph P${subscript(n)}`,
            n: n,
            formula: `λₖ = 2cos(πk/${n+1}), k = 1, 2, ..., ${n}`,
            eigenvalues: eigenvalues,
            skewFormula: `λₖ = 2i·sin(πk/${n+1}), k = 1, 2, ..., ${n}`,
            skewEigenvalues: skewEigenvalues
        };
    }
    
    // === STAR GRAPH K₁,ₙ₋₁ ===
    if (checkStar()) {
        const sqrtN = Math.sqrt(n - 1);
        return {
            type: 'star',
            name: `Star Graph K${subscript(1)},${subscript(n-1)}`,
            n: n,
            formula: `λ = √${n-1} ≈ ${sqrtN.toFixed(4)}, λ = 0 (mult. ${n-2}), λ = -√${n-1}`,
            eigenvalues: [
                { value: sqrtN, multiplicity: 1 },
                { value: 0, multiplicity: n - 2 },
                { value: -sqrtN, multiplicity: 1 }
            ],
            skewFormula: `λ = ±√${n-1}i, λ = 0 (mult. ${n-2})`,
            skewEigenvalues: [
                { real: 0, imag: sqrtN, multiplicity: 1 },
                { real: 0, imag: -sqrtN, multiplicity: 1 },
                { real: 0, imag: 0, multiplicity: n - 2 }
            ]
        };
    }
    
    // === COMPLETE BIPARTITE K_{m,n} ===
    if (bipartiteInfo.isBipartite && checkCompleteBipartite(bipartiteInfo.part1, bipartiteInfo.part2)) {
        const m = bipartiteInfo.part1.length;
        const p = bipartiteInfo.part2.length;
        const sqrtMP = Math.sqrt(m * p);
        return {
            type: 'complete_bipartite',
            name: `Complete Bipartite K${subscript(m)},${subscript(p)}`,
            m: m,
            p: p,
            formula: `λ = √(${m}·${p}) ≈ ${sqrtMP.toFixed(4)}, λ = 0 (mult. ${n-2}), λ = -√(${m}·${p})`,
            eigenvalues: [
                { value: sqrtMP, multiplicity: 1 },
                { value: 0, multiplicity: n - 2 },
                { value: -sqrtMP, multiplicity: 1 }
            ],
            skewFormula: `λ = ±√(${m}·${p})i, λ = 0 (mult. ${n-2})`,
            skewEigenvalues: [
                { real: 0, imag: sqrtMP, multiplicity: 1 },
                { real: 0, imag: -sqrtMP, multiplicity: 1 },
                { real: 0, imag: 0, multiplicity: n - 2 }
            ]
        };
    }
    
    // === WHEEL GRAPH Wₙ ===
    if (checkWheel()) {
        const eigenvalues = [{ value: 3 + Math.sqrt(n + 1), multiplicity: 1 }];
        const skewEigenvalues = [];
        
        for (let k = 1; k < n - 1; k++) {
            eigenvalues.push({ value: 1 + 2 * Math.cos(2 * Math.PI * k / (n - 1)), k: k });
        }
        eigenvalues.push({ value: 3 - Math.sqrt(n + 1), multiplicity: 1 });
        
        return {
            type: 'wheel',
            name: `Wheel Graph W${subscript(n)}`,
            n: n,
            formula: `λ = 1 + 2cos(2πk/${n-1}) with modifications at hub`,
            eigenvalues: eigenvalues
        };
    }
    
    // === PETERSEN GRAPH ===
    if (checkPetersen()) {
        return {
            type: 'petersen',
            name: 'Petersen Graph',
            formula: 'λ = 3 (mult. 1), λ = 1 (mult. 5), λ = -2 (mult. 4)',
            eigenvalues: [
                { value: 3, multiplicity: 1 },
                { value: 1, multiplicity: 5 },
                { value: -2, multiplicity: 4 }
            ],
            skewFormula: 'λ = ±3i, ±i (mult. 2-3), ±2i (mult. 2)',
            skewEigenvalues: [
                { real: 0, imag: 3, multiplicity: 1 },
                { real: 0, imag: -3, multiplicity: 1 },
                { real: 0, imag: 1, multiplicity: 3 },
                { real: 0, imag: -1, multiplicity: 2 },
                { real: 0, imag: 2, multiplicity: 2 },
                { real: 0, imag: -2, multiplicity: 2 }
            ]
        };
    }
    
    // === HYPERCUBE Q₃ ===
    if (checkHypercube(3)) {
        return {
            type: 'hypercube',
            name: 'Hypercube Q₃',
            dim: 3,
            formula: 'λ = 3 (mult. 1), λ = 1 (mult. 3), λ = -1 (mult. 3), λ = -3 (mult. 1)',
            eigenvalues: [
                { value: 3, multiplicity: 1 },
                { value: 1, multiplicity: 3 },
                { value: -1, multiplicity: 3 },
                { value: -3, multiplicity: 1 }
            ]
        };
    }
    
    // === HYPERCUBE Q₄ ===
    if (checkHypercube(4)) {
        return {
            type: 'hypercube',
            name: 'Hypercube Q₄',
            dim: 4,
            formula: 'λ = 4 (mult. 1), 2 (mult. 4), 0 (mult. 6), -2 (mult. 4), -4 (mult. 1)',
            eigenvalues: [
                { value: 4, multiplicity: 1 },
                { value: 2, multiplicity: 4 },
                { value: 0, multiplicity: 6 },
                { value: -2, multiplicity: 4 },
                { value: -4, multiplicity: 1 }
            ]
        };
    }
    
    // === OCTAHEDRON ===
    if (checkOctahedron()) {
        return {
            type: 'octahedron',
            name: 'Octahedron Graph',
            formula: 'λ = 4 (mult. 1), λ = 0 (mult. 3), λ = -2 (mult. 2)',
            eigenvalues: [
                { value: 4, multiplicity: 1 },
                { value: 0, multiplicity: 3 },
                { value: -2, multiplicity: 2 }
            ]
        };
    }
    
    // === CIRCULANT GRAPH ===
    if (isRegular && isConnected()) {
        const circulantCheck = checkCirculant();
        if (circulantCheck.isCirculant) {
            const S = circulantCheck.connectionSet;
            const eigenvalues = [];
            const skewEigenvalues = [];
            for (let k = 0; k < n; k++) {
                let sumCos = 0;
                let sumSin = 0;
                for (const s of S) {
                    sumCos += 2 * Math.cos(2 * Math.PI * k * s / n);
                    sumSin += 2 * Math.sin(2 * Math.PI * k * s / n);
                }
                eigenvalues.push({ value: sumCos, k: k });
                skewEigenvalues.push({ real: 0, imag: sumSin, k: k });
            }
            return {
                type: 'circulant',
                name: `Circulant C(${n}, {${S.join(',')}})`,
                n: n,
                connectionSet: S,
                formula: `λₖ = Σⱼ∈S 2cos(2πkj/${n}), k = 0..${n-1}`,
                eigenvalues: eigenvalues,
                skewFormula: `λₖ = Σⱼ∈S 2i·sin(2πkj/${n}), k = 0..${n-1}`,
                skewEigenvalues: skewEigenvalues
            };
        }
    }
    
    // === REGULAR GRAPH ===
    if (isRegular) {
        return {
            type: 'regular',
            name: `${degree}-Regular Graph`,
            degree: degree,
            n: n,
            formula: `λ₁ = ${degree} (always an eigenvalue for regular graphs)`,
            eigenvalues: null
        };
    }
    
    // === TREE with specific structures ===
    if (totalEdges === n - 1 && isConnected()) {
        // Compute degrees locally for this section
        const treeDegrees = [];
        for (let i = 0; i < n; i++) {
            let d = 0;
            if (state.symmetricAdjMatrix[i]) {
                for (let j = 0; j < n; j++) {
                    if (state.symmetricAdjMatrix[i][j] === 1) d++;
                }
            }
            treeDegrees.push(d);
        }
        
        // Count degree frequencies
        const degCounts = {};
        treeDegrees.forEach(d => { degCounts[d] = (degCounts[d] || 0) + 1; });
        const deg1Count = treeDegrees.filter(d => d === 1).length;
        const deg2Count = treeDegrees.filter(d => d === 2).length;
        
        // Check for S'_p Tree: N = 2p + 1
        // 1 vertex of degree p, p vertices of degree 2, p vertices of degree 1
        if (n >= 5 && n % 2 === 1) {
            const p = (n - 1) / 2;
            if (degCounts[p] === 1 && degCounts[2] === p && degCounts[1] === p) {
                const sqrtP1 = Math.sqrt(p + 1);
                // Compute eigenvalues: ±i√(p+1), ±i (repeated p-1 times), 0
                const eigenvalues = [];
                eigenvalues.push({ re: 0, im: sqrtP1 });
                eigenvalues.push({ re: 0, im: -sqrtP1 });
                for (let i = 0; i < p - 1; i++) {
                    eigenvalues.push({ re: 0, im: 1 });
                    eigenvalues.push({ re: 0, im: -1 });
                }
                eigenvalues.push({ re: 0, im: 0 });
                
                return {
                    type: 'star_path',
                    name: `S'${subscript(p)} Tree`,
                    n: n,
                    p: p,
                    formula: `λ = ±i√${p+1} ≈ ±${sqrtP1.toFixed(4)}i, ±i (×${p-1}), 0`,
                    eigenvalues: eigenvalues.sort((a, b) => b.im - a.im),
                    skewFormula: `λ = ±i√${p+1}, ±i (×${p-1}), 0`,
                    skewEigenvalues: eigenvalues.sort((a, b) => b.im - a.im)
                };
            }
        }
        
        // Check for S²_p Tree: N = 3p + 1
        // 1 vertex of degree p, 2p vertices of degree 2, p vertices of degree 1
        if (n >= 7 && (n - 1) % 3 === 0) {
            const p = (n - 1) / 3;
            if (degCounts[p] === 1 && degCounts[2] === 2 * p && degCounts[1] === p) {
                const halfP = p / 2;
                const innerSqrt = Math.sqrt(halfP * halfP + 1);
                const outerPlus = Math.sqrt(halfP + 1 + innerSqrt);
                const outerMinus = Math.sqrt(Math.abs(halfP + 1 - innerSqrt));
                const sqrt2 = Math.sqrt(2);
                
                // Compute eigenvalues
                const eigenvalues = [];
                eigenvalues.push({ re: 0, im: outerPlus });
                eigenvalues.push({ re: 0, im: -outerPlus });
                eigenvalues.push({ re: 0, im: outerMinus });
                eigenvalues.push({ re: 0, im: -outerMinus });
                for (let i = 0; i < p - 1; i++) {
                    eigenvalues.push({ re: 0, im: sqrt2 });
                    eigenvalues.push({ re: 0, im: -sqrt2 });
                }
                for (let i = 0; i < p - 1; i++) {
                    eigenvalues.push({ re: 0, im: 0 });
                }
                
                return {
                    type: 'double_star',
                    name: `S²${subscript(p)} Tree`,
                    n: n,
                    p: p,
                    formula: `λ = ±i√((p/2+1)±√((p/2)²+1)) ≈ ±${outerPlus.toFixed(3)}i, ±${outerMinus.toFixed(3)}i; ±i√2 (×${p-1}); 0 (×${p-1})`,
                    eigenvalues: eigenvalues.sort((a, b) => b.im - a.im),
                    skewFormula: `λ = ±i·${outerPlus.toFixed(4)}, ±i·${outerMinus.toFixed(4)}, ±i√2 (×${p-1}), 0 (×${p-1})`,
                    skewEigenvalues: eigenvalues.sort((a, b) => b.im - a.im)
                };
            }
        }
        
        // Check for general Sᵈ_p Tree: N = d*p + 1 (any depth d >= 2)
        // 1 vertex of degree p, (d-1)*p vertices of degree 2, p vertices of degree 1
        // Try to find p such that (n-1) is divisible by p and structure matches
        for (let p = 2; p <= Math.floor((n - 1) / 2); p++) {
            if ((n - 1) % p === 0) {
                const d = (n - 1) / p;  // depth
                if (d >= 2 && degCounts[p] === 1 && degCounts[2] === (d - 1) * p && degCounts[1] === p) {
                    // Found a Sᵈₚ tree structure
                    const depthSup = superscript(d);
                    
                    return {
                        type: 'general_star_tree',
                        name: `S${depthSup}${subscript(p)} Tree (depth ${d})`,
                        n: n,
                        p: p,
                        d: d,
                        formula: `Sᵈₚ tree with d=${d}, p=${p}. Eigenvalues follow recursive pattern.`,
                        eigenvalues: null,  // Would need recursive formula for general d
                        skewFormula: `Sᵈₚ Tree: N = ${d}×${p} + 1 = ${n}`,
                        skewEigenvalues: null
                    };
                }
            }
        }
        
        // Generic tree
        return {
            type: 'tree',
            name: 'Tree',
            n: n,
            formula: 'Tree eigenvalues depend on structure.',
            eigenvalues: null
        };
    }
    
    return { 
        type: 'unknown', 
        name: 'General Graph',
        n: n,
        formula: 'No closed-form solution detected',
        eigenvalues: null
    };
}

// =====================================================
// CHARACTERISTIC POLYNOMIAL
// =====================================================

export function computeCharacteristicPolynomial(matrix) {
    const n = matrix.length;
    if (n === 0) return [1];
    if (n === 1) return [-matrix[0][0], 1];
    
    const coeffs = Array(n + 1).fill(0);
    coeffs[n] = 1;
    
    let M = matrix.map(row => [...row]);
    let trace = 0;
    
    for (let k = 1; k <= n; k++) {
        trace = 0;
        for (let i = 0; i < n; i++) trace += M[i][i];
        coeffs[n - k] = -trace / k;
        
        if (k < n) {
            for (let i = 0; i < n; i++) M[i][i] += coeffs[n - k];
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

export function formatPolynomial(coeffs) {
    const n = coeffs.length - 1;
    let terms = [];
    
    for (let i = n; i >= 0; i--) {
        const c = coeffs[i];
        if (Math.abs(c) < 1e-10) continue;
        
        let term = '';
        const absC = Math.abs(c);
        const sign = c >= 0 ? '+' : '-';
        
        if (i === n) {
            term = i === 0 ? c.toFixed(2) : (absC === 1 ? '' : absC.toFixed(2));
        } else {
            term = absC === 1 && i > 0 ? '' : absC.toFixed(2);
        }
        
        if (i > 1) term += `λ${superscript(i)}`;
        else if (i === 1) term += 'λ';
        
        if (terms.length === 0) {
            terms.push(c < 0 ? `-${term}` : term);
        } else {
            terms.push(`${sign} ${term}`);
        }
    }
    
    return terms.length > 0 ? `p(λ) = ${terms.join(' ')}` : 'p(λ) = 0';
}

// =====================================================
// EIGENVALUE COMPUTATION (JACOBI METHOD)
// =====================================================

export function computeEigenvaluesNumerical(matrix) {
    const n = matrix.length;
    if (n === 0) return [];
    if (n === 1) return [matrix[0][0]];
    
    const A = [];
    for (let i = 0; i < n; i++) {
        A[i] = [];
        for (let j = 0; j < n; j++) {
            A[i][j] = Number(matrix[i][j]);
        }
    }
    
    const maxIterations = 5 * n * n * n;
    const tolerance = 1e-12;
    
    let iterCount = 0;
    
    while (iterCount < maxIterations) {
        iterCount++;
        
        let maxOffDiag = 0;
        let p = 0, q = 1;
        
        for (let i = 0; i < n; i++) {
            for (let j = i + 1; j < n; j++) {
                const absVal = Math.abs(A[i][j]);
                if (absVal > maxOffDiag) {
                    maxOffDiag = absVal;
                    p = i;
                    q = j;
                }
            }
        }
        
        if (maxOffDiag < tolerance) break;
        
        const diff = A[q][q] - A[p][p];
        
        let t;
        if (Math.abs(A[p][q]) < Math.abs(diff) * 1e-36) {
            t = A[p][q] / diff;
        } else {
            const phi = diff / (2.0 * A[p][q]);
            t = 1.0 / (Math.abs(phi) + Math.sqrt(phi * phi + 1.0));
            if (phi < 0) t = -t;
        }
        
        const c = 1.0 / Math.sqrt(t * t + 1.0);
        const s = t * c;
        const tau = s / (1.0 + c);
        
        const h = t * A[p][q];
        
        A[p][p] -= h;
        A[q][q] += h;
        A[p][q] = 0;
        A[q][p] = 0;
        
        for (let j = 0; j < p; j++) {
            const g = A[j][p];
            const f = A[j][q];
            A[j][p] = g - s * (f + g * tau);
            A[j][q] = f + s * (g - f * tau);
        }
        
        for (let j = p + 1; j < q; j++) {
            const g = A[p][j];
            const f = A[j][q];
            A[p][j] = g - s * (f + g * tau);
            A[j][q] = f + s * (g - f * tau);
        }
        
        for (let j = q + 1; j < n; j++) {
            const g = A[p][j];
            const f = A[q][j];
            A[p][j] = g - s * (f + g * tau);
            A[q][j] = f + s * (g - f * tau);
        }
    }
    
    const eigenvalues = [];
    for (let i = 0; i < n; i++) {
        eigenvalues.push(A[i][i]);
    }
    
    eigenvalues.sort((a, b) => b - a);
    return eigenvalues;
}

// =====================================================
// SKEW-SYMMETRIC EIGENVALUES
// =====================================================

// Returns ALL eigenvalues including duplicates (for multiplicity counting)
export function computeSkewSymmetricEigenvaluesWithMultiplicity(matrix) {
    const n = matrix.length;
    if (n === 0) return [];
    
    const A2 = Array(n).fill(null).map(() => Array(n).fill(0));
    for (let i = 0; i < n; i++) {
        for (let j = 0; j < n; j++) {
            for (let k = 0; k < n; k++) {
                A2[i][j] += matrix[i][k] * matrix[k][j];
            }
        }
    }
    
    const negA2 = A2.map(row => row.map(x => -x));
    const eigenvaluesSquared = computeEigenvaluesNumerical(negA2);
    
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

// Returns unique eigenvalues (deduplicated)
export function computeSkewSymmetricEigenvalues(matrix) {
    const allEigs = computeSkewSymmetricEigenvaluesWithMultiplicity(matrix);
    
    const seen = new Set();
    const unique = [];
    for (const ev of allEigs) {
        const key = ev.imag.toFixed(8);
        if (!seen.has(key)) {
            seen.add(key);
            unique.push(ev);
        }
    }
    
    return unique;
}

// =====================================================
// TRIGONOMETRIC ROOT DETECTION
// =====================================================

function rationalApprox(x, maxDen = 120, tol = 1e-7) {
    if (x < 0 || x > 1) return null;
    if (Math.abs(x) < tol) return { p: 0, q: 1 };
    if (Math.abs(1 - x) < tol) return { p: 1, q: 1 };
    
    let h0 = 0, k0 = 1;
    let h1 = 1, k1 = 0;
    let a, x1 = x;
    
    for (let iter = 0; iter < 50; iter++) {
        a = Math.floor(x1);
        const h2 = a * h1 + h0;
        const k2 = a * k1 + k0;
        
        if (k2 > maxDen) break;
        
        const approx = h2 / k2;
        if (Math.abs(approx - x) < tol) {
            let p = h2, q = k2;
            const g = gcd(p, q);
            p /= g; q /= g;
            return { p: Math.round(p), q: Math.round(q) };
        }
        
        h0 = h1; k0 = k1;
        h1 = h2; k1 = k2;
        
        const frac = x1 - a;
        if (Math.abs(frac) < 1e-15) break;
        x1 = 1.0 / frac;
    }
    return null;
}

function evalPoly(coeffs, x) {
    let y = 0;
    for (let i = coeffs.length - 1; i >= 0; i--) {
        y = y * x + coeffs[i];
    }
    return y;
}

export function detectTrigValue(value, polyCoeffs) {
    // Check for 2cos(kπ/n)
    if (Math.abs(value) <= 2 + 1e-8) {
        const cosVal = value / 2;
        if (Math.abs(cosVal) <= 1 + 1e-8) {
            const clamped = Math.max(-1, Math.min(1, cosVal));
            const theta = Math.acos(clamped);
            const r = theta / Math.PI;
            
            const rat = rationalApprox(r, 120, 1e-6);
            if (rat && rat.q >= 2) {
                const candidate = 2 * Math.cos((rat.p * Math.PI) / rat.q);
                if (Math.abs(candidate - value) < 1e-6) {
                    if (polyCoeffs) {
                        const polyVal = evalPoly(polyCoeffs, candidate);
                        if (Math.abs(polyVal) < 1e-4) {
                            return { type: '2cos', k: rat.p, n: rat.q, value: candidate };
                        }
                    } else {
                        return { type: '2cos', k: rat.p, n: rat.q, value: candidate };
                    }
                }
            }
        }
    }
    
    // Check for cos(kπ/n)
    if (Math.abs(value) <= 1 + 1e-8) {
        const clamped = Math.max(-1, Math.min(1, value));
        const theta = Math.acos(clamped);
        const r = theta / Math.PI;
        
        const rat = rationalApprox(r, 120, 1e-6);
        if (rat && rat.q >= 2) {
            const candidate = Math.cos((rat.p * Math.PI) / rat.q);
            if (Math.abs(candidate - value) < 1e-6) {
                if (polyCoeffs) {
                    const polyVal = evalPoly(polyCoeffs, candidate);
                    if (Math.abs(polyVal) < 1e-4) {
                        return { type: 'cos', k: rat.p, n: rat.q, value: candidate };
                    }
                } else {
                    return { type: 'cos', k: rat.p, n: rat.q, value: candidate };
                }
            }
        }
    }
    
    // Check for sin(kπ/n)
    if (Math.abs(value) <= 1 + 1e-8) {
        const clamped = Math.max(-1, Math.min(1, value));
        const theta = Math.asin(clamped);
        const r = Math.abs(theta) / Math.PI;
        
        const rat = rationalApprox(r, 120, 1e-6);
        if (rat && rat.q >= 2) {
            const sign = value >= 0 ? 1 : -1;
            const candidate = sign * Math.sin((rat.p * Math.PI) / rat.q);
            if (Math.abs(candidate - value) < 1e-6) {
                return { type: 'sin', k: rat.p, n: rat.q, value: candidate, sign: sign };
            }
        }
    }
    
    // Check for 2sin(kπ/n)
    if (Math.abs(value) <= 2 + 1e-8) {
        const sinVal = value / 2;
        if (Math.abs(sinVal) <= 1 + 1e-8) {
            const clamped = Math.max(-1, Math.min(1, sinVal));
            const theta = Math.asin(clamped);
            const r = Math.abs(theta) / Math.PI;
            
            const rat = rationalApprox(r, 120, 1e-6);
            if (rat && rat.q >= 2) {
                const sign = value >= 0 ? 1 : -1;
                const candidate = sign * 2 * Math.sin((rat.p * Math.PI) / rat.q);
                if (Math.abs(candidate - value) < 1e-6) {
                    return { type: '2sin', k: rat.p, n: rat.q, value: candidate, sign: sign };
                }
            }
        }
    }
    
    return null;
}

export function detectTrigEigenvalues(eigenvalues, polyCoeffs) {
    const results = [];
    const seen = new Set();
    
    for (const ev of eigenvalues) {
        const value = typeof ev === 'number' ? ev : ev.value;
        if (value === undefined || isNaN(value)) continue;
        
        const key = value.toFixed(6);
        if (seen.has(key)) continue;
        seen.add(key);
        
        const trig = detectTrigValue(value, polyCoeffs);
        if (trig) {
            results.push({
                numericValue: value,
                trigForm: trig,
                multiplicity: ev.multiplicity || 1
            });
        }
    }
    
    return results;
}

export function formatTrigForm(trig) {
    const k = trig.k;
    const n = trig.n;
    
    let fracStr;
    if (k === 1) {
        fracStr = `π/${n}`;
    } else {
        fracStr = `${k}π/${n}`;
    }
    
    switch (trig.type) {
        case 'cos':
            return `cos(${fracStr})`;
        case '2cos':
            return `2cos(${fracStr})`;
        case 'sin':
            return trig.sign < 0 ? `-sin(${fracStr})` : `sin(${fracStr})`;
        case '2sin':
            return trig.sign < 0 ? `-2sin(${fracStr})` : `2sin(${fracStr})`;
        default:
            return `${trig.type}(${fracStr})`;
    }
}

// =====================================================
// GRAPH PROPERTIES
// =====================================================

export function computeGraphProperties() {
    const n = state.vertexMeshes.length;
    
    // Safety check
    if (n === 0 || !state.symmetricAdjMatrix || state.symmetricAdjMatrix.length !== n || !state.symmetricAdjMatrix[0]) {
        return {
            vertices: n,
            edges: 0,
            connected: false,
            bipartite: false,
            regular: false,
            degree: null
        };
    }
    
    const bipartite = checkBipartite();
    
    let totalEdges = 0;
    let isRegular = true;
    let degree = 0;
    
    for (let j = 0; j < n; j++) {
        if (state.symmetricAdjMatrix[0][j] === 1) degree++;
    }
    
    for (let i = 0; i < n; i++) {
        if (!state.symmetricAdjMatrix[i]) continue;
        let d = 0;
        for (let j = 0; j < n; j++) {
            if (state.symmetricAdjMatrix[i][j] === 1) d++;
        }
        if (i < n - 1) {
            for (let j = i + 1; j < n; j++) {
                if (state.symmetricAdjMatrix[i][j] === 1) totalEdges++;
            }
        }
        if (d !== degree) isRegular = false;
    }
    
    return {
        vertices: n,
        edges: totalEdges,
        connected: isConnected(),
        bipartite: bipartite.isBipartite,
        regular: isRegular,
        degree: isRegular ? degree : null
    };
}

// =====================================================
// CLOSED-FORM EIGENVALUE DETECTION
// =====================================================

/**
 * Detect if a numerical value matches a "nice" closed form
 * Now uses SpectralEngine for comprehensive pattern matching
 * Returns { isNice: bool, form: string }
 */
export function detectClosedForm(value, tolerance = 1e-6, n = 10) {
    const result = SpectralEngine.identifyClosedForm(value, n, tolerance);
    return {
        isNice: result.isExact,
        form: result.formula,
        type: result.type
    };
}

/**
 * Analyze all eigenvalues and return closed-form representations
 * Now uses SpectralEngine.analyzeSpectrum for robust detection
 * Returns { allAnalytic: bool, eigenvalues: [{value, multiplicity, form, isNice}] }
 */
export function analyzeEigenvaluesForClosedForms(eigenvalues, tolerance = 1e-6) {
    // Determine n from eigenvalue count (assuming square matrix)
    const n = eigenvalues.length;
    
    const analysis = SpectralEngine.analyzeSpectrum(eigenvalues, n, tolerance);
    
    // Convert to legacy format for backward compatibility
    return {
        allAnalytic: analysis.allAnalytic,
        eigenvalues: analysis.eigenvalues.map(e => ({
            value: e.value,
            multiplicity: e.multiplicity,
            form: e.form,
            isNice: e.isExact,
            type: e.type
        }))
    };
}

/**
 * Analyze eigenvalues with explicit graph size n for proper denominator detection
 * Use this when the number of eigenvalues differs from graph size (e.g., unique values only)
 */
export function analyzeEigenvaluesForClosedFormsWithN(eigenvalues, graphSize, tolerance = 1e-6) {
    const analysis = SpectralEngine.analyzeSpectrum(eigenvalues, graphSize, tolerance);
    
    return {
        allAnalytic: analysis.allAnalytic,
        eigenvalues: analysis.eigenvalues.map(e => ({
            value: e.value,
            multiplicity: e.multiplicity,
            form: e.form,
            isNice: e.isExact,
            type: e.type
        }))
    };
}

/**
 * Format eigenvalues as a readable formula string
 */
export function formatAnalyticEigenvalues(analysis) {
    if (!analysis || !analysis.eigenvalues || analysis.eigenvalues.length === 0) {
        return null;
    }
    
    const parts = analysis.eigenvalues.map(e => {
        const mult = e.multiplicity > 1 ? ` (mult. ${e.multiplicity})` : '';
        return `λ = ${e.form}${mult}`;
    });
    
    return parts.join(', ');
}
