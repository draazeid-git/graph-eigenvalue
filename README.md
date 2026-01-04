# 🌐 Zeid-Rosenberg Eigenvalue Explorer

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![Version](https://img.shields.io/badge/Version-7.25-green.svg)](https://github.com/draazeid-git/graph-eigenvalue)
[![Live Demo](https://img.shields.io/badge/Demo-Live-brightgreen)](https://draazeid-git.github.io/graph-eigenvalue/)
[![GitHub stars](https://img.shields.io/github/stars/draazeid-git/graph-eigenvalue?style=social)](https://github.com/draazeid-git/graph-eigenvalue/stargazers)

[![JavaScript](https://img.shields.io/badge/JavaScript-ES6+-yellow.svg)](https://www.javascript.com/)
[![Three.js](https://img.shields.io/badge/Three.js-r160+-black.svg)](https://threejs.org/)
[![WebGL](https://img.shields.io/badge/WebGL-2.0-red.svg)](https://www.khronos.org/webgl/)
[![No Dependencies](https://img.shields.io/badge/Dependencies-None-success)](https://github.com/draazeid-git/graph-eigenvalue)

**A web-based tool for exploring how graph topology influences eigenspectra in the special case of uniform parameters (±1). Visualize graph structures, compute eigenvalues with exact arithmetic, explore spectral graph theory through an immersive 3D "Graph Universe", and analyze port-Hamiltonian realizability for physical network analogs.**

🔗 **Live Demo:** [https://draazeid-git.github.io/graph-eigenvalue/](https://draazeid-git.github.io/graph-eigenvalue/)

📖 **Wiki Documentation:** [https://github.com/draazeid-git/graph-eigenvalue/wiki](https://github.com/draazeid-git/graph-eigenvalue/wiki)

![Graph Visualization Demo](docs/images/demo-wheel-graph.jpg)

---

## 📋 Table of Contents

- [Overview](#overview)
- [Scientific Scope](#scientific-scope)
- [What's New in v7.25](#whats-new-in-v725)
- [Key Features](#key-features)
- [Tutorial System](#tutorial-system)
- [Physics Engine](#physics-engine)
- [Graph Universe](#graph-universe)
- [Installation](#installation)
- [Quick Start Guide](#quick-start-guide)
- [File Structure](#file-structure)
- [Dependencies](#dependencies)
- [License](#license)

---

## Overview

The **Zeid-Rosenberg Eigenvalue Explorer** is a comprehensive web application for exploring the relationship between graph topology, matrix spectra, and dynamic behavior. It implements the **Zeid-Rosenberg eigenvalue estimation framework** with exact arithmetic computation via the **Souriau-Frame-Faddeev (SFF)** algorithm, plus **port-Hamiltonian realizability analysis** for physical network analogs.

---

## Scientific Scope

### Uniform Parameter Assumption

**Important:** This tool treats the special case of **uniform parameters (±1)** throughout all gyrators, transformers, and inertia elements. This simplification allows us to focus on how **graph structure alone** influences eigenspectra properties, independent of parameter variations.

### Physical Network Analogs

The realizability analysis determines whether a graph structure can represent physical networks across multiple energy domains:

| Domain | p-nodes (Flow) | q-nodes (Effort) | Interconnection |
|--------|----------------|------------------|-----------------|
| **Mechanical (Translational)** | Masses (momentum) | Springs (displacement) | Mass-spring networks |
| **Mechanical (Rotational)** | Rotational inertias | Torsional springs | Gear/shaft systems |
| **Electrical** | Inductors (flux linkage) | Capacitors (charge) | LC networks |

All these physical systems share the same mathematical structure under the uniform parameter assumption, making the graph topology the determining factor for spectral properties.

### Objective

The primary objective is to provide a **visual environment** for exploring how graph structures influence eigenspectra properties when all network parameters are normalized to ±1. This enables:

- Studying spectral properties determined purely by topology
- Comparing eigenvalue distributions across graph families
- Understanding the relationship between graph connectivity and dynamic behavior
- Visualizing how structural changes affect spectral characteristics

### What Makes This Tool Unique

| Feature | Description |
|---------|-------------|
| **Uniform Parameters** | All network elements use ±1 values to isolate topological effects |
| **Interactive Tutorials** | 12 guided tours for students and researchers |
| **Graph Universe** | Explore 247+ graphs in 3D space positioned by spectral properties |
| **Realizability Analysis** | Port-Hamiltonian audit for physical network analogs |
| **Multi-Domain Templates** | Pre-built realizable configurations (mass-spring, LC, rotational) |
| **Product Graphs** | Cartesian (□), Tensor (⊗), and Realizable (⚡) products |
| **Face Visualization** | Polygon face detection with adjustable colors |
| **Dynamic Axis Mapping** | Configure X/Y/Z axes to any spectral metric |
| **Exact Polynomial Computation** | BigInt arithmetic via SFF algorithm |
| **Eigenmode Animation** | Click any eigenvalue to visualize oscillation patterns |
| **Sparse Matrix Optimization** | SpMV enables dynamics for n > 100 on sparse graphs |

---

## What's New in v7.25

### 🎓 Interactive Tutorial System

Added a comprehensive interactive tutorial system with 12 guided tours designed for students and researchers:

| Tour | Content |
|------|---------|
| **🏗️ Building Graphs** | Templates, force layout, face visualization, product graphs |
| **✏️ Editing Graphs** | Drag, view, project, distribute, snap-to-grid |
| **📊 Spectral Analysis** | Skew-symmetric matrix, characteristic polynomial, eigenvalues |
| **🌊 Eigenmode Animation** | Visualize characteristic vectors in motion |
| **🎬 Dynamics & Power Flow** | Integrators (Rodrigues/Cayley/Trapezoidal), Enhanced Viz Dashboard |
| **⚙️ Realizable Systems** | Physical network analogs, grounded elements, pin/freeze nodes, rectification |
| **📐 Bounds & Zeid-Rosenberg** | Eigenvalue bounds, spectral radius, energy estimation |
| **🌌 Graph Universe** | 3D exploration, axis configuration, spectral metrics |
| **🔍 Analytic Finder** | Search for graphs with symbolic eigenvalues |
| **🔗 Network Topology** | Graph structures as physical network interconnections |
| **📚 Library & Saving** | Save, load, export graphs |
| **⌨️ Keyboard Shortcuts** | All hotkeys for power users |

**Features:**
- Button-triggered (click **?** button in bottom-right corner)
- Interactive steps that wait for user actions
- Progress persistence across sessions
- Spotlight highlighting of UI elements
- Keyboard navigation (←/→, Enter, Esc)

### 🐛 Previous Bug Fixes (v7.24)

#### Enhanced Visualization Dashboard - Phase Plot Fix

Fixed a critical bug where the phase plot in the Enhanced Visualization Dashboard showed constant zero values for one axis.

**Solution:** Added independent `enhancedPhaseTrail` that computes phase values directly from dynamics state.

| Component | Before | After |
|-----------|--------|-------|
| Phase trail source | Shared with regular phase plot | Independent trail for Enhanced Viz |
| Checkbox dependency | Required "Enable Phase Diagram" | Works independently |

---

## Tutorial System

### Getting Started

Click the **?** button in the bottom-right corner to open the tutorial menu.

### Available Tours

**Getting Started:**
- 🏗️ Building Graphs - Create and customize graphs with templates, layouts, and products
- ✏️ Editing Graphs - Manual graph modification, drag mode, projections

**Analysis:**
- 📊 Spectral Analysis - Examine matrices, polynomials, and eigenvalues
- 🌊 Eigenmode Animation - Visualize eigenvectors in motion
- 📐 Bounds & Zeid-Rosenberg - Eigenvalue estimation and bounds

**Simulation:**
- 🎬 Dynamics & Power Flow - Animate dynamics with different integrators
- ⚙️ Realizable Linear Systems - Mass-spring physics, grounded springs, pin/freeze

**Advanced:**
- 🌌 Graph Universe - Explore graphs in 3D spectral space
- 🔍 Analytic Graph Finder - Find graphs with symbolic eigenvalues
- 🔗 Network Topology - Graph structures as physical network interconnections

**Utilities:**
- 📚 Library & Saving - Manage your graph collection
- ⌨️ Keyboard Shortcuts - Master the hotkeys

### Interactive Features

- **Spotlight highlighting** - Target elements are highlighted with a glowing border
- **Wait for action** - Some steps require you to complete an action before continuing
- **Progress tracking** - Completed tours show a ✓ checkmark
- **Reset progress** - Clear all progress and start fresh

---

---

## Key Features from v7.12

### 🔧 Realizability Analysis & Physical Network Analogs

The SIMULATE tab includes comprehensive **port-Hamiltonian realizability analysis** for physical networks with uniform parameters (±1):

| Feature | Description |
|---------|-------------|
| **Realizability Audit** | Checks if graph represents valid physical network (mass-spring, LC, rotational) |
| **Partition Grid** | Visual p/q node assignment (click to toggle) |
| **Auto-Discovery** | Automatically finds bipartite partition |
| **Grounded Elements** | Detects elements connected to ground (zero columns in B-matrix) |
| **B-Matrix Analysis** | Shows interconnection matrix with column analysis |
| **Rectification** | One-click fix for non-physical systems |
| **Undo Support** | Restore original graph after rectification |

**Note:** All network parameters are normalized to ±1 to study topological effects on eigenspectra.

### 🏗️ Realizable Network Templates

Eight pre-built realizable configurations applicable to mass-spring, LC circuits, and rotational systems:

| Template | Description | Nodes |
|----------|-------------|-------|
| **Mass-Spring Chain** | Linear chain with grounded ends | 2n+1 |
| **Mass-Spring Star** | Central mass with radiating springs | 2n+1 |
| **Mass-Spring Tree** | Star-tree structure (realizable) | varies |
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

---

## Key Features

### 🔨 BUILD Tab - Graph Construction

- **61+ Built-in Templates** - Path, Cycle, Star, Complete, Wheel, Hypercube, Petersen, and more
- **8 Realizable Templates** - Pre-configured physical network configurations
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
- **Realizability Audit** - Check if graph is valid physical network (uniform ±1 parameters)
- **Partition Control** - Visual grid for p/q node assignment
- **Column Analysis** - Identify inertia elements, stiffness elements, grounded nodes
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
3. **Click "Apply Template"** to generate the graph
4. **ANALYZE Tab**: View eigenvalues and click one to animate
5. **LIBRARY Tab** → Universe View: Explore graphs in 3D spectral space

### Physical Network Analysis

1. **BUILD Tab**: Select "Realizable Chain" or "Realizable Grid" from templates
2. **Set n=3** for appropriate size
3. **Click "Apply Template"** to generate
4. **SIMULATE Tab** → Physics section
5. **Click "Audit Realizability"** to check physical validity
6. View partition grid and B-matrix analysis

**Note:** All physical parameters are uniform (±1). The analysis applies equally to mass-spring, LC circuit, or rotational inertia-torsional spring analogs.

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

### v7.24 (Current) - Enhanced Visualization Phase Plot Fix

- 🐛 **Phase Plot Bug Fix** - Enhanced Visualization Dashboard now shows correct phase data independently
- 🔧 **Independent Phase Trail** - Added `enhancedPhaseTrail` computed directly from dynamics state
- 🏷️ **Axis Label Fix** - Corrected mode label mismatches in Enhanced Visualization
- 🧹 **Trail Management** - Proper clearing on mode/node changes and popup open/close

### v7.20-v7.23 - Stability Improvements

- 🔧 **Partition Preservation** - Templates correctly reset physics partition
- 🐛 **toFixed Error** - Handles symbolic eigenvalues like "√5"
- 🌳 **Mass-Tree Fix** - Changed from binary tree to star-tree for realizability
- 💾 **Universe Saving** - Switching to Table view now saves Universe graphs to Library

### v7.12 - Physics Engine & Mass-Spring Systems

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

### Port-Hamiltonian Systems & Network Theory

- van der Schaft, A., & Maschke, B. (2014). Port-Hamiltonian Systems on Graphs. *SIAM Journal on Control and Optimization*, 51(2), 906-937. https://doi.org/10.1137/110840091

- van der Schaft, A., & Maschke, B. (2013). Port-Hamiltonian Systems: An Introductory Survey. *Proceedings of the International Congress of Mathematicians*, Madrid.

- Maschke, B., & van der Schaft, A. (1992). Port-Controlled Hamiltonian Systems: Modelling Origins and System-Theoretic Properties. *IFAC Proceedings Volumes*, 25(13), 359-365.

- van der Schaft, A. (2017). *L2-Gain and Passivity Techniques in Nonlinear Control* (3rd ed.). Springer.

### Spectral Graph Theory

- Brouwer, A. E., & Haemers, W. H. (2012). *Spectra of Graphs*. Springer. https://doi.org/10.1007/978-1-4614-1939-6

- Chung, F. R. K. (1997). *Spectral Graph Theory*. American Mathematical Society.

- Cvetković, D., Rowlinson, P., & Simić, S. (2010). *An Introduction to the Theory of Graph Spectra*. Cambridge University Press.

- Godsil, C., & Royle, G. (2001). *Algebraic Graph Theory*. Springer.

### Numerical Methods & Algorithms

- Souriau, J.-M. (1948). Une méthode pour la décomposition spectrale et l'inversion des matrices. *Comptes Rendus*, 227, 1010-1011.

- Frame, J. S. (1949). A Simple Recursion Formula for Inverting a Matrix. *Bulletin of the American Mathematical Society*, 55, 1045.

- Faddeev, D. K., & Faddeeva, V. N. (1963). *Computational Methods of Linear Algebra*. Freeman.

- Iserles, A., Munthe-Kaas, H. Z., Nørsett, S. P., & Zanna, A. (2000). Lie-group Methods. *Acta Numerica*, 9, 215-365.

### This Implementation

- Zeid, A. (2024). Eigenvalue Estimation Framework for Spectral Graph Theory. *Working Paper*.

- Zeid, A. (2025). Zeid-Rosenberg Eigenvalue Explorer: A Visual Tool for Spectral Graph Theory and Port-Hamiltonian Systems. https://github.com/draazeid-git/graph-eigenvalue

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
  year = {2025},
  version = {7.25},
  url = {https://github.com/draazeid-git/graph-eigenvalue},
  note = {A visual tool for spectral graph theory and port-Hamiltonian systems}
}
```

For the underlying theoretical framework:

```bibtex
@article{vanderschaft2014port,
  title = {Port-{H}amiltonian Systems on Graphs},
  author = {van der Schaft, Arjan and Maschke, Bernhard},
  journal = {SIAM Journal on Control and Optimization},
  volume = {51},
  number = {2},
  pages = {906--937},
  year = {2014},
  publisher = {SIAM}
}
```

---

**Built with ❤️ for the spectral graph theory and port-Hamiltonian systems community**
