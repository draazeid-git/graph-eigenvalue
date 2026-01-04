# Spectral Graph Theory

## Overview

**Spectral graph theory** studies the properties of graphs through the eigenvalues and eigenvectors of associated matrices. This tool focuses on both the **symmetric adjacency matrix** and the **skew-symmetric structure matrix**.

## Fundamental Matrices

### Adjacency Matrix (Symmetric)

For a graph G = (V, E) with n vertices, the adjacency matrix A ∈ ℝⁿˣⁿ:

```
A[i,j] = 1  if {i,j} ∈ E
A[i,j] = 0  otherwise
```

Properties:
- Symmetric: A = Aᵀ
- Real eigenvalues
- Orthogonal eigenvectors

### Skew-Symmetric Matrix

For oriented graphs or port-Hamiltonian systems:

```
J[i,j] = +1  if edge i→j
J[i,j] = -1  if edge j→i
J[i,j] = 0   otherwise
```

Properties:
- Skew-symmetric: J = -Jᵀ
- Purely imaginary eigenvalues: λ = ±iω
- Unitary eigenvector structure

### Laplacian Matrix

The Laplacian L = D - A where D is the degree matrix:

```
L[i,i] = degree(i)
L[i,j] = -1  if {i,j} ∈ E
L[i,j] = 0   otherwise
```

Properties:
- Positive semi-definite
- Smallest eigenvalue = 0 (for connected graphs)
- Second smallest = algebraic connectivity

## Key Spectral Quantities

### Eigenvalues

For an n-vertex graph, we have n eigenvalues:

```
λ₁ ≥ λ₂ ≥ ... ≥ λₙ  (symmetric case)
```

### Spectral Radius

```
ρ(G) = max|λᵢ| = λ₁  (for connected graphs)
```

**Bounds:**
- ρ ≥ √(2m/n) (average degree bound)
- ρ ≤ Δ (maximum degree)
- ρ = Δ for regular graphs

### Graph Energy

```
E(G) = Σ|λᵢ|
```

Originally defined for molecular stability in chemistry.

### Spectral Gap

```
gap(G) = λ₁ - λ₂
```

Related to expansion properties and mixing time of random walks.

## Eigenvalue-Structure Relationships

### Vertex Count and Trace

```
trace(A) = Σλᵢ = 0  (no self-loops)
trace(A²) = Σλᵢ² = 2m  (counts edges)
```

### Bipartiteness

A graph is bipartite if and only if its spectrum is symmetric about 0:
```
λ is an eigenvalue ⟺ -λ is an eigenvalue
```

### Connectivity

- Connected graph: λ₁ > λ₂
- k-connected: Related to higher eigenvalues

### Regularity

For d-regular graphs:
```
λ₁ = d  (with eigenvector [1,1,...,1]ᵀ)
```

## Eigenvectors and Graph Structure

### Fiedler Vector

The eigenvector corresponding to the second-smallest Laplacian eigenvalue:
- Sign pattern reveals graph partition
- Used in spectral clustering
- Related to graph bisection

### Localization

Eigenvectors can be:
- **Delocalized**: Spread across all vertices
- **Localized**: Concentrated on subgraph

### Nodal Domains

For eigenvector v, nodal domains are connected subgraphs where v has constant sign.

## Spectra of Common Graphs

### Path Pₙ

```
λₖ = 2cos(kπ/(n+1)),  k = 1,...,n
```

### Cycle Cₙ

```
λₖ = 2cos(2πk/n),  k = 0,...,n-1
```

### Complete Graph Kₙ

```
λ₁ = n-1     (multiplicity 1)
λ₂ = -1     (multiplicity n-1)
```

### Star Sₙ

```
λ = ±√(n-1)  (multiplicity 1 each)
λ = 0        (multiplicity n-2)
```

### Complete Bipartite Kₘ,ₙ

```
λ = ±√(mn)   (multiplicity 1 each)
λ = 0        (multiplicity m+n-2)
```

## Chebyshev Polynomial Connection

Many graph spectra relate to **Chebyshev polynomials**:

### First Kind Tₙ(x)

```
Tₙ(cos θ) = cos(nθ)
```

### Second Kind Uₙ(x)

```
Uₙ(cos θ) = sin((n+1)θ)/sin(θ)
```

### Path Eigenvalues

```
det(λI - A_path) = Uₙ(λ/2)
```

Roots are λₖ = 2cos(kπ/(n+1)).

### Cycle Eigenvalues

```
det(λI - A_cycle) = 2(Tₙ(λ/2) - 1)
```

## Interlacing Theorems

### Cauchy Interlacing

If H is an induced subgraph of G with eigenvalues μ₁ ≥ ... ≥ μₘ:

```
λₖ ≥ μₖ ≥ λₖ₊ₙ₋ₘ
```

### Edge Deletion

Adding an edge can only increase λ₁:
```
λ₁(G + e) ≥ λ₁(G)
```

## Applications

### Network Analysis

- **Centrality**: Eigenvector centrality uses principal eigenvector
- **Clustering**: Spectral clustering via Laplacian eigenvectors
- **Community detection**: Modularity optimization

### Physics

- **Vibration modes**: Eigenvalues = natural frequencies²
- **Quantum graphs**: Energy levels
- **Electrical networks**: Resistance distance

### Chemistry

- **Molecular stability**: Graph energy predicts stability
- **Hückel theory**: π-electron energies from adjacency spectrum

## Computational Aspects

### Exact vs Numerical

| Method | Complexity | Precision |
|--------|------------|-----------|
| SFF + BigInt | O(n⁴) | Exact integers |
| QR iteration | O(n³) | Float64 |
| Lanczos | O(mn) | Few eigenvalues |

### Symbolic Formulas

For recognized families, eigenvalues are given symbolically:
```
Wheel W₈: λ = 3, -1, 1+2cos(2πk/7)
```

## References

- Brouwer, A. E., & Haemers, W. H. (2012). *Spectra of Graphs*. Springer.
- Chung, F. R. K. (1997). *Spectral Graph Theory*. AMS.
- Cvetković, D., Rowlinson, P., & Simić, S. (2010). *An Introduction to the Theory of Graph Spectra*. Cambridge.
- Godsil, C., & Royle, G. (2001). *Algebraic Graph Theory*. Springer.
