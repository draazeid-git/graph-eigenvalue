# Graph Universe

## Overview

The **Graph Universe** is a 3D visualization space where graphs are positioned according to their spectral properties. This enables visual exploration of how different graph families cluster and relate spectrally.

## Concept

### Spectral Coordinates

Each graph is assigned a 3D position based on configurable spectral metrics:

```
Position(G) = (metric_X(G), metric_Y(G), metric_Z(G))
```

### Visual Clustering

Graphs with similar spectral properties appear near each other, revealing:
- Family relationships
- Spectral outliers
- Structural patterns

## Available Metrics

### Vertex/Edge Counts

| Metric | Formula | Description |
|--------|---------|-------------|
| Vertices (n) | \|V\| | Number of nodes |
| Edges (m) | \|E\| | Number of connections |
| Density | 2m / n(n-1) | Edge density |

### Spectral Properties

| Metric | Formula | Description |
|--------|---------|-------------|
| Spectral Radius (ρ) | max\|λᵢ\| | Largest eigenvalue magnitude |
| Energy (E) | Σ\|λᵢ\| | Sum of absolute eigenvalues |
| Spectral Gap | λ₁ - λ₂ | Difference between two largest |
| λ_max/λ_min | λ₁/λₙ | Eigenvalue ratio |
| ρ/n Ratio | ρ/n | Normalized spectral radius |

### Growth Metrics

| Metric | Formula | Description |
|--------|---------|-------------|
| Scaling Exponent (α) | log(ρ)/log(n) | How ρ grows with n |
| Regularity | 1 - σ(degrees)/mean | Degree uniformity |

## Axis Configuration

### Default Axes

- **X-axis**: Vertices (n) — size
- **Y-axis**: Spectral Radius (ρ) — spectral scale  
- **Z-axis**: Energy — total spectral content

### Recommended Configurations

| Configuration | X | Y | Z | Reveals |
|---------------|---|---|---|---------|
| Size vs Spectrum | Vertices | Spectral Radius | Energy | Growth patterns |
| Spectral Shape | Energy | Spectral Gap | ρ/n | Spectral distribution |
| Density Effects | Edges | Spectral Radius | Density | Connectivity impact |

## Navigation Controls

### Mouse Controls

| Action | Effect |
|--------|--------|
| Drag | Rotate view |
| Scroll | Zoom in/out |
| Click graph | Select (highlight) |
| Double-click | Load into editor |

### Keyboard Controls

| Key | Action |
|-----|--------|
| W/A/S/D | Pan camera |
| F | Fit all graphs in view |
| E | Expand all graph icons |
| C | Collapse all graph icons |
| H | Toggle highlight mode |

## Graph Representation

### Visual Elements

Each graph in the Universe is shown as:
- **Sphere**: Base representation
- **Mini-graph**: Expanded view showing structure
- **Label**: Graph name and family
- **Color**: Indicates graph family

### Size Encoding

Sphere size can represent:
- Vertex count
- Edge count
- Custom metric

### Color Coding

Colors distinguish graph families:
- **Blue**: Paths, Trees
- **Green**: Cycles, Circulants
- **Red**: Complete graphs
- **Purple**: Bipartite graphs
- **Orange**: Special graphs (Petersen, etc.)

## Populating the Universe

### Built-in Graphs

The Universe contains 247+ pre-computed graphs from 30+ families:
- Path Pₙ (n = 2..20)
- Cycle Cₙ (n = 3..20)
- Complete Kₙ (n = 2..15)
- Wheel Wₙ (n = 4..15)
- Hypercube Qₙ (n = 1..6)
- And many more...

### Adding Custom Graphs

1. Build or load a graph in the main editor
2. Click "Send to Universe" in LIBRARY tab
3. Graph appears at computed spectral position

### Generating Test Graphs

Use BUILD → "Generate Test Graphs" to populate Universe with:
- All templates at various sizes
- Product graphs
- Random graphs

## Spectral Clustering Patterns

### Family Clustering

Graphs from the same family often form curves or clusters:

```
Paths:     Linear curve (ρ ≈ 2 for all n)
Cycles:    Parallel to paths (ρ = 2 exactly)
Complete:  Steep curve (ρ = n-1)
Stars:     Moderate curve (ρ = √(n-1))
```

### Asymptotic Behavior

| Family | ρ as n→∞ | Scaling α |
|--------|----------|-----------|
| Path | → 2 | 0 |
| Cycle | = 2 | 0 |
| Complete | = n-1 | 1 |
| Star | = √(n-1) | 0.5 |
| Hypercube | = n | 1 |

### Interesting Observations

1. **Bounded spectral radius**: Paths, cycles, and trees have ρ ≤ 2
2. **Linear growth**: Complete and complete bipartite grow linearly
3. **Square root growth**: Stars and similar structures
4. **Regular graphs**: Form smooth curves

## Implementation Details

### Position Calculation

```javascript
function computePosition(graph, xMetric, yMetric, zMetric) {
    const spectrum = computeEigenvalues(graph);
    
    return {
        x: evaluateMetric(graph, spectrum, xMetric),
        y: evaluateMetric(graph, spectrum, yMetric),
        z: evaluateMetric(graph, spectrum, zMetric)
    };
}
```

### Log Scale Option

For metrics spanning large ranges, log scale spreads clustered points:

```javascript
if (useLogScale) {
    position.x = Math.log10(position.x + 1);
    position.y = Math.log10(position.y + 1);
}
```

### Performance

- Positions computed once and cached
- Only visible graphs rendered
- Level-of-detail for distant graphs

## Use Cases

### Educational

- Visualize how graph families relate spectrally
- Demonstrate asymptotic behavior
- Compare product graph spectra

### Research

- Identify spectral outliers
- Find graphs with specific properties
- Explore spectral-structural relationships

### Design

- Select graphs meeting spectral criteria
- Compare candidate structures
- Understand design trade-offs

## References

- Brouwer, A. E., & Haemers, W. H. (2012). *Spectra of Graphs*. Springer.
- Godsil, C., & Royle, G. (2001). *Algebraic Graph Theory*. Springer.
