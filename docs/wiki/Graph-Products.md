# Graph Products

## Overview

**Graph products** combine two graphs to create a larger graph with predictable spectral properties. The Eigenvalue Explorer supports three product types:

| Product | Symbol | Eigenvalue Formula | Preserves Realizability |
|---------|--------|-------------------|------------------------|
| Cartesian | □ | λᵢⱼ = λᵢ(G) + μⱼ(H) | No (in general) |
| Tensor | ⊗ | λᵢⱼ = λᵢ(G) · μⱼ(H) | No (in general) |
| Realizable | ⚡ | Special structure | **Yes** |

---

## Cartesian Product (□)

### Definition

For graphs G = (V_G, E_G) and H = (V_H, E_H), the **Cartesian product** G □ H has:

- **Vertices**: V_G × V_H (all pairs)
- **Edges**: (u₁,v₁) ~ (u₂,v₂) if:
  - u₁ = u₂ and v₁ ~ v₂ in H, OR
  - v₁ = v₂ and u₁ ~ u₂ in G

### Intuition

Two vertices are adjacent if they differ in exactly one coordinate, and that coordinate differs by an edge.

### Example

P₃ □ P₃ = 3×3 Grid Graph

```
●─●─●
│ │ │
●─●─●
│ │ │
●─●─●
```

### Eigenvalue Formula

If G has eigenvalues λ₁, ..., λₙ and H has eigenvalues μ₁, ..., μₘ, then:

```
Spectrum(G □ H) = {λᵢ + μⱼ : i=1,...,n; j=1,...,m}
```

### Properties

- |V(G □ H)| = |V(G)| · |V(H)|
- |E(G □ H)| = |E(G)| · |V(H)| + |V(G)| · |E(H)|
- G □ H ≅ H □ G (commutative)
- (G □ H) □ K ≅ G □ (H □ K) (associative)

---

## Tensor Product (⊗)

### Definition

The **Tensor product** (also called Kronecker or categorical product) G ⊗ H has:

- **Vertices**: V_G × V_H
- **Edges**: (u₁,v₁) ~ (u₂,v₂) if:
  - u₁ ~ u₂ in G **AND** v₁ ~ v₂ in H

### Intuition

Two vertices are adjacent if they differ in **both** coordinates by edges.

### Example

K₂ ⊗ K₃ creates a graph where vertices (a,x) and (b,y) are adjacent only when a~b in K₂ AND x~y in K₃.

### Eigenvalue Formula

```
Spectrum(G ⊗ H) = {λᵢ · μⱼ : i=1,...,n; j=1,...,m}
```

### Properties

- Typically sparser than Cartesian product
- May be disconnected even if factors are connected
- G ⊗ H ≅ H ⊗ G (commutative)

---

## Strong Product (⊠)

### Definition

The **Strong product** combines Cartesian and Tensor:

```
G ⊠ H = (G □ H) ∪ (G ⊗ H)
```

Edges exist if vertices differ in at most one coordinate by an edge, OR both coordinates by edges.

### Eigenvalue Formula

No simple closed form in general.

---

## Realizable Product (⚡)

### Motivation

Standard products typically **do not preserve realizability**. A graph is realizable if it can represent a physical network with bipartite p/q structure.

### Definition

The **Realizable product** is specifically designed to:
1. Maintain bipartite structure
2. Preserve sign patterns for physical validity
3. Allow composition of realizable systems

### Construction

For realizable graphs G and H with partitions (p_G, q_G) and (p_H, q_H):

1. **p-nodes of product**: p_G × p_H (momentum × momentum)
2. **q-nodes of product**: q_G × q_H (position × position)
3. **Cross terms**: p_G × q_H and q_G × p_H handled specially

### Eigenvalue Properties

The realizable product ensures:
- Eigenvalues remain purely imaginary (±iω)
- Energy conservation is preserved
- Physical interpretation maintained

### Example: Chain □⚡ Chain

Two mass-spring chains combined:

```
Original chains:
○─●─○─●─○    (masses ●, springs ○)

Product creates a 2D grid of masses connected by springs,
maintaining the bipartite structure.
```

---

## Spectral Relationships

### Why Products Have Predictable Spectra

The adjacency matrix of a product relates to factor matrices via:

**Cartesian**: A(G □ H) = A(G) ⊗ I_H + I_G ⊗ A(H)

**Tensor**: A(G ⊗ H) = A(G) ⊗ A(H)

where ⊗ denotes Kronecker product of matrices.

### Eigenvector Structure

If v is an eigenvector of G with λ, and w is an eigenvector of H with μ:

**Cartesian**: v ⊗ w is an eigenvector of G □ H with eigenvalue λ + μ

**Tensor**: v ⊗ w is an eigenvector of G ⊗ H with eigenvalue λ · μ

---

## Applications

### Building Complex Networks

Products allow systematic construction of:
- Grid graphs: Pₙ □ Pₘ
- Torus graphs: Cₙ □ Cₘ  
- Hypercubes: K₂ □ K₂ □ ... □ K₂
- Hamming graphs: Kₙ □ Kₙ □ ... □ Kₙ

### Spectral Prediction

Known spectra of simple graphs → predicted spectra of products:
- Design systems with specific resonance frequencies
- Avoid unwanted frequency bands
- Match spectral properties to requirements

### Physical Network Design

For mass-spring systems:
- Planar grids from chain products
- 3D lattices from multiple products
- Maintain realizability with ⚡ product

---

## Implementation Notes

### Layout

Product graphs use **grid layout** automatically:
- Factor dimensions determine grid size
- Vertices positioned at (i, j) for factors i and j
- Edges drawn according to product definition

### Computational Complexity

| Operation | Complexity |
|-----------|------------|
| Vertex generation | O(n·m) |
| Edge generation | O(n·m·(deg_G + deg_H)) |
| Eigenvalue prediction | O(n + m) given factor spectra |

---

## References

- Hammack, R., Imrich, W., & Klavžar, S. (2011). *Handbook of Product Graphs* (2nd ed.). CRC Press.
- Godsil, C., & Royle, G. (2001). *Algebraic Graph Theory*. Springer, Chapter 10.
- Cvetković, D., Rowlinson, P., & Simić, S. (2010). *An Introduction to the Theory of Graph Spectra*. Cambridge.
