# Zeid-Rosenberg Eigenvalue Explorer - Documentation

Welcome to the scientific documentation for the **Zeid-Rosenberg Eigenvalue Explorer**.

## Overview

This tool explores the relationship between **graph topology** and **eigenspectra** for physical network analogs with uniform parameters (±1). The same mathematical framework applies to:

- **Mass-spring systems** (mechanical)
- **LC circuits** (electrical)
- **Rotational inertia-torsional spring systems** (mechanical)

## Documentation Index

### Theoretical Background

| Page | Description |
|------|-------------|
| [[Port-Hamiltonian-Systems]] | Mathematical framework for energy-conserving systems on graphs |
| [[Spectral-Graph-Theory]] | Eigenvalues, eigenvectors, and their physical interpretation |
| [[Uniform-Parameter-Assumption]] | Why we use ±1 parameters and what this reveals |

### Algorithms & Methods

| Page | Description |
|------|-------------|
| [[SFF-Algorithm]] | Souriau-Frame-Faddeev algorithm for exact polynomial computation |
| [[Numerical-Integrators]] | Rodrigues, Cayley, and Trapezoidal integration methods |
| [[Analytic-Eigenspectra]] | Finding graphs with closed-form eigenvalue formulas |

### Graph Operations

| Page | Description |
|------|-------------|
| [[Graph-Products]] | Cartesian, Tensor, and Realizable products |
| [[Realizability-Analysis]] | Determining if a graph represents a valid physical network |
| [[Graph-Families]] | Catalog of built-in graph templates and their spectra |

### Visualization

| Page | Description |
|------|-------------|
| [[Graph-Universe]] | 3D spectral space visualization |
| [[Eigenmode-Animation]] | Visualizing eigenvector oscillation patterns |
| [[Phase-Diagrams]] | Power flow and energy visualization |

---

## Quick Links

- 🔗 [Live Demo](https://draazeid-git.github.io/graph-eigenvalue/)
- 📂 [GitHub Repository](https://github.com/draazeid-git/graph-eigenvalue)
- 📖 [README](https://github.com/draazeid-git/graph-eigenvalue#readme)

---

## Mathematical Notation

Throughout this documentation:

| Symbol | Meaning |
|--------|---------|
| **G = (V, E)** | Graph with vertices V and edges E |
| **n = \|V\|** | Number of vertices |
| **m = \|E\|** | Number of edges |
| **A** | Adjacency matrix (symmetric) |
| **J** | Skew-symmetric adjacency matrix |
| **B** | Incidence matrix |
| **λᵢ** | Eigenvalue |
| **vᵢ** | Eigenvector |
| **ρ(G)** | Spectral radius = max\|λᵢ\| |
| **E(G)** | Graph energy = Σ\|λᵢ\| |
| **p** | Momentum-like (inertia) nodes |
| **q** | Position-like (stiffness) nodes |
