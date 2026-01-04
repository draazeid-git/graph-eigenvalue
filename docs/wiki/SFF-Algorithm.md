# Souriau-Frame-Faddeev (SFF) Algorithm

## Overview

The **Souriau-Frame-Faddeev algorithm** computes the coefficients of the characteristic polynomial det(λI - A) using only matrix operations. Combined with **BigInt arithmetic**, this enables exact integer coefficients without floating-point errors.

## The Characteristic Polynomial

For an n×n matrix A, the characteristic polynomial is:

```
p(λ) = det(λI - A) = λⁿ + c₁λⁿ⁻¹ + c₂λⁿ⁻² + ... + cₙ₋₁λ + cₙ
```

where:
- c₁ = -trace(A)
- cₙ = (-1)ⁿ det(A)

## Algorithm Description

### Faddeev-LeVerrier Recurrence

The algorithm computes auxiliary matrices B₁, B₂, ..., Bₙ and coefficients c₁, c₂, ..., cₙ:

```
Initialize:
  B₀ = I  (identity matrix)
  
For k = 1, 2, ..., n:
  cₖ = -trace(A·Bₖ₋₁) / k
  Bₖ = A·Bₖ₋₁ + cₖ·I
```

### Final Result

After n iterations:
- Coefficients: c₁, c₂, ..., cₙ
- Bₙ should equal the zero matrix (verification)

## Mathematical Foundation

### Cayley-Hamilton Theorem

The algorithm exploits the fact that every matrix satisfies its own characteristic equation:

```
p(A) = Aⁿ + c₁Aⁿ⁻¹ + c₂Aⁿ⁻² + ... + cₙI = 0
```

### Newton's Identities

The coefficients relate to power sums sₖ = trace(Aᵏ):

```
c₁ = -s₁
c₂ = -(s₂ + c₁s₁)/2
c₃ = -(s₃ + c₁s₂ + c₂s₁)/3
...
```

The SFF algorithm computes these implicitly through the Bₖ matrices.

---

## BigInt Implementation

### Why BigInt?

For integer adjacency matrices, the characteristic polynomial has **integer coefficients**. Floating-point computation introduces errors that compound over n iterations.

### Example Error

For a 40×40 matrix:
- Float64: coefficients may have 10⁻¹⁰ relative error
- BigInt: exact integer coefficients

### Implementation

```javascript
function sffBigInt(A) {
    const n = A.length;
    
    // Convert to BigInt matrix
    const ABig = A.map(row => row.map(x => BigInt(Math.round(x))));
    
    // Initialize
    let B = identity(n).map(row => row.map(x => BigInt(x)));
    const coeffs = [];
    
    for (let k = 1; k <= n; k++) {
        // Compute A*B
        const AB = matmulBigInt(ABig, B);
        
        // Compute trace
        let tr = 0n;
        for (let i = 0; i < n; i++) {
            tr += AB[i][i];
        }
        
        // Coefficient (exact integer division)
        const c = -tr / BigInt(k);
        coeffs.push(c);
        
        // Update B = AB + c*I
        for (let i = 0; i < n; i++) {
            for (let j = 0; j < n; j++) {
                B[i][j] = AB[i][j] + (i === j ? c : 0n);
            }
        }
    }
    
    return coeffs;
}
```

### Verification

The final matrix Bₙ should be zero:

```javascript
// Check all entries are 0
const isZero = B.every(row => row.every(x => x === 0n));
if (!isZero) {
    console.warn('SFF verification failed');
}
```

---

## Computational Complexity

| Operation | Complexity |
|-----------|------------|
| Matrix multiplication | O(n³) per iteration |
| Total iterations | n |
| **Overall** | **O(n⁴)** |

### Optimizations

1. **Sparse matrices**: Use sparse representation for graphs with m << n²
2. **Symmetry**: Exploit A = Aᵀ to reduce operations
3. **Parallelization**: Matrix multiplication is parallelizable

---

## Output Format

The algorithm returns coefficients [c₁, c₂, ..., cₙ] where:

```
p(λ) = λⁿ + c₁λⁿ⁻¹ + c₂λⁿ⁻² + ... + cₙ
```

### Display Format

The tool displays the polynomial in standard form:

```
λ⁸ - 12λ⁶ + 38λ⁴ - 36λ² + 9
```

For large coefficients, scientific notation is used.

---

## Numerical Root Finding

After obtaining exact coefficients, eigenvalues are found numerically:

### Methods

1. **Companion matrix**: Form companion matrix and use standard eigenvalue solver
2. **Newton-Raphson**: Iterative refinement from approximate roots
3. **Laguerre's method**: Robust for polynomials with real roots

### Implementation

```javascript
function findRoots(coefficients) {
    // Use companion matrix method
    const companion = buildCompanion(coefficients);
    const eigenvalues = computeEigenvalues(companion);
    return eigenvalues.sort((a, b) => b - a);  // Descending order
}
```

---

## Special Cases

### Symmetric Matrices

For symmetric A:
- All eigenvalues are real
- Polynomial has only real roots
- Coefficients alternate in sign pattern

### Skew-Symmetric Matrices

For skew-symmetric J:
- Eigenvalues are purely imaginary: ±iω
- Polynomial in λ² has real coefficients
- p(λ) = q(λ²) for some polynomial q

---

## Historical Notes

The algorithm has multiple discoverers:

- **Souriau (1948)**: French mathematician, first publication
- **Frame (1949)**: Independent discovery
- **Faddeev (1963)**: Systematic treatment in Soviet literature

Also known as:
- Faddeev-LeVerrier algorithm
- Frame's method
- Souriau's method

---

## References

- Souriau, J.-M. (1948). Une méthode pour la décomposition spectrale. *Comptes Rendus*, 227.
- Faddeev, D. K., & Faddeeva, V. N. (1963). *Computational Methods of Linear Algebra*. Freeman.
- Householder, A. S. (1964). *The Theory of Matrices in Numerical Analysis*. Blaisdell.
