# Graph Families

## Overview

The Eigenvalue Explorer includes **61+ built-in graph templates** organized into families. Each family has characteristic structural properties and often closed-form eigenvalue formulas.

## Classic Families

### Path Graphs (Pₙ)

**Structure:** n vertices in a line
**Edges:** n-1
**Eigenvalues:** λₖ = 2cos(kπ/(n+1)), k = 1,...,n

```
P₄: ●───●───●───●
```

Properties:
- Tree (acyclic connected)
- Bipartite
- Diameter = n-1
- Two leaves (degree-1 vertices)

### Cycle Graphs (Cₙ)

**Structure:** n vertices in a ring
**Edges:** n
**Eigenvalues:** λₖ = 2cos(2πk/n), k = 0,...,n-1

```
C₆:   ●───●
     /     \
    ●       ●
     \     /
      ●───●
```

Properties:
- 2-regular
- Bipartite iff n is even
- λ₁ = 2 always
- λₙ/₂ = -2 when n is even

### Complete Graphs (Kₙ)

**Structure:** All pairs connected
**Edges:** n(n-1)/2
**Eigenvalues:** λ₁ = n-1, λ₂ = ... = λₙ = -1

```
K₄:  ●───●
     |\ /|
     | X |
     |/ \|
     ●───●
```

Properties:
- (n-1)-regular
- Diameter = 1
- Maximum edge density
- Highly symmetric

### Star Graphs (Sₙ)

**Structure:** Central hub connected to n-1 leaves
**Edges:** n-1
**Eigenvalues:** ±√(n-1) (×1), 0 (×(n-2))

```
S₅:     ●
        |
    ●───●───●
        |
        ●
```

Properties:
- Tree
- Bipartite
- One vertex of degree n-1
- n-1 vertices of degree 1

### Wheel Graphs (Wₙ)

**Structure:** Cycle Cₙ plus central hub
**Vertices:** n+1
**Edges:** 2n

```
W₆:     ●
       /|\
      ●─●─●
       \|/
        ●
```

Properties:
- Hub has degree n
- Rim vertices have degree 3
- Planar

## Bipartite Families

### Complete Bipartite (Kₘ,ₙ)

**Structure:** All vertices in part A connected to all in part B
**Vertices:** m + n
**Eigenvalues:** ±√(mn), 0 (×(m+n-2))

```
K₂,₃:  ●   ●
       |\ /|
       | X |
       |/ \|
       ●   ●   ●
```

### Crown Graphs (Crₙ)

**Structure:** Complete bipartite Kₙ,ₙ minus perfect matching
**Vertices:** 2n
**Edges:** n(n-1)

### Hypercube (Qₙ)

**Structure:** n-dimensional binary cube
**Vertices:** 2ⁿ
**Edges:** n·2ⁿ⁻¹
**Eigenvalues:** n-2k with multiplicity C(n,k)

```
Q₃ (cube):
    ●───●
   /|  /|
  ●─┼─● |
  | ●─┼─●
  |/  |/
  ●───●
```

## Regular Families

### Petersen Graph

**Structure:** Famous 3-regular graph
**Vertices:** 10
**Edges:** 15
**Eigenvalues:** 3, 1 (×5), -2 (×4)

Properties:
- Strongly regular
- Not planar
- Girth = 5

### Möbius-Kantor Graph

**Structure:** 8-vertex 3-regular graph
**Vertices:** 8
**Eigenvalues:** 3, √2 (×2), 0 (×2), -√2 (×2), -3

### Circulant Graphs

**Structure:** Vertices 0,...,n-1 with edge set S
**Notation:** Cₙ(S) where S ⊂ {1,...,⌊n/2⌋}

```
C₈(1,2): Each vertex connected to those at distance 1 and 2
```

## Trees

### Binary Trees

**Structure:** Each internal node has 2 children
**Levels:** d levels = 2ᵈ - 1 vertices

### Complete k-ary Trees

**Structure:** Each internal node has k children
**Balanced structure**

### Caterpillar Graphs

**Structure:** Path with additional leaves
**All non-leaf vertices lie on a path**

## Lattice Graphs

### Grid Graphs (Pₘ □ Pₙ)

**Structure:** m × n rectangular grid
**Vertices:** mn
**Eigenvalues:** 2cos(iπ/(m+1)) + 2cos(jπ/(n+1))

### Torus Graphs (Cₘ □ Cₙ)

**Structure:** Grid with wraparound
**4-regular**

### Triangular Lattice

**Structure:** 6-regular planar tessellation
**Important in physics**

## Realizable Templates

These templates are specifically designed for physical network analysis:

### Chain

**Structure:** Alternating p-q nodes in line
**Vertices:** 2n+1 (n masses, n+1 springs)
**Grounded:** End springs

### Grid

**Structure:** 2D checkerboard of p-q nodes
**Vertices:** m×n pattern
**Grounded:** Boundary springs

### Radial (Drum)

**Structure:** Central mass with radial branches
**Vertices:** 1 + 3nm (n branches, m rings)
**Models:** Drumhead, circular membrane

### Cantilever

**Structure:** Fixed-free beam model
**One end grounded, other free**

### Bridge

**Structure:** Both ends grounded
**Models:** Simply supported beam**

## Spectral Classification

### Bounded Spectral Radius (ρ ≤ 2)

- All trees
- Path graphs
- Cycle graphs
- Subcubic graphs

### Linear Growth (ρ ~ n)

- Complete graphs Kₙ
- Complete bipartite Kₙ,ₙ
- Dense random graphs

### Square Root Growth (ρ ~ √n)

- Star graphs Sₙ
- Complete bipartite Kₘ,ₙ (fixed m)

## Adding Custom Families

To add a new graph family:

1. **Define generator function:**
```javascript
function generateMyFamily(n) {
    const vertices = createVertices(n);
    const edges = createEdges(n);
    return {vertices, edges, name: `MyFamily_${n}`};
}
```

2. **Add to template dropdown:**
```html
<option value="my-family">My Family</option>
```

3. **Add detection rules** (for analytic eigenvalues):
```javascript
if (matchesMyFamilyPattern(graph)) {
    return {family: 'MyFamily', formula: '...'};
}
```

## References

- Harary, F. (1969). *Graph Theory*. Addison-Wesley.
- Godsil, C., & Royle, G. (2001). *Algebraic Graph Theory*. Springer.
- Brouwer, A. E., & Haemers, W. H. (2012). *Spectra of Graphs*. Springer.
