# 3D Graph Eigenvalue Visualization Tool

Interactive 3D visualization tool for graph theory and dynamic systems analysis, implementing the Zeid-Rosenberg eigenvalue estimation framework.

## 🚀 Live Demo

Visit: `https://YOUR_USERNAME.github.io/graph-eigenvalue-viz/`

## Features

- **3D Graph Visualization** - Interactive Three.js rendering with rotation, zoom, and vertex dragging
- **Graph Templates** - Path, Cycle, Star, Complete, Grid, Hypercube, Petersen, and 30+ other graph families
- **Eigenvalue Analysis** - Real-time computation of symmetric and skew-symmetric eigenvalues
- **Complex Plane Display** - Visualize system eigenvalues λ = -α ± iβb with adjustable damping (α) and coupling (β)
- **Zeid-Rosenberg Bounds** - Eigenvalue bounds from point graph topology
- **Dynamics Simulation** - Animate ẋ = Ax with multiple integrators (Rodrigues, Cayley, Trapezoidal)
- **Graph Products** - Cartesian (□), Tensor (⊗), and Strong (⊠) products with analytic eigenvalue formulas
- **Copy to Clipboard** - Export matrices, eigenvalues, and characteristic polynomials

## Running Locally

### Option 1: Python (Recommended)
```bash
cd graph-project-v18
python -m http.server 8000
# Open http://localhost:8000
```

### Option 2: Node.js
```bash
npx serve graph-project-v18
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
└── graph-finder.js         # Analytic graph search
```

## References

- Zeid, A.A. and Rosenberg, R.C. (1985). "Eigenvalue Estimation for Multivariable Linear Dynamic Systems via Bond Graphs." *Journal of the Franklin Institute*, 319(1/2), 255-265.
- Zeid, A.A. and Rosenberg, R.C. (1989). "Stability Criteria for Linear Dynamic Systems Based on Bond Graph Models." *ASME Journal of Dynamic Systems, Measurement, and Control*, 111, 676-680.

## License

MIT License - Feel free to use and modify.
