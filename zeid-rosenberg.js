/**
 * Zeid-Rosenberg Eigenvalue Bounds Module
 * Based on: "Estimating Eigenvalues for a Class of Dynamic Systems" (1985)
 *           "Some Bond Graph Structural Properties: Eigen Spectra and Stability" (1989)
 * 
 * Provides eigenvalue bounds from point graph topology without computing state equations
 */

import { state } from './graph-core.js';

// ============================================================================
// POINT GRAPH TOPOLOGY DETECTION
// ============================================================================

/**
 * Detect the topology of the current graph as a point graph
 * Returns topology type and relevant parameters
 */
export function detectPointGraphTopology() {
    const n = state.vertexMeshes.length;
    if (n === 0) return { type: 'empty', description: 'No nodes', N: 0 };
    if (n === 1) return { type: 'single', description: 'Single node', N: 1 };
    
    const adj = state.symmetricAdjMatrix;
    const degrees = [];
    let edgeCount = 0;
    
    for (let i = 0; i < n; i++) {
        let deg = 0;
        for (let j = 0; j < n; j++) {
            if (adj[i][j] === 1) {
                deg++;
                if (j > i) edgeCount++;
            }
        }
        degrees.push(deg);
    }
    
    const maxDeg = Math.max(...degrees);
    const minDeg = Math.min(...degrees);
    const deg1Count = degrees.filter(d => d === 1).length;
    const deg2Count = degrees.filter(d => d === 2).length;
    const degCounts = {};
    degrees.forEach(d => { degCounts[d] = (degCounts[d] || 0) + 1; });
    
    // Path: two degree-1 endpoints, rest degree-2
    if (deg1Count === 2 && deg2Count === n - 2 && edgeCount === n - 1) {
        return { type: 'path', description: `Path P${n}`, N: n };
    }
    
    // Cycle: all degree 2, N edges
    if (minDeg === 2 && maxDeg === 2 && edgeCount === n) {
        return { type: 'cycle', description: `Cycle C${n}`, N: n };
    }
    
    // Star: one hub with degree N-1, all others degree 1
    if (maxDeg === n - 1 && minDeg === 1 && deg1Count === n - 1) {
        return { type: 'star', description: `Star S${n}`, N: n };
    }
    
    // S'_p Tree (N = 2p + 1): one center of degree p, p vertices of degree 2, p leaves of degree 1
    // Check for odd n >= 3 where n = 2p + 1
    if (n >= 3 && n % 2 === 1 && edgeCount === n - 1) {
        const p = (n - 1) / 2;
        // Should have: 1 vertex of degree p, p vertices of degree 2, p vertices of degree 1
        if (degCounts[p] === 1 && degCounts[2] === p && degCounts[1] === p) {
            return { type: 'star_path', description: `S'${p} Tree (N=${n})`, p, N: n };
        }
    }
    
    // S²_p Tree (N = 3p + 1): center of degree p, then two levels before leaves
    // Should have: 1 vertex of degree p, p vertices of degree 2, p vertices of degree 2, p leaves of degree 1
    if (n >= 4 && (n - 1) % 3 === 0 && edgeCount === n - 1) {
        const p = (n - 1) / 3;
        // Should have: 1 vertex of degree p, 2p vertices of degree 2, p vertices of degree 1
        if (degCounts[p] === 1 && degCounts[2] === 2 * p && degCounts[1] === p) {
            return { type: 'double_star', description: `S²${p} Tree (N=${n})`, p, N: n };
        }
    }
    
    // General Sᵈ_p Tree: N = d*p + 1, any depth d >= 2
    // 1 vertex of degree p, (d-1)*p vertices of degree 2, p vertices of degree 1
    if (edgeCount === n - 1) {
        for (let p = 2; p <= Math.floor((n - 1) / 2); p++) {
            if ((n - 1) % p === 0) {
                const d = (n - 1) / p;
                if (d >= 4 && degCounts[p] === 1 && degCounts[2] === (d - 1) * p && degCounts[1] === p) {
                    return { type: 'general_star_tree', description: `S${d}${p} Tree (d=${d}, p=${p})`, d, p, N: n };
                }
            }
        }
    }
    
    // Complete: all degrees = N-1
    if (minDeg === n - 1 && maxDeg === n - 1) {
        return { type: 'complete', description: `Complete K${n}`, N: n };
    }
    
    // Grid detection
    for (let m = 2; m <= Math.sqrt(n); m++) {
        if (n % m === 0) {
            const cols = n / m;
            const expectedEdges = m * (cols - 1) + cols * (m - 1);
            if (edgeCount === expectedEdges) {
                return { type: 'grid', description: `Grid ${m}×${cols}`, m, n: cols, N: n };
            }
            // General ladder (truss): grid + diagonals
            // Has (m-1) rows of diagonals with (cols-1) diagonals each
            const trussEdges = expectedEdges + (m - 1) * (cols - 1);
            if (edgeCount === trussEdges) {
                return { type: 'general_ladder', description: `General Ladder ${m}×${cols}`, m, n: cols, N: n };
            }
        }
    }
    
    // Ladder detection
    if (n % 2 === 0) {
        const len = n / 2;
        const expectedEdges = 3 * len - 2;
        if (edgeCount === expectedEdges) {
            return { type: 'ladder', description: `Ladder L${len}`, len, N: n };
        }
        // Circular ladder (prism)
        const circularEdges = 3 * len;
        if (edgeCount === circularEdges) {
            return { type: 'circular_ladder', description: `Circular Ladder (${len})`, len, N: n };
        }
    }
    
    // Wheel: one center connected to all, rim forms cycle
    const hubCandidates = degrees.map((d, i) => ({ deg: d, idx: i })).filter(x => x.deg === n - 1);
    if (hubCandidates.length === 1) {
        const hubIdx = hubCandidates[0].idx;
        const rimDegrees = degrees.filter((_, i) => i !== hubIdx);
        if (rimDegrees.every(d => d === 3) && edgeCount === 2 * (n - 1)) {
            return { type: 'wheel', description: `Wheel W${n}`, N: n };
        }
    }
    
    // Hypercube check
    const dim = Math.log2(n);
    if (Number.isInteger(dim) && edgeCount === n * dim / 2) {
        return { type: 'hypercube', description: `Hypercube Q${dim}`, dim, N: n };
    }
    
    // Generic tree detection (N-1 edges, connected)
    if (edgeCount === n - 1) {
        return { type: 'tree', description: `Tree (N=${n})`, N: n };
    }
    
    return { type: 'general', description: `General (N=${n}, E=${edgeCount})`, N: n, edgeCount };
}

// ============================================================================
// TABLE I: KNOWN SPECTRA FORMULAS
// ============================================================================

/**
 * Compute eigenvalue spectrum and bounds using Table I formulas
 * @param {Object} topology - Result from detectPointGraphTopology
 * @param {number} alpha - Normalized resistance parameter (R-star / I)
 * @param {number} beta - Normalized gyrator modulus (r-star_ij)
 * @returns {Object} Eigenvalues and bounds
 */
export function computeSpectrum(topology, alpha = 1.0, beta = 1.0) {
    const N = topology.N || 1;
    if (N < 2) {
        return { 
            eigenvalues: [], 
            b1_over_beta: 0, 
            exactSpectrum: false,
            realBounds: [0, 0],
            imagBounds: [0, 0]
        };
    }
    
    let eigenvalues = [];
    let b1_over_beta = 0;
    let exactSpectrum = false;

    switch (topology.type) {
        case 'path': {
            // Path Pₙ: λₖ = -α ± iβ·2cos(kπ/(N+1)), k = 1,...,N
            // (cos formula is correct for the Zeid-Rosenberg bound theory)
            exactSpectrum = true;
            for (let k = 1; k <= N; k++) {
                const imag = 2 * Math.cos(k * Math.PI / (N + 1));
                eigenvalues.push({ re: -alpha, im: imag * beta });
            }
            b1_over_beta = 2 * Math.cos(Math.PI / (N + 1));
            break;
        }

        case 'cycle': {
            // Cycle Cₙ (Skew-symmetric): λₖ = -α ± iβ·2sin(2kπ/N)
            // Using sin instead of cos for correct skew-symmetric spectrum
            exactSpectrum = true;
            for (let k = 0; k < N; k++) {
                const imag = 2 * Math.sin(2 * k * Math.PI / N);
                eigenvalues.push({ re: -alpha, im: imag * beta });
            }
            b1_over_beta = 2;
            break;
        }

        case 'star': {
            // Star Sₙ: λ = ±iβ√(N-1), plus (N-2) zeros
            exactSpectrum = true;
            const starEig = Math.sqrt(N - 1);
            eigenvalues.push({ re: -alpha, im: starEig * beta });
            eigenvalues.push({ re: -alpha, im: -starEig * beta });
            for (let i = 0; i < N - 2; i++) {
                eigenvalues.push({ re: -alpha, im: 0 });
            }
            b1_over_beta = starEig;
            break;
        }

        case 'complete': {
            // Complete Kₙ (Skew-symmetric): λₖ = ±iβ·cot((2k-1)π/2N), k = 1,...,floor(N/2)
            exactSpectrum = true;
            b1_over_beta = 1 / Math.tan(Math.PI / (2 * N));
            
            for (let k = 1; k <= Math.floor(N / 2); k++) {
                const imag = 1 / Math.tan((2 * k - 1) * Math.PI / (2 * N));
                eigenvalues.push({ re: -alpha, im: imag * beta });
                eigenvalues.push({ re: -alpha, im: -imag * beta });
            }
            // For odd N, add zero eigenvalue
            if (N % 2 === 1) {
                eigenvalues.push({ re: -alpha, im: 0 });
            }
            break;
        }

        case 'grid': {
            // Grid m×n: product of path spectra
            exactSpectrum = true;
            const m = topology.m;
            const cols = topology.n;
            for (let j = 1; j <= m; j++) {
                for (let k = 1; k <= cols; k++) {
                    const imag = 2 * Math.cos(j * Math.PI / (m + 1)) + 2 * Math.cos(k * Math.PI / (cols + 1));
                    eigenvalues.push({ re: -alpha, im: imag * beta });
                }
            }
            b1_over_beta = 2 * Math.cos(Math.PI / (m + 1)) + 2 * Math.cos(Math.PI / (cols + 1));
            break;
        }

        case 'ladder': {
            // Ladder: 2cos(kπ/(n+1)) ± 1
            exactSpectrum = true;
            const len = topology.len;
            for (let k = 1; k <= len; k++) {
                const base = 2 * Math.cos(k * Math.PI / (len + 1));
                eigenvalues.push({ re: -alpha, im: (base + 1) * beta });
                eigenvalues.push({ re: -alpha, im: (base - 1) * beta });
            }
            b1_over_beta = 2 * Math.cos(Math.PI / (len + 1)) + 1;
            break;
        }

        case 'general_ladder': {
            // General Ladder (Truss): From paper
            // λ = i(2cos(kπ/(n+1)) ± √(m+1)), i·2cos(kπ/(n+1))
            // k = 1, 2, ..., n; the entry i2cos(kπ/(n+1)) repeated (m+2) times
            exactSpectrum = true;
            const m = topology.m;
            const cols = topology.n;
            const sqrtM1 = Math.sqrt(m + 1);
            
            for (let k = 1; k <= cols; k++) {
                const base = 2 * Math.cos(k * Math.PI / (cols + 1));
                // Eigenvalues with ±√(m+1)
                eigenvalues.push({ re: -alpha, im: (base + sqrtM1) * beta });
                eigenvalues.push({ re: -alpha, im: (base - sqrtM1) * beta });
                // Base eigenvalue repeated (m-1) more times to make m+1 total rows
                for (let j = 0; j < m - 1; j++) {
                    eigenvalues.push({ re: -alpha, im: base * beta });
                }
            }
            b1_over_beta = 2 * Math.cos(Math.PI / (cols + 1)) + sqrtM1;
            break;
        }

        case 'hypercube': {
            // Hypercube Qd: λₖ = d - 2k with multiplicity C(d,k)
            exactSpectrum = true;
            const d = topology.dim;
            for (let k = 0; k <= d; k++) {
                const imag = d - 2 * k;
                const mult = factorial(d) / (factorial(k) * factorial(d - k));
                for (let m = 0; m < mult; m++) {
                    eigenvalues.push({ re: -alpha, im: imag * beta });
                }
            }
            b1_over_beta = d;
            break;
        }

        case 'wheel': {
            // Wheel: approximate bound
            exactSpectrum = false;
            b1_over_beta = Math.sqrt(N - 1) + 1;
            eigenvalues.push({ re: -alpha, im: b1_over_beta * beta, approx: true });
            eigenvalues.push({ re: -alpha, im: -b1_over_beta * beta, approx: true });
            break;
        }

        case 'star_path': {
            // S'_p Tree (N = 2p + 1): From Appendix
            // Spectrum: (±i√(p+1), ±i, ±i, ..., ±i, 0)
            // One zero eigenvalue, (N-3) eigenvalues with |λ| = 1
            exactSpectrum = true;
            const p = topology.p || (N - 1) / 2;
            const sqrtP1 = Math.sqrt(p + 1);
            
            // ±i√(p+1)
            eigenvalues.push({ re: -alpha, im: sqrtP1 * beta });
            eigenvalues.push({ re: -alpha, im: -sqrtP1 * beta });
            
            // (p-1) pairs of ±i (eigenvalues with absolute value 1)
            for (let i = 0; i < p - 1; i++) {
                eigenvalues.push({ re: -alpha, im: beta });
                eigenvalues.push({ re: -alpha, im: -beta });
            }
            
            // One zero eigenvalue
            eigenvalues.push({ re: -alpha, im: 0 });
            
            b1_over_beta = sqrtP1;
            break;
        }

        case 'double_star': {
            // S²_p Tree (N = 3p + 1): From Appendix
            // Spectrum: (±i√((p/2+1)±√((p/2)²+1)), ±i√2, ..., ±i√2, 0, ..., 0)
            // (p-1) eigenvalues = ±i√2, (p-1) zero eigenvalues
            exactSpectrum = true;
            const p = topology.p || (N - 1) / 3;
            
            // Main eigenvalue pair: ±i√((p/2+1) + √((p/2)² + 1))
            const halfP = p / 2;
            const innerSqrt = Math.sqrt(halfP * halfP + 1);
            const outerPlus = Math.sqrt(halfP + 1 + innerSqrt);
            const outerMinus = Math.sqrt(Math.abs(halfP + 1 - innerSqrt));
            
            eigenvalues.push({ re: -alpha, im: outerPlus * beta });
            eigenvalues.push({ re: -alpha, im: -outerPlus * beta });
            eigenvalues.push({ re: -alpha, im: outerMinus * beta });
            eigenvalues.push({ re: -alpha, im: -outerMinus * beta });
            
            // (p-1) pairs of ±i√2
            const sqrt2 = Math.sqrt(2);
            for (let i = 0; i < p - 1; i++) {
                eigenvalues.push({ re: -alpha, im: sqrt2 * beta });
                eigenvalues.push({ re: -alpha, im: -sqrt2 * beta });
            }
            
            // (p-1) zero eigenvalues
            for (let i = 0; i < p - 1; i++) {
                eigenvalues.push({ re: -alpha, im: 0 });
            }
            
            b1_over_beta = outerPlus;
            break;
        }

        case 'general_star_tree': {
            // Sᵈ_p Tree: General depth d star tree
            // For large d, use approximate bound based on tree structure
            exactSpectrum = false;
            const p = topology.p;
            const d = topology.d;
            
            // For Sᵈₚ trees, the maximum eigenvalue grows approximately with √d
            // Approximate bound: b₁/β ≈ √(p) * some function of d
            // Using numerical observation: max eigenvalue ≈ √(d) for large p
            b1_over_beta = Math.sqrt(d) * Math.sqrt(p / 2 + 1);
            eigenvalues.push({ re: -alpha, im: b1_over_beta * beta, approx: true });
            eigenvalues.push({ re: -alpha, im: -b1_over_beta * beta, approx: true });
            break;
        }

        case 'circular_ladder': {
            // Circular ladder (prism): similar to ladder but with cycles
            exactSpectrum = true;
            const len = topology.len || N / 2;
            for (let k = 0; k < len; k++) {
                const base = 2 * Math.cos(2 * k * Math.PI / len);
                eigenvalues.push({ re: -alpha, im: (base + 1) * beta });
                eigenvalues.push({ re: -alpha, im: (base - 1) * beta });
            }
            b1_over_beta = 3;  // Maximum is 2 + 1 = 3
            break;
        }

        case 'tree': {
            // General tree: bounded by star (worst case)
            exactSpectrum = false;
            b1_over_beta = Math.sqrt(N - 1);
            eigenvalues.push({ re: -alpha, im: b1_over_beta * beta, approx: true });
            eigenvalues.push({ re: -alpha, im: -b1_over_beta * beta, approx: true });
            break;
        }

        default: {
            // General bound: cot(π/2N)
            b1_over_beta = N > 1 ? 1 / Math.tan(Math.PI / (2 * N)) : 0;
            eigenvalues.push({ re: -alpha, im: b1_over_beta * beta, approx: true });
            eigenvalues.push({ re: -alpha, im: -b1_over_beta * beta, approx: true });
        }
    }

    // Remove duplicate eigenvalues
    const unique = [];
    eigenvalues.forEach(e => {
        if (!unique.some(u => Math.abs(u.re - e.re) < 0.0001 && Math.abs(u.im - e.im) < 0.0001)) {
            unique.push(e);
        }
    });

    return {
        eigenvalues: unique.sort((a, b) => b.im - a.im),
        b1_over_beta,
        exactSpectrum,
        realBounds: [-alpha, -alpha],
        imagBounds: [-b1_over_beta * beta, b1_over_beta * beta]
    };
}

function factorial(n) {
    return n <= 1 ? 1 : n * factorial(n - 1);
}

// ============================================================================
// DIRECT SUM OPERATION (Section III.3)
// ============================================================================

/**
 * Compute the direct sum of two graph spectra
 * G = G₁ + G₂: eigenvalues are all pairwise sums {aᵢ + bⱼ}
 */
export function computeDirectSum(spectrum1, spectrum2) {
    const eig1 = spectrum1.eigenvalues;
    const eig2 = spectrum2.eigenvalues;
    const sumEigenvalues = [];
    
    eig1.forEach(e1 => {
        eig2.forEach(e2 => {
            sumEigenvalues.push({
                re: e1.re + e2.re,
                im: e1.im + e2.im,
                approx: e1.approx || e2.approx
            });
        });
    });

    const b1_sum = spectrum1.b1_over_beta + spectrum2.b1_over_beta;
    
    return {
        eigenvalues: sumEigenvalues,
        b1_over_beta: b1_sum,
        exactSpectrum: spectrum1.exactSpectrum && spectrum2.exactSpectrum,
        realBounds: [
            spectrum1.realBounds[0] + spectrum2.realBounds[0],
            spectrum1.realBounds[1] + spectrum2.realBounds[1]
        ],
        imagBounds: [-b1_sum, b1_sum],
        isDirectSum: true
    };
}

// ============================================================================
// NON-UNIFORM PARAMETER BOUNDS (Section IV)
// ============================================================================

/**
 * Compute bounds for systems with non-uniform parameters
 * Using dissection method from Section IV
 */
export function computeNonUniformBounds(nodeAlphas, edgeBetas, topology) {
    if (!nodeAlphas || nodeAlphas.length < 2) return null;
    if (!edgeBetas || edgeBetas.length === 0) return null;
    
    const alpha1 = Math.max(...nodeAlphas);  // max α
    const alphaN = Math.min(...nodeAlphas);  // min α
    const beta1 = Math.max(...edgeBetas);    // max β
    const alphaAvg = nodeAlphas.reduce((a, b) => a + b, 0) / nodeAlphas.length;
    
    // Get uniform bound
    const uniformSpectrum = computeSpectrum(topology, alphaAvg, beta1);
    const b1_uniform = uniformSpectrum.b1_over_beta;
    
    // Non-uniform bounds from Section IV
    const b1_nonuniform = beta1 * b1_uniform;
    
    return {
        alpha1, alphaN, beta1, alphaAvg,
        b1_uniform,
        b1_nonuniform,
        realBounds: [-alpha1, -alphaN],
        imagBounds: [-b1_nonuniform, b1_nonuniform],
        isNonUniform: true
    };
}

// ============================================================================
// STABILITY CRITERIA (Section 4)
// ============================================================================

/**
 * Check stability conditions from Main Results 1 & 2
 */
export function checkStability(topology, alpha, spectrum) {
    const results = {
        isStable: false,
        conditions: [],
        remarks: []
    };
    
    // Main Result 1: Simple Full Graph
    // If all resistances are dissipative and each 1-junction is adjacent 
    // to a resistance element, then asymptotically stable
    if (alpha > 0) {
        results.conditions.push({
            name: 'Dissipative Resistances',
            satisfied: true,
            description: 'α > 0 (all resistances dissipative)'
        });
        
        // For simple full graphs, stability is guaranteed
        if (['path', 'cycle', 'star', 'complete', 'grid', 'ladder'].includes(topology.type)) {
            results.isStable = true;
            results.conditions.push({
                name: 'Simple Full Graph',
                satisfied: true,
                description: 'Topology admits stability analysis'
            });
        }
    } else {
        results.conditions.push({
            name: 'Dissipative Resistances',
            satisfied: false,
            description: 'α ≤ 0 (stability not guaranteed)'
        });
    }
    
    // Check eigenvalue bounds
    if (spectrum && spectrum.realBounds) {
        const allNegative = spectrum.realBounds[1] <= 0;
        results.conditions.push({
            name: 'Eigenvalue Real Parts',
            satisfied: allNegative,
            description: allNegative 
                ? 'All Re(λ) < 0' 
                : 'Some Re(λ) ≥ 0 possible'
        });
        
        if (allNegative && alpha > 0) {
            results.isStable = true;
        }
    }
    
    // Add remarks based on topology
    if (topology.type === 'tree') {
        results.remarks.push('Tree graphs: stability guaranteed if all R adjacent to 1-junctions');
    }
    if (topology.type === 'cycle') {
        results.remarks.push('Cycle: eigenvalue bound b₁/β = 2 (maximum for cycles)');
    }
    
    return results;
}

// ============================================================================
// COMPARISON WITH NUMERICAL EIGENVALUES
// ============================================================================

/**
 * Compare Zeid-Rosenberg bounds with computed numerical eigenvalues
 */
export function compareWithNumerical(spectrum, numericalEigenvalues, alpha = 1.0, beta = 1.0) {
    if (!numericalEigenvalues || numericalEigenvalues.length === 0) {
        return { valid: false, message: 'No numerical eigenvalues available' };
    }
    
    // For skew-symmetric matrices, eigenvalues are purely imaginary
    // Convert to our format: λ = -α + i*β*value
    const convertedNumerical = numericalEigenvalues.map(eig => {
        if (typeof eig === 'number') {
            return { re: -alpha, im: eig * beta };
        } else if (eig.imag !== undefined) {
            return { re: -alpha, im: eig.imag * beta };
        } else {
            return { re: eig.real || -alpha, im: (eig.im || 0) * beta };
        }
    });
    
    // Find actual bounds from numerical eigenvalues
    const numericalImags = convertedNumerical.map(e => e.im);
    const actualMaxImag = Math.max(...numericalImags);
    const actualMinImag = Math.min(...numericalImags);
    
    // Predicted bounds
    const predictedMaxImag = spectrum.imagBounds[1];
    const predictedMinImag = spectrum.imagBounds[0];
    
    // Check if bounds are satisfied
    const maxWithinBound = actualMaxImag <= predictedMaxImag * 1.001; // Small tolerance
    const minWithinBound = actualMinImag >= predictedMinImag * 1.001;
    
    return {
        valid: true,
        boundsHold: maxWithinBound && minWithinBound,
        predicted: {
            maxImag: predictedMaxImag,
            minImag: predictedMinImag,
            b1_over_beta: spectrum.b1_over_beta
        },
        actual: {
            maxImag: actualMaxImag,
            minImag: actualMinImag
        },
        tightness: {
            upper: predictedMaxImag > 0 ? (actualMaxImag / predictedMaxImag * 100).toFixed(1) + '%' : 'N/A',
            lower: predictedMinImag < 0 ? (actualMinImag / predictedMinImag * 100).toFixed(1) + '%' : 'N/A'
        }
    };
}

// ============================================================================
// GENERATE POINT GRAPHS (for exploration)
// ============================================================================

/**
 * Generate a specific point graph topology
 */
export function generatePointGraph(type, params = {}) {
    const N = params.N || 5;
    const edges = [];
    
    switch (type) {
        case 'path':
            for (let i = 0; i < N - 1; i++) {
                edges.push([i, i + 1]);
            }
            break;
            
        case 'cycle':
            for (let i = 0; i < N; i++) {
                edges.push([i, (i + 1) % N]);
            }
            break;
            
        case 'star':
            for (let i = 1; i < N; i++) {
                edges.push([0, i]);
            }
            break;
            
        case 'complete':
            for (let i = 0; i < N; i++) {
                for (let j = i + 1; j < N; j++) {
                    edges.push([i, j]);
                }
            }
            break;
            
        case 'grid':
            const m = params.m || 3;
            const n = params.n || 3;
            for (let i = 0; i < m; i++) {
                for (let j = 0; j < n; j++) {
                    const idx = i * n + j;
                    if (j < n - 1) edges.push([idx, idx + 1]);
                    if (i < m - 1) edges.push([idx, idx + n]);
                }
            }
            break;
            
        case 'ladder':
            const len = params.len || Math.floor(N / 2);
            for (let i = 0; i < len; i++) {
                edges.push([i, i + len]); // rungs
                if (i < len - 1) {
                    edges.push([i, i + 1]); // top rail
                    edges.push([i + len, i + len + 1]); // bottom rail
                }
            }
            break;
            
        case 'binary_tree':
            for (let i = 0; i < Math.floor((N - 1) / 2); i++) {
                const left = 2 * i + 1;
                const right = 2 * i + 2;
                if (left < N) edges.push([i, left]);
                if (right < N) edges.push([i, right]);
            }
            break;
    }
    
    return { N, edges, type };
}

// ============================================================================
// FORMAT HELPERS
// ============================================================================

export function formatFormula(topology, alpha, beta) {
    const N = topology.N;
    
    switch (topology.type) {
        case 'path':
            return `λₖ = -${alpha} ± i·${beta}·2cos(kπ/${N+1}), k = 1,...,${N}`;
        case 'cycle':
            return `λₖ = -${alpha} ± i·${beta}·2sin(2kπ/${N}), k = 0,...,${N-1}`;
        case 'star':
            return `λ = -${alpha} ± i·${beta}·√${N-1}, plus ${N-2} zeros`;
        case 'star_path': {
            const p = topology.p || (N - 1) / 2;
            return `S'${p}: λ = ±i√${p+1}, ±i (×${p-1}), 0`;
        }
        case 'double_star': {
            const p = topology.p || (N - 1) / 3;
            return `S²${p}: λ = ±i√((p/2+1)±√((p/2)²+1)), ±i√2 (×${p-1}), 0 (×${p-1})`;
        }
        case 'complete':
            return `λₖ = -${alpha} ± i·${beta}·cot((2k-1)π/${2*N}), k = 1,...,${Math.floor(N/2)}`;
        case 'grid':
            return `λⱼₖ = -${alpha} + i·${beta}(2cos(jπ/${topology.m+1}) + 2cos(kπ/${topology.n+1}))`;
        case 'ladder':
            return `λₖ = -${alpha} ± i·${beta}(2cos(kπ/${topology.len+1}) ± 1)`;
        case 'general_ladder':
            return `λₖ = -${alpha} + i·${beta}(2cos(kπ/${topology.n+1}) ± √${topology.m+1})`;
        case 'circular_ladder':
            return `λₖ = -${alpha} ± i·${beta}(2cos(2kπ/${topology.len}) ± 1)`;
        case 'hypercube':
            return `λₖ = ${topology.dim} - 2k with multiplicity C(${topology.dim},k)`;
        case 'general_star_tree':
            return `Sᵈₚ Tree: d=${topology.d}, p=${topology.p}. Approximate bound.`;
        case 'tree':
            return `Tree bound: b₁/β ≤ √${N-1} ≈ ${Math.sqrt(N-1).toFixed(4)}`;
        default:
            return `General bound: b₁/β ≤ cot(π/${2*N}) ≈ ${(1/Math.tan(Math.PI/(2*N))).toFixed(4)}`;
    }
}

export function formatBounds(spectrum) {
    if (!spectrum) return 'No spectrum computed';
    
    return {
        b1_beta: `b₁/β ≤ ${spectrum.b1_over_beta.toFixed(4)}`,
        realPart: `Re(λ) ∈ [${spectrum.realBounds[0].toFixed(3)}, ${spectrum.realBounds[1].toFixed(3)}]`,
        imagPart: `Im(λ) ∈ [${spectrum.imagBounds[0].toFixed(3)}, ${spectrum.imagBounds[1].toFixed(3)}]`,
        stability: spectrum.realBounds[1] <= 0 ? '✓ Asymptotically Stable' : '? Stability uncertain'
    };
}

// ============================================================================
// EXPORTS SUMMARY
// ============================================================================

export default {
    detectPointGraphTopology,
    computeSpectrum,
    computeDirectSum,
    computeNonUniformBounds,
    checkStability,
    compareWithNumerical,
    generatePointGraph,
    formatFormula,
    formatBounds
};
