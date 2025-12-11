# Graph Visualization Project - File Dependencies (v17)

## Overview

This project uses ES6 modules with a clear dependency hierarchy. All JavaScript files use `import`/`export` syntax and require a web server to run (due to CORS restrictions on ES modules).

## v17 New Features

- **Eigenvalue Plot with α/β Sliders**: Interactive visualization in the Simulate tab showing how eigenvalues move in the complex plane as physical parameters (α = damping, β = coupling) change
- **Mode Explanations**: Detailed descriptions for Phase Diagram modes and Animation modes
- **Enhanced Phase Plane**: Real-time eigenvalue tracking with stability indicators
- **8 nodes default**: Initial graph starts with 8 vertices

---

## Dependency Diagram

```
                    ┌─────────────────┐
                    │   index.html    │
                    │  (entry point)  │
                    └────────┬────────┘
                             │
                             │ <script type="module" src="main.js">
                             ▼
                    ┌─────────────────┐
                    │    main.js      │
                    │ (orchestrator)  │
                    └────────┬────────┘
                             │
           ┌─────────────────┼─────────────────┐
           │                 │                 │
           ▼                 ▼                 ▼
┌──────────────────┐ ┌──────────────────┐ ┌──────────────────┐
│ graph-core.js    │ │dynamics-animation│ │matrix-analysis-ui│
│ (foundation)     │ │     .js          │ │      .js         │
└────────┬─────────┘ └────────┬─────────┘ └────────┬─────────┘
         │                    │                    │
         │              ┌─────┴─────┐        ┌─────┴─────┐
         │              │           │        │           │
         │              ▼           │        ▼           │
         │     ┌─────────────┐      │ ┌─────────────┐    │
         │     │graph-core.js│      │ │graph-core.js│    │
         │     └─────────────┘      │ └─────────────┘    │
         │                          │        │           │
         │                          │        ▼           │
         │                          │ ┌─────────────────┐│
         │                          │ │spectral-analysis││
         │                          │ │      .js        ││
         │                          │ └────────┬────────┘│
         │                          │          │         │
         │                          │          ▼         │
         │                          │   ┌─────────────┐  │
         │                          │   │graph-core.js│  │
         │                          │   └─────────────┘  │
         │                          │                    │
         ▼                          ▼                    ▼
    ┌─────────────────────────────────────────────────────────┐
    │                    External: THREE.js                    │
    │         (imported from 'three' via import map)           │
    └─────────────────────────────────────────────────────────┘
```

---

## File Details

### 1. index.html
**Type:** Entry Point  
**Dependencies:** None (loads everything else)  
**Loads:**
- `styles.css` - External stylesheet
- `main.js` - JavaScript entry point (via ES module)
- THREE.js - Via import map from CDN

**Contains:**
- HTML structure (controls panel, canvas container, modal)
- Import map for THREE.js CDN resolution
- All DOM elements referenced by JavaScript

---

### 2. styles.css
**Type:** Stylesheet  
**Dependencies:** None  
**Dependents:** `index.html`

**Contains:**
- All CSS styling for the application
- Modal styles, control panel layout, matrix table formatting
- Color schemes for graph visualization

---

### 3. main.js
**Type:** Orchestrator / Entry Point  
**Dependencies:**
```javascript
import { state, initScene, animate, controls, createVertex, clearGraph, 
         addEdge, clearAllEdges, generateRandomEdges, updateAllEdges, 
         updateVertexLabels, setVertexMaterial, getCirclePositions, 
         getSpherePositions, getConcentricCirclePositions2, 
         getConcentricCirclePositions3, getConcentricSpherePositions2,
         startForceLayout, stopForceLayout, getIntersectedVertex, 
         getIntersectedEdge, VERTEX_RADIUS } from './graph-core.js';

import { initDynamics, startDynamics, stopDynamics, resetDynamics,
         invalidateCaches, isDynamicsRunning, updatePhaseNodeSelectors, 
         clearPhaseTrail, updatePhaseLabels, togglePhaseDiagram,
         resetDynamicsVisuals } from './dynamics-animation.js';

import { initMatrixAnalysis, updateStats, showAnalysis, showModal, 
         hideModal, initModalPosition } from './matrix-analysis-ui.js';
```

**Exports:** None (entry point)

**Responsibilities:**
- DOM element acquisition
- Event listener setup
- Graph template generation (20 templates)
- Edit mode handling (add/delete edges)
- Tab switching in modal
- Initialization orchestration

---

### 4. graph-core.js
**Type:** Foundation Module  
**Dependencies:**
```javascript
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
```

**Exports:**
```javascript
export const state = { vertexMeshes, vertexLabels, edgeObjects, 
                       adjacencyMatrix, symmetricAdjMatrix, graphGroup, 
                       selectedVertex, hoveredVertex, ... };
export let scene, camera, renderer, controls, raycaster, mouse;
export const VERTEX_RADIUS;
export function initScene(container);
export function animate();
export function createVertex(position, index);
export function clearGraph();
export function addEdge(fromIdx, toIdx);
export function clearAllEdges();
export function generateRandomEdges(count);
export function updateAllEdges();
export function updateVertexLabels();
export function setVertexMaterial(vertex, type);
export function getCirclePositions(n, radius);
export function getSpherePositions(n, radius);
export function getConcentricCirclePositions2(...);
export function getConcentricCirclePositions3(...);
export function getConcentricSpherePositions2(...);
export function startForceLayout(speedInput, checkbox3D, callback);
export function stopForceLayout();
export function getIntersectedVertex(event);
export function getIntersectedEdge(event);
export function interpolateYellowBlue(value, brightness);
```

**Responsibilities:**
- THREE.js scene setup and rendering
- Vertex and edge creation/management
- Layout algorithms (circle, sphere, concentric)
- Force-directed layout simulation
- Raycasting for mouse interaction
- Shared state object for all modules

---

### 5. spectral-analysis.js
**Type:** Computation Module  
**Dependencies:**
```javascript
import { state } from './graph-core.js';
```

**Exports:**
```javascript
export function subscript(num);
export function superscript(num);
export function isConnected();
export function checkPath();
export function checkCycle();
export function checkBipartite();
export function detectGraphType();
export function computeCharacteristicPolynomial(matrix);
export function formatPolynomial(coeffs);
export function computeEigenvaluesNumerical(matrix);
export function computeSkewSymmetricEigenvalues(matrix);
export function detectTrigValue(value, polyCoeffs);
export function detectTrigEigenvalues(eigenvalues, polyCoeffs);
export function formatTrigForm(trig);
export function computeGraphProperties();
```

**Responsibilities:**
- Graph type detection (cycle, path, complete, bipartite, etc.)
- Eigenvalue computation (numerical)
- Characteristic polynomial calculation
- Graph property analysis (connected, bipartite, regular)
- Analytic eigenvalue formulas for known graph types

---

### 6. dynamics-animation.js
**Type:** Simulation Module  
**Dependencies:**
```javascript
import * as THREE from 'three';
import { state, VERTEX_RADIUS, interpolateYellowBlue } from './graph-core.js';
```

**Exports:**
```javascript
export function initDynamics(elements);
export function startDynamics();
export function stopDynamics();
export function resetDynamics();
export function invalidateCaches();
export function isDynamicsRunning();
export function updatePhaseNodeSelectors();
export function clearPhaseTrail();
export function updatePhaseLabels();
export function togglePhaseDiagram();
export function resetDynamicsVisuals();
export function getNodeStates();
export function getNodeDerivatives();
```

**Responsibilities:**
- Dynamics simulation (ẋ = Ax for skew-symmetric A)
- Three integrators: Rodrigues, Cayley, Trapezoidal
- Vertex color animation (displacement & power modes)
- Arrow animation with direction/magnitude
- Phase diagram plotting (5 modes)
- Energy bookkeeping

---

### 7. matrix-analysis-ui.js
**Type:** UI Module  
**Dependencies:**
```javascript
import { state } from './graph-core.js';
import { detectGraphType, computeGraphProperties, isConnected,
         computeCharacteristicPolynomial, formatPolynomial,
         computeEigenvaluesNumerical, computeSkewSymmetricEigenvalues,
         detectTrigEigenvalues, formatTrigForm, subscript 
       } from './spectral-analysis.js';
```

**Exports:**
```javascript
export function initMatrixAnalysis(elements);
export function updateStats();
export function showAnalysis();
export function showModal();
export function hideModal();
export function initModalPosition();
```

**Responsibilities:**
- Statistics display (vertices, edges, graph type)
- Modal window management (show/hide/drag)
- Adjacency matrix table rendering
- Eigenvalue display (numerical and analytic)
- Graph properties display

---

### 8. graph-finder.js
**Type:** Computation/Discovery Module  
**Dependencies:**
```javascript
import { state, clearGraph, createVertex, addEdge, getCirclePositions } from './graph-core.js';
import { computeEigenvaluesNumerical, computeSkewSymmetricEigenvalues } from './spectral-analysis.js';
```

**Exports:**
```javascript
export function findAnalyticGraphs(n, progressCallback);
export function loadGraphFromResult(result);
export { buildSkewSymmetricMatrix, buildSymmetricMatrix, identifyGraphFamily };
```

**Responsibilities:**
- Enumerate all non-isomorphic graphs for n vertices
- Compute characteristic polynomials
- Detect closed-form eigenvalue patterns (integers, √k, cos/sin of π fractions)
- Identify known graph families (cycle, path, star, complete, etc.)
- Load discovered graphs into the visualization

---

### 9. START.bat
**Type:** Utility Script  
**Dependencies:** Python 3 (for `http.server` module)

**Responsibilities:**
- Launch local HTTP server on port 8000
- Open Chrome browser to localhost:8000

---

## Dependency Summary Table

| File | Depends On | Depended By |
|------|------------|-------------|
| `index.html` | `styles.css`, `main.js`, THREE.js CDN | — |
| `styles.css` | — | `index.html` |
| `main.js` | `graph-core.js`, `dynamics-animation.js`, `matrix-analysis-ui.js` | `index.html` |
| `graph-core.js` | THREE.js | `main.js`, `dynamics-animation.js`, `spectral-analysis.js`, `matrix-analysis-ui.js` |
| `spectral-analysis.js` | `graph-core.js` | `matrix-analysis-ui.js` |
| `dynamics-animation.js` | THREE.js, `graph-core.js` | `main.js` |
| `matrix-analysis-ui.js` | `graph-core.js`, `spectral-analysis.js` | `main.js` |
| `graph-finder.js` | `graph-core.js`, `spectral-analysis.js` | `main.js` |

---

## Load Order

When the browser loads `index.html`:

1. **HTML parsed** → DOM structure created
2. **`styles.css`** loaded → styling applied
3. **Import map** processed → THREE.js URLs resolved
4. **`main.js`** loaded as ES module → triggers dependency resolution:
   - `graph-core.js` loaded (depends on THREE.js)
   - `dynamics-animation.js` loaded (depends on THREE.js, graph-core.js)
   - `matrix-analysis-ui.js` loaded (depends on graph-core.js, spectral-analysis.js)
     - `spectral-analysis.js` loaded (depends on graph-core.js)
5. **`init()`** called when DOM ready → application starts

---

## External Dependencies

### THREE.js (r128+)
- Loaded via CDN import map in `index.html`
- Used by: `graph-core.js`, `dynamics-animation.js`
- Provides: 3D rendering, scene management, geometry, materials

### OrbitControls
- THREE.js addon for camera controls
- Used by: `graph-core.js`
- Provides: Mouse-based camera rotation/zoom/pan

### Python 3
- Required for `START.bat` (runs `python -m http.server`)
- Required for `find_analytic_graphs.py` (requires sympy, numpy)
- Provides: Local web server for ES module loading
- Provides: Symbolic computation for eigenvalue analysis

---

## Python Tool: find_analytic_graphs.py

### Purpose
Finds all non-isomorphic skew-symmetric graphs (up to n vertices) that have closed-form eigenvalue formulas.

### Dependencies
```bash
pip install sympy numpy networkx
```

### Usage
```bash
# Interactive mode
python find_analytic_graphs.py

# Command line mode
python find_analytic_graphs.py 5

# Or use the batch file
FIND_GRAPHS.bat 5
```

### Output
- Console display of all graphs with analytic eigenvalues
- JSON file: `analytic_graphs_n{n}.json`

### Integration with Visualization
The JSON output can be loaded into the JavaScript visualization to explore discovered graphs.
