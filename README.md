# 🌐 3D Interactive Graph Eigenvalue Visualizer

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![JavaScript](https://img.shields.io/badge/JavaScript-ES6+-yellow.svg)](https://www.javascript.com/)
[![Three.js](https://img.shields.io/badge/Three.js-r128+-black.svg)](https://threejs.org/)

**A powerful web-based tool for visualizing graph structures, computing eigenvalues, and simulating dynamics on networks.**

🔗 **Live Demo:** [https://draazeid-git.github.io/graph-eigenvalue/](https://draazeid-git.github.io/graph-eigenvalue/)

![Graph Visualization Demo](docs/images/Mobius.jpg)

---

## 📋 Table of Contents

- [Overview](#overview)
- [Key Features](#key-features)
- [Mathematical Background](#mathematical-background)
- [Installation](#installation)
- [Quick Start Guide](#quick-start-guide)
- [User Interface](#user-interface)
- [Graph Templates](#graph-templates)
- [Spectral Analysis](#spectral-analysis)
- [Dynamics Simulation](#dynamics-simulation)
- [Solid Faces Visualization](#solid-faces-visualization)
- [Analytic Graph Library](#analytic-graph-library)
- [Technical Architecture](#technical-architecture)
- [API Reference](#api-reference)
- [Contributing](#contributing)
- [Citation](#citation)
- [License](#license)
- [Author](#author)

---

## Overview

The **3D Interactive Graph Eigenvalue Visualizer** is a comprehensive web application for exploring the relationship between graph topology, matrix spectra, and dynamic behavior. It implements the **Zeid-Rosenberg eigenvalue estimation framework**, which provides closed-form approximations for eigenvalues of structured graphs.

### What Makes This Tool Unique

1. **Real-time 3D Visualization** - Interact with graphs in full 3D space with force-directed layouts
2. **Spectral Analysis** - Compute eigenvalues for adjacency, Laplacian, and skew-symmetric matrices
3. **Dynamics Simulation** - Visualize power flow, vibration modes, and wave propagation
4. **Analytic Eigenvalue Detection** - Automatically identify graphs with closed-form eigenvalue expressions
5. **Solid Face Rendering** - Visualize polyhedra with emissive jewel-tone surfaces

---

## Key Features

### 🎨 Visualization
- **3D Force-Directed Layout** - Automatic graph arrangement with adjustable physics
- **Interactive Controls** - Rotate, zoom, pan; drag vertices to reshape graphs
- **Solid Faces Mode** - Render polyhedra faces with glowing jewel-tone materials
- **Customizable Appearance** - Vertex colors, edge weights, labels, and more

### 📊 Matrix Analysis
- **Multiple Matrix Types:**
  - Adjacency Matrix (symmetric)
  - Laplacian Matrix (L = D - A)
  - Skew-Symmetric Matrix (directed graphs)
- **Eigenvalue Computation** - Numerical eigenvalues with multiplicities
- **Zeid-Rosenberg Estimation** - Analytic approximations for structured graphs
- **Export Options** - JSON, CSV, LaTeX formats

### 🔬 Dynamics Simulation
- **Power Flow Animation** - Visualize energy transfer between nodes
- **Modal Analysis** - Animate individual eigenmodes
- **Damping Control** - Adjustable system damping for realistic dynamics
- **Real-time Updates** - See dynamics change as you modify the graph

### 📚 Graph Library
- **50+ Built-in Templates** - Common graph families ready to explore
- **Analytic Graph Detection** - Automatic identification of special structures
- **Persistent Storage** - Save and organize your discovered graphs
- **Search & Filter** - Find graphs by properties or eigenvalue patterns

---

## Mathematical Background

### The Zeid-Rosenberg Framework

This tool implements a novel approach to eigenvalue estimation based on structural graph properties. For many graph families, eigenvalues can be expressed analytically:

#### Cycle Graph (Cₙ)
```
λₖ = 2·cos(2πk/n),  k = 0, 1, ..., n-1
```

#### Complete Graph (Kₙ)
```
λ₁ = n-1  (multiplicity 1)
λ₂ = -1   (multiplicity n-1)
```

#### Wheel Graph (Wₙ)
```
λ₀ = n-1
λₖ = -1 + 2·cos(2πk/(n-1)),  k = 1, ..., n-2
λₙ₋₁ = -1
```

#### Star Graph (Sₙ)
```
λ₁ = √(n-1)   (multiplicity 1)
λ₂ = 0        (multiplicity n-2)
λ₃ = -√(n-1)  (multiplicity 1)
```

### Skew-Symmetric Matrices

For directed graphs with antisymmetric adjacency (Aᵢⱼ = -Aⱼᵢ), eigenvalues are purely imaginary:

```
λ = ±iω,  where ω ∈ ℝ
```

This property is exploited for stability analysis and oscillatory dynamics simulation.

### Spectral Graph Theory Applications

| Property | Matrix | Interpretation |
|----------|--------|----------------|
| Connectivity | Laplacian | Number of zero eigenvalues = components |
| Bipartiteness | Adjacency | Spectrum symmetric about 0 |
| Expansion | Normalized Laplacian | Spectral gap indicates mixing time |
| Stability | Skew-Symmetric | Purely imaginary eigenvalues |

---

## Installation

### Option 1: Direct Download

1. Download the latest release from [GitHub Releases](https://github.com/draazeid-git/graph-eigenvalue/releases)
2. Extract the ZIP file
3. Open `index.html` in a modern web browser

### Option 2: Clone Repository

```bash
git clone https://github.com/draazeid-git/graph-eigenvalue.git
cd graph-eigenvalue
```

### Option 3: Local Development Server

For full functionality (including file exports), run a local server:

```bash
# Using Python 3
python server.py

# Or using Python's built-in server
python -m http.server 8000

# Or using Node.js
npx serve .
```

Then open `http://localhost:8000` in your browser.

### System Requirements

- **Browser:** Chrome 80+, Firefox 75+, Safari 13+, Edge 80+
- **WebGL:** Required for 3D rendering
- **Screen:** Minimum 1280×720 recommended

---

## Quick Start Guide

### Creating Your First Graph

1. **Open the application** in your web browser
2. **Select a template** from the "Quick Templates" dropdown (e.g., "Wheel Graph")
3. **Set parameters** (number of vertices)
4. **Click "Apply Template"**
5. **Enable "Solid Faces"** in Display Options to see the polyhedron

### Analyzing Eigenvalues

1. **Navigate to the ANALYZE tab**
2. **Select matrix type** (Adjacency, Laplacian, or Skew-Symmetric)
3. **Click "Compute Eigenvalues"**
4. **View results** in the eigenvalue table
5. **Compare with Zeid-Rosenberg estimates** (shown alongside numerical values)

### Running Dynamics Simulation

1. **Navigate to the SIMULATE tab**
2. **Choose simulation type** (Power Flow, Modal, or Custom)
3. **Adjust damping** using the slider
4. **Click "▶ Start"** to begin animation
5. **Observe** power flowing between nodes as colored arrows

---

## User Interface

### Tab Overview

| Tab | Purpose |
|-----|---------|
| **BUILD** | Create and modify graph structure |
| **EDIT** | Fine-tune vertex positions and properties |
| **SIMULATE** | Run dynamics animations |
| **ANALYZE** | Compute eigenvalues and spectral properties |
| **BOUNDS** | Explore eigenvalue bounds and estimates |
| **ADVANCED** | Access advanced features and settings |

### Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `F` | Fit graph to view |
| `Esc` | Deselect all |
| `Delete` | Remove selected vertex |
| `Space` | Toggle simulation |
| `R` | Reset camera |

### Mouse Controls

| Action | Effect |
|--------|--------|
| Left-click + drag | Rotate view |
| Right-click + drag | Pan view |
| Scroll wheel | Zoom in/out |
| Click vertex | Select vertex |
| Drag vertex | Move vertex position |

---

## Graph Templates

### Basic Graphs

| Template | Description | Parameters |
|----------|-------------|------------|
| Complete (Kₙ) | All vertices connected | n: vertices |
| Cycle (Cₙ) | Single cycle | n: vertices |
| Path (Pₙ) | Linear chain | n: vertices |
| Star (Sₙ) | Central hub | n: total vertices |
| Wheel (Wₙ) | Cycle + central hub | n: rim vertices |

### Regular Graphs

| Template | Description | Parameters |
|----------|-------------|------------|
| Petersen | Famous 3-regular graph | (fixed) |
| Hypercube (Qₙ) | n-dimensional cube | n: dimension |
| Möbius-Kantor | 8-vertex 3-regular | (fixed) |
| Pappus | 18-vertex 3-regular | (fixed) |

### Grid Graphs

| Template | Description | Parameters |
|----------|-------------|------------|
| Grid 2D | Rectangular lattice | m×n |
| Grid 3D | Cubic lattice | m×n×p |
| Torus | Grid with wraparound | m×n |
| Cylinder | Grid with one wraparound | m×n |

### Polyhedra

| Template | Description | Vertices |
|----------|-------------|----------|
| Tetrahedron | 4-faced | 4 |
| Octahedron | 8-faced | 6 |
| Cube | 6-faced | 8 |
| Icosahedron | 20-faced | 12 |
| Dodecahedron | 12-faced | 20 |

### Special Families

| Template | Description | Parameters |
|----------|-------------|------------|
| Möbius Ladder | Twisted cylinder | n: vertices (even) |
| Circular Ladder | Prism graph | n: vertices per ring |
| Complete Bipartite | Two-part complete | m, n: partition sizes |
| Turán | Extremal graph | n, r: vertices, parts |

---

## Spectral Analysis

### Matrix Types

#### Adjacency Matrix (A)
- **Definition:** Aᵢⱼ = 1 if edge (i,j) exists, 0 otherwise
- **Properties:** Symmetric, real eigenvalues
- **Use:** Connectivity, walks, graph energy

#### Laplacian Matrix (L)
- **Definition:** L = D - A, where D is degree matrix
- **Properties:** Positive semi-definite, smallest eigenvalue = 0
- **Use:** Graph connectivity, clustering, diffusion

#### Skew-Symmetric Matrix (S)
- **Definition:** Sᵢⱼ = +1 for edge i→j, -1 for j→i
- **Properties:** Antisymmetric, purely imaginary eigenvalues
- **Use:** Directed flow, oscillatory systems

### Eigenvalue Display

The analysis panel shows:
- **Numerical eigenvalues** (computed via QR algorithm)
- **Zeid-Rosenberg estimates** (closed-form approximations)
- **Multiplicities** (repeated eigenvalues grouped)
- **Error metrics** (comparison between numerical and analytic)

### Export Formats

- **JSON:** Full eigenvalue data with metadata
- **CSV:** Tabular format for spreadsheets
- **LaTeX:** Formatted for academic papers

---

## Dynamics Simulation

### Power Flow Mode

Visualizes energy transfer between connected nodes based on the graph's spectral properties.

**Parameters:**
- **Damping (ζ):** 0 = undamped oscillation, 1 = critical damping
- **Frequency:** Base oscillation frequency
- **Initial Conditions:** Starting energy distribution

**Visual Indicators:**
- **Arrow thickness:** Magnitude of power flow
- **Arrow color:** Direction (warm = outflow, cool = inflow)
- **Node glow:** Current energy level

### Modal Analysis

Animate individual eigenmodes to understand how the graph vibrates at specific frequencies.

**Features:**
- Select specific eigenvalue/eigenvector pairs
- Adjust amplitude and phase
- Combine multiple modes

### Stability Analysis

For skew-symmetric systems, eigenvalues indicate stability:
- **Purely imaginary:** Marginally stable (sustained oscillation)
- **Real part < 0:** Asymptotically stable (decaying)
- **Real part > 0:** Unstable (growing)

---

## Solid Faces Visualization

### Enabling Solid Faces

1. Check **"Solid Faces (Polyhedron View)"** in Display Options
2. Adjust **Opacity** slider (10% - 95%)
3. Click **"🔄 Refresh Faces"** if needed after graph changes

### Face Detection Algorithm

The system uses three methods to detect faces:
1. **3D Edge Walking:** Traverses edges using proper 3D angle sorting
2. **Quadrilateral Detection:** Finds all 4-cycles in the graph
3. **Triangle Detection:** Identifies all 3-cycles

### Color Palette ("Jewel Tone")

Faces are rendered with emissive materials that glow against the dark background:

| Color | Hex | Description |
|-------|-----|-------------|
| Electric Cyan | `#00f2ff` | Primary highlight |
| Sunset Orange | `#ff5e00` | Warm energy |
| Emerald Glass | `#00ff88` | Growth/stability |
| Vivid Rose | `#ff007f` | Attention |
| Bright Gold | `#f9d423` | Premium accent |
| Neon Purple | `#7000ff` | Depth/mystery |
| Sky Blue | `#4facfe` | Calm/clarity |

### Material Properties

```javascript
{
    emissive: color,           // Self-illumination
    emissiveIntensity: 0.6,    // Glow strength
    transparent: true,
    opacity: 0.5,              // User-adjustable
    metalness: 0.1,
    roughness: 0.2
}
```

---

## Analytic Graph Library

### What Are "Analytic" Graphs?

Graphs whose eigenvalues can be expressed in closed form (not just computed numerically). These include:
- Highly symmetric graphs (vertex-transitive)
- Graphs with special structure (circulant, Cayley)
- Known families (complete, cycle, star, wheel)

### Automatic Detection

The tool automatically identifies analytic graphs by:
1. Computing numerical eigenvalues
2. Comparing against known formulas
3. Pattern matching for special structures
4. Symmetry analysis

### Library Features

- **Browse:** View all discovered analytic graphs
- **Search:** Filter by vertex count, edge count, or eigenvalue pattern
- **Export:** Save library as JSON for backup
- **Import:** Load previously saved libraries

### Storage

The library uses browser `localStorage` for persistence. To export:
1. Navigate to ADVANCED tab
2. Click "Export Library"
3. Save the JSON file

---

## Technical Architecture

### File Structure

```
graph-eigenvalue/
├── index.html              # Main HTML structure
├── main.js                 # Application entry point
├── graph-core.js           # Core graph operations & rendering
├── spectral-analysis.js    # Eigenvalue computation
├── zeid-rosenberg.js       # Analytic eigenvalue formulas
├── dynamics-animation.js   # Simulation engine
├── matrix-analysis-ui.js   # Analysis panel UI
├── graph-library.js        # Template definitions
├── graph-database.js       # Persistent storage
├── analytic-detection.js   # Pattern recognition
├── graph-finder.js         # Search algorithms
├── styles.css              # UI styling
├── server.py               # Local development server
└── docs/                   # Documentation assets
```

### Dependencies

- **Three.js (r128+):** 3D rendering engine
- **OrbitControls:** Camera interaction
- **No other external dependencies** - pure vanilla JavaScript

### Browser APIs Used

- **WebGL:** 3D graphics
- **localStorage:** Persistent graph library
- **FileReader:** Import/export
- **Clipboard:** Copy eigenvalue data

---

## API Reference

### Graph Core (`graph-core.js`)

```javascript
// Create vertex at position
addVertex(x, y, z)

// Connect two vertices
addEdge(fromIndex, toIndex, weight = 1)

// Apply graph template
applyTemplate(templateName, params)

// Get adjacency matrix
getAdjacencyMatrix() → number[][]

// Toggle solid faces
toggleFaces(visible)

// Detect graph faces
detectFaces() → number[][]
```

### Spectral Analysis (`spectral-analysis.js`)

```javascript
// Compute eigenvalues
computeEigenvalues(matrix) → {values: Complex[], vectors: Complex[][]}

// Get Zeid-Rosenberg estimate
estimateEigenvalues(graphType, params) → number[]

// Compare numerical vs analytic
compareEigenvalues(numerical, analytic) → {error: number, matches: boolean}
```

### Dynamics (`dynamics-animation.js`)

```javascript
// Start simulation
startSimulation(type, params)

// Stop simulation
stopSimulation()

// Set damping ratio
setDamping(zeta)

// Get current state
getState() → {positions: Vector3[], velocities: Vector3[]}
```

---

## Contributing

Contributions are welcome! Please follow these guidelines:

### Reporting Issues

1. Check existing issues first
2. Include browser/OS information
3. Provide steps to reproduce
4. Attach screenshots if applicable

### Pull Requests

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Code Style

- Use ES6+ JavaScript features
- Follow existing naming conventions
- Add comments for complex algorithms
- Update documentation for new features

---

## Citation

If you use this tool in academic work, please cite:

```bibtex
@software{zeid2025grapheigenvalue,
  author = {Zeid, Ashraf},
  title = {3D Interactive Graph Eigenvalue Visualizer},
  year = {2025},
  url = {https://github.com/draazeid-git/graph-eigenvalue},
  note = {Implements the Zeid-Rosenberg eigenvalue estimation framework}
}
```

### Related Publications

- Zeid, A. & Rosenberg, J. (2025). "Analytic Eigenvalue Formulas for Structured Graphs." *[Journal/Conference TBD]*

---

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

```
MIT License

Copyright (c) 2025 Ashraf Zeid

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

---

## Author

**Dr. Ashraf Zeid**

- GitHub: [@draazeid-git](https://github.com/draazeid-git)
- Project Link: [https://github.com/draazeid-git/graph-eigenvalue](https://github.com/draazeid-git/graph-eigenvalue)

---

## Acknowledgments

- **Three.js** team for the excellent 3D rendering library
- **Graph Theory** community for foundational algorithms
- Contributors and testers who helped improve this tool

---

<p align="center">
  <i>Built with ❤️ for the mathematical visualization community</i>
</p>

<p align="center">
  <a href="#-3d-interactive-graph-eigenvalue-visualizer">Back to Top ⬆️</a>
</p>
