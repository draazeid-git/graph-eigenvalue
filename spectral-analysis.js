/**
 * Spectral Analysis Module
 * Graph type detection, eigenvalue computation, characteristic polynomial
 */

import { state } from './graph-core.js';

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

export function computeSkewSymmetricEigenvalues(matrix) {
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
    
    const seen = new Set();
    const unique = [];
    for (const ev of eigenvalues) {
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
 * Returns { isNice: bool, form: string }
 */
export function detectClosedForm(value, tolerance = 1e-4) {
    const absVal = Math.abs(value);
    
    // Check for zero
    if (absVal < tolerance) {
        return { isNice: true, form: '0' };
    }
    
    // Check for small integers
    for (let k = 1; k <= 20; k++) {
        if (Math.abs(absVal - k) < tolerance) {
            return { isNice: true, form: value > 0 ? String(k) : String(-k) };
        }
    }
    
    // Check for simple fractions
    for (let num = 1; num <= 10; num++) {
        for (let den = 2; den <= 10; den++) {
            if (Math.abs(absVal - num/den) < tolerance) {
                const sign = value > 0 ? '' : '-';
                return { isNice: true, form: `${sign}${num}/${den}` };
            }
        }
    }
    
    // Check for square roots of small integers: √k
    for (let k = 2; k <= 50; k++) {
        const sqrtK = Math.sqrt(k);
        if (Math.abs(absVal - sqrtK) < tolerance) {
            const sign = value > 0 ? '' : '-';
            // Simplify √4 = 2, √9 = 3, etc.
            const sqrtInt = Math.round(sqrtK);
            if (Math.abs(sqrtK - sqrtInt) < tolerance) {
                return { isNice: true, form: sign + sqrtInt };
            }
            return { isNice: true, form: `${sign}√${k}` };
        }
    }
    
    // Check for trigonometric values: 2cos(kπ/n) or 2sin(kπ/n)
    for (let n = 2; n <= 24; n++) {
        for (let k = 0; k <= n; k++) {
            const cosVal = 2 * Math.cos(k * Math.PI / n);
            const sinVal = 2 * Math.sin(k * Math.PI / n);
            
            if (Math.abs(value - cosVal) < tolerance) {
                if (k === 0) return { isNice: true, form: '2' };
                if (k === n) return { isNice: true, form: '-2' };
                if (2 * k === n) return { isNice: true, form: '0' };
                return { isNice: true, form: `2cos(${k}π/${n})` };
            }
            if (Math.abs(value - sinVal) < tolerance) {
                if (k === 0 || k === n) return { isNice: true, form: '0' };
                if (2 * k === n) return { isNice: true, form: '2' };
                return { isNice: true, form: `2sin(${k}π/${n})` };
            }
        }
    }
    
    // Check for (1 ± √5)/2 (golden ratio related)
    const phi = (1 + Math.sqrt(5)) / 2;
    const psi = (1 - Math.sqrt(5)) / 2;
    if (Math.abs(value - phi) < tolerance) return { isNice: true, form: '(1+√5)/2' };
    if (Math.abs(value - psi) < tolerance) return { isNice: true, form: '(1-√5)/2' };
    if (Math.abs(value + phi) < tolerance) return { isNice: true, form: '-(1+√5)/2' };
    if (Math.abs(value + psi) < tolerance) return { isNice: true, form: '-(1-√5)/2' };
    
    // Check for √(a ± √b) patterns (nested radicals)
    for (let a = 1; a <= 10; a++) {
        for (let b = 1; b <= 20; b++) {
            const sqrtB = Math.sqrt(b);
            if (a + sqrtB > 0) {
                const val1 = Math.sqrt(a + sqrtB);
                if (Math.abs(absVal - val1) < tolerance) {
                    const sign = value > 0 ? '' : '-';
                    return { isNice: true, form: `${sign}√(${a}+√${b})` };
                }
            }
            if (a - sqrtB > 0) {
                const val2 = Math.sqrt(a - sqrtB);
                if (Math.abs(absVal - val2) < tolerance) {
                    const sign = value > 0 ? '' : '-';
                    return { isNice: true, form: `${sign}√(${a}-√${b})` };
                }
            }
        }
    }
    
    return { isNice: false, form: value.toFixed(6) };
}

/**
 * Analyze all eigenvalues and return closed-form representations
 * Returns { allAnalytic: bool, eigenvalues: [{value, multiplicity, form, isNice}] }
 */
export function analyzeEigenvaluesForClosedForms(eigenvalues, tolerance = 1e-4) {
    const results = [];
    let allNice = true;
    
    // Group by value (with tolerance for numerical errors)
    const groups = [];
    
    for (const ev of eigenvalues) {
        const val = typeof ev === 'number' ? ev : ev.value;
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
    for (const { value, count } of groups) {
        const detection = detectClosedForm(value, tolerance);
        if (!detection.isNice) {
            allNice = false;
        }
        results.push({
            value: value,
            multiplicity: count,
            form: detection.form,
            isNice: detection.isNice
        });
    }
    
    return { allAnalytic: allNice, eigenvalues: results };
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
