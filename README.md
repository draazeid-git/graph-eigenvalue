# 🌐 Zeid-Rosenberg Eigenvalue Explorer

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![JavaScript](https://img.shields.io/badge/JavaScript-ES6+-yellow.svg)](https://www.javascript.com/)
[![Three.js](https://img.shields.io/badge/Three.js-r160+-black.svg)](https://threejs.org/)
[![Version](https://img.shields.io/badge/Version-55-green.svg)](https://github.com/draazeid-git/graph-eigenvalue)

**A powerful web-based tool for visualizing graph structures, computing eigenvalues with exact arithmetic, and exploring spectral graph theory through an immersive 3D "Graph Universe" with eigenmode animation.**

🔗 **Live Demo:** [https://draazeid-git.github.io/graph-eigenvalue/](https://draazeid-git.github.io/graph-eigenvalue/)

![Graph Visualization Demo](docs/images/demo-wheel-graph.jpg)

---

## 📋 Table of Contents

- [Overview](#overview)
- [What's New in v55](#whats-new-in-v55)
- [Key Features](#key-features)
- [Graph Universe](#graph-universe)
- [Installation](#installation)
- [Quick Start Guide](#quick-start-guide)
- [File Structure](#file-structure)
- [Dependencies](#dependencies)
- [License](#license)

---

## Overview

The **Zeid-Rosenberg Eigenvalue Explorer** is a comprehensive web application for exploring the relationship between graph topology, matrix spectra, and dynamic behavior. It implements the **Zeid-Rosenberg eigenvalue estimation framework** with exact arithmetic computation via the **Souriau-Frame-Faddeev (SFF)** algorithm.

### What Makes This Tool Unique

| Feature | Description |
|---------|-------------|
| **Graph Universe** | Explore 247+ graphs in 3D space positioned by spectral properties |
| **Dynamic Axis Mapping** | Configure X/Y/Z axes to any spectral metric (α, ρ, n, Energy, etc.) |
| **Exact Polynomial Computation** | BigInt arithmetic via SFF algorithm for precision |
| **Eigenmode Animation** | Click any eigenvalue to visualize its characteristic oscillation pattern |
| **Sparse Matrix Optimization** | SpMV enables dynamics for n > 100 on sparse graphs |
| **Analytic Detection** | 12+ pattern types for closed-form eigenvalue expressions |

---

## What's New in v55

### 🎯 Clean Universe View

- **Removed clutter**: No more galaxy names ("The Nexus", etc.), starfield dots, or wireframe bubbles
- **Clean expanded graphs**: Node-edge display without wireframe bounding spheres
- **Lighter text**: Regular weight fonts with subtle glow (not bold)

### 📐 Dynamic Axis Mapping

The Graph Universe now supports fully configurable axes:

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

**Log Scale Option**: Toggle to spread clustered data points.

### 🔍 Improved Navigation

- **Extended zoom range**: minDistance=1, maxDistance=5000
- **Adaptive labels**: Shows only nearest 25 labels, fewer when zoomed in close
- **Selection over labels**: When extremely close, click to select graphs instead of reading labels

### 🧹 Streamlined Codebase

Removed unused files and test utilities for a cleaner distribution.

---

## Key Features

### 🔨 BUILD Tab - Graph Construction

- **61+ Built-in Templates** - Path, Cycle, Star, Complete, Wheel, Hypercube, Petersen, and more
- **Configurable Parameters** - Set vertices (n), dimensions, and family-specific options
- **Layout Options** - Circle, Sphere, Concentric arrangements
- **Force-Directed Layout** - Auto-arrange with physics simulation
- **Universe Integration** - Send graphs to 3D Galaxy view

### ✏️ EDIT Tab - Manual Graph Editing

- **Tool Palette** - Select, Add Vertex, Add Edge, Delete modes
- **Drag Mode** - Reposition vertices interactively
- **Edge Management** - Click to add/remove connections

### 🧪 SIMULATE Tab - Dynamics & Animation

- **Three Integrators**: Rodrigues (exact), Cayley (symplectic), Trapezoidal
- **SpMV Optimization** - O(m) instead of O(n²) for sparse graphs
- **Phase Diagrams** - xᵢ vs xⱼ, velocity, power plots

### 📊 ANALYZE Tab - Spectral Analysis

- **Graph Detection** - Automatic family identification
- **SFF Polynomial** - Exact integer coefficients via BigInt
- **Clickable Eigenvalues** - Trigger eigenmode animation
- **Closed-Form Display** - Formulas like λₖ = 2cos(2kπ/n)

### 🌌 UNIVERSE Tab - 3D Exploration

- **247+ Graphs** - From 30+ families
- **Configurable Axes** - Map any metric to X/Y/Z
- **Log Scale** - Spread clustered data
- **Adaptive Labels** - Distance-based visibility
- **Fly-to Navigation** - Jump to specific families

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
| **Double-click** | Set rotation pivot |

### Galaxy Axes Panel

The control panel allows you to:
1. Select axis metrics (X, Y, Z dropdowns)
2. Choose from presets
3. Toggle Log Scale for clustered data
4. Toggle Adaptive Labels
5. Export/Verify positions

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

1. **Open** `index.html` in your browser
2. **BUILD Tab**: Select a graph template (e.g., "Wheel W_8")
3. **Click "Create"** to generate the graph
4. **ANALYZE Tab**: View eigenvalues and click one to animate
5. **UNIVERSE Tab**: Click "Add to Universe" to explore in 3D
6. **Configure Axes**: Use dropdowns to change positioning metrics

---

## File Structure

```
graph-project/
├── index.html              # Main application (71KB)
├── styles.css              # Styling (60KB)
├── main.js                 # Application orchestrator (376KB)
│
├── graph-core.js           # Three.js scene, rendering (81KB)
├── graph-universe.js       # 3D universe visualization (214KB)
├── spectral-analysis.js    # SpectralEngine, SFF algorithm (123KB)
├── dynamics-animation.js   # SparseMatrix, integrators (59KB)
│
├── analytic-detection.js   # Graph family identification (93KB)
├── matrix-analysis-ui.js   # Eigenvalue display UI (46KB)
├── zeid-rosenberg.js       # Eigenvalue formulas (29KB)
├── chebyshev-factorizer.js # Chebyshev polynomial analysis (25KB)
│
├── graph-library.js        # localStorage persistence (30KB)
├── graph-database.js       # In-memory caching (26KB)
├── graph-finder.js         # Graph search utilities (36KB)
│
├── server.py               # Local development server
├── find_analytic_graphs.py # Python utility for finding analytic graphs
├── verify_universe_positions.py # Position verification script
│
├── START.bat               # Windows launcher
├── FIND_GRAPHS.bat         # Windows batch for Python script
│
├── DEPENDENCIES.md         # External library documentation
├── LICENSE                 # MIT License
└── docs/
    └── images/
        └── demo-wheel-graph.gif
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

### v55 (Current) - Clean Universe & Dynamic Axes

- ✨ **Dynamic Axis Mapping** - Configure X/Y/Z to any spectral metric
- 🧹 **Decluttered View** - Removed galaxy names, starfield, wireframe bubbles
- 📝 **Lighter Text** - Regular weight fonts, subtle glow
- 🔍 **Extended Zoom** - minDistance=1 for extreme close-ups
- 📊 **Log Scale Option** - Spread clustered data points
- 🏷️ **Smart Labels** - Adaptive visibility based on zoom level

### v53-54 - Pure Absolute Positioning

- Eliminated galaxy-based positioning in favor of pure metric-based coordinates
- Removed 376 lines of complex positioning code
- Added verification tools for position consistency

### v35 - Major Performance Update

- 7-Tab Interface (BUILD, EDIT, SIMULATE, ANALYZE, BOUNDS, ADVANCED, LIBRARY)
- SpMV Optimization (76-100x speedup for sparse graphs)
- Eigenmode Animation
- Enhanced SFF Engine with BigInt

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
  url = {https://github.com/draazeid-git/graph-eigenvalue}
}
```

---

**Built with ❤️ for the spectral graph theory community**
