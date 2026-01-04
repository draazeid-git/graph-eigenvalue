# Eigenmode Animation

## Overview

**Eigenmode animation** visualizes how nodes oscillate in the characteristic patterns determined by eigenvectors. Each eigenvalue corresponds to a distinct oscillation mode.

## Mathematical Foundation

### Eigenvectors as Mode Shapes

For a system ẋ = Jx with eigenvalue λ and eigenvector v:

```
x(t) = e^(λt) v
```

For skew-symmetric J with λ = iω:
```
x(t) = cos(ωt)·Re(v) + sin(ωt)·Im(v)
```

This describes **harmonic oscillation** at frequency ω.

### Real vs Imaginary Parts

For purely imaginary eigenvalues λ = ±iω:
- **Real part of eigenvector**: Initial displacement pattern
- **Imaginary part**: Velocity pattern (90° out of phase)

### Superposition

General motion is a superposition of all modes:
```
x(t) = Σ cₖ e^(λₖt) vₖ
```

where cₖ depend on initial conditions.

## Visualization Modes

### Node Displacement

Nodes move radially from equilibrium:
- **Amplitude**: |vᵢ| determines how much node i moves
- **Phase**: arg(vᵢ) determines when node i is at maximum
- **Direction**: Sign determines inward vs outward

### Node Coloring

Color indicates instantaneous state:
- **Blue**: Positive displacement
- **Red**: Negative displacement
- **Intensity**: Proportional to magnitude

### Node Sizing

Size pulses with oscillation:
- **Large**: At maximum displacement
- **Small**: At minimum displacement
- **Normal**: At zero crossing

## Mode Characteristics

### Fundamental Mode (λ₁)

The mode corresponding to the largest eigenvalue:
- Lowest frequency
- Often corresponds to "bulk" motion
- All nodes tend to move together

### Higher Modes

Higher eigenvalues correspond to:
- Higher frequencies
- More complex spatial patterns
- More nodes out of phase

### Zero Modes

Eigenvalue λ = 0 indicates:
- No oscillation (static mode)
- Rigid-body motion
- System not fully constrained

## Physical Interpretation

### Mass-Spring Systems

| Eigenvalue | Physical Meaning |
|------------|------------------|
| Large |λ|| High frequency, stiff modes |
| Small |λ|| Low frequency, flexible modes |
| λ = 0 | Rigid body motion |

### Natural Frequencies

For uniform mass-spring with eigenvalue λ:
```
ω = √|λ|  (angular frequency)
f = ω/(2π)  (frequency in Hz)
```

### Mode Shapes

The eigenvector pattern shows:
- Which masses move together (same sign)
- Which masses move opposite (different signs)
- Which masses are stationary (zero components)

## Interactive Features

### Selecting Eigenvalues

Click any eigenvalue in the ANALYZE tab to:
1. Highlight it in the list
2. Begin eigenmode animation
3. Display eigenvector components

### Animation Controls

| Control | Effect |
|---------|--------|
| Play/Pause | Toggle animation |
| Speed slider | Adjust oscillation rate |
| Amplitude slider | Scale displacement magnitude |

### Mode Comparison

Compare modes by:
- Selecting different eigenvalues sequentially
- Observing frequency differences
- Noting spatial pattern changes

## Degenerate Modes

### Definition

When multiple eigenvalues are equal (multiplicity > 1), the eigenspace is multi-dimensional.

### Physical Meaning

- System has **symmetry**
- Any linear combination is also an eigenmode
- Modes can "rotate" within the eigenspace

### Visualization

For degenerate modes:
- Arbitrary choice of basis shown
- Real system may show any combination
- Symmetry-breaking perturbations split degeneracy

## Algorithm Implementation

### Eigenvector Computation

```javascript
function animateMode(eigenvalue, eigenvector, t) {
    const omega = Math.abs(eigenvalue);
    const phase = Math.atan2(eigenvalue.imag, eigenvalue.real);
    
    for (let i = 0; i < nodes.length; i++) {
        const amplitude = Math.abs(eigenvector[i]);
        const nodePhase = Math.atan2(eigenvector[i].imag, eigenvector[i].real);
        
        const displacement = amplitude * Math.cos(omega * t + nodePhase);
        
        updateNodePosition(i, displacement);
        updateNodeColor(i, displacement);
    }
}
```

### Smooth Animation

Animation uses requestAnimationFrame for smooth 60fps:
```javascript
function animate() {
    const t = performance.now() / 1000;
    animateMode(selectedEigenvalue, selectedEigenvector, t);
    requestAnimationFrame(animate);
}
```

## Educational Applications

### Understanding Modes

Students can:
- Visualize abstract eigenvector concepts
- Connect mathematics to physical motion
- Develop intuition for spectral properties

### Predicting Behavior

Given a graph structure:
- Predict which nodes move together
- Estimate relative frequencies
- Understand symmetry effects

### Design Insights

For system design:
- Identify problematic resonances
- Find isolation points (zero eigenvector components)
- Understand frequency spacing

## Common Patterns

### Path Graphs

Modes resemble standing waves:
- Mode 1: Half wavelength
- Mode 2: Full wavelength
- Mode k: k half-wavelengths

### Complete Graphs

Due to symmetry:
- One mode: All nodes together (λ = n-1)
- Degenerate modes: Various anti-phase patterns (λ = -1)

### Bipartite Graphs

Modes come in pairs:
- If v is a mode for λ
- Then v' (negated on one part) is mode for -λ

## References

- Meirovitch, L. (1967). *Analytical Methods in Vibrations*. Macmillan.
- Rao, S. S. (2007). *Vibration of Continuous Systems*. Wiley.
- Strang, G. (1986). *Introduction to Applied Mathematics*. Wellesley-Cambridge.
