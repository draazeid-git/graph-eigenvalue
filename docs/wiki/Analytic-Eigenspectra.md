# Analytic Eigenspectra

## Overview

Many graph families have **closed-form eigenvalue formulas** that reveal deep connections between graph structure and spectral properties. The Eigenvalue Explorer automatically detects these families and displays their analytic expressions.

## Graph Families with Known Spectra

### Path Graph Pₙ

The path with n vertices has adjacency eigenvalues:

```
λₖ = 2 cos(kπ/(n+1)),  k = 1, 2, ..., n
```

**Properties:**
- All eigenvalues in [-2, 2]
- Simple (multiplicity 1)
- Spectral radius approaches 2 as n → ∞

### Cycle Graph Cₙ

The cycle with n vertices has eigenvalues:

```
λₖ = 2 cos(2πk/n),  k = 0, 1, ..., n-1
```

**Properties:**
- λ₀ = 2 (always)
- λₙ/₂ = -2 (when n is even)
- Other eigenvalues have multiplicity 2

### Complete Graph Kₙ

The complete graph has eigenvalues:

```
λ₁ = n-1  (multiplicity 1)
λ₂ = -1   (multiplicity n-1)
```

**Properties:**
- Largest spectral gap
- Highly symmetric spectrum

### Star Graph Sₙ

The star with n vertices (1 center + n-1 leaves):

```
λ = ±√(n-1)  (multiplicity 1 each)
λ = 0        (multiplicity n-2)
```

**Properties:**
- Only 3 distinct eigenvalues
- Zero eigenvalue indicates bipartiteness

### Wheel Graph Wₙ

The wheel with n outer vertices + 1 hub:

```
λ = 3                                    (multiplicity 1)
λ = -1                                   (multiplicity 1)  
λₖ = 1 + 2cos(2πk/n),  k = 1, ..., n-1   (multiplicity varies)
```

### Complete Bipartite Kₘ,ₙ

```
λ = ±√(mn)   (multiplicity 1 each)
λ = 0        (multiplicity m+n-2)
```

### Hypercube Qₙ

The n-dimensional hypercube (2ⁿ vertices):

```
λₖ = n - 2k,  k = 0, 1, ..., n
multiplicity = C(n,k)
```

**Properties:**
- Eigenvalues are integers
- Symmetric about 0

### Petersen Graph

The Petersen graph has eigenvalues:

```
λ = 3   (multiplicity 1)
λ = 1   (multiplicity 5)
λ = -2  (multiplicity 4)
```

**Properties:**
- Strongly regular graph
- Only 3 distinct eigenvalues despite 10 vertices

---

## Detection Algorithm

The tool uses pattern matching to identify graph families:

### Step 1: Compute Structural Invariants

- Vertex count n
- Edge count m
- Degree sequence
- Diameter
- Girth (shortest cycle)
- Connectivity

### Step 2: Match Against Known Families

```javascript
function detectFamily(graph) {
    const n = graph.vertices.length;
    const m = graph.edges.length;
    const degrees = computeDegrees(graph);
    
    // Path: n-1 edges, two degree-1 vertices
    if (m === n-1 && degrees.filter(d => d === 1).length === 2) {
        return 'Path';
    }
    
    // Cycle: n edges, all degree-2
    if (m === n && degrees.every(d => d === 2)) {
        return 'Cycle';
    }
    
    // Complete: n(n-1)/2 edges, all degree n-1
    if (m === n*(n-1)/2) {
        return 'Complete';
    }
    
    // ... more patterns
}
```

### Step 3: Generate Symbolic Formula

Once identified, the corresponding formula is instantiated with the actual parameter n.

---

## Why Closed Forms Matter

### Theoretical Insight

Closed-form eigenvalues reveal:
- **Symmetry**: High symmetry leads to simpler formulas
- **Regularity**: Regular graphs often have integer or algebraic eigenvalues
- **Spectral radius**: Determines growth rate of random walks
- **Energy**: Related to chemical stability in molecular graphs

### Computational Advantage

For large n:
- Numerical eigenvalue computation: O(n³)
- Closed-form evaluation: O(n)

### Physical Interpretation

In mass-spring systems, eigenvalues determine:
- **Natural frequencies**: ω = √λ
- **Mode shapes**: From eigenvectors
- **Resonance conditions**: When external forcing matches ωₖ

---

## Chebyshev Polynomial Connection

Many graph eigenvalues relate to **Chebyshev polynomials**:

### First Kind: Tₙ(x)

```
Tₙ(cos θ) = cos(nθ)
```

Path eigenvalues satisfy: Uₙ(λ/2) = 0

### Second Kind: Uₙ(x)

```
Uₙ(cos θ) = sin((n+1)θ)/sin(θ)
```

Cycle eigenvalues: λₖ = 2cos(2πk/n) are roots of Tₙ(λ/2) - 1 = 0

### Factorization

The characteristic polynomial often factors using Chebyshev identities:

```
det(λI - A_path) = U_{n-1}(λ/2)
det(λI - A_cycle) = 2(T_n(λ/2) - 1)
```

---

## Extending to New Families

To add a new graph family:

1. **Identify the pattern**: What structural properties define the family?
2. **Derive the formula**: Use linear algebra or generating functions
3. **Implement detection**: Add pattern matching rules
4. **Verify numerically**: Compare symbolic vs computed eigenvalues

---

## References

- Brouwer, A. E., & Haemers, W. H. (2012). *Spectra of Graphs*. Springer.
- Cvetković, D., Rowlinson, P., & Simić, S. (2010). *An Introduction to the Theory of Graph Spectra*. Cambridge.
- Mason, J. C., & Handscomb, D. C. (2002). *Chebyshev Polynomials*. CRC Press.
