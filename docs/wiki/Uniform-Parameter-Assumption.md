# Uniform Parameter Assumption

## Overview

The Zeid-Rosenberg Eigenvalue Explorer uses **uniform parameters (±1)** throughout all network elements. This deliberate simplification isolates the effect of **graph topology** on eigenspectra.

## What "Uniform Parameters" Means

### Standard Physical Systems

In real physical systems, parameters vary:

| Domain | Inertia Parameter | Stiffness Parameter |
|--------|-------------------|---------------------|
| Mass-spring | Mass m (kg) | Spring constant k (N/m) |
| Electrical | Inductance L (H) | Capacitance C (F) |
| Rotational | Moment of inertia J (kg·m²) | Torsional stiffness κ (N·m/rad) |

### Uniform Parameter Case

In this tool, all parameters are normalized:

```
m = L = J = 1    (all inertias)
k = C = κ = 1    (all stiffnesses)
```

Edge weights (gyrator/transformer ratios) are also ±1.

## Mathematical Formulation

### General Case

The Hamiltonian with general parameters:

```
H(p,q) = ½ pᵀM⁻¹p + ½ qᵀKq
```

Dynamics: ẋ = J·∇H where J is the structure matrix.

### Uniform Case (This Tool)

With M = I and K = I:

```
H(p,q) = ½ pᵀp + ½ qᵀq = ½ ‖x‖²
```

Dynamics simplify to: **ẋ = Jx**

The eigenspectrum depends **only on J**, which encodes the graph topology.

## Why Use Uniform Parameters?

### 1. Isolate Topological Effects

With varying parameters, eigenvalues depend on both:
- Graph structure (topology)
- Parameter values (physics)

Uniform parameters remove parameter dependence, revealing **pure topological effects**.

### 2. Compare Across Domains

Under uniform parameters, these systems are **mathematically identical**:
- 5-mass chain with springs
- 5-inductor chain with capacitors
- 5-rotor chain with torsional springs

Same graph → same eigenvalues → same natural frequencies.

### 3. Simplify Analysis

| Aspect | General Case | Uniform Case |
|--------|--------------|--------------|
| Eigenvalue computation | Generalized eigenvalue problem | Standard eigenvalue problem |
| Parameter space | High-dimensional | Single topology |
| Closed-form solutions | Rare | Often available |

### 4. Educational Clarity

Students can focus on:
- How connectivity affects dynamics
- Role of graph symmetry
- Spectral properties of graph families

Without distraction from parameter tuning.

## What This Reveals

### Topology Determines

With uniform parameters, graph structure alone determines:

- **Natural frequencies**: ωₖ = √|λₖ|
- **Mode shapes**: Eigenvector patterns
- **Energy distribution**: How energy flows through network
- **Spectral radius**: Maximum oscillation rate
- **Spectral gap**: Convergence/mixing rate

### Examples of Topological Effects

| Graph Property | Spectral Effect |
|----------------|-----------------|
| More edges | Higher spectral radius |
| Higher symmetry | More repeated eigenvalues |
| Bipartite structure | Spectrum symmetric about 0 |
| Tree structure | Eigenvalues related to branches |
| Cycles | Eigenvalues involve cos(2πk/n) |

## Limitations

### What Uniform Parameters Cannot Show

1. **Parameter sensitivity**: How eigenvalues change with m, k
2. **Optimal design**: Best parameter values for desired frequencies
3. **Real-world matching**: Actual physical system behavior
4. **Damping effects**: Energy dissipation (requires additional terms)

### When General Parameters Matter

- Engineering design requiring specific frequencies
- System identification from experimental data
- Robustness analysis under parameter uncertainty
- Optimization of network performance

## Relationship to General Theory

### Scaling Laws

For uniform topology with scaled parameters:

If all masses scale by α and all stiffnesses by β:
```
ω_new = √(β/α) · ω_uniform
```

Eigenvalue ratios are preserved!

### Perturbation Theory

Small parameter variations from uniform case:
```
λ(ε) = λ₀ + ελ₁ + ε²λ₂ + ...
```

Uniform case provides the **base solution λ₀**.

## Implementation Notes

### Edge Weights

In the tool, edge weights are ±1:
- **+1**: Standard connection
- **-1**: Reversed orientation (for sign consistency)

The sign pattern must satisfy realizability constraints.

### Node Classification

- **p-nodes**: Represent unit inertia elements
- **q-nodes**: Represent unit stiffness elements
- **Grounded q-nodes**: Unit stiffness to fixed reference

## Future Extensions

The uniform parameter framework could be extended to:

1. **Parametric studies**: Vary one parameter while keeping others uniform
2. **Structural optimization**: Find topologies with desired spectral properties
3. **Inverse problems**: Given spectrum, find realizing topology

## References

- van der Schaft, A., & Maschke, B. (2014). Port-Hamiltonian Systems on Graphs. *SIAM J. Control Optim.*
- Godsil, C., & Royle, G. (2001). *Algebraic Graph Theory*. Springer.
