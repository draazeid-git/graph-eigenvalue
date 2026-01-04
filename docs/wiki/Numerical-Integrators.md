# Numerical Integrators

## Overview

The Eigenvalue Explorer implements three numerical integrators for simulating port-Hamiltonian dynamics:

| Integrator | Type | Property | Best For |
|------------|------|----------|----------|
| **Rodrigues** | Exponential | Exact for skew-symmetric | Energy conservation |
| **Cayley** | Rational | Symplectic | Long-time stability |
| **Trapezoidal** | Linear | Implicit midpoint | General comparison |

## The Integration Problem

We solve the linear ODE:

```
ẋ = Jx
```

where J is skew-symmetric (J = -Jᵀ). The exact solution is:

```
x(t) = exp(Jt) x(0)
```

Since J is skew-symmetric, exp(Jt) is an **orthogonal matrix**, preserving the norm ‖x‖ and thus the energy H = ½‖x‖².

---

## Rodrigues Formula (Exact)

### Theory

For a skew-symmetric matrix J, the matrix exponential can be computed exactly using the **Rodrigues formula**. This exploits the fact that J² is symmetric negative semi-definite.

### Algorithm

Given J with eigenvalues ±iωₖ, we compute:

```
exp(Jh) = I + sin(‖J‖h)/‖J‖ · J + (1-cos(‖J‖h))/‖J‖² · J²
```

For general J, we use the eigendecomposition:
1. Compute eigenvalues λₖ = iωₖ of J
2. Form rotation matrices for each eigenvalue pair
3. Combine via eigenvector basis

### Properties

- ✅ **Exact** for linear skew-symmetric systems
- ✅ **Energy-preserving** (machine precision)
- ✅ **Orthogonal** update: xₙ₊₁ = Q·xₙ where QᵀQ = I
- ⚠️ Requires eigendecomposition (O(n³) setup, O(n²) per step)

### Implementation

```javascript
// Rodrigues update
x_new = rodriguesUpdate(J, x, dt);
// Equivalent to: x_new = expm(J * dt) * x
```

---

## Cayley Transform (Symplectic)

### Theory

The **Cayley transform** approximates the matrix exponential:

```
exp(Jh) ≈ (I - Jh/2)⁻¹ (I + Jh/2)
```

This is a **Padé (1,1) approximation** to the exponential.

### Algorithm

1. Form A = I - Jh/2
2. Form B = I + Jh/2
3. Solve A·xₙ₊₁ = B·xₙ

### Properties

- ✅ **Symplectic**: Preserves phase space structure
- ✅ **Energy-preserving** for skew-symmetric J
- ✅ **A-stable**: No restriction on step size for stability
- ✅ O(n²) per step with sparse J
- ⚠️ Second-order accurate: error ~ O(h³)

### Why Symplectic Matters

Symplectic integrators preserve the geometric structure of Hamiltonian systems:
- Phase space volume is conserved
- Long-time energy drift is bounded (no secular growth)
- Qualitative behavior matches exact solution

### Implementation

```javascript
// Cayley update: (I - J*dt/2) * x_new = (I + J*dt/2) * x
x_new = cayleyUpdate(J, x, dt);
```

---

## Trapezoidal Rule (Implicit Midpoint)

### Theory

The **trapezoidal rule** (implicit midpoint method):

```
xₙ₊₁ = xₙ + h · J · (xₙ + xₙ₊₁)/2
```

Rearranging:

```
(I - Jh/2) xₙ₊₁ = (I + Jh/2) xₙ
```

This is **identical to the Cayley transform** for linear systems!

### Properties

- ✅ **A-stable**: Unconditionally stable
- ✅ **Symmetric**: Time-reversible
- ✅ Second-order accurate
- Same as Cayley for linear J

### Implementation

```javascript
// Trapezoidal is mathematically equivalent to Cayley for ẋ = Jx
x_new = trapezoidalUpdate(J, x, dt);
```

---

## Comparison

### Energy Conservation

| Integrator | Energy Error (per step) | Long-time Behavior |
|------------|------------------------|-------------------|
| Rodrigues | Machine epsilon (~10⁻¹⁵) | Exact conservation |
| Cayley | O(h³) | Bounded oscillation |
| Trapezoidal | O(h³) | Bounded oscillation |

### Computational Cost

| Integrator | Setup | Per Step | Sparse Optimization |
|------------|-------|----------|---------------------|
| Rodrigues | O(n³) eigen | O(n²) matmul | Limited |
| Cayley | O(1) | O(n²) solve | O(m) with SpMV |
| Trapezoidal | O(1) | O(n²) solve | O(m) with SpMV |

### Recommendations

- **Small graphs (n < 50)**: Use **Rodrigues** for exact dynamics
- **Large sparse graphs**: Use **Cayley** with sparse matrix methods
- **Educational/comparison**: Try all three to see they match

---

## Sparse Matrix Optimization (SpMV)

For large sparse graphs, we use **Sparse Matrix-Vector multiplication**:

```
y = J·x computed as sum over edges
```

This reduces complexity from O(n²) to O(m) where m = number of edges.

### Implementation

```javascript
// Sparse J*x multiplication
function sparseMultiply(edges, x) {
    let y = new Array(n).fill(0);
    for (let [i, j, weight] of edges) {
        y[i] += weight * x[j];
        y[j] -= weight * x[i];  // Skew-symmetric
    }
    return y;
}
```

---

## References

- Iserles, A., et al. (2000). Lie-group Methods. *Acta Numerica*, 9, 215-365.
- Hairer, E., Lubich, C., & Wanner, G. (2006). *Geometric Numerical Integration* (2nd ed.). Springer.
- Celledoni, E., & Owren, B. (2003). Lie group methods for rigid body dynamics. *Comput. Methods Appl. Mech. Eng.*, 192, 421-438.
