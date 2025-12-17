# 3D Graph Eigenvalue Visualization Tool

Interactive 3D visualization tool for graph theory and dynamic systems analysis, implementing the Zeid-Rosenberg eigenvalue estimation framework.

## 🚀 Live Demo

Visit: `https://draazeid-git.github.io/graph-eigenvalue/`

## Version 21 Changes - Analytic Graph Library

### New Features:
- **📚 Persistent Graph Library** - Save and organize analytic graphs across sessions
  - Auto-save to localStorage
  - JSON export/import for sharing collections
  - HTML export for standalone visualization pages
- **Beautiful Library Table** - Sleek, filterable table view in new LIBRARY tab
  - Search by name, family, or notes
  - Filter by vertex count (n) and graph family
  - Sort by date, vertices, edges, or name
  - Multi-select for bulk operations
- **BUILD Tab Integration** - Select library graphs as product factors
  - Choose graphs from library in Product Graph builder
  - Combine saved analytic graphs with known families
- **Finder Integration** - Add search results directly to library
  - Add single graph or all results with one click
  - Automatic duplicate detection

### Library Actions:
- **Load** - Load any saved graph into visualization
- **Export JSON** - Download selected graphs or entire library
- **Export HTML** - Generate shareable standalone HTML page
- **Import** - Load previously exported JSON files
- **Delete** - Remove individual or bulk selected graphs

## Version 20 Changes - Graph Finder Fixes
- Fixed eigenvalue property detection for closed-form analysis
- Fixed adjacency matrix initialization after graph load
- Improved search progress messages

## Features

- **3D Graph Visualization** - Interactive Three.js rendering with rotation, zoom, and vertex dragging
- **Graph Templates** - Path, Cycle, Star, Complete, Grid, Hypercube, Petersen, and 30+ other graph families
- **Eigenvalue Analysis** - Real-time computation of symmetric and skew-symmetric eigenvalues
- **Complex Plane Display** - Visualize system eigenvalues λ = -α ± iβb with adjustable damping (α) and coupling (β)
- **Zeid-Rosenberg Bounds** - Eigenvalue bounds from point graph topology
- **Dynamics Simulation** - Animate ẋ = Ax with multiple integrators (Rodrigues, Cayley, Trapezoidal)
- **Graph Products** - Cartesian (□), Tensor (⊗), and Strong (⊠) products with analytic eigenvalue formulas
- **Copy to Clipboard** - Export matrices, eigenvalues, and characteristic polynomials
- **Graph Library** - Persistent storage with search, filter, and export capabilities

## Running Locally

### Option 1: Python (Recommended)
```bash
cd graph-project-v21
python -m http.server 8000
# Open http://localhost:8000
```

### Option 2: Node.js
```bash
npx serve graph-project-v21
```

### Option 3: Windows
Double-click `START.bat`

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `F` | Fit graph to view |
| `Esc` | Deselect vertex |

## File Structure

```
├── index.html              # Main application
├── styles.css              # Styling
├── main.js                 # Application entry point
├── graph-core.js           # Three.js rendering, vertex/edge management
├── spectral-analysis.js    # Eigenvalue computation
├── analytic-detection.js   # Graph family recognition
├── matrix-analysis-ui.js   # Analysis tab UI
├── dynamics-animation.js   # Dynamics simulation
├── zeid-rosenberg.js       # Eigenvalue bounds
├── graph-finder.js         # Analytic graph search
├── graph-database.js       # Search result caching
└── graph-library.js        # Persistent library management (NEW)
```

## References

- Zeid, A.A. and Rosenberg, R.C. (1985). "Eigenvalue Estimation for Multivariable Linear Dynamic Systems via Bond Graphs." *Journal of the Franklin Institute*, 319(1/2), 255-265.
- Zeid, A.A. and Rosenberg, R.C. (1989). "Stability Criteria for Linear Dynamic Systems Based on Bond Graph Models." *ASME Journal of Dynamic Systems, Measurement, and Control*, 111, 676-680.

## License

MIT License - Feel free to use and modify.
