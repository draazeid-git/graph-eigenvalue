# Port-Hamiltonian Systems on Graphs

## Introduction

**Port-Hamiltonian systems** provide a unified framework for modeling physical systems across multiple energy domains. When defined on graphs, they capture the network topology of interconnected physical elements.

## Mathematical Framework

### State Variables

For a graph G = (V, E) with bipartite structure:

- **p-nodes**: Momentum/flow variables (masses, inductors, rotational inertias)
- **q-nodes**: Position/effort variables (springs, capacitors, torsional springs)

The state vector is partitioned as:

```
x = [p]
    [q]
```

### Hamiltonian Function

The total energy (Hamiltonian) for uniform parameters is:

```
H(x) = ½ xᵀx = ½ (pᵀp + qᵀq)
```

For a mass-spring system, this represents:
- **Kinetic energy**: T = ½ pᵀM⁻¹p = ½ pᵀp (when M = I)
- **Potential energy**: V = ½ qᵀKq = ½ qᵀq (when K = I)

### Structure Matrix

The dynamics are governed by:

```
ẋ = J ∇H(x) = Jx
```

where J is the **skew-symmetric structure matrix**:

```
J = [ 0    B ]
    [-Bᵀ   0 ]
```

### Incidence Matrix B

The incidence matrix B ∈ ℝ^(N×M) encodes the graph connectivity:
- **Rows**: p-nodes (N = number of inertia elements)
- **Columns**: Edges connecting to q-nodes (M = number of stiffness elements)
- **Entries**: +1 or -1 indicating direction

## Physical Interpretation

### Multi-Domain Equivalence

| Domain | p-nodes | q-nodes | Parameter |
|--------|---------|---------|-----------|
| Mechanical (translational) | Mass (momentum) | Spring (displacement) | m, k |
| Mechanical (rotational) | Rotational inertia | Torsional spring | J, κ |
| Electrical | Inductor (flux) | Capacitor (charge) | L, C |

Under uniform parameters (all = 1), these systems share identical eigenspectra determined solely by graph topology.

### Energy Conservation

The skew-symmetry of J guarantees energy conservation:

```
dH/dt = (∇H)ᵀ ẋ = xᵀ Jx = 0
```

This is because xᵀJx = 0 for any skew-symmetric J.

## Eigenvalue Structure

For the skew-symmetric matrix J, eigenvalues come in conjugate pairs:

```
λ = ±iω
```

where ω are the natural frequencies of the system.

### Relationship to Symmetric Spectrum

If A = BBᵀ is the symmetric Laplacian-like matrix, then:
- Eigenvalues of A: μᵢ ≥ 0
- Eigenvalues of J: λ = ±i√μᵢ

## Grounded Elements

Grounded elements (springs/capacitors connected to fixed reference) appear as columns in B with only one non-zero entry. These provide:
- Boundary conditions
- Elimination of rigid-body modes
- Well-defined equilibrium points

## References

- van der Schaft, A., & Maschke, B. (2014). Port-Hamiltonian Systems on Graphs. *SIAM J. Control Optim.*, 51(2), 906-937.
- Maschke, B., & van der Schaft, A. (1992). Port-Controlled Hamiltonian Systems. *IFAC Proceedings*, 25(13), 359-365.
