# 🌐 Zeid-Rosenberg Eigenvalue Explorer

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![JavaScript](https://img.shields.io/badge/JavaScript-ES6+-yellow.svg)](https://www.javascript.com/)
[![Three.js](https://img.shields.io/badge/Three.js-r160+-black.svg)](https://threejs.org/)
[![Version](https://img.shields.io/badge/Version-7.12-green.svg)](https://github.com/draazeid-git/graph-eigenvalue)

**A powerful web-based tool for visualizing graph structures, computing eigenvalues with exact arithmetic, exploring spectral graph theory through an immersive 3D "Graph Universe", and analyzing port-Hamiltonian realizability for mass-spring systems.**

🔗 **Live Demo:** [https://draazeid-git.github.io/graph-eigenvalue/](https://draazeid-git.github.io/graph-eigenvalue/)

![Graph Visualization Demo](docs/images/demo-wheel-graph.jpg)

---

## 📋 Table of Contents

- [Overview](#overview)
- [What's New in v7.12](#whats-new-in-v712)
- [Key Features](#key-features)
- [Physics Engine](#physics-engine)
- [Graph Universe](#graph-universe)
- [Installation](#installation)
- [Quick Start Guide](#quick-start-guide)
- [File Structure](#file-structure)
- [Dependencies](#dependencies)
- [License](#license)

---

## Overview

The **Zeid-Rosenberg Eigenvalue Explorer** is a comprehensive web application for exploring the relationship between graph topology, matrix spectra, and dynamic behavior. It implements the **Zeid-Rosenberg eigenvalue estimation framework** with exact arithmetic computation via the **Souriau-Frame-Faddeev (SFF)** algorithm, plus **port-Hamiltonian realizability analysis** for mass-spring systems.

### What Makes This Tool Unique

| Feature | Description |
|---------|-------------|
| **Graph Universe** | Explore 247+ graphs in 3D space positioned by spectral properties |
| **Physics Engine** | Port-Hamiltonian realizability audit for mass-spring systems |
| **Mass-Spring Templates** | 6 pre-built realizable system configurations |
| **Product Graphs** | Cartesian (□), Tensor (⊗), and Realizable (⚡) products |
| **Face Visualization** | Polygon face detection with adjustable colors |
| **Dynamic Axis Mapping** | Configure X/Y/Z axes to any spectral metric |
| **Exact Polynomial Computation** | BigInt arithmetic via SFF algorithm |
| **Eigenmode Animation** | Click any eigenvalue to visualize oscillation patterns |
| **Sparse Matrix Optimization** | SpMV enables dynamics for n > 100 on sparse graphs |

---

## What's New in v7.12

### 🔧 Physics Engine & Mass-Spring Systems

The SIMULATE tab now includes comprehensive **port-Hamiltonian realizability analysis**:

| Feature | Description |
|---------|-------------|
| **Realizability Audit** | Checks if graph represents valid mass-spring system |
| **Partition Grid** | Visual p/q node assignment (click to toggle) |
| **Auto-Discovery** | Automatically finds bipartite partition |
| **Grounded Springs** | Detects springs connected to ground (zero columns) |
| **B-Matrix Analysis** | Shows interconnection matrix with column analysis |
| **Rectification** | One-click fix for non-physical systems |
| **Undo Support** | Restore original graph after rectification |

### 🏗️ Mass-Spring Graph Templates

Eight pre-built realizable mass-spring configurations:

| Template | Description | Nodes |
|----------|-------------|-------|
| **Mass-Spring Chain** | Linear chain with grounded ends | 2n+1 |
| **Mass-Spring Star** | Central mass with radiating springs | 2n+1 |
| **Mass-Spring Tree** | Binary tree structure | 2^(d+1)-1 |
| **Mass-Spring Cantilever** | Fixed-free beam model | 2n |
| **Mass-Spring Bridge** | Doubly-grounded structure | 2n+1 |
| **Mass-Spring Grid** | m×n checkerboard pattern | m×n + springs |
| **Drum (Radial)** | n branches × m rings | 1+3nm |
| **Drum Constrained** | With grounded boundary springs (radial) | 1+3nm+n |

### ✖️ Product Graph Operations

Build complex graphs from simpler components:

| Operation | Symbol | Description |
|-----------|--------|-------------|
| **Cartesian Product** | □ | G □ H - preserves distances |
| **Tensor Product** | ⊗ | G ⊗ H - categorical product |
| **Realizable Product** | ⚡ | Physics-preserving combination |

Product graphs automatically use **grid layout** for proper visualization.

### 🎨 Face Visualization Enhancements

| Control | Range | Description |
|---------|-------|-------------|
| **Opacity** | 10-95% | Face transparency |
| **Brightness** | 50-150% | Color lightness (min 60%) |
| **Saturation** | 50-150% | Color intensity |
| **Background** | 5 presets | Dark/Gray/Light/White/Black |

Face detection supports cycles up to **octagons (8-gons)** for Mass-Spring grids.

### ⚡ Performance Optimizations

Size limits prevent freezing on large graphs:

| Operation | Limit | Notes |
|-----------|-------|-------|
| Face Detection | n ≤ 40 | Skipped for larger graphs |
| Physics Audit | n ≤ 40 | Shows warning message |
| Analysis/Eigenvalues | n ≤ 40 | Basic properties still shown |
| Partition Grid UI | n ≤ 40 | Disabled for large graphs |

### 🧹 UI Simplifications

- Removed **Search Library** section from Library tab
- Removed **Jump to Galaxy** dropdown from Universe navigation  
- Removed duplicate **Current Phase Plot** - kept only Enhanced Phase Plot
- Eigenmode animation **stops automatically** when switching tabs

---

## Key Features

### 🔨 BUILD Tab - Graph Construction

- **61+ Built-in Templates** - Path, Cycle, Star, Complete, Wheel, Hypercube, Petersen, and more
- **6 Mass-Spring Templates** - Pre-configured realizable systems
- **Product Operations** - Cartesian □, Tensor ⊗, Realizable ⚡ products
- **Layout Options** - Circle, Sphere, Concentric, Grid arrangements
- **Force-Directed Layout** - Auto-arrange with 3D physics simulation
- **Universe Integration** - Send graphs to 3D Galaxy view

### ✏️ EDIT Tab - Manual Graph Editing

- **Tool Palette** - Select, Add Vertex, Add Edge, Delete modes
- **Drag Mode** - Reposition vertices interactively in 3D
- **Edge Management** - Click to add/remove connections
- **Face Controls** - Toggle faces, adjust opacity/brightness/saturation

### 🧪 SIMULATE Tab - Dynamics & Physics

#### Dynamics Section
- **Three Integrators**: Rodrigues (exact), Cayley (symplectic), Trapezoidal
- **SpMV Optimization** - O(m) instead of O(n²) for sparse graphs
- **Enhanced Phase Plot** - Trajectory, amplitude bounds, frequency modes

#### Physics Section (Port-Hamiltonian)
- **Realizability Audit** - Check if graph is valid mass-spring system
- **Partition Control** - Visual grid for p/q node assignment
- **Column Analysis** - Identify masses, springs, grounded nodes
- **Rectification** - Fix non-physical systems automatically
- **Undo** - Restore original graph after modifications

### 📊 ANALYZE Tab - Spectral Analysis

- **Graph Detection** - Automatic family identification (60+ types)
- **SFF Polynomial** - Exact integer coefficients via BigInt
- **Clickable Eigenvalues** - Trigger eigenmode animation
- **Closed-Form Display** - Formulas like λₖ = 2cos(2kπ/n)
- **Dual Spectrum** - Both symmetric and skew-symmetric eigenvalues

### 🌌 UNIVERSE Tab - 3D Exploration

- **247+ Graphs** - From 30+ families
- **Configurable Axes** - Map any metric to X/Y/Z
- **Log Scale** - Spread clustered data
- **Adaptive Labels** - Distance-based visibility
- **Fly-to Navigation** - Jump to specific families

---

## Physics Engine

The physics engine implements **port-Hamiltonian system analysis** based on van der Schaft & Maschke (2012).

### Realizability Conditions

A graph represents a valid mass-spring system if:

1. **Bipartite Structure** - Nodes partition into p (momenta) and q (displacements)
2. **Skew-Symmetric J** - The J matrix must be skew-symmetric
3. **Positive Semi-Definite R** - Dissipation matrix R ≥ 0
4. **Physical B-Matrix** - Each column has exactly one +1 and one -1 (or one ±1 for grounded)

### Node Types

| Type | Color | Description |
|------|-------|-------------|
| **p-nodes** | Blue | Momentum variables (masses) |
| **q-nodes** | Orange | Displacement variables (springs) |
| **Grounded q** | Teal | Springs connected to ground |

### Rectification

Non-physical graphs can be automatically fixed:
- Removes diagonal entries (self-loops)
- Ensures proper ±1 structure in B-matrix
- Preserves graph topology where possible

---

## Graph Universe

The Graph Universe provides a 3D visualization where graphs are positioned by their spectral properties.

### Controls

| Key | Action |
|-----|--------|
| **Mouse Drag** | Rotate view |
| **Scroll** | Zoom in/out |
| **WASD** | Pan camera |
| **F** | Fit all in view |
| **E** | Expand all graphs |
| **C** | Collapse all graphs |
| **H** | Toggle highlight mode |
| **Click** | Select graph |
| **Double-click** | Load graph into editor |

### Axis Metrics

| Metric | Description |
|--------|-------------|
| `Scaling Exp (α)` | How ρ grows with n: 0=bounded, 0.5=√n, 1=linear |
| `Spectral Radius (ρ)` | Maximum absolute eigenvalue |
| `Avg Vertices (n)` | Number of vertices |
| `Energy` | Sum of absolute eigenvalues |
| `Regularity` | Uniformity of degree distribution |
| `Spectral Gap` | λ₁ - λ₂ (expansion quality) |
| `λ_max/λ_min` | Eigenvalue ratio |
| `ρ/n Ratio` | Normalized spectral radius |

---

## Installation

### Option 1: Direct Browser (Recommended)

Simply open `index.html` in a modern browser (Chrome, Firefox, Edge).

### Option 2: Local Server

```bash
# Using Python
python server.py
# Then open http://localhost:8000

# Or using any HTTP server
npx serve .
```

### Option 3: GitHub Pages

Fork the repository and enable GitHub Pages for instant deployment.

---

## Quick Start Guide

### Basic Graph Exploration

1. **Open** `index.html` in your browser
2. **BUILD Tab**: Select a graph template (e.g., "Wheel W_8")
3. **Click "Create"** to generate the graph
4. **ANALYZE Tab**: View eigenvalues and click one to animate
5. **UNIVERSE Tab**: Click "Add to Universe" to explore in 3D

### Mass-Spring System Analysis

1. **BUILD Tab**: Select "Mass-Spring Grid" from Realizable Systems
2. **Set n=3** for a 3×3 grid (21 nodes total)
3. **Click "Create"** to generate
4. **SIMULATE Tab** → Physics section
5. **Click "Audit System"** to check realizability
6. View partition grid and B-matrix analysis

### Product Graph Construction

1. **BUILD Tab**: Create first graph (e.g., Path P_3)
2. **Product Graphs section**: Set as "Graph A"
3. Create second graph (e.g., Cycle C_4)
4. Set as "Graph B"
5. Select operation (□, ⊗, or ⚡)
6. **Click "Build Product"**

---

## File Structure

```
graph-project/
├── index.html              # Main application
├── styles.css              # Styling
├── main.js                 # Application orchestrator
│
├── graph-core.js           # Three.js scene, rendering, faces
├── graph-universe.js       # 3D universe visualization
├── spectral-analysis.js    # SpectralEngine, SFF algorithm
├── dynamics-animation.js   # SparseMatrix, integrators
│
├── physics-engine.js       # Port-Hamiltonian analysis
├── physics-ui.js           # Physics UI components
│
├── analytic-detection.js   # Graph family identification
├── matrix-analysis-ui.js   # Eigenvalue display UI
├── zeid-rosenberg.js       # Eigenvalue formulas
├── chebyshev-factorizer.js # Chebyshev polynomial analysis
│
├── graph-library.js        # localStorage persistence
├── graph-database.js       # In-memory caching
├── graph-finder.js         # Graph search utilities
│
├── server.py               # Local development server
├── find_analytic_graphs.py # Python utility
├── verify_universe_positions.py # Position verification
│
├── START.bat               # Windows launcher
├── FIND_GRAPHS.bat         # Windows batch script
│
├── DEPENDENCIES.md         # External library documentation
├── PHYSICS-ENGINE-README.md # Physics engine documentation
├── LICENSE                 # MIT License
└── docs/
    └── images/
        └── demo-wheel-graph.jpg
```

---

## Dependencies

### External Libraries

| Library | Version | CDN | Purpose |
|---------|---------|-----|---------|
| Three.js | r160+ | unpkg.com | 3D WebGL rendering |
| OrbitControls | (bundled) | unpkg.com | Camera interaction |

**No other external dependencies** - pure vanilla JavaScript ES6+

### Browser Requirements

- WebGL 2.0 support
- ES6+ JavaScript (modules, BigInt, async/await)
- Modern browser (Chrome 80+, Firefox 75+, Edge 80+, Safari 14+)

---

## Version History

### v7.12 (Current) - Physics Engine & Mass-Spring Systems

- 🔧 **Port-Hamiltonian Analysis** - Realizability audit for mass-spring systems
- 🏗️ **8 Mass-Spring Templates** - Chain, Star, Tree, Cantilever, Bridge, Grid, Drum, Drum Constrained
- ✖️ **Product Graph Operations** - Cartesian □, Tensor ⊗, Realizable ⚡
- 🎨 **Face Visualization** - Adjustable opacity, brightness, saturation, background
- ⚡ **Performance Limits** - Size limits (n≤40) prevent freezing
- 🧹 **UI Cleanup** - Removed Search Library, Galaxy Jump, duplicate Phase Plot

### v55 - Clean Universe & Dynamic Axes

- ✨ **Dynamic Axis Mapping** - Configure X/Y/Z to any spectral metric
- 🧹 **Decluttered View** - Removed galaxy names, starfield, wireframe bubbles
- 📊 **Log Scale Option** - Spread clustered data points
- 🏷️ **Smart Labels** - Adaptive visibility based on zoom level

### v35 - Major Performance Update

- 7-Tab Interface (BUILD, EDIT, SIMULATE, ANALYZE, BOUNDS, ADVANCED, LIBRARY)
- SpMV Optimization (76-100x speedup for sparse graphs)
- Eigenmode Animation
- Enhanced SFF Engine with BigInt

---

## References

- van der Schaft, A., & Maschke, B. (2012). Port-Hamiltonian Systems on Graphs. *SIAM Journal on Control and Optimization*.
- Zeid, A. (2024). Eigenvalue Estimation Framework for Spectral Graph Theory.

---

## License

MIT License - see [LICENSE](LICENSE) file.

---

## Citation

If you use this tool in academic work:

```bibtex
@software{zeid_rosenberg_explorer,
  title = {Zeid-Rosenberg Eigenvalue Explorer},
  author = {Zeid, Ashraf},
  year = {2024},
  version = {7.12},
  url = {https://github.com/draazeid-git/graph-eigenvalue}
}
```

---

**Built with ❤️ for the spectral graph theory and port-Hamiltonian systems community**
