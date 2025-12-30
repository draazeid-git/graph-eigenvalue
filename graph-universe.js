/**
 * Graph Universe Module (v35)
 * ======================
 * 3D fly-through visualization of the graph library organized as galaxies.
 * 
 * Features:
 * - First-person navigation through graph space
 * - Galaxies organized by graph family
 * - Interactive node selection and loading
 * - Animated flow particles showing graph structure
 * - HUD with navigation info
 * - **Spectral-based positioning using eigenvalue metrics**
 * - **Toggle between artistic patterns and spectral layout**
 * - **v35: Axes with actual spectral values on tick marks**
 * - **v35: Reference grid planes at key spectral values**
 * - **v35: verifySpectralPositioning() console function**
 * 
 * Integration: Used as an alternative view in the Library tab
 */

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { computeSkewSymmetricEigenvalues, computeEigenvaluesNumerical } from './spectral-analysis.js';

// =====================================================
// CONFIGURATION
// =====================================================

const CONFIG = {
    // Universe scale - CLOSER together like the example
    galaxySpacing: 200,          // Distance between galaxy centers (was 400)
    galaxyRadius: 150,           // Radius of each galaxy cluster (increased for more spread)
    nodeBaseSize: 10,            // Base size for graph nodes (increased from 8)
    nodeSizeScale: 1.2,          // Size multiplier based on vertex count (increased from 1.0)
    
    // Movement - FASTER like the example (speed 400)
    moveSpeed: 400,              // Movement acceleration (was 300)
    friction: 5.0,               // Velocity damping
    
    // Visual
    fogDensity: 0.0008,          // Fog density (reduced for better visibility)
    backgroundColor: 0x020205,   // Deep dark blue-black
    starCount: 0,                // No background stars - cleaner view
    
    // Flow particles
    flowSpeed: 0.02,
    flowParticleSize: 1.5,
    
    // Performance
    maxVisibleNodes: 500,        // LOD culling threshold
    lodDistance: 500,            // Distance for detail rendering (increased)
    
    // Interaction
    hoverHighlightColor: 0xffffff,
    selectedColor: 0x00ff00,
    
    // Spectral positioning configuration (for nodes within galaxies)
    spectralScales: {
        x: 40,                   // Scale for log(n) axis (vertex count)
        y: 80,                   // Scale for density axis
        z: 25                    // Scale for spectral radius axis
    },
    spectralSpread: 400,          // Base spread for spectral positioning within galaxy (INCREASED for zoom visibility)
    
    // Analytic distinction visualization mode
    analyticHighlightMode: false,  // Toggle: highlights analytic vs custom graphs
    analyticColors: {
        analytic: 0x00ffff,        // Cyan for library/analytic graphs
        custom: 0xff6600,          // Orange for custom/built graphs  
        analyticGlow: 0x00aaaa,    // Glow color for analytic
        customGlow: 0xcc4400,      // Glow color for custom
        manifoldColor: 0x004444,   // Color for the analytic manifold surface
        manifoldOpacity: 0.15      // Opacity of manifold visualization
    },
    showAnalyticManifold: false,    // Toggle: show the analytic submanifold boundary
    
    // NEW: Galaxy axis configuration
    galaxyAxes: {
        x: 'alpha',              // Current X axis metric
        y: 'avgN',               // Current Y axis metric (changed from rationality for sequential ordering)
        z: 'avgSpectralRadius'   // Current Z axis metric
    },
    
    // Galaxy spread scales (world units per normalized metric unit)
    galaxyScale: {
        x: 800,   // Spread for X axis
        y: 600,   // Spread for Y axis
        z: 500    // Spread for Z axis
    },
    
    // Log scale option for better distribution of clustered data
    useLogScale: false,
    
    // Adaptive labels - only show labels for nearby graphs
    adaptiveLabels: true,
    maxVisibleLabels: 25,    // Max number of labels to show at once
    labelFadeDistance: 300   // Distance at which labels start fading
};

// Available metrics for galaxy positioning
const GALAXY_AXIS_OPTIONS = {
    'alpha': {
        name: 'Scaling Exp (α)',
        description: 'How ρ grows with n: 0=bounded, 0.5=√n, 1=linear',
        range: [0, 1],
        color: 0xff4444
    },
    'rationality': {
        name: 'Rationality',
        description: 'Fraction of eigenvalues that are integers/rationals',
        range: [0, 1],
        color: 0x44ff44
    },
    'avgSpectralRadius': {
        name: 'Spectral Radius (ρ)',
        description: 'Max |eigenvalue| - measures graph connectivity',
        range: [0, 'auto'],
        color: 0x4444ff
    },
    'spectralGap': {
        name: 'Spectral Gap',
        description: 'λ₁ - λ₂ (difference between two largest eigenvalues)',
        range: [0, 'auto'],
        color: 0xff44ff
    },
    'energy': {
        name: 'Energy',
        description: 'Sum of |λᵢ| (total spectral weight)',
        range: [0, 'auto'],
        color: 0xffff44
    },
    'regularity': {
        name: 'Regularity',
        description: 'How uniform the degree distribution is (1=regular)',
        range: [0, 1],
        color: 0x44ffff
    },
    'sparsity': {
        name: 'Sparsity',
        description: 'Edge density: edges / max_possible_edges',
        range: [0, 1],
        color: 0xff8844
    },
    'avgN': {
        name: 'Avg Vertices',
        description: 'Average number of vertices in family',
        range: [0, 'auto'],
        color: 0x88ff44
    },
    'graphCount': {
        name: 'Graph Count',
        description: 'Number of graphs in this family',
        range: [0, 'auto'],
        color: 0x8844ff
    },
    'spectralSpread': {
        name: 'Spectral Spread',
        description: 'λ_max - λ_min (total eigenvalue range)',
        range: [0, 'auto'],
        color: 0xff6688
    },
    'spectralRadiusRatio': {
        name: 'ρ/n Ratio',
        description: 'Spectral radius normalized by vertex count',
        range: [0, 1],
        color: 0x66ff88
    },
    'avgEdges': {
        name: 'Avg Edges',
        description: 'Average number of edges in family',
        range: [0, 'auto'],
        color: 0x88ffff
    },
    'coefficient': {
        name: 'Scaling Coef (c)',
        description: 'Coefficient in ρ ≈ c·n^α',
        range: [0, 'auto'],
        color: 0xffaa66
    },
    'eigenvalueRatio': {
        name: 'λ_max/λ_min',
        description: 'Ratio of largest to smallest non-zero eigenvalue',
        range: [1, 'auto'],
        color: 0x66aaff
    }
};

// Preset axis combinations for exploration
const AXIS_PRESETS = {
    'default': {
        name: 'Default (α, Size, ρ)',
        x: 'alpha',
        y: 'avgN',
        z: 'avgSpectralRadius'
    },
    'rationality-view': {
        name: 'Rationality View (α, Rat, ρ)',
        x: 'alpha',
        y: 'rationality',
        z: 'avgSpectralRadius'
    },
    'sequential': {
        name: 'Sequential (ρ, Size, α)',
        x: 'avgSpectralRadius',
        y: 'avgN', 
        z: 'alpha'
    },
    'size-structure': {
        name: 'Size vs Structure',
        x: 'avgN',
        y: 'sparsity',
        z: 'regularity'
    },
    'spectral-properties': {
        name: 'Spectral Properties',
        x: 'spectralGap',
        y: 'energy',
        z: 'spectralSpread'
    },
    'growth-analysis': {
        name: 'Growth Analysis',
        x: 'alpha',
        y: 'coefficient',
        z: 'spectralRadiusRatio'
    },
    'library-stats': {
        name: 'Library Statistics',
        x: 'graphCount',
        y: 'avgN',
        z: 'avgEdges'
    },
    'eigenvalue-focus': {
        name: 'Eigenvalue Focus',
        x: 'rationality',
        y: 'spectralGap',
        z: 'energy'
    }
};

/**
 * Get a metric value from a graph's computed metrics
 * Maps axis keys to actual metric values for positioning
 * @param {Object} metrics - Computed metrics object from calculateGraphMetrics
 * @param {string} axisKey - The metric key (e.g., 'alpha', 'avgSpectralRadius')
 * @returns {number} The metric value
 */
function getMetricValue(metrics, axisKey) {
    const mapping = {
        // Core spectral metrics
        'alpha': metrics.alpha ?? 0.5,
        'rationality': metrics.rationality ?? 0.5,
        'avgSpectralRadius': metrics.spectralRadius ?? metrics.avgSpectralRadius ?? 2,
        'spectralGap': metrics.spectralGap ?? 0.5,
        'energy': metrics.energy ?? 5,
        'eigenvalueRatio': metrics.eigenvalueRatio ?? 1,
        
        // Graph structure metrics
        'regularity': metrics.regularity ?? 0.5,
        'sparsity': 1 - (metrics.density ?? 0.5),
        'avgN': metrics.n ?? 5,
        'graphCount': 1,  // Individual graphs always count as 1
        'avgEdges': metrics.edgeCount ?? 5,
        
        // Derived metrics
        'spectralSpread': (metrics.spectralRadius ?? 2) * 2,
        'spectralRadiusRatio': metrics.n > 0 ? (metrics.spectralRadius ?? 2) / metrics.n : 0.3,
        'coefficient': 1
    };
    
    const value = mapping[axisKey];
    if (value === undefined) {
        console.warn(`Unknown metric key: ${axisKey}, using 0.5`);
        return 0.5;
    }
    return value;
}

/**
 * Compute the position for a graph based on configured axes
 * Uses CONFIG.galaxyAxes to determine which metrics map to X, Y, Z
 * @param {Object} metrics - Computed metrics object
 * @returns {THREE.Vector3} World position
 */
function computeGraphPosition(metrics) {
    const axes = CONFIG.galaxyAxes;
    const scales = CONFIG.galaxyScale;
    const useLog = CONFIG.useLogScale;
    
    // Get raw metric values
    let xVal = getMetricValue(metrics, axes.x);
    let yVal = getMetricValue(metrics, axes.y);
    let zVal = getMetricValue(metrics, axes.z);
    
    // Get normalization ranges from axis options
    const xOpt = GALAXY_AXIS_OPTIONS[axes.x] || { range: [0, 10] };
    const yOpt = GALAXY_AXIS_OPTIONS[axes.y] || { range: [0, 10] };
    const zOpt = GALAXY_AXIS_OPTIONS[axes.z] || { range: [0, 10] };
    
    // Helper to get actual range bounds
    const getRange = (opt, val) => {
        let min = opt.range[0] === 'auto' ? 0 : opt.range[0];
        let max = opt.range[1] === 'auto' ? Math.max(val * 1.5, 10) : opt.range[1];
        return [min, max];
    };
    
    const [xMin, xMax] = getRange(xOpt, xVal);
    const [yMin, yMax] = getRange(yOpt, yVal);
    const [zMin, zMax] = getRange(zOpt, zVal);
    
    // Apply log scale if enabled (helps spread clustered values)
    if (useLog) {
        // Log transform: log(1 + value) to handle 0 values
        xVal = Math.log1p(xVal);
        yVal = Math.log1p(yVal);
        zVal = Math.log1p(zVal);
        
        // Also transform the ranges
        const xMinLog = Math.log1p(xMin), xMaxLog = Math.log1p(xMax);
        const yMinLog = Math.log1p(yMin), yMaxLog = Math.log1p(yMax);
        const zMinLog = Math.log1p(zMin), zMaxLog = Math.log1p(zMax);
        
        // Normalize to 0-1 in log space
        const xNorm = xMaxLog > xMinLog ? (xVal - xMinLog) / (xMaxLog - xMinLog) : 0.5;
        const yNorm = yMaxLog > yMinLog ? (yVal - yMinLog) / (yMaxLog - yMinLog) : 0.5;
        const zNorm = zMaxLog > zMinLog ? (zVal - zMinLog) / (zMaxLog - zMinLog) : 0.5;
        
        return new THREE.Vector3(
            (xNorm - 0.5) * scales.x,
            (yNorm - 0.5) * scales.y,
            (zNorm - 0.5) * scales.z
        );
    }
    
    // Linear normalization to 0-1, then scale to world coordinates
    const xNorm = xMax > xMin ? (xVal - xMin) / (xMax - xMin) : 0.5;
    const yNorm = yMax > yMin ? (yVal - yMin) / (yMax - yMin) : 0.5;
    const zNorm = zMax > zMin ? (zVal - zMin) / (zMax - zMin) : 0.5;
    
    // Center around origin: -scale/2 to +scale/2
    return new THREE.Vector3(
        (xNorm - 0.5) * scales.x,
        (yNorm - 0.5) * scales.y,
        (zNorm - 0.5) * scales.z
    );
}

// Galaxy family definitions with colors and descriptions
const GALAXY_FAMILIES = {
    'Path': {
        color: 0x00ffff,      // Cyan
        name: 'The Cascades',
        description: 'Linear flow structures - Paths Pₙ',
        pattern: 'cascade'
    },
    'Cycle': {
        color: 0xff00ff,      // Magenta
        name: 'The Vortexes',
        description: 'Cyclic structures - Cycles Cₙ',
        pattern: 'vortex'
    },
    'Star': {
        color: 0xffff00,      // Yellow
        name: 'The Constellations',
        description: 'Central hub structures - Stars Sₙ',
        pattern: 'radial'
    },
    'Complete': {
        color: 0xff4500,      // Orange-Red
        name: 'The Nexus',
        description: 'Fully connected - Complete Kₙ',
        pattern: 'dense'
    },
    'Complete Bipartite': {
        color: 0xff6600,      // Orange
        name: 'The Duality',
        description: 'Two-partition complete - Kₘ,ₖ',
        pattern: 'bipartite'
    },
    'Wheel': {
        color: 0x00ff88,      // Cyan-Green
        name: 'The Spinners',
        description: 'Hub-and-rim - Wheels Wₙ',
        pattern: 'wheel'
    },
    'Grid': {
        color: 0x88ff00,      // Lime
        name: 'The Lattices',
        description: 'Regular grids - Gₘ×ₖ',
        pattern: 'grid'
    },
    'Ladder': {
        color: 0x44ff44,      // Green
        name: 'The Rungs',
        description: 'Two-rail paths - Ladders Lₙ',
        pattern: 'ladder'
    },
    'Prism': {
        color: 0x00ffcc,      // Teal
        name: 'The Prisms',
        description: 'Cycle extrusions - Prisms',
        pattern: 'prism'
    },
    'Hypercube': {
        color: 0xffffff,      // White
        name: 'The Tesseracts',
        description: 'n-dimensional cubes - Qₙ',
        pattern: 'hypercube'
    },
    'Tree': {
        color: 0x00aaff,      // Sky Blue
        name: 'The Branches',
        description: 'Acyclic connected - Trees',
        pattern: 'tree'
    },
    'Binary Tree': {
        color: 0x0088ff,      // Blue
        name: 'The Binaries',
        description: 'Binary branching trees',
        pattern: 'binary'
    },
    'Empty': {
        color: 0x444444,      // Dark Gray
        name: 'The Void',
        description: 'No edges - Empty Eₙ',
        pattern: 'empty'
    },
    'Petersen': {
        color: 0x9966ff,      // Purple
        name: 'The Petersen',
        description: 'Petersen graph family',
        pattern: 'dense'
    },
    'Möbius': {
        color: 0xff66aa,      // Pink
        name: 'The Möbius',
        description: 'Möbius-Kantor and related',
        pattern: 'vortex'
    },
    'Circulant': {
        color: 0x66ffaa,      // Mint
        name: 'The Circulants',
        description: 'Circulant graphs',
        pattern: 'vortex'
    },
    'Bipartite': {
        color: 0xffaa66,      // Peach
        name: 'The Bipartites',
        description: 'General bipartite graphs',
        pattern: 'bipartite'
    },
    'Cartesian Product': {
        color: 0xff99cc,      // Light Pink
        name: 'The Products',
        description: 'Cartesian products G □ H',
        pattern: 'grid'
    },
    'Tensor Product': {
        color: 0xcc99ff,      // Light Purple
        name: 'The Tensors',
        description: 'Tensor/Kronecker products G × H',
        pattern: 'dense'
    },
    'Line Graph': {
        color: 0x99ffcc,      // Light Mint
        name: 'The Lines',
        description: 'Line graphs L(G)',
        pattern: 'cascade'
    },
    'Complement': {
        color: 0xffcc99,      // Light Orange
        name: 'The Complements',
        description: 'Graph complements Ḡ',
        pattern: 'radial'
    },
    'Mechanism': {
        color: 0xff3366,      // Coral Red
        name: 'The Mechanisms',
        description: 'Gyro-bondgraph structures from mechanisms',
        pattern: 'grid'
    },
    'Pendulum': {
        color: 0xff6633,      // Orange Red
        name: 'The Pendulums',
        description: 'n-link pendulum bond graphs',
        pattern: 'grid'
    },
    'Friendship': {
        color: 0xff69b4,      // Hot Pink
        name: 'The Friendships',
        description: 'Windmill graphs - n triangles sharing a vertex',
        pattern: 'radial'
    },
    'Crown': {
        color: 0xffd700,      // Gold
        name: 'The Crowns',
        description: 'Complete bipartite minus perfect matching',
        pattern: 'bipartite'
    },
    'Book': {
        color: 0xdda0dd,      // Plum
        name: 'The Stacks',
        description: 'Triangles sharing a common edge',
        pattern: 'cascade'
    },
    'Fan': {
        color: 0x20b2aa,      // Light Sea Green
        name: 'The Fans',
        description: 'Path with universal vertex',
        pattern: 'radial'
    },
    'Gear': {
        color: 0xcd853f,      // Peru (brownish)
        name: 'The Gears',
        description: 'Wheel with extra spoke vertices',
        pattern: 'wheel'
    },
    'Helm': {
        color: 0x8b4513,      // Saddle Brown
        name: 'The Helms',
        description: 'Wheel with pendant vertices',
        pattern: 'wheel'
    },
    'Turán': {
        color: 0xdc143c,      // Crimson
        name: 'The Turáns',
        description: 'Complete r-partite - max edges without (r+1)-clique',
        pattern: 'dense'
    },
    'Platonic': {
        color: 0x4169e1,      // Royal Blue
        name: 'The Platonics',
        description: 'Tetrahedron, Cube, Octahedron, Dodecahedron, Icosahedron',
        pattern: 'dense'
    },
    'Unknown': {
        color: 0x888888,      // Gray
        name: 'The Nebulae',
        description: 'Unclassified analytic graphs',
        pattern: 'random'
    }
};

// =====================================================
// STATE
// =====================================================

let universeState = {
    active: false,
    scene: null,
    camera: null,
    renderer: null,
    controls: null,
    flyMode: false,  // Whether keyboard navigation is active
    
    // Movement
    velocity: new THREE.Vector3(),
    moveForward: false,
    moveBackward: false,
    moveLeft: false,
    moveRight: false,
    moveUp: false,
    moveDown: false,
    
    // Objects
    galaxies: new Map(),         // familyName -> { mesh, nodes, center, info }
    graphNodes: new Map(),       // graphId -> { mesh, data, galaxy, metrics }
    flowParticles: [],
    starfield: null,
    
    // NEW: Axis helpers for spectral mode
    axisHelpers: null,
    axisLabels: [],
    
    // Interaction
    hoveredNode: null,
    selectedNode: null,
    raycaster: new THREE.Raycaster(),
    mouse: new THREE.Vector2(),
    
    // Callbacks
    onGraphSelect: null,         // Called when graph is double-clicked
    onGraphHover: null,          // Called when graph is hovered
    onLoadInBuild: null,         // Called when "Load in Build" is clicked
    
    // Animation
    animationId: null,
    prevTime: 0,
    
    // Container
    container: null,
    hudElement: null,
    infoPanelElement: null,
    
    // NEW: Store current graphs for re-layout
    currentGraphs: []
};

// =====================================================
// NEW: GALAXY-LEVEL METRICS (Scaling Exponents + Algebraic Complexity)
// =====================================================

/**
 * Known theoretical scaling exponents for graph families
 * ρ(Gₙ) ≈ c · n^α
 */
const KNOWN_SCALING_EXPONENTS = {
    'Path': { alpha: 0, c: 2, note: 'ρ → 2 as n→∞' },
    'Cycle': { alpha: 0, c: 2, note: 'ρ = 2 for all n≥3' },
    'Complete': { alpha: 1, c: 1, note: 'ρ = n-1' },
    'Complete Bipartite': { alpha: 0.5, c: 1, note: 'ρ = √(mn) for Km,n' },
    'Star': { alpha: 0.5, c: 1, note: 'ρ = √(n-1)' },
    'Wheel': { alpha: 0.5, c: 1, note: 'ρ ≈ √n for large n' },
    'Hypercube': { alpha: 1, c: 1, note: 'ρ = dimension d' },
    'Grid': { alpha: 0, c: 4, note: 'ρ → 4 for large grids' },
    'Ladder': { alpha: 0, c: 2.732, note: 'ρ → 1+√3 ≈ 2.732' },
    'Prism': { alpha: 0, c: 3, note: 'ρ approaches 3' },
    'Tree': { alpha: 0.5, c: 2, note: 'ρ ≈ 2√(Δ-1) for max degree Δ' },
    'Binary Tree': { alpha: 0.5, c: 2, note: 'ρ = 2√2 for complete binary' },
    'Empty': { alpha: 0, c: 0, note: 'ρ = 0 always' },
    'Petersen': { alpha: 0, c: 3, note: 'ρ = 3 exactly' },
    'Möbius': { alpha: 0, c: 3, note: 'ρ = 3 for Möbius-Kantor' },
    'Circulant': { alpha: 0, c: 2, note: 'Depends on connections' },
    'Bipartite': { alpha: 0.5, c: 1, note: 'Varies by structure' },
    'Cartesian Product': { alpha: 0.5, c: 2, note: 'ρ(G□H) depends on factors' },
    'Tensor Product': { alpha: 1, c: 1, note: 'ρ(G×H) = ρ(G)·ρ(H)' },
    'Line Graph': { alpha: 0.5, c: 2, note: 'ρ(L(G)) related to Δ(G)' },
    'Complement': { alpha: 1, c: 1, note: 'ρ(Ḡ) = n-1-λₘᵢₙ(G)' },
    'Mechanism': { alpha: 0, c: 3.126, note: '5-Bar: ρ = √((11+√73)/2) ≈ 3.126 (bounded)' },
    'Pendulum': { alpha: 0, c: 2.67, note: '2-Link: ρ = √((11+√37)/2) ≈ 2.67 (bounded)' },
    'Unknown': { alpha: 0.5, c: 2, note: 'Default estimate' }
};

/**
 * Calculate galaxy-level metrics for positioning
 * @param {string} familyName - Name of the graph family
 * @param {Array} graphs - Array of graphs in this family
 * @returns {Object} Galaxy metrics for positioning (all possible metrics)
 */
function calculateGalaxyMetrics(familyName, graphs) {
    // Start with known theoretical values if available
    const known = KNOWN_SCALING_EXPONENTS[familyName] || KNOWN_SCALING_EXPONENTS['Unknown'];
    
    // Accumulators
    let totalSpectralRadius = 0;
    let totalEnergy = 0;
    let totalSpectralGap = 0;
    let totalSpectralSpread = 0;
    let totalEigenvalueRatio = 0;
    let totalN = 0;
    let totalEdges = 0;
    let totalDensity = 0;
    let totalDegreeVariance = 0;
    let rationalCount = 0;
    let integerCount = 0;
    let totalEigenvalues = 0;
    let dataPoints = []; // For scaling exponent estimation
    
    for (const graph of graphs) {
        const metrics = calculateGraphMetrics(graph);
        totalSpectralRadius += metrics.spectralRadius;
        totalEigenvalueRatio += metrics.eigenvalueRatio || 0;
        totalN += metrics.n;
        totalEdges += (graph.edges ? graph.edges.length : 0);
        totalDensity += metrics.density;
        
        // Collect data for scaling exponent regression
        if (metrics.n > 1 && metrics.spectralRadius > 0) {
            dataPoints.push({
                logN: Math.log(metrics.n),
                logRho: Math.log(metrics.spectralRadius)
            });
        }
        
        // Analyze eigenvalues
        if (graph.eigenvalues && graph.eigenvalues.length > 0) {
            const numericEigenvalues = graph.eigenvalues.map(e => {
                if (typeof e === 'number') return e;
                if (typeof e === 'object') return e.value ?? e.numeric ?? 0;
                return 0;
            }).filter(v => !isNaN(v)).sort((a, b) => b - a);
            
            // Energy: sum of absolute values
            const energy = numericEigenvalues.reduce((sum, v) => sum + Math.abs(v), 0);
            totalEnergy += energy;
            
            // Spectral gap: λ₁ - λ₂
            if (numericEigenvalues.length >= 2) {
                totalSpectralGap += numericEigenvalues[0] - numericEigenvalues[1];
            }
            
            // Spectral spread: λ_max - λ_min
            if (numericEigenvalues.length >= 1) {
                const lambdaMax = numericEigenvalues[0];
                const lambdaMin = numericEigenvalues[numericEigenvalues.length - 1];
                totalSpectralSpread += (lambdaMax - lambdaMin);
            }
            
            // Rationality analysis
            for (const val of numericEigenvalues) {
                totalEigenvalues++;
                if (Math.abs(val - Math.round(val)) < 0.0001) {
                    integerCount++;
                    rationalCount++;
                } else if (isSimpleRational(val)) {
                    rationalCount++;
                }
            }
        }
        
        // Degree variance (regularity measure)
        if (graph.edges && graph.n > 0) {
            const degrees = new Array(graph.n).fill(0);
            for (const [i, j] of graph.edges) {
                if (i < graph.n) degrees[i]++;
                if (j < graph.n) degrees[j]++;
            }
            const avgDeg = degrees.reduce((a, b) => a + b, 0) / graph.n;
            const variance = degrees.reduce((sum, d) => sum + (d - avgDeg) ** 2, 0) / graph.n;
            totalDegreeVariance += variance;
        }
    }
    
    const count = graphs.length || 1;
    
    // Calculate empirical scaling exponent via linear regression
    let empiricalAlpha = known.alpha;
    if (dataPoints.length >= 3) {
        const regression = linearRegression(
            dataPoints.map(d => d.logN),
            dataPoints.map(d => d.logRho)
        );
        if (regression.rSquared > 0.7 && regression.slope >= -0.1 && regression.slope <= 1.5) {
            empiricalAlpha = regression.slope;
        }
    }
    
    // Blend known and empirical
    const alpha = known.alpha !== undefined ? 
        (known.alpha * 0.7 + empiricalAlpha * 0.3) : empiricalAlpha;
    
    // Calculate all metrics
    const avgSpectralRadius = totalSpectralRadius / count;
    const avgN = totalN / count;
    const avgEdges = totalEdges / count;
    const avgDensity = totalDensity / count;
    const avgEnergy = totalEnergy / count;
    const avgSpectralGap = totalSpectralGap / count;
    const avgSpectralSpread = totalSpectralSpread / count;
    const avgDegreeVariance = totalDegreeVariance / count;
    const avgEigenvalueRatio = totalEigenvalueRatio / count;
    
    // Regularity: 1 = perfectly regular, 0 = highly irregular
    const maxVariance = avgN > 1 ? avgN : 1;
    const regularity = Math.max(0, 1 - (avgDegreeVariance / maxVariance));
    
    const rationalityScore = totalEigenvalues > 0 ? rationalCount / totalEigenvalues : 0.5;
    
    // Spectral radius ratio (ρ/n)
    const spectralRadiusRatio = avgN > 0 ? avgSpectralRadius / avgN : 0;
    
    return {
        familyName,
        graphCount: count,
        // Scaling
        alpha,
        coefficient: known.c || 1,
        // Averages
        avgSpectralRadius,
        avgN,
        avgEdges,
        avgEnergy,
        avgSpectralGap,
        avgSpectralSpread,
        avgEigenvalueRatio,
        // Derived
        spectralSpread: avgSpectralSpread,
        spectralRadiusRatio,
        eigenvalueRatio: avgEigenvalueRatio,
        // Scores (0-1)
        rationality: rationalityScore,
        regularity,
        sparsity: avgDensity,
        // Metadata
        note: known.note
    };
}

/**
 * Check if a value is a simple rational (denominator ≤ 10)
 * Checks fractions like 1/2, 1/3, 2/3, 1/4, 3/4, 1/5, 2/5, ..., up to n/10
 */
function isSimpleRational(val, tolerance = 0.0001) {
    for (let denom = 1; denom <= 10; denom++) {
        const numer = Math.round(val * denom);
        if (Math.abs(val - numer / denom) < tolerance) {
            return true;
        }
    }
    return false;
}

/**
 * Simple linear regression
 * @returns {Object} { slope, intercept, rSquared }
 */
function linearRegression(xValues, yValues) {
    const n = xValues.length;
    if (n < 2) return { slope: 0, intercept: 0, rSquared: 0 };
    
    let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0, sumY2 = 0;
    
    for (let i = 0; i < n; i++) {
        sumX += xValues[i];
        sumY += yValues[i];
        sumXY += xValues[i] * yValues[i];
        sumX2 += xValues[i] * xValues[i];
        sumY2 += yValues[i] * yValues[i];
    }
    
    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;
    
    // Calculate R²
    const yMean = sumY / n;
    let ssRes = 0, ssTot = 0;
    for (let i = 0; i < n; i++) {
        const yPred = slope * xValues[i] + intercept;
        ssRes += (yValues[i] - yPred) ** 2;
        ssTot += (yValues[i] - yMean) ** 2;
    }
    const rSquared = ssTot > 0 ? 1 - (ssRes / ssTot) : 0;
    
    return { slope, intercept, rSquared };
}

/**
 * Get a specific metric value from galaxy metrics
 * @param {Object} metrics - Galaxy metrics object
 * @param {string} metricKey - Key of the metric to get
 * @returns {number} The metric value
 */
function getGalaxyMetricValue(metrics, metricKey) {
    switch (metricKey) {
        case 'alpha': return metrics.alpha || 0;
        case 'rationality': return metrics.rationality || 0;
        case 'avgSpectralRadius': return metrics.avgSpectralRadius || 0;
        case 'spectralGap': return metrics.avgSpectralGap || 0;
        case 'energy': return metrics.avgEnergy || 0;
        case 'regularity': return metrics.regularity || 0;
        case 'sparsity': return metrics.sparsity || 0;
        case 'avgN': return metrics.avgN || 0;
        case 'graphCount': return metrics.graphCount || 0;
        case 'spectralSpread': return metrics.spectralSpread || metrics.avgSpectralSpread || 0;
        case 'spectralRadiusRatio': return metrics.spectralRadiusRatio || 0;
        case 'avgEdges': return metrics.avgEdges || 0;
        case 'coefficient': return metrics.coefficient || 1;
        case 'eigenvalueRatio': return metrics.eigenvalueRatio || metrics.avgEigenvalueRatio || 1;
        default: return 0;
    }
}

/**
 * Normalize a metric value to 0-1 range
 * @param {number} value - Raw metric value
 * @param {string} metricKey - Key of the metric
 * @param {Object} globalStats - Min/max values across all galaxies
 * @returns {number} Normalized value 0-1
 */
function normalizeMetricValue(value, metricKey, globalStats) {
    const option = GALAXY_AXIS_OPTIONS[metricKey];
    if (!option) return 0.5;
    
    // For fixed-range metrics (0-1), use directly
    if (option.range[0] === 0 && option.range[1] === 1) {
        return value;
    }
    
    // For auto-range metrics, use global stats
    const stats = globalStats[metricKey];
    if (stats && stats.max > stats.min) {
        return (value - stats.min) / (stats.max - stats.min);
    }
    
    return 0.5;
}

/**
 * Calculate global statistics for all metrics across all galaxies
 * @param {Array} allMetrics - Array of galaxy metrics objects
 * @returns {Object} Global stats per metric
 */
function calculateGlobalMetricStats(allMetrics) {
    const stats = {};
    const metricKeys = Object.keys(GALAXY_AXIS_OPTIONS);
    
    for (const key of metricKeys) {
        let min = Infinity, max = -Infinity;
        for (const metrics of allMetrics) {
            const val = getGalaxyMetricValue(metrics, key);
            min = Math.min(min, val);
            max = Math.max(max, val);
        }
        stats[key] = { min, max };
    }
    
    return stats;
}

/**
 * Convert galaxy metrics to 3D position using configurable axes
 * @param {Object} metrics - Galaxy metrics object
 * @param {Object} globalStats - Global min/max for normalization
 * @returns {THREE.Vector3} Position in 3D space
 */
function galaxyMetricsToPosition(metrics, globalStats) {
    const scale = CONFIG.galaxyScale;
    const axes = CONFIG.galaxyAxes;
    
    // Get normalized values for each axis
    const xVal = normalizeMetricValue(getGalaxyMetricValue(metrics, axes.x), axes.x, globalStats);
    const yVal = normalizeMetricValue(getGalaxyMetricValue(metrics, axes.y), axes.y, globalStats);
    const zVal = normalizeMetricValue(getGalaxyMetricValue(metrics, axes.z), axes.z, globalStats);
    
    // Map to 3D space (centered)
    const x = (xVal - 0.5) * scale.x;
    const y = (yVal - 0.5) * scale.y;
    const z = (zVal - 0.5) * scale.z;
    
    // Use deterministic jitter based on graph properties to prevent overlaps
    // but ensure same graph always gets same position
    const jitter = 30;
    let hash = 0;
    const name = metrics.name || '';
    for (let i = 0; i < name.length; i++) {
        hash = ((hash << 5) - hash) + name.charCodeAt(i);
        hash = hash & hash; // Convert to 32-bit integer
    }
    // Add n and edge count to hash for uniqueness
    hash = ((hash << 5) - hash) + (metrics.n || 0);
    hash = ((hash << 5) - hash) + (metrics.edgeCount || 0);
    
    // Generate deterministic "random" values from hash
    const h1 = Math.abs(hash % 1000) / 1000;
    const h2 = Math.abs((hash * 31) % 1000) / 1000;
    const h3 = Math.abs((hash * 97) % 1000) / 1000;
    
    const jx = (h1 - 0.5) * jitter;
    const jy = (h2 - 0.5) * jitter;
    const jz = (h3 - 0.5) * jitter;
    
    return new THREE.Vector3(x + jx, y + jy, z + jz);
}

// =====================================================
// GRAPH-LEVEL SPECTRAL METRICS CALCULATION
// =====================================================

/**
 * Calculate spectral metrics for a graph
 * @param {Object} graph - Graph object from library
 * @returns {Object} Metrics object with n, edgeCount, density, spectralRadius, maxEigenvalue
 */
function calculateGraphMetrics(graph) {
    const n = graph.n || 1;
    const edgeCount = graph.edgeCount || graph.edges?.length || 0;
    const edges = graph.edges || [];
    
    // DEBUG: Log input data
    const debugName = graph.name || graph.family || `G(${n})`;
    
    // Calculate density (for undirected: edges / (n*(n-1)/2))
    const maxEdges = n * (n - 1) / 2;
    const density = maxEdges > 0 ? edgeCount / maxEdges : 0;
    
    // Initialize metrics
    let spectralRadius = 0;
    let maxEigenvalue = 0;
    let minEigenvalue = 0;
    let spectralGap = 0;
    let energy = 0;
    let rationality = 0;
    let rationalCount = 0;
    let eigenvalueRatio = 0;  // Ratio of largest to smallest non-zero eigenvalue
    let computedEigenvalues = null;
    
    // ALWAYS compute skew-symmetric eigenvalues from the adjacency matrix
    // (ignore any stored eigenvalues - they may be symmetric, not skew-symmetric)
    if (edges.length > 0 && n > 0 && n <= 200) {
        try {
            // Build skew-symmetric adjacency matrix
            const matrix = Array(n).fill(null).map(() => Array(n).fill(0));
            for (const [i, j] of edges) {
                if (i < n && j < n) {
                    matrix[i][j] = 1;
                    matrix[j][i] = -1;
                }
            }
            
            // Compute eigenvalues using spectral analysis
            const skewEigs = computeSkewSymmetricEigenvalues(matrix);
            if (skewEigs && skewEigs.length > 0) {
                // Extract imaginary parts (skew-symmetric has pure imaginary eigenvalues)
                computedEigenvalues = skewEigs.map(e => Math.abs(e.imag || e.value || e)).filter(v => isFinite(v));
                console.log(`  [METRICS] ${debugName}: COMPUTED ${computedEigenvalues.length} skew-sym eigenvalues`);
            }
        } catch (err) {
            console.warn(`  [METRICS] ${debugName}: Failed to compute eigenvalues:`, err.message);
        }
    }
    
    // Process computed eigenvalues
    if (computedEigenvalues && computedEigenvalues.length > 0) {
        // Sort by absolute value for spectral radius
        const sorted = [...computedEigenvalues].sort((a, b) => Math.abs(b) - Math.abs(a));
        
        spectralRadius = Math.abs(sorted[0]);
        maxEigenvalue = Math.max(...computedEigenvalues);
        minEigenvalue = Math.min(...computedEigenvalues);
        spectralGap = sorted.length > 1 ? Math.abs(sorted[0]) - Math.abs(sorted[1]) : 0;
        energy = computedEigenvalues.reduce((sum, λ) => sum + Math.abs(λ), 0);
        
        // Calculate eigenvalue ratio: largest / smallest non-zero
        // Find smallest non-zero eigenvalue (by absolute value)
        const nonZeroSorted = sorted.filter(v => Math.abs(v) > 1e-10);
        if (nonZeroSorted.length >= 2) {
            const largestAbs = Math.abs(nonZeroSorted[0]);
            const smallestAbs = Math.abs(nonZeroSorted[nonZeroSorted.length - 1]);
            eigenvalueRatio = smallestAbs > 1e-10 ? largestAbs / smallestAbs : 0;
        } else if (nonZeroSorted.length === 1) {
            eigenvalueRatio = 1;  // Only one non-zero eigenvalue
        }
        
        // Calculate rationality (fraction of eigenvalues that are simple rationals)
        for (const eig of computedEigenvalues) {
            if (isSimpleRational(eig)) {
                rationalCount++;
            }
        }
        rationality = computedEigenvalues.length > 0 ? rationalCount / computedEigenvalues.length : 0;
        
        console.log(`  [METRICS] ${debugName}: ρ=${spectralRadius.toFixed(3)}, E=${energy.toFixed(2)}, gap=${spectralGap.toFixed(3)}, ratio=${eigenvalueRatio.toFixed(3)}`);
    }
    
    // FALLBACK: Estimate spectral radius only if computation failed
    if (spectralRadius === 0 && edgeCount > 0) {
        console.warn(`  [METRICS] ${debugName}: FALLBACK to estimation (no eigenvalues computed)`);
        const avgDegree = (2 * edgeCount) / n;
        spectralRadius = Math.sqrt(avgDegree * Math.max(avgDegree, 2));
        energy = 2 * edgeCount * 0.8;
    }
    
    // Estimate alpha based on graph structure
    // α = 0: bounded spectral radius (cycles, paths)
    // α = 0.5: sqrt growth (stars, trees)
    // α = 1: linear growth (complete graphs)
    let alpha = 0.5;  // Default
    if (density > 0.8) {
        alpha = 0.9;  // Near-complete
    } else if (density < 0.15 && n > 3) {
        alpha = 0.1;  // Very sparse (cycle-like)
    } else if (edgeCount === n - 1) {
        // Tree
        const avgDegree = (2 * edgeCount) / n;
        const maxDegree = Math.max(...(graph.edges || []).flat().reduce((acc, v) => {
            acc[v] = (acc[v] || 0) + 1;
            return acc;
        }, []));
        if (maxDegree === n - 1) {
            alpha = 0.5;  // Star
        } else {
            alpha = 0.5;  // General tree
        }
    }
    
    return {
        n,
        edgeCount,
        density,
        spectralRadius,
        maxEigenvalue,
        minEigenvalue,
        spectralGap,
        energy,
        rationality,
        eigenvalueRatio,
        alpha,
        // Derived metrics
        avgDegree: n > 0 ? (2 * edgeCount) / n : 0,
        // Normalized values for positioning (0-1 range)
        normalizedN: Math.log10(n + 1) / Math.log10(100),  // Normalize assuming max ~100 vertices
        normalizedDensity: density,
        normalizedSpectralRadius: spectralRadius / Math.max(n - 1, 1)  // Normalize by max possible
    };
}

/**
 * Convert graph metrics to 3D position within a galaxy
 * @param {Object} metrics - Metrics from calculateGraphMetrics
 * @param {Object} familyStats - Min/max stats for the family (for normalization)
 * @returns {THREE.Vector3} Local position within galaxy
 */
function metricsToLocalPosition(metrics, familyStats, globalStats = null) {
    const spread = CONFIG.spectralSpread;
    const axes = CONFIG.galaxyAxes;
    
    // Get the metric values for each axis (same as galaxy axes for consistency)
    const getValue = (axisKey) => {
        switch (axisKey) {
            case 'alpha': return metrics.alpha ?? 0.5;
            case 'rationality': return metrics.rationality ?? 0.5;
            case 'avgSpectralRadius': return metrics.spectralRadius ?? 2;
            case 'spectralGap': return metrics.spectralGap ?? 1;
            case 'energy': return metrics.energy ?? 5;
            case 'avgN': return metrics.n ?? 5;
            case 'sparsity': 
            case 'density': return metrics.density ?? 0.5;
            case 'eigenvalueRatio': return metrics.eigenvalueRatio ?? 1;
            default: return 0.5;
        }
    };
    
    // Get ranges for normalization
    const getRange = (axisKey) => {
        const opt = GALAXY_AXIS_OPTIONS[axisKey];
        if (!opt) return [0, 1];
        
        // Fixed range metrics
        if (Array.isArray(opt.range) && opt.range[0] !== 'auto') {
            return opt.range;
        }
        
        // Auto-range: use global stats if available, else family stats, else defaults
        if (globalStats && globalStats[axisKey]) {
            const stat = globalStats[axisKey];
            if (stat.min !== Infinity && stat.max !== -Infinity) {
                return [stat.min, stat.max];
            }
        }
        
        // Default ranges for common metrics
        const defaults = {
            'avgSpectralRadius': [1, 5],  // Typical range for small graphs
            'spectralGap': [0, 3],
            'energy': [2, 20],
            'avgN': [3, 15],
            'alpha': [0, 1],
            'rationality': [0, 1],
            'eigenvalueRatio': [1, 10]  // Typical range for eigenvalue ratios
        };
        return defaults[axisKey] || [0, 1];
    };
    
    // Normalize value to 0-1 range
    const normalize = (value, axisKey) => {
        const [min, max] = getRange(axisKey);
        const range = max - min || 1;
        return Math.max(0, Math.min(1, (value - min) / range));
    };
    
    // Get normalized positions for each axis
    const xNorm = normalize(getValue(axes.x), axes.x);
    const yNorm = normalize(getValue(axes.y), axes.y);
    const zNorm = normalize(getValue(axes.z), axes.z);
    
    // Map to 3D space centered on galaxy (local offset from galaxy center)
    return new THREE.Vector3(
        (xNorm - 0.5) * spread,
        (yNorm - 0.5) * spread * 0.8,
        (zNorm - 0.5) * spread * 0.6
    );
}

/**
 * Calculate family statistics for normalization
 * @param {Array} graphs - Array of graphs in the family
 * @returns {Object} Statistics object
 */
function calculateFamilyStats(graphs) {
    if (!graphs || graphs.length === 0) {
        return { count: 0, minN: 0, maxN: 1, minDensity: 0, maxDensity: 1, minSR: 0, maxSR: 1 };
    }
    
    let minN = Infinity, maxN = -Infinity;
    let minDensity = Infinity, maxDensity = -Infinity;
    let minSR = Infinity, maxSR = -Infinity;
    
    for (const graph of graphs) {
        const metrics = calculateGraphMetrics(graph);
        
        minN = Math.min(minN, metrics.n);
        maxN = Math.max(maxN, metrics.n);
        minDensity = Math.min(minDensity, metrics.density);
        maxDensity = Math.max(maxDensity, metrics.density);
        minSR = Math.min(minSR, metrics.spectralRadius);
        maxSR = Math.max(maxSR, metrics.spectralRadius);
    }
    
    return {
        count: graphs.length,
        minN, maxN,
        minDensity, maxDensity,
        minSR, maxSR
    };
}

// =====================================================
// INITIALIZATION
// =====================================================

/**
 * Initialize the Graph Universe
 * @param {HTMLElement} container - DOM element to render into
 * @param {Object} options - Configuration options
 */
export function initUniverse(container, options = {}) {
    universeState.container = container;
    
    // Merge options with config
    Object.assign(CONFIG, options);
    
    // Setup Three.js scene
    setupScene();
    setupCamera();
    setupRenderer();
    setupControls();
    setupLighting();
    createStarfield();
    createHUD();
    createAxisControlPanel();
    createInfoPanel();
    
    // Event listeners
    setupEventListeners();
    
    console.log('Graph Universe initialized');
    return true;
}

function setupScene() {
    universeState.scene = new THREE.Scene();
    universeState.scene.background = new THREE.Color(CONFIG.backgroundColor);
    universeState.scene.fog = new THREE.FogExp2(CONFIG.backgroundColor, CONFIG.fogDensity);
}

function setupCamera() {
    const aspect = universeState.container.clientWidth / universeState.container.clientHeight;
    universeState.camera = new THREE.PerspectiveCamera(75, aspect, 0.01, 10000);
    // Start further back to see more of the spread-out galaxies
    universeState.camera.position.set(0, 300, 900);
}

function setupRenderer() {
    universeState.renderer = new THREE.WebGLRenderer({ antialias: true });
    universeState.renderer.setPixelRatio(window.devicePixelRatio);
    universeState.renderer.setSize(
        universeState.container.clientWidth,
        universeState.container.clientHeight
    );
    universeState.container.appendChild(universeState.renderer.domElement);
}

function setupControls() {
    universeState.controls = new OrbitControls(
        universeState.camera,
        universeState.renderer.domElement
    );
    
    // Configure mouse buttons:
    // - LEFT = Rotate (Shift+Left will pan due to OrbitControls default behavior)
    // - MIDDLE = Pan
    // - RIGHT = disabled (we use it for rubber band zoom manually)
    // Using THREE.MOUSE enum for proper compatibility
    universeState.controls.mouseButtons = {
        LEFT: THREE.MOUSE.ROTATE,
        MIDDLE: THREE.MOUSE.PAN,
        RIGHT: null  // Disabled - used for rubber band zoom
    };
    
    // Enable smooth damping for all movements
    universeState.controls.enableDamping = true;
    universeState.controls.dampingFactor = 0.08;
    
    // Zoom settings
    universeState.controls.enableZoom = true;
    universeState.controls.zoomSpeed = 0.8;
    universeState.controls.minDistance = 1;      // Allow very close zoom
    universeState.controls.maxDistance = 5000;   // Allow zooming out further
    
    // Rotation settings
    universeState.controls.enableRotate = true;
    universeState.controls.rotateSpeed = 0.5;
    universeState.controls.autoRotate = false;
    universeState.controls.autoRotateSpeed = 0.5;
    
    // Pan settings - Shift+Left or Middle button pans
    universeState.controls.enablePan = true;
    universeState.controls.screenSpacePanning = true;
    universeState.controls.panSpeed = 0.8;
    
    // Enable keyboard controls for arrow keys
    universeState.controls.listenToKeyEvents(window);
    
    // Store initial target for reset
    universeState.initialTarget = universeState.controls.target.clone();
    
    // Add pivot indicator (invisible by default)
    createPivotIndicator();
}

/**
 * Create a visual indicator for the rotation pivot point
 */
function createPivotIndicator() {
    const geometry = new THREE.OctahedronGeometry(3, 0);
    const material = new THREE.MeshBasicMaterial({
        color: 0x00ff88,
        wireframe: true,
        transparent: true,
        opacity: 0.6
    });
    const pivot = new THREE.Mesh(geometry, material);
    pivot.visible = false;
    pivot.name = 'pivotIndicator';
    universeState.scene.add(pivot);
    universeState.pivotIndicator = pivot;
}

/**
 * Set rotation pivot to a specific point (called when clicking a graph or pressing P)
 */
function setRotationPivot(position) {
    if (!universeState.controls) return;
    
    const targetPos = position.clone();
    
    // Animate the target change smoothly
    const startTarget = universeState.controls.target.clone();
    const duration = 500;
    const startTime = Date.now();
    
    function animatePivot() {
        const elapsed = Date.now() - startTime;
        const t = Math.min(elapsed / duration, 1);
        const easeT = 1 - Math.pow(1 - t, 3);  // Ease out cubic
        
        universeState.controls.target.lerpVectors(startTarget, targetPos, easeT);
        
        // Update pivot indicator
        if (universeState.pivotIndicator) {
            universeState.pivotIndicator.position.copy(universeState.controls.target);
            universeState.pivotIndicator.visible = true;
            universeState.pivotIndicator.rotation.y += 0.02;
        }
        
        if (t < 1) {
            requestAnimationFrame(animatePivot);
        } else {
            // Hide pivot after a delay
            setTimeout(() => {
                if (universeState.pivotIndicator) {
                    universeState.pivotIndicator.visible = false;
                }
            }, 2000);
        }
    }
    
    animatePivot();
    console.log(`Rotation pivot set to (${targetPos.x.toFixed(1)}, ${targetPos.y.toFixed(1)}, ${targetPos.z.toFixed(1)})`);
}

/**
 * Reset rotation pivot to origin
 */
function resetRotationPivot() {
    setRotationPivot(new THREE.Vector3(0, 0, 0));
    console.log('Rotation pivot reset to origin');
}

function setupLighting() {
    // Ambient light for base visibility
    const ambient = new THREE.AmbientLight(0x404040, 0.3);
    universeState.scene.add(ambient);
    
    // Camera-attached point light for depth perception
    // Objects closer to camera will be brighter
    const cameraLight = new THREE.PointLight(0xffffff, 1.0, 1500);
    cameraLight.name = 'cameraLight';
    universeState.camera.add(cameraLight);
    universeState.scene.add(universeState.camera);  // Camera must be in scene for light to work
    
    // Secondary fill light from below for dimension
    const fillLight = new THREE.PointLight(0x4466aa, 0.3, 2000);
    fillLight.position.set(0, -500, 0);
    universeState.scene.add(fillLight);
    
    // Store reference
    universeState.cameraLight = cameraLight;
}

function createStarfield() {
    const geometry = new THREE.BufferGeometry();
    const vertices = [];
    
    for (let i = 0; i < CONFIG.starCount; i++) {
        vertices.push(
            (Math.random() - 0.5) * 4000,
            (Math.random() - 0.5) * 4000,
            (Math.random() - 0.5) * 4000
        );
    }
    
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    
    const material = new THREE.PointsMaterial({
        color: 0x888888,
        size: 2,
        sizeAttenuation: false
    });
    
    universeState.starfield = new THREE.Points(geometry, material);
    universeState.scene.add(universeState.starfield);
}

function createHUD() {
    const hud = document.createElement('div');
    hud.id = 'universe-hud';
    hud.innerHTML = `
        <div class="hud-drag-handle">≡ HUD</div>
        <div class="hud-row">COORDS: <span id="universe-coords">0, 0, 0</span></div>
        <div class="hud-row">GALAXY: <span id="universe-galaxy">-</span></div>
        <div class="hud-row">METRICS: <span id="universe-galaxy-alpha">-</span></div>
        <div class="hud-row">PIVOT: <span id="universe-pivot">Origin</span></div>
        <div class="hud-row">HIGHLIGHT: <span id="universe-highlight">-</span></div>
        <div class="hud-hint">
            <b>Left-drag</b>=Rotate | <b>Scroll</b>=Zoom | <b>Middle-drag</b>=Pan<br>
            <b style="color:#0ff">Right-drag</b>=<b style="color:#0ff">RUBBER BAND ZOOM</b><br>
            <b>F</b>=Fit All | <b>R</b>=Auto-rotate<br>
            <b>P</b>=Set Pivot | <b>O</b>=Origin | <b>DblClick</b>=Pivot to graph<br>
            <b style="color:#4fc3f7">E</b>=<b style="color:#4fc3f7">Expand All</b> | <b style="color:#ce93d8">C</b>=<b style="color:#ce93d8">Collapse All</b><br>
            <b style="color:#ff6600">H</b>=<b style="color:#ff6600">Highlight Analytic</b> | <b style="color:#00aaaa">V</b>=<b style="color:#00aaaa">Manifold</b>
        </div>
    `;
    universeState.container.appendChild(hud);
    universeState.hudElement = hud;
    
    // Make draggable
    makePanelDraggable(hud, hud.querySelector('.hud-drag-handle'));
}

/**
 * Make a panel draggable by its handle
 */
function makePanelDraggable(panel, handle) {
    let isDragging = false;
    let startX, startY, startLeft, startTop;
    
    handle.style.cursor = 'move';
    
    handle.addEventListener('mousedown', (e) => {
        isDragging = true;
        startX = e.clientX;
        startY = e.clientY;
        
        const rect = panel.getBoundingClientRect();
        startLeft = rect.left;
        startTop = rect.top;
        
        // Switch to fixed positioning for dragging
        panel.style.position = 'fixed';
        panel.style.left = startLeft + 'px';
        panel.style.top = startTop + 'px';
        panel.style.bottom = 'auto';
        panel.style.right = 'auto';
        
        e.preventDefault();
    });
    
    document.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        
        const dx = e.clientX - startX;
        const dy = e.clientY - startY;
        
        panel.style.left = (startLeft + dx) + 'px';
        panel.style.top = (startTop + dy) + 'px';
    });
    
    document.addEventListener('mouseup', () => {
        isDragging = false;
    });
}

/**
 * Create axis configuration control panel
 */
function createAxisControlPanel() {
    const panel = document.createElement('div');
    panel.id = 'universe-axis-panel';
    
    // Generate options HTML for individual axes
    const optionsHtml = Object.entries(GALAXY_AXIS_OPTIONS).map(([key, opt]) => 
        `<option value="${key}" data-desc="${opt.description}">${opt.name}</option>`
    ).join('');
    
    // Generate presets HTML
    const presetsHtml = Object.entries(AXIS_PRESETS).map(([key, preset]) =>
        `<option value="${key}">${preset.name}</option>`
    ).join('');
    
    panel.innerHTML = `
        <div class="axis-panel-header">⚙ Galaxy Axes</div>
        <div class="axis-row preset-row">
            <label>📋</label>
            <select id="axis-preset-select">
                <option value="">-- Presets --</option>
                ${presetsHtml}
            </select>
        </div>
        <div class="axis-divider"></div>
        <div class="axis-row">
            <label>X:</label>
            <select id="axis-x-select">${optionsHtml}</select>
        </div>
        <div class="axis-row">
            <label>Y:</label>
            <select id="axis-y-select">${optionsHtml}</select>
        </div>
        <div class="axis-row">
            <label>Z:</label>
            <select id="axis-z-select">${optionsHtml}</select>
        </div>
        <div id="axis-description" class="axis-desc"></div>
        <button id="axis-apply-btn">Apply</button>
        <div class="axis-row" style="margin-top: 8px;">
            <label style="flex: 1;">
                <input type="checkbox" id="log-scale-checkbox" ${CONFIG.useLogScale ? 'checked' : ''}>
                Log Scale
            </label>
            <small style="color: #888; font-size: 9px;">Spreads clusters</small>
        </div>
        <div style="display: flex; gap: 5px; margin-top: 5px;">
            <button id="axis-export-btn" style="flex: 1; background: #2a6b2a; font-size: 11px;">📊 Export</button>
            <button id="axis-verify-btn" style="flex: 1; background: #b26a00; font-size: 11px;">✓ Verify</button>
        </div>
        
        <div class="axis-divider" style="margin-top: 10px;"></div>
        <div class="axis-panel-header" style="font-size: 11px;">💥 Cluster Navigation</div>
        <div class="axis-row" style="margin-top: 5px;">
            <label style="flex: 1;">
                <input type="checkbox" id="adaptive-labels-checkbox" ${CONFIG.adaptiveLabels ? 'checked' : ''}>
                Adaptive Labels
            </label>
            <small style="color: #888; font-size: 9px;">Show ${CONFIG.maxVisibleLabels} nearest</small>
        </div>
        
        <div class="axis-divider" style="margin-top: 10px;"></div>
        <div class="axis-panel-header" style="font-size: 11px;">🔍 Expand/Collapse</div>
        <div class="axis-row">
            <label>Galaxy:</label>
            <select id="expand-galaxy-select" style="flex: 1;">
                <option value="__all__">All Galaxies</option>
            </select>
        </div>
        <div class="expand-btn-row" style="display: flex; gap: 5px; margin-top: 5px;">
            <button id="expand-all-btn" style="flex: 1; background: #1565c0; font-size: 11px;">🔍 Expand</button>
            <button id="collapse-all-btn" style="flex: 1; background: #6a1b9a; font-size: 11px;">📦 Collapse</button>
        </div>
        <div id="expand-status" style="font-size: 10px; color: #888; margin-top: 5px; text-align: center;"></div>
        
        <div class="axis-help">
            <small>💡 Keys: F=fit all, E=expand, C=collapse, H=highlight</small>
        </div>
    `;
    
    universeState.container.appendChild(panel);
    universeState.axisControlPanel = panel;
    
    // Set initial values
    document.getElementById('axis-x-select').value = CONFIG.galaxyAxes.x;
    document.getElementById('axis-y-select').value = CONFIG.galaxyAxes.y;
    document.getElementById('axis-z-select').value = CONFIG.galaxyAxes.z;
    
    // Get description element
    const descEl = document.getElementById('axis-description');
    
    // Function to update description
    const updateDescription = (axisLabel, key) => {
        const opt = GALAXY_AXIS_OPTIONS[key];
        if (opt && descEl) {
            descEl.innerHTML = `<strong>${axisLabel}:</strong> ${opt.description}`;
            descEl.style.display = 'block';
        }
    };
    
    // Add hover listeners for descriptions
    const xSelect = document.getElementById('axis-x-select');
    const ySelect = document.getElementById('axis-y-select');
    const zSelect = document.getElementById('axis-z-select');
    
    xSelect.addEventListener('focus', () => updateDescription('X', xSelect.value));
    xSelect.addEventListener('change', () => updateDescription('X', xSelect.value));
    ySelect.addEventListener('focus', () => updateDescription('Y', ySelect.value));
    ySelect.addEventListener('change', () => updateDescription('Y', ySelect.value));
    zSelect.addEventListener('focus', () => updateDescription('Z', zSelect.value));
    zSelect.addEventListener('change', () => updateDescription('Z', zSelect.value));
    
    // Show initial X description
    updateDescription('X', CONFIG.galaxyAxes.x);
    
    // Add event listener for apply button
    document.getElementById('axis-apply-btn').addEventListener('click', applyAxisConfiguration);
    
    // Add event listener for export button
    document.getElementById('axis-export-btn').addEventListener('click', () => {
        const result = exportUniverseTable();
        if (result) {
            console.log(`Exported ${result.count} graphs`);
        }
    });
    
    // Add event listener for verify button
    document.getElementById('axis-verify-btn').addEventListener('click', () => {
        const result = verifyUniversePositions();
        if (result && result.discrepancies.length > 0) {
            alert(`Found ${result.discrepancies.length} position discrepancies!\nCheck console for details.`);
        } else {
            alert('No discrepancies found - all identical graphs have matching positions.');
        }
    });
    
    // Add event listener for preset selector
    document.getElementById('axis-preset-select').addEventListener('change', (e) => {
        const presetKey = e.target.value;
        if (presetKey && AXIS_PRESETS[presetKey]) {
            const preset = AXIS_PRESETS[presetKey];
            document.getElementById('axis-x-select').value = preset.x;
            document.getElementById('axis-y-select').value = preset.y;
            document.getElementById('axis-z-select').value = preset.z;
            // Auto-apply when preset is selected
            applyAxisConfiguration();
            // Reset preset dropdown
            e.target.value = '';
        }
    });
    
    // Add event listener for log scale checkbox
    document.getElementById('log-scale-checkbox').addEventListener('change', (e) => {
        CONFIG.useLogScale = e.target.checked;
        console.log(`Log scale ${CONFIG.useLogScale ? 'enabled' : 'disabled'}`);
        applyAxisConfiguration();
    });
    
    // Add event listener for adaptive labels checkbox
    document.getElementById('adaptive-labels-checkbox').addEventListener('change', (e) => {
        CONFIG.adaptiveLabels = e.target.checked;
        console.log(`Adaptive labels ${CONFIG.adaptiveLabels ? 'enabled' : 'disabled'}`);
        // If disabling, make all labels visible
        if (!CONFIG.adaptiveLabels) {
            for (const [graphId, nodeData] of universeState.graphNodes) {
                const label = nodeData.mesh?.userData?.label;
                if (label) {
                    label.visible = true;
                    if (label.material) label.material.opacity = 1;
                }
            }
        }
    });
    
    // Add event listeners for expand/collapse buttons
    document.getElementById('expand-all-btn').addEventListener('click', () => {
        const galaxyFilter = document.getElementById('expand-galaxy-select').value;
        expandCollapseAll(true, galaxyFilter);
    });
    
    document.getElementById('collapse-all-btn').addEventListener('click', () => {
        const galaxyFilter = document.getElementById('expand-galaxy-select').value;
        expandCollapseAll(false, galaxyFilter);
    });
    
    // Make draggable by header
    makePanelDraggable(panel, panel.querySelector('.axis-panel-header'));
    
    console.log('Galaxy Axes control panel created');
}

/**
 * Apply new axis configuration and rebuild universe
 */
function applyAxisConfiguration() {
    try {
        const xSelect = document.getElementById('axis-x-select');
        const ySelect = document.getElementById('axis-y-select');
        const zSelect = document.getElementById('axis-z-select');
        
        if (!xSelect || !ySelect || !zSelect) {
            console.error('Axis select elements not found!');
            return;
        }
        
        const newX = xSelect.value;
        const newY = ySelect.value;
        const newZ = zSelect.value;
        
        // Update config
        CONFIG.galaxyAxes.x = newX;
        CONFIG.galaxyAxes.y = newY;
        CONFIG.galaxyAxes.z = newZ;
        
        console.log(`Axis configuration changed: X=${newX}, Y=${newY}, Z=${newZ}`);
        
        // Store camera position
        const camPos = universeState.camera.position.clone();
        const camTarget = universeState.controls?.target?.clone() || new THREE.Vector3();
        
        // Store custom graphs before clearing - preserve all important fields explicitly
        const customGraphsBackup = [];
        universeState.graphNodes.forEach((nodeData, graphId) => {
            if (nodeData.mesh?.userData?.isCustom) {
                const data = nodeData.data;
                console.log(`  Backing up: "${data?.name}", family="${data?.family}", expanded=${nodeData.expanded}`);
                customGraphsBackup.push({
                    data: {
                        n: data.n,
                        edges: data.edges,
                        edgeCount: data.edgeCount,
                        name: data.name,
                        family: data.family,  // Explicitly preserve family
                        eigenvalues: data.eigenvalues,
                        spectralRadius: data.spectralRadius,
                        analyticalRho: data.analyticalRho,
                        expectedAlpha: data.expectedAlpha  // Preserve for positioning
                    },
                    expanded: nodeData.expanded === true  // Explicit boolean
                });
            }
        });
        
        console.log(`Backing up ${customGraphsBackup.length} custom graphs`);
        
        // Rebuild universe with current graphs (if any)
        if (universeState.currentGraphs && universeState.currentGraphs.length > 0) {
            // Re-populate with standard graphs (this also recreates axes)
            populateUniverse(universeState.currentGraphs);
        } else {
            // No standard graphs - just clear and recreate axes
            clearUniverse();
            createUniverseAxes();
        }
        
        // Re-add custom graphs with NEW positions based on new axes
        if (customGraphsBackup.length > 0) {
            for (const customGraph of customGraphsBackup) {
                console.log(`  Restoring: "${customGraph.data.name}", family="${customGraph.data.family}", expanded=${customGraph.expanded}`);
                addCustomGraph(customGraph.data, customGraph.expanded);
            }
            console.log(`Restored ${customGraphsBackup.length} custom graphs with new axis positions`);
            
            // IMPORTANT: Recreate axes to encompass all the newly added graphs
            console.log('Recreating axes to encompass restored graphs...');
            createUniverseAxes();
        }
        
        // Restore camera position
        universeState.camera.position.copy(camPos);
        if (universeState.controls?.target) {
            universeState.controls.target.copy(camTarget);
        }
        
    } catch (error) {
        console.error('Error applying axis configuration:', error);
    }
}

/**
 * Set galaxy axes programmatically
 * @param {string} xAxis - Metric key for X axis
 * @param {string} yAxis - Metric key for Y axis
 * @param {string} zAxis - Metric key for Z axis
 */
export function setGalaxyAxes(xAxis, yAxis, zAxis) {
    if (GALAXY_AXIS_OPTIONS[xAxis]) CONFIG.galaxyAxes.x = xAxis;
    if (GALAXY_AXIS_OPTIONS[yAxis]) CONFIG.galaxyAxes.y = yAxis;
    if (GALAXY_AXIS_OPTIONS[zAxis]) CONFIG.galaxyAxes.z = zAxis;
    
    // Update dropdowns if they exist
    const xSel = document.getElementById('axis-x-select');
    const ySel = document.getElementById('axis-y-select');
    const zSel = document.getElementById('axis-z-select');
    if (xSel) xSel.value = CONFIG.galaxyAxes.x;
    if (ySel) ySel.value = CONFIG.galaxyAxes.y;
    if (zSel) zSel.value = CONFIG.galaxyAxes.z;
    
    applyAxisConfiguration();
}

/**
 * Toggle log scale for universe positioning
 * Log scale helps spread out clustered data points
 * @param {boolean} enabled - Whether to use log scale
 */
export function setLogScale(enabled) {
    CONFIG.useLogScale = enabled;
    
    // Update checkbox if it exists
    const checkbox = document.getElementById('log-scale-checkbox');
    if (checkbox) checkbox.checked = enabled;
    
    console.log(`Log scale ${enabled ? 'enabled' : 'disabled'}`);
    
    // Rebuild universe with new scale
    applyAxisConfiguration();
}

/**
 * Get current log scale setting
 */
export function getLogScale() {
    return CONFIG.useLogScale;
}

function createInfoPanel() {
    const panel = document.createElement('div');
    panel.id = 'universe-info-panel';
    panel.style.display = 'none';
    panel.innerHTML = `
        <div class="info-header">
            <span id="info-galaxy-name">Galaxy Name</span>
            <button id="info-close-btn">×</button>
        </div>
        <div class="info-body">
            <div id="info-description">Description</div>
            <div id="info-metrics">Metrics</div>
            <div id="info-stats">Graphs: 0</div>
            <div class="info-actions">
                <button id="info-load-build-btn" class="load-build-btn">📐 Load in Build</button>
                <button id="info-toggle-expand-btn" class="toggle-expand-btn" style="display: none;">🔍 Expand View</button>
            </div>
        </div>
    `;
    universeState.container.appendChild(panel);
    universeState.infoPanelElement = panel;
    
    // Set up close button event listener right after creating the panel
    const closeBtn = panel.querySelector('#info-close-btn');
    if (closeBtn) {
        closeBtn.addEventListener('click', () => {
            panel.style.display = 'none';
        });
    }
    
    // Set up Load in Build button
    const loadBuildBtn = panel.querySelector('#info-load-build-btn');
    if (loadBuildBtn) {
        loadBuildBtn.addEventListener('click', () => {
            if (universeState.selectedNode && universeState.onLoadInBuild) {
                const nodeData = universeState.graphNodes.get(universeState.selectedNode.userData.graphId);
                if (nodeData && nodeData.data) {
                    universeState.onLoadInBuild(nodeData.data);
                }
            }
        });
    }
    
    // Set up Expand/Collapse toggle button
    const toggleExpandBtn = panel.querySelector('#info-toggle-expand-btn');
    if (toggleExpandBtn) {
        toggleExpandBtn.addEventListener('click', () => {
            if (universeState.selectedNode) {
                const graphId = universeState.selectedNode.userData.graphId;
                const success = toggleGraphExpanded(graphId);
                if (success) {
                    // Update button text
                    const nodeData = universeState.graphNodes.get(graphId);
                    if (nodeData) {
                        toggleExpandBtn.textContent = nodeData.expanded ? '📦 Collapse View' : '🔍 Expand View';
                        // Update selected node reference
                        universeState.selectedNode = nodeData.mesh;
                    }
                }
            }
        });
    }
    
    // Make draggable by header
    makePanelDraggable(panel, panel.querySelector('.info-header'));
}

// =====================================================
// EVENT HANDLING
// =====================================================

function setupEventListeners() {
    // Keyboard
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('keyup', onKeyUp);
    
    // Mouse for node selection (when pointer not locked)
    universeState.renderer.domElement.addEventListener('click', onClick);
    universeState.renderer.domElement.addEventListener('dblclick', onDoubleClick);
    universeState.renderer.domElement.addEventListener('mousemove', onMouseMove);
    
    // Rubber band zoom (right-click drag)
    universeState.renderer.domElement.addEventListener('mousedown', onRubberBandStart);
    // Use document-level listeners for move and up to handle mouse leaving canvas
    document.addEventListener('mousemove', onRubberBandMove);
    document.addEventListener('mouseup', onRubberBandEnd);
    universeState.renderer.domElement.addEventListener('contextmenu', (e) => e.preventDefault());
    
    // Safety: cancel rubber band if mouse leaves window entirely
    document.addEventListener('mouseleave', onRubberBandCancel);
    
    // Window resize
    window.addEventListener('resize', onWindowResize);
    
    // Create rubber band overlay element
    createRubberBandOverlay();
}

/**
 * Create the rubber band selection overlay
 */
function createRubberBandOverlay() {
    const overlay = document.createElement('div');
    overlay.id = 'rubber-band-overlay';
    overlay.style.cssText = `
        position: absolute;
        border: 2px dashed #00ffff;
        background: rgba(0, 255, 255, 0.1);
        pointer-events: none;
        display: none;
        z-index: 1000;
        box-shadow: 0 0 10px rgba(0, 255, 255, 0.5);
    `;
    universeState.container.appendChild(overlay);
    universeState.rubberBandOverlay = overlay;
    
    // Initialize rubber band state
    universeState.rubberBand = {
        active: false,
        startX: 0,
        startY: 0,
        endX: 0,
        endY: 0
    };
}

/**
 * Start rubber band selection (right-click + drag)
 */
function onRubberBandStart(event) {
    // Only right mouse button (button 2)
    if (event.button !== 2) return;
    if (!universeState.active) return;
    
    event.preventDefault();
    
    const rect = universeState.renderer.domElement.getBoundingClientRect();
    
    universeState.rubberBand.active = true;
    universeState.rubberBand.startX = event.clientX - rect.left;
    universeState.rubberBand.startY = event.clientY - rect.top;
    universeState.rubberBand.endX = universeState.rubberBand.startX;
    universeState.rubberBand.endY = universeState.rubberBand.startY;
    
    // Disable OrbitControls while rubber-banding
    if (universeState.controls) {
        universeState.controls.enabled = false;
    }
    
    // Show overlay
    if (universeState.rubberBandOverlay) {
        universeState.rubberBandOverlay.style.display = 'block';
        updateRubberBandOverlay();
    }
}

/**
 * Update rubber band selection during drag
 */
function onRubberBandMove(event) {
    if (!universeState.rubberBand?.active) return;
    
    const rect = universeState.renderer.domElement.getBoundingClientRect();
    universeState.rubberBand.endX = event.clientX - rect.left;
    universeState.rubberBand.endY = event.clientY - rect.top;
    
    updateRubberBandOverlay();
}

/**
 * Update the visual rubber band overlay
 */
function updateRubberBandOverlay() {
    const rb = universeState.rubberBand;
    const overlay = universeState.rubberBandOverlay;
    if (!overlay) return;
    
    const left = Math.min(rb.startX, rb.endX);
    const top = Math.min(rb.startY, rb.endY);
    const width = Math.abs(rb.endX - rb.startX);
    const height = Math.abs(rb.endY - rb.startY);
    
    overlay.style.left = left + 'px';
    overlay.style.top = top + 'px';
    overlay.style.width = width + 'px';
    overlay.style.height = height + 'px';
}

/**
 * End rubber band selection and zoom to area
 */
function onRubberBandEnd(event) {
    // Always re-enable controls first to prevent freezing
    if (universeState.controls) {
        universeState.controls.enabled = true;
    }
    
    if (!universeState.rubberBand?.active) return;
    
    universeState.rubberBand.active = false;
    
    // Hide overlay
    if (universeState.rubberBandOverlay) {
        universeState.rubberBandOverlay.style.display = 'none';
    }
    
    const rb = universeState.rubberBand;
    const width = Math.abs(rb.endX - rb.startX);
    const height = Math.abs(rb.endY - rb.startY);
    
    // Only zoom if selection is large enough (avoid accidental clicks)
    if (width < 20 || height < 20) {
        console.log('Rubber band too small, ignoring');
        return;
    }
    
    // Perform the zoom
    zoomToRubberBand(rb.startX, rb.startY, rb.endX, rb.endY);
}

/**
 * Cancel rubber band selection (e.g., mouse left window)
 */
function onRubberBandCancel(event) {
    if (!universeState.rubberBand?.active) return;
    
    universeState.rubberBand.active = false;
    
    // Hide overlay
    if (universeState.rubberBandOverlay) {
        universeState.rubberBandOverlay.style.display = 'none';
    }
    
    // Re-enable controls
    if (universeState.controls) {
        universeState.controls.enabled = true;
    }
    
    console.log('Rubber band cancelled');
}

/**
 * Zoom camera to fit the rubber band selection area
 */
function zoomToRubberBand(startX, startY, endX, endY) {
    const camera = universeState.camera;
    const renderer = universeState.renderer;
    
    // Get normalized device coordinates for the selection corners
    const rect = renderer.domElement.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;
    
    // Calculate center of selection in NDC
    const centerX = ((startX + endX) / 2 / width) * 2 - 1;
    const centerY = -((startY + endY) / 2 / height) * 2 + 1;
    
    // Calculate selection size ratio
    const selectionWidth = Math.abs(endX - startX) / width;
    const selectionHeight = Math.abs(endY - startY) / height;
    const selectionSize = Math.max(selectionWidth, selectionHeight);
    
    // Create ray from camera through selection center
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(new THREE.Vector2(centerX, centerY), camera);
    
    // Find objects in the selection area
    const objectsInSelection = [];
    
    universeState.graphNodes.forEach((nodeData, graphId) => {
        if (!nodeData.mesh) return;
        
        const worldPos = new THREE.Vector3();
        nodeData.mesh.getWorldPosition(worldPos);
        
        // Project to screen space
        const screenPos = worldPos.clone().project(camera);
        const screenX = (screenPos.x + 1) / 2 * width;
        const screenY = (-screenPos.y + 1) / 2 * height;
        
        // Check if within selection
        const minX = Math.min(startX, endX);
        const maxX = Math.max(startX, endX);
        const minY = Math.min(startY, endY);
        const maxY = Math.max(startY, endY);
        
        if (screenX >= minX && screenX <= maxX && screenY >= minY && screenY <= maxY) {
            objectsInSelection.push({ nodeData, worldPos });
        }
    });
    
    // Also check galaxy centers
    universeState.galaxies.forEach((galaxy, name) => {
        const worldPos = galaxy.center.clone();
        const screenPos = worldPos.clone().project(camera);
        const screenX = (screenPos.x + 1) / 2 * width;
        const screenY = (-screenPos.y + 1) / 2 * height;
        
        const minX = Math.min(startX, endX);
        const maxX = Math.max(startX, endX);
        const minY = Math.min(startY, endY);
        const maxY = Math.max(startY, endY);
        
        if (screenX >= minX && screenX <= maxX && screenY >= minY && screenY <= maxY) {
            objectsInSelection.push({ nodeData: null, worldPos, isGalaxy: true, name });
        }
    });
    
    if (objectsInSelection.length === 0) {
        // No objects in selection - just zoom forward along the ray
        console.log('No objects in selection, zooming along ray');
        const targetPoint = raycaster.ray.at(500, new THREE.Vector3());
        animateCameraTo(targetPoint, camera.position.distanceTo(targetPoint) * 0.3);
        return;
    }
    
    // Calculate bounding box of selected objects
    let minBoundX = Infinity, maxBoundX = -Infinity;
    let minBoundY = Infinity, maxBoundY = -Infinity;
    let minBoundZ = Infinity, maxBoundZ = -Infinity;
    
    for (const obj of objectsInSelection) {
        const p = obj.worldPos;
        minBoundX = Math.min(minBoundX, p.x);
        maxBoundX = Math.max(maxBoundX, p.x);
        minBoundY = Math.min(minBoundY, p.y);
        maxBoundY = Math.max(maxBoundY, p.y);
        minBoundZ = Math.min(minBoundZ, p.z);
        maxBoundZ = Math.max(maxBoundZ, p.z);
    }
    
    // Calculate center and size
    const targetCenter = new THREE.Vector3(
        (minBoundX + maxBoundX) / 2,
        (minBoundY + maxBoundY) / 2,
        (minBoundZ + maxBoundZ) / 2
    );
    
    const boundSize = Math.max(
        maxBoundX - minBoundX,
        maxBoundY - minBoundY,
        maxBoundZ - minBoundZ,
        50  // Minimum size
    );
    
    // Calculate camera distance to fit selection
    const fov = camera.fov * (Math.PI / 180);
    const distance = (boundSize / 2) / Math.tan(fov / 2) * 1.5;
    
    console.log(`Zooming to ${objectsInSelection.length} objects, center: (${targetCenter.x.toFixed(0)}, ${targetCenter.y.toFixed(0)}, ${targetCenter.z.toFixed(0)}), distance: ${distance.toFixed(0)}`);
    
    animateCameraTo(targetCenter, distance);
}

/**
 * Animate camera to target with specified distance
 */
function animateCameraTo(targetCenter, distance) {
    const camera = universeState.camera;
    const controls = universeState.controls;
    
    // Calculate new camera position (keep current viewing angle)
    const currentDirection = new THREE.Vector3()
        .subVectors(camera.position, controls.target)
        .normalize();
    
    const newCameraPos = new THREE.Vector3()
        .copy(targetCenter)
        .add(currentDirection.multiplyScalar(distance));
    
    // Animate
    const startPos = camera.position.clone();
    const startTarget = controls.target.clone();
    const duration = 800;
    const startTime = performance.now();
    
    function animate() {
        const elapsed = performance.now() - startTime;
        const t = Math.min(elapsed / duration, 1);
        
        // Ease out cubic
        const easeT = 1 - Math.pow(1 - t, 3);
        
        camera.position.lerpVectors(startPos, newCameraPos, easeT);
        controls.target.lerpVectors(startTarget, targetCenter, easeT);
        controls.update();
        
        if (t < 1) {
            requestAnimationFrame(animate);
        }
    }
    
    animate();
}

function onKeyDown(event) {
    if (!universeState.active) return;
    
    switch (event.code) {
        case 'ArrowUp': case 'KeyW': universeState.moveForward = true; break;
        case 'ArrowLeft': case 'KeyA': universeState.moveLeft = true; break;
        case 'ArrowDown': case 'KeyS': universeState.moveBackward = true; break;
        case 'ArrowRight': case 'KeyD': universeState.moveRight = true; break;
        case 'Space': universeState.moveUp = true; event.preventDefault(); break;
        case 'ShiftLeft': case 'ShiftRight': universeState.moveDown = true; break;
        // Fit all galaxies in view with 'F' key
        case 'KeyF':
            fitAllInView();
            event.preventDefault();
            break;
        // Set pivot to selected node with 'P' key
        case 'KeyP':
            if (universeState.selectedNode) {
                const worldPos = new THREE.Vector3();
                universeState.selectedNode.getWorldPosition(worldPos);
                setRotationPivot(worldPos);
            } else {
                // If nothing selected, reset pivot to origin
                resetRotationPivot();
            }
            event.preventDefault();
            break;
        // Toggle auto-rotate with 'R' key
        case 'KeyR':
            if (universeState.controls) {
                universeState.controls.autoRotate = !universeState.controls.autoRotate;
                console.log(`Auto-rotate: ${universeState.controls.autoRotate ? 'ON' : 'OFF'}`);
            }
            event.preventDefault();
            break;
        // Reset view to origin with 'O' key
        case 'KeyO':
            resetRotationPivot();
            // Also reset camera to default position
            const defaultDist = 300;
            universeState.camera.position.set(defaultDist * 0.5, defaultDist * 0.3, defaultDist);
            universeState.controls.update();
            console.log('View reset to origin');
            event.preventDefault();
            break;
        // Escape to exit universe or deselect
        case 'Escape':
            if (universeState.selectedNode) {
                deselectNode();
            }
            event.preventDefault();
            break;
        // Expand all graphs with 'E' key
        case 'KeyE':
            expandCollapseAll(true, '__all__');
            event.preventDefault();
            break;
        // Collapse all graphs with 'C' key  
        case 'KeyC':
            expandCollapseAll(false, '__all__');
            event.preventDefault();
            break;
        // Toggle analytic highlight mode with 'H' key
        case 'KeyH':
            toggleAnalyticHighlightMode();
            event.preventDefault();
            break;
        // Toggle analytic manifold visualization with 'V' key
        case 'KeyV':
            toggleAnalyticManifold();
            event.preventDefault();
            break;
    }
}

/**
 * Fit all galaxies in the camera view
 */
function fitAllInView() {
    // Check if there's anything to fit
    const hasGalaxies = universeState.galaxies.size > 0;
    const hasGraphNodes = universeState.graphNodes.size > 0;
    
    if (!hasGalaxies && !hasGraphNodes) {
        console.log('fitAllInView: Nothing to fit');
        return;
    }
    
    // Calculate bounding box of all objects
    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;
    let minZ = Infinity, maxZ = -Infinity;
    
    // Include galaxies
    for (const [name, galaxy] of universeState.galaxies) {
        const center = galaxy.center;
        minX = Math.min(minX, center.x);
        maxX = Math.max(maxX, center.x);
        minY = Math.min(minY, center.y);
        maxY = Math.max(maxY, center.y);
        minZ = Math.min(minZ, center.z);
        maxZ = Math.max(maxZ, center.z);
    }
    
    // Include individual graph nodes (custom graphs)
    universeState.graphNodes.forEach((nodeData, graphId) => {
        if (nodeData.mesh) {
            const pos = nodeData.mesh.position;
            minX = Math.min(minX, pos.x);
            maxX = Math.max(maxX, pos.x);
            minY = Math.min(minY, pos.y);
            maxY = Math.max(maxY, pos.y);
            minZ = Math.min(minZ, pos.z);
            maxZ = Math.max(maxZ, pos.z);
        }
    });
    
    // Handle case where bounds are still infinite (no valid positions)
    if (!isFinite(minX) || !isFinite(maxX)) {
        console.log('fitAllInView: No valid positions found');
        return;
    }
    
    // Add padding
    const padding = 150;
    minX -= padding; maxX += padding;
    minY -= padding; maxY += padding;
    minZ -= padding; maxZ += padding;
    
    // Calculate center and size
    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;
    const centerZ = (minZ + maxZ) / 2;
    
    const sizeX = maxX - minX;
    const sizeY = maxY - minY;
    const sizeZ = maxZ - minZ;
    const maxSize = Math.max(sizeX, sizeY, sizeZ);
    
    // Calculate camera distance needed to see everything
    const fov = universeState.camera.fov * (Math.PI / 180);
    const distance = (maxSize / 2) / Math.tan(fov / 2) * 1.2;
    
    // Position camera
    const newCameraPos = new THREE.Vector3(
        centerX + distance * 0.5,
        centerY + distance * 0.3,
        centerZ + distance
    );
    
    // Animate camera movement
    const startPos = universeState.camera.position.clone();
    const startTarget = universeState.controls.target.clone();
    const endTarget = new THREE.Vector3(centerX, centerY, centerZ);
    
    const duration = 1000; // ms
    const startTime = Date.now();
    
    function animateCamera() {
        const elapsed = Date.now() - startTime;
        const t = Math.min(elapsed / duration, 1);
        // Ease out cubic
        const easeT = 1 - Math.pow(1 - t, 3);
        
        universeState.camera.position.lerpVectors(startPos, newCameraPos, easeT);
        universeState.controls.target.lerpVectors(startTarget, endTarget, easeT);
        universeState.controls.update();
        
        if (t < 1) {
            requestAnimationFrame(animateCamera);
        }
    }
    
    animateCamera();
    console.log(`Fit all: ${universeState.galaxies.size} galaxies, ${universeState.graphNodes.size} nodes, distance=${distance.toFixed(0)}`);
}

/**
 * Deselect current node
 */
function deselectNode() {
    if (universeState.selectedNode) {
        // Reset material if it was changed
        if (universeState.selectedNode.originalColor) {
            universeState.selectedNode.material.color.setHex(universeState.selectedNode.originalColor);
        }
        universeState.selectedNode = null;
        
        // Hide info panel
        if (universeState.infoPanelElement) {
            universeState.infoPanelElement.style.display = 'none';
        }
    }
}

function onKeyUp(event) {
    if (!universeState.active) return;
    
    switch (event.code) {
        case 'ArrowUp': case 'KeyW': universeState.moveForward = false; break;
        case 'ArrowLeft': case 'KeyA': universeState.moveLeft = false; break;
        case 'ArrowDown': case 'KeyS': universeState.moveBackward = false; break;
        case 'ArrowRight': case 'KeyD': universeState.moveRight = false; break;
        case 'Space': universeState.moveUp = false; break;
        case 'ShiftLeft': case 'ShiftRight': universeState.moveDown = false; break;
    }
}

function onClick(event) {
    updateMousePosition(event);
    const intersected = getIntersectedNode();
    
    if (intersected) {
        selectNode(intersected);
    }
}

function onDoubleClick(event) {
    updateMousePosition(event);
    const intersected = getIntersectedNode();
    
    if (intersected) {
        // Set rotation pivot to this node
        const worldPos = new THREE.Vector3();
        intersected.getWorldPosition(worldPos);
        setRotationPivot(worldPos);
        
        // Also trigger graph select callback if set
        if (universeState.onGraphSelect) {
            const nodeData = universeState.graphNodes.get(intersected.userData.graphId);
            if (nodeData) {
                universeState.onGraphSelect(nodeData.data);
            }
        }
    } else {
        // Double-click on empty space - reset pivot to origin
        resetRotationPivot();
    }
}

function onMouseMove(event) {
    updateMousePosition(event);
    const intersected = getIntersectedNode();
    
    if (intersected !== universeState.hoveredNode) {
        // Unhighlight previous
        if (universeState.hoveredNode) {
            unhighlightNode(universeState.hoveredNode);
        }
        
        // Highlight new
        if (intersected) {
            highlightNode(intersected);
            if (universeState.onGraphHover) {
                const nodeData = universeState.graphNodes.get(intersected.userData.graphId);
                universeState.onGraphHover(nodeData?.data);
            }
        } else {
            if (universeState.onGraphHover) {
                universeState.onGraphHover(null);
            }
        }
        
        universeState.hoveredNode = intersected;
    }
}

function updateMousePosition(event) {
    const rect = universeState.renderer.domElement.getBoundingClientRect();
    universeState.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    universeState.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
}

function onWindowResize() {
    if (!universeState.active) return;
    
    universeState.camera.aspect = universeState.container.clientWidth / universeState.container.clientHeight;
    universeState.camera.updateProjectionMatrix();
    universeState.renderer.setSize(
        universeState.container.clientWidth,
        universeState.container.clientHeight
    );
}

// =====================================================
// NODE INTERACTION
// =====================================================

function getIntersectedNode() {
    universeState.raycaster.setFromCamera(universeState.mouse, universeState.camera);
    
    const nodeMeshes = [];
    universeState.graphNodes.forEach(node => {
        if (node.mesh) nodeMeshes.push(node.mesh);
    });
    
    // Check children recursively (to find the hit mesh inside the group)
    const intersects = universeState.raycaster.intersectObjects(nodeMeshes, true);
    
    if (intersects.length > 0) {
        // Find the parent group (which has the graphId)
        let obj = intersects[0].object;
        while (obj && !obj.userData.graphId) {
            obj = obj.parent;
        }
        return obj;
    }
    return null;
}

function highlightNode(mesh) {
    // mesh is now a Group with .material pointing to wireframe material
    const mat = mesh.material;
    if (!mat) return;
    
    if (mesh.userData.originalColor === undefined) {
        mesh.userData.originalColor = mat.color.getHex();
    }
    mat.color.setHex(CONFIG.hoverHighlightColor);
    mesh.scale.setScalar(1.3);
}

function unhighlightNode(mesh) {
    const mat = mesh.material;
    if (!mat) return;
    
    if (mesh.userData.originalColor !== undefined) {
        mat.color.setHex(mesh.userData.originalColor);
    }
    if (mesh !== universeState.selectedNode) {
        mesh.scale.setScalar(1.0);
    }
}

function selectNode(mesh) {
    // Deselect previous
    if (universeState.selectedNode && universeState.selectedNode !== mesh) {
        universeState.selectedNode.scale.setScalar(1.0);
        // Restore original color
        const prevMat = universeState.selectedNode.material;
        if (prevMat && universeState.selectedNode.userData.originalColor !== undefined) {
            prevMat.color.setHex(universeState.selectedNode.userData.originalColor);
        }
    }
    
    universeState.selectedNode = mesh;
    mesh.scale.setScalar(1.5);
    
    const mat = mesh.material;
    if (mat) {
        if (mesh.userData.originalColor === undefined) {
            mesh.userData.originalColor = mat.color.getHex();
        }
        mat.color.setHex(CONFIG.selectedColor);
    }
    
    // Show info
    const nodeData = universeState.graphNodes.get(mesh.userData.graphId);
    if (nodeData) {
        showNodeInfo(nodeData);
    }
}

function showNodeInfo(nodeData) {
    const graph = nodeData.data;
    const galaxy = nodeData.galaxy;
    const metrics = nodeData.metrics;  // Include metrics
    const isCustom = nodeData.mesh?.userData?.isCustom || false;
    const isExpanded = nodeData.expanded || false;
    
    const nameEl = document.getElementById('info-galaxy-name');
    const descEl = document.getElementById('info-description');
    const metricsEl = document.getElementById('info-metrics');
    const statsEl = document.getElementById('info-stats');
    const toggleExpandBtn = document.getElementById('info-toggle-expand-btn');
    
    if (nameEl) nameEl.textContent = graph.name || 'Unknown Graph';
    if (descEl) descEl.innerHTML = `
        <strong>Family:</strong> ${graph.family || 'Unknown'}<br>
        <strong>Vertices:</strong> ${graph.n}<br>
        <strong>Edges:</strong> ${graph.edgeCount || graph.edges?.length || 0}
        ${isCustom ? '<br><span style="color: #00ffff;">★ Custom Graph</span>' : ''}
    `;
    
    // Show spectral metrics
    if (metricsEl && metrics) {
        metricsEl.innerHTML = `
            <strong>Spectral Metrics:</strong><br>
            <span class="metric">ρ (skew-sym) = ${metrics.spectralRadius.toFixed(4)}</span><br>
            <span class="metric">Energy = ${metrics.energy?.toFixed(2) || 'N/A'}</span><br>
            <span class="metric">Density = ${(metrics.density * 100).toFixed(1)}%</span>
        `;
        metricsEl.style.display = 'block';
    } else if (metricsEl) {
        metricsEl.style.display = 'none';
    }
    
    // Compute and display BOTH symmetric and skew-symmetric eigenvalues
    if (statsEl) {
        let symEigenStr = '—';
        let skewEigenStr = '—';
        const n = graph.n || 0;
        const edges = graph.edges || [];
        
        if (edges.length > 0 && n > 0 && n <= 200) {
            try {
                // Build SYMMETRIC adjacency matrix
                const symMatrix = Array(n).fill(null).map(() => Array(n).fill(0));
                for (const [i, j] of edges) {
                    if (i < n && j < n) {
                        symMatrix[i][j] = 1;
                        symMatrix[j][i] = 1;  // Symmetric!
                    }
                }
                
                // Compute symmetric eigenvalues
                const symEigs = computeEigenvaluesNumerical(symMatrix);
                if (symEigs && symEigs.length > 0) {
                    const symValues = symEigs
                        .map(e => typeof e === 'object' ? (e.value || e.real || 0) : e)
                        .filter(v => isFinite(v))
                        .sort((a, b) => Math.abs(b) - Math.abs(a));
                    
                    const symDisplayed = symValues.slice(0, 4).map(v => v.toFixed(3));
                    symEigenStr = symDisplayed.join(', ');
                    if (symValues.length > 4) {
                        symEigenStr += ` ...`;
                    }
                }
                
                // Build SKEW-SYMMETRIC adjacency matrix
                const skewMatrix = Array(n).fill(null).map(() => Array(n).fill(0));
                for (const [i, j] of edges) {
                    if (i < n && j < n) {
                        skewMatrix[i][j] = 1;
                        skewMatrix[j][i] = -1;  // Skew-symmetric!
                    }
                }
                
                // Compute skew-symmetric eigenvalues
                const skewEigs = computeSkewSymmetricEigenvalues(skewMatrix);
                if (skewEigs && skewEigs.length > 0) {
                    const skewValues = skewEigs
                        .map(e => Math.abs(e.imag || e.value || e))
                        .filter(v => isFinite(v))
                        .sort((a, b) => b - a);
                    
                    const skewDisplayed = skewValues.slice(0, 4).map(v => v.toFixed(3));
                    skewEigenStr = skewDisplayed.join(', ');
                    if (skewValues.length > 4) {
                        skewEigenStr += ` ...`;
                    }
                }
            } catch (err) {
                console.warn('Failed to compute eigenvalues for info panel:', err);
            }
        }
        
        statsEl.innerHTML = `
            <strong>Symmetric λ:</strong> <span class="eigenvalues">${symEigenStr}</span><br>
            <strong>Skew-Sym |λ|:</strong> <span class="eigenvalues">${skewEigenStr}</span>
        `;
    }
    
    // Show/hide and configure expand button
    // Show for all graphs that have edge data (can be expanded)
    if (toggleExpandBtn) {
        const hasEdgeData = graph.edges && graph.edges.length > 0;
        if (hasEdgeData) {
            toggleExpandBtn.style.display = 'block';
            toggleExpandBtn.textContent = isExpanded ? '📦 Collapse View' : '🔍 Expand View';
        } else {
            toggleExpandBtn.style.display = 'none';
        }
    }
    
    universeState.infoPanelElement.style.display = 'block';
}

function formatEigenvaluesShort(eigenvalues) {
    if (!eigenvalues || eigenvalues.length === 0) return '—';
    
    return eigenvalues.slice(0, 4).map(e => {
        if (typeof e === 'object') {
            // Try various property names for the formula/form
            if (e.form && !e.form.includes('undefined')) return e.form;
            if (e.formula && !e.formula.includes('undefined')) return e.formula;
            if (e.value !== undefined && !isNaN(e.value)) return e.value.toFixed(3);
            if (e.numeric !== undefined && !isNaN(e.numeric)) return e.numeric.toFixed(3);
            // Fallback: stringify the object
            return JSON.stringify(e).slice(0, 20);
        }
        if (typeof e === 'number') return e.toFixed(3);
        return String(e);
    }).join(', ') + (eigenvalues.length > 4 ? ' ...' : '');
}

// =====================================================
// GALAXY GENERATION
// =====================================================

/**
 * Populate the universe with graphs from the library
 * @param {Array} graphs - Array of graph objects from the library
 */
export function populateUniverse(graphs) {
    // Clear existing
    clearUniverse();
    
    // DEBUG: Log input graph data
    console.log(`\n========== POPULATE UNIVERSE ==========`);
    console.log(`Input: ${graphs.length} graphs`);
    
    // Sample a few graphs to see their data
    const sampleSize = Math.min(5, graphs.length);
    for (let i = 0; i < sampleSize; i++) {
        const g = graphs[i];
        console.log(`  [${i}] "${g.name || g.family}": n=${g.n}, edgeCount=${g.edgeCount}, edges.length=${g.edges?.length}, eigenvalues=${g.eigenvalues?.length || 0}`);
    }
    
    // Store graphs for re-layout when toggling modes
    universeState.currentGraphs = graphs;
    
    // Group graphs by family
    const familyGroups = groupGraphsByFamily(graphs);
    
    // Calculate galaxy metrics and positions based on mathematical properties
    const galaxyData = calculateGalaxyData(familyGroups);
    
    // Create each galaxy
    for (const data of galaxyData) {
        const familyConfig = GALAXY_FAMILIES[data.familyName] || GALAXY_FAMILIES['Unknown'];
        createGalaxy(data.familyName, data.graphs, data.position, familyConfig, data.metrics);
    }
    
    // Create universe axis indicators
    createUniverseAxes();
    
    // Update galaxy dropdown for expand/collapse controls
    updateGalaxyDropdown();
    
    console.log(`Universe populated with ${graphs.length} graphs in ${familyGroups.size} galaxies`);
    console.log(`Galaxy positioning: Scaling Exponent (X) × Rationality (Y) × Avg ρ (Z)`);
    console.log(`Node positioning: Spectral (based on graph metrics)`);
    console.log(`========================================\n`);
}

/**
 * Calculate positions for all galaxies based on their mathematical properties
 */
function calculateGalaxyData(familyGroups) {
    const galaxyData = [];
    const allMetrics = [];
    
    // First pass: calculate all metrics
    for (const [familyName, graphs] of familyGroups) {
        const metrics = calculateGalaxyMetrics(familyName, graphs);
        allMetrics.push(metrics);
        galaxyData.push({
            familyName,
            graphs,
            metrics,
            position: null  // Will be set after global stats
        });
    }
    
    // Calculate global statistics for normalization
    const globalStats = calculateGlobalMetricStats(allMetrics);
    universeState.globalMetricStats = globalStats;  // Store for later use
    
    // Second pass: calculate positions using global stats
    for (const data of galaxyData) {
        data.position = galaxyMetricsToPosition(data.metrics, globalStats);
        
        const m = data.metrics;
        console.log(`Galaxy "${data.familyName}" (${m.graphCount} graphs): α=${m.alpha.toFixed(2)}, ` +
                    `rat=${(m.rationality*100).toFixed(0)}%, ` +
                    `ρ̄=${m.avgSpectralRadius.toFixed(2)}, ` +
                    `gap=${m.avgSpectralGap.toFixed(2)}, ` +
                    `E=${m.avgEnergy.toFixed(1)}, ` +
                    `spread=${m.avgSpectralSpread.toFixed(2)}`);
    }
    
    return galaxyData;
}

/**
 * Create axis indicators for the universe coordinate system
 * v35: Shows actual metric values on tick marks instead of just "Low/High"
 * v35.1: Fixed axis bounds to extend to all galaxies
 * v35.2: Fixed label duplication by properly removing old axes first
 */
function createUniverseAxes() {
    console.log('createUniverseAxes v35.2 - Fixed label duplication');
    
    // CRITICAL: Remove old axes before creating new ones to prevent label duplication
    if (universeState.axisHelpers) {
        universeState.scene.remove(universeState.axisHelpers);
        // Dispose of all children to free memory
        universeState.axisHelpers.traverse((child) => {
            if (child.geometry) child.geometry.dispose();
            if (child.material) {
                if (Array.isArray(child.material)) {
                    child.material.forEach(m => m.dispose());
                } else {
                    child.material.dispose();
                }
            }
        });
        universeState.axisHelpers = null;
    }
    
    const axisGroup = new THREE.Group();
    axisGroup.name = 'universeAxes';
    
    const axes = CONFIG.galaxyAxes;
    const xOption = GALAXY_AXIS_OPTIONS[axes.x];
    const yOption = GALAXY_AXIS_OPTIONS[axes.y];
    const zOption = GALAXY_AXIS_OPTIONS[axes.z];
    
    // Get actual value ranges from global stats or use defaults
    const globalStats = universeState.globalMetricStats || {};
    
    // Calculate actual bounds from all graphs in the universe
    // Start with no assumption - will expand based on data
    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;
    let minZ = Infinity, maxZ = -Infinity;
    
    console.log(`createUniverseAxes: Starting bounds calculation, ${universeState.galaxies.size} galaxies, ${universeState.graphNodes.size} graphNodes`);
    
    // Include galaxies
    for (const [name, galaxy] of universeState.galaxies) {
        const center = galaxy.center;
        minX = Math.min(minX, center.x);
        maxX = Math.max(maxX, center.x);
        minY = Math.min(minY, center.y);
        maxY = Math.max(maxY, center.y);
        minZ = Math.min(minZ, center.z);
        maxZ = Math.max(maxZ, center.z);
        console.log(`  Galaxy "${name}": center=(${center.x.toFixed(1)}, ${center.y.toFixed(1)}, ${center.z.toFixed(1)})`);
    }
    
    // Include individual graph nodes
    // For graphs in galaxies: world position = local position + galaxy center
    // For custom graphs (added directly to scene): mesh.position IS world position
    universeState.graphNodes.forEach((nodeData, graphId) => {
        if (nodeData.mesh) {
            let worldX, worldY, worldZ;
            
            // Check if this is a custom graph (added directly to scene) or a galaxy graph
            if (nodeData.galaxy && nodeData.galaxy !== 'Custom' && universeState.galaxies.has(nodeData.galaxy)) {
                // Galaxy graph: add galaxy center offset
                const galaxy = universeState.galaxies.get(nodeData.galaxy);
                const localPos = nodeData.mesh.position;
                worldX = localPos.x + galaxy.center.x;
                worldY = localPos.y + galaxy.center.y;
                worldZ = localPos.z + galaxy.center.z;
            } else {
                // Custom graph: mesh position IS world position
                worldX = nodeData.mesh.position.x;
                worldY = nodeData.mesh.position.y;
                worldZ = nodeData.mesh.position.z;
            }
            
            minX = Math.min(minX, worldX);
            maxX = Math.max(maxX, worldX);
            minY = Math.min(minY, worldY);
            maxY = Math.max(maxY, worldY);
            minZ = Math.min(minZ, worldZ);
            maxZ = Math.max(maxZ, worldZ);
        }
    });
    
    console.log(`  After graphNodes (${universeState.graphNodes.size} nodes): X=[${minX.toFixed(1)}, ${maxX.toFixed(1)}], Y=[${minY.toFixed(1)}, ${maxY.toFixed(1)}]`);
    
    // If no data found, use defaults
    if (!isFinite(minX)) { minX = -100; maxX = 100; }
    if (!isFinite(minY)) { minY = -100; maxY = 100; }
    if (!isFinite(minZ)) { minZ = -100; maxZ = 100; }
    
    // Add generous padding (20% of range on each side, minimum 50)
    const padX = Math.max(50, (maxX - minX) * 0.2);
    const padY = Math.max(50, (maxY - minY) * 0.2);
    const padZ = Math.max(50, (maxZ - minZ) * 0.2);
    minX -= padX; maxX += padX;
    minY -= padY; maxY += padY;
    minZ -= padZ; maxZ += padZ;
    
    // Ensure axes pass through origin (0,0,0) for reference
    minX = Math.min(minX, -50);
    maxX = Math.max(maxX, 50);
    minY = Math.min(minY, -50);
    maxY = Math.max(maxY, 50);
    minZ = Math.min(minZ, -50);
    maxZ = Math.max(maxZ, 50);
    
    // Store bounds for later use
    universeState.axisBounds = { minX, maxX, minY, maxY, minZ, maxZ };
    
    console.log(`Axis bounds calculated: X=[${minX.toFixed(0)}, ${maxX.toFixed(0)}], Y=[${minY.toFixed(0)}, ${maxY.toFixed(0)}], Z=[${minZ.toFixed(0)}, ${maxZ.toFixed(0)}]`);
    
    /**
     * Get the actual min/max range for a metric based on global stats
     * Maps visual axis positions back to actual metric values
     */
    function getMetricRange(metricKey) {
        const opt = GALAXY_AXIS_OPTIONS[metricKey];
        
        // Fixed-range metrics (0-1 like rationality, regularity)
        if (opt && Array.isArray(opt.range) && opt.range[1] === 1 && opt.range[0] === 0) {
            return { min: 0, max: 1, isPercentage: true };
        }
        
        // Use global stats if available - this gives us actual data range
        if (globalStats[metricKey] && globalStats[metricKey].min !== Infinity) {
            const { min, max } = globalStats[metricKey];
            return { 
                min: min,
                max: max,
                isPercentage: false 
            };
        }
        
        // Default ranges when no data available
        const defaults = {
            'avgSpectralRadius': { min: 0, max: 10, isPercentage: false },
            'spectralGap': { min: 0, max: 5, isPercentage: false },
            'energy': { min: 0, max: 50, isPercentage: false },
            'avgN': { min: 3, max: 30, isPercentage: false },
            'alpha': { min: 0, max: 1, isPercentage: false },
            'rationality': { min: 0, max: 1, isPercentage: true },
            'regularity': { min: 0, max: 1, isPercentage: true },
            'sparsity': { min: 0, max: 1, isPercentage: true }
        };
        return defaults[metricKey] || { min: 0, max: 1, isPercentage: false };
    }
    
    /**
     * Format a tick value for display
     */
    function formatTickValue(value, isPercentage, compact = false) {
        if (isPercentage) {
            return `${Math.round(value * 100)}%`;
        }
        if (Math.abs(value) < 0.01) return '0';
        if (Math.abs(value - Math.round(value)) < 0.01) {
            return String(Math.round(value));
        }
        return compact ? value.toFixed(1) : value.toFixed(2);
    }
    
    /**
     * Create a thick, glowing axis line using cylinder geometry
     */
    function createThickAxis(start, end, color, thickness = 2) {
        const direction = new THREE.Vector3().subVectors(end, start);
        const length = direction.length();
        direction.normalize();
        
        // Create cylinder
        const geometry = new THREE.CylinderGeometry(thickness, thickness, length, 8);
        const material = new THREE.MeshBasicMaterial({ 
            color: color,
            transparent: true,
            opacity: 0.9
        });
        
        const cylinder = new THREE.Mesh(geometry, material);
        
        // Position and orient
        const midpoint = new THREE.Vector3().addVectors(start, end).multiplyScalar(0.5);
        cylinder.position.copy(midpoint);
        
        // Rotate to align with direction
        const up = new THREE.Vector3(0, 1, 0);
        const quaternion = new THREE.Quaternion().setFromUnitVectors(up, direction);
        cylinder.setRotationFromQuaternion(quaternion);
        
        // Add glow effect with a larger transparent cylinder
        const glowGeo = new THREE.CylinderGeometry(thickness * 3, thickness * 3, length, 8);
        const glowMat = new THREE.MeshBasicMaterial({
            color: color,
            transparent: true,
            opacity: 0.15
        });
        const glow = new THREE.Mesh(glowGeo, glowMat);
        glow.position.copy(midpoint);
        glow.setRotationFromQuaternion(quaternion);
        
        const group = new THREE.Group();
        group.add(cylinder);
        group.add(glow);
        
        return group;
    }
    
    /**
     * Create tick marks with value labels along an axis
     * Maps visual positions back to actual metric values using axis bounds
     */
    function createAxisTicks(axisDir, startPos, endPos, color, metricKey, tickCount = 6) {
        const tickGroup = new THREE.Group();
        const range = getMetricRange(metricKey);
        const tickSize = 15;
        
        // Get the scale factor for this axis direction
        const scale = CONFIG.galaxyScale;
        const axisScale = axisDir === 'x' ? scale.x : (axisDir === 'y' ? scale.y : scale.z);
        
        // Get axis start and end positions
        const startVal = axisDir === 'x' ? startPos.x : (axisDir === 'y' ? startPos.y : startPos.z);
        const endVal = axisDir === 'x' ? endPos.x : (axisDir === 'y' ? endPos.y : endPos.z);
        
        // Calculate what metric values correspond to start and end positions
        // Using: position = (normalized - 0.5) * scale
        // So: normalized = position / scale + 0.5
        // And: metricValue = normalized * (max - min) + min
        const startNorm = startVal / axisScale + 0.5;
        const endNorm = endVal / axisScale + 0.5;
        const startMetric = startNorm * (range.max - range.min) + range.min;
        const endMetric = endNorm * (range.max - range.min) + range.min;
        
        console.log(`createAxisTicks(${axisDir}): pos=[${startVal.toFixed(1)}, ${endVal.toFixed(1)}], scale=${axisScale}, range=[${range.min}, ${range.max}], metric=[${startMetric.toFixed(2)}, ${endMetric.toFixed(2)}]`);
        
        for (let i = 0; i <= tickCount; i++) {
            const t = i / tickCount;
            const pos = new THREE.Vector3().lerpVectors(startPos, endPos, t);
            
            // Linear interpolation between start and end metric values
            const actualValue = startMetric + t * (endMetric - startMetric);
            
            // Create tick mark (perpendicular to axis)
            const tickGeo = new THREE.BufferGeometry();
            let points;
            let labelOffset = pos.clone();
            
            if (axisDir === 'x') {
                points = [
                    new THREE.Vector3(pos.x, pos.y - tickSize, pos.z),
                    new THREE.Vector3(pos.x, pos.y + tickSize, pos.z)
                ];
                labelOffset.y -= tickSize + 25;
            } else if (axisDir === 'y') {
                points = [
                    new THREE.Vector3(pos.x - tickSize, pos.y, pos.z),
                    new THREE.Vector3(pos.x + tickSize, pos.y, pos.z)
                ];
                labelOffset.x -= tickSize + 35;
            } else {
                points = [
                    new THREE.Vector3(pos.x, pos.y - tickSize, pos.z),
                    new THREE.Vector3(pos.x, pos.y + tickSize, pos.z)
                ];
                labelOffset.y -= tickSize + 25;
            }
            
            tickGeo.setFromPoints(points);
            const tickMat = new THREE.LineBasicMaterial({ 
                color: color, 
                transparent: true, 
                opacity: 0.8,
                linewidth: 2
            });
            tickGroup.add(new THREE.Line(tickGeo, tickMat));
            
            // Add value label - format based on range
            const valueLabel = createTextSprite(
                formatTickValue(actualValue, range.isPercentage, true), 
                color, 
                0.5
            );
            valueLabel.position.copy(labelOffset);
            tickGroup.add(valueLabel);
        }
        
        return tickGroup;
    }
    
    // Get ranges for labels
    const xRange = getMetricRange(axes.x);
    const yRange = getMetricRange(axes.y);
    const zRange = getMetricRange(axes.z);
    
    // Calculate dynamic tick counts based on axis length
    const xLength = maxX - minX;
    const yLength = maxY - minY;
    const zLength = maxZ - minZ;
    
    // More ticks for longer axes (1 tick per ~100 units, minimum 5, max 12)
    const xTickCount = Math.max(5, Math.min(12, Math.ceil(xLength / 100)));
    const yTickCount = Math.max(5, Math.min(12, Math.ceil(yLength / 100)));
    const zTickCount = Math.max(5, Math.min(12, Math.ceil(zLength / 100)));
    
    // === X-AXIS (red) ===
    const xStart = new THREE.Vector3(minX, 0, 0);
    const xEnd = new THREE.Vector3(maxX, 0, 0);
    axisGroup.add(createThickAxis(xStart, xEnd, xOption.color, 3));
    axisGroup.add(createAxisTicks('x', xStart, xEnd, xOption.color, axes.x, xTickCount));
    
    // X-axis name label - larger and clearer, at the end of axis
    const xNameLabel = createTextSprite(xOption.name, xOption.color, 1.0);
    xNameLabel.position.set(maxX + 80, 0, 0);
    axisGroup.add(xNameLabel);
    
    // X-axis arrow
    const xArrowGeo = new THREE.ConeGeometry(8, 25, 8);
    const xArrowMat = new THREE.MeshBasicMaterial({ color: xOption.color });
    const xArrow = new THREE.Mesh(xArrowGeo, xArrowMat);
    xArrow.position.set(maxX + 15, 0, 0);
    xArrow.rotation.z = -Math.PI / 2;
    axisGroup.add(xArrow);
    
    // === Y-AXIS (green) ===
    const yStart = new THREE.Vector3(0, minY, 0);
    const yEnd = new THREE.Vector3(0, maxY, 0);
    axisGroup.add(createThickAxis(yStart, yEnd, yOption.color, 3));
    axisGroup.add(createAxisTicks('y', yStart, yEnd, yOption.color, axes.y, yTickCount));
    
    // Y-axis name label - at the top of axis
    const yNameLabel = createTextSprite(yOption.name, yOption.color, 1.0);
    yNameLabel.position.set(0, maxY + 80, 0);
    axisGroup.add(yNameLabel);
    
    // Y-axis arrow
    const yArrowGeo = new THREE.ConeGeometry(8, 25, 8);
    const yArrowMat = new THREE.MeshBasicMaterial({ color: yOption.color });
    const yArrow = new THREE.Mesh(yArrowGeo, yArrowMat);
    yArrow.position.set(0, maxY + 15, 0);
    axisGroup.add(yArrow);
    
    // === Z-AXIS (blue) ===
    const zStart = new THREE.Vector3(0, 0, minZ);
    const zEnd = new THREE.Vector3(0, 0, maxZ);
    axisGroup.add(createThickAxis(zStart, zEnd, zOption.color, 3));
    axisGroup.add(createAxisTicks('z', zStart, zEnd, zOption.color, axes.z, zTickCount));
    
    // Z-axis name label - at the end of axis
    const zNameLabel = createTextSprite(zOption.name, zOption.color, 1.0);
    zNameLabel.position.set(0, 0, maxZ + 80);
    axisGroup.add(zNameLabel);
    
    // Z-axis arrow
    const zArrowGeo = new THREE.ConeGeometry(8, 25, 8);
    const zArrowMat = new THREE.MeshBasicMaterial({ color: zOption.color });
    const zArrow = new THREE.Mesh(zArrowGeo, zArrowMat);
    zArrow.position.set(0, 0, maxZ + 15);
    zArrow.rotation.x = Math.PI / 2;
    axisGroup.add(zArrow);
    
    // === ORIGIN MARKER ===
    const originGeo = new THREE.SphereGeometry(8, 16, 16);
    const originMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9 });
    const originMarker = new THREE.Mesh(originGeo, originMat);
    axisGroup.add(originMarker);
    
    // Origin glow
    const originGlowGeo = new THREE.SphereGeometry(15, 16, 16);
    const originGlowMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.2 });
    axisGroup.add(new THREE.Mesh(originGlowGeo, originGlowMat));
    
    const originLabel = createTextSprite('ORIGIN', 0xffffff, 0.5);
    originLabel.position.set(0, 35, 0);
    axisGroup.add(originLabel);
    
    // === REFERENCE GRID at Y=0 ===
    const gridSizeX = Math.max(Math.abs(minX), Math.abs(maxX)) * 2;
    const gridSizeZ = Math.max(Math.abs(minZ), Math.abs(maxZ)) * 2;
    const gridDivisions = 20;
    const gridHelper = new THREE.GridHelper(
        Math.max(gridSizeX, gridSizeZ), 
        gridDivisions, 
        0x444466,  // Center line color
        0x222233   // Grid color
    );
    gridHelper.material.transparent = true;
    gridHelper.material.opacity = 0.3;
    axisGroup.add(gridHelper);
    
    universeState.scene.add(axisGroup);
    universeState.axisHelpers = axisGroup;
    
    console.log(`Axes created with bounds: X=[${minX.toFixed(0)},${maxX.toFixed(0)}], ` +
                `Y=[${minY.toFixed(0)},${maxY.toFixed(0)}], Z=[${minZ.toFixed(0)},${maxZ.toFixed(0)}]`);
    console.log(`Metric ranges: X(${axes.x})=[${xRange.min.toFixed(2)},${xRange.max.toFixed(2)}], ` +
                `Y(${axes.y})=[${yRange.min.toFixed(2)},${yRange.max.toFixed(2)}], ` +
                `Z(${axes.z})=[${zRange.min.toFixed(2)},${zRange.max.toFixed(2)}]`);
}

function groupGraphsByFamily(graphs) {
    const groups = new Map();
    
    for (const graph of graphs) {
        // Extract base family name
        let familyBase = 'Unknown';
        
        if (graph.family) {
            const familyLower = graph.family.toLowerCase();
            
            // Check for Cartesian products first (contains □)
            if (graph.family.includes('□')) {
                familyBase = 'Cartesian Product';
            }
            // Check for tensor products (contains ×)
            else if (graph.family.includes('×') || graph.family.includes('⊗')) {
                familyBase = 'Tensor Product';
            }
            // Check for line graphs
            else if (graph.family.startsWith('Line(') || familyLower.includes('line graph')) {
                familyBase = 'Line Graph';
            }
            // Check for complement graphs
            else if (familyLower.includes('complement')) {
                familyBase = 'Complement';
            }
            // Check for mechanism/pendulum
            else if (familyLower.includes('mechanism') || familyLower.includes('bar')) {
                familyBase = 'Mechanism';
            }
            else if (familyLower.includes('pendulum') || familyLower.includes('link')) {
                familyBase = 'Pendulum';
            }
            // Check for specific named families
            else if (familyLower.includes('path')) {
                familyBase = 'Path';
            }
            else if (familyLower.includes('cycle') || familyLower.includes('ring')) {
                familyBase = 'Cycle';
            }
            else if (familyLower.includes('star')) {
                familyBase = 'Star';
            }
            else if (familyLower.includes('wheel')) {
                familyBase = 'Wheel';
            }
            else if (familyLower.includes('ladder')) {
                familyBase = 'Ladder';
            }
            else if (familyLower.includes('grid') || familyLower.includes('mesh') || familyLower.includes('lattice')) {
                familyBase = 'Grid';
            }
            else if (familyLower.includes('prism')) {
                familyBase = 'Prism';
            }
            else if (familyLower.includes('hypercube') || familyLower.includes('cube')) {
                familyBase = 'Hypercube';
            }
            else if (familyLower.includes('tree')) {
                familyBase = familyLower.includes('binary') ? 'Binary Tree' : 'Tree';
            }
            else if (familyLower.includes('petersen')) {
                familyBase = 'Petersen';
            }
            else if (familyLower.includes('möbius') || familyLower.includes('mobius')) {
                familyBase = 'Möbius';
            }
            else if (familyLower.includes('circulant')) {
                familyBase = 'Circulant';
            }
            else if (familyLower.includes('crown')) {
                familyBase = 'Crown';
            }
            else if (familyLower.includes('book')) {
                familyBase = 'Book';
            }
            else if (familyLower.includes('fan')) {
                familyBase = 'Fan';
            }
            else if (familyLower.includes('gear')) {
                familyBase = 'Gear';
            }
            else if (familyLower.includes('helm')) {
                familyBase = 'Helm';
            }
            else if (familyLower.includes('friendship') || familyLower.includes('windmill')) {
                familyBase = 'Friendship';
            }
            else if (familyLower.includes('turán') || familyLower.includes('turan')) {
                familyBase = 'Turán';
            }
            else if (familyLower.includes('platonic') || familyLower.includes('tetrahedron') || 
                     familyLower.includes('octahedron') || familyLower.includes('dodecahedron') ||
                     familyLower.includes('icosahedron')) {
                familyBase = 'Platonic';
            }
            else if (familyLower.includes('empty') || familyLower.includes('null')) {
                familyBase = 'Empty';
            }
            // Complete bipartite before complete
            else if (familyLower.includes('complete') && familyLower.includes('bipartite')) {
                familyBase = 'Complete Bipartite';
            }
            else if (familyLower.includes('complete')) {
                familyBase = 'Complete';
            }
            else if (familyLower.includes('bipartite')) {
                familyBase = 'Bipartite';
            }
            // Standard family extraction fallback
            else {
                const parts = graph.family.split(' ');
                familyBase = parts[0];
                
                // Handle special cases
                if (familyBase === 'Complete' && graph.family.includes('Bipartite')) {
                    familyBase = 'Complete Bipartite';
                } else if (familyBase === 'Binary') {
                    familyBase = 'Binary Tree';
                }
            }
        }
        
        // If family is not in GALAXY_FAMILIES, merge into "Unknown"
        if (!GALAXY_FAMILIES[familyBase]) {
            console.log(`Merging unknown family "${familyBase}" (from "${graph.family}") into Unknown`);
            familyBase = 'Unknown';
        }
        
        if (!groups.has(familyBase)) {
            groups.set(familyBase, []);
        }
        groups.get(familyBase).push(graph);
    }
    
    // Log summary of grouping
    console.log('=== Universe Family Grouping Summary ===');
    for (const [family, familyGraphs] of groups) {
        console.log(`  ${family}: ${familyGraphs.length} graphs`);
    }
    console.log('========================================');
    
    return groups;
}

// Old golden spiral positioning removed - now using calculateGalaxyData() with metrics-based positioning

function createGalaxy(familyName, graphs, position, config, galaxyMetrics = null) {
    // PURE ABSOLUTE POSITIONING: Galaxy group stays at origin
    // Graphs are positioned purely by their metrics, not offset by galaxy center
    const galaxyGroup = new THREE.Group();
    // galaxyGroup.position stays at (0,0,0) - no offset!
    
    // Calculate family statistics for logging
    const familyStats = calculateFamilyStats(graphs);
    
    // Create nodes for each graph using ABSOLUTE positioning
    const nodePositions = calculateSpectralNodePositions(graphs, familyStats);
    
    // Track actual positions to compute centroid for UI (fly-to button)
    let centroidX = 0, centroidY = 0, centroidZ = 0;
    
    for (let i = 0; i < graphs.length; i++) {
        const graph = graphs[i];
        const nodePos = nodePositions[i];  // This is already absolute (n*8, rho*15, (E-8)*8)
        
        // Calculate metrics for this graph
        const metrics = calculateGraphMetrics(graph);
        
        const nodeMesh = createGraphNode(graph, config.color, metrics);
        nodeMesh.position.copy(nodePos);  // Absolute position
        nodeMesh.userData.graphId = graph.id;
        nodeMesh.userData.familyColor = config.color;
        
        galaxyGroup.add(nodeMesh);
        
        // Accumulate for centroid calculation
        centroidX += nodePos.x;
        centroidY += nodePos.y;
        centroidZ += nodePos.z;
        
        // Store reference with metrics
        universeState.graphNodes.set(graph.id, {
            mesh: nodeMesh,
            data: graph,
            galaxy: familyName,
            metrics: metrics
        });
    }
    
    // Compute centroid (average position of all graphs in this family)
    const count = graphs.length;
    const centroid = new THREE.Vector3(
        centroidX / count,
        centroidY / count,
        centroidZ / count
    );
    
    // No galaxy labels - they clutter the view
    // Galaxy centroid is still stored for fly-to navigation
    
    universeState.scene.add(galaxyGroup);
    
    // Store galaxy with centroid as "center" (for fly-to UI)
    universeState.galaxies.set(familyName, {
        group: galaxyGroup,
        center: centroid,  // Centroid of member graphs, not an offset
        config: config,
        graphs: graphs,
        familyStats: familyStats,
        galaxyMetrics: galaxyMetrics
    });
    
    console.log(`Created galaxy "${familyName}" with ${graphs.length} graphs, centroid: (${centroid.x.toFixed(1)}, ${centroid.y.toFixed(1)}, ${centroid.z.toFixed(1)})`);
}

/**
 * Calculate node positions based on configured axes
 * Uses CONFIG.galaxyAxes to map metrics to X, Y, Z coordinates
 * @param {Array} graphs - Array of graph objects
 * @param {Object} familyStats - Statistics for normalization (unused in pure absolute mode)
 * @returns {Array} Array of THREE.Vector3 positions
 */
function calculateSpectralNodePositions(graphs, familyStats) {
    const positions = [];
    const count = graphs.length;
    
    if (count === 0) return positions;
    
    const axes = CONFIG.galaxyAxes;
    console.log(`\n=== calculateSpectralNodePositions for ${count} graphs ===`);
    console.log(`  Axes: X=${axes.x}, Y=${axes.y}, Z=${axes.z}, LogScale=${CONFIG.useLogScale}`);
    
    // Compute metrics and positions for each graph
    for (let i = 0; i < graphs.length; i++) {
        const g = graphs[i];
        const m = calculateGraphMetrics(g);
        
        // Use the new dynamic positioning based on configured axes
        const pos = computeGraphPosition(m);
        
        positions.push(pos);
        
        // Log positioning
        const xVal = getMetricValue(m, axes.x);
        const yVal = getMetricValue(m, axes.y);
        const zVal = getMetricValue(m, axes.z);
        console.log(`  → ${g.name || g.family}: ${axes.x}=${xVal.toFixed(2)}, ${axes.y}=${yVal.toFixed(2)}, ${axes.z}=${zVal.toFixed(2)} → pos=(${pos.x.toFixed(1)}, ${pos.y.toFixed(1)}, ${pos.z.toFixed(1)})`);
    }
    
    console.log(`=== END calculateSpectralNodePositions ===\n`);
    
    return positions;
}

/**
 * Original artistic pattern-based positioning (PRESERVED)
 */
function calculateNodePositions(count, pattern) {
    const positions = [];
    
    // Scale radius based on count - larger galaxies need more space
    // Use cube root scaling so 100 graphs get ~4.6x the radius of 1 graph
    const baseRadius = CONFIG.galaxyRadius;
    const scaleFactor = Math.cbrt(count);  // Cube root for 3D volume scaling
    const radius = Math.max(baseRadius, 25 * scaleFactor);  // Increased from 15 to 25
    
    // Minimum separation between nodes (scale with node size)
    const minSeparation = CONFIG.nodeBaseSize * 2.5;
    
    switch (pattern) {
        case 'cascade':
            // Waterfall pattern - descending layers (like the example)
            for (let i = 0; i < count; i++) {
                const layer = Math.floor(i / 4);
                const inLayer = i % 4;
                positions.push(new THREE.Vector3(
                    (inLayer - 1.5) * 20 + (Math.random() - 0.5) * 10,
                    -layer * 30,
                    (Math.random() - 0.5) * 20
                ));
            }
            break;
            
        case 'vortex':
            // Spiral pattern (like the example's cycle)
            for (let i = 0; i < count; i++) {
                const angle = (i / count) * Math.PI * 2;
                const r = radius * 0.6;
                positions.push(new THREE.Vector3(
                    Math.cos(angle) * r,
                    Math.sin(angle * 5) * 15, // Wave height like example
                    Math.sin(angle) * r
                ));
            }
            break;
            
        case 'radial':
            // Star burst from center
            for (let i = 0; i < count; i++) {
                const angle = (i / count) * Math.PI * 2;
                const r = 15 + Math.random() * (radius * 0.5);
                positions.push(new THREE.Vector3(
                    Math.cos(angle) * r,
                    (Math.random() - 0.5) * 20,
                    Math.sin(angle) * r
                ));
            }
            break;
            
        case 'dense':
            // Spherical cluster (like the example's tournament)
            for (let i = 0; i < count; i++) {
                const u = Math.random();
                const v = Math.random();
                const theta = 2 * Math.PI * u;
                const phi = Math.acos(2 * v - 1);
                const r = Math.cbrt(Math.random()) * radius * 0.5;
                positions.push(new THREE.Vector3(
                    r * Math.sin(phi) * Math.cos(theta),
                    r * Math.sin(phi) * Math.sin(theta),
                    r * Math.cos(phi)
                ));
            }
            break;
            
        case 'grid':
            // Grid arrangement
            const gridSize = Math.ceil(Math.sqrt(count));
            for (let i = 0; i < count; i++) {
                const row = Math.floor(i / gridSize);
                const col = i % gridSize;
                positions.push(new THREE.Vector3(
                    (col - gridSize/2) * 18,
                    (Math.random() - 0.5) * 10,
                    (row - gridSize/2) * 18
                ));
            }
            break;
            
        case 'ladder':
            // Two parallel lines
            for (let i = 0; i < count; i++) {
                const side = i % 2;
                const pos = Math.floor(i / 2);
                positions.push(new THREE.Vector3(
                    (side - 0.5) * 25,
                    0,
                    pos * 15 - (count / 4) * 15
                ));
            }
            break;
            
        case 'bipartite':
            // Two groups
            for (let i = 0; i < count; i++) {
                const side = i % 2;
                const posInSide = Math.floor(i / 2);
                const sideCount = Math.ceil(count / 2);
                positions.push(new THREE.Vector3(
                    (side - 0.5) * 40,
                    (posInSide - sideCount / 2) * 15,
                    (Math.random() - 0.5) * 15
                ));
            }
            break;
            
        case 'prism':
            // Polygon arrangement
            for (let i = 0; i < count; i++) {
                const angle = (i / count) * Math.PI * 2;
                const r = radius * 0.5;
                const layer = Math.floor(i / Math.max(6, count / 2));
                positions.push(new THREE.Vector3(
                    Math.cos(angle) * r,
                    layer * 20 - 10,
                    Math.sin(angle) * r
                ));
            }
            break;
            
        case 'hypercube':
            // Hypercube-like arrangement
            for (let i = 0; i < count; i++) {
                const bits = i.toString(2).padStart(4, '0');
                positions.push(new THREE.Vector3(
                    (parseInt(bits[0]) - 0.5) * 30 + (parseInt(bits[2]) - 0.5) * 15,
                    (parseInt(bits[1]) - 0.5) * 30,
                    (parseInt(bits[3]) - 0.5) * 30 + (Math.random() - 0.5) * 10
                ));
            }
            break;
            
        case 'tree':
            // Tree-like hierarchical
            for (let i = 0; i < count; i++) {
                const level = Math.floor(Math.log2(i + 1));
                const posInLevel = i - (Math.pow(2, level) - 1);
                const levelWidth = Math.pow(2, level);
                positions.push(new THREE.Vector3(
                    (posInLevel - levelWidth / 2 + 0.5) * (60 / (level + 1)),
                    -level * 25,
                    (Math.random() - 0.5) * 15
                ));
            }
            break;
            
        case 'binary':
            // Binary tree
            for (let i = 0; i < count; i++) {
                const level = Math.floor(Math.log2(i + 1));
                const posInLevel = i - (Math.pow(2, level) - 1);
                const levelWidth = Math.pow(2, level);
                positions.push(new THREE.Vector3(
                    (posInLevel - levelWidth / 2 + 0.5) * (50 / (level + 1)),
                    -level * 20,
                    0
                ));
            }
            break;
            
        case 'wheel':
            // Wheel pattern - center + rim
            for (let i = 0; i < count; i++) {
                if (i === 0) {
                    positions.push(new THREE.Vector3(0, 0, 0));
                } else {
                    const angle = ((i - 1) / (count - 1)) * Math.PI * 2;
                    positions.push(new THREE.Vector3(
                        Math.cos(angle) * radius * 0.5,
                        (Math.random() - 0.5) * 10,
                        Math.sin(angle) * radius * 0.5
                    ));
                }
            }
            break;
            
        case 'empty':
            // Sparse random for empty graphs
            for (let i = 0; i < count; i++) {
                positions.push(new THREE.Vector3(
                    (Math.random() - 0.5) * radius * 1.5,
                    (Math.random() - 0.5) * radius,
                    (Math.random() - 0.5) * radius * 1.5
                ));
            }
            break;
            
        default:
            // Improved random distribution using golden angle spiral for better coverage
            // This ensures more even distribution than pure random
            const goldenAngle = Math.PI * (3 - Math.sqrt(5)); // ~137.5 degrees
            for (let i = 0; i < count; i++) {
                const t = i / count;
                const angle = i * goldenAngle;
                const r = radius * Math.sqrt(t) * 0.9;  // Square root for uniform density
                const y = (t - 0.5) * radius * 0.8;     // Vertical spread
                
                // Add small jitter for natural look
                const jitter = radius * 0.05;
                positions.push(new THREE.Vector3(
                    Math.cos(angle) * r + (Math.random() - 0.5) * jitter,
                    y + (Math.random() - 0.5) * jitter,
                    Math.sin(angle) * r + (Math.random() - 0.5) * jitter
                ));
            }
    }
    
    return positions;
}

/**
 * NEW: Create axis indicators for spectral mode
 */
function createGalaxyAxisIndicators(galaxyGroup, familyStats, color) {
    const axisLength = CONFIG.spectralSpread * 0.6;
    const axisOpacity = 0.3;
    
    // X-axis (Vertices/Size) - Red tint
    const xAxisGeo = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(-axisLength, 0, 0),
        new THREE.Vector3(axisLength, 0, 0)
    ]);
    const xAxisMat = new THREE.LineBasicMaterial({ 
        color: 0xff4444, 
        transparent: true, 
        opacity: axisOpacity 
    });
    const xAxis = new THREE.Line(xAxisGeo, xAxisMat);
    galaxyGroup.add(xAxis);
    
    // Y-axis (Density) - Green tint
    const yAxisGeo = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(0, -axisLength * 0.8, 0),
        new THREE.Vector3(0, axisLength * 0.8, 0)
    ]);
    const yAxisMat = new THREE.LineBasicMaterial({ 
        color: 0x44ff44, 
        transparent: true, 
        opacity: axisOpacity 
    });
    const yAxis = new THREE.Line(yAxisGeo, yAxisMat);
    galaxyGroup.add(yAxis);
    
    // Z-axis (Spectral Radius) - Blue tint
    const zAxisGeo = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(0, 0, -axisLength * 0.6),
        new THREE.Vector3(0, 0, axisLength * 0.6)
    ]);
    const zAxisMat = new THREE.LineBasicMaterial({ 
        color: 0x4444ff, 
        transparent: true, 
        opacity: axisOpacity 
    });
    const zAxis = new THREE.Line(zAxisGeo, zAxisMat);
    galaxyGroup.add(zAxis);
    
    // Small axis labels
    const labelScale = 0.6;
    const xLabel = createTextSprite('n →', 0xff6666, labelScale);
    xLabel.position.set(axisLength + 10, 0, 0);
    galaxyGroup.add(xLabel);
    
    const yLabel = createTextSprite('ρ ↑', 0x66ff66, labelScale);
    yLabel.position.set(0, axisLength * 0.8 + 10, 0);
    galaxyGroup.add(yLabel);
    
    const zLabel = createTextSprite('ρ(A)', 0x6666ff, labelScale);
    zLabel.position.set(0, 0, axisLength * 0.6 + 15);
    galaxyGroup.add(zLabel);
}

function createGraphNode(graph, baseColor, metrics = null) {
    // Size based on vertex count
    const size = CONFIG.nodeBaseSize + (graph.n || 4) * CONFIG.nodeSizeScale;
    
    // Determine if this is an analytic (library) graph or custom-built
    const isAnalytic = !graph.isCustom && !graph.isBuilt;
    const isCustom = graph.isCustom || graph.isBuilt;
    
    // NEW: In analytic highlight mode, override colors based on graph type
    let nodeColor = baseColor;
    let glowColor = baseColor;
    
    if (CONFIG.analyticHighlightMode) {
        // Use distinct colors for analytic vs custom graphs
        if (isCustom) {
            nodeColor = new THREE.Color(CONFIG.analyticColors.custom);
            glowColor = new THREE.Color(CONFIG.analyticColors.customGlow);
        } else {
            nodeColor = new THREE.Color(CONFIG.analyticColors.analytic);
            glowColor = new THREE.Color(CONFIG.analyticColors.analyticGlow);
        }
    } else if (metrics && metrics.spectralRadius > 0) {
        // Spectral coloring - shift hue based on spectral radius (higher = warmer)
        const baseHSL = new THREE.Color(baseColor).getHSL({});
        // Use normalizedSpectralRadius if available, otherwise estimate from spectralRadius/(n-1)
        const n = graph.n || 4;
        const srNorm = Math.min(metrics.normalizedSpectralRadius ?? (metrics.spectralRadius / Math.max(n - 1, 1)) ?? 0.5, 1);
        // Shift hue slightly toward red for higher spectral radius
        const newHue = (baseHSL.h + srNorm * 0.1) % 1;
        const newLightness = Math.min(baseHSL.l + srNorm * 0.1, 0.9);
        nodeColor = new THREE.Color().setHSL(newHue, baseHSL.s, newLightness);
        glowColor = nodeColor;
    } else {
        glowColor = nodeColor;
    }
    
    // Create a group to hold all parts
    const nodeGroup = new THREE.Group();
    
    // Store analytic status on the group for later reference
    nodeGroup.userData.isAnalytic = isAnalytic;
    nodeGroup.userData.isCustom = isCustom;
    
    // INVISIBLE hit mesh for raycasting (solid sphere, slightly larger)
    const hitGeometry = new THREE.SphereGeometry(size * 1.2, 8, 8);
    const hitMaterial = new THREE.MeshBasicMaterial({
        visible: false  // Invisible but raycastable
    });
    const hitMesh = new THREE.Mesh(hitGeometry, hitMaterial);
    nodeGroup.add(hitMesh);
    
    // Outer wireframe icosahedron (visual) - emissive for glow effect
    const geometry = new THREE.IcosahedronGeometry(size, 1);
    const material = new THREE.MeshBasicMaterial({
        color: nodeColor,
        wireframe: true,
        transparent: true,
        opacity: 0.8
    });
    const wireframeMesh = new THREE.Mesh(geometry, material);
    nodeGroup.add(wireframeMesh);
    
    // Inner solid core - uses Phong material to respond to camera light
    const coreGeometry = new THREE.IcosahedronGeometry(size * 0.35, 0);
    const coreMaterial = new THREE.MeshPhongMaterial({ 
        color: 0xffffff,
        emissive: glowColor,
        emissiveIntensity: isCustom && CONFIG.analyticHighlightMode ? 0.5 : 0.3,  // Brighter glow for custom in highlight mode
        shininess: 100,
        specular: 0x444444
    });
    const core = new THREE.Mesh(coreGeometry, coreMaterial);
    nodeGroup.add(core);
    
    // Store reference to the material for color changes (use wireframe material)
    nodeGroup.material = material;
    nodeGroup.coreMaterial = coreMaterial;  // Store core material too
    
    return nodeGroup;
}

function createTextSprite(text, color, scale = 1, options = {}) {
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    
    // Higher resolution canvas for sharper text
    canvas.width = 1024;
    canvas.height = 256;
    
    // Clear with transparent background
    context.clearRect(0, 0, canvas.width, canvas.height);
    
    // Font setup - regular weight (not bold)
    const fontSize = options.fontSize || 72;
    context.font = `${fontSize}px "Segoe UI", Arial, sans-serif`;
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    
    const colorHex = typeof color === 'number' ? color : (color.getHex ? color.getHex() : 0xffffff);
    const colorStr = `#${colorHex.toString(16).padStart(6, '0')}`;
    
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    
    // Draw background pill for better readability (optional)
    if (options.background) {
        const textWidth = context.measureText(text).width;
        const padding = 20;
        context.fillStyle = 'rgba(0, 0, 0, 0.6)';
        context.beginPath();
        context.roundRect(centerX - textWidth/2 - padding, centerY - fontSize/2 - 10, 
                         textWidth + padding*2, fontSize + 20, 15);
        context.fill();
    }
    
    // Draw text outline/stroke for contrast (thinner)
    context.strokeStyle = 'rgba(0, 0, 0, 0.6)';
    context.lineWidth = 3;
    context.strokeText(text, centerX, centerY);
    
    // Subtle glow effect
    context.shadowColor = colorStr;
    context.shadowBlur = 8;
    context.shadowOffsetX = 0;
    context.shadowOffsetY = 0;
    
    // Draw main text
    context.fillStyle = colorStr;
    context.fillText(text, centerX, centerY);
    
    const texture = new THREE.CanvasTexture(canvas);
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    
    const material = new THREE.SpriteMaterial({
        map: texture,
        transparent: true,
        depthTest: false,  // Always render on top
        depthWrite: false
    });
    
    const sprite = new THREE.Sprite(material);
    // Smaller base scale
    sprite.scale.set(100 * scale, 25 * scale, 1);
    
    return sprite;
}

function createGalaxyFlows(galaxyGroup, nodePositions, config) {
    if (nodePositions.length < 2) return;
    
    // Connect based on metric proximity (spectral positioning)
    const maxFlowDist = 80;
    
    // Create flow particles between nearby nodes
    for (let i = 0; i < nodePositions.length - 1; i++) {
        const j = (i + 1) % nodePositions.length;
        const start = nodePositions[i];
        const end = nodePositions[j];
        
        // Only create flows for nearby nodes
        if (start.distanceTo(end) < maxFlowDist) {
            const flowParticle = createFlowParticle(start, end, config.color);
            galaxyGroup.add(flowParticle.mesh);
            universeState.flowParticles.push(flowParticle);
        }
    }
}

function createFlowParticle(start, end, color) {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0], 3));
    
    const material = new THREE.PointsMaterial({
        color: 0xffffff,
        size: CONFIG.flowParticleSize,
        transparent: true,
        opacity: 0.9
    });
    
    const mesh = new THREE.Points(geometry, material);
    
    return {
        mesh,
        start: start.clone(),
        end: end.clone(),
        progress: Math.random(),
        speed: CONFIG.flowSpeed * (0.5 + Math.random())
    };
}

// =====================================================
// UNIVERSE LIFECYCLE
// =====================================================

/**
 * Start the universe view
 */
export function startUniverse() {
    if (universeState.active) return;
    
    universeState.active = true;
    universeState.prevTime = performance.now();
    universeState.hudElement.style.display = 'block';
    
    animate();
    
    console.log('Universe started');
}

/**
 * Stop the universe view
 */
export function stopUniverse() {
    universeState.active = false;
    
    if (universeState.animationId) {
        cancelAnimationFrame(universeState.animationId);
        universeState.animationId = null;
    }
    
    universeState.flyMode = false;
    
    universeState.hudElement.style.display = 'none';
    universeState.infoPanelElement.style.display = 'none';
    
    console.log('Universe stopped');
}

/**
 * Clear all universe objects
 */
export function clearUniverse() {
    // Remove all galaxies
    for (const [name, galaxy] of universeState.galaxies) {
        universeState.scene.remove(galaxy.group);
    }
    universeState.galaxies.clear();
    
    // Remove custom graph meshes and labels from scene
    universeState.graphNodes.forEach((nodeData, graphId) => {
        if (nodeData.mesh) {
            universeState.scene.remove(nodeData.mesh);
            // Also remove label if exists
            if (nodeData.mesh.userData?.label) {
                universeState.scene.remove(nodeData.mesh.userData.label);
            }
        }
    });
    universeState.graphNodes.clear();
    universeState.flowParticles = [];
    
    // Remove universe axes
    if (universeState.axisHelpers) {
        universeState.scene.remove(universeState.axisHelpers);
        universeState.axisHelpers = null;
    }
    
    universeState.hoveredNode = null;
    universeState.selectedNode = null;
}

/**
 * Dispose of universe resources
 */
export function disposeUniverse() {
    stopUniverse();
    clearUniverse();
    
    if (universeState.renderer) {
        universeState.renderer.dispose();
        universeState.container.removeChild(universeState.renderer.domElement);
    }
    
    if (universeState.hudElement) {
        universeState.container.removeChild(universeState.hudElement);
    }
    
    if (universeState.infoPanelElement) {
        universeState.container.removeChild(universeState.infoPanelElement);
    }
    
    // Remove event listeners
    document.removeEventListener('keydown', onKeyDown);
    document.removeEventListener('keyup', onKeyUp);
    window.removeEventListener('resize', onWindowResize);
    
    universeState.scene = null;
    universeState.camera = null;
    universeState.renderer = null;
    universeState.controls = null;
}

// =====================================================
// ANIMATION LOOP
// =====================================================

function animate() {
    if (!universeState.active) return;
    
    universeState.animationId = requestAnimationFrame(animate);
    
    const time = performance.now();
    const delta = (time - universeState.prevTime) / 1000;
    
    // Update OrbitControls
    if (universeState.controls) {
        universeState.controls.update();
    }
    
    // Update keyboard movement
    updateMovement(delta);
    
    // Update flow particles
    updateFlowParticles();
    
    // Update HUD
    updateHUD();
    
    // Update adaptive label visibility
    if (CONFIG.adaptiveLabels) {
        updateAdaptiveLabels();
    }
    
    // Render
    universeState.renderer.render(universeState.scene, universeState.camera);
    
    universeState.prevTime = time;
}

/**
 * Update label visibility based on distance to camera
 * Only shows labels for the N closest graphs to reduce clutter
 */
function updateAdaptiveLabels() {
    const cameraPos = universeState.camera.position;
    const maxLabels = CONFIG.maxVisibleLabels;
    const fadeDistance = CONFIG.labelFadeDistance;
    
    // Collect all graphs with their distances to camera
    const graphDistances = [];
    
    for (const [graphId, nodeData] of universeState.graphNodes) {
        const mesh = nodeData.mesh;
        const label = mesh.userData?.label;
        
        if (!label) continue;
        
        const worldPos = new THREE.Vector3();
        mesh.getWorldPosition(worldPos);
        const distance = worldPos.distanceTo(cameraPos);
        
        graphDistances.push({ label, distance, nodeData });
    }
    
    // Sort by distance (closest first)
    graphDistances.sort((a, b) => a.distance - b.distance);
    
    // When very close (< 30 units), show fewer labels
    // When extremely close (< 10), show almost none - selection is better
    const closestDistance = graphDistances.length > 0 ? graphDistances[0].distance : 100;
    let effectiveMaxLabels = maxLabels;
    if (closestDistance < 10) {
        effectiveMaxLabels = 3;  // Very close - show only 3 labels
    } else if (closestDistance < 30) {
        effectiveMaxLabels = Math.min(10, maxLabels);  // Close - show fewer
    }
    
    // Show only the closest N labels, with fade based on distance
    for (let i = 0; i < graphDistances.length; i++) {
        const { label, distance } = graphDistances[i];
        
        if (i < effectiveMaxLabels) {
            // Calculate opacity based on distance
            let opacity = 1;
            if (distance > fadeDistance * 0.5) {
                opacity = Math.max(0.2, 1 - (distance - fadeDistance * 0.5) / fadeDistance);
            }
            
            label.visible = true;
            if (label.material) {
                label.material.opacity = opacity;
            }
        } else {
            // Hide labels beyond the limit
            label.visible = false;
        }
    }
}

function updateMovement(delta) {
    // Skip movement if not in fly mode
    if (!universeState.flyMode) return;
    
    const velocity = universeState.velocity;
    
    // Apply friction
    velocity.x -= velocity.x * CONFIG.friction * delta;
    velocity.z -= velocity.z * CONFIG.friction * delta;
    velocity.y -= velocity.y * CONFIG.friction * delta;
    
    // Calculate direction
    const direction = new THREE.Vector3();
    direction.z = Number(universeState.moveForward) - Number(universeState.moveBackward);
    direction.x = Number(universeState.moveRight) - Number(universeState.moveLeft);
    direction.y = Number(universeState.moveDown) - Number(universeState.moveUp);
    direction.normalize();
    
    // Apply acceleration
    if (universeState.moveForward || universeState.moveBackward) {
        velocity.z -= direction.z * CONFIG.moveSpeed * delta;
    }
    if (universeState.moveLeft || universeState.moveRight) {
        velocity.x -= direction.x * CONFIG.moveSpeed * delta;
    }
    if (universeState.moveUp || universeState.moveDown) {
        velocity.y -= direction.y * CONFIG.moveSpeed * delta;
    }
    
    // Move camera and target together (for OrbitControls)
    const moveX = -velocity.x * delta;
    const moveZ = -velocity.z * delta;
    const moveY = -velocity.y * delta;
    
    universeState.camera.position.x += moveX;
    universeState.camera.position.z += moveZ;
    universeState.camera.position.y += moveY;
    
    // Also move the OrbitControls target
    if (universeState.controls && universeState.controls.target) {
        universeState.controls.target.x += moveX;
        universeState.controls.target.z += moveZ;
        universeState.controls.target.y += moveY;
    }
}

function updateFlowParticles() {
    for (const fp of universeState.flowParticles) {
        fp.progress += fp.speed;
        if (fp.progress >= 1) fp.progress = 0;
        
        // Lerp position
        fp.mesh.position.x = fp.start.x + (fp.end.x - fp.start.x) * fp.progress;
        fp.mesh.position.y = fp.start.y + (fp.end.y - fp.start.y) * fp.progress;
        fp.mesh.position.z = fp.start.z + (fp.end.z - fp.start.z) * fp.progress;
    }
}

function updateHUD() {
    const pos = universeState.camera.position;
    
    const coordsEl = document.getElementById('universe-coords');
    if (coordsEl) {
        coordsEl.textContent = `${Math.round(pos.x)}, ${Math.round(pos.y)}, ${Math.round(pos.z)}`;
    }
    
    // Find nearest galaxy
    let nearestGalaxy = null;
    let nearestDist = Infinity;
    
    for (const [name, galaxy] of universeState.galaxies) {
        const dist = pos.distanceTo(galaxy.center);
        if (dist < nearestDist) {
            nearestDist = dist;
            nearestGalaxy = galaxy;
        }
    }
    
    const galaxyEl = document.getElementById('universe-galaxy');
    const metricsEl = document.getElementById('universe-galaxy-alpha');
    
    if (galaxyEl) {
        if (nearestGalaxy && nearestDist < CONFIG.galaxyRadius * 3) {
            galaxyEl.textContent = nearestGalaxy.config.name;
            
            // Show metrics for current axes
            if (metricsEl && nearestGalaxy.galaxyMetrics) {
                const m = nearestGalaxy.galaxyMetrics;
                const axes = CONFIG.galaxyAxes;
                const xVal = getGalaxyMetricValue(m, axes.x);
                const yVal = getGalaxyMetricValue(m, axes.y);
                const zVal = getGalaxyMetricValue(m, axes.z);
                
                const xName = GALAXY_AXIS_OPTIONS[axes.x]?.name || axes.x;
                const yName = GALAXY_AXIS_OPTIONS[axes.y]?.name || axes.y;
                const zName = GALAXY_AXIS_OPTIONS[axes.z]?.name || axes.z;
                
                metricsEl.innerHTML = `
                    <span style="color:${toHexColor(GALAXY_AXIS_OPTIONS[axes.x]?.color)}">${formatMetricValue(xVal, axes.x)}</span> |
                    <span style="color:${toHexColor(GALAXY_AXIS_OPTIONS[axes.y]?.color)}">${formatMetricValue(yVal, axes.y)}</span> |
                    <span style="color:${toHexColor(GALAXY_AXIS_OPTIONS[axes.z]?.color)}">${formatMetricValue(zVal, axes.z)}</span>
                `;
            } else if (metricsEl) {
                metricsEl.textContent = '—';
            }
        } else {
            galaxyEl.textContent = '—';
            if (metricsEl) metricsEl.textContent = '—';
        }
    }
    
    // Update highlight mode indicator
    const highlightEl = document.getElementById('universe-highlight');
    if (highlightEl) {
        if (CONFIG.analyticHighlightMode) {
            highlightEl.innerHTML = `<span style="color:#00ffff">●</span> Analytic vs <span style="color:#ff6600">●</span> Custom`;
        } else if (CONFIG.showAnalyticManifold) {
            highlightEl.innerHTML = `<span style="color:#00aaaa">Manifold ON</span>`;
        } else {
            highlightEl.textContent = 'OFF';
            highlightEl.style.color = '#666';
        }
    }
}

/**
 * Format metric value for display
 */
function formatMetricValue(value, metricKey) {
    if (value === undefined || value === null) return '—';
    
    // For percentage-like metrics (0-1 range)
    if (['rationality', 'regularity', 'sparsity'].includes(metricKey)) {
        return `${(value * 100).toFixed(0)}%`;
    }
    // For small decimals
    if (Math.abs(value) < 10) {
        return value.toFixed(2);
    }
    // For larger numbers
    return value.toFixed(1);
}

/**
 * Convert number color to hex string
 */
function toHexColor(color) {
    if (!color) return '#ffffff';
    return '#' + color.toString(16).padStart(6, '0');
}

// =====================================================
// LEGACY API STUBS (spectral mode is now always on)
// =====================================================

// Spectral mode is now always on - these functions are kept for API compatibility
export function toggleSpectralMode() {
    console.log('Spectral positioning is now always enabled');
}

export function setSpectralMode(enabled) {
    // No-op - spectral mode is always on
}

export function isSpectralMode() {
    return true;  // Always spectral mode now
}

/**
 * Toggle analytic highlight mode
 * Shows distinction between library/analytic graphs (cyan) and custom/built graphs (orange)
 */
export function toggleAnalyticHighlightMode() {
    CONFIG.analyticHighlightMode = !CONFIG.analyticHighlightMode;
    
    console.log(`Analytic Highlight Mode: ${CONFIG.analyticHighlightMode ? 'ON' : 'OFF'}`);
    console.log('  Cyan = Analytic/Library graphs (closed-form eigenvalues)');
    console.log('  Orange = Custom/Built graphs');
    
    // Update all existing nodes with new colors
    updateAllNodeColors();
    
    // Update HUD
    updateHUD();
    
    // If turning on, also show a brief notification
    if (CONFIG.analyticHighlightMode) {
        showNotification('Analytic Highlight: ON\n🔵 Cyan = Analytic graphs\n🟠 Orange = Custom graphs', 3000);
    }
}

/**
 * Toggle analytic manifold visualization
 * Shows a visual boundary/surface representing where analytic graphs cluster
 */
export function toggleAnalyticManifold() {
    CONFIG.showAnalyticManifold = !CONFIG.showAnalyticManifold;
    
    console.log(`Analytic Manifold Visualization: ${CONFIG.showAnalyticManifold ? 'ON' : 'OFF'}`);
    
    if (CONFIG.showAnalyticManifold) {
        createAnalyticManifold();
        showNotification('Analytic Manifold: ON\nShows region where analytic graphs cluster', 3000);
    } else {
        removeAnalyticManifold();
    }
    
    updateHUD();
}

/**
 * Update colors of all existing graph nodes based on current mode
 */
function updateAllNodeColors() {
    for (const [graphId, nodeData] of universeState.graphNodes) {
        const mesh = nodeData.mesh;
        const graph = nodeData.data;
        if (!mesh || !graph) continue;
        
        // Determine graph type
        const isAnalytic = !graph.isCustom && !graph.isBuilt;
        const isCustom = graph.isCustom || graph.isBuilt;
        
        // Get appropriate color
        let nodeColor;
        if (CONFIG.analyticHighlightMode) {
            nodeColor = isCustom 
                ? new THREE.Color(CONFIG.analyticColors.custom)
                : new THREE.Color(CONFIG.analyticColors.analytic);
        } else {
            // Use original family color
            const familyConfig = GALAXY_FAMILIES[graph.family] || GALAXY_FAMILIES['Unknown'];
            nodeColor = new THREE.Color(familyConfig.color);
        }
        
        // Update wireframe material
        if (mesh.material) {
            mesh.material.color = nodeColor;
        }
        
        // Update core material
        if (mesh.coreMaterial) {
            mesh.coreMaterial.emissive = nodeColor;
            mesh.coreMaterial.emissiveIntensity = isCustom && CONFIG.analyticHighlightMode ? 0.5 : 0.3;
        }
        
        // Update children materials
        mesh.traverse((child) => {
            if (child.material && child.material.color && child !== mesh) {
                if (child.material.wireframe) {
                    child.material.color = nodeColor;
                }
                if (child.material.emissive) {
                    child.material.emissive = nodeColor;
                }
            }
        });
    }
}

/**
 * Create analytic manifold visualization
 * This creates a semi-transparent surface showing where analytic graphs cluster
 */
function createAnalyticManifold() {
    // Remove existing manifold first
    removeAnalyticManifold();
    
    // Collect positions of all analytic graphs
    const analyticPositions = [];
    for (const [graphId, nodeData] of universeState.graphNodes) {
        const graph = nodeData.data;
        const mesh = nodeData.mesh;
        if (!graph || !mesh) continue;
        
        const isAnalytic = !graph.isCustom && !graph.isBuilt;
        if (isAnalytic) {
            const worldPos = new THREE.Vector3();
            mesh.getWorldPosition(worldPos);
            analyticPositions.push(worldPos);
        }
    }
    
    if (analyticPositions.length < 4) {
        console.log('Not enough analytic graphs to create manifold');
        return;
    }
    
    // Calculate bounding box and centroid
    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;
    let minZ = Infinity, maxZ = -Infinity;
    let centroid = new THREE.Vector3();
    
    for (const pos of analyticPositions) {
        minX = Math.min(minX, pos.x);
        maxX = Math.max(maxX, pos.x);
        minY = Math.min(minY, pos.y);
        maxY = Math.max(maxY, pos.y);
        minZ = Math.min(minZ, pos.z);
        maxZ = Math.max(maxZ, pos.z);
        centroid.add(pos);
    }
    centroid.divideScalar(analyticPositions.length);
    
    // Create an inverted cone shape representing the analytic region
    const coneHeight = (maxY - minY) * 1.2 + 100;
    const coneRadius = Math.max(maxX - minX, maxZ - minZ) * 0.7 + 50;
    
    // Create cone geometry (inverted - apex at top)
    const coneGeometry = new THREE.ConeGeometry(coneRadius, coneHeight, 32, 1, true);
    const coneMaterial = new THREE.MeshBasicMaterial({
        color: CONFIG.analyticColors.manifoldColor,
        transparent: true,
        opacity: CONFIG.analyticColors.manifoldOpacity,
        side: THREE.DoubleSide,
        wireframe: false
    });
    
    const cone = new THREE.Mesh(coneGeometry, coneMaterial);
    cone.position.copy(centroid);
    cone.position.y = (minY + maxY) / 2;
    cone.rotation.x = Math.PI;  // Invert the cone
    cone.name = 'analyticManifold';
    
    // Also add a wireframe version for better visibility
    const wireframeMaterial = new THREE.MeshBasicMaterial({
        color: CONFIG.analyticColors.analytic,
        transparent: true,
        opacity: 0.3,
        wireframe: true
    });
    const wireframeCone = new THREE.Mesh(coneGeometry.clone(), wireframeMaterial);
    wireframeCone.position.copy(cone.position);
    wireframeCone.rotation.copy(cone.rotation);
    wireframeCone.name = 'analyticManifoldWireframe';
    
    // Add label
    const label = createTextSprite('Analytic Submanifold', CONFIG.analyticColors.analytic, 1.5);
    label.position.copy(centroid);
    label.position.y = maxY + 50;
    label.name = 'analyticManifoldLabel';
    
    universeState.scene.add(cone);
    universeState.scene.add(wireframeCone);
    universeState.scene.add(label);
    
    // Store references for removal
    universeState.analyticManifold = { cone, wireframeCone, label };
    
    console.log(`Created analytic manifold: centroid=${centroid.toArray().map(v => v.toFixed(1))}, ` +
                `radius=${coneRadius.toFixed(1)}, height=${coneHeight.toFixed(1)}`);
}

/**
 * Remove analytic manifold visualization
 */
function removeAnalyticManifold() {
    if (universeState.analyticManifold) {
        const { cone, wireframeCone, label } = universeState.analyticManifold;
        
        if (cone) {
            universeState.scene.remove(cone);
            cone.geometry.dispose();
            cone.material.dispose();
        }
        if (wireframeCone) {
            universeState.scene.remove(wireframeCone);
            wireframeCone.geometry.dispose();
            wireframeCone.material.dispose();
        }
        if (label) {
            universeState.scene.remove(label);
        }
        
        universeState.analyticManifold = null;
    }
}

/**
 * Show a temporary notification in the universe view
 */
function showNotification(message, duration = 2000) {
    // Create or update notification element
    let notif = document.getElementById('universe-notification');
    if (!notif) {
        notif = document.createElement('div');
        notif.id = 'universe-notification';
        notif.style.cssText = `
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: rgba(0, 0, 0, 0.85);
            color: #fff;
            padding: 20px 30px;
            border-radius: 10px;
            font-family: monospace;
            font-size: 16px;
            z-index: 1000;
            white-space: pre-line;
            text-align: center;
            border: 2px solid #0ff;
            box-shadow: 0 0 20px rgba(0, 255, 255, 0.3);
        `;
        universeState.container.appendChild(notif);
    }
    
    notif.textContent = message;
    notif.style.display = 'block';
    
    // Auto-hide after duration
    setTimeout(() => {
        notif.style.display = 'none';
    }, duration);
}

// =====================================================
// PUBLIC API
// =====================================================

/**
 * Enable keyboard navigation mode
 */
export function enterFlyMode() {
    universeState.flyMode = true;
    if (universeState.hudElement) {
        universeState.hudElement.classList.add('flying');
    }
    console.log('Fly mode enabled - use WASD to move');
}

/**
 * Disable keyboard navigation mode
 */
export function exitFlyMode() {
    universeState.flyMode = false;
    if (universeState.hudElement) {
        universeState.hudElement.classList.remove('flying');
    }
}

/**
 * Set callback for graph selection
 */
export function setOnGraphSelect(callback) {
    universeState.onGraphSelect = callback;
}

/**
 * Set callback for graph hover
 */
export function setOnGraphHover(callback) {
    universeState.onGraphHover = callback;
}

/**
 * Set callback for "Load in Build" button
 */
export function setOnLoadInBuild(callback) {
    universeState.onLoadInBuild = callback;
}

/**
 * Navigate to a specific galaxy
 */
export function navigateToGalaxy(familyName) {
    if (!familyName) {
        // Reset to origin and 3D mode
        universeState.camera.position.set(0, 100, 200);
        if (universeState.controls && universeState.controls.target) {
            universeState.controls.target.set(0, 0, 0);
            // Re-enable rotation (back to 3D mode)
            universeState.controls.enableRotate = true;
        }
        // Reset projection state to 3D
        universeCurrentProjection = '3d';
        return;
    }
    
    const galaxy = universeState.galaxies.get(familyName);
    if (galaxy) {
        const target = galaxy.center.clone();
        
        // Position camera in front of galaxy
        const cameraPos = target.clone();
        cameraPos.z += CONFIG.galaxyRadius + 80;
        cameraPos.y += 30;
        
        // Move camera
        universeState.camera.position.copy(cameraPos);
        
        // Update OrbitControls target to galaxy center
        if (universeState.controls && universeState.controls.target) {
            universeState.controls.target.copy(target);
        }
        
        console.log('Navigated to galaxy:', familyName);
    }
}

/**
 * Zoom to fit all galaxies in view
 */
export function zoomToFitAll() {
    if (universeState.galaxies.size === 0) return;
    
    // Calculate bounding box of all galaxies
    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;
    let minZ = Infinity, maxZ = -Infinity;
    
    for (const [name, galaxy] of universeState.galaxies) {
        const c = galaxy.center;
        minX = Math.min(minX, c.x);
        maxX = Math.max(maxX, c.x);
        minY = Math.min(minY, c.y);
        maxY = Math.max(maxY, c.y);
        minZ = Math.min(minZ, c.z);
        maxZ = Math.max(maxZ, c.z);
    }
    
    // Calculate center and size
    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;
    const centerZ = (minZ + maxZ) / 2;
    
    const sizeX = maxX - minX;
    const sizeY = maxY - minY;
    const sizeZ = maxZ - minZ;
    const maxSize = Math.max(sizeX, sizeY, sizeZ);
    
    // Position camera to see everything
    const distance = maxSize * 1.2 + 200;
    
    universeState.camera.position.set(centerX, centerY + distance * 0.3, centerZ + distance);
    
    if (universeState.controls && universeState.controls.target) {
        universeState.controls.target.set(centerX, centerY, centerZ);
    }
    
    console.log('Zoomed to fit all galaxies');
}

/**
 * Set camera to a specific projection view (Universe)
 * @param {string} projection - 'xy', 'xz', 'yz', or '3d'
 */
let universeCurrentProjection = '3d';

export function setUniverseCameraProjection(projection) {
    if (!universeState.camera || !universeState.controls) return;
    
    universeCurrentProjection = projection;
    
    // Cancel any active rubber band to prevent frozen state
    if (universeState.rubberBand?.active) {
        universeState.rubberBand.active = false;
        if (universeState.rubberBandOverlay) {
            universeState.rubberBandOverlay.style.display = 'none';
        }
    }
    
    // Ensure controls are fully enabled
    universeState.controls.enabled = true;
    universeState.controls.enablePan = true;
    universeState.controls.enableZoom = true;
    
    // For 2D views: disable rotation so left-drag pans instead of rotates
    // For 3D view: enable rotation
    if (projection === '3d') {
        universeState.controls.enableRotate = true;
    } else {
        universeState.controls.enableRotate = false;
    }
    
    // Calculate scene bounds
    let minX = 0, maxX = 0, minY = 0, maxY = 0, minZ = 0, maxZ = 0;
    
    if (universeState.galaxies.size > 0) {
        minX = Infinity; maxX = -Infinity;
        minY = Infinity; maxY = -Infinity;
        minZ = Infinity; maxZ = -Infinity;
        
        for (const [name, galaxy] of universeState.galaxies) {
            const c = galaxy.center;
            minX = Math.min(minX, c.x);
            maxX = Math.max(maxX, c.x);
            minY = Math.min(minY, c.y);
            maxY = Math.max(maxY, c.y);
            minZ = Math.min(minZ, c.z);
            maxZ = Math.max(maxZ, c.z);
        }
    }
    
    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;
    const centerZ = (minZ + maxZ) / 2;
    const center = new THREE.Vector3(centerX, centerY, centerZ);
    
    const sizeX = maxX - minX || 100;
    const sizeY = maxY - minY || 100;
    const sizeZ = maxZ - minZ || 100;
    const maxSize = Math.max(sizeX, sizeY, sizeZ, 200);
    const distance = maxSize * 1.5;
    
    let targetPos;
    
    switch (projection) {
        case 'xy': // View from front (looking at XY plane, camera on +Z)
            targetPos = new THREE.Vector3(centerX, centerY, centerZ + distance);
            break;
        case 'xz': // View from above (looking at XZ plane, camera on +Y)
            targetPos = new THREE.Vector3(centerX, centerY + distance, centerZ + 0.001);
            break;
        case 'yz': // View from side (looking at YZ plane, camera on +X)
            targetPos = new THREE.Vector3(centerX + distance, centerY, centerZ);
            break;
        case '3d':
        default:
            targetPos = new THREE.Vector3(
                centerX + distance * 0.5,
                centerY + distance * 0.3,
                centerZ + distance * 0.8
            );
            break;
    }
    
    // Animate camera transition
    animateUniverseCameraTo(targetPos, center);
    
    console.log(`[UNIVERSE CAMERA] Projection: ${projection}, rotate: ${universeState.controls.enableRotate}`);
}

/**
 * Animate universe camera to target position
 */
function animateUniverseCameraTo(targetPos, targetLookAt) {
    const startPos = universeState.camera.position.clone();
    const startTarget = universeState.controls.target.clone();
    const duration = 600; // ms
    const startTime = performance.now();
    
    function animateStep() {
        const elapsed = performance.now() - startTime;
        const t = Math.min(elapsed / duration, 1);
        
        // Ease out cubic
        const easeT = 1 - Math.pow(1 - t, 3);
        
        universeState.camera.position.lerpVectors(startPos, targetPos, easeT);
        universeState.controls.target.lerpVectors(startTarget, targetLookAt, easeT);
        universeState.controls.update();
        
        if (t < 1) {
            requestAnimationFrame(animateStep);
        }
    }
    
    animateStep();
}

/**
 * Get current universe projection mode
 */
export function getUniverseCurrentProjection() {
    return universeCurrentProjection;
}

/**
 * Navigate to a specific graph node
 */
export function navigateToGraph(graphId) {
    const nodeData = universeState.graphNodes.get(graphId);
    if (nodeData && nodeData.mesh) {
        const worldPos = new THREE.Vector3();
        nodeData.mesh.getWorldPosition(worldPos);
        
        const target = worldPos.clone();
        target.z += 50;
        
        universeState.camera.position.copy(target);
        universeState.camera.lookAt(worldPos);
        
        selectNode(nodeData.mesh);
    }
}

/**
 * Get current universe state
 */
export function getUniverseState() {
    return {
        active: universeState.active,
        galaxyCount: universeState.galaxies.size,
        graphCount: universeState.graphNodes.size,
        cameraPosition: universeState.camera?.position.clone(),
        selectedGraphId: universeState.selectedNode?.userData.graphId,
        spectralMode: true  // Always spectral mode now
    };
}

/**
 * Resize handler (call when container size changes)
 */
export function resizeUniverse() {
    onWindowResize();
}

/**
 * NEW: Get metrics for a specific graph
 * @param {string} graphId - ID of the graph
 * @returns {Object|null} Metrics object or null if not found
 */
export function getGraphMetrics(graphId) {
    const nodeData = universeState.graphNodes.get(graphId);
    return nodeData?.metrics || null;
}

/**
 * NEW: Get all graph metrics
 * @returns {Map} Map of graphId -> metrics
 */
export function getAllGraphMetrics() {
    const metricsMap = new Map();
    universeState.graphNodes.forEach((nodeData, graphId) => {
        if (nodeData.metrics) {
            metricsMap.set(graphId, nodeData.metrics);
        }
    });
    return metricsMap;
}

// =====================================================
// CUSTOM GRAPHS & NODE-EDGE RENDERING
// =====================================================

/**
 * Add a custom graph from Build tab to Universe
 * @param {Object} graphData - Graph data with n, edges, name, eigenvalues
 * @param {boolean} expanded - Whether to show as node-edge graph (true) or bubble (false)
 * @returns {string} Graph ID
 */
export function addCustomGraph(graphData, expanded = true) {
    if (!universeState.active || !graphData) {
        console.error('Cannot add custom graph: universe not active or no graph data');
        return null;
    }
    
    // Generate unique ID
    const graphId = `custom_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Calculate spectral metrics for this graph
    const metrics = calculateSingleGraphMetrics(graphData);
    console.log(`Custom graph metrics: α=${metrics.alpha.toFixed(2)}, rat=${(metrics.rationality*100).toFixed(0)}%, ρ=${metrics.spectralRadius.toFixed(2)}`);
    
    // Determine the family base name (for coloring and labeling)
    const familyBase = getFamilyBase(graphData.family);
    
    // Use the same dynamic positioning as library graphs
    const position = computeGraphPosition(metrics);
    
    const axes = CONFIG.galaxyAxes;
    const xVal = getMetricValue(metrics, axes.x);
    const yVal = getMetricValue(metrics, axes.y);
    const zVal = getMetricValue(metrics, axes.z);
    console.log(`  Position: ${axes.x}=${xVal.toFixed(2)}, ${axes.y}=${yVal.toFixed(2)}, ${axes.z}=${zVal.toFixed(2)} → (${position.x.toFixed(1)}, ${position.y.toFixed(1)}, ${position.z.toFixed(1)})`);
    
    // Create the graph visualization
    let graphMesh;
    if (expanded) {
        console.log(`  Creating EXPANDED (node-edge) mesh for "${graphData.name}"`);
        graphMesh = createExpandedGraphMesh(graphData, metrics);
    } else {
        // Get color based on family or use cyan for custom
        const family = graphData.family || 'Unknown';
        const familyConfig = GALAXY_FAMILIES[family];
        const nodeColor = familyConfig?.color || 0x00ffff;
        console.log(`  Creating BUBBLE (wireframe) mesh for "${graphData.name}", family="${family}", color=0x${nodeColor.toString(16).padStart(6, '0')}, config=${familyConfig ? 'FOUND' : 'NOT_FOUND'}`);
        graphMesh = createGraphNode(graphData, nodeColor, metrics);
    }
    
    graphMesh.position.copy(position);
    graphMesh.userData.graphId = graphId;
    graphMesh.userData.isCustom = true;
    graphMesh.userData.expanded = expanded;
    
    universeState.scene.add(graphMesh);
    
    // Store in graphNodes
    universeState.graphNodes.set(graphId, {
        mesh: graphMesh,
        data: {
            ...graphData,
            id: graphId,
            family: graphData.family || 'Custom',
            name: graphData.name || `Custom G(${graphData.n}, ${graphData.edges?.length || 0})`,
            isCustom: true,  // Mark as custom for analytic highlight mode
            isBuilt: true    // Also mark as built
        },
        galaxy: familyBase,  // Family name for coloring/grouping
        metrics: metrics,
        expanded: expanded
    });
    
    // Add label - higher for expanded graphs
    const label = createTextSprite(graphData.name || 'Custom', 0x00ffff, 0.6);
    label.position.copy(position);
    label.position.y += expanded ? 35 : 18;
    universeState.scene.add(label);
    graphMesh.userData.label = label;
    
    console.log(`Added custom graph "${graphData.name}" at position (${position.x.toFixed(1)}, ${position.y.toFixed(1)}, ${position.z.toFixed(1)})`);
    
    return graphId;
}

/**
 * Get the base family name that maps to GALAXY_FAMILIES
 */
function getFamilyBase(family) {
    if (!family) return 'Unknown';
    
    const familyLower = family.toLowerCase();
    
    // Use same logic as groupGraphsByFamily
    if (family.includes('□')) return 'Cartesian Product';
    if (family.includes('×') || family.includes('⊗')) return 'Tensor Product';
    if (family.startsWith('Line(') || familyLower.includes('line graph')) return 'Line Graph';
    if (familyLower.includes('complement')) return 'Complement';
    if (familyLower.includes('mechanism') || familyLower.includes('bar')) return 'Mechanism';
    if (familyLower.includes('pendulum') || familyLower.includes('link')) return 'Pendulum';
    if (familyLower.includes('path')) return 'Path';
    if (familyLower.includes('cycle') || familyLower.includes('ring')) return 'Cycle';
    if (familyLower.includes('star')) return 'Star';
    if (familyLower.includes('wheel')) return 'Wheel';
    if (familyLower.includes('ladder')) return 'Ladder';
    if (familyLower.includes('grid') || familyLower.includes('mesh') || familyLower.includes('lattice')) return 'Grid';
    if (familyLower.includes('prism')) return 'Prism';
    if (familyLower.includes('hypercube') || familyLower.includes('cube')) return 'Hypercube';
    if (familyLower.includes('tree')) return familyLower.includes('binary') ? 'Binary Tree' : 'Tree';
    if (familyLower.includes('petersen')) return 'Petersen';
    if (familyLower.includes('möbius') || familyLower.includes('mobius')) return 'Möbius';
    if (familyLower.includes('circulant')) return 'Circulant';
    if (familyLower.includes('crown')) return 'Crown';
    if (familyLower.includes('book')) return 'Book';
    if (familyLower.includes('fan')) return 'Fan';
    if (familyLower.includes('gear')) return 'Gear';
    if (familyLower.includes('helm')) return 'Helm';
    if (familyLower.includes('friendship') || familyLower.includes('windmill')) return 'Friendship';
    if (familyLower.includes('turán') || familyLower.includes('turan')) return 'Turán';
    if (familyLower.includes('empty') || familyLower.includes('null')) return 'Empty';
    if (familyLower.includes('complete') && familyLower.includes('bipartite')) return 'Complete Bipartite';
    if (familyLower.includes('complete')) return 'Complete';
    if (familyLower.includes('bipartite')) return 'Bipartite';
    
    // Check if the first word is a known family
    const firstWord = family.split(' ')[0];
    if (GALAXY_FAMILIES[firstWord]) return firstWord;
    
    return 'Unknown';
}

/**
 * Refresh/recreate the universe axes to encompass all current graphs
 * Call this after adding multiple custom graphs to update axis bounds
 */
export function refreshUniverseAxes() {
    if (!universeState.active) {
        console.warn('Cannot refresh axes: universe not active');
        return;
    }
    console.log('Refreshing universe axes to encompass all graphs...');
    createUniverseAxes();
}

/**
 * Calculate metrics for a single graph
 * ALWAYS computes skew-symmetric eigenvalues (ignores stored symmetric eigenvalues)
 */
function calculateSingleGraphMetrics(graphData) {
    const n = graphData.n || 0;
    const edges = graphData.edges || [];
    const edgeCount = edges.length;
    const maxEdges = n * (n - 1) / 2;
    const density = maxEdges > 0 ? edgeCount / maxEdges : 0;
    const debugName = graphData.name || graphData.family || `Custom G(${n})`;
    
    // Calculate degrees
    const degrees = new Array(n).fill(0);
    for (const [i, j] of edges) {
        degrees[i]++;
        degrees[j]++;
    }
    const avgDegree = n > 0 ? degrees.reduce((a, b) => a + b, 0) / n : 0;
    const maxDegree = Math.max(...degrees, 0);
    const minDegree = Math.min(...degrees, Infinity);
    const regularity = maxDegree > 0 ? minDegree / maxDegree : 1;
    
    // Initialize metrics
    let spectralRadius = 0;
    let spectralGap = 0;
    let energy = 0;
    let rationality = 0;
    let rationalCount = 0;
    let eigenvalueRatio = 0;  // Ratio of largest to smallest non-zero eigenvalue
    let computedEigenvalues = null;
    
    // ALWAYS compute skew-symmetric eigenvalues from the adjacency matrix
    // (ignore any stored eigenvalues - they may be symmetric, not skew-symmetric)
    if (edges.length > 0 && n > 0 && n <= 200) {
        try {
            // Build skew-symmetric adjacency matrix
            const matrix = Array(n).fill(null).map(() => Array(n).fill(0));
            for (const [i, j] of edges) {
                if (i < n && j < n) {
                    matrix[i][j] = 1;
                    matrix[j][i] = -1;
                }
            }
            
            // Compute eigenvalues using spectral analysis
            const skewEigs = computeSkewSymmetricEigenvalues(matrix);
            if (skewEigs && skewEigs.length > 0) {
                // Extract imaginary parts (skew-symmetric has pure imaginary eigenvalues)
                computedEigenvalues = skewEigs.map(e => Math.abs(e.imag || e.value || e)).filter(v => isFinite(v));
                console.log(`  [SINGLE METRICS] ${debugName}: COMPUTED ${computedEigenvalues.length} skew-sym eigenvalues`);
            }
        } catch (err) {
            console.warn(`  [SINGLE METRICS] ${debugName}: Failed to compute eigenvalues:`, err.message);
        }
    }
    
    // Process computed eigenvalues
    if (computedEigenvalues && computedEigenvalues.length > 0) {
        const sorted = [...computedEigenvalues].sort((a, b) => Math.abs(b) - Math.abs(a));
        
        spectralRadius = Math.abs(sorted[0]);
        spectralGap = sorted.length > 1 ? Math.abs(sorted[0]) - Math.abs(sorted[1]) : 0;
        energy = computedEigenvalues.reduce((sum, λ) => sum + Math.abs(λ), 0);
        
        // Calculate eigenvalue ratio: largest / smallest non-zero
        const nonZeroSorted = sorted.filter(v => Math.abs(v) > 1e-10);
        if (nonZeroSorted.length >= 2) {
            const largestAbs = Math.abs(nonZeroSorted[0]);
            const smallestAbs = Math.abs(nonZeroSorted[nonZeroSorted.length - 1]);
            eigenvalueRatio = smallestAbs > 1e-10 ? largestAbs / smallestAbs : 0;
        } else if (nonZeroSorted.length === 1) {
            eigenvalueRatio = 1;
        }
        
        // Calculate rationality
        for (const eig of computedEigenvalues) {
            if (isSimpleRational(eig)) {
                rationalCount++;
            }
        }
        rationality = computedEigenvalues.length > 0 ? rationalCount / computedEigenvalues.length : 0;
        
        console.log(`  [SINGLE METRICS] ${debugName}: ρ=${spectralRadius.toFixed(3)}, E=${energy.toFixed(2)}, ratio=${eigenvalueRatio.toFixed(3)}`);
    }
    
    // FALLBACK: Estimate only if computation failed
    if (spectralRadius === 0 && edgeCount > 0) {
        console.warn(`  [SINGLE METRICS] ${debugName}: FALLBACK to estimation`);
        spectralRadius = Math.sqrt(maxDegree * avgDegree) || avgDegree;
        energy = 2 * edgeCount * 0.8;
        rationality = density > 0.5 ? 0.4 : 0.2;
    }
    
    // Estimate alpha (scaling exponent) based on graph structure
    let alpha;
    if (graphData.expectedAlpha !== undefined) {
        // Use provided alpha for test/analytical graphs
        alpha = graphData.expectedAlpha;
        console.log(`  Using provided α = ${alpha}`);
    } else if (n <= 1) {
        alpha = 0.5;
    } else if (density > 0.8) {
        // Near-complete graphs have α ≈ 1
        alpha = 0.8 + density * 0.2;
    } else if (regularity > 0.9 && density < 0.3) {
        // Regular sparse graphs (like cycles) have α ≈ 0
        alpha = 0.1;
    } else if (maxDegree > n * 0.5) {
        // Star-like graphs have α close to 1
        alpha = 0.7 + (maxDegree / n) * 0.3;
    } else {
        // Tree-like/general sparse graphs have α ≈ 0.5
        alpha = 0.3 + density * 0.4;
    }
    
    // Clamp alpha to [0, 1]
    alpha = Math.max(0, Math.min(1, alpha));
    
    return {
        n,
        edgeCount,
        density,
        avgDegree,
        maxDegree,
        regularity,
        spectralRadius,
        spectralGap,
        energy,
        eigenvalueRatio,
        alpha,
        rationality,
        // Family and name for positioning
        family: graphData.family || 'Unknown',
        name: graphData.name || `G(${n}, ${edgeCount})`,
        // Additional metrics for axis mapping
        avgSpectralRadius: spectralRadius,
        avgSpectralGap: spectralGap,
        avgEnergy: energy,
        avgEigenvalueRatio: eigenvalueRatio,
        // Normalized spectral radius for spectral mode coloring (normalize by max possible: n-1)
        normalizedSpectralRadius: n > 1 ? spectralRadius / (n - 1) : 0.5
    };
}


/**
 * Create an expanded node-edge graph mesh for Universe display
 */
function createExpandedGraphMesh(graphData, metrics) {
    const group = new THREE.Group();
    group.userData.type = 'expandedGraph';
    
    const n = graphData.n || 0;
    const edges = graphData.edges || [];
    const scale = Math.max(8, Math.min(20, 5 + n * 0.8)); // Scale based on vertex count
    
    // Generate positions (circular layout)
    const positions = [];
    for (let i = 0; i < n; i++) {
        const angle = (2 * Math.PI * i) / n;
        positions.push(new THREE.Vector3(
            Math.cos(angle) * scale,
            Math.sin(angle) * scale,
            0
        ));
    }
    
    // Create vertices
    const vertexGeom = new THREE.SphereGeometry(1.2, 12, 12);
    const vertexMat = new THREE.MeshPhongMaterial({
        color: 0x00ffff,
        emissive: 0x004444,
        emissiveIntensity: 0.5,
        shininess: 80
    });
    
    for (let i = 0; i < n; i++) {
        const vertex = new THREE.Mesh(vertexGeom, vertexMat.clone());
        vertex.position.copy(positions[i]);
        vertex.userData.vertexIndex = i;
        group.add(vertex);
    }
    
    // Create edges
    const edgeMat = new THREE.LineBasicMaterial({ 
        color: 0xff6666, 
        transparent: true, 
        opacity: 0.8 
    });
    
    for (const [i, j] of edges) {
        if (i < n && j < n) {
            const points = [positions[i], positions[j]];
            const edgeGeom = new THREE.BufferGeometry().setFromPoints(points);
            const edge = new THREE.Line(edgeGeom, edgeMat);
            group.add(edge);
        }
    }
    
    // Add an invisible bounding sphere for raycasting/selection only
    // (not visible - just for click detection)
    const boundingGeom = new THREE.SphereGeometry(scale * 1.3, 8, 8);
    const boundingMat = new THREE.MeshBasicMaterial({
        visible: false  // Completely invisible, but still raycastable
    });
    const boundingSphere = new THREE.Mesh(boundingGeom, boundingMat);
    boundingSphere.userData.isSelectionBounds = true;
    group.add(boundingSphere);
    
    return group;
}

/**
 * Toggle a graph between expanded (node-edge) and collapsed (bubble) view
 */
export function toggleGraphExpanded(graphId) {
    const nodeData = universeState.graphNodes.get(graphId);
    if (!nodeData) return false;
    
    const currentExpanded = nodeData.expanded;
    const graphData = nodeData.data;
    const metrics = nodeData.metrics;
    
    // Get WORLD position (not local position within galaxy group)
    const worldPosition = new THREE.Vector3();
    nodeData.mesh.getWorldPosition(worldPosition);
    
    console.log(`Toggle expand: "${graphData.name}" at world pos (${worldPosition.x.toFixed(1)}, ${worldPosition.y.toFixed(1)}, ${worldPosition.z.toFixed(1)})`);
    
    // Remove old mesh from its parent (could be scene or galaxy group)
    if (nodeData.mesh.parent) {
        nodeData.mesh.parent.remove(nodeData.mesh);
    }
    if (nodeData.mesh.userData.label) {
        universeState.scene.remove(nodeData.mesh.userData.label);
    }
    
    // Create new mesh
    let newMesh;
    if (currentExpanded) {
        // Collapse to bubble - get color based on family
        const familyConfig = GALAXY_FAMILIES[graphData.family] || GALAXY_FAMILIES['Unknown'];
        const nodeColor = familyConfig?.color || 0x00ffff;
        newMesh = createGraphNode(graphData, nodeColor, metrics);
    } else {
        // Expand to node-edge
        newMesh = createExpandedGraphMesh(graphData, metrics);
    }
    
    // Set world position and add directly to scene (not to galaxy group)
    newMesh.position.copy(worldPosition);
    newMesh.userData.graphId = graphId;
    newMesh.userData.isCustom = nodeData.mesh.userData.isCustom;
    newMesh.userData.expanded = !currentExpanded;
    
    universeState.scene.add(newMesh);
    
    // Add label at world position - higher for expanded graphs
    const label = createTextSprite(graphData.name || 'Graph', 0x00ffff, 0.6);
    label.position.copy(worldPosition);
    // Expanded graphs need label higher above the structure
    label.position.y += !currentExpanded ? 35 : 18;  // !currentExpanded means we're expanding
    universeState.scene.add(label);
    newMesh.userData.label = label;
    
    // Update stored data
    nodeData.mesh = newMesh;
    nodeData.expanded = !currentExpanded;
    
    console.log(`Graph "${graphData.name}" ${!currentExpanded ? 'expanded' : 'collapsed'} at (${worldPosition.x.toFixed(1)}, ${worldPosition.y.toFixed(1)}, ${worldPosition.z.toFixed(1)})`);
    return true;
}

/**
 * Expand or collapse all graphs in the universe
 * @param {boolean} expand - true to expand, false to collapse
 * @param {string} galaxyFilter - "__all__" for all galaxies, or specific family name
 */
export function expandCollapseAll(expand, galaxyFilter = '__all__') {
    const statusEl = document.getElementById('expand-status');
    let count = 0;
    const skippedGraphs = [];  // Track which graphs couldn't expand
    
    const graphsToProcess = [];
    
    // Collect all graphs that need to be toggled
    universeState.graphNodes.forEach((nodeData, graphId) => {
        const graphData = nodeData.data;
        if (!graphData) return;
        
        // Check galaxy filter
        if (galaxyFilter !== '__all__' && graphData.family !== galaxyFilter) {
            return;
        }
        
        // Check if graph has edge data (can be expanded)
        if (!graphData.edges || graphData.edges.length === 0) {
            skippedGraphs.push(graphData.name || graphId);
            return;
        }
        
        // Check if already in desired state
        const currentlyExpanded = nodeData.expanded || false;
        if (currentlyExpanded === expand) {
            return;  // Already in desired state
        }
        
        graphsToProcess.push(graphId);
    });
    
    // Log skipped graphs
    if (skippedGraphs.length > 0) {
        console.warn(`${skippedGraphs.length} graphs cannot be ${expand ? 'expanded' : 'collapsed'} (no edge data):`, 
                    skippedGraphs.slice(0, 10).join(', ') + (skippedGraphs.length > 10 ? '...' : ''));
    }
    
    // Update status
    if (statusEl) {
        const skipNote = skippedGraphs.length > 0 ? ` (${skippedGraphs.length} skipped)` : '';
        statusEl.textContent = `Processing ${graphsToProcess.length} graphs...${skipNote}`;
    }
    
    // Process graphs with slight delay to prevent freezing
    let processed = 0;
    const processNext = () => {
        if (processed >= graphsToProcess.length) {
            // Done!
            const action = expand ? 'expanded' : 'collapsed';
            const filterText = galaxyFilter === '__all__' ? 'all galaxies' : galaxyFilter;
            console.log(`${action} ${processed} graphs in ${filterText}`);
            if (statusEl) {
                const skipNote = skippedGraphs.length > 0 ? ` (${skippedGraphs.length} no edges)` : '';
                statusEl.textContent = `${action.charAt(0).toUpperCase() + action.slice(1)} ${processed}${skipNote}`;
                setTimeout(() => { statusEl.textContent = ''; }, 4000);
            }
            return;
        }
        
        const graphId = graphsToProcess[processed];
        toggleGraphExpanded(graphId);
        processed++;
        count++;
        
        // Update progress
        if (statusEl && processed % 10 === 0) {
            statusEl.textContent = `Processing ${processed}/${graphsToProcess.length}...`;
        }
        
        // Process in batches to keep UI responsive
        if (processed % 5 === 0) {
            setTimeout(processNext, 10);
        } else {
            processNext();
        }
    };
    
    if (graphsToProcess.length === 0) {
        const action = expand ? 'expand' : 'collapse';
        if (statusEl) {
            statusEl.textContent = `No graphs to ${action}`;
            setTimeout(() => { statusEl.textContent = ''; }, 2000);
        }
        return;
    }
    
    processNext();
}

/**
 * Update the galaxy dropdown with current galaxy names
 */
export function updateGalaxyDropdown() {
    const select = document.getElementById('expand-galaxy-select');
    if (!select) return;
    
    // Keep "All Galaxies" option
    select.innerHTML = '<option value="__all__">All Galaxies</option>';
    
    // Get unique family names from graph nodes
    const families = new Set();
    universeState.graphNodes.forEach((nodeData, graphId) => {
        if (nodeData.data?.family) {
            families.add(nodeData.data.family);
        }
    });
    
    // Also include galaxy names
    universeState.galaxies.forEach((galaxy, name) => {
        families.add(name);
    });
    
    // Add sorted options
    const sortedFamilies = [...families].sort();
    for (const family of sortedFamilies) {
        const option = document.createElement('option');
        option.value = family;
        option.textContent = family;
        select.appendChild(option);
    }
    
    console.log(`Galaxy dropdown updated with ${sortedFamilies.length} families`);
}

/**
 * Get list of graphs that cannot be expanded (missing edge data)
 * Useful for debugging and identifying incomplete graph entries
 */
export function getGraphsWithoutEdges() {
    const noEdges = [];
    
    universeState.graphNodes.forEach((nodeData, graphId) => {
        const graphData = nodeData.data;
        if (!graphData) return;
        
        if (!graphData.edges || graphData.edges.length === 0) {
            noEdges.push({
                id: graphId,
                name: graphData.name || 'Unknown',
                family: graphData.family || 'Unknown',
                n: graphData.n,
                hasEigenvalues: graphData.eigenvalues?.length > 0
            });
        }
    });
    
    console.log(`Found ${noEdges.length} graphs without edge data:`);
    console.table(noEdges);
    
    return noEdges;
}

/**
 * Remove a custom graph from Universe
 */
export function removeCustomGraph(graphId) {
    const nodeData = universeState.graphNodes.get(graphId);
    if (!nodeData || !nodeData.mesh.userData.isCustom) return false;
    
    universeState.scene.remove(nodeData.mesh);
    if (nodeData.mesh.userData.label) {
        universeState.scene.remove(nodeData.mesh.userData.label);
    }
    universeState.graphNodes.delete(graphId);
    
    console.log(`Removed custom graph: ${graphId}`);
    return true;
}

/**
 * Get all custom graphs
 */
export function getCustomGraphs() {
    const customGraphs = [];
    universeState.graphNodes.forEach((nodeData, graphId) => {
        if (nodeData.mesh.userData.isCustom) {
            customGraphs.push({
                id: graphId,
                data: nodeData.data,
                metrics: nodeData.metrics,
                expanded: nodeData.expanded
            });
        }
    });
    return customGraphs;
}

// =====================================================
// SPECTRAL POSITIONING VERIFICATION (v35)
// =====================================================

/**
 * Verify spectral positioning accuracy for all graphs
 * Call this from console: verifySpectralPositioning()
 */
export function verifySpectralPositioning() {
    console.log('\n========== SPECTRAL POSITIONING VERIFICATION ==========\n');
    
    const axes = CONFIG.galaxyAxes;
    const globalStats = universeState.globalMetricStats;
    
    console.log(`Current Axes: X=${axes.x}, Y=${axes.y}, Z=${axes.z}`);
    console.log(`Galaxy Scale: X=${CONFIG.galaxyScale.x}, Y=${CONFIG.galaxyScale.y}, Z=${CONFIG.galaxyScale.z}`);
    
    if (globalStats) {
        console.log('\nGlobal Stats:');
        for (const [key, stat] of Object.entries(globalStats)) {
            if (stat.min !== Infinity) {
                console.log(`  ${key}: [${stat.min.toFixed(3)}, ${stat.max.toFixed(3)}]`);
            }
        }
    }
    
    console.log('\n--- GALAXY POSITIONS (Family Averages) ---');
    const galaxyPositions = [];
    universeState.galaxies.forEach((galaxy, familyName) => {
        const m = galaxy.galaxyMetrics || {};
        const pos = galaxy.center;
        galaxyPositions.push({
            family: familyName,
            avgRho: m.avgSpectralRadius || 0,
            alpha: m.alpha || 0,
            rationality: m.rationality || 0,
            pos: pos
        });
    });
    
    // Sort by avgSpectralRadius
    galaxyPositions.sort((a, b) => a.avgRho - b.avgRho);
    for (const g of galaxyPositions) {
        console.log(`${g.family.padEnd(20)} | ρ̄=${g.avgRho.toFixed(2).padStart(5)} | α=${g.alpha.toFixed(2)} | ` +
                    `Z=${g.pos?.z?.toFixed(1) || 'N/A'}`);
    }
    
    console.log('\n--- INDIVIDUAL GRAPH POSITIONS (Sorted by ρ) ---');
    const graphData = [];
    universeState.graphNodes.forEach((nodeData, graphId) => {
        const metrics = nodeData.metrics;
        const mesh = nodeData.mesh;
        const worldPos = new THREE.Vector3();
        mesh.getWorldPosition(worldPos);
        
        graphData.push({
            name: nodeData.data?.name || graphId,
            family: nodeData.galaxy,
            rho: metrics?.spectralRadius || 0,
            alpha: metrics?.alpha || 0,
            rationality: metrics?.rationality || 0,
            worldZ: worldPos.z,
            worldY: worldPos.y,
            worldX: worldPos.x
        });
    });
    
    // Sort by spectral radius
    graphData.sort((a, b) => a.rho - b.rho);
    
    console.log('Graph Name'.padEnd(25) + ' | Family'.padEnd(15) + ' | ρ'.padStart(7) + ' | Z-pos'.padStart(8) + ' | Expected Order');
    console.log('-'.repeat(85));
    
    let prevRho = -Infinity;
    let prevZ = -Infinity;
    let errors = 0;
    
    for (let i = 0; i < graphData.length; i++) {
        const g = graphData[i];
        const orderOK = g.worldZ >= prevZ - 0.1 || Math.abs(g.rho - prevRho) < 0.01;  // Allow tolerance
        const status = orderOK ? '✓' : '✗ OUT OF ORDER';
        if (!orderOK) errors++;
        
        console.log(`${g.name.padEnd(25)} | ${g.family.padEnd(13)} | ${g.rho.toFixed(2).padStart(5)} | ${g.worldZ.toFixed(1).padStart(6)} | ${status}`);
        
        prevRho = g.rho;
        prevZ = g.worldZ;
    }
    
    console.log('-'.repeat(85));
    console.log(`Total: ${graphData.length} graphs, ${errors} ordering issues`);
    
    // Key checks
    console.log('\n--- KEY VERIFICATION CHECKS ---');
    
    // Check: All cycles should have same ρ = 2
    const cycles = graphData.filter(g => g.family === 'Cycle');
    if (cycles.length > 0) {
        const cycleRhos = cycles.map(c => c.rho);
        const allSame = cycleRhos.every(r => Math.abs(r - 2) < 0.01);
        console.log(`Cycles (${cycles.length}): ρ values = [${cycleRhos.map(r => r.toFixed(2)).join(', ')}] - ${allSame ? '✓ All ρ=2' : '✗ INCONSISTENT'}`);
    }
    
    // Check: Hypercube Q_d should have ρ = d
    const hypercubes = graphData.filter(g => g.name.includes('Hypercube') || g.name.includes('Q_'));
    if (hypercubes.length > 0) {
        console.log('Hypercubes:');
        for (const h of hypercubes) {
            const match = h.name.match(/Q_(\d+)/);
            if (match) {
                const d = parseInt(match[1]);
                const expected = d;
                const correct = Math.abs(h.rho - expected) < 0.01;
                console.log(`  ${h.name}: ρ=${h.rho.toFixed(2)}, expected=${expected} - ${correct ? '✓' : '✗'}`);
            }
        }
    }
    
    // Check: Complete K_n should have ρ = n-1
    const completes = graphData.filter(g => g.name.includes('Complete K_') || g.name.match(/K_\d+/));
    if (completes.length > 0) {
        console.log('Complete graphs:');
        for (const c of completes) {
            const match = c.name.match(/K_(\d+)/);
            if (match) {
                const n = parseInt(match[1]);
                const expected = n - 1;
                const correct = Math.abs(c.rho - expected) < 0.01;
                console.log(`  ${c.name}: ρ=${c.rho.toFixed(2)}, expected=${expected} - ${correct ? '✓' : '✗'}`);
            }
        }
    }
    
    // Check: Hypercubes should be positioned higher (larger Z) than Cycles
    const avgCycleZ = cycles.length > 0 ? cycles.reduce((s, c) => s + c.worldZ, 0) / cycles.length : 0;
    const avgHypercubeZ = hypercubes.length > 0 ? hypercubes.reduce((s, h) => s + h.worldZ, 0) / hypercubes.length : 0;
    
    if (cycles.length > 0 && hypercubes.length > 0) {
        const q3s = hypercubes.filter(h => h.name.includes('Q_3'));
        if (q3s.length > 0) {
            const q3Z = q3s[0].worldZ;
            const cycleZ = cycles[0].worldZ;
            const correct = q3Z > cycleZ;
            console.log(`\nZ-ordering check: Hypercube Q_3 (ρ=3) at Z=${q3Z.toFixed(1)} vs Cycle (ρ=2) at Z=${cycleZ.toFixed(1)}`);
            console.log(`  ${correct ? '✓ Q_3 correctly above Cycle' : '✗ ERROR: Q_3 should be above Cycle'}`);
        }
    }
    
    console.log('\n========== END VERIFICATION ==========\n');
    
    return { graphData, galaxyPositions, errors };
}

/**
 * Export all Universe graphs to a comprehensive table
 * Returns formatted data for analysis and communication
 */
export function exportUniverseTable() {
    if (!universeState.active || !universeState.graphNodes) {
        console.error('Universe not active');
        return null;
    }
    
    const axes = CONFIG.galaxyAxes;
    const graphs = [];
    
    // Collect all graphs with comprehensive metrics
    for (const [graphId, nodeData] of universeState.graphNodes) {
        const mesh = nodeData.mesh;
        const data = nodeData.data;
        const metrics = nodeData.metrics || {};
        
        // Get world position (= absolute position in pure positioning)
        const worldPos = new THREE.Vector3();
        mesh.getWorldPosition(worldPos);
        
        const n = data.n || metrics.n || 0;
        const rho = metrics.spectralRadius ?? 0;
        const energy = metrics.energy ?? 0;
        
        // Expected position from formula
        const expectedX = n * 8;
        const expectedY = rho * 15;
        const expectedZ = (energy - 8) * 8;
        
        const galaxyName = nodeData.galaxy || 'Unknown';
        
        // Extract eigenvalue info
        let eigenFormula = 'N/A';
        let eigenValues = [];
        if (data.eigenvalues && data.eigenvalues.length > 0) {
            eigenValues = data.eigenvalues.slice(0, 5).map(e => {
                if (typeof e === 'object') {
                    return e.formula || e.value?.toFixed(4) || '?';
                }
                return typeof e === 'number' ? e.toFixed(4) : String(e);
            });
            
            // Try to get formula from analyticalRho
            if (data.analyticalRho) {
                eigenFormula = data.analyticalRho;
            }
        }
        
        graphs.push({
            name: data.name || graphId,
            family: data.family || 'Unknown',
            galaxy: galaxyName,
            n: n,
            edges: data.edges?.length || metrics.edgeCount || 0,
            // Core metrics
            spectralRadius: rho,
            spectralGap: metrics.spectralGap ?? 0,
            energy: energy,
            eigenvalueRatio: metrics.eigenvalueRatio ?? 0,
            density: metrics.density ?? 0,
            alpha: metrics.alpha ?? data.expectedAlpha ?? 0.5,
            rationality: metrics.rationality ?? 0,
            // Actual position
            x: worldPos.x,
            y: worldPos.y,
            z: worldPos.z,
            // Expected position (from formula)
            expectedX: expectedX,
            expectedY: expectedY,
            expectedZ: expectedZ,
            // Formula
            formula: eigenFormula,
            eigenvalues: eigenValues.join('; '),
            // Meta
            isCustom: nodeData.isCustom || mesh.userData?.isCustom || false,
            expanded: nodeData.expanded || false
        });
    }
    
    // Sort by family, then by n
    graphs.sort((a, b) => {
        if (a.family !== b.family) return a.family.localeCompare(b.family);
        return a.n - b.n;
    });
    
    // Generate formatted output (condensed view)
    const header = `Universe Graph Export (${new Date().toISOString()})
Position Formula: X = n×8, Y = ρ×15, Z = (E-8)×8
Total Graphs: ${graphs.length}
${'='.repeat(140)}`;
    
    const tableHeader = [
        'Name'.padEnd(25),
        'Family'.padEnd(12),
        'n'.padStart(4),
        '|E|'.padStart(5),
        'ρ(A)'.padStart(12),
        'Energy'.padStart(8),
        'X'.padStart(8),
        'Y'.padStart(8),
        'Z'.padStart(8)
    ].join(' | ');
    
    const separator = '-'.repeat(140);
    
    const rows = graphs.map(g => [
        g.name.substring(0, 24).padEnd(25),
        g.family.substring(0, 11).padEnd(12),
        String(g.n).padStart(4),
        String(g.edges).padStart(5),
        g.spectralRadius.toFixed(6).padStart(12),
        g.energy.toFixed(2).padStart(8),
        g.x.toFixed(1).padStart(8),
        g.y.toFixed(1).padStart(8),
        g.z.toFixed(1).padStart(8)
    ].join(' | '));
    
    const fullTable = [header, '', tableHeader, separator, ...rows].join('\n');
    
    // Create comprehensive CSV for analysis
    const csvHeader = 'Name,Family,n,Edges,SpectralRadius,SpectralGap,Energy,EigRatio,Density,Alpha,Rationality,X,Y,Z,ExpectedX,ExpectedY,ExpectedZ,Formula,Eigenvalues';
    const csvRows = graphs.map(g => 
        `"${g.name}","${g.family}",${g.n},${g.edges},${g.spectralRadius.toFixed(8)},${g.spectralGap.toFixed(8)},${g.energy.toFixed(4)},${g.eigenvalueRatio.toFixed(4)},${g.density.toFixed(4)},${g.alpha.toFixed(4)},${g.rationality.toFixed(4)},${g.x.toFixed(4)},${g.y.toFixed(4)},${g.z.toFixed(4)},${g.expectedX.toFixed(4)},${g.expectedY.toFixed(4)},${g.expectedZ.toFixed(4)},"${g.formula}","${g.eigenvalues}"`
    );
    const csvContent = [csvHeader, ...csvRows].join('\n');
    
    // Family summary (formerly galaxy summary)
    let familySummary = '\n\n=== FAMILY SUMMARY ===\n';
    const familyStats = new Map();
    for (const g of graphs) {
        if (!familyStats.has(g.family)) {
            familyStats.set(g.family, { count: 0, graphs: [] });
        }
        const stats = familyStats.get(g.family);
        stats.count++;
        stats.graphs.push(`${g.name}(n=${g.n})`);
    }
    
    for (const [name, stats] of familyStats) {
        familySummary += `\n${name}: ${stats.count} graphs\n`;
        familySummary += `  Graphs: ${stats.graphs.join(', ')}\n`;
    }
    
    // Log to console
    console.log('\n' + fullTable + familySummary);
    
    // Create download
    const blob = new Blob([fullTable + familySummary + '\n\n--- CSV FORMAT (for Excel/Python/MATLAB) ---\n\n' + csvContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `universe-graphs-${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    
    // Return structured data for further processing
    return {
        count: graphs.length,
        graphs: graphs,
        families: Array.from(familyStats.entries()).map(([name, stats]) => ({
            name, 
            count: stats.count
        })),
        table: fullTable,
        csv: csvContent
    };
}

/**
 * Verify graph positions and detect discrepancies
 * Compares actual positions to expected positions based on configured axes
 */
export function verifyUniversePositions() {
    if (!universeState.active || !universeState.graphNodes) {
        console.error('Universe not active');
        return null;
    }
    
    const axes = CONFIG.galaxyAxes;
    const graphs = [];
    
    // Collect all graphs with full metrics
    for (const [graphId, nodeData] of universeState.graphNodes) {
        const mesh = nodeData.mesh;
        const data = nodeData.data;
        const metrics = nodeData.metrics || {};
        
        const worldPos = new THREE.Vector3();
        mesh.getWorldPosition(worldPos);
        
        // Expected position from configured axes
        const expectedPos = computeGraphPosition(metrics);
        
        graphs.push({
            id: graphId,
            name: data.name || graphId,
            family: data.family || 'Unknown',
            n: data.n || metrics.n || 0,
            edges: data.edges?.length || metrics.edgeCount || 0,
            spectralRadius: metrics.spectralRadius ?? 0,
            energy: metrics.energy ?? 0,
            // Metric values for current axes
            xMetric: getMetricValue(metrics, axes.x),
            yMetric: getMetricValue(metrics, axes.y),
            zMetric: getMetricValue(metrics, axes.z),
            // Actual position
            actualX: worldPos.x,
            actualY: worldPos.y,
            actualZ: worldPos.z,
            // Expected position
            expectedX: expectedPos.x,
            expectedY: expectedPos.y,
            expectedZ: expectedPos.z,
            isCustom: nodeData.isCustom || mesh.userData?.isCustom || false
        });
    }
    
    console.log('\n' + '='.repeat(80));
    console.log('UNIVERSE POSITION VERIFICATION');
    console.log('='.repeat(80));
    console.log(`\nCurrent Axes: X=${axes.x}, Y=${axes.y}, Z=${axes.z}`);
    console.log(`Log Scale: ${CONFIG.useLogScale ? 'enabled' : 'disabled'}`);
    console.log(`\nTotal graphs: ${graphs.length}`);
    
    // Check each graph
    const discrepancies = [];
    let perfectCount = 0;
    
    for (const g of graphs) {
        const dx = Math.abs(g.actualX - g.expectedX);
        const dy = Math.abs(g.actualY - g.expectedY);
        const dz = Math.abs(g.actualZ - g.expectedZ);
        const dist = Math.sqrt(dx*dx + dy*dy + dz*dz);
        
        if (dist < 0.1) {
            perfectCount++;
        } else {
            discrepancies.push({
                name: g.name,
                family: g.family,
                n: g.n,
                xMetric: g.xMetric,
                yMetric: g.yMetric,
                zMetric: g.zMetric,
                expected: { x: g.expectedX, y: g.expectedY, z: g.expectedZ },
                actual: { x: g.actualX, y: g.actualY, z: g.actualZ },
                distance: dist,
                isCustom: g.isCustom
            });
        }
    }
    
    console.log(`\n✓ ${perfectCount} graphs at correct positions`);
    
    if (discrepancies.length > 0) {
        console.log(`✗ ${discrepancies.length} discrepancies found:\n`);
        for (const d of discrepancies) {
            console.log(`  ${d.name} [${d.family}]${d.isCustom ? ' (custom)' : ''}`);
            console.log(`    ${axes.x}=${d.xMetric?.toFixed(3)}, ${axes.y}=${d.yMetric?.toFixed(3)}, ${axes.z}=${d.zMetric?.toFixed(3)}`);
            console.log(`    Expected: (${d.expected.x.toFixed(1)}, ${d.expected.y.toFixed(1)}, ${d.expected.z.toFixed(1)})`);
            console.log(`    Actual:   (${d.actual.x.toFixed(1)}, ${d.actual.y.toFixed(1)}, ${d.actual.z.toFixed(1)})`);
            console.log(`    Distance: ${d.distance.toFixed(1)} units`);
        }
    } else {
        console.log(`\n✓ All graphs positioned correctly!`);
    }
    
    console.log('='.repeat(80));
    
    return {
        total: graphs.length,
        correct: perfectCount,
        discrepancies: discrepancies
    };
}

/**
 * Debug a specific graph by name pattern
 */
export function debugGraph(namePattern) {
    if (!universeState.active || !universeState.graphNodes) {
        console.error('Universe not active');
        return null;
    }
    
    const pattern = namePattern.toLowerCase();
    const matches = [];
    
    for (const [graphId, nodeData] of universeState.graphNodes) {
        const data = nodeData.data;
        const name = (data.name || graphId).toLowerCase();
        
        if (name.includes(pattern)) {
            const mesh = nodeData.mesh;
            const metrics = nodeData.metrics || {};
            
            const worldPos = new THREE.Vector3();
            mesh.getWorldPosition(worldPos);
            
            const n = data.n || metrics.n || 0;
            const rho = metrics.spectralRadius ?? 0;
            const energy = metrics.energy ?? 0;
            
            // Expected position from formula
            const expectedX = n * 8;
            const expectedY = rho * 15;
            const expectedZ = (energy - 8) * 8;
            
            matches.push({
                name: data.name || graphId,
                family: data.family,
                n: n,
                edges: data.edges?.length || 0,
                position: { x: worldPos.x, y: worldPos.y, z: worldPos.z },
                expected: { x: expectedX, y: expectedY, z: expectedZ },
                metrics: {
                    spectralRadius: metrics.spectralRadius,
                    spectralGap: metrics.spectralGap,
                    energy: metrics.energy,
                    eigenvalueRatio: metrics.eigenvalueRatio,
                    density: metrics.density,
                    alpha: metrics.alpha,
                    rationality: metrics.rationality
                },
                storedEigenvalues: data.eigenvalues?.slice(0, 5)
            });
        }
    }
    
    console.log(`\n========== DEBUG: Graphs matching "${namePattern}" ==========`);
    console.log(`Found ${matches.length} matches\n`);
    console.log(`Position Formula: X = n×8, Y = ρ×15, Z = (E-8)×8\n`);
    
    for (const m of matches) {
        console.log(`--- ${m.name} ---`);
        console.log(`  Family: ${m.family}`);
        console.log(`  n=${m.n}, |E|=${m.edges}`);
        console.log(`  Position:  (${m.position.x.toFixed(2)}, ${m.position.y.toFixed(2)}, ${m.position.z.toFixed(2)})`);
        console.log(`  Expected:  (${m.expected.x.toFixed(2)}, ${m.expected.y.toFixed(2)}, ${m.expected.z.toFixed(2)})`);
        console.log(`  Metrics:`);
        console.log(`    spectralRadius: ${m.metrics.spectralRadius?.toFixed(6)}`);
        console.log(`    energy: ${m.metrics.energy?.toFixed(4)}`);
        console.log(`    spectralGap: ${m.metrics.spectralGap?.toFixed(6)}`);
        console.log(`    eigenvalueRatio: ${m.metrics.eigenvalueRatio?.toFixed(4)}`);
        console.log(`    density: ${m.metrics.density?.toFixed(4)}`);
        console.log(`    alpha: ${m.metrics.alpha?.toFixed(4)}`);
        if (m.storedEigenvalues) {
            console.log(`  Stored eigenvalues: ${JSON.stringify(m.storedEigenvalues)}`);
        }
        console.log('');
    }
    console.log('='.repeat(60) + '\n');
    
    return matches;
}

// =====================================================
// EXPORTS
// =====================================================

export { CONFIG as UNIVERSE_CONFIG, GALAXY_FAMILIES, KNOWN_SCALING_EXPONENTS, GALAXY_AXIS_OPTIONS, AXIS_PRESETS };
