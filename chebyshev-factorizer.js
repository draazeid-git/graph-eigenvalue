/**
 * Chebyshev Polynomial Factorization for Graph Eigenvalues
 * 
 * This module implements detection and factorization of characteristic polynomials
 * whose roots follow Chebyshev polynomial patterns. Many graph families (paths, trees,
 * mechanisms, pendulums) have eigenvalues of the form:
 * 
 *   λ = 2·cos(k·π/m)  for various integers k and m
 * 
 * Key insight: The characteristic polynomial of path graph P_n is U_n(λ/2) where
 * U_n is the Chebyshev polynomial of the second kind. This generalizes to:
 * 
 * - Tree graphs: eigenvalues are 2·cos(k·π/m) for specific m values
 * - Mechanism graphs: after μ=λ² substitution, μ-roots are 4·cos²(k·π/m)
 * - Pendulum graphs: similar structure with different m parameters
 * 
 * The factorization yields closed-form eigenvalues even when the polynomial
 * coefficients are large integers that don't factor nicely.
 */

class ChebyshevFactorizer {
    
    /**
     * Main entry point: Attempt to factor polynomial using Chebyshev patterns
     * 
     * @param {number[]} coeffs - Polynomial coefficients [a_n, a_{n-1}, ..., a_0]
     * @param {Object} options - Configuration options
     * @returns {Object} Factorization result with Chebyshev forms
     */
    static factorize(coeffs, options = {}) {
        const {
            tolerance = 1e-8,
            maxDenominator = 200,  // Max m to try in cos(kπ/m)
            verbose = false
        } = options;
        
        const result = {
            success: false,
            method: null,
            roots: [],
            factors: [],
            chebyshevParameter: null,
            factorization: '',
            originalDegree: coeffs.length - 1
        };
        
        // Step 1: Factor out zero roots
        let remaining = [...coeffs];
        let zeroCount = 0;
        while (remaining.length > 1 && Math.abs(remaining[remaining.length - 1]) < 1e-10) {
            zeroCount++;
            remaining.pop();
        }
        
        if (zeroCount > 0) {
            result.factors.push({ type: 'zero', multiplicity: zeroCount, form: `λ^${zeroCount}` });
            for (let i = 0; i < zeroCount; i++) {
                result.roots.push({ value: 0, form: '0', exact: true, chebyshev: null });
            }
        }
        
        if (remaining.length <= 1) {
            result.success = true;
            result.method = 'trivial';
            result.factorization = this.buildFactorizationString(result);
            return result;
        }
        
        // Step 2: Check for even/odd power structure (bipartite graphs)
        const parity = this.analyzePolynomialParity(remaining);
        
        if (parity === 'even' || parity === 'odd') {
            // Use μ = λ² substitution
            const muResult = this.factorWithMuSubstitution(remaining, parity, options);
            if (muResult.success) {
                result.success = true;
                result.method = 'chebyshev_mu_substitution';
                result.roots.push(...muResult.roots);
                result.factors.push(...muResult.factors);
                result.chebyshevParameter = muResult.chebyshevParameter;
                result.factorization = this.buildFactorizationString(result);
                return result;
            }
        }
        
        // Step 3: Try direct Chebyshev matching on full polynomial
        const directResult = this.factorDirectChebyshev(remaining, options);
        if (directResult.success) {
            result.success = true;
            result.method = 'chebyshev_direct';
            result.roots.push(...directResult.roots);
            result.factors.push(...directResult.factors);
            result.chebyshevParameter = directResult.chebyshevParameter;
            result.factorization = this.buildFactorizationString(result);
            return result;
        }
        
        // Step 4: Try multiple Chebyshev parameters (for composite graphs)
        const multiResult = this.factorMultipleChebyshev(remaining, options);
        if (multiResult.success) {
            result.success = true;
            result.method = 'chebyshev_composite';
            result.roots.push(...multiResult.roots);
            result.factors.push(...multiResult.factors);
            result.chebyshevParameters = multiResult.parameters;
            result.factorization = this.buildFactorizationString(result);
            return result;
        }
        
        // Fallback: numerical roots with pattern matching
        result.method = 'numerical_fallback';
        const numRoots = this.findRootsNumerically(remaining);
        for (const val of numRoots) {
            const chebyForm = this.identifyChebyshevForm(val, maxDenominator, tolerance);
            result.roots.push({
                value: val,
                form: chebyForm ? chebyForm.form : val.toFixed(6),
                exact: chebyForm !== null,
                chebyshev: chebyForm
            });
        }
        
        result.success = result.roots.some(r => r.exact);
        result.factorization = this.buildFactorizationString(result);
        return result;
    }
    
    /**
     * Factor polynomial after μ = λ² substitution
     * For polynomials with only even (or odd) powers
     */
    static factorWithMuSubstitution(coeffs, parity, options) {
        const { tolerance = 1e-8, maxDenominator = 200 } = options;
        
        // Extract μ-polynomial coefficients
        let muCoeffs;
        let extraZero = false;
        
        if (parity === 'odd') {
            // Factor out one λ first, then extract even powers
            extraZero = true;
            muCoeffs = this.extractMuCoeffsFromOdd(coeffs);
        } else {
            muCoeffs = this.extractMuCoeffsFromEven(coeffs);
        }
        
        const result = {
            success: false,
            roots: [],
            factors: [],
            chebyshevParameter: null
        };
        
        if (extraZero) {
            result.roots.push({ value: 0, form: '0', exact: true, chebyshev: null });
            result.factors.push({ type: 'linear', form: 'λ' });
        }
        
        // Find μ-roots numerically
        const muRoots = this.findRootsNumerically(muCoeffs);
        
        if (muRoots.length === 0) {
            return result;
        }
        
        // Try to find a common Chebyshev parameter m such that:
        // μ_j = 4·cos²(k_j·π/m) for integer k_j
        const chebyshevMatch = this.findChebyshevParameter(muRoots, maxDenominator, tolerance, true);
        
        if (chebyshevMatch.success) {
            result.success = true;
            result.chebyshevParameter = chebyshevMatch.m;
            
            // Build roots with Chebyshev forms
            for (const match of chebyshevMatch.matches) {
                const mu = match.value;
                const k = match.k;
                const m = chebyshevMatch.m;
                
                // μ = 4cos²(kπ/m), so λ = ±2cos(kπ/m)
                const lambda = 2 * Math.cos(k * Math.PI / m);
                
                // Simplify the form
                const form = this.simplifyCosineForm(k, m);
                
                result.roots.push({
                    value: lambda,
                    form: form,
                    exact: true,
                    chebyshev: { k, m, type: 'cos' }
                });
                result.roots.push({
                    value: -lambda,
                    form: `-${form}`,
                    exact: true,
                    chebyshev: { k, m, type: 'cos', negative: true }
                });
                
                result.factors.push({
                    type: 'quadratic_chebyshev',
                    k, m,
                    form: `(λ² - 4cos²(${k}π/${m}))`
                });
            }
        } else {
            // Try individual pattern matching for each μ-root
            let allMatched = true;
            const usedParams = new Set();
            
            for (const mu of muRoots) {
                if (mu < 0) {
                    // Negative μ gives imaginary λ
                    const imag = Math.sqrt(-mu);
                    result.roots.push({
                        value: imag,
                        form: `${imag.toFixed(6)}i`,
                        exact: false,
                        isImaginary: true
                    });
                    continue;
                }
                
                const lambda = Math.sqrt(mu);
                const chebyForm = this.identifyChebyshevForm(lambda, maxDenominator, tolerance);
                
                if (chebyForm) {
                    usedParams.add(chebyForm.m);
                    result.roots.push({
                        value: lambda,
                        form: chebyForm.form,
                        exact: true,
                        chebyshev: chebyForm
                    });
                    result.roots.push({
                        value: -lambda,
                        form: `-${chebyForm.form}`,
                        exact: true,
                        chebyshev: { ...chebyForm, negative: true }
                    });
                } else {
                    allMatched = false;
                    result.roots.push({
                        value: lambda,
                        form: lambda.toFixed(6),
                        exact: false,
                        chebyshev: null
                    });
                    result.roots.push({
                        value: -lambda,
                        form: (-lambda).toFixed(6),
                        exact: false,
                        chebyshev: null
                    });
                }
            }
            
            result.success = allMatched || result.roots.filter(r => r.exact).length > result.roots.length / 2;
            if (usedParams.size === 1) {
                result.chebyshevParameter = [...usedParams][0];
            }
        }
        
        return result;
    }
    
    /**
     * Direct Chebyshev factorization for polynomials whose roots are 2cos(kπ/m)
     */
    static factorDirectChebyshev(coeffs, options) {
        const { tolerance = 1e-8, maxDenominator = 200 } = options;
        
        const roots = this.findRootsNumerically(coeffs);
        const chebyshevMatch = this.findChebyshevParameter(roots, maxDenominator, tolerance, false);
        
        const result = {
            success: chebyshevMatch.success,
            roots: [],
            factors: [],
            chebyshevParameter: chebyshevMatch.success ? chebyshevMatch.m : null
        };
        
        if (chebyshevMatch.success) {
            for (const match of chebyshevMatch.matches) {
                const form = this.simplifyCosineForm(match.k, chebyshevMatch.m);
                result.roots.push({
                    value: match.value,
                    form: form,
                    exact: true,
                    chebyshev: { k: match.k, m: chebyshevMatch.m, type: 'cos' }
                });
                result.factors.push({
                    type: 'linear_chebyshev',
                    k: match.k,
                    m: chebyshevMatch.m,
                    form: `(λ - 2cos(${match.k}π/${chebyshevMatch.m}))`
                });
            }
        }
        
        return result;
    }
    
    /**
     * Try to factor using multiple Chebyshev parameters
     * (for graphs that combine different path-like structures)
     */
    static factorMultipleChebyshev(coeffs, options) {
        const { tolerance = 1e-8, maxDenominator = 200 } = options;
        
        const roots = this.findRootsNumerically(coeffs);
        const result = {
            success: false,
            roots: [],
            factors: [],
            parameters: []
        };
        
        const unmatched = [];
        const matchedRoots = [];
        
        for (const val of roots) {
            const chebyForm = this.identifyChebyshevForm(val, maxDenominator, tolerance);
            if (chebyForm) {
                matchedRoots.push({
                    value: val,
                    form: chebyForm.form,
                    exact: true,
                    chebyshev: chebyForm
                });
                if (!result.parameters.includes(chebyForm.m)) {
                    result.parameters.push(chebyForm.m);
                }
            } else {
                unmatched.push(val);
            }
        }
        
        // Consider successful if we matched most roots
        result.success = matchedRoots.length >= roots.length * 0.8;
        result.roots = matchedRoots;
        
        // Add unmatched as numerical
        for (const val of unmatched) {
            result.roots.push({
                value: val,
                form: val.toFixed(6),
                exact: false,
                chebyshev: null
            });
        }
        
        return result;
    }
    
    /**
     * Find a common Chebyshev parameter m such that all roots fit the pattern
     * 
     * @param {number[]} roots - Array of root values
     * @param {number} maxM - Maximum m to try
     * @param {number} tolerance - Matching tolerance
     * @param {boolean} isSquared - If true, roots are 4cos²(kπ/m), else 2cos(kπ/m)
     */
    static findChebyshevParameter(roots, maxM, tolerance, isSquared) {
        const result = { success: false, m: null, matches: [] };
        
        // Try each possible m value
        for (let m = 3; m <= maxM; m++) {
            const matches = [];
            let allMatched = true;
            
            for (const root of roots) {
                let matched = false;
                
                for (let k = 1; k < m; k++) {
                    let expected;
                    if (isSquared) {
                        // μ = 4cos²(kπ/m)
                        expected = 4 * Math.cos(k * Math.PI / m) ** 2;
                    } else {
                        // λ = 2cos(kπ/m)
                        expected = 2 * Math.cos(k * Math.PI / m);
                    }
                    
                    if (Math.abs(root - expected) < tolerance) {
                        matches.push({ value: root, k, expected });
                        matched = true;
                        break;
                    }
                }
                
                if (!matched) {
                    allMatched = false;
                    break;
                }
            }
            
            if (allMatched && matches.length === roots.length) {
                result.success = true;
                result.m = m;
                result.matches = matches;
                return result;
            }
        }
        
        return result;
    }
    
    /**
     * Identify if a single value is of the form 2cos(kπ/m)
     */
    static identifyChebyshevForm(value, maxM = 200, tolerance = 1e-8) {
        const absVal = Math.abs(value);
        
        // Quick check: must be in range [-2, 2] for 2cos form
        if (absVal > 2 + tolerance) {
            return null;
        }
        
        // Check for exact simple values first
        const simpleChecks = [
            { val: 0, k: 1, m: 2, form: '0' },
            { val: 1, k: 1, m: 3, form: '1' },
            { val: -1, k: 2, m: 3, form: '-1' },
            { val: 2, k: 0, m: 1, form: '2' },
            { val: -2, k: 1, m: 1, form: '-2' },
            { val: Math.sqrt(2), k: 1, m: 4, form: '√2' },
            { val: -Math.sqrt(2), k: 3, m: 4, form: '-√2' },
            { val: Math.sqrt(3), k: 1, m: 6, form: '√3' },
            { val: -Math.sqrt(3), k: 5, m: 6, form: '-√3' },
            { val: (1 + Math.sqrt(5)) / 2, k: 1, m: 5, form: 'φ' },  // Golden ratio
            { val: (Math.sqrt(5) - 1) / 2, k: 2, m: 5, form: '1/φ' },
            { val: Math.sqrt(5), k: 1, m: 10, form: '√5' },  // Actually 2cos(π/5) ≈ 1.618
        ];
        
        for (const check of simpleChecks) {
            if (Math.abs(absVal - check.val) < tolerance) {
                const sign = value >= 0 ? 1 : -1;
                return {
                    k: check.k,
                    m: check.m,
                    form: sign < 0 && !check.form.startsWith('-') ? `-${check.form}` : check.form,
                    type: 'cos'
                };
            }
        }
        
        // General search for 2cos(kπ/m)
        for (let m = 3; m <= maxM; m++) {
            for (let k = 1; k < m; k++) {
                if (this.gcd(k, m) !== 1 && k !== 1) continue;  // Skip non-primitive, but keep k=1
                
                const expected = 2 * Math.cos(k * Math.PI / m);
                
                if (Math.abs(value - expected) < tolerance) {
                    return {
                        k, m,
                        form: this.simplifyCosineForm(k, m),
                        type: 'cos'
                    };
                }
                if (Math.abs(value + expected) < tolerance) {
                    return {
                        k: m - k, m,
                        form: this.simplifyCosineForm(m - k, m),
                        type: 'cos',
                        negative: true
                    };
                }
            }
        }
        
        return null;
    }
    
    /**
     * Simplify 2cos(kπ/m) to a nice form when possible
     */
    static simplifyCosineForm(k, m) {
        // Reduce k/m to lowest terms
        const g = this.gcd(k, m);
        const kRed = k / g;
        const mRed = m / g;
        
        // Check for known nice values
        const knownForms = {
            '1/2': '0',           // cos(π/2) = 0
            '1/3': '1',           // 2cos(π/3) = 1
            '2/3': '-1',          // 2cos(2π/3) = -1
            '1/4': '√2',          // 2cos(π/4) = √2
            '3/4': '-√2',         // 2cos(3π/4) = -√2
            '1/6': '√3',          // 2cos(π/6) = √3
            '5/6': '-√3',         // 2cos(5π/6) = -√3
            '1/5': '(1+√5)/2',    // 2cos(π/5) = φ (golden ratio * something)
            '2/5': '(√5-1)/2',    // 2cos(2π/5)
            '0/1': '2',           // cos(0) = 1
            '1/1': '-2',          // cos(π) = -1
        };
        
        const key = `${kRed}/${mRed}`;
        if (knownForms[key]) {
            return knownForms[key];
        }
        
        // For general case, return the cosine form
        if (mRed === 1) {
            return kRed === 0 ? '2' : '-2';
        }
        
        return `2cos(${kRed}π/${mRed})`;
    }
    
    /**
     * Analyze polynomial parity (even powers only, odd powers only, or mixed)
     */
    static analyzePolynomialParity(coeffs) {
        let hasEven = false;
        let hasOdd = false;
        
        for (let i = 0; i < coeffs.length; i++) {
            const power = coeffs.length - 1 - i;
            if (Math.abs(coeffs[i]) > 1e-10) {
                if (power % 2 === 0) hasEven = true;
                else hasOdd = true;
            }
        }
        
        if (hasEven && !hasOdd) return 'even';
        if (hasOdd && !hasEven) return 'odd';
        return 'mixed';
    }
    
    /**
     * Extract μ-polynomial coefficients from even-power polynomial
     * p(λ) = a_n λ^n + a_{n-2} λ^{n-2} + ... → q(μ) = a_n μ^{n/2} + a_{n-2} μ^{(n-2)/2} + ...
     */
    static extractMuCoeffsFromEven(coeffs) {
        const muCoeffs = [];
        for (let i = 0; i < coeffs.length; i += 2) {
            muCoeffs.push(coeffs[i]);
        }
        return muCoeffs;
    }
    
    /**
     * Extract μ-polynomial coefficients from odd-power polynomial
     * p(λ) = λ·(a_n λ^{n-1} + ...) → q(μ) from the even polynomial
     */
    static extractMuCoeffsFromOdd(coeffs) {
        // First, this should already be an even-power poly after factoring λ
        const muCoeffs = [];
        for (let i = 0; i < coeffs.length; i += 2) {
            muCoeffs.push(coeffs[i]);
        }
        return muCoeffs;
    }
    
    /**
     * Find polynomial roots numerically using Newton-Raphson with deflation
     */
    static findRootsNumerically(coeffs) {
        const roots = [];
        let remaining = [...coeffs];
        
        // Remove trailing zeros first
        while (remaining.length > 1 && Math.abs(remaining[remaining.length - 1]) < 1e-10) {
            roots.push(0);
            remaining.pop();
        }
        
        const evalPoly = (x) => remaining.reduce((r, c) => r * x + c, 0);
        const evalDeriv = (x) => {
            let r = 0;
            for (let i = 0; i < remaining.length - 1; i++) {
                r = r * x + remaining[i] * (remaining.length - 1 - i);
            }
            return r;
        };
        
        const newton = (guess) => {
            let x = guess;
            for (let iter = 0; iter < 100; iter++) {
                const fx = evalPoly(x);
                const dfx = evalDeriv(x);
                if (Math.abs(dfx) < 1e-15) break;
                const newX = x - fx / dfx;
                if (Math.abs(newX - x) < 1e-14) return newX;
                x = newX;
            }
            return x;
        };
        
        const degree = remaining.length - 1;
        for (let attempt = 0; attempt < degree && remaining.length > 1; attempt++) {
            let foundRoot = null;
            
            // Try various starting points
            for (let start = -10; start <= 10; start += 0.2) {
                const candidate = newton(start);
                if (Math.abs(evalPoly(candidate)) < 1e-8) {
                    if (!roots.some(r => Math.abs(r - candidate) < 1e-6)) {
                        foundRoot = candidate;
                        break;
                    }
                }
            }
            
            if (foundRoot !== null) {
                roots.push(Math.round(foundRoot * 1e10) / 1e10);
                
                // Deflate polynomial by dividing by (x - root)
                const newRemaining = [remaining[0]];
                for (let i = 1; i < remaining.length - 1; i++) {
                    newRemaining.push(remaining[i] + foundRoot * newRemaining[i - 1]);
                }
                remaining = newRemaining;
            } else {
                break;
            }
        }
        
        return roots.sort((a, b) => Math.abs(b) - Math.abs(a));
    }
    
    /**
     * Greatest common divisor
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
     * Build human-readable factorization string
     */
    static buildFactorizationString(result) {
        const parts = [];
        
        // Zero factors
        const zeros = result.factors.filter(f => f.type === 'zero');
        if (zeros.length > 0) {
            parts.push(zeros[0].form);
        }
        
        // Chebyshev factors
        const chebyFactors = result.factors.filter(f => 
            f.type === 'quadratic_chebyshev' || f.type === 'linear_chebyshev');
        
        if (chebyFactors.length > 0) {
            // Group by m value
            const byM = {};
            for (const f of chebyFactors) {
                const m = f.m;
                if (!byM[m]) byM[m] = [];
                byM[m].push(f);
            }
            
            for (const m of Object.keys(byM).sort((a, b) => a - b)) {
                const factors = byM[m];
                const ks = factors.map(f => f.k).sort((a, b) => a - b);
                
                if (factors[0].type === 'quadratic_chebyshev') {
                    parts.push(`∏_{k∈{${ks.join(',')}}}(λ² - 4cos²(kπ/${m}))`);
                } else {
                    parts.push(`∏_{k∈{${ks.join(',')}}}(λ - 2cos(kπ/${m}))`);
                }
            }
        }
        
        return parts.join(' · ') || '1';
    }
    
    /**
     * Specialized factorization for n-bar mechanism polynomials
     */
    static factorMechanismPolynomial(coeffs, nBars) {
        const result = this.factorize(coeffs, {
            maxDenominator: 4 * nBars + 50,
            tolerance: 1e-7
        });
        
        result.graphType = 'n-bar_mechanism';
        result.n = nBars;
        
        return result;
    }
    
    /**
     * Specialized factorization for n-link pendulum polynomials
     */
    static factorPendulumPolynomial(coeffs, nLinks) {
        const result = this.factorize(coeffs, {
            maxDenominator: 4 * nLinks + 50,
            tolerance: 1e-7
        });
        
        result.graphType = 'n-link_pendulum';
        result.n = nLinks;
        
        return result;
    }
}

// Export for use in browser and Node.js
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { ChebyshevFactorizer };
}

// ES6 export for browser modules
export { ChebyshevFactorizer };
