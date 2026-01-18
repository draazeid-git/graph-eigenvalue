/**
 * Main Entry Point
 * Ties together all modules: graph-core, dynamics-animation, matrix-analysis-ui
 * (spectral-analysis is used internally by the other modules)
 */

import * as THREE from 'three';

import {
    state, initScene, animate, controls, camera,
    createVertex, clearGraph, addEdge, clearAllEdges, generateRandomEdges,
    updateAllEdges, updateVertexLabels, setVertexMaterial,
    getCirclePositions, getSpherePositions,
    getConcentricCirclePositions2, getConcentricCirclePositions3,
    getConcentricSpherePositions2,
    startForceLayout, stopForceLayout,
    getIntersectedVertex, getIntersectedEdge,
    VERTEX_RADIUS, Arrow3D,
    removeVertex, addNewVertex, arrangeOnGrid, arrangeOnCircle,
    toggleFaces, setFaceOpacity, updateFaceMeshes, createFaceMeshes,
    setFaceColorBrightness, setFaceColorSaturation, getFaceColorSettings,
    setBackgroundColor, getBackgroundPreset,
    // Snap grid and projection functions (v49)
    showSnapGrid, hideSnapGrid, setSnapToGrid, setSnapGridSize, snapToGrid, getSnapGridState,
    setCameraProjection, getCurrentProjection, getCurrentGridPlane,
    // Rectification support
    rebuildEdgesFromMatrix,
    // Partition coloring (v7.8)
    updateNodePartitionColors, resetNodeColors,
    // Pin/freeze nodes (v7.19)
    togglePinNode, isNodePinned, unpinAllNodes, getPinnedNodeCount
} from './graph-core.js';

import {
    initDynamics, startDynamics, stopDynamics, resetDynamics,
    invalidateCaches, isDynamicsRunning,
    updatePhaseNodeSelectors, clearPhaseTrail, updatePhaseLabels, togglePhaseDiagram,
    resetDynamicsVisuals, getDynamicsState, setDynamicsUpdateCallback,
    setFreezeNodesMode, getFreezeNodesMode
} from './dynamics-animation.js';

import {
    initMatrixAnalysis, updateStats, showAnalysis, showModal, hideModal, initModalPosition,
    initComplexPlane, drawComplexPlane, clearAnalyticCache
} from './matrix-analysis-ui.js';

import {
    findAnalyticGraphs, loadGraphFromResult, cancelSearch,
    initializeDatabase, resetDatabase, getDatabaseStats
} from './graph-finder.js';

import {
    detectPointGraphTopology,
    computeSpectrum,
    computeDirectSum,
    computeNonUniformBounds,
    checkStability,
    compareWithNumerical,
    generatePointGraph,
    formatFormula,
    formatBounds
} from './zeid-rosenberg.js';

import {
    computeSkewSymmetricEigenvalues,
    computeSkewSymmetricEigenvaluesWithMultiplicity
} from './spectral-analysis.js';

// Web Worker manager for eigenvalue computation (large graphs)
import {
    initWorkerPool,
    terminateWorkers,
    computeEigenvalues as computeEigenvaluesAsync,
    computeSkewSymmetricEigenvaluesAsync,
    getPerformanceStats,
    getTierInfo,
    workersAvailable
} from './eigenvalue-worker-manager.js';

import {
    initLibrary, saveLibrary, clearLibrary,
    addToLibrary, addSearchResultsToLibrary, removeFromLibrary,
    getGraphById, getAllGraphs, getLibraryStats,
    filterGraphs, sortGraphs,
    exportGraphToJSON, exportLibraryToJSON, importFromJSON,
    downloadGraphJSON, downloadLibraryJSON, downloadGraphHTML, downloadLibrarySummaryHTML
} from './graph-library.js';

// Physics Engine for realizability analysis
import {
    PhysicsEngine,
    auditCurrentGraph,
    rectifyCurrentGraph,
    getPhysicsEngine,
    isPhysicallyRealizable
} from './physics-engine.js';

// Tutorial System for interactive guided tours
import {
    initTutorialSystem,
    getTutorialEngine,
    getTutorialMenu,
    TOURS
} from './tutorial-system.js';

// =====================================================
// DOM ELEMENT REFERENCES
// =====================================================

// Container
let container;

// Graph generation controls
let numVerticesInput, radiusInput, layoutTypeSelect;
let concentricOptions, innerRatioInput, innerRatioLabel;
let middleRatioContainer, middleRatioInput, middleRatioLabel;
let splitModeSelect, customSplitContainer, customSplitInput;
let generateBtn;

// Force layout
let forceLayoutBtn, stopForceBtn, forceSpeedInput, force3DCheckbox;
let unpinAllBtn, pinCountLabel;

// Face rendering (Solid Polyhedron Mode)
let solidFacesCheckbox, faceOptions, faceOpacityInput, faceOpacityLabel, refreshFacesBtn, faceHint;

// Templates
let templateSelect, applyTemplateBtn, skewSymmetricCheckbox;
let templateParams, paramN, paramDepth, paramBranches, paramKary, paramGrid, paramCuboid, paramHypercube, paramGenPetersen, paramLollipop, paramKneser, paramRook, paramNBar, paramNLink, paramDrum;
let templateNInput, treeDepthInput, treeBranchesInput, treeKInput;
let gridRowsInput, gridColsInput;
let cuboidMInput, cuboidNInput, cuboidKInput;
let hypercubeDimInput;
let gpNInput, gpKInput, lollipopMInput, lollipopNInput, kneserNInput, kneserKInput, rookMInput, rookNInput;
let drumBranchesInput, drumRingsInput;

// Universe Integration (Build tab)
let sendToUniverseBtn, saveToLibraryBtn, universeGraphNameInput, testUniverseBtn;

// Graph Finder
let findAnalyticBtn, finderProgress, finderStatus, finderProgressBar;
let finderResults, finderSummary, analyticGraphSelect;
let selectedGraphInfo, graphFamilyDisplay, graphEdgesDisplay, graphEigenvaluesDisplay;
let loadAnalyticGraphBtn, finderConnectedOnlyCheckbox, cancelSearchBtn, finderLayoutSelect;
let finderVerticesInput;
let clearDbBtn;
let discoveredGraphs = []; // Store found graphs

// Edit mode
let addModeCheckbox, deleteModeCheckbox, dragModeCheckbox, modeIndicator;
let addVertexModeBtn, deleteVertexModeBtn;
let arrangeRowsInput, arrangeColsInput, arrangeSpacingInput;
let arrangeGridBtn, arrangeCircleBtn;
let currentEditMode = 'view';  // 'view', 'add', 'delete', 'drag', 'add-vertex', 'delete-vertex'

// Projection buttons (Edit tab)
let projectXYBtn, projectXZBtn, projectYZBtn, project3DBtn;
// Snap grid controls
let snapGridControls, snapGridSizeInput, snapToGridCheckbox;
// Universe projection buttons
let universeProjectXYBtn, universeProjectXZBtn, universeProjectYZBtn, universeProject3DBtn;

// Edge controls
let autoEdgesInput, autoGenerateBtn, clearEdgesBtn;

// Matrix modal
let showMatrixBtn, matrixModal, matrixContent, modalHeader, closeModalBtn;

// Statistics
let statVertices, statEdges, statType;

// Dynamics controls
let startDynamicsBtn, stopDynamicsBtn, resetDynamicsBtn;
let integratorSelect, timestepSelect, dynamicsSpeedInput, dynamicsSpeedLabel;
let arrowScaleInput, arrowScaleLabel, arrowMinLengthInput, arrowMinLabel;

// Dynamics display
let dynamicsTimeDisplay, dynamicsMaxStateDisplay, dynamicsMaxFlowDisplay, dynamicsEnergyDisplay;

// Phase diagram
let phaseModeSelect, animationModeSelect, phaseNodeISelect, phaseNodeJSelect;
let phaseEnabledCheckbox, clearPhaseBtn, phaseCanvas;
let phaseHint, phaseAxisLabels, phaseXLabel, phaseYLabel, phaseModeHint;

// Eigenvalue plot with alpha/beta sliders
let phaseAlphaInput, phaseAlphaLabel, phaseBetaInput, phaseBetaLabel;
let eigenvaluePlotCheckbox, eigenvalueCanvas, eigenvalueCtx;
let evRealMax, evImagMax, stabilityIndicator;
let phaseModeExplanation, animationModeExplanation, animationModeHint;

// Enhanced Visualization Popup
let enhancedVizPopup, openEnhancedVizBtn;
let popupMinimizeBtn, popupMaximizeBtn, popupCloseBtn;
let enhancedPhaseCurrentCanvas, enhancedPhaseMainCanvas;
let enhancedSpectrumCanvas, enhancedTimeseriesCanvas;
let energyBar, energyValue;
let vizShowBounds, vizShowEigenvectors, vizShowGrid, vizZoom, vizZoomLabel;
let enhancedVizActive = false;
let timeSeriesHistory = [];
let timeSeriesTimeStamps = [];
let enhancedPhaseTrail = []; // Separate phase trail for Enhanced Visualization
let initialEnergy = null; // Track initial energy for conservation check
const TIME_SERIES_LENGTH = 200;
const TIME_SERIES_WINDOW = 10.0; // Show 10 seconds of data
const ENHANCED_PHASE_TRAIL_LENGTH = 500; // Phase trail length for enhanced viz

// Bounds tab (Zeid-Rosenberg)
let zrTopologyDisplay, detectTopologyBtn;
let zrAlphaInput, zrBetaInput, zrAlphaSlider, zrBetaSlider, zrAlphaLabel, zrBetaLabel;
let zrEigenvalueCount, computeBoundsBtn;
let zrFormulaDisplay, zrBoundsDisplay, zrStabilityDisplay;
let zrComplexPlane, zrComparisonDisplay, compareBoundsBtn;
let directsumG1Select, directsumG2Select, computeDirectsumBtn, directsumResult;
let currentSpectrum = null;  // Store computed spectrum for reuse

// Library tab
let libTotalDisplay, libFamiliesDisplay;
let librarySearch, libraryFilterN, libraryFilterFamily, librarySort;
let libraryTableBody, librarySelectAll, libraryEmpty;
let libraryLoadSelected, libraryDeleteSelected;
let libraryExportJSON, libraryExportHTML, libraryImportBtn, libraryImportFile;
let libraryClearAll;
let addToLibraryBtn, addAllToLibraryBtn;
let productALibraryGroup, productBLibraryGroup;

// Universe view toggle
let libraryViewTableBtn, libraryViewUniverseBtn;
let universeContainer;
let universeNavControls, universeGalaxyJump, universeResetView, universeZoomFit;

// Physics Engine UI
let physicsPanel, physicsStatusBadge, physicsStatusIndicator, physicsStatusText;
let physicsDimN, physicsDimM, physicsDimViolations;
let physicsViolationsPanel, physicsViolationsList;
let physicsAuditBtn, physicsAutoDiscoverBtn;
let physicsAutoAuditCheckbox;
let physicsBMatrixContainer, physicsBMatrixContent, physicsToggleBMatrixBtn;
let physicsColumnAnalysis, physicsColumnList;
let physicsNValue;
// Rectification UI
let physicsRectifyPrompt, physicsRectifyYesBtn;
let physicsUndoPanel, physicsUndoBtn;
let originalMatrixBackup = null; // Store original matrix for undo
// State visualization
let physicsPStates, physicsQStates;
let physicsNodeGrid, physicsPIndices, physicsQIndices, physicsPartitionContainer;
// Energy plot
let physicsPlayBtn, physicsResetBtn;
let physicsLiveKinetic, physicsLivePotential, physicsLiveTotal;
let physicsEnergyCanvas, physicsTimeValue, physicsConservationStatus;
let currentPhysicsEngine = null;
// Animation state
let physicsAnimationId = null;
let physicsIsPlaying = false;
let physicsTime = 0;
let physicsEnergyHistory = { t: [], T: [], V: [], H: [] };
const PHYSICS_DT = 0.016; // ~60fps timestep
const PHYSICS_HISTORY_LENGTH = 200;
// Custom partition state
let physicsPartition = { pIndices: [], qIndices: [] };

// =====================================================
// INITIALIZATION
// =====================================================

export function init() {
    // Get all DOM elements
    grabDOMElements();
    
    // Initialize slider values explicitly (ensure defaults are respected)
    initializeSliderDefaults();
    
    // Initialize Three.js scene
    initScene(container);
    
    // Initialize dynamics module
    initDynamics({
        integratorSelect,
        timestepSelect,
        dynamicsSpeedInput,
        dynamicsSpeedLabel,
        arrowScaleInput,
        arrowMinLengthInput,
        dynamicsTimeDisplay,
        dynamicsMaxStateDisplay,
        dynamicsMaxFlowDisplay,
        dynamicsEnergyDisplay,
        startDynamicsBtn,
        stopDynamicsBtn,
        phaseModeSelect,
        animationModeSelect,
        phaseNodeISelect,
        phaseNodeJSelect,
        phaseEnabledCheckbox,
        phaseCanvas,
        phaseHint,
        phaseAxisLabels,
        phaseXLabel,
        phaseYLabel,
        phaseModeHint
    });
    
    // Initialize matrix analysis module
    initMatrixAnalysis({
        matrixModal,
        matrixContent,
        modalHeader,
        closeModalBtn,
        statVertices,
        statEdges,
        statType
    });
    
    // Initialize complex plane visualization
    initComplexPlane();
    
    // Initialize graph database for analytic graph finder
    initializeDatabase(7);
    
    // Initialize graph library
    initLibrary();
    
    // Initialize Web Worker pool for eigenvalue computation
    initWorkerPool().then(() => {
        console.log('[Main] Eigenvalue worker pool ready');
    }).catch(err => {
        console.warn('[Main] Worker pool initialization failed, will use main thread:', err);
    });
    
    // Load custom graphs from localStorage and add to library
    loadAndAddCustomGraphs();
    
    // Setup event listeners
    setupEventListeners();
    setupTabs();
    setupBoundsEventListeners();
    setupEnhancedVizPopup();
    setupAdvancedBuildTab();
    setupCopyButtons();
    setupKeyboardShortcuts();
    setupMobileToggle();
    setupLibraryEventListeners();
    setupPhysicsPanel();
    
    // Initialize tutorial system for interactive guided tours
    try {
        initTutorialSystem();
        console.log('[Main] Tutorial system initialized');
    } catch (err) {
        console.error('[Main] Tutorial system failed to initialize:', err);
        // Create a simple fallback button
        const fallbackBtn = document.createElement('button');
        fallbackBtn.className = 'tutorial-help-btn';
        fallbackBtn.innerHTML = '?';
        fallbackBtn.title = 'Tutorials (Error loading)';
        fallbackBtn.style.cssText = 'position:fixed;bottom:20px;right:20px;width:48px;height:48px;border-radius:50%;background:linear-gradient(135deg,#4a9eff,#00d4aa);border:none;color:#fff;font-size:24px;font-weight:bold;cursor:pointer;z-index:9999;';
        fallbackBtn.addEventListener('click', () => alert('Tutorial system failed to load. Please check the console for errors.'));
        document.body.appendChild(fallbackBtn);
    }
    
    // Generate initial graph
    generateGraph();
    updateMode();
    initModalPosition();
    
    // Initialize template preview
    updateTemplatePreview(templateSelect.value);
    
    // Initialize mode explanations (new in v17)
    updatePhaseModeExplanation();
    updateAnimationModeExplanation();
    
    // Start render loop
    animate();
}

// Ensure slider defaults are explicitly set (browsers sometimes ignore value attribute)
function initializeSliderDefaults() {
    // Bounds tab α/β sliders
    if (zrAlphaSlider) {
        zrAlphaSlider.value = 10;  // α = 1.0
        if (zrAlphaLabel) zrAlphaLabel.textContent = '1.0';
        if (zrAlphaInput) zrAlphaInput.value = 1.0;
    }
    if (zrBetaSlider) {
        zrBetaSlider.value = 10;   // β = 1.0
        if (zrBetaLabel) zrBetaLabel.textContent = '1.0';
        if (zrBetaInput) zrBetaInput.value = 1.0;
    }
    
    // Simulate tab α/β sliders
    if (phaseAlphaInput) {
        phaseAlphaInput.value = 10;  // α = 1.0
        if (phaseAlphaLabel) phaseAlphaLabel.textContent = '1.0';
    }
    if (phaseBetaInput) {
        phaseBetaInput.value = 10;   // β = 1.0
        if (phaseBetaLabel) phaseBetaLabel.textContent = '1.0';
    }
}

function grabDOMElements() {
    container = document.getElementById('container');
    
    // Graph generation
    numVerticesInput = document.getElementById('num-vertices');
    radiusInput = document.getElementById('layout-radius');
    layoutTypeSelect = document.getElementById('layout-type');
    concentricOptions = document.getElementById('concentric-options');
    innerRatioInput = document.getElementById('inner-ratio');
    innerRatioLabel = document.getElementById('inner-ratio-label');
    middleRatioContainer = document.getElementById('middle-ratio-container');
    middleRatioInput = document.getElementById('middle-ratio');
    middleRatioLabel = document.getElementById('middle-ratio-label');
    splitModeSelect = document.getElementById('split-mode');
    customSplitContainer = document.getElementById('custom-split-container');
    customSplitInput = document.getElementById('custom-split');
    generateBtn = document.getElementById('generate-btn');
    
    // Force layout
    forceLayoutBtn = document.getElementById('force-layout-btn');
    stopForceBtn = document.getElementById('stop-force-btn');
    forceSpeedInput = document.getElementById('force-speed');
    force3DCheckbox = document.getElementById('force-3d-checkbox');
    unpinAllBtn = document.getElementById('unpin-all-btn');
    pinCountLabel = document.getElementById('pin-count-label');
    
    // Face rendering
    solidFacesCheckbox = document.getElementById('solid-faces-checkbox');
    faceOptions = document.getElementById('face-options');
    faceOpacityInput = document.getElementById('face-opacity');
    faceOpacityLabel = document.getElementById('face-opacity-label');
    refreshFacesBtn = document.getElementById('refresh-faces-btn');
    faceHint = document.getElementById('face-hint');
    
    // Templates
    templateSelect = document.getElementById('template-select');
    applyTemplateBtn = document.getElementById('apply-template-btn');
    skewSymmetricCheckbox = document.getElementById('skew-symmetric-checkbox');
    
    // Template parameters
    templateParams = document.getElementById('template-params');
    paramN = document.getElementById('param-n');
    templateNInput = document.getElementById('template-n');
    paramDepth = document.getElementById('param-depth');
    paramBranches = document.getElementById('param-branches');
    paramKary = document.getElementById('param-k-ary');
    paramGrid = document.getElementById('param-grid');
    paramCuboid = document.getElementById('param-cuboid');
    paramHypercube = document.getElementById('param-hypercube');
    treeDepthInput = document.getElementById('tree-depth');
    treeBranchesInput = document.getElementById('tree-branches');
    treeKInput = document.getElementById('tree-k');
    gridRowsInput = document.getElementById('grid-rows');
    gridColsInput = document.getElementById('grid-cols');
    cuboidMInput = document.getElementById('cuboid-m');
    cuboidNInput = document.getElementById('cuboid-n');
    cuboidKInput = document.getElementById('cuboid-k');
    hypercubeDimInput = document.getElementById('hypercube-dim');
    paramGenPetersen = document.getElementById('param-gen-petersen');
    paramLollipop = document.getElementById('param-lollipop');
    paramKneser = document.getElementById('param-kneser');
    paramRook = document.getElementById('param-rook');
    paramNBar = document.getElementById('param-n-bar');
    paramNLink = document.getElementById('param-n-link');
    gpNInput = document.getElementById('gp-n');
    gpKInput = document.getElementById('gp-k');
    lollipopMInput = document.getElementById('lollipop-m');
    lollipopNInput = document.getElementById('lollipop-n');
    kneserNInput = document.getElementById('kneser-n');
    kneserKInput = document.getElementById('kneser-k');
    rookMInput = document.getElementById('rook-m');
    rookNInput = document.getElementById('rook-n');
    paramDrum = document.getElementById('param-drum');
    drumBranchesInput = document.getElementById('drum-branches');
    drumRingsInput = document.getElementById('drum-rings');
    
    // Universe Integration
    sendToUniverseBtn = document.getElementById('send-to-universe-btn');
    saveToLibraryBtn = document.getElementById('save-to-library-btn');
    universeGraphNameInput = document.getElementById('universe-graph-name');
    testUniverseBtn = document.getElementById('test-universe-btn');
    
    // Graph Finder
    findAnalyticBtn = document.getElementById('find-analytic-btn');
    finderProgress = document.getElementById('finder-progress');
    finderStatus = document.getElementById('finder-status');
    finderProgressBar = document.getElementById('finder-progress-bar');
    finderResults = document.getElementById('finder-results');
    finderSummary = document.getElementById('finder-summary');
    analyticGraphSelect = document.getElementById('analytic-graph-select');
    selectedGraphInfo = document.getElementById('selected-graph-info');
    graphFamilyDisplay = document.getElementById('graph-family');
    graphEdgesDisplay = document.getElementById('graph-edges');
    graphEigenvaluesDisplay = document.getElementById('graph-eigenvalues');
    loadAnalyticGraphBtn = document.getElementById('load-analytic-graph-btn');
    finderConnectedOnlyCheckbox = document.getElementById('finder-connected-only');
    finderVerticesInput = document.getElementById('finder-vertices');
    cancelSearchBtn = document.getElementById('cancel-search-btn');
    finderLayoutSelect = document.getElementById('finder-layout-select');
    clearDbBtn = document.getElementById('clear-db-btn');
    
    // Edit mode
    addModeCheckbox = document.getElementById('add-mode-checkbox');
    deleteModeCheckbox = document.getElementById('delete-mode-checkbox');
    dragModeCheckbox = document.getElementById('drag-mode-checkbox');
    modeIndicator = document.getElementById('mode-indicator');
    addVertexModeBtn = document.getElementById('add-vertex-mode-btn');
    deleteVertexModeBtn = document.getElementById('delete-vertex-mode-btn');
    arrangeRowsInput = document.getElementById('arrange-rows');
    arrangeColsInput = document.getElementById('arrange-cols');
    arrangeSpacingInput = document.getElementById('arrange-spacing');
    arrangeGridBtn = document.getElementById('arrange-grid-btn');
    arrangeCircleBtn = document.getElementById('arrange-circle-btn');
    
    // Projection buttons (Edit tab)
    projectXYBtn = document.getElementById('project-xy-btn');  // Front view (XY plane)
    projectXZBtn = document.getElementById('project-xz-btn');  // Top view (XZ plane)
    projectYZBtn = document.getElementById('project-yz-btn');  // Side view (YZ plane)
    project3DBtn = document.getElementById('project-3d-btn');  // 3D perspective
    
    // Snap grid controls
    snapGridControls = document.getElementById('snap-grid-controls');
    snapGridSizeInput = document.getElementById('snap-grid-size');
    snapToGridCheckbox = document.getElementById('snap-to-grid-checkbox');
    
    // Universe projection buttons
    universeProjectXYBtn = document.getElementById('universe-project-xy-btn');
    universeProjectXZBtn = document.getElementById('universe-project-xz-btn');
    universeProjectYZBtn = document.getElementById('universe-project-yz-btn');
    universeProject3DBtn = document.getElementById('universe-project-3d-btn');
    
    // Edge controls
    autoEdgesInput = document.getElementById('auto-edges');
    autoGenerateBtn = document.getElementById('auto-generate-btn');
    clearEdgesBtn = document.getElementById('clear-edges-btn');
    
    // Matrix modal
    showMatrixBtn = document.getElementById('show-matrix-btn');
    matrixModal = document.getElementById('matrix-modal');
    matrixContent = document.getElementById('matrix-content');
    modalHeader = document.getElementById('modal-header');
    closeModalBtn = document.getElementById('close-modal');
    
    // Statistics
    statVertices = document.getElementById('stat-vertices');
    statEdges = document.getElementById('stat-edges');
    statType = document.getElementById('stat-type');
    
    // Dynamics controls
    startDynamicsBtn = document.getElementById('start-dynamics-btn');
    stopDynamicsBtn = document.getElementById('stop-dynamics-btn');
    resetDynamicsBtn = document.getElementById('reset-dynamics-btn');
    integratorSelect = document.getElementById('integrator-select');
    timestepSelect = document.getElementById('timestep-select');
    dynamicsSpeedInput = document.getElementById('dynamics-speed');
    dynamicsSpeedLabel = document.getElementById('dynamics-speed-label');
    arrowScaleInput = document.getElementById('arrow-scale');
    arrowScaleLabel = document.getElementById('arrow-scale-label');
    arrowMinLengthInput = document.getElementById('arrow-min-length');
    arrowMinLabel = document.getElementById('arrow-min-label');
    
    // Dynamics display
    dynamicsTimeDisplay = document.getElementById('dynamics-time');
    dynamicsMaxStateDisplay = document.getElementById('dynamics-max-state');
    dynamicsMaxFlowDisplay = document.getElementById('dynamics-max-flow');
    dynamicsEnergyDisplay = document.getElementById('dynamics-energy');
    
    // Phase diagram
    phaseModeSelect = document.getElementById('phase-mode-select');
    animationModeSelect = document.getElementById('animation-mode-select');
    phaseNodeISelect = document.getElementById('phase-node-i');
    phaseNodeJSelect = document.getElementById('phase-node-j');
    phaseEnabledCheckbox = document.getElementById('phase-enabled-checkbox');
    clearPhaseBtn = document.getElementById('clear-phase-btn');
    phaseCanvas = document.getElementById('phase-canvas');
    phaseHint = document.getElementById('phase-hint');
    phaseAxisLabels = document.getElementById('phase-axis-labels');
    phaseXLabel = document.getElementById('phase-x-label');
    phaseYLabel = document.getElementById('phase-y-label');
    phaseModeHint = document.getElementById('phase-mode-hint');
    
    // Eigenvalue plot with alpha/beta sliders (new in v17)
    phaseAlphaInput = document.getElementById('phase-alpha');
    phaseAlphaLabel = document.getElementById('phase-alpha-label');
    phaseBetaInput = document.getElementById('phase-beta');
    phaseBetaLabel = document.getElementById('phase-beta-label');
    eigenvaluePlotCheckbox = document.getElementById('eigenvalue-plot-checkbox');
    eigenvalueCanvas = document.getElementById('eigenvalue-canvas');
    if (eigenvalueCanvas) {
        eigenvalueCtx = eigenvalueCanvas.getContext('2d');
    }
    evRealMax = document.getElementById('ev-real-max');
    evImagMax = document.getElementById('ev-imag-max');
    stabilityIndicator = document.getElementById('stability-indicator');
    phaseModeExplanation = document.getElementById('phase-mode-explanation');
    animationModeExplanation = document.getElementById('animation-mode-explanation');
    animationModeHint = document.getElementById('animation-mode-hint');
    
    // Bounds tab (Zeid-Rosenberg)
    zrTopologyDisplay = document.getElementById('zr-topology');
    detectTopologyBtn = document.getElementById('detect-topology-btn');
    zrAlphaInput = document.getElementById('zr-alpha');
    zrBetaInput = document.getElementById('zr-beta');
    zrAlphaSlider = document.getElementById('zr-alpha-slider');
    zrBetaSlider = document.getElementById('zr-beta-slider');
    zrAlphaLabel = document.getElementById('zr-alpha-label');
    zrBetaLabel = document.getElementById('zr-beta-label');
    zrEigenvalueCount = document.getElementById('zr-eigenvalue-count');
    computeBoundsBtn = document.getElementById('compute-bounds-btn');
    zrFormulaDisplay = document.getElementById('zr-formula');
    zrBoundsDisplay = document.getElementById('zr-bounds-display');
    zrStabilityDisplay = document.getElementById('zr-stability');
    zrComplexPlane = document.getElementById('zr-complex-plane');
    zrComparisonDisplay = document.getElementById('zr-comparison');
    compareBoundsBtn = document.getElementById('compare-bounds-btn');
    directsumG1Select = document.getElementById('directsum-g1');
    directsumG2Select = document.getElementById('directsum-g2');
    computeDirectsumBtn = document.getElementById('compute-directsum-btn');
    directsumResult = document.getElementById('directsum-result');
    
    // Enhanced Visualization Popup
    enhancedVizPopup = document.getElementById('enhanced-viz-popup');
    openEnhancedVizBtn = document.getElementById('open-enhanced-viz-btn');
    popupMinimizeBtn = document.getElementById('popup-minimize');
    popupMaximizeBtn = document.getElementById('popup-maximize');
    popupCloseBtn = document.getElementById('popup-close');
    enhancedPhaseCurrentCanvas = document.getElementById('enhanced-phase-current');
    enhancedPhaseMainCanvas = document.getElementById('enhanced-phase-main');
    enhancedSpectrumCanvas = document.getElementById('enhanced-spectrum');
    enhancedTimeseriesCanvas = document.getElementById('enhanced-timeseries');
    energyBar = document.getElementById('energy-bar');
    energyValue = document.getElementById('energy-value');
    vizShowBounds = document.getElementById('viz-show-bounds');
    vizShowEigenvectors = document.getElementById('viz-show-eigenvectors');
    vizShowGrid = document.getElementById('viz-show-grid');
    vizZoom = document.getElementById('viz-zoom');
    vizZoomLabel = document.getElementById('viz-zoom-label');
    
    // Library tab
    libTotalDisplay = document.getElementById('lib-total');
    libFamiliesDisplay = document.getElementById('lib-families');
    librarySearch = document.getElementById('library-search');
    libraryFilterN = document.getElementById('library-filter-n');
    libraryFilterFamily = document.getElementById('library-filter-family');
    librarySort = document.getElementById('library-sort');
    libraryTableBody = document.getElementById('library-table-body');
    librarySelectAll = document.getElementById('library-select-all');
    libraryEmpty = document.getElementById('library-empty');
    libraryLoadSelected = document.getElementById('library-load-selected');
    libraryDeleteSelected = document.getElementById('library-delete-selected');
    libraryExportJSON = document.getElementById('library-export-json');
    libraryExportHTML = document.getElementById('library-export-html');
    libraryImportBtn = document.getElementById('library-import-btn');
    libraryImportFile = document.getElementById('library-import-file');
    libraryClearAll = document.getElementById('library-clear-all');
    addToLibraryBtn = document.getElementById('add-to-library-btn');
    addAllToLibraryBtn = document.getElementById('add-all-to-library-btn');
    productALibraryGroup = document.getElementById('product-a-library');
    productBLibraryGroup = document.getElementById('product-b-library');
    
    // Universe view toggle
    libraryViewTableBtn = document.getElementById('library-view-table');
    libraryViewUniverseBtn = document.getElementById('library-view-universe');
    universeContainer = document.getElementById('universe-container');
    universeNavControls = document.getElementById('universe-nav-controls');
    universeGalaxyJump = document.getElementById('universe-galaxy-jump');
    universeResetView = document.getElementById('universe-reset-view');
    universeZoomFit = document.getElementById('universe-zoom-fit');
    
    // Physics Engine UI
    physicsPanel = document.getElementById('physics-panel');
    physicsStatusBadge = document.getElementById('physics-status-badge');
    physicsStatusIndicator = document.getElementById('physics-status-indicator');
    physicsStatusText = document.getElementById('physics-status-text');
    physicsDimN = document.getElementById('physics-dim-n');
    physicsDimM = document.getElementById('physics-dim-m');
    physicsDimViolations = document.getElementById('physics-dim-violations');
    physicsViolationsPanel = document.getElementById('physics-violations-panel');
    physicsViolationsList = document.getElementById('physics-violations-list');
    physicsAuditBtn = document.getElementById('physics-audit-btn');
    physicsAutoDiscoverBtn = document.getElementById('physics-auto-discover-btn');
    physicsAutoAuditCheckbox = document.getElementById('physics-auto-audit');
    physicsBMatrixContainer = document.getElementById('physics-bmatrix-container');
    physicsBMatrixContent = document.getElementById('physics-bmatrix-content');
    physicsToggleBMatrixBtn = document.getElementById('physics-toggle-bmatrix');
    physicsColumnAnalysis = document.getElementById('physics-column-analysis');
    physicsColumnList = document.getElementById('physics-column-list');
    physicsNValue = document.getElementById('physics-n-value');
    // Rectification UI
    physicsRectifyPrompt = document.getElementById('physics-rectify-prompt');
    physicsRectifyYesBtn = document.getElementById('physics-rectify-yes-btn');
    physicsUndoPanel = document.getElementById('physics-undo-panel');
    physicsUndoBtn = document.getElementById('physics-undo-btn');
    // State visualization
    physicsPStates = document.getElementById('physics-p-states');
    physicsQStates = document.getElementById('physics-q-states');
    physicsNodeGrid = document.getElementById('physics-node-grid');
    physicsPIndices = document.getElementById('physics-p-indices');
    physicsQIndices = document.getElementById('physics-q-indices');
    physicsPartitionContainer = document.getElementById('physics-partition-container');
    // Energy plot
    physicsPlayBtn = document.getElementById('physics-play-btn');
    physicsResetBtn = document.getElementById('physics-reset-btn');
    physicsLiveKinetic = document.getElementById('physics-live-kinetic');
    physicsLivePotential = document.getElementById('physics-live-potential');
    physicsLiveTotal = document.getElementById('physics-live-total');
    physicsEnergyCanvas = document.getElementById('physics-energy-canvas');
    physicsTimeValue = document.getElementById('physics-time-value');
    physicsConservationStatus = document.getElementById('physics-conservation-status');
}

// =====================================================
// PIN COUNT DISPLAY HELPER
// =====================================================

/**
 * Update the pinned node count display
 */
function updatePinCountDisplay() {
    if (!pinCountLabel) return;
    const count = getPinnedNodeCount();
    if (count > 0) {
        pinCountLabel.textContent = `${count} pinned`;
        pinCountLabel.style.color = '#e74c3c';  // Red to match pinned material
    } else {
        pinCountLabel.textContent = '';
    }
}

// =====================================================
// EVENT LISTENERS
// =====================================================

function setupEventListeners() {
    // Layout type changes
    layoutTypeSelect.addEventListener('change', () => {
        const layout = layoutTypeSelect.value;
        concentricOptions.style.display = layout.startsWith('concentric') ? 'block' : 'none';
        if (middleRatioContainer) {
            middleRatioContainer.style.display = (layout === 'concentric-3') ? 'block' : 'none';
        }
    });
    
    // Ratio sliders
    innerRatioInput.addEventListener('input', () => {
        innerRatioLabel.textContent = innerRatioInput.value + '%';
    });
    
    if (middleRatioInput) {
        middleRatioInput.addEventListener('input', () => {
            middleRatioLabel.textContent = middleRatioInput.value + '%';
        });
    }
    
    // Split mode
    splitModeSelect.addEventListener('change', () => {
        if (customSplitContainer) {
            customSplitContainer.style.display = (splitModeSelect.value === 'custom') ? 'block' : 'none';
        }
    });
    
    // Generate button
    generateBtn.addEventListener('click', () => {
        stopForceLayout();
        stopDynamics();
        generateGraph();
    });
    
    // Template selection - show/hide parameter controls
    templateSelect.addEventListener('change', () => {
        // Sync template-n input with main vertices input
        if (templateNInput && numVerticesInput) {
            templateNInput.value = numVerticesInput.value;
        }
        updateTemplateParams();
    });
    
    // Apply template
    applyTemplateBtn.addEventListener('click', () => {
        stopForceLayout();
        stopDynamics();
        applyTemplate(templateSelect.value);
        
        // Refresh faces if enabled
        if (state.facesVisible) {
            setTimeout(() => createFaceMeshes(), 50);
        }
        
        // Trigger physics audit after template is applied
        onGraphChanged();
    });
    
    // Sync template-n with main vertices input
    if (templateNInput) {
        templateNInput.addEventListener('change', () => {
            if (numVerticesInput) {
                numVerticesInput.value = templateNInput.value;
            }
        });
    }
    
    // Send to Universe
    if (sendToUniverseBtn) {
        sendToUniverseBtn.addEventListener('click', async () => {
            await sendCurrentGraphToUniverse();
        });
    }
    
    // Save to Library
    if (saveToLibraryBtn) {
        saveToLibraryBtn.addEventListener('click', () => {
            saveCurrentGraphToLibrary();
        });
    }
    
    // Test Universe with known graphs
    if (testUniverseBtn) {
        testUniverseBtn.addEventListener('click', async () => {
            await generateTestGraphsForUniverse();
        });
    }
    
    // Graph Finder
    findAnalyticBtn.addEventListener('click', () => {
        stopForceLayout();
        stopDynamics();
        findAllAnalyticGraphs();
    });
    
    if (cancelSearchBtn) {
        cancelSearchBtn.addEventListener('click', () => {
            cancelSearch();
            cancelSearchBtn.disabled = true;
            cancelSearchBtn.textContent = 'Cancelling...';
        });
    }
    
    if (clearDbBtn) {
        clearDbBtn.addEventListener('click', () => {
            if (confirm('Clear cached graph analysis results? This will require re-computation on next search.')) {
                resetDatabase();
                alert('Cache cleared. Database re-seeded with known families.');
            }
        });
    }
    
    analyticGraphSelect.addEventListener('change', () => {
        showSelectedGraphInfo();
    });
    
    loadAnalyticGraphBtn.addEventListener('click', () => {
        loadSelectedAnalyticGraph();
    });
    
    // Force layout
    forceLayoutBtn.addEventListener('click', () => {
        stopDynamics();
        startForceLayout(forceSpeedInput, force3DCheckbox, updateStats);
        forceLayoutBtn.style.display = 'none';
        stopForceBtn.style.display = 'block';
    });
    
    stopForceBtn.addEventListener('click', () => {
        stopForceLayout();
        forceLayoutBtn.style.display = 'block';
        stopForceBtn.style.display = 'none';
    });
    
    // Unpin All button
    if (unpinAllBtn) {
        unpinAllBtn.addEventListener('click', () => {
            const count = unpinAllNodes();
            updatePinCountDisplay();
            console.log(`[Pin] Unpinned ${count} nodes`);
        });
    }
    
    // Face rendering (Solid Polyhedron Mode)
    if (solidFacesCheckbox) {
        solidFacesCheckbox.addEventListener('change', () => {
            const showFaces = solidFacesCheckbox.checked;
            console.log('Solid faces toggled:', showFaces);
            toggleFaces(showFaces);
            
            // Show/hide face options using classList
            const faceOptionsEl = document.getElementById('face-options');
            const faceHintEl = document.getElementById('face-hint');
            
            if (faceOptionsEl) {
                if (showFaces) {
                    faceOptionsEl.classList.remove('hidden');
                } else {
                    faceOptionsEl.classList.add('hidden');
                }
                console.log('Face options visible:', !faceOptionsEl.classList.contains('hidden'));
            }
            if (faceHintEl) {
                if (showFaces) {
                    faceHintEl.classList.remove('hidden');
                } else {
                    faceHintEl.classList.add('hidden');
                }
            }
        });
    } else {
        console.error('solid-faces-checkbox not found!');
    }
    
    // Face opacity slider
    const faceOpacityEl = document.getElementById('face-opacity');
    const faceOpacityLabelEl = document.getElementById('face-opacity-label');
    if (faceOpacityEl) {
        faceOpacityEl.addEventListener('input', () => {
            const opacity = parseInt(faceOpacityEl.value) / 100;
            setFaceOpacity(opacity);
            if (faceOpacityLabelEl) {
                faceOpacityLabelEl.textContent = faceOpacityEl.value + '%';
            }
            console.log('Face opacity set to:', opacity);
        });
    }
    
    // Face brightness slider
    const faceBrightnessEl = document.getElementById('face-brightness');
    const faceBrightnessLabelEl = document.getElementById('face-brightness-label');
    if (faceBrightnessEl) {
        faceBrightnessEl.addEventListener('input', () => {
            const brightness = parseInt(faceBrightnessEl.value) / 100;
            setFaceColorBrightness(brightness);
            if (faceBrightnessLabelEl) {
                faceBrightnessLabelEl.textContent = faceBrightnessEl.value + '%';
            }
            console.log('Face brightness set to:', brightness);
        });
    }
    
    // Face saturation slider
    const faceSaturationEl = document.getElementById('face-saturation');
    const faceSaturationLabelEl = document.getElementById('face-saturation-label');
    if (faceSaturationEl) {
        faceSaturationEl.addEventListener('input', () => {
            const saturation = parseInt(faceSaturationEl.value) / 100;
            setFaceColorSaturation(saturation);
            if (faceSaturationLabelEl) {
                faceSaturationLabelEl.textContent = faceSaturationEl.value + '%';
            }
            console.log('Face saturation set to:', saturation);
        });
    }
    
    // Background color selector
    const backgroundColorSelect = document.getElementById('background-color-select');
    if (backgroundColorSelect) {
        backgroundColorSelect.addEventListener('change', () => {
            const preset = backgroundColorSelect.value;
            setBackgroundColor(preset);
        });
    }
    
    // Refresh faces button
    const refreshFacesBtnEl = document.getElementById('refresh-faces-btn');
    if (refreshFacesBtnEl) {
        refreshFacesBtnEl.addEventListener('click', () => {
            if (state.facesVisible) {
                console.log('Refreshing faces...');
                createFaceMeshes();
            }
        });
    }
    
    // Dynamics controls
    startDynamicsBtn.addEventListener('click', startDynamics);
    stopDynamicsBtn.addEventListener('click', stopDynamics);
    resetDynamicsBtn.addEventListener('click', () => {
        stopDynamics();
        resetDynamicsVisuals();
    });
    
    // Dynamics speed
    dynamicsSpeedInput.addEventListener('input', () => {
        const speed = parseInt(dynamicsSpeedInput.value) / 10;
        dynamicsSpeedLabel.textContent = speed.toFixed(1) + 'x';
        invalidateCaches();
    });
    
    // Integrator change
    integratorSelect.addEventListener('change', () => {
        invalidateCaches();
    });
    
    // Arrow controls
    arrowScaleInput.addEventListener('input', () => {
        arrowScaleLabel.textContent = arrowScaleInput.value;
    });
    
    arrowMinLengthInput.addEventListener('input', () => {
        arrowMinLabel.textContent = arrowMinLengthInput.value;
    });
    
    // Phase diagram controls
    if (phaseEnabledCheckbox) phaseEnabledCheckbox.addEventListener('change', togglePhaseDiagram);
    if (clearPhaseBtn) clearPhaseBtn.addEventListener('click', () => { clearPhaseTrail(); enhancedPhaseTrail = []; });
    if (phaseNodeISelect) phaseNodeISelect.addEventListener('change', () => { clearPhaseTrail(); enhancedPhaseTrail = []; updatePhaseLabels(); });
    if (phaseNodeJSelect) phaseNodeJSelect.addEventListener('change', () => { clearPhaseTrail(); enhancedPhaseTrail = []; updatePhaseLabels(); });
    if (phaseModeSelect) phaseModeSelect.addEventListener('change', () => { clearPhaseTrail(); enhancedPhaseTrail = []; updatePhaseLabels(); updatePhaseModeExplanation(); });
    if (animationModeSelect) animationModeSelect.addEventListener('change', updateAnimationModeExplanation);
    
    // Freeze nodes teaching toggle
    const freezeNodesCheckbox = document.getElementById('freeze-nodes-checkbox');
    if (freezeNodesCheckbox) {
        freezeNodesCheckbox.addEventListener('change', () => {
            setFreezeNodesMode(freezeNodesCheckbox.checked);
        });
    }
    
    // Eigenvalue plot with alpha/beta sliders (new in v17)
    if (phaseAlphaInput) {
        phaseAlphaInput.addEventListener('input', () => {
            const alpha = parseInt(phaseAlphaInput.value) / 10;
            if (phaseAlphaLabel) phaseAlphaLabel.textContent = alpha.toFixed(1);
            updateEigenvaluePlot();
        });
    }
    if (phaseBetaInput) {
        phaseBetaInput.addEventListener('input', () => {
            const beta = parseInt(phaseBetaInput.value) / 10;
            if (phaseBetaLabel) phaseBetaLabel.textContent = beta.toFixed(1);
            updateEigenvaluePlot();
        });
    }
    if (eigenvaluePlotCheckbox) {
        eigenvaluePlotCheckbox.addEventListener('change', () => {
            toggleEigenvaluePlot();
        });
    }
    
    // Edit mode checkboxes
    addModeCheckbox.addEventListener('change', () => {
        if (addModeCheckbox.checked) {
            deleteModeCheckbox.checked = false;
            if (dragModeCheckbox) dragModeCheckbox.checked = false;
        }
        updateMode();
    });
    
    deleteModeCheckbox.addEventListener('change', () => {
        if (deleteModeCheckbox.checked) {
            addModeCheckbox.checked = false;
            if (dragModeCheckbox) dragModeCheckbox.checked = false;
        }
        updateMode();
    });
    
    if (dragModeCheckbox) {
        dragModeCheckbox.addEventListener('change', () => {
            if (dragModeCheckbox.checked) {
                addModeCheckbox.checked = false;
                deleteModeCheckbox.checked = false;
            }
            updateMode();
        });
    }
    
    // Edge generation
    autoGenerateBtn.addEventListener('click', () => {
        generateRandomEdges(parseInt(autoEdgesInput.value));
        updateStats();
        onGraphChanged();
    });
    
    clearEdgesBtn.addEventListener('click', () => {
        stopDynamics();
        clearAllEdges();
        updateStats();
        onGraphChanged();
    });
    
    // Matrix modal
    showMatrixBtn.addEventListener('click', () => {
        showAnalysis();
        initModalPosition();
    });
    
    closeModalBtn.addEventListener('click', () => {
        hideModal();
    });
    
    // Mouse events for edge editing and vertex dragging
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mousedown', (e) => {
        onMouseDown(e);
        onMouseClick(e);
    });
    window.addEventListener('mouseup', onMouseUp);
    
    // Touch events for mobile support
    let touchStartTime = 0;
    let touchStartPos = { x: 0, y: 0 };
    let touchVertexHit = null;
    
    window.addEventListener('touchstart', (e) => {
        if (e.touches.length === 1) {
            const touch = e.touches[0];
            touchStartTime = Date.now();
            touchStartPos = { x: touch.clientX, y: touch.clientY };
            
            // Check if touching a vertex
            const touchEvent = createTouchEventWrapper(touch);
            touchVertexHit = getIntersectedVertex(touchEvent);
            
            // If we hit a vertex, handle selection immediately for better responsiveness
            if (touchVertexHit) {
                onMouseDown(touchEvent);
                // Temporarily disable OrbitControls to prevent interference
                if (controls) controls.enabled = false;
            }
        }
    }, { passive: false });
    
    window.addEventListener('touchmove', (e) => {
        if (e.touches.length === 1 && touchVertexHit) {
            const touch = e.touches[0];
            const touchEvent = createTouchEventWrapper(touch);
            onMouseMove(touchEvent);
            e.preventDefault(); // Prevent scrolling when dragging vertex
        }
    }, { passive: false });
    
    window.addEventListener('touchend', (e) => {
        const touchDuration = Date.now() - touchStartTime;
        const touch = e.changedTouches[0];
        const moveDistance = touch ? Math.sqrt(
            Math.pow(touch.clientX - touchStartPos.x, 2) + 
            Math.pow(touch.clientY - touchStartPos.y, 2)
        ) : 0;
        
        // Detect tap (short duration, minimal movement)
        const isTap = touchDuration < 300 && moveDistance < 20;
        
        if (isTap && touch) {
            const touchEvent = createTouchEventWrapper(touch);
            onMouseClick(touchEvent);
        }
        
        onMouseUp(e);
        
        // Re-enable OrbitControls based on current mode
        updateMode();
        
        touchVertexHit = null;
    });
    
    // Sidebar resize
    setupSidebarResize();
}

// Helper to convert touch event to mouse-like event
function createTouchEventWrapper(touch) {
    return {
        clientX: touch.clientX,
        clientY: touch.clientY,
        target: touch.target,
        preventDefault: () => {},
        stopPropagation: () => {}
    };
}

function setupSidebarResize() {
    const sidebar = document.getElementById('controls-panel');
    const handle = document.getElementById('sidebar-resize-handle');
    
    if (!sidebar || !handle) return;
    
    let isResizing = false;
    let startX = 0;
    let startWidth = 0;
    
    handle.addEventListener('mousedown', (e) => {
        isResizing = true;
        startX = e.clientX;
        startWidth = sidebar.offsetWidth;
        
        handle.classList.add('dragging');
        document.body.classList.add('resizing');
        
        e.preventDefault();
    });
    
    document.addEventListener('mousemove', (e) => {
        if (!isResizing) return;
        
        // Calculate new width (dragging left increases width since sidebar is on right)
        const delta = startX - e.clientX;
        let newWidth = startWidth + delta;
        
        // Clamp to min/max
        newWidth = Math.max(220, Math.min(500, newWidth));
        
        sidebar.style.width = newWidth + 'px';
        
        // Store preference
        localStorage.setItem('sidebarWidth', newWidth);
    });
    
    document.addEventListener('mouseup', () => {
        if (isResizing) {
            isResizing = false;
            handle.classList.remove('dragging');
            document.body.classList.remove('resizing');
        }
    });
    
    // Restore saved width
    const savedWidth = localStorage.getItem('sidebarWidth');
    if (savedWidth) {
        const width = parseInt(savedWidth);
        if (width >= 220 && width <= 500) {
            sidebar.style.width = width + 'px';
        }
    }
}

function setupTabs() {
    // Sidebar tabs
    document.querySelectorAll('.sidebar-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            // Stop any running eigenmode animation and reset graph when switching tabs
            import('./dynamics-animation.js').then(module => {
                if (module.isEigenmodeActive && module.isEigenmodeActive()) {
                    module.stopEigenmodeAnimation();
                    // Clear active eigenvalue highlight
                    document.querySelectorAll('.eigenvalue-clickable').forEach(item => {
                        item.classList.remove('eigenvalue-active');
                    });
                    console.log('Animation stopped and graph reset on tab switch');
                }
            }).catch(() => {});  // Ignore if module not available
            
            document.querySelectorAll('.sidebar-tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            document.querySelectorAll('.sidebar-tab-content').forEach(c => c.classList.remove('active'));
            const target = document.getElementById('sidebar-' + tab.dataset.tab);
            if (target) target.classList.add('active');
            
            // Update analysis tab content when switching to it
            if (tab.dataset.tab === 'analyze') {
                // Stop force layout - it conflicts with eigenmode animations
                if (state.forceSimulationRunning) {
                    stopForceLayout();
                    console.log('[Tab] Force layout stopped for Analyze tab');
                }
                updateAnalyzeTab();
            }
            
            // Also stop force for Simulate tab (dynamics animations)
            if (tab.dataset.tab === 'simulate') {
                if (state.forceSimulationRunning) {
                    stopForceLayout();
                    console.log('[Tab] Force layout stopped for Simulate tab');
                }
            }
            
            // Update bounds tab when switching to it
            if (tab.dataset.tab === 'bounds') {
                updateBoundsTab();
            }
            
            // Update library tab when switching to it
            if (tab.dataset.tab === 'library') {
                updateLibraryUI();
            }
        });
    });
    
    // Mode buttons (new design)
    document.querySelectorAll('.mode-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const mode = btn.dataset.mode;
            currentEditMode = mode;  // Track current mode globally
            
            // Update button states
            document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            // Sync with hidden checkboxes for compatibility
            if (addModeCheckbox) addModeCheckbox.checked = (mode === 'add');
            if (deleteModeCheckbox) deleteModeCheckbox.checked = (mode === 'delete');
            if (dragModeCheckbox) dragModeCheckbox.checked = (mode === 'drag');
            
            // Update mode indicator
            updateMode();
            
            // Update hints
            document.querySelectorAll('.mode-hints .hint').forEach(h => h.style.display = 'none');
            const hintId = 'hint-' + mode;
            const hint = document.getElementById(hintId);
            if (hint) hint.style.display = 'block';
            
            // Show/hide snap grid controls and grid helper for add-vertex mode
            if (mode === 'add-vertex') {
                if (snapGridControls) snapGridControls.style.display = 'block';
                
                // If in 3D mode, switch to Top view first (so grid is visible)
                const currentProj = getCurrentProjection();
                if (currentProj === '3d') {
                    setCameraProjection('xz', true);
                    // Update projection button states
                    [projectXYBtn, projectXZBtn, projectYZBtn, project3DBtn].forEach(b => {
                        if (b) b.classList.remove('active');
                    });
                    if (projectXZBtn) projectXZBtn.classList.add('active');
                }
                
                // Show grid after a small delay to let projection change settle
                setTimeout(() => {
                    const gridSize = parseInt(snapGridSizeInput?.value) || 5;
                    showSnapGrid(gridSize);
                }, currentProj === '3d' ? 100 : 0);
            } else {
                if (snapGridControls) snapGridControls.style.display = 'none';
                hideSnapGrid();
            }
        });
    });
    
    // Snap grid controls
    if (snapGridSizeInput) {
        snapGridSizeInput.addEventListener('change', () => {
            const size = parseInt(snapGridSizeInput.value) || 5;
            setSnapGridSize(size);
            if (currentEditMode === 'add-vertex' && getCurrentProjection() !== '3d') {
                showSnapGrid(size);
            }
        });
    }
    
    if (snapToGridCheckbox) {
        snapToGridCheckbox.addEventListener('change', () => {
            setSnapToGrid(snapToGridCheckbox.checked);
        });
    }
    
    // Projection buttons (Edit tab)
    setupProjectionButtons();
    
    // Arrange buttons
    if (arrangeGridBtn) {
        arrangeGridBtn.addEventListener('click', () => {
            const rows = parseInt(arrangeRowsInput?.value) || 3;
            const cols = parseInt(arrangeColsInput?.value) || 3;
            const spacing = parseInt(arrangeSpacingInput?.value) || 15;
            arrangeOnGrid(rows, cols, spacing);
            updateStats();
        });
    }
    
    if (arrangeCircleBtn) {
        arrangeCircleBtn.addEventListener('click', () => {
            const spacing = parseInt(arrangeSpacingInput?.value) || 15;
            const radius = spacing * state.vertexMeshes.length / (2 * Math.PI);
            arrangeOnCircle(Math.max(radius, 20));
            updateStats();
        });
    }
    
    // Modal tabs (for backward compatibility)
    document.querySelectorAll('.modal-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            // Stop any running eigenmode animation and reset graph when switching tabs
            import('./dynamics-animation.js').then(module => {
                if (module.isEigenmodeActive && module.isEigenmodeActive()) {
                    module.stopEigenmodeAnimation();
                    document.querySelectorAll('.eigenvalue-clickable').forEach(item => {
                        item.classList.remove('eigenvalue-active');
                    });
                    console.log('Animation stopped and graph reset on modal tab switch');
                }
            }).catch(() => {});
            
            document.querySelectorAll('.modal-tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            document.querySelectorAll('.modal-tab-content').forEach(c => c.classList.remove('active'));
            const target = document.getElementById('tab-' + tab.dataset.tab);
            if (target) target.classList.add('active');
        });
    });
}

// Update the Analyze tab with current graph info
function updateAnalyzeTab() {
    // This will be called when switching to the analyze tab
    // The showAnalysis function already updates most displays
    showAnalysis();
}

// =====================================================
// BOUNDS TAB (Zeid-Rosenberg)
// =====================================================

function setupBoundsEventListeners() {
    if (detectTopologyBtn) {
        detectTopologyBtn.addEventListener('click', () => {
            updateBoundsTab();
        });
    }
    
    if (computeBoundsBtn) {
        computeBoundsBtn.addEventListener('click', () => {
            computeAndDisplayBounds();
        });
    }
    
    if (compareBoundsBtn) {
        compareBoundsBtn.addEventListener('click', () => {
            compareWithNumericalEigenvalues();
        });
    }
    
    if (computeDirectsumBtn) {
        computeDirectsumBtn.addEventListener('click', () => {
            computeAndDisplayDirectSum();
        });
    }
    
    // UNIFIED SLIDER HANDLING - sync ANALYZE and BOUNDS tabs
    const analyzeAlpha = document.getElementById('analyze-alpha');
    const analyzeBeta = document.getElementById('analyze-beta');
    const analyzeAlphaLabel = document.getElementById('analyze-alpha-label');
    const analyzeBetaLabel = document.getElementById('analyze-beta-label');
    
    // Sync function to update all sliders and redraw
    function syncAlpha(value) {
        const alpha = parseInt(value) / 10;
        // Update all labels
        if (analyzeAlphaLabel) analyzeAlphaLabel.textContent = alpha.toFixed(1);
        if (zrAlphaLabel) zrAlphaLabel.textContent = alpha.toFixed(1);
        if (zrAlphaInput) zrAlphaInput.value = alpha;
        // Sync slider positions
        if (analyzeAlpha && analyzeAlpha.value !== value) analyzeAlpha.value = value;
        if (zrAlphaSlider && zrAlphaSlider.value !== value) zrAlphaSlider.value = value;
        // Redraw
        updateComplexPlaneOnly();
    }
    
    function syncBeta(value) {
        const beta = parseInt(value) / 10;
        // Update all labels
        if (analyzeBetaLabel) analyzeBetaLabel.textContent = beta.toFixed(1);
        if (zrBetaLabel) zrBetaLabel.textContent = beta.toFixed(1);
        if (zrBetaInput) zrBetaInput.value = beta;
        // Sync slider positions
        if (analyzeBeta && analyzeBeta.value !== value) analyzeBeta.value = value;
        if (zrBetaSlider && zrBetaSlider.value !== value) zrBetaSlider.value = value;
        // Redraw
        updateComplexPlaneOnly();
    }
    
    // ANALYZE tab α slider
    if (analyzeAlpha) {
        analyzeAlpha.addEventListener('input', () => syncAlpha(analyzeAlpha.value));
    }
    
    // ANALYZE tab β slider
    if (analyzeBeta) {
        analyzeBeta.addEventListener('input', () => syncBeta(analyzeBeta.value));
    }
    
    // BOUNDS tab α slider
    if (zrAlphaSlider) {
        zrAlphaSlider.addEventListener('input', () => syncAlpha(zrAlphaSlider.value));
    }
    
    // BOUNDS tab β slider
    if (zrBetaSlider) {
        zrBetaSlider.addEventListener('input', () => syncBeta(zrBetaSlider.value));
    }
    
    // Also keep the hidden input change listeners for backward compatibility
    if (zrAlphaInput) {
        zrAlphaInput.addEventListener('change', () => {
            invalidateTopologyCache();
            if (currentSpectrum) computeAndDisplayBounds();
        });
    }
    
    if (zrBetaInput) {
        zrBetaInput.addEventListener('change', () => {
            invalidateTopologyCache();
            if (currentSpectrum) computeAndDisplayBounds();
        });
    }
    
    // Initialize ANALYZE tab labels
    if (analyzeAlphaLabel) analyzeAlphaLabel.textContent = '1.0';
    if (analyzeBetaLabel) analyzeBetaLabel.textContent = '1.0';
}

// Module-level cache for topology (prevents re-detection on every slider move)
let cachedTopology = null;
let cachedBaseEigenvalues = null; // Cache the normalized eigenvalues (with α=1, β=1)

function invalidateTopologyCache() {
    cachedTopology = null;
    cachedBaseEigenvalues = null;
}

// Ultra-fast update: redraw complex plane with new α/β values
function updateComplexPlaneOnly() {
    // Get current alpha and beta (prefer ANALYZE tab sliders)
    const analyzeAlpha = document.getElementById('analyze-alpha');
    const analyzeBeta = document.getElementById('analyze-beta');
    
    let alpha = 1.0, beta = 1.0;
    if (analyzeAlpha) alpha = parseInt(analyzeAlpha.value) / 10;
    else if (zrAlphaSlider) alpha = parseInt(zrAlphaSlider.value) / 10;
    
    if (analyzeBeta) beta = parseInt(analyzeBeta.value) / 10;
    else if (zrBetaSlider) beta = parseInt(zrBetaSlider.value) / 10;
    
    // Update bounds display in BOUNDS tab
    if (zrBoundsDisplay && cachedBaseEigenvalues && cachedBaseEigenvalues.length > 0) {
        const maxImag = Math.max(...cachedBaseEigenvalues.map(e => Math.abs(e.im_normalized || e.imag || 0)));
        const b1_over_beta = maxImag;
        zrBoundsDisplay.innerHTML = `
            <div class="bound-item">
                <span class="bound-label">b₁/β:</span>
                <span class="bound-value">${b1_over_beta.toFixed(4)}</span>
            </div>
            <div class="bound-item">
                <span class="bound-label">Re(λ):</span>
                <span class="bound-value">${(-alpha).toFixed(3)}</span>
            </div>
            <div class="bound-item">
                <span class="bound-label">Im(λ):</span>
                <span class="bound-value">[${(-b1_over_beta * beta).toFixed(3)}, ${(b1_over_beta * beta).toFixed(3)}]</span>
            </div>
        `;
    }
    
    // Redraw complex plane (reads α/β from sliders internally)
    drawComplexPlane();
}

function updateBoundsTab() {
    // Invalidate cache when explicitly updating
    invalidateTopologyCache();
    const topology = detectPointGraphTopology();
    cachedTopology = topology; // Cache for slider updates
    
    if (zrTopologyDisplay) {
        zrTopologyDisplay.textContent = topology.description;
        zrTopologyDisplay.className = topology.type !== 'empty' ? 'detected' : '';
    }
    
    // Auto-compute if we have a valid graph
    if (topology.N >= 2) {
        computeAndDisplayBounds();
    }
}

function computeAndDisplayBounds() {
    const topology = detectPointGraphTopology();
    
    if (topology.N < 2) {
        if (zrFormulaDisplay) {
            zrFormulaDisplay.innerHTML = '<span class="hint">Need at least 2 vertices</span>';
        }
        return;
    }
    
    // Get alpha and beta from sliders (or hidden inputs as fallback)
    let alpha = 1.0, beta = 1.0;
    if (zrAlphaSlider) {
        alpha = parseInt(zrAlphaSlider.value) / 10;
    } else if (zrAlphaInput) {
        alpha = parseFloat(zrAlphaInput.value) || 1.0;
    }
    if (zrBetaSlider) {
        beta = parseInt(zrBetaSlider.value) / 10;
    } else if (zrBetaInput) {
        beta = parseFloat(zrBetaInput.value) || 1.0;
    }
    
    // For general/unknown topologies, use numerical computation
    if (topology.type === 'general' || topology.type === 'tree') {
        currentSpectrum = computeNumericalSpectrum(alpha, beta);
        if (!currentSpectrum) {
            if (zrFormulaDisplay) {
                zrFormulaDisplay.innerHTML = '<span class="hint">Unable to compute eigenvalues</span>';
            }
            return;
        }
    } else {
        // Use analytic formulas for known topologies
        currentSpectrum = computeSpectrum(topology, alpha, beta);
    }
    
    // Display formula
    if (zrFormulaDisplay) {
        const formula = formatFormula(topology, alpha, beta);
        zrFormulaDisplay.innerHTML = `
            <div class="formula-text">${formula}</div>
            ${currentSpectrum.exactSpectrum ? 
                '<span class="badge success">Exact spectrum</span>' : 
                '<span class="badge warning">Numerical</span>'}
        `;
    }
    
    // Display bounds
    if (zrBoundsDisplay) {
        const bounds = formatBounds(currentSpectrum);
        zrBoundsDisplay.innerHTML = `
            <div class="bound-item">
                <span class="bound-label">b₁/β:</span>
                <span class="bound-value">${currentSpectrum.b1_over_beta.toFixed(4)}</span>
            </div>
            <div class="bound-item">
                <span class="bound-label">Re(λ):</span>
                <span class="bound-value">[${currentSpectrum.realBounds[0].toFixed(3)}, ${currentSpectrum.realBounds[1].toFixed(3)}]</span>
            </div>
            <div class="bound-item">
                <span class="bound-label">Im(λ):</span>
                <span class="bound-value">[${currentSpectrum.imagBounds[0].toFixed(3)}, ${currentSpectrum.imagBounds[1].toFixed(3)}]</span>
            </div>
        `;
    }
    
    // Update eigenvalue count display
    if (zrEigenvalueCount && currentSpectrum.eigenvalues) {
        const count = currentSpectrum.eigenvalues.length;
        zrEigenvalueCount.textContent = `Showing ${count} eigenvalue${count !== 1 ? 's' : ''} (α=${alpha.toFixed(1)}, β=${beta.toFixed(1)})`;
    }
    
    // Display stability
    if (zrStabilityDisplay) {
        const stability = checkStability(topology, alpha, currentSpectrum);
        let html = '';
        
        stability.conditions.forEach(cond => {
            const icon = cond.satisfied ? '✓' : '✗';
            const iconClass = cond.satisfied ? 'pass' : 'fail';
            html += `
                <div class="condition">
                    <span class="condition-icon ${iconClass}">${icon}</span>
                    <span>${cond.description}</span>
                </div>
            `;
        });
        
        if (stability.isStable) {
            html += `<div class="condition">
                <span class="condition-icon pass">✓</span>
                <span><b>Asymptotically Stable</b></span>
            </div>`;
        }
        
        zrStabilityDisplay.innerHTML = html;
    }
    
    // Draw complex plane visualization
    // Complex plane is now drawn in matrix-analysis-ui.js
    // Call updateStats to trigger redraw
    updateStats();
}

// Old drawComplexPlane removed - now using unified version from matrix-analysis-ui.js

// =====================================================
// EIGENVALUE PLOT WITH ALPHA/BETA SLIDERS (NEW IN V17)
// =====================================================

function toggleEigenvaluePlot() {
    if (!eigenvalueCanvas) return;
    const show = eigenvaluePlotCheckbox ? eigenvaluePlotCheckbox.checked : false;
    eigenvalueCanvas.style.display = show ? 'block' : 'none';
    const infoDisplay = document.getElementById('eigenvalue-info-display');
    if (infoDisplay) infoDisplay.style.display = show ? 'block' : 'none';
    if (show) {
        updateEigenvaluePlot();
    }
}

function updateEigenvaluePlot() {
    if (!eigenvalueCanvas || !eigenvalueCtx) return;
    if (!eigenvaluePlotCheckbox || !eigenvaluePlotCheckbox.checked) return;
    
    const topology = detectPointGraphTopology();
    if (topology.N < 2) return;
    
    // Get alpha and beta from sliders
    const alpha = phaseAlphaInput ? parseInt(phaseAlphaInput.value) / 10 : 1.0;
    const beta = phaseBetaInput ? parseInt(phaseBetaInput.value) / 10 : 1.0;
    
    let spectrum;
    
    // For known topologies, use analytic formulas
    // For general/unknown topologies, use numerical computation
    if (topology.type === 'general' || topology.type === 'tree') {
        // Compute numerical eigenvalues from actual adjacency matrix
        spectrum = computeNumericalSpectrum(alpha, beta);
    } else {
        // Use analytic formulas for known topologies
        spectrum = computeSpectrum(topology, alpha, beta);
    }
    
    if (!spectrum || !spectrum.eigenvalues || spectrum.eigenvalues.length === 0) {
        return;
    }
    
    // Draw the eigenvalue plot
    drawEigenvaluePlot(spectrum, alpha, beta);
    
    // Update info display
    updateEigenvalueInfo(spectrum);
}

// Compute spectrum numerically from actual graph adjacency matrix
function computeNumericalSpectrum(alpha, beta) {
    // Get the skew-symmetric adjacency matrix from graph state
    const matrix = state.adjacencyMatrix;
    if (!matrix || matrix.length < 2) return null;
    
    const n = matrix.length;
    
    // Compute numerical eigenvalues of skew-symmetric matrix
    const numericalEigs = computeSkewSymmetricEigenvalues(matrix);
    
    if (!numericalEigs || numericalEigs.length === 0) return null;
    
    // Convert to spectrum format with alpha/beta scaling
    // numericalEigs have {real, imag} where real=0 for skew-symmetric
    const eigenvalues = numericalEigs.map(e => ({
        re: -alpha,           // Real part is -α (damping)
        im: e.imag * beta,    // Imaginary part scaled by β
        approx: false
    }));
    
    // Find b1 (max |imag| before scaling)
    const maxImag = Math.max(...numericalEigs.map(e => Math.abs(e.imag)));
    const b1_over_beta = maxImag;
    
    return {
        eigenvalues: eigenvalues.sort((a, b) => b.im - a.im),
        b1_over_beta,
        exactSpectrum: false,  // Numerical, not analytic
        realBounds: [-alpha, -alpha],
        imagBounds: [-b1_over_beta * beta, b1_over_beta * beta]
    };
}

function drawEigenvaluePlot(spectrum, alpha, beta) {
    const canvas = eigenvalueCanvas;
    const ctx = eigenvalueCtx;
    const W = canvas.width;
    const H = canvas.height;
    
    // Clear canvas
    ctx.fillStyle = '#0a0a1a';
    ctx.fillRect(0, 0, W, H);
    
    // Use FIXED scale based on slider max values so eigenvalues visually move
    // Max alpha is 5.0 (slider 0-50 / 10), max beta is 5.0
    // b1_over_beta typically ranges from 1 to ~10 depending on graph
    const maxBeta = 5.0;
    const maxAlpha = 5.0;
    const b1 = spectrum.b1_over_beta || 2;
    
    // Fixed scale: accommodate max possible spread
    const fixedMaxImag = Math.max(b1 * maxBeta, 10) * 1.2;  // Max imaginary extent
    const fixedMaxReal = Math.max(maxAlpha, 2) * 1.5;       // Max real extent
    
    // Scale factors (fixed, so eigenvalues move visually)
    const scaleX = (W * 0.4) / fixedMaxReal;
    const scaleY = (H * 0.42) / fixedMaxImag;
    const cx = W * 0.55;  // Origin position (shifted right for stable region)
    const cy = H / 2;
    
    // Draw stable region (left half-plane)
    ctx.fillStyle = 'rgba(76, 175, 80, 0.15)';
    ctx.fillRect(0, 0, cx, H);
    
    // Draw axes
    ctx.strokeStyle = '#444466';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, cy);
    ctx.lineTo(W, cy);
    ctx.moveTo(cx, 0);
    ctx.lineTo(cx, H);
    ctx.stroke();
    
    // Draw stability boundary (Re = 0) - highlighted
    ctx.strokeStyle = '#4CAF50';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx, 0);
    ctx.lineTo(cx, H);
    ctx.stroke();
    
    // Draw alpha reference line (Re = -α) if α > 0
    if (alpha > 0.01) {
        const alphaX = cx - alpha * scaleX;
        if (alphaX > 5) {
            ctx.strokeStyle = '#9c27b0';
            ctx.lineWidth = 1.5;
            ctx.setLineDash([4, 4]);
            ctx.beginPath();
            ctx.moveTo(alphaX, 0);
            ctx.lineTo(alphaX, H);
            ctx.stroke();
            ctx.setLineDash([]);
            
            // Label
            ctx.fillStyle = '#9c27b0';
            ctx.font = '10px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(`-α = ${(-alpha).toFixed(1)}`, alphaX, 15);
        }
    }
    
    // Draw bounding rectangle showing current bounds
    if (spectrum.realBounds && spectrum.imagBounds) {
        const x1 = cx + spectrum.realBounds[0] * scaleX;
        const x2 = cx + spectrum.realBounds[1] * scaleX;
        const y1 = cy - spectrum.imagBounds[1] * scaleY;
        const y2 = cy - spectrum.imagBounds[0] * scaleY;
        
        ctx.strokeStyle = '#ff9800';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([4, 4]);
        ctx.strokeRect(x1, y1, x2 - x1, y2 - y1);
        ctx.setLineDash([]);
    }
    
    // Draw eigenvalues as points - batch for efficiency
    const eigs = spectrum.eigenvalues || [];
    
    // Separate stable/unstable
    const stablePoints = [];
    const unstablePoints = [];
    
    for (let i = 0; i < eigs.length; i++) {
        const eig = eigs[i];
        const x = cx + eig.re * scaleX;
        const y = cy - eig.im * scaleY;
        
        // Skip if outside canvas
        if (x < -10 || x > W + 10 || y < -10 || y > H + 10) continue;
        
        if (eig.re < 0) {
            stablePoints.push({x, y});
        } else {
            unstablePoints.push({x, y});
        }
    }
    
    // Draw stable eigenvalues (green)
    if (stablePoints.length > 0) {
        ctx.fillStyle = '#4CAF50';
        ctx.beginPath();
        for (let i = 0; i < stablePoints.length; i++) {
            const p = stablePoints[i];
            ctx.moveTo(p.x + 5, p.y);
            ctx.arc(p.x, p.y, 5, 0, 2 * Math.PI);
        }
        ctx.fill();
    }
    
    // Draw unstable/marginal eigenvalues (orange/red)
    if (unstablePoints.length > 0) {
        ctx.fillStyle = '#ff9800';
        ctx.beginPath();
        for (let i = 0; i < unstablePoints.length; i++) {
            const p = unstablePoints[i];
            ctx.moveTo(p.x + 5, p.y);
            ctx.arc(p.x, p.y, 5, 0, 2 * Math.PI);
        }
        ctx.fill();
    }
    
    // Labels
    ctx.fillStyle = '#888';
    ctx.font = '11px sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText('Im(λ)', W - 5, 15);
    ctx.textAlign = 'left';
    ctx.fillText('Re(λ)', W - 35, cy - 5);
    
    // Show current parameters
    ctx.fillStyle = '#4a9eff';
    ctx.font = '11px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`α=${alpha.toFixed(1)}, β=${beta.toFixed(1)}`, 8, H - 8);
    
    // Show eigenvalue count
    ctx.fillStyle = '#666';
    ctx.fillText(`n=${eigs.length}`, 8, 15);
}

function updateEigenvalueInfo(spectrum) {
    // Update numerical displays
    if (evRealMax) {
        const maxRe = Math.max(...spectrum.eigenvalues.map(e => e.re));
        evRealMax.textContent = maxRe.toFixed(3);
    }
    
    if (evImagMax) {
        const maxIm = Math.max(...spectrum.eigenvalues.map(e => Math.abs(e.im)));
        evImagMax.textContent = maxIm.toFixed(3);
    }
    
    // Update stability indicator
    if (stabilityIndicator) {
        const maxRe = Math.max(...spectrum.eigenvalues.map(e => e.re));
        
        if (maxRe < -0.001) {
            stabilityIndicator.className = 'stability-badge stable';
            stabilityIndicator.textContent = 'Stable (Re < 0)';
        } else if (maxRe < 0.001) {
            stabilityIndicator.className = 'stability-badge marginally-stable';
            stabilityIndicator.textContent = 'Marginally Stable';
        } else {
            stabilityIndicator.className = 'stability-badge unstable';
            stabilityIndicator.textContent = 'Unstable (Re > 0)';
        }
    }
}

// =====================================================
// MODE EXPLANATION FUNCTIONS (NEW IN V17)
// =====================================================

function updatePhaseModeExplanation() {
    if (!phaseModeHint || !phaseModeSelect) return;
    
    const mode = phaseModeSelect.value;
    const explanations = {
        'displacement': 'Ellipse shape reveals phase relationship between nodes - circular = 90° phase difference, linear = in-phase',
        'velocity': 'Shows position vs velocity of a node - reveals momentum and oscillation characteristics',
        'node-power': 'Power = xᵢ·ẋᵢ shows instantaneous energy flow rate at node i',
        'power-power': 'Compares energy flow patterns between two nodes - useful for energy transfer analysis',
        'edge-power': 'Edge power Pᵢⱼ = Aᵢⱼ·xᵢ·xⱼ shows true power exchange along edge i→j'
    };
    
    phaseModeHint.textContent = explanations[mode] || 'Select a plot mode';
}

function updateAnimationModeExplanation() {
    if (!animationModeHint || !animationModeSelect) return;
    
    const mode = animationModeSelect.value;
    const freezeContainer = document.getElementById('freeze-nodes-container');
    
    const explanations = {
        'displacement': 'Color shows node state magnitude: cyan (+) / magenta (-). Arrows show product xᵢxⱼ between connected nodes.',
        'power': `<strong>Edge Power Flow: P<sub>ij</sub> = A<sub>ij</sub>·x<sub>i</sub>·x<sub>j</sub></strong>
<b>Vertices:</b> <span style="color:#4FD1C5">●</span> Cyan = net gain | <span style="color:#F87171">●</span> Coral = net loss<br>
<b>Arrows:</b> True edge power exchange. Direction = flow. Glow/length = |P<sub>ij</sub>|<br>
<em>Skew-symmetric: P<sub>ij</sub> = −P<sub>ji</sub> (energy conserved)</em>`
    };
    
    animationModeHint.innerHTML = explanations[mode] || 'Select an animation mode';
    
    // Show freeze toggle only in power mode
    if (freezeContainer) {
        freezeContainer.style.display = mode === 'power' ? 'flex' : 'none';
    }
}

function compareWithNumericalEigenvalues() {
    if (!currentSpectrum || !zrComparisonDisplay) return;
    
    const alpha = parseFloat(zrAlphaInput?.value || 1.0);
    const beta = parseFloat(zrBetaInput?.value || 1.0);
    
    // Get numerical eigenvalues from the Analyze tab computation
    // These are stored in the spectral-analysis module
    const numericalEigs = getNumericalSkewEigenvalues();
    
    if (!numericalEigs || numericalEigs.length === 0) {
        zrComparisonDisplay.innerHTML = '<span class="hint">No numerical eigenvalues available. Generate a graph first.</span>';
        return;
    }
    
    const comparison = compareWithNumerical(currentSpectrum, numericalEigs, alpha, beta);
    
    if (!comparison.valid) {
        zrComparisonDisplay.innerHTML = `<span class="hint">${comparison.message}</span>`;
        return;
    }
    
    const tightnessPercent = parseFloat(comparison.tightness.upper) || 0;
    
    zrComparisonDisplay.innerHTML = `
        <div class="bound-item">
            <span class="bound-label">Predicted max |Im(λ)|:</span>
            <span class="bound-value">${comparison.predicted.maxImag.toFixed(4)}</span>
        </div>
        <div class="bound-item">
            <span class="bound-label">Actual max |Im(λ)|:</span>
            <span class="bound-value">${comparison.actual.maxImag.toFixed(4)}</span>
        </div>
        <div class="bound-item">
            <span class="bound-label">Bound tightness:</span>
            <span class="bound-value ${comparison.boundsHold ? 'stable' : 'unstable'}">${comparison.tightness.upper}</span>
        </div>
        <div class="tightness-bar">
            <div class="tightness-fill" style="width: ${Math.min(tightnessPercent, 100)}%"></div>
        </div>
        <div class="bound-item">
            <span class="bound-label">Bounds hold:</span>
            <span class="bound-value ${comparison.boundsHold ? 'stable' : 'unstable'}">${comparison.boundsHold ? '✓ Yes' : '✗ No'}</span>
        </div>
    `;
}

function getNumericalSkewEigenvalues() {
    // Extract numerical eigenvalues from state
    // These come from the matrix computation in spectral-analysis
    const n = state.vertexMeshes.length;
    if (n === 0) return [];
    
    // Compute eigenvalues of skew-symmetric matrix using Jacobi-like method
    const A = state.adjacencyMatrix;
    const eigenvalues = [];
    
    // For skew-symmetric matrices, eigenvalues are purely imaginary
    // Use singular values of A (which equal |imaginary parts|)
    // Simple approach: compute AtA eigenvalues, take sqrt
    const AtA = [];
    for (let i = 0; i < n; i++) {
        AtA[i] = [];
        for (let j = 0; j < n; j++) {
            let sum = 0;
            for (let k = 0; k < n; k++) {
                sum += A[k][i] * A[k][j];
            }
            AtA[i][j] = sum;
        }
    }
    
    // Simple power iteration to get largest eigenvalue
    let v = Array(n).fill(1);
    for (let iter = 0; iter < 50; iter++) {
        let newV = Array(n).fill(0);
        for (let i = 0; i < n; i++) {
            for (let j = 0; j < n; j++) {
                newV[i] += AtA[i][j] * v[j];
            }
        }
        const norm = Math.sqrt(newV.reduce((s, x) => s + x * x, 0));
        if (norm > 1e-10) {
            v = newV.map(x => x / norm);
        }
    }
    
    let lambda = 0;
    for (let i = 0; i < n; i++) {
        for (let j = 0; j < n; j++) {
            lambda += v[i] * AtA[i][j] * v[j];
        }
    }
    
    const maxImag = Math.sqrt(Math.max(0, lambda));
    eigenvalues.push({ imag: maxImag });
    eigenvalues.push({ imag: -maxImag });
    
    return eigenvalues;
}

function computeAndDisplayDirectSum() {
    if (!directsumG1Select || !directsumG2Select || !directsumResult) return;
    
    const alpha = parseFloat(zrAlphaInput?.value || 1.0);
    const beta = parseFloat(zrBetaInput?.value || 1.0);
    
    // Get G1 spectrum
    let spectrum1;
    if (directsumG1Select.value === 'current') {
        const topology = detectPointGraphTopology();
        spectrum1 = computeSpectrum(topology, alpha, beta);
    } else {
        const g1Type = directsumG1Select.value.replace(/\d+/, '');
        const g1N = parseInt(directsumG1Select.value.match(/\d+/)?.[0] || 4);
        spectrum1 = computeSpectrum({ type: g1Type, N: g1N }, alpha, beta);
    }
    
    // Get G2 spectrum
    const g2Type = directsumG2Select.value.replace(/\d+/, '');
    const g2N = parseInt(directsumG2Select.value.match(/\d+/)?.[0] || 4);
    const spectrum2 = computeSpectrum({ type: g2Type, N: g2N }, alpha, beta);
    
    // Compute direct sum
    const sumSpectrum = computeDirectSum(spectrum1, spectrum2);
    
    directsumResult.innerHTML = `
        <div class="bound-item">
            <span class="bound-label">G₁ b₁/β:</span>
            <span class="bound-value">${spectrum1.b1_over_beta.toFixed(4)}</span>
        </div>
        <div class="bound-item">
            <span class="bound-label">G₂ b₁/β:</span>
            <span class="bound-value">${spectrum2.b1_over_beta.toFixed(4)}</span>
        </div>
        <div class="bound-item">
            <span class="bound-label">G₁⊕G₂ b₁/β:</span>
            <span class="bound-value">${sumSpectrum.b1_over_beta.toFixed(4)}</span>
        </div>
        <div class="bound-item">
            <span class="bound-label">Combined Im(λ):</span>
            <span class="bound-value">[${sumSpectrum.imagBounds[0].toFixed(3)}, ${sumSpectrum.imagBounds[1].toFixed(3)}]</span>
        </div>
    `;
}

// =====================================================
// GRAPH GENERATION
// =====================================================

function generateGraph() {
    clearGraph();
    
    const n = parseInt(numVerticesInput.value);
    const radius = parseInt(radiusInput.value);
    const layout = layoutTypeSelect.value;
    
    // Initialize adjacency matrices
    state.adjacencyMatrix = Array(n).fill(null).map(() => Array(n).fill(0));
    state.symmetricAdjMatrix = Array(n).fill(null).map(() => Array(n).fill(0));
    
    // Get positions based on layout type
    let positions;
    switch (layout) {
        case 'sphere':
            positions = getSpherePositions(n, radius);
            break;
        case 'concentric-2':
            positions = getConcentricCirclePositions2(n, radius, parseInt(innerRatioInput.value), splitModeSelect.value, customSplitInput.value);
            break;
        case 'concentric-3':
            positions = getConcentricCirclePositions3(n, radius, parseInt(innerRatioInput.value), parseInt(middleRatioInput.value), splitModeSelect.value, customSplitInput.value);
            break;
        case 'concentric-spheres-2':
            positions = getConcentricSpherePositions2(n, radius, parseInt(innerRatioInput.value), splitModeSelect.value, customSplitInput.value);
            break;
        default:
            positions = getCirclePositions(n, radius);
    }
    
    // Create vertices
    for (let i = 0; i < n; i++) {
        createVertex(positions[i], i);
    }
    
    // Update phase diagram selectors
    updatePhaseNodeSelectors();
    
    // Reset dynamics caches
    invalidateCaches();
    
    // Update statistics and analyze tab
    updateStats();
    updateAnalyzeTabIfVisible();
    
    // Trigger physics audit
    onGraphChanged();
}

// Helper to update analyze tab if it's currently visible
function updateAnalyzeTabIfVisible() {
    const analyzeTab = document.getElementById('sidebar-analyze');
    if (analyzeTab && analyzeTab.classList.contains('active')) {
        showAnalysis();
    }
}

// Show/hide template parameter controls based on selection
function updateTemplateParams() {
    const template = templateSelect.value;
    
    // Hide all param sections first
    if (templateParams) templateParams.style.display = 'none';
    if (paramN) paramN.style.display = 'none';
    if (paramDepth) paramDepth.style.display = 'none';
    if (paramBranches) paramBranches.style.display = 'none';
    if (paramKary) paramKary.style.display = 'none';
    if (paramGrid) paramGrid.style.display = 'none';
    if (paramCuboid) paramCuboid.style.display = 'none';
    if (paramHypercube) paramHypercube.style.display = 'none';
    if (paramGenPetersen) paramGenPetersen.style.display = 'none';
    if (paramLollipop) paramLollipop.style.display = 'none';
    if (paramKneser) paramKneser.style.display = 'none';
    if (paramRook) paramRook.style.display = 'none';
    if (paramNBar) paramNBar.style.display = 'none';
    if (paramNLink) paramNLink.style.display = 'none';
    if (paramDrum) paramDrum.style.display = 'none';
    
    // Show relevant params based on template
    let showParams = false;
    
    // Basic families that just need n (vertex count)
    const basicFamilies = [
        'cycle', 'path', 'star', 'complete', 'wheel', 
        'prism', 'antiprism', 'crown', 'bipartite', 'cocktail', 'circulant',
        'ladder', 'mobius-ladder', 'circular-ladder',
        'helm', 'gear', 'sun', 'friendship', 'web',
        'book', 'pan', 'stacked-prism',
        'mass-chain', 'mass-star', 'mass-tree', 'mass-cantilever', 'mass-bridge', 'mass-grid'
    ];
    
    if (basicFamilies.includes(template)) {
        if (paramN) paramN.style.display = 'flex';
        showParams = true;
    }
    
    switch (template) {
        case 'binary-tree':
            if (paramDepth) paramDepth.style.display = 'flex';
            showParams = true;
            break;
        case 'star-path':
        case 'double-star':
            if (paramBranches) paramBranches.style.display = 'flex';
            showParams = true;
            break;
        case 'general-star-tree':
            if (paramDepth) paramDepth.style.display = 'flex';
            if (paramBranches) paramBranches.style.display = 'flex';
            showParams = true;
            break;
        case 'k-ary-tree':
            if (paramDepth) paramDepth.style.display = 'flex';
            if (paramKary) paramKary.style.display = 'flex';
            showParams = true;
            break;
        case 'grid':
        case 'general-ladder':
        case 'torus':
            if (paramGrid) paramGrid.style.display = 'flex';
            showParams = true;
            break;
        case 'n-bar-mechanism':
            if (paramNBar) paramNBar.style.display = 'flex';
            showParams = true;
            break;
        case 'four-bar':
        case 'five-bar':
        case 'six-bar':
        case 'seven-bar':
            // Fixed n-bar structures, no parameters needed
            break;
        case 'n-link-pendulum':
            if (paramNLink) paramNLink.style.display = 'flex';
            showParams = true;
            break;
        case 'one-link-pendulum':
        case 'two-link-pendulum':
        case 'three-link-pendulum':
            // Fixed pendulum structures, no parameters needed
            break;
        case 'cuboid':
            if (paramCuboid) paramCuboid.style.display = 'flex';
            showParams = true;
            break;
        case 'hypercube':
            if (paramHypercube) paramHypercube.style.display = 'flex';
            showParams = true;
            break;
        case 'gen-petersen':
            if (paramGenPetersen) paramGenPetersen.style.display = 'flex';
            showParams = true;
            break;
        case 'lollipop':
        case 'barbell':
            if (paramLollipop) paramLollipop.style.display = 'flex';
            showParams = true;
            break;
        case 'kneser':
            if (paramKneser) paramKneser.style.display = 'flex';
            showParams = true;
            break;
        case 'rook':
            if (paramRook) paramRook.style.display = 'flex';
            showParams = true;
            break;
        case 'mass-drum':
        case 'mass-drum-constrained':
            if (paramDrum) paramDrum.style.display = 'flex';
            showParams = true;
            break;
    }
    
    if (templateParams) templateParams.style.display = showParams ? 'block' : 'none';
    
    // Update the visual preview
    updateTemplatePreview(template);
}

// Template metadata for preview
const TEMPLATE_INFO = {
    'custom': { name: 'Custom Graph', nodes: '—', edges: '—', formula: 'Build manually' },
    // Realizable Systems (mass-spring configurations)
    'mass-chain': { name: 'Mass-Spring Chain', nodes: '2n+1', edges: '2n', formula: 'Grounded at both ends', realizable: true },
    'mass-star': { name: 'Star Mass System', nodes: '2n+1', edges: '2n', formula: 'Hub spring + n masses', realizable: true },
    'mass-tree': { name: 'Tree Mass System', nodes: 'varies', edges: 'n-1', formula: 'Bipartite tree structure', realizable: true },
    'mass-cantilever': { name: 'Cantilever Beam', nodes: '3n', edges: '3n-1', formula: 'Fixed end, free end', realizable: true },
    'mass-bridge': { name: 'Simple Bridge', nodes: '2n+2', edges: '3n+1', formula: 'Supported at ends', realizable: true },
    'mass-grid': { name: 'Mass-Spring Grid', nodes: 'm×n+(m-1)×n+m×(n-1)', edges: 'varies', formula: 'Checkerboard pattern', realizable: true },
    'mass-drum': { name: 'Drum (Radial)', nodes: '1+3nm', edges: '4nm', formula: 'n branches × m rings', realizable: true },
    'mass-drum-constrained': { name: 'Drum Constrained', nodes: '1+3nm+n', edges: '4nm+n', formula: 'With grounded boundary springs', realizable: true },
    // Basic graphs
    'path': { name: 'Path Graph Pₙ', nodes: 'n', edges: 'n-1', formula: 'λₖ = 2cos(kπ/(n+1))' },
    'cycle': { name: 'Cycle Graph Cₙ', nodes: 'n', edges: 'n', formula: 'λₖ = 2cos(2kπ/n)' },
    'star': { name: 'Star Graph Sₙ', nodes: 'n', edges: 'n-1', formula: 'λ = ±√(n-1), 0^(n-2)' },
    'complete': { name: 'Complete Graph Kₙ', nodes: 'n', edges: 'n(n-1)/2', formula: 'λ = n-1, -1^(n-1)' },
    'binary-tree': { name: 'Binary Tree', nodes: '2^(d+1)-1', edges: 'n-1', formula: 'Bipartite spectrum' },
    'star-path': { name: "S'ₚ Tree", nodes: '2p+1', edges: '2p', formula: 'See Appendix' },
    'double-star': { name: 'S²ₚ Tree', nodes: '3p+1', edges: '3p', formula: 'See Appendix' },
    'general-star-tree': { name: 'Sᵈₚ Tree', nodes: 'dp+1', edges: 'dp', formula: 'Generalized formula' },
    'k-ary-tree': { name: 'k-ary Tree', nodes: '(k^(d+1)-1)/(k-1)', edges: 'n-1', formula: 'Bipartite spectrum' },
    'caterpillar': { name: 'Caterpillar', nodes: 'n', edges: 'n-1', formula: 'Tree spectrum' },
    'spider': { name: 'Spider Graph', nodes: 'n', edges: 'n-1', formula: 'Tree spectrum' },
    'broom': { name: 'Broom Graph', nodes: 'n', edges: 'n-1', formula: 'Tree spectrum' },
    'grid': { name: '2D Grid Pₘ□Pₙ', nodes: 'm×n', edges: '2mn-m-n', formula: 'λᵢⱼ = 2cos(iπ/(m+1)) + 2cos(jπ/(n+1))' },
    'general-ladder': { name: 'General Ladder', nodes: 'm×n', edges: 'varies', formula: 'Truss eigenvalues' },
    'cuboid': { name: '3D Cuboid', nodes: 'm×n×k', edges: 'varies', formula: 'Product formula' },
    'torus': { name: 'Torus Cₘ□Cₙ', nodes: 'm×n', edges: '2mn', formula: 'λᵢⱼ = 2cos(2iπ/m) + 2cos(2jπ/n)' },
    'five-bar': { name: 'Five-Bar Mechanism', nodes: '14', edges: '20', formula: 'Gyro-bondgraph spectrum' },
    'four-bar': { name: 'Four-Bar Mechanism', nodes: '9', edges: '12', formula: 'Gyro-bondgraph spectrum' },
    'six-bar': { name: 'Six-Bar Mechanism', nodes: '19', edges: '28', formula: 'Gyro-bondgraph spectrum' },
    'seven-bar': { name: 'Seven-Bar Mechanism', nodes: '24', edges: '36', formula: 'Gyro-bondgraph spectrum' },
    'n-bar-mechanism': { name: 'n-Bar Mechanism', nodes: '5(m-3)+4', edges: '8(m-3)+4', formula: 'Gyro-bondgraph spectrum' },
    'one-link-pendulum': { name: '1-Link Pendulum', nodes: '6', edges: '6', formula: 'λ²(λ²-1)(λ²-5)' },
    'two-link-pendulum': { name: '2-Link Pendulum', nodes: '11', edges: '14', formula: 'λ³(λ⁴-3λ²+1)(λ⁴-11λ²+21)' },
    'three-link-pendulum': { name: '3-Link Pendulum', nodes: '16', edges: '22', formula: 'No closed form (n≥3)' },
    'n-link-pendulum': { name: 'n-Link Pendulum', nodes: '5n+1', edges: '8n-2', formula: 'Closed form for n≤2 only' },
    'ladder': { name: 'Simple Ladder Lₙ', nodes: '2n', edges: '3n-2', formula: 'λₖ = 1 ± √(1+4cos²(kπ/(n+1)))' },
    'circular-ladder': { name: 'Circular Ladder', nodes: '2n', edges: '3n', formula: 'λₖ = 1 ± √(1+4cos²(kπ/n))' },
    'mobius-ladder': { name: 'Möbius Ladder', nodes: '2n', edges: '3n', formula: 'Twisted spectrum' },
    'bipartite': { name: 'Complete Bipartite Kₘ,ₙ', nodes: 'm+n', edges: 'mn', formula: 'λ = ±√(mn), 0^(m+n-2)' },
    'crown': { name: 'Crown Graph', nodes: '2n', edges: 'n(n-1)', formula: 'λ = n-1, 1^(n-1), -1^(n-1), -(n-1)' },
    'wheel': { name: 'Wheel Graph Wₙ', nodes: 'n+1', edges: '2n', formula: 'λ = 1+2cos(2kπ/n), others' },
    'prism': { name: 'Prism Graph', nodes: '2n', edges: '3n', formula: 'GP(n,1) spectrum' },
    'antiprism': { name: 'Antiprism', nodes: '2n', edges: '4n', formula: '4-regular spectrum' },
    'cocktail': { name: 'Cocktail Party K₂ₙ-nK₂', nodes: '2n', edges: 'n(2n-2)', formula: 'λ = 2n-2, 0^(n-1), -2^n' },
    'circulant': { name: 'Circulant C(n,{1,2})', nodes: 'n', edges: '2n', formula: 'λₖ = 2cos(2kπ/n) + 2cos(4kπ/n)' },
    'hypercube': { name: 'Hypercube Qd', nodes: '2^d', edges: 'd·2^(d-1)', formula: 'λₖ = d-2k, mult C(d,k)' },
    'hypercube2': { name: 'Hypercube Q₂', nodes: '4', edges: '4', formula: 'λ = 2, 0², -2' },
    'hypercube3': { name: 'Hypercube Q₃', nodes: '8', edges: '12', formula: 'λ = 3, 1³, -1³, -3' },
    'hypercube4': { name: 'Hypercube Q₄', nodes: '16', edges: '32', formula: 'λ = 4, 2⁴, 0⁶, -2⁴, -4' },
    'hypercube5': { name: 'Hypercube Q₅', nodes: '32', edges: '80', formula: 'λ = 5, 3⁵, 1¹⁰, -1¹⁰, -3⁵, -5' },
    'petersen': { name: 'Petersen Graph', nodes: '10', edges: '15', formula: 'λ = 3, 1⁵, -2⁴' },
    'octahedron': { name: 'Octahedron K₂,₂,₂', nodes: '6', edges: '12', formula: 'λ = 4, 0⁴, -2' },
    'icosahedron': { name: 'Icosahedron', nodes: '12', edges: '30', formula: 'λ = 5, √5³, 0⁴, -√5³, -1' },
    'dodecahedron': { name: 'Dodecahedron', nodes: '20', edges: '30', formula: 'λ = 3, √5⁴, 1⁵, -2⁴, others' },
    'cuboctahedron': { name: 'Cuboctahedron', nodes: '12', edges: '24', formula: 'λ = 4, 1⁴, -2⁶, 2' },
    // New Priority 1 templates
    'helm': { name: 'Helm Graph Hₙ', nodes: '2n+1', edges: '3n', formula: 'Wheel + pendants spectrum' },
    'gear': { name: 'Gear Graph Gₙ', nodes: '2n+1', edges: '3n', formula: 'Wheel variant spectrum' },
    'sun': { name: 'Sun/Sunlet Graph', nodes: '2n', edges: '2n', formula: 'λₖ = cos(2kπ/n) ± √(...)' },
    'friendship': { name: 'Friendship Fₙ', nodes: '2n+1', edges: '3n', formula: 'λ = 2n, 1ⁿ, -1ⁿ' },
    'gen-petersen': { name: 'Gen. Petersen GP(n,k)', nodes: '2n', edges: '3n', formula: 'λⱼ = 1+2cos(2πj/n) ± √(...)' },
    'book': { name: 'Book Graph Bₙ', nodes: 'n+2', edges: '2n+1', formula: 'λ = n+1, 1, -1 (with mult.)' },
    'lollipop': { name: 'Lollipop Lₘ,ₙ', nodes: 'm+n', edges: 'm(m-1)/2+n', formula: 'Kₘ + Pₙ spectrum' },
    'barbell': { name: 'Barbell Graph', nodes: '2m+n', edges: 'm(m-1)+n-1', formula: 'Kₘ - Pₙ - Kₘ spectrum' },
    'pan': { name: 'Pan/Tadpole Graph', nodes: 'n+1', edges: 'n+1', formula: 'Cₙ + pendant spectrum' },
    // Phase 2: Parameterized families
    'kneser': { name: 'Kneser K(n,k)', nodes: 'C(n,k)', edges: 'varies', formula: 'λⱼ = (-1)ʲC(n-k-j,k-j)' },
    'rook': { name: 'Rook Graph Kₘ□Kₙ', nodes: 'm×n', edges: 'mn(m+n-2)/2', formula: 'λᵢⱼ = (m-1-2i)+(n-1-2j)' },
    'web': { name: 'Web Graph Wbₙ', nodes: '2n', edges: '3n', formula: 'Helm variant spectrum' },
    'stacked-prism': { name: 'Stacked Prism Yₙ', nodes: '2n', edges: '4n-n', formula: 'Prism stack spectrum' },
    // Phase 3: Famous graphs
    'heawood': { name: 'Heawood Graph', nodes: '14', edges: '21', formula: 'λ = 3, 2³, √2³, -√2³, -1³, -3' },
    'pappus': { name: 'Pappus Graph', nodes: '18', edges: '27', formula: 'λ = 3, √3⁴, 0⁴, -√3⁴, -3' },
    'desargues': { name: 'Desargues Graph', nodes: '20', edges: '30', formula: 'GP(10,3): λ = 3, 2⁴, 0⁵, -1⁵, -2⁴, -3' },
    'mobius-kantor': { name: 'Möbius-Kantor', nodes: '16', edges: '24', formula: 'GP(8,3): 3-regular bipartite' },
    'clebsch': { name: 'Clebsch Graph', nodes: '16', edges: '40', formula: 'λ = 5, 1¹⁰, -3⁵' },
    'shrikhande': { name: 'Shrikhande Graph', nodes: '16', edges: '48', formula: 'λ = 6, 2⁶, -2⁹' },
    'tutte-coxeter': { name: 'Tutte-Coxeter (Levi)', nodes: '30', edges: '45', formula: '3-regular bipartite, girth 8' },
    'franklin': { name: 'Franklin Graph', nodes: '12', edges: '18', formula: '3-regular bipartite' },
    'mcgee': { name: 'McGee Graph', nodes: '24', edges: '36', formula: '(3,7)-cage' },
    'nauru': { name: 'Nauru Graph', nodes: '24', edges: '36', formula: 'GP(12,5): 3-regular' }
};

// Generate preview graph positions and edges for a template
function getPreviewGraph(template) {
    const previewSize = 6; // Small n for preview
    let positions = [];
    let edges = [];
    
    switch (template) {
        case 'custom':
            return { positions: [], edges: [], n: 0 };
        
        // ===== REALIZABLE SYSTEMS =====
        case 'mass-chain': {
            // Alternating masses (blue) and springs (orange), grounded at ends
            // Pattern: [ground]-spring-mass-spring-mass-...-spring-[ground]
            const nMasses = 3;
            for (let i = 0; i < nMasses; i++) {
                // Mass (p-node)
                positions.push({ x: i * 2 - (nMasses - 1), y: 0 });
            }
            // Springs between masses (q-nodes)
            for (let i = 0; i < nMasses - 1; i++) {
                positions.push({ x: i * 2 - (nMasses - 1) + 1, y: 0.3 });
                edges.push([i, nMasses + i]); // mass to spring
                edges.push([nMasses + i, i + 1]); // spring to next mass
            }
            // Grounded springs at ends
            positions.push({ x: -(nMasses - 1) - 1, y: 0.3 }); // left ground spring
            positions.push({ x: (nMasses - 1) + 1, y: 0.3 }); // right ground spring
            edges.push([positions.length - 2, 0]); // left ground to first mass
            edges.push([positions.length - 1, nMasses - 1]); // right ground to last mass
            break;
        }
        
        case 'mass-star': {
            // Central spring connected to multiple masses
            const nArms = 4;
            positions.push({ x: 0, y: 0 }); // Central spring (q-node)
            for (let i = 0; i < nArms; i++) {
                const angle = (2 * Math.PI * i) / nArms;
                positions.push({ x: Math.cos(angle) * 1.2, y: Math.sin(angle) * 1.2 }); // Mass (p-node)
                edges.push([0, i + 1]);
            }
            break;
        }
        
        case 'mass-tree': {
            // Binary tree: masses at even levels, springs at odd levels
            // Root spring, two masses, four springs (grounded)
            positions.push({ x: 0, y: 1 }); // Root spring (q)
            positions.push({ x: -1, y: 0 }); // Mass 1 (p)
            positions.push({ x: 1, y: 0 }); // Mass 2 (p)
            edges.push([0, 1]); edges.push([0, 2]);
            // Grounded springs
            positions.push({ x: -1.5, y: -0.8 }); positions.push({ x: -0.5, y: -0.8 });
            positions.push({ x: 0.5, y: -0.8 }); positions.push({ x: 1.5, y: -0.8 });
            edges.push([1, 3]); edges.push([1, 4]);
            edges.push([2, 5]); edges.push([2, 6]);
            break;
        }
        
        case 'mass-cantilever': {
            // Fixed at left, free at right
            const nSections = 3;
            for (let i = 0; i < nSections; i++) {
                positions.push({ x: i * 1.5, y: 0 }); // Mass (p)
                if (i < nSections - 1) {
                    positions.push({ x: i * 1.5 + 0.75, y: 0.3 }); // Connecting spring (q)
                }
            }
            // Connect masses via springs
            for (let i = 0; i < nSections - 1; i++) {
                edges.push([i, nSections + i]); // mass to spring
                edges.push([nSections + i, i + 1]); // spring to next mass
            }
            // Grounded spring at fixed end
            positions.push({ x: -0.75, y: 0.3 });
            edges.push([positions.length - 1, 0]);
            break;
        }
        
        case 'mass-bridge': {
            // Simple truss: two rows with diagonal bracing
            // Top row: masses, Bottom supports: grounded springs
            const span = 3;
            // Top masses (p-nodes)
            for (let i = 0; i < span; i++) {
                positions.push({ x: i - 1, y: 0.5 });
            }
            // Connecting springs between top masses (q-nodes)
            for (let i = 0; i < span - 1; i++) {
                positions.push({ x: i - 0.5, y: 0.7 });
                edges.push([i, span + i]);
                edges.push([span + i, i + 1]);
            }
            // Support springs at ends (grounded q-nodes)
            positions.push({ x: -1, y: -0.3 });
            positions.push({ x: span - 2, y: -0.3 });
            edges.push([positions.length - 2, 0]);
            edges.push([positions.length - 1, span - 1]);
            break;
        }
        
        case 'mass-grid': {
            // Checkerboard: masses at (even+even) or (odd+odd), springs elsewhere
            const rows = 3, cols = 3;
            for (let r = 0; r < rows; r++) {
                for (let c = 0; c < cols; c++) {
                    positions.push({ x: c - 1, y: r - 1 });
                    const idx = r * cols + c;
                    if (c < cols - 1) edges.push([idx, idx + 1]);
                    if (r < rows - 1) edges.push([idx, idx + cols]);
                }
            }
            break;
        }
        
        case 'mass-drum': {
            // Simple preview: center + 5 points on a circle with radial and circumferential edges
            const branches = 5;
            positions.push({ x: 0, y: 0 });  // Center
            for (let i = 0; i < branches; i++) {
                const angle = (2 * Math.PI * i) / branches - Math.PI / 2;
                positions.push({ x: Math.cos(angle) * 1.5, y: Math.sin(angle) * 1.5 });
            }
            // Radial edges from center
            for (let i = 1; i <= branches; i++) {
                edges.push([0, i]);
            }
            // Circumferential edges
            for (let i = 1; i <= branches; i++) {
                edges.push([i, (i % branches) + 1]);
            }
            break;
        }
        
        case 'mass-drum-constrained': {
            // Preview: drum with radial boundary springs (grounded)
            const branches = 5;
            positions.push({ x: 0, y: 0 });  // Center (0)
            // Inner ring masses (1-5)
            for (let i = 0; i < branches; i++) {
                const angle = (2 * Math.PI * i) / branches - Math.PI / 2;
                positions.push({ x: Math.cos(angle) * 1.0, y: Math.sin(angle) * 1.0 });
            }
            // Outer ring masses (6-10)
            for (let i = 0; i < branches; i++) {
                const angle = (2 * Math.PI * i) / branches - Math.PI / 2;
                positions.push({ x: Math.cos(angle) * 2.0, y: Math.sin(angle) * 2.0 });
            }
            // Boundary springs (grounded, extending outward) (11-15)
            for (let i = 0; i < branches; i++) {
                const angle = (2 * Math.PI * i) / branches - Math.PI / 2;
                positions.push({ x: Math.cos(angle) * 2.8, y: Math.sin(angle) * 2.8 });
            }
            // Radial edges
            for (let i = 1; i <= branches; i++) {
                edges.push([0, i]);  // Center to inner
                edges.push([i, i + branches]);  // Inner to outer
            }
            // Circumferential inner
            for (let i = 1; i <= branches; i++) {
                edges.push([i, (i % branches) + 1]);
            }
            // Circumferential outer
            for (let i = 1; i <= branches; i++) {
                edges.push([branches + i, branches + (i % branches) + 1]);
            }
            // Boundary springs (radial, from outer masses outward)
            for (let i = 1; i <= branches; i++) {
                edges.push([branches + i, 2 * branches + i]);  // Outer mass to boundary spring
            }
            break;
        }
            
        case 'path':
            for (let i = 0; i < previewSize; i++) {
                positions.push({ x: i - (previewSize-1)/2, y: 0 });
            }
            for (let i = 0; i < previewSize - 1; i++) {
                edges.push([i, i + 1]);
            }
            break;
            
        case 'cycle':
            for (let i = 0; i < previewSize; i++) {
                const angle = (2 * Math.PI * i) / previewSize - Math.PI/2;
                positions.push({ x: Math.cos(angle), y: Math.sin(angle) });
            }
            for (let i = 0; i < previewSize; i++) {
                edges.push([i, (i + 1) % previewSize]);
            }
            break;
            
        case 'star':
            positions.push({ x: 0, y: 0 }); // Center
            for (let i = 0; i < previewSize - 1; i++) {
                const angle = (2 * Math.PI * i) / (previewSize - 1) - Math.PI/2;
                positions.push({ x: Math.cos(angle), y: Math.sin(angle) });
                edges.push([0, i + 1]);
            }
            break;
            
        case 'complete':
            for (let i = 0; i < 5; i++) {
                const angle = (2 * Math.PI * i) / 5 - Math.PI/2;
                positions.push({ x: Math.cos(angle), y: Math.sin(angle) });
            }
            for (let i = 0; i < 5; i++) {
                for (let j = i + 1; j < 5; j++) {
                    edges.push([i, j]);
                }
            }
            break;
            
        case 'wheel':
            positions.push({ x: 0, y: 0 }); // Hub
            for (let i = 0; i < 6; i++) {
                const angle = (2 * Math.PI * i) / 6 - Math.PI/2;
                positions.push({ x: Math.cos(angle), y: Math.sin(angle) });
                edges.push([0, i + 1]); // Spokes
                edges.push([i + 1, ((i + 1) % 6) + 1]); // Rim
            }
            break;
            
        case 'grid':
            const rows = 3, cols = 4;
            for (let r = 0; r < rows; r++) {
                for (let c = 0; c < cols; c++) {
                    positions.push({ x: c - 1.5, y: r - 1 });
                    const idx = r * cols + c;
                    if (c < cols - 1) edges.push([idx, idx + 1]);
                    if (r < rows - 1) edges.push([idx, idx + cols]);
                }
            }
            break;
            
        case 'bipartite':
            // K_{3,3}
            for (let i = 0; i < 3; i++) {
                positions.push({ x: i - 1, y: -0.8 });
            }
            for (let i = 0; i < 3; i++) {
                positions.push({ x: i - 1, y: 0.8 });
            }
            for (let i = 0; i < 3; i++) {
                for (let j = 0; j < 3; j++) {
                    edges.push([i, j + 3]);
                }
            }
            break;
            
        case 'ladder':
            for (let i = 0; i < 4; i++) {
                positions.push({ x: i - 1.5, y: -0.5 });
                positions.push({ x: i - 1.5, y: 0.5 });
                edges.push([i*2, i*2 + 1]); // Rungs
                if (i < 3) {
                    edges.push([i*2, i*2 + 2]); // Bottom rail
                    edges.push([i*2 + 1, i*2 + 3]); // Top rail
                }
            }
            break;
            
        case 'binary-tree':
            // Depth 2 binary tree
            positions = [
                { x: 0, y: -1 },
                { x: -1, y: 0 }, { x: 1, y: 0 },
                { x: -1.5, y: 1 }, { x: -0.5, y: 1 }, { x: 0.5, y: 1 }, { x: 1.5, y: 1 }
            ];
            edges = [[0,1], [0,2], [1,3], [1,4], [2,5], [2,6]];
            break;
            
        case 'petersen':
            // Outer pentagon
            for (let i = 0; i < 5; i++) {
                const angle = (2 * Math.PI * i) / 5 - Math.PI/2;
                positions.push({ x: Math.cos(angle), y: Math.sin(angle) });
            }
            // Inner pentagram
            for (let i = 0; i < 5; i++) {
                const angle = (2 * Math.PI * i) / 5 - Math.PI/2;
                positions.push({ x: 0.4 * Math.cos(angle), y: 0.4 * Math.sin(angle) });
            }
            // Outer edges
            for (let i = 0; i < 5; i++) {
                edges.push([i, (i + 1) % 5]);
            }
            // Spokes
            for (let i = 0; i < 5; i++) {
                edges.push([i, i + 5]);
            }
            // Inner pentagram (jump 2)
            for (let i = 0; i < 5; i++) {
                edges.push([i + 5, ((i + 2) % 5) + 5]);
            }
            break;
            
        case 'hypercube2':
        case 'hypercube3':
            // Q2 (square)
            positions = [
                { x: -0.7, y: -0.7 }, { x: 0.7, y: -0.7 },
                { x: -0.7, y: 0.7 }, { x: 0.7, y: 0.7 }
            ];
            edges = [[0,1], [0,2], [1,3], [2,3]];
            if (template === 'hypercube3') {
                // Add back vertices for Q3 illusion
                positions.push(
                    { x: -0.3, y: -0.3 }, { x: 1.1, y: -0.3 },
                    { x: -0.3, y: 1.1 }, { x: 1.1, y: 1.1 }
                );
                edges.push([4,5], [4,6], [5,7], [6,7]);
                edges.push([0,4], [1,5], [2,6], [3,7]);
            }
            break;
            
        case 'four-bar':
            // 4-bar mechanism: 1 cell diamond pattern
            positions = [
                { x: -1.5, y: 0 }, { x: -0.5, y: 0 },  // Left outer
                { x: 0.5, y: 0 }, { x: 1.5, y: 0 },     // Right outer
                { x: -1, y: -0.8 }, { x: 0, y: -0.5 },  // Bottom row
                { x: 1, y: -0.8 }, { x: 0, y: 0.5 },    // Top intermediate & center
                { x: 0, y: -0.8 }                        // Center diamond
            ];
            edges = [[0,4], [4,1], [1,5], [5,2], [2,6], [6,3],  // Rails
                     [0,7], [7,1], [2,8], [8,3],                  // Outer diamonds
                     [1,8], [8,2], [4,8], [8,5]];                 // Inner diamond
            break;
            
        case 'five-bar':
        case 'n-bar-mechanism':
            // 5-bar mechanism: 2 cell diamond pattern preview
            positions = [
                { x: -2, y: 0 }, { x: -1, y: -1 }, { x: 0, y: 0 },
                { x: -1, y: 1 }, { x: 1, y: -1 }, { x: 2, y: 0 }, { x: 1, y: 1 }
            ];
            edges = [[0,1], [0,3], [1,2], [3,2], [2,4], [2,6], [4,5], [6,5]];
            break;
            
        case 'six-bar':
            // 6-bar mechanism: 3 cell pattern preview
            positions = [
                { x: -3, y: 0 }, { x: -2, y: -1 }, { x: -1, y: 0 },
                { x: -2, y: 1 }, { x: 0, y: -1 }, { x: 1, y: 0 },
                { x: 0, y: 1 }, { x: 2, y: -1 }, { x: 3, y: 0 }, { x: 2, y: 1 }
            ];
            edges = [[0,1], [0,3], [1,2], [3,2], [2,4], [2,6], [4,5], [6,5],
                     [5,7], [5,9], [7,8], [9,8]];
            break;
            
        case 'seven-bar':
            // 7-bar mechanism: 4 cell pattern preview
            positions = [
                { x: -4, y: 0 }, { x: -3, y: -1 }, { x: -2, y: 0 },
                { x: -3, y: 1 }, { x: -1, y: -1 }, { x: 0, y: 0 },
                { x: -1, y: 1 }, { x: 1, y: -1 }, { x: 2, y: 0 },
                { x: 1, y: 1 }, { x: 3, y: -1 }, { x: 4, y: 0 }, { x: 3, y: 1 }
            ];
            edges = [[0,1], [0,3], [1,2], [3,2], [2,4], [2,6], [4,5], [6,5],
                     [5,7], [5,9], [7,8], [9,8], [8,10], [8,12], [10,11], [12,11]];
            break;
            
        case 'one-link-pendulum':
            // 1-link pendulum: 6 nodes, open-ended mechanism
            positions = [
                { x: -1.5, y: 0 },   // 0: left edge
                { x: -1, y: -1 },    // 1: top corner
                { x: -1, y: 1 },     // 2: bottom corner
                { x: 0, y: 0 },      // 3: inner diamond
                { x: 1, y: -1 },     // 4: top tip
                { x: 1, y: 1 }       // 5: bottom tip
            ];
            // Edges: left edge→corners, corners→inner, corners→tips (NOT inner→tips)
            edges = [[0,1], [0,2], [1,3], [2,3], [1,4], [2,5]];
            break;
            
        case 'two-link-pendulum':
        case 'n-link-pendulum':
            // 2-link pendulum preview
            positions = [
                { x: -2, y: 0 },     // 0: left edge
                { x: -1.5, y: -1 },  // 1: top corner 1
                { x: -1.5, y: 1 },   // 2: bottom corner 1
                { x: -0.5, y: 0 },   // 3: inner 1
                { x: 0.5, y: -1 },   // 4: top corner 2
                { x: 0.5, y: 1 },    // 5: bottom corner 2
                { x: 1, y: 0 },      // 6: inner 2
                { x: 1.5, y: -1 },   // 7: top tip
                { x: 1.5, y: 1 }     // 8: bottom tip
            ];
            // Edges: last cell inner connects to corners only, corners connect to tips
            edges = [[0,1], [0,2], [1,3], [2,3], [3,4], [3,5], [4,6], [5,6], [4,7], [5,8]];
            break;
            
        case 'three-link-pendulum':
            // 3-link pendulum preview
            positions = [
                { x: -3, y: 0 },     // 0: left edge
                { x: -2.5, y: -1 }, { x: -2.5, y: 1 }, { x: -1.5, y: 0 },  // 1,2,3: cell 1
                { x: -0.5, y: -1 }, { x: -0.5, y: 1 }, { x: 0.5, y: 0 },   // 4,5,6: cell 2
                { x: 1.5, y: -1 }, { x: 1.5, y: 1 }, { x: 2, y: 0 },       // 7,8,9: cell 3
                { x: 2.5, y: -1 }, { x: 2.5, y: 1 }                         // 10,11: tips
            ];
            // Edges: last cell inner connects to corners only, corners connect to tips
            edges = [[0,1], [0,2], [1,3], [2,3], [3,4], [3,5], [4,6], [5,6], 
                     [6,7], [6,8], [7,9], [8,9], [7,10], [8,11]];
            break;
            
        case 'prism':
            // Triangular prism
            for (let i = 0; i < 3; i++) {
                const angle = (2 * Math.PI * i) / 3 - Math.PI/2;
                positions.push({ x: 0.7 * Math.cos(angle), y: 0.7 * Math.sin(angle) - 0.5 });
                positions.push({ x: 0.7 * Math.cos(angle), y: 0.7 * Math.sin(angle) + 0.5 });
            }
            for (let i = 0; i < 3; i++) {
                edges.push([i*2, i*2 + 1]); // Vertical
                edges.push([i*2, ((i+1)%3)*2]); // Bottom face
                edges.push([i*2 + 1, ((i+1)%3)*2 + 1]); // Top face
            }
            break;
        
        case 'helm':
            // Wheel with pendant vertices
            positions.push({ x: 0, y: 0 }); // Hub
            for (let i = 0; i < 5; i++) {
                const angle = (2 * Math.PI * i) / 5 - Math.PI/2;
                positions.push({ x: 0.6 * Math.cos(angle), y: 0.6 * Math.sin(angle) }); // Rim
                positions.push({ x: 1.1 * Math.cos(angle), y: 1.1 * Math.sin(angle) }); // Pendant
            }
            for (let i = 0; i < 5; i++) {
                edges.push([0, i*2 + 1]); // Spokes
                edges.push([i*2 + 1, ((i+1)%5)*2 + 1]); // Rim
                edges.push([i*2 + 1, i*2 + 2]); // Pendant edges
            }
            break;
            
        case 'gear':
            // Wheel with vertex on each rim edge
            positions.push({ x: 0, y: 0 }); // Hub
            for (let i = 0; i < 5; i++) {
                const angle1 = (2 * Math.PI * i) / 5 - Math.PI/2;
                const angle2 = (2 * Math.PI * (i + 0.5)) / 5 - Math.PI/2;
                positions.push({ x: 0.6 * Math.cos(angle1), y: 0.6 * Math.sin(angle1) }); // Main rim
                positions.push({ x: 1.0 * Math.cos(angle2), y: 1.0 * Math.sin(angle2) }); // Gear tooth
            }
            for (let i = 0; i < 5; i++) {
                edges.push([0, i*2 + 1]); // Spokes
                edges.push([i*2 + 1, i*2 + 2]); // To tooth
                edges.push([i*2 + 2, ((i+1)%5)*2 + 1]); // From tooth
            }
            break;
            
        case 'sun':
            // Cycle with pendant at each vertex
            for (let i = 0; i < 5; i++) {
                const angle = (2 * Math.PI * i) / 5 - Math.PI/2;
                positions.push({ x: 0.5 * Math.cos(angle), y: 0.5 * Math.sin(angle) }); // Inner cycle
                positions.push({ x: 1.0 * Math.cos(angle), y: 1.0 * Math.sin(angle) }); // Pendant
            }
            for (let i = 0; i < 5; i++) {
                edges.push([i*2, ((i+1)%5)*2]); // Cycle
                edges.push([i*2, i*2 + 1]); // Pendants
            }
            break;
            
        case 'friendship':
            // n triangles sharing central vertex (windmill)
            positions.push({ x: 0, y: 0 }); // Center
            for (let i = 0; i < 4; i++) {
                const angle = (2 * Math.PI * i) / 4;
                positions.push({ x: 0.8 * Math.cos(angle - 0.3), y: 0.8 * Math.sin(angle - 0.3) });
                positions.push({ x: 0.8 * Math.cos(angle + 0.3), y: 0.8 * Math.sin(angle + 0.3) });
                edges.push([0, i*2 + 1]);
                edges.push([0, i*2 + 2]);
                edges.push([i*2 + 1, i*2 + 2]);
            }
            break;
            
        case 'gen-petersen':
            // Generalized Petersen GP(5,2) = Petersen graph
            for (let i = 0; i < 5; i++) {
                const angle = (2 * Math.PI * i) / 5 - Math.PI/2;
                positions.push({ x: Math.cos(angle), y: Math.sin(angle) }); // Outer
                positions.push({ x: 0.4 * Math.cos(angle), y: 0.4 * Math.sin(angle) }); // Inner
            }
            for (let i = 0; i < 5; i++) {
                edges.push([i*2, ((i+1)%5)*2]); // Outer cycle
                edges.push([i*2, i*2 + 1]); // Spokes
                edges.push([i*2 + 1, ((i+2)%5)*2 + 1]); // Inner (k=2 jump)
            }
            break;
            
        case 'book':
            // n triangles sharing common edge
            positions.push({ x: -0.3, y: 0 }); // Spine vertex 1
            positions.push({ x: 0.3, y: 0 }); // Spine vertex 2
            for (let i = 0; i < 4; i++) {
                const y = 0.8 * (i - 1.5) / 1.5;
                positions.push({ x: 1.0, y: y });
                edges.push([0, i + 2]);
                edges.push([1, i + 2]);
            }
            edges.push([0, 1]); // Spine
            break;
            
        case 'lollipop':
            // Complete graph + path
            // K4 part
            for (let i = 0; i < 4; i++) {
                const angle = (2 * Math.PI * i) / 4 - Math.PI/2;
                positions.push({ x: -0.7 + 0.5 * Math.cos(angle), y: 0.5 * Math.sin(angle) });
            }
            for (let i = 0; i < 4; i++) {
                for (let j = i + 1; j < 4; j++) {
                    edges.push([i, j]);
                }
            }
            // Path part
            positions.push({ x: 0.3, y: 0 });
            positions.push({ x: 0.8, y: 0 });
            positions.push({ x: 1.3, y: 0 });
            edges.push([1, 4]); // Connect to clique
            edges.push([4, 5]);
            edges.push([5, 6]);
            break;
            
        case 'barbell':
            // Two cliques connected by path
            // Left K3
            for (let i = 0; i < 3; i++) {
                const angle = (2 * Math.PI * i) / 3 + Math.PI;
                positions.push({ x: -1.2 + 0.4 * Math.cos(angle), y: 0.4 * Math.sin(angle) });
            }
            edges.push([0,1], [1,2], [2,0]);
            // Right K3
            for (let i = 0; i < 3; i++) {
                const angle = (2 * Math.PI * i) / 3;
                positions.push({ x: 1.2 + 0.4 * Math.cos(angle), y: 0.4 * Math.sin(angle) });
            }
            edges.push([3,4], [4,5], [5,3]);
            // Path connecting them
            positions.push({ x: -0.5, y: 0 });
            positions.push({ x: 0, y: 0 });
            positions.push({ x: 0.5, y: 0 });
            edges.push([0, 6]); // Left clique to path
            edges.push([6, 7], [7, 8]);
            edges.push([8, 3]); // Path to right clique
            break;
            
        case 'pan':
            // Cycle with one pendant (tadpole)
            for (let i = 0; i < 5; i++) {
                const angle = (2 * Math.PI * i) / 5 - Math.PI/2;
                positions.push({ x: 0.7 * Math.cos(angle) - 0.3, y: 0.7 * Math.sin(angle) });
            }
            for (let i = 0; i < 5; i++) {
                edges.push([i, (i + 1) % 5]);
            }
            // Handle (pendant)
            positions.push({ x: 1.0, y: positions[0].y });
            edges.push([0, 5]);
            break;
            
        // Phase 2: Parameterized families
        case 'kneser':
            // K(5,2) = Petersen graph preview
            for (let i = 0; i < 5; i++) {
                const angle = (2 * Math.PI * i) / 5 - Math.PI/2;
                positions.push({ x: Math.cos(angle), y: Math.sin(angle) });
                positions.push({ x: 0.4 * Math.cos(angle), y: 0.4 * Math.sin(angle) });
            }
            for (let i = 0; i < 5; i++) {
                edges.push([i*2, ((i+1)%5)*2]); // Outer pentagon
                edges.push([i*2, i*2 + 1]); // Spokes
                edges.push([i*2 + 1, ((i+2)%5)*2 + 1]); // Inner pentagram
            }
            break;
            
        case 'rook':
            // 3x3 rook graph (K3□K3)
            for (let r = 0; r < 3; r++) {
                for (let c = 0; c < 3; c++) {
                    positions.push({ x: c - 1, y: r - 1 });
                }
            }
            // Connect all in same row and same column
            for (let r = 0; r < 3; r++) {
                for (let c = 0; c < 3; c++) {
                    const idx = r * 3 + c;
                    // Same row connections
                    if (c < 2) edges.push([idx, idx + 1]);
                    if (c < 1) edges.push([idx, idx + 2]);
                    // Same column connections
                    if (r < 2) edges.push([idx, idx + 3]);
                    if (r < 1) edges.push([idx, idx + 6]);
                }
            }
            break;
            
        case 'web':
            // Web graph: Helm with outer cycle removed
            positions.push({ x: 0, y: 0 }); // Hub
            for (let i = 0; i < 4; i++) {
                const angle = (2 * Math.PI * i) / 4 - Math.PI/2;
                positions.push({ x: 0.5 * Math.cos(angle), y: 0.5 * Math.sin(angle) }); // Inner
                positions.push({ x: Math.cos(angle), y: Math.sin(angle) }); // Outer
            }
            for (let i = 0; i < 4; i++) {
                edges.push([0, i*2 + 1]); // Hub to inner
                edges.push([i*2 + 1, i*2 + 2]); // Inner to outer
                edges.push([i*2 + 1, ((i+1)%4)*2 + 1]); // Inner cycle
            }
            break;
            
        case 'stacked-prism':
            // Stacked prism (two prisms connected)
            for (let layer = 0; layer < 2; layer++) {
                for (let i = 0; i < 4; i++) {
                    const angle = (2 * Math.PI * i) / 4 - Math.PI/2;
                    positions.push({ x: Math.cos(angle), y: 0.6 * Math.sin(angle) + layer * 0.8 - 0.4 });
                }
            }
            // Each layer is a cycle
            for (let layer = 0; layer < 2; layer++) {
                const offset = layer * 4;
                for (let i = 0; i < 4; i++) {
                    edges.push([offset + i, offset + (i + 1) % 4]);
                }
            }
            // Connect layers
            for (let i = 0; i < 4; i++) {
                edges.push([i, i + 4]);
            }
            break;
            
        // Phase 3: Famous graphs
        case 'heawood':
            // Heawood graph: 14 vertices, 3-regular, bipartite
            for (let i = 0; i < 7; i++) {
                const angle = (2 * Math.PI * i) / 7 - Math.PI/2;
                positions.push({ x: Math.cos(angle), y: Math.sin(angle) });
                positions.push({ x: 0.5 * Math.cos(angle + Math.PI/7), y: 0.5 * Math.sin(angle + Math.PI/7) });
            }
            // Outer heptagon
            for (let i = 0; i < 7; i++) {
                edges.push([i*2, ((i+1)%7)*2]);
            }
            // Spokes
            for (let i = 0; i < 7; i++) {
                edges.push([i*2, i*2 + 1]);
            }
            // Inner connections (skip 2)
            for (let i = 0; i < 7; i++) {
                edges.push([i*2 + 1, ((i+2)%7)*2 + 1]);
            }
            break;
            
        case 'pappus':
            // Pappus graph: 18 vertices, bipartite, 3-regular
            for (let i = 0; i < 6; i++) {
                const angle = (2 * Math.PI * i) / 6 - Math.PI/2;
                positions.push({ x: Math.cos(angle), y: Math.sin(angle) });
                positions.push({ x: 0.6 * Math.cos(angle + Math.PI/6), y: 0.6 * Math.sin(angle + Math.PI/6) });
                positions.push({ x: 0.3 * Math.cos(angle), y: 0.3 * Math.sin(angle) });
            }
            // Outer hexagon
            for (let i = 0; i < 6; i++) {
                edges.push([i*3, ((i+1)%6)*3]);
            }
            // Middle to outer
            for (let i = 0; i < 6; i++) {
                edges.push([i*3, i*3 + 1]);
                edges.push([i*3 + 1, ((i+1)%6)*3]);
            }
            // Inner hexagon
            for (let i = 0; i < 6; i++) {
                edges.push([i*3 + 2, ((i+2)%6)*3 + 2]);
            }
            // Middle to inner
            for (let i = 0; i < 6; i++) {
                edges.push([i*3 + 1, i*3 + 2]);
            }
            break;
            
        case 'desargues':
        case 'nauru':
            // Generalized Petersen GP(10,3) for Desargues, GP(12,5) for Nauru
            // Simplified preview: outer decagon + inner star
            {
                const gpn = template === 'nauru' ? 6 : 5;
                const gpk = template === 'nauru' ? 2 : 2;
                for (let i = 0; i < gpn; i++) {
                    const angle = (2 * Math.PI * i) / gpn - Math.PI/2;
                    positions.push({ x: Math.cos(angle), y: Math.sin(angle) });
                    positions.push({ x: 0.4 * Math.cos(angle), y: 0.4 * Math.sin(angle) });
                }
                for (let i = 0; i < gpn; i++) {
                    edges.push([i*2, ((i+1)%gpn)*2]); // Outer
                    edges.push([i*2, i*2 + 1]); // Spokes
                    edges.push([i*2 + 1, ((i+gpk)%gpn)*2 + 1]); // Inner
                }
            }
            break;
            
        case 'mobius-kantor':
            // GP(8,3): 16 vertices
            for (let i = 0; i < 8; i++) {
                const angle = (2 * Math.PI * i) / 8 - Math.PI/2;
                positions.push({ x: Math.cos(angle), y: Math.sin(angle) });
                positions.push({ x: 0.5 * Math.cos(angle), y: 0.5 * Math.sin(angle) });
            }
            for (let i = 0; i < 8; i++) {
                edges.push([i*2, ((i+1)%8)*2]); // Outer octagon
                edges.push([i*2, i*2 + 1]); // Spokes
                edges.push([i*2 + 1, ((i+3)%8)*2 + 1]); // Inner (skip 3)
            }
            break;
            
        case 'clebsch':
            // Clebsch graph: 16 vertices, 5-regular (simplified preview)
            for (let i = 0; i < 8; i++) {
                const angle = (2 * Math.PI * i) / 8 - Math.PI/2;
                positions.push({ x: Math.cos(angle), y: Math.sin(angle) });
                positions.push({ x: 0.5 * Math.cos(angle + Math.PI/8), y: 0.5 * Math.sin(angle + Math.PI/8) });
            }
            // Outer octagon
            for (let i = 0; i < 8; i++) {
                edges.push([i*2, ((i+1)%8)*2]);
                edges.push([i*2, ((i+3)%8)*2]); // Skip connections
            }
            // Cross connections to inner
            for (let i = 0; i < 8; i++) {
                edges.push([i*2, i*2 + 1]);
                edges.push([i*2, ((i+1)%8)*2 + 1]);
            }
            break;
            
        case 'shrikhande':
            // Shrikhande graph: 16 vertices, 6-regular
            for (let r = 0; r < 4; r++) {
                for (let c = 0; c < 4; c++) {
                    positions.push({ x: c - 1.5, y: r - 1.5 });
                }
            }
            // 4x4 torus with diagonals
            for (let r = 0; r < 4; r++) {
                for (let c = 0; c < 4; c++) {
                    const idx = r * 4 + c;
                    // Horizontal (with wraparound)
                    edges.push([idx, r * 4 + ((c + 1) % 4)]);
                    // Vertical (with wraparound)
                    edges.push([idx, ((r + 1) % 4) * 4 + c]);
                    // Diagonal
                    edges.push([idx, ((r + 1) % 4) * 4 + ((c + 1) % 4)]);
                }
            }
            break;
            
        case 'tutte-coxeter':
            // Tutte-Coxeter (Levi graph): 30 vertices, 3-regular, bipartite
            // Simplified: show as 3 concentric decagons
            for (let ring = 0; ring < 3; ring++) {
                const radius = 1 - ring * 0.3;
                for (let i = 0; i < 10; i++) {
                    const angle = (2 * Math.PI * i) / 10 - Math.PI/2 + ring * Math.PI/30;
                    positions.push({ x: radius * Math.cos(angle), y: radius * Math.sin(angle) });
                }
            }
            // Connect adjacent in each ring
            for (let ring = 0; ring < 3; ring++) {
                const offset = ring * 10;
                for (let i = 0; i < 10; i++) {
                    edges.push([offset + i, offset + (i + 1) % 10]);
                }
            }
            // Connect between rings
            for (let i = 0; i < 10; i++) {
                edges.push([i, 10 + i]);
                edges.push([10 + i, 20 + (i + 3) % 10]);
            }
            break;
            
        case 'franklin':
            // Franklin graph: 12 vertices, 3-regular, bipartite
            for (let i = 0; i < 6; i++) {
                const angle = (2 * Math.PI * i) / 6 - Math.PI/2;
                positions.push({ x: Math.cos(angle), y: Math.sin(angle) });
                positions.push({ x: 0.5 * Math.cos(angle + Math.PI/6), y: 0.5 * Math.sin(angle + Math.PI/6) });
            }
            // Outer hexagon
            for (let i = 0; i < 6; i++) {
                edges.push([i*2, ((i+1)%6)*2]);
            }
            // Spokes
            for (let i = 0; i < 6; i++) {
                edges.push([i*2, i*2 + 1]);
            }
            // Inner (skip 2)
            for (let i = 0; i < 6; i++) {
                edges.push([i*2 + 1, ((i+2)%6)*2 + 1]);
            }
            break;
            
        case 'mcgee':
            // McGee graph: 24 vertices, 3-regular, (3,7)-cage
            for (let i = 0; i < 8; i++) {
                const angle = (2 * Math.PI * i) / 8 - Math.PI/2;
                positions.push({ x: Math.cos(angle), y: Math.sin(angle) });
                positions.push({ x: 0.7 * Math.cos(angle + Math.PI/16), y: 0.7 * Math.sin(angle + Math.PI/16) });
                positions.push({ x: 0.4 * Math.cos(angle), y: 0.4 * Math.sin(angle) });
            }
            // Outer octagon
            for (let i = 0; i < 8; i++) {
                edges.push([i*3, ((i+1)%8)*3]);
            }
            // Middle to outer
            for (let i = 0; i < 8; i++) {
                edges.push([i*3, i*3 + 1]);
                edges.push([i*3 + 1, ((i+1)%8)*3]);
            }
            // Inner connections
            for (let i = 0; i < 8; i++) {
                edges.push([i*3 + 1, i*3 + 2]);
                edges.push([i*3 + 2, ((i+3)%8)*3 + 2]);
            }
            break;
            
        // ==================== MISSING TREE PREVIEWS ====================
        
        case 'star-path':
            // S'_p tree: center with p paths of length 2
            positions.push({ x: 0, y: 0 }); // Center
            for (let i = 0; i < 3; i++) {
                const angle = (2 * Math.PI * i) / 3 - Math.PI/2;
                positions.push({ x: 0.5 * Math.cos(angle), y: 0.5 * Math.sin(angle) }); // Level 1
                positions.push({ x: Math.cos(angle), y: Math.sin(angle) }); // Level 2
                edges.push([0, i*2 + 1]); // Center to level 1
                edges.push([i*2 + 1, i*2 + 2]); // Level 1 to level 2
            }
            break;
            
        case 'double-star':
            // S²_p tree: center with p paths of length 3
            positions.push({ x: 0, y: 0 }); // Center
            for (let i = 0; i < 3; i++) {
                const angle = (2 * Math.PI * i) / 3 - Math.PI/2;
                positions.push({ x: 0.35 * Math.cos(angle), y: 0.35 * Math.sin(angle) }); // Level 1
                positions.push({ x: 0.7 * Math.cos(angle), y: 0.7 * Math.sin(angle) }); // Level 2
                positions.push({ x: Math.cos(angle), y: Math.sin(angle) }); // Level 3
                edges.push([0, i*3 + 1]);
                edges.push([i*3 + 1, i*3 + 2]);
                edges.push([i*3 + 2, i*3 + 3]);
            }
            break;
            
        case 'general-star-tree':
            // Generic star tree - show depth 2, p=4
            positions.push({ x: 0, y: 0 }); // Center
            for (let i = 0; i < 4; i++) {
                const angle = (2 * Math.PI * i) / 4 - Math.PI/2;
                positions.push({ x: 0.5 * Math.cos(angle), y: 0.5 * Math.sin(angle) });
                positions.push({ x: Math.cos(angle), y: Math.sin(angle) });
                edges.push([0, i*2 + 1]);
                edges.push([i*2 + 1, i*2 + 2]);
            }
            break;
            
        case 'k-ary-tree':
            // k-ary tree preview (k=3, depth=2)
            positions = [
                { x: 0, y: -1 }, // Root
                { x: -1, y: 0 }, { x: 0, y: 0 }, { x: 1, y: 0 }, // Level 1
                { x: -1.3, y: 0.8 }, { x: -1, y: 0.8 }, { x: -0.7, y: 0.8 }, // Children of node 1
                { x: -0.3, y: 0.8 }, { x: 0, y: 0.8 }, { x: 0.3, y: 0.8 }, // Children of node 2
                { x: 0.7, y: 0.8 }, { x: 1, y: 0.8 }, { x: 1.3, y: 0.8 } // Children of node 3
            ];
            edges = [[0,1],[0,2],[0,3], [1,4],[1,5],[1,6], [2,7],[2,8],[2,9], [3,10],[3,11],[3,12]];
            break;
            
        case 'caterpillar':
            // Spine with legs
            for (let i = 0; i < 5; i++) {
                positions.push({ x: i - 2, y: 0 }); // Spine
                if (i > 0 && i < 4) {
                    positions.push({ x: i - 2, y: 0.7 }); // Leg up
                }
            }
            // Spine edges
            for (let i = 0; i < 4; i++) {
                edges.push([i, i + 1]);
            }
            // Leg edges
            edges.push([1, 5]); edges.push([2, 6]); edges.push([3, 7]);
            break;
            
        case 'spider':
            // Center with legs of varying length
            positions.push({ x: 0, y: 0 }); // Center
            const legLengths = [2, 3, 2, 3];
            let idx = 1;
            for (let leg = 0; leg < 4; leg++) {
                const angle = (2 * Math.PI * leg) / 4 - Math.PI/2;
                for (let j = 1; j <= legLengths[leg]; j++) {
                    const r = j * 0.4;
                    positions.push({ x: r * Math.cos(angle), y: r * Math.sin(angle) });
                    if (j === 1) {
                        edges.push([0, idx]);
                    } else {
                        edges.push([idx - 1, idx]);
                    }
                    idx++;
                }
            }
            break;
            
        case 'broom':
            // Handle + bristles
            positions = [
                { x: -1.5, y: 0 }, { x: -0.5, y: 0 }, { x: 0.5, y: 0 }, // Handle
                { x: 1.2, y: -0.5 }, { x: 1.2, y: 0 }, { x: 1.2, y: 0.5 }, { x: 1.5, y: -0.3 }, { x: 1.5, y: 0.3 } // Bristles
            ];
            edges = [[0,1], [1,2], [2,3], [2,4], [2,5], [2,6], [2,7]];
            break;
            
        // ==================== MISSING GRID/LADDER PREVIEWS ====================
        
        case 'general-ladder':
            // 3x4 ladder/truss
            for (let r = 0; r < 3; r++) {
                for (let c = 0; c < 4; c++) {
                    positions.push({ x: c - 1.5, y: r - 1 });
                }
            }
            // Horizontal and vertical edges
            for (let r = 0; r < 3; r++) {
                for (let c = 0; c < 4; c++) {
                    const i = r * 4 + c;
                    if (c < 3) edges.push([i, i + 1]);
                    if (r < 2) edges.push([i, i + 4]);
                }
            }
            // Diagonal bracing
            for (let r = 0; r < 2; r++) {
                for (let c = 0; c < 3; c++) {
                    const i = r * 4 + c;
                    edges.push([i, i + 5]); // Diagonal
                }
            }
            break;
            
        case 'torus':
            // 3x4 torus (grid with wraparound)
            for (let r = 0; r < 3; r++) {
                for (let c = 0; c < 4; c++) {
                    positions.push({ x: c - 1.5, y: r - 1 });
                }
            }
            for (let r = 0; r < 3; r++) {
                for (let c = 0; c < 4; c++) {
                    const i = r * 4 + c;
                    edges.push([i, r * 4 + (c + 1) % 4]); // Horizontal wrap
                    edges.push([i, ((r + 1) % 3) * 4 + c]); // Vertical wrap
                }
            }
            break;
            
        case 'ladder':
            // Simple ladder L_4
            for (let i = 0; i < 4; i++) {
                positions.push({ x: i - 1.5, y: -0.5 });
                positions.push({ x: i - 1.5, y: 0.5 });
            }
            for (let i = 0; i < 4; i++) {
                edges.push([i*2, i*2 + 1]); // Rungs
                if (i < 3) {
                    edges.push([i*2, i*2 + 2]); // Bottom rail
                    edges.push([i*2 + 1, i*2 + 3]); // Top rail
                }
            }
            break;
            
        case 'circular-ladder':
            // Prism - two hexagons connected
            for (let i = 0; i < 5; i++) {
                const angle = (2 * Math.PI * i) / 5 - Math.PI/2;
                positions.push({ x: 0.6 * Math.cos(angle), y: 0.6 * Math.sin(angle) }); // Inner
                positions.push({ x: Math.cos(angle), y: Math.sin(angle) }); // Outer
            }
            for (let i = 0; i < 5; i++) {
                edges.push([i*2, i*2 + 1]); // Spokes
                edges.push([i*2, ((i+1)%5)*2]); // Inner cycle
                edges.push([i*2 + 1, ((i+1)%5)*2 + 1]); // Outer cycle
            }
            break;
            
        case 'mobius-ladder':
            // Möbius ladder (twisted)
            for (let i = 0; i < 6; i++) {
                const angle = (2 * Math.PI * i) / 6 - Math.PI/2;
                positions.push({ x: Math.cos(angle), y: Math.sin(angle) });
            }
            // Cycle
            for (let i = 0; i < 6; i++) {
                edges.push([i, (i + 1) % 6]);
            }
            // Twisted rungs (connect i to i+3)
            for (let i = 0; i < 3; i++) {
                edges.push([i, i + 3]);
            }
            break;
            
        // ==================== MISSING REGULAR GRAPH PREVIEWS ====================
        
        case 'crown':
            // Crown graph: K_{n,n} minus perfect matching
            for (let i = 0; i < 4; i++) {
                positions.push({ x: i - 1.5, y: -0.6 }); // Top row
                positions.push({ x: i - 1.5, y: 0.6 }); // Bottom row
            }
            // Connect all top to all bottom EXCEPT matching pairs
            for (let i = 0; i < 4; i++) {
                for (let j = 0; j < 4; j++) {
                    if (i !== j) {
                        edges.push([i*2, j*2 + 1]);
                    }
                }
            }
            break;
            
        case 'antiprism':
            // Two pentagons with zigzag connections
            for (let i = 0; i < 5; i++) {
                const angle = (2 * Math.PI * i) / 5 - Math.PI/2;
                positions.push({ x: 0.7 * Math.cos(angle), y: 0.7 * Math.sin(angle) - 0.3 }); // Bottom
                positions.push({ x: 0.7 * Math.cos(angle + Math.PI/5), y: 0.7 * Math.sin(angle + Math.PI/5) + 0.3 }); // Top (rotated)
            }
            for (let i = 0; i < 5; i++) {
                edges.push([i*2, ((i+1)%5)*2]); // Bottom cycle
                edges.push([i*2 + 1, ((i+1)%5)*2 + 1]); // Top cycle
                edges.push([i*2, i*2 + 1]); // Zigzag
                edges.push([i*2, ((i+4)%5)*2 + 1]); // Zigzag other direction
            }
            break;
            
        case 'cocktail':
            // Cocktail party (complete minus matching)
            for (let i = 0; i < 6; i++) {
                const angle = (2 * Math.PI * i) / 6 - Math.PI/2;
                positions.push({ x: Math.cos(angle), y: Math.sin(angle) });
            }
            // Complete minus pairs (0,3), (1,4), (2,5)
            for (let i = 0; i < 6; i++) {
                for (let j = i + 1; j < 6; j++) {
                    if (Math.abs(i - j) !== 3) { // Skip antipodal pairs
                        edges.push([i, j]);
                    }
                }
            }
            break;
            
        case 'circulant':
            // C(8,{1,2}) - 4-regular circulant
            for (let i = 0; i < 8; i++) {
                const angle = (2 * Math.PI * i) / 8 - Math.PI/2;
                positions.push({ x: Math.cos(angle), y: Math.sin(angle) });
            }
            for (let i = 0; i < 8; i++) {
                edges.push([i, (i + 1) % 8]); // Skip 1
                edges.push([i, (i + 2) % 8]); // Skip 2
            }
            break;
            
        case 'hypercube':
        case 'hypercube4':
        case 'hypercube5':
            // Q3 cube for generic hypercube preview
            positions = [
                { x: -0.7, y: -0.7 }, { x: 0.7, y: -0.7 },
                { x: -0.7, y: 0.7 }, { x: 0.7, y: 0.7 },
                { x: -0.3, y: -0.3 }, { x: 1.1, y: -0.3 },
                { x: -0.3, y: 1.1 }, { x: 1.1, y: 1.1 }
            ];
            edges = [[0,1], [0,2], [1,3], [2,3], [4,5], [4,6], [5,7], [6,7], [0,4], [1,5], [2,6], [3,7]];
            break;
            
        default:
            // Default circle layout
            const n = Math.min(previewSize, 8);
            for (let i = 0; i < n; i++) {
                const angle = (2 * Math.PI * i) / n - Math.PI/2;
                positions.push({ x: Math.cos(angle), y: Math.sin(angle) });
            }
            // Just show vertices, no edges for unknown templates
            break;
    }
    
    return { positions, edges, n: positions.length };
}

// Render template preview on canvas
function renderTemplatePreview(canvas, graph) {
    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;
    
    // Clear
    ctx.fillStyle = '#0a0a1a';
    ctx.fillRect(0, 0, w, h);
    
    if (!graph.positions || graph.positions.length === 0) {
        ctx.fillStyle = '#666';
        ctx.font = '11px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('No preview', w/2, h/2);
        return;
    }
    
    // Find bounds
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const p of graph.positions) {
        minX = Math.min(minX, p.x);
        maxX = Math.max(maxX, p.x);
        minY = Math.min(minY, p.y);
        maxY = Math.max(maxY, p.y);
    }
    
    // Scale to fit with padding
    const padding = 15;
    const scaleX = (w - 2*padding) / (maxX - minX || 1);
    const scaleY = (h - 2*padding) / (maxY - minY || 1);
    const scale = Math.min(scaleX, scaleY);
    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;
    
    const toScreen = (p) => ({
        x: w/2 + (p.x - centerX) * scale,
        y: h/2 + (p.y - centerY) * scale
    });
    
    // Draw edges
    ctx.strokeStyle = '#4a9eff';
    ctx.lineWidth = 1.5;
    for (const [i, j] of graph.edges) {
        const p1 = toScreen(graph.positions[i]);
        const p2 = toScreen(graph.positions[j]);
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.stroke();
    }
    
    // Draw vertices
    ctx.fillStyle = '#4a9eff';
    for (const p of graph.positions) {
        const sp = toScreen(p);
        ctx.beginPath();
        ctx.arc(sp.x, sp.y, 4, 0, 2 * Math.PI);
        ctx.fill();
    }
}

// Update template preview panel
function updateTemplatePreview(template) {
    const panel = document.getElementById('template-preview-panel');
    const canvas = document.getElementById('template-preview-canvas');
    const nameEl = document.getElementById('preview-name');
    const statsEl = document.getElementById('preview-stats');
    const formulaEl = document.getElementById('preview-formula');
    
    if (!panel || !canvas) return;
    
    // Hide for custom
    if (template === 'custom') {
        panel.classList.add('hidden');
        return;
    }
    panel.classList.remove('hidden');
    
    // Get template info
    const info = TEMPLATE_INFO[template] || { 
        name: template, 
        nodes: 'n', 
        edges: '?', 
        formula: '—' 
    };
    
    // Update info panel
    nameEl.textContent = info.name;
    statsEl.innerHTML = `<span>V: ${info.nodes}</span><span>E: ${info.edges}</span>`;
    // Show formula with "A:" prefix to indicate it's for adjacency matrix
    formulaEl.textContent = info.formula !== '—' ? `A: ${info.formula}` : info.formula;
    formulaEl.title = 'Adjacency matrix eigenvalues (skew-symmetric differs)';
    
    // Generate and render preview
    const graph = getPreviewGraph(template);
    renderTemplatePreview(canvas, graph);
}

function applyTemplate(template) {
    if (template === 'custom') return;
    
    // Basic families that use the template-n input
    const basicFamilies = [
        'cycle', 'path', 'star', 'complete', 'wheel', 
        'prism', 'antiprism', 'crown', 'bipartite', 'cocktail', 'circulant',
        'ladder', 'mobius-ladder', 'circular-ladder',
        'helm', 'gear', 'sun', 'friendship', 'web',
        'book', 'pan', 'stacked-prism',
        'mass-chain', 'mass-star', 'mass-tree', 'mass-cantilever', 'mass-bridge', 'mass-grid'
    ];
    
    // Use template-n input for basic families, otherwise use num-vertices
    let n;
    if (basicFamilies.includes(template) && templateNInput) {
        n = parseInt(templateNInput.value);
        // Also update the main vertices input to stay in sync
        if (numVerticesInput) numVerticesInput.value = n;
    } else {
        n = parseInt(numVerticesInput.value);
    }
    
    const bidir = !skewSymmetricCheckbox.checked; // bidirectional if NOT skew-symmetric
    
    // Helper to add edges (bidirectional or unidirectional based on mode)
    const addBi = (i, j) => {
        addEdge(i, j);
        if (bidir) addEdge(j, i);
    };
    
    // Helper for complete graphs in bidirectional mode (adds all pairs)
    const addComplete = (vertices) => {
        if (bidir) {
            for (const i of vertices) {
                for (const j of vertices) {
                    if (i !== j) addEdge(i, j);
                }
            }
        } else {
            for (let idx1 = 0; idx1 < vertices.length; idx1++) {
                for (let idx2 = idx1 + 1; idx2 < vertices.length; idx2++) {
                    addEdge(vertices[idx1], vertices[idx2]);
                }
            }
        }
    };
    
    switch (template) {
        // ===== REALIZABLE SYSTEMS =====
        // These graphs are guaranteed to be realizable as mass-spring systems
        
        case 'mass-chain': {
            // Linear chain: n masses connected by n-1 springs, grounded at both ends
            // Total nodes: n masses + (n-1) internal springs + 2 ground springs = 2n+1
            // p-nodes: masses (indices 0 to n-1)
            // q-nodes: internal springs (n to 2n-2), ground springs (2n-1, 2n)
            const nMasses = n;
            const totalNodes = 2 * nMasses + 1;
            
            // Reset partition FIRST to prevent old partition from being preserved
            physicsPartition = { pIndices: [], qIndices: [] };
            
            clearGraph();
            const spacing = 15;
            
            // Initialize matrices
            state.adjacencyMatrix = Array(totalNodes).fill(null).map(() => Array(totalNodes).fill(0));
            state.symmetricAdjMatrix = Array(totalNodes).fill(null).map(() => Array(totalNodes).fill(0));
            
            // Masses in a row
            for (let i = 0; i < nMasses; i++) {
                const x = (i - (nMasses - 1) / 2) * spacing * 2;
                createVertex(new THREE.Vector3(x, 0, 0), i);
            }
            
            // Internal springs (between masses)
            for (let i = 0; i < nMasses - 1; i++) {
                const x = (i - (nMasses - 1) / 2) * spacing * 2 + spacing;
                createVertex(new THREE.Vector3(x, spacing * 0.5, 0), nMasses + i);
            }
            
            // Ground springs at ends
            createVertex(new THREE.Vector3(-(nMasses - 1) / 2 * spacing * 2 - spacing, spacing * 0.5, 0), 2 * nMasses - 1);
            createVertex(new THREE.Vector3((nMasses - 1) / 2 * spacing * 2 + spacing, spacing * 0.5, 0), 2 * nMasses);
            
            // Connect masses via internal springs
            for (let i = 0; i < nMasses - 1; i++) {
                addBi(i, nMasses + i);           // mass i to spring i
                addBi(nMasses + i, i + 1);       // spring i to mass i+1
            }
            
            // Ground springs
            addBi(2 * nMasses - 1, 0);           // left ground to first mass
            addBi(2 * nMasses, nMasses - 1);    // right ground to last mass
            
            // Set partition: masses are p-nodes, springs are q-nodes
            const pIndices = [];
            for (let i = 0; i < nMasses; i++) {
                pIndices.push(i);  // Masses
            }
            const qIndices = [];
            for (let i = 0; i < nMasses - 1; i++) {
                qIndices.push(nMasses + i);  // Internal springs
            }
            qIndices.push(2 * nMasses - 1);  // Left ground spring
            qIndices.push(2 * nMasses);      // Right ground spring
            
            if (typeof physicsPartition !== 'undefined') {
                physicsPartition.pIndices = pIndices;
                physicsPartition.qIndices = qIndices;
            }
            
            updateStats();
            console.log(`Built mass-chain: ${nMasses} masses, ${nMasses + 1} springs (2 grounded)`);
            console.log(`  p (masses): [${pIndices.join(',')}]`);
            console.log(`  q (springs): [${qIndices.join(',')}]`);
            break;
        }
        
        case 'mass-star': {
            // Star configuration: central hub connected to n outer nodes with grounded leaves
            // The structure is bipartite and realizable when properly partitioned
            // 
            // Physical interpretation (after partition swap):
            // - Node 0 = central mass
            // - Nodes 1..n = radial springs (each connects center to one outer)
            // - Nodes n+1..2n = outer nodes (act as grounded springs)
            //
            // Note: Auto-discovery may swap p/q for realizability
            const nBranches = n;
            const totalNodes = 2 * nBranches + 1;
            
            // Reset partition FIRST to prevent old partition from being preserved
            physicsPartition = { pIndices: [], qIndices: [] };
            
            clearGraph();
            const radius = 20;
            
            // Initialize matrices
            state.adjacencyMatrix = Array(totalNodes).fill(null).map(() => Array(totalNodes).fill(0));
            state.symmetricAdjMatrix = Array(totalNodes).fill(null).map(() => Array(totalNodes).fill(0));
            
            // Central node
            createVertex(new THREE.Vector3(0, 0, 0), 0);
            
            // Inner ring (connected to center)
            for (let i = 0; i < nBranches; i++) {
                const angle = (2 * Math.PI * i) / nBranches - Math.PI / 2;
                const x = Math.cos(angle) * radius;
                const y = Math.sin(angle) * radius;
                createVertex(new THREE.Vector3(x, y, 0), i + 1);
            }
            
            // Outer ring (grounded, connected to inner)
            for (let i = 0; i < nBranches; i++) {
                const angle = (2 * Math.PI * i) / nBranches - Math.PI / 2;
                const x = Math.cos(angle) * radius * 1.4;
                const y = Math.sin(angle) * radius * 1.4;
                createVertex(new THREE.Vector3(x, y, 0), nBranches + 1 + i);
            }
            
            // Connect center to inner ring
            for (let i = 0; i < nBranches; i++) {
                addBi(0, i + 1);
            }
            
            // Connect inner to outer ring
            for (let i = 0; i < nBranches; i++) {
                addBi(i + 1, nBranches + 1 + i);
            }
            
            // Partition that makes this realizable:
            // p (masses) = center (0) + outer ring (n+1 to 2n)
            // q (springs) = inner ring (1 to n)
            // This ensures each "spring" has exactly 2 connections
            const pIndices = [0];  // Center mass
            for (let i = 0; i < nBranches; i++) {
                pIndices.push(nBranches + 1 + i);  // Outer masses (act as grounded)
            }
            
            const qIndices = [];
            for (let i = 0; i < nBranches; i++) {
                qIndices.push(i + 1);  // Inner springs
            }
            
            if (typeof physicsPartition !== 'undefined') {
                physicsPartition.pIndices = pIndices;
                physicsPartition.qIndices = qIndices;
            }
            
            updateStats();
            console.log(`Built mass-star: ${nBranches} branches, ${totalNodes} nodes`);
            console.log(`  p (masses): [${pIndices.join(',')}] (center + outer)`);
            console.log(`  q (springs): [${qIndices.join(',')}] (inner ring)`);
            break;
        }
        
        case 'mass-tree': {
            // Physically realizable "star-tree" structure:
            // - Center mass connected to k outer masses via radial springs
            // - Each outer mass has a grounded leaf spring
            // - Center mass optionally has a grounded spring
            //
            // Structure for k branches:
            //        [S_center] (grounded, connected to center)
            //            |
            //          (M_0)  center mass
            //        / | | | \
            //    [S_1][S_2]...[S_k]  radial springs
            //      |    |       |
            //    (M_1)(M_2)...(M_k)  outer masses  
            //      |    |       |
            //    [Sg1][Sg2]...[Sgk]  grounded leaf springs
            //
            // Total: 1 center + k radial + k outer + k grounded + 1 center_grounded
            //      = 3k + 2 nodes
            
            const branches = Math.max(2, n);  // At least 2 branches
            const totalNodes = 3 * branches + 2;
            
            // Reset partition FIRST to prevent old partition from being preserved
            physicsPartition = { pIndices: [], qIndices: [] };
            
            clearGraph();
            
            // Initialize matrices
            state.adjacencyMatrix = Array(totalNodes).fill(null).map(() => Array(totalNodes).fill(0));
            state.symmetricAdjMatrix = Array(totalNodes).fill(null).map(() => Array(totalNodes).fill(0));
            
            // Node indices:
            // 0: center mass
            // 1 to branches: radial springs
            // branches+1 to 2*branches: outer masses
            // 2*branches+1 to 3*branches: grounded leaf springs
            // 3*branches+1: center grounded spring
            
            const centerMass = 0;
            const radialSpringBase = 1;
            const outerMassBase = branches + 1;
            const leafSpringBase = 2 * branches + 1;
            const centerGroundedSpring = 3 * branches + 1;
            
            const spacing = 30;
            const radius = spacing * 1.5;
            
            // Create center mass at origin
            createVertex(new THREE.Vector3(0, 0, 0), centerMass);
            
            // Create radial springs and outer masses in a circle
            for (let i = 0; i < branches; i++) {
                const angle = (2 * Math.PI * i) / branches - Math.PI / 2;
                const cosA = Math.cos(angle);
                const sinA = Math.sin(angle);
                
                // Radial spring (between center and outer mass)
                const radialSpring = radialSpringBase + i;
                createVertex(new THREE.Vector3(cosA * radius * 0.5, sinA * radius * 0.5, 0), radialSpring);
                
                // Outer mass
                const outerMass = outerMassBase + i;
                createVertex(new THREE.Vector3(cosA * radius, sinA * radius, 0), outerMass);
                
                // Grounded leaf spring (below outer mass)
                const leafSpring = leafSpringBase + i;
                createVertex(new THREE.Vector3(cosA * radius * 1.3, sinA * radius * 1.3, 0), leafSpring);
            }
            
            // Create center grounded spring (above center mass)
            createVertex(new THREE.Vector3(0, -spacing * 0.7, 0), centerGroundedSpring);
            
            // Connect edges:
            // 1. Center grounded spring to center mass
            addBi(centerGroundedSpring, centerMass);
            
            // 2. For each branch: center - radial spring - outer mass - leaf spring
            for (let i = 0; i < branches; i++) {
                const radialSpring = radialSpringBase + i;
                const outerMass = outerMassBase + i;
                const leafSpring = leafSpringBase + i;
                
                // Center mass connects to radial spring
                addBi(centerMass, radialSpring);
                // Radial spring connects to outer mass
                addBi(radialSpring, outerMass);
                // Outer mass connects to leaf spring (grounded)
                addBi(outerMass, leafSpring);
            }
            
            // Partition:
            // p (masses): center mass + outer masses = [0, branches+1, ..., 2*branches]
            // q (springs): radial springs + leaf springs + center grounded
            const pIndices = [centerMass];
            for (let i = 0; i < branches; i++) {
                pIndices.push(outerMassBase + i);
            }
            
            const qIndices = [];
            for (let i = 0; i < branches; i++) {
                qIndices.push(radialSpringBase + i);  // Radial springs
            }
            for (let i = 0; i < branches; i++) {
                qIndices.push(leafSpringBase + i);  // Leaf springs (grounded)
            }
            qIndices.push(centerGroundedSpring);  // Center grounded spring
            
            // Store partition
            if (typeof physicsPartition !== 'undefined') {
                physicsPartition.pIndices = pIndices;
                physicsPartition.qIndices = qIndices;
            }
            
            updateStats();
            console.log(`Built mass-tree (star): ${branches} branches, ${totalNodes} nodes`);
            console.log(`  p (masses): [${pIndices.join(',')}] (${pIndices.length} nodes)`);
            console.log(`  q (springs): [${qIndices.join(',')}] (${qIndices.length} nodes)`);
            console.log(`  Structure: center mass with ${branches} radial springs to outer masses, each with grounded leaf`);
            break;
        }
        
        case 'mass-cantilever': {
            // Cantilever beam: fixed at one end, free at other
            // n sections: n masses, n-1 connecting springs, 1 grounded spring at fixed end
            const nSections = n;
            const totalNodes = 2 * nSections;
            
            // Reset partition FIRST to prevent old partition from being preserved
            physicsPartition = { pIndices: [], qIndices: [] };
            
            clearGraph();
            const spacing = 15;
            
            // Initialize matrices
            state.adjacencyMatrix = Array(totalNodes).fill(null).map(() => Array(totalNodes).fill(0));
            state.symmetricAdjMatrix = Array(totalNodes).fill(null).map(() => Array(totalNodes).fill(0));
            
            // Masses in a row (indices 0 to nSections-1)
            for (let i = 0; i < nSections; i++) {
                createVertex(new THREE.Vector3(i * spacing * 1.5, 0, 0), i);
            }
            
            // Internal springs between masses (indices nSections to 2*nSections-2)
            for (let i = 0; i < nSections - 1; i++) {
                createVertex(new THREE.Vector3(i * spacing * 1.5 + spacing * 0.75, spacing * 0.4, 0), nSections + i);
            }
            
            // Grounded spring at fixed end (index 2*nSections-1)
            createVertex(new THREE.Vector3(-spacing * 0.75, spacing * 0.4, 0), 2 * nSections - 1);
            
            // Connect masses via springs
            for (let i = 0; i < nSections - 1; i++) {
                addBi(i, nSections + i);
                addBi(nSections + i, i + 1);
            }
            
            // Ground spring to first mass
            addBi(2 * nSections - 1, 0);
            
            // Partition: masses are p-nodes, springs are q-nodes
            const pIndices = [];
            for (let i = 0; i < nSections; i++) {
                pIndices.push(i);  // Masses
            }
            
            const qIndices = [];
            for (let i = 0; i < nSections - 1; i++) {
                qIndices.push(nSections + i);  // Internal springs
            }
            qIndices.push(2 * nSections - 1);  // Grounded spring
            
            if (typeof physicsPartition !== 'undefined') {
                physicsPartition.pIndices = pIndices;
                physicsPartition.qIndices = qIndices;
            }
            
            updateStats();
            console.log(`Built mass-cantilever: ${nSections} masses, ${nSections} springs (1 grounded)`);
            console.log(`  p (masses): [${pIndices.join(',')}]`);
            console.log(`  q (springs): [${qIndices.join(',')}]`);
            break;
        }
        
        case 'mass-bridge': {
            // Simple bridge: n masses in a row, supported at ends
            // n masses + (n-1) connecting springs + 2 support springs
            const nMasses = n;
            const totalNodes = 2 * nMasses + 1;
            
            // Reset partition FIRST to prevent old partition from being preserved
            physicsPartition = { pIndices: [], qIndices: [] };
            
            clearGraph();
            const spacing = 15;
            
            // Initialize matrices
            state.adjacencyMatrix = Array(totalNodes).fill(null).map(() => Array(totalNodes).fill(0));
            state.symmetricAdjMatrix = Array(totalNodes).fill(null).map(() => Array(totalNodes).fill(0));
            
            // Masses (indices 0 to nMasses-1)
            for (let i = 0; i < nMasses; i++) {
                createVertex(new THREE.Vector3((i - (nMasses - 1) / 2) * spacing * 2, 0, 0), i);
            }
            
            // Internal springs (indices nMasses to 2*nMasses-2)
            for (let i = 0; i < nMasses - 1; i++) {
                createVertex(new THREE.Vector3((i - (nMasses - 1) / 2) * spacing * 2 + spacing, spacing * 0.5, 0), nMasses + i);
            }
            
            // Support springs at ends (indices 2*nMasses-1, 2*nMasses)
            createVertex(new THREE.Vector3(-(nMasses - 1) / 2 * spacing * 2, -spacing, 0), 2 * nMasses - 1);
            createVertex(new THREE.Vector3((nMasses - 1) / 2 * spacing * 2, -spacing, 0), 2 * nMasses);
            
            // Connect masses via springs
            for (let i = 0; i < nMasses - 1; i++) {
                addBi(i, nMasses + i);
                addBi(nMasses + i, i + 1);
            }
            
            // Support springs (grounded)
            addBi(0, 2 * nMasses - 1);
            addBi(nMasses - 1, 2 * nMasses);
            
            // Partition: masses are p-nodes, springs are q-nodes
            const pIndices = [];
            for (let i = 0; i < nMasses; i++) {
                pIndices.push(i);
            }
            
            const qIndices = [];
            for (let i = 0; i < nMasses - 1; i++) {
                qIndices.push(nMasses + i);  // Internal springs
            }
            qIndices.push(2 * nMasses - 1);  // Left support
            qIndices.push(2 * nMasses);      // Right support
            
            if (typeof physicsPartition !== 'undefined') {
                physicsPartition.pIndices = pIndices;
                physicsPartition.qIndices = qIndices;
            }
            
            updateStats();
            console.log(`Built mass-bridge: ${nMasses} masses, ${nMasses + 1} springs (2 supports)`);
            console.log(`  p (masses): [${pIndices.join(',')}]`);
            console.log(`  q (springs): [${qIndices.join(',')}]`);
            break;
        }
        
        case 'mass-grid': {
            // m×n grid of masses with springs between adjacent masses
            const gridSize = n;
            const rows = gridSize, cols = gridSize;
            const nMasses = rows * cols;
            
            // Springs: horizontal (rows * (cols-1)) + vertical ((rows-1) * cols)
            const hSprings = rows * (cols - 1);
            const vSprings = (rows - 1) * cols;
            const totalNodes = nMasses + hSprings + vSprings;
            
            // Reset partition FIRST to prevent old partition from being preserved
            physicsPartition = { pIndices: [], qIndices: [] };
            
            clearGraph();
            const spacing = 15;
            
            // Initialize matrices
            state.adjacencyMatrix = Array(totalNodes).fill(null).map(() => Array(totalNodes).fill(0));
            state.symmetricAdjMatrix = Array(totalNodes).fill(null).map(() => Array(totalNodes).fill(0));
            
            // Create masses
            for (let r = 0; r < rows; r++) {
                for (let c = 0; c < cols; c++) {
                    const idx = r * cols + c;
                    createVertex(new THREE.Vector3(
                        (c - (cols - 1) / 2) * spacing * 2,
                        (r - (rows - 1) / 2) * spacing * 2,
                        0
                    ), idx);
                }
            }
            
            // Create horizontal springs
            let springIdx = nMasses;
            const hSpringStart = springIdx;
            for (let r = 0; r < rows; r++) {
                for (let c = 0; c < cols - 1; c++) {
                    createVertex(new THREE.Vector3(
                        (c - (cols - 1) / 2) * spacing * 2 + spacing,
                        (r - (rows - 1) / 2) * spacing * 2 + spacing * 0.3,
                        0
                    ), springIdx++);
                }
            }
            
            // Create vertical springs
            const vSpringStart = springIdx;
            for (let r = 0; r < rows - 1; r++) {
                for (let c = 0; c < cols; c++) {
                    createVertex(new THREE.Vector3(
                        (c - (cols - 1) / 2) * spacing * 2 + spacing * 0.3,
                        (r - (rows - 1) / 2) * spacing * 2 + spacing,
                        0
                    ), springIdx++);
                }
            }
            
            // Connect horizontal springs
            for (let r = 0; r < rows; r++) {
                for (let c = 0; c < cols - 1; c++) {
                    const massLeft = r * cols + c;
                    const massRight = r * cols + c + 1;
                    const spring = hSpringStart + r * (cols - 1) + c;
                    addBi(massLeft, spring);
                    addBi(spring, massRight);
                }
            }
            
            // Connect vertical springs
            for (let r = 0; r < rows - 1; r++) {
                for (let c = 0; c < cols; c++) {
                    const massTop = r * cols + c;
                    const massBottom = (r + 1) * cols + c;
                    const spring = vSpringStart + r * cols + c;
                    addBi(massTop, spring);
                    addBi(spring, massBottom);
                }
            }
            
            updateStats();
            console.log(`Built mass-grid: ${rows}×${cols} = ${nMasses} masses, ${hSprings + vSprings} springs`);
            break;
        }
        
        case 'mass-drum': {
            // Drum structure: n branches (radial spokes), m rings (circles)
            // Read from drum parameter inputs
            const branches = drumBranchesInput ? parseInt(drumBranchesInput.value) : 5;
            const rings = drumRingsInput ? parseInt(drumRingsInput.value) : 2;
            
            // Masses: center + n per ring = 1 + n*m
            const nMasses = 1 + branches * rings;
            
            // Springs: radial (n*m connecting layers) + circumferential (n*m around rings)
            const radialSprings = branches * rings;  // From center to ring1, ring1 to ring2, etc.
            const circumSprings = branches * rings;  // Around each ring
            const nSprings = radialSprings + circumSprings;
            
            const totalNodes = nMasses + nSprings;
            
            // Reset partition FIRST to prevent old partition from being preserved
            physicsPartition = { pIndices: [], qIndices: [] };
            
            clearGraph();
            const baseRadius = 20;
            const ringSpacing = 25;
            
            // Initialize matrices
            state.adjacencyMatrix = Array(totalNodes).fill(null).map(() => Array(totalNodes).fill(0));
            state.symmetricAdjMatrix = Array(totalNodes).fill(null).map(() => Array(totalNodes).fill(0));
            
            // === CREATE MASS NODES ===
            // Center mass (index 0)
            createVertex(new THREE.Vector3(0, 0, 0), 0);
            
            // Masses on each ring
            let massIdx = 1;
            const massPositions = [[0, 0]];  // Center at index 0
            for (let r = 1; r <= rings; r++) {
                const radius = baseRadius + (r - 1) * ringSpacing;
                for (let b = 0; b < branches; b++) {
                    const angle = (2 * Math.PI * b) / branches - Math.PI / 2;
                    const x = radius * Math.cos(angle);
                    const y = radius * Math.sin(angle);
                    createVertex(new THREE.Vector3(x, y, 0), massIdx);
                    massPositions.push([x, y]);
                    massIdx++;
                }
            }
            
            // === CREATE SPRING NODES ===
            // Radial springs (connecting center to ring1, ring1 to ring2, etc.)
            let springIdx = nMasses;
            const radialSpringIndices = [];  // [ring][branch] -> spring index
            
            for (let r = 0; r < rings; r++) {
                radialSpringIndices[r] = [];
                for (let b = 0; b < branches; b++) {
                    // Position spring between the two masses it connects
                    let innerMass, outerMass;
                    if (r === 0) {
                        innerMass = 0;  // Center
                        outerMass = 1 + b;  // First ring
                    } else {
                        innerMass = 1 + (r - 1) * branches + b;  // Previous ring
                        outerMass = 1 + r * branches + b;  // Current ring
                    }
                    
                    const innerPos = massPositions[innerMass];
                    const outerPos = massPositions[outerMass];
                    const midX = (innerPos[0] + outerPos[0]) / 2;
                    const midY = (innerPos[1] + outerPos[1]) / 2;
                    
                    // Offset slightly for visibility
                    const offsetAngle = (2 * Math.PI * b) / branches - Math.PI / 2 + 0.1;
                    const offsetX = midX + 2 * Math.cos(offsetAngle);
                    const offsetY = midY + 2 * Math.sin(offsetAngle);
                    
                    createVertex(new THREE.Vector3(offsetX, offsetY, 0), springIdx);
                    radialSpringIndices[r][b] = springIdx;
                    springIdx++;
                }
            }
            
            // Circumferential springs (around each ring)
            const circumSpringIndices = [];  // [ring][branch] -> spring index
            
            for (let r = 0; r < rings; r++) {
                circumSpringIndices[r] = [];
                const radius = baseRadius + r * ringSpacing;
                for (let b = 0; b < branches; b++) {
                    // Position between adjacent masses on this ring
                    const mass1 = 1 + r * branches + b;
                    const mass2 = 1 + r * branches + ((b + 1) % branches);
                    
                    const pos1 = massPositions[mass1];
                    const pos2 = massPositions[mass2];
                    const midX = (pos1[0] + pos2[0]) / 2;
                    const midY = (pos1[1] + pos2[1]) / 2;
                    
                    // Offset outward slightly
                    const dist = Math.sqrt(midX * midX + midY * midY);
                    const normX = dist > 0 ? midX / dist : 0;
                    const normY = dist > 0 ? midY / dist : 1;
                    const offsetX = midX + 3 * normX;
                    const offsetY = midY + 3 * normY;
                    
                    createVertex(new THREE.Vector3(offsetX, offsetY, 0), springIdx);
                    circumSpringIndices[r][b] = springIdx;
                    springIdx++;
                }
            }
            
            // === CONNECT EDGES ===
            // Radial connections: mass - spring - mass
            for (let r = 0; r < rings; r++) {
                for (let b = 0; b < branches; b++) {
                    let innerMass, outerMass;
                    if (r === 0) {
                        innerMass = 0;  // Center
                        outerMass = 1 + b;
                    } else {
                        innerMass = 1 + (r - 1) * branches + b;
                        outerMass = 1 + r * branches + b;
                    }
                    const spring = radialSpringIndices[r][b];
                    addBi(innerMass, spring);
                    addBi(spring, outerMass);
                }
            }
            
            // Circumferential connections: mass - spring - mass (around each ring)
            for (let r = 0; r < rings; r++) {
                for (let b = 0; b < branches; b++) {
                    const mass1 = 1 + r * branches + b;
                    const mass2 = 1 + r * branches + ((b + 1) % branches);
                    const spring = circumSpringIndices[r][b];
                    addBi(mass1, spring);
                    addBi(spring, mass2);
                }
            }
            
            updateStats();
            
            // Set partition: masses are p-nodes, springs are q-nodes
            const pIndices = [];
            for (let i = 0; i < nMasses; i++) {
                pIndices.push(i);  // All masses (center + ring masses)
            }
            
            const qIndices = [];
            for (let i = nMasses; i < totalNodes; i++) {
                qIndices.push(i);  // All springs (radial + circumferential)
            }
            
            if (typeof physicsPartition !== 'undefined') {
                physicsPartition.pIndices = pIndices;
                physicsPartition.qIndices = qIndices;
            }
            
            console.log(`Built mass-drum: ${branches} branches × ${rings} rings = ${nMasses} masses, ${nSprings} springs, ${totalNodes} total nodes`);
            console.log(`  p (masses): ${pIndices.length} nodes`);
            console.log(`  q (springs): ${qIndices.length} nodes`);
            break;
        }
        
        case 'mass-drum-constrained': {
            // Constrained Drum: like regular drum but with boundary springs extending
            // radially outward from each outer mass (grounded boundary constraints)
            const branches = drumBranchesInput ? parseInt(drumBranchesInput.value) : 5;
            const rings = drumRingsInput ? parseInt(drumRingsInput.value) : 2;
            
            // Masses: center + n per ring = 1 + n*m
            const nMasses = 1 + branches * rings;
            
            // Springs: radial + circumferential + boundary (one per outer mass)
            const radialSprings = branches * rings;
            const circumSprings = branches * rings;
            const boundarySprings = branches;  // One grounded spring per outer mass
            const nSprings = radialSprings + circumSprings + boundarySprings;
            
            const totalNodes = nMasses + nSprings;
            
            // Reset partition FIRST to prevent old partition from being preserved
            physicsPartition = { pIndices: [], qIndices: [] };
            
            clearGraph();
            const baseRadius = 20;
            const ringSpacing = 25;
            
            // Initialize matrices
            state.adjacencyMatrix = Array(totalNodes).fill(null).map(() => Array(totalNodes).fill(0));
            state.symmetricAdjMatrix = Array(totalNodes).fill(null).map(() => Array(totalNodes).fill(0));
            
            // === CREATE MASS NODES ===
            createVertex(new THREE.Vector3(0, 0, 0), 0);  // Center
            
            let massIdx = 1;
            const massPositions = [[0, 0]];
            for (let r = 1; r <= rings; r++) {
                const radius = baseRadius + (r - 1) * ringSpacing;
                for (let b = 0; b < branches; b++) {
                    const angle = (2 * Math.PI * b) / branches - Math.PI / 2;
                    const x = radius * Math.cos(angle);
                    const y = radius * Math.sin(angle);
                    createVertex(new THREE.Vector3(x, y, 0), massIdx);
                    massPositions.push([x, y]);
                    massIdx++;
                }
            }
            
            // === CREATE SPRING NODES ===
            let springIdx = nMasses;
            const radialSpringIndices = [];
            
            // Radial springs (connecting center to ring1, ring1 to ring2, etc.)
            for (let r = 0; r < rings; r++) {
                radialSpringIndices[r] = [];
                for (let b = 0; b < branches; b++) {
                    let innerMass, outerMass;
                    if (r === 0) {
                        innerMass = 0;
                        outerMass = 1 + b;
                    } else {
                        innerMass = 1 + (r - 1) * branches + b;
                        outerMass = 1 + r * branches + b;
                    }
                    
                    const innerPos = massPositions[innerMass];
                    const outerPos = massPositions[outerMass];
                    const midX = (innerPos[0] + outerPos[0]) / 2;
                    const midY = (innerPos[1] + outerPos[1]) / 2;
                    const offsetAngle = (2 * Math.PI * b) / branches - Math.PI / 2 + 0.1;
                    
                    createVertex(new THREE.Vector3(midX + 2 * Math.cos(offsetAngle), midY + 2 * Math.sin(offsetAngle), 0), springIdx);
                    radialSpringIndices[r][b] = springIdx;
                    springIdx++;
                }
            }
            
            // Circumferential springs (around each ring)
            const circumSpringIndices = [];
            for (let r = 0; r < rings; r++) {
                circumSpringIndices[r] = [];
                for (let b = 0; b < branches; b++) {
                    const mass1 = 1 + r * branches + b;
                    const mass2 = 1 + r * branches + ((b + 1) % branches);
                    
                    const pos1 = massPositions[mass1];
                    const pos2 = massPositions[mass2];
                    const midX = (pos1[0] + pos2[0]) / 2;
                    const midY = (pos1[1] + pos2[1]) / 2;
                    const dist = Math.sqrt(midX * midX + midY * midY);
                    const normX = dist > 0 ? midX / dist : 0;
                    const normY = dist > 0 ? midY / dist : 1;
                    
                    createVertex(new THREE.Vector3(midX + 3 * normX, midY + 3 * normY, 0), springIdx);
                    circumSpringIndices[r][b] = springIdx;
                    springIdx++;
                }
            }
            
            // Boundary springs (RADIAL, extending outward from each outer mass to ground)
            // These are grounded springs - only connected to one mass
            const boundarySpringIndices = [];
            const outerRadius = baseRadius + (rings - 1) * ringSpacing;
            const boundaryExtension = 15;  // How far beyond outer ring
            for (let b = 0; b < branches; b++) {
                const outerMass = 1 + (rings - 1) * branches + b;
                const massPos = massPositions[outerMass];
                
                // Position boundary spring radially outward from the outer mass
                const angle = (2 * Math.PI * b) / branches - Math.PI / 2;
                const springX = (outerRadius + boundaryExtension) * Math.cos(angle);
                const springY = (outerRadius + boundaryExtension) * Math.sin(angle);
                
                createVertex(new THREE.Vector3(springX, springY, 0), springIdx);
                boundarySpringIndices.push(springIdx);
                springIdx++;
            }
            
            // === CONNECT EDGES ===
            // Radial connections (mass → spring → mass)
            for (let r = 0; r < rings; r++) {
                for (let b = 0; b < branches; b++) {
                    let innerMass, outerMass;
                    if (r === 0) {
                        innerMass = 0;
                        outerMass = 1 + b;
                    } else {
                        innerMass = 1 + (r - 1) * branches + b;
                        outerMass = 1 + r * branches + b;
                    }
                    const spring = radialSpringIndices[r][b];
                    addBi(innerMass, spring);
                    addBi(spring, outerMass);
                }
            }
            
            // Circumferential connections (mass → spring → mass around each ring)
            for (let r = 0; r < rings; r++) {
                for (let b = 0; b < branches; b++) {
                    const mass1 = 1 + r * branches + b;
                    const mass2 = 1 + r * branches + ((b + 1) % branches);
                    const spring = circumSpringIndices[r][b];
                    addBi(mass1, spring);
                    addBi(spring, mass2);
                }
            }
            
            // Boundary constraint connections (outer mass → grounded spring)
            // Each boundary spring only connects to ONE mass (grounded at other end)
            for (let b = 0; b < branches; b++) {
                const outerMass = 1 + (rings - 1) * branches + b;
                const spring = boundarySpringIndices[b];
                addBi(outerMass, spring);
                // No second connection - this spring is grounded (like chain end springs)
            }
            
            updateStats();
            console.log(`Built mass-drum-constrained: ${branches} branches × ${rings} rings + ${boundarySprings} boundary springs (grounded) = ${totalNodes} total nodes`);
            break;
        }
        
        case 'cycle':
            generateGraph();
            for (let i = 0; i < n; i++) {
                addBi(i, (i + 1) % n);
            }
            break;
            
        case 'complete':
            generateGraph();
            if (bidir) {
                for (let i = 0; i < n; i++) {
                    for (let j = 0; j < n; j++) {
                        if (i !== j) addEdge(i, j);
                    }
                }
            } else {
                // Tournament: each pair has exactly one directed edge
                for (let i = 0; i < n; i++) {
                    for (let j = i + 1; j < n; j++) {
                        addEdge(i, j);
                    }
                }
            }
            break;
            
        case 'path':
            generateGraph();
            for (let i = 0; i < n - 1; i++) {
                addBi(i, i + 1);
            }
            break;
            
        case 'star':
            generateGraph();
            for (let i = 1; i < n; i++) {
                addBi(0, i);
            }
            break;
            
        case 'wheel':
            generateGraph();
            // Center is vertex 0, rim is 1 to n-1
            for (let i = 1; i < n; i++) {
                addBi(0, i); // Spokes
                const next = i === n - 1 ? 1 : i + 1;
                addBi(i, next); // Rim
            }
            break;
            
        case 'bipartite':
            generateGraph();
            // K_{⌊n/2⌋, ⌈n/2⌉}
            {
                const half = Math.floor(n / 2);
                for (let i = 0; i < half; i++) {
                    for (let j = half; j < n; j++) {
                        addBi(i, j);
                    }
                }
            }
            break;
            
        case 'crown':
            // Crown graph: complete bipartite minus perfect matching
            if (n < 6 || n % 2 !== 0) {
                alert('Crown graph requires even n >= 6');
                return;
            }
            generateGraph();
            {
                const k = n / 2;
                for (let i = 0; i < k; i++) {
                    for (let j = k; j < n; j++) {
                        if (j - k !== i) { // Skip the matching edge
                            addBi(i, j);
                        }
                    }
                }
            }
            break;
            
        case 'ladder':
            // Ladder: two paths connected by rungs
            if (n < 4 || n % 2 !== 0) {
                alert('Ladder requires even n >= 4');
                return;
            }
            generateGraph();
            {
                const rungs = n / 2;
                for (let i = 0; i < rungs - 1; i++) {
                    addBi(i, i + 1); // Top rail
                    addBi(i + rungs, i + rungs + 1); // Bottom rail
                }
                for (let i = 0; i < rungs; i++) {
                    addBi(i, i + rungs); // Rungs
                }
            }
            break;
            
        case 'prism':
            // Prism: two cycles connected by matching
            if (n < 6 || n % 2 !== 0) {
                alert('Prism requires even n >= 6');
                return;
            }
            {
                const sides = n / 2;
                
                // Set up 2-ring layout
                layoutTypeSelect.value = 'concentric-2';
                concentricOptions.style.display = 'block';
                if (middleRatioContainer) middleRatioContainer.style.display = 'none';
                innerRatioInput.value = 55;
                innerRatioLabel.textContent = '55%';
                splitModeSelect.value = 'custom';
                if (customSplitContainer) customSplitContainer.style.display = 'block';
                customSplitInput.value = `${sides},${sides}`;
                
                generateGraph();
                
                for (let i = 0; i < sides; i++) {
                    addBi(i, (i + 1) % sides); // Outer cycle
                    addBi(i + sides, ((i + 1) % sides) + sides); // Inner cycle
                    addBi(i, i + sides); // Spokes
                }
            }
            break;
            
        case 'cocktail':
            // Cocktail party: complete graph minus perfect matching
            if (n < 4 || n % 2 !== 0) {
                alert('Cocktail party requires even n >= 4');
                return;
            }
            generateGraph();
            if (bidir) {
                for (let i = 0; i < n; i++) {
                    for (let j = 0; j < n; j++) {
                        const pair1 = Math.floor(i / 2);
                        const pair2 = Math.floor(j / 2);
                        if (i !== j && pair1 !== pair2) {
                            addEdge(i, j);
                        }
                    }
                }
            } else {
                for (let i = 0; i < n; i++) {
                    for (let j = i + 1; j < n; j++) {
                        const pair1 = Math.floor(i / 2);
                        const pair2 = Math.floor(j / 2);
                        if (pair1 !== pair2) {
                            addEdge(i, j);
                        }
                    }
                }
            }
            break;
            
        case 'circulant':
            // Circulant C(n, {1, 2})
            generateGraph();
            for (let i = 0; i < n; i++) {
                addBi(i, (i + 1) % n);
                addBi(i, (i + 2) % n);
            }
            break;
            
        case 'petersen':
            if (n !== 10) {
                alert('Petersen graph requires exactly 10 vertices. Adjusting...');
                numVerticesInput.value = 10;
                n = 10;
            }
            // Set up 2-ring layout: 5 outer, 5 inner
            layoutTypeSelect.value = 'concentric-2';
            concentricOptions.style.display = 'block';
            if (middleRatioContainer) middleRatioContainer.style.display = 'none';
            innerRatioInput.value = 45;
            innerRatioLabel.textContent = '45%';
            splitModeSelect.value = 'custom';
            if (customSplitContainer) customSplitContainer.style.display = 'block';
            customSplitInput.value = '5,5';
            
            generateGraph();
            
            // Outer pentagon: 0-1-2-3-4-0
            for (let i = 0; i < 5; i++) {
                addBi(i, (i + 1) % 5);
            }
            // Inner pentagram: 5-7-9-6-8-5 (skip-2 pattern)
            const inner = [5, 7, 9, 6, 8];
            for (let i = 0; i < 5; i++) {
                addBi(inner[i], inner[(i + 1) % 5]);
            }
            // Spokes: 0-5, 1-6, 2-7, 3-8, 4-9
            for (let i = 0; i < 5; i++) {
                addBi(i, i + 5);
            }
            break;
            
        case 'hypercube3':
            if (n !== 8) {
                alert('Q₃ requires 8 vertices. Adjusting...');
                numVerticesInput.value = 8;
                n = 8;
            }
            generateGraph();
            // Q3: vertices are binary 000 to 111, edges differ by 1 bit
            for (let i = 0; i < 8; i++) {
                for (let b = 0; b < 3; b++) {
                    const j = i ^ (1 << b);
                    if (i < j) {
                        addBi(i, j);
                    }
                }
            }
            break;
            
        case 'hypercube4':
            if (n !== 16) {
                alert('Q₄ requires 16 vertices. Adjusting...');
                numVerticesInput.value = 16;
                n = 16;
            }
            generateGraph();
            for (let i = 0; i < 16; i++) {
                for (let b = 0; b < 4; b++) {
                    const j = i ^ (1 << b);
                    if (i < j) {
                        addBi(i, j);
                    }
                }
            }
            break;
            
        case 'octahedron':
            if (n !== 6) {
                alert('Octahedron requires 6 vertices. Adjusting...');
                numVerticesInput.value = 6;
                n = 6;
            }
            generateGraph();
            // K_{2,2,2}: complete tripartite with parts {0,1}, {2,3}, {4,5}
            {
                const octParts = [[0, 1], [2, 3], [4, 5]];
                for (let p1 = 0; p1 < 3; p1++) {
                    for (let p2 = p1 + 1; p2 < 3; p2++) {
                        for (const v1 of octParts[p1]) {
                            for (const v2 of octParts[p2]) {
                                addBi(v1, v2);
                            }
                        }
                    }
                }
            }
            break;
            
        case 'icosahedron':
            if (n !== 12) {
                alert('Icosahedron requires 12 vertices. Adjusting...');
                numVerticesInput.value = 12;
                n = 12;
            }
            generateGraph();
            // Icosahedron edges (5-regular)
            {
                const icoEdges = [
                    [0,1],[0,2],[0,3],[0,4],[0,5],
                    [1,2],[2,3],[3,4],[4,5],[5,1],
                    [1,6],[2,6],[2,7],[3,7],[3,8],[4,8],[4,9],[5,9],[5,10],[1,10],
                    [6,7],[7,8],[8,9],[9,10],[10,6],
                    [6,11],[7,11],[8,11],[9,11],[10,11]
                ];
                for (const [a, b] of icoEdges) {
                    addBi(a, b);
                }
            }
            break;
            
        case 'dodecahedron':
            if (n !== 20) {
                alert('Dodecahedron requires 20 vertices. Adjusting...');
                numVerticesInput.value = 20;
                n = 20;
            }
            // Set up 3-ring layout: 5 outer, 10 middle, 5 inner
            layoutTypeSelect.value = 'concentric-3';
            concentricOptions.style.display = 'block';
            if (middleRatioContainer) middleRatioContainer.style.display = 'block';
            innerRatioInput.value = 35;
            innerRatioLabel.textContent = '35%';
            middleRatioInput.value = 70;
            middleRatioLabel.textContent = '70%';
            splitModeSelect.value = 'custom';
            if (customSplitContainer) customSplitContainer.style.display = 'block';
            customSplitInput.value = '5,10,5';
            
            generateGraph();
            
            // Dodecahedron edges (3-regular)
            {
                const dodEdges = [
                    // Outer pentagon
                    [0,1],[1,2],[2,3],[3,4],[4,0],
                    // Outer to middle connections
                    [0,5],[0,9],
                    [1,5],[1,6],
                    [2,6],[2,7],
                    [3,7],[3,8],
                    [4,8],[4,9],
                    // Middle ring connections (zig-zag)
                    [5,10],[6,11],[7,12],[8,13],[9,14],
                    [10,11],[11,12],[12,13],[13,14],[14,10],
                    // Middle to inner connections
                    [10,15],[11,16],[12,17],[13,18],[14,19],
                    // Inner pentagon
                    [15,16],[16,17],[17,18],[18,19],[19,15]
                ];
                for (const [a, b] of dodEdges) {
                    addBi(a, b);
                }
            }
            break;
            
        case 'mobiuskantor':
            if (n !== 16) {
                alert('Möbius-Kantor requires 16 vertices. Adjusting...');
                numVerticesInput.value = 16;
                n = 16;
            }
            // Set up 2-ring layout: 8 outer, 8 inner
            layoutTypeSelect.value = 'concentric-2';
            concentricOptions.style.display = 'block';
            if (middleRatioContainer) middleRatioContainer.style.display = 'none';
            innerRatioInput.value = 50;
            innerRatioLabel.textContent = '50%';
            splitModeSelect.value = 'custom';
            if (customSplitContainer) customSplitContainer.style.display = 'block';
            customSplitInput.value = '8,8';
            
            generateGraph();
            
            // Möbius-Kantor: generalized Petersen graph GP(8,3)
            for (let i = 0; i < 8; i++) {
                addBi(i, (i + 1) % 8); // Outer octagon
                addBi(i + 8, ((i + 3) % 8) + 8); // Inner star (skip-3)
                addBi(i, i + 8); // Spokes
            }
            break;
            
        case 'friendship':
            // Friendship graph F_k: k triangles sharing a common vertex
            if (n < 3 || (n - 1) % 2 !== 0) {
                alert('Friendship graph requires n = 2k+1 vertices (odd n >= 3)');
                return;
            }
            generateGraph();
            {
                const fk = (n - 1) / 2;
                for (let t = 0; t < fk; t++) {
                    const v1 = 1 + 2 * t;
                    const v2 = 2 + 2 * t;
                    addBi(0, v1);
                    addBi(0, v2);
                    addBi(v1, v2);
                }
            }
            break;
            
        case 'multipartite':
            // Complete multipartite with roughly equal parts
            generateGraph();
            {
                const numParts = Math.min(3, Math.floor(n / 2));
                const partSize = Math.floor(n / numParts);
                const parts = [];
                let idx = 0;
                for (let p = 0; p < numParts; p++) {
                    const size = p < n % numParts ? partSize + 1 : partSize;
                    const part = [];
                    for (let i = 0; i < size; i++) {
                        part.push(idx++);
                    }
                    parts.push(part);
                }
                for (let p1 = 0; p1 < parts.length; p1++) {
                    for (let p2 = p1 + 1; p2 < parts.length; p2++) {
                        for (const v1 of parts[p1]) {
                            for (const v2 of parts[p2]) {
                                addBi(v1, v2);
                            }
                        }
                    }
                }
            }
            break;
            
        case 'paley':
            // Paley graph (Conference graph): requires n to be prime power ≡ 1 (mod 4)
            {
                const validPaley = [5, 9, 13, 17, 25, 29, 37, 41, 49, 53, 61, 73, 81, 89, 97];
                if (!validPaley.includes(n)) {
                    const nearest = validPaley.reduce((prev, curr) =>
                        Math.abs(curr - n) < Math.abs(prev - n) ? curr : prev);
                    alert(`Paley graph requires n ≡ 1 (mod 4) and prime power.\nValid sizes: 5, 9, 13, 17, 25, 29, 37, 41, 49, 53, 61, 73, 81, 89, 97\nUsing n=${nearest}`);
                    numVerticesInput.value = nearest;
                    n = nearest;
                }
                
                generateGraph();
                
                // Find quadratic residues mod n
                const quadraticResidues = new Set();
                for (let x = 1; x < n; x++) {
                    quadraticResidues.add((x * x) % n);
                }
                
                // Connect i to j if (j - i) is a quadratic residue mod n
                for (let i = 0; i < n; i++) {
                    for (let j = i + 1; j < n; j++) {
                        const diff = (j - i + n) % n;
                        if (quadraticResidues.has(diff)) {
                            addBi(i, j);
                        }
                    }
                }
            }
            break;
            
        // ==================== NEW GRAPH TYPES FROM PAPER ====================
        
        case 'binary-tree':
            // Binary tree with configurable depth
            {
                const depth = treeDepthInput ? parseInt(treeDepthInput.value) || 3 : 3;
                const totalNodes = Math.pow(2, depth + 1) - 1;
                numVerticesInput.value = totalNodes;
                n = totalNodes;
                
                generateGraph();
                
                for (let i = 0; i < Math.floor((n - 1) / 2); i++) {
                    const left = 2 * i + 1;
                    const right = 2 * i + 2;
                    if (left < n) addBi(i, left);
                    if (right < n) addBi(i, right);
                }
            }
            break;
            
        case 'k-ary-tree':
            // k-ary tree with configurable depth and branching factor
            {
                const depth = treeDepthInput ? parseInt(treeDepthInput.value) || 3 : 3;
                const k = treeKInput ? parseInt(treeKInput.value) || 3 : 3;
                
                // Calculate total nodes: sum of k^i for i=0 to depth
                let totalNodes = 0;
                for (let i = 0; i <= depth; i++) {
                    totalNodes += Math.pow(k, i);
                }
                
                numVerticesInput.value = totalNodes;
                n = totalNodes;
                
                generateGraph();
                
                // Connect each internal node to k children
                let nodeIdx = 0;
                let childIdx = 1;
                while (childIdx < n) {
                    for (let c = 0; c < k && childIdx < n; c++) {
                        addBi(nodeIdx, childIdx);
                        childIdx++;
                    }
                    nodeIdx++;
                }
            }
            break;
            
        case 'star-path':
            // S'_p tree: Central vertex with p paths of length 2 each
            // N = 2p + 1
            {
                const p = treeBranchesInput ? parseInt(treeBranchesInput.value) || 3 : 3;
                n = 2 * p + 1;
                numVerticesInput.value = n;
                
                generateGraph();
                
                // Vertex 0 is center, vertices 1..p are intermediate, p+1..2p are leaves
                for (let i = 0; i < p; i++) {
                    addBi(0, i + 1);  // center to intermediate
                    addBi(i + 1, p + 1 + i);  // intermediate to leaf
                }
            }
            break;
            
        case 'double-star':
            // S²_p tree: Central vertex with p paths of length 3 each
            // N = 3p + 1
            {
                const p = treeBranchesInput ? parseInt(treeBranchesInput.value) || 3 : 3;
                n = 3 * p + 1;
                numVerticesInput.value = n;
                
                generateGraph();
                
                // Vertex 0 is center
                // Vertices 1..p are first level
                // Vertices p+1..2p are second level  
                // Vertices 2p+1..3p are leaves
                for (let i = 0; i < p; i++) {
                    addBi(0, i + 1);  // center to level 1
                    addBi(i + 1, p + 1 + i);  // level 1 to level 2
                    addBi(p + 1 + i, 2 * p + 1 + i);  // level 2 to leaf
                }
            }
            break;
            
        case 'general-star-tree':
            // Sᵈ_p tree: Central vertex with p branches, each of depth d
            // N = d*p + 1
            // Structure: center -> level 1 (p vertices) -> level 2 (p vertices) -> ... -> level d (p leaves)
            {
                const d = treeDepthInput ? parseInt(treeDepthInput.value) || 2 : 2;  // depth (number of edges per branch)
                const p = treeBranchesInput ? parseInt(treeBranchesInput.value) || 4 : 4;  // number of branches
                n = d * p + 1;
                numVerticesInput.value = n;
                
                generateGraph();
                
                // Vertex 0 is center
                // Each branch has d vertices after center
                // Level k has p vertices: indices (k-1)*p + 1 to k*p
                for (let branch = 0; branch < p; branch++) {
                    // Connect center to first level
                    addBi(0, branch + 1);
                    
                    // Connect each level to next level
                    for (let level = 1; level < d; level++) {
                        const currentIdx = (level - 1) * p + branch + 1;
                        const nextIdx = level * p + branch + 1;
                        addBi(currentIdx, nextIdx);
                    }
                }
            }
            break;
            
        case 'caterpillar':
            // Caterpillar: path with additional leaves at each internal vertex
            if (n < 4) {
                alert('Caterpillar requires n >= 4');
                return;
            }
            generateGraph();
            {
                // Spine length is about n/2
                const spineLen = Math.max(2, Math.floor(n / 2));
                // Build spine (path)
                for (let i = 0; i < spineLen - 1; i++) {
                    addBi(i, i + 1);
                }
                // Add leaves to internal spine vertices
                let leafIdx = spineLen;
                for (let i = 1; i < spineLen - 1 && leafIdx < n; i++) {
                    addBi(i, leafIdx++);
                    if (leafIdx < n) addBi(i, leafIdx++);
                }
                // Add remaining leaves to endpoints if needed
                while (leafIdx < n) {
                    addBi(0, leafIdx++);
                    if (leafIdx < n) addBi(spineLen - 1, leafIdx++);
                }
            }
            break;
            
        case 'spider':
            // Spider: central vertex with k legs of various lengths
            generateGraph();
            {
                let legIdx = 1;
                let numLegs = Math.min(4, Math.floor(Math.sqrt(n)));
                let legLengths = [];
                
                // Distribute vertices among legs
                const remaining = n - 1;
                for (let i = 0; i < numLegs; i++) {
                    legLengths.push(Math.floor(remaining / numLegs));
                }
                for (let i = 0; i < remaining % numLegs; i++) {
                    legLengths[i]++;
                }
                
                // Build legs
                for (let leg = 0; leg < numLegs; leg++) {
                    if (legLengths[leg] > 0) {
                        addBi(0, legIdx);  // Connect to center
                        for (let j = 0; j < legLengths[leg] - 1; j++) {
                            addBi(legIdx, legIdx + 1);
                            legIdx++;
                        }
                        legIdx++;
                    }
                }
            }
            break;
            
        case 'broom':
            // Broom: star with one extended path (handle)
            if (n < 3) {
                alert('Broom requires n >= 3');
                return;
            }
            generateGraph();
            {
                const handleLen = Math.max(1, Math.floor(n / 3));  // 1/3 of vertices for handle
                // Build handle (path from 0)
                for (let i = 0; i < handleLen - 1; i++) {
                    addBi(i, i + 1);
                }
                // Bristles: connect remaining vertices to last handle vertex
                for (let i = handleLen; i < n; i++) {
                    addBi(handleLen - 1, i);
                }
            }
            break;
            
        case 'grid':
            // Grid graph m × k with configurable dimensions
            {
                const m = gridRowsInput ? parseInt(gridRowsInput.value) || 3 : 3;
                const k = gridColsInput ? parseInt(gridColsInput.value) || 4 : 4;
                n = m * k;
                numVerticesInput.value = n;
                
                generateGraph();
                
                // Connect grid edges
                for (let row = 0; row < m; row++) {
                    for (let col = 0; col < k; col++) {
                        const idx = row * k + col;
                        // Right neighbor
                        if (col < k - 1) addBi(idx, idx + 1);
                        // Down neighbor
                        if (row < m - 1) addBi(idx, idx + k);
                    }
                }
            }
            break;
            
        case 'cuboid':
            // 3D Cuboid graph m × n × k (Cartesian product P_m × P_n × P_k)
            {
                const m = cuboidMInput ? parseInt(cuboidMInput.value) || 2 : 2;
                const nDim = cuboidNInput ? parseInt(cuboidNInput.value) || 3 : 3;
                const k = cuboidKInput ? parseInt(cuboidKInput.value) || 2 : 2;
                n = m * nDim * k;
                numVerticesInput.value = n;
                
                // Clear existing graph
                clearGraph();
                
                // Initialize adjacency matrices
                state.adjacencyMatrix = Array(n).fill(null).map(() => Array(n).fill(0));
                state.symmetricAdjMatrix = Array(n).fill(null).map(() => Array(n).fill(0));
                
                // Calculate spacing based on graph size
                const radius = parseInt(radiusInput.value);
                const maxDim = Math.max(m, nDim, k);
                const spacing = (radius * 1.8) / Math.max(maxDim - 1, 1);
                
                // Center offset to center the cuboid
                const offsetX = (m - 1) * spacing / 2;
                const offsetY = (nDim - 1) * spacing / 2;
                const offsetZ = (k - 1) * spacing / 2;
                
                // Index function: (x, y, z) -> linear index
                const idx = (x, y, z) => x + y * m + z * m * nDim;
                
                // Create vertices in 3D grid positions
                for (let z = 0; z < k; z++) {
                    for (let y = 0; y < nDim; y++) {
                        for (let x = 0; x < m; x++) {
                            const pos = new THREE.Vector3(
                                x * spacing - offsetX,
                                y * spacing - offsetY,
                                z * spacing - offsetZ
                            );
                            createVertex(pos, idx(x, y, z));
                        }
                    }
                }
                
                // Connect along all three axes
                for (let z = 0; z < k; z++) {
                    for (let y = 0; y < nDim; y++) {
                        for (let x = 0; x < m; x++) {
                            const current = idx(x, y, z);
                            // X-axis neighbor
                            if (x < m - 1) addBi(current, idx(x + 1, y, z));
                            // Y-axis neighbor
                            if (y < nDim - 1) addBi(current, idx(x, y + 1, z));
                            // Z-axis neighbor
                            if (z < k - 1) addBi(current, idx(x, y, z + 1));
                        }
                    }
                }
                
                // Update phase diagram selectors and stats
                updatePhaseNodeSelectors();
                invalidateCaches();
                updateStats();
            }
            break;
            
        case 'torus':
            // Torus: grid with wraparound (both directions)
            {
                const m = gridRowsInput ? parseInt(gridRowsInput.value) || 4 : 4;
                const k = gridColsInput ? parseInt(gridColsInput.value) || 4 : 4;
                n = m * k;
                numVerticesInput.value = n;
                
                generateGraph();
                
                // Connect grid edges with wraparound
                for (let row = 0; row < m; row++) {
                    for (let col = 0; col < k; col++) {
                        const idx = row * k + col;
                        // Right neighbor (with wraparound)
                        const rightIdx = row * k + ((col + 1) % k);
                        addBi(idx, rightIdx);
                        // Down neighbor (with wraparound)
                        const downIdx = ((row + 1) % m) * k + col;
                        addBi(idx, downIdx);
                    }
                }
            }
            break;
            
        case 'general-ladder':
            // General Ladder/Truss from paper (Fig. in Table I)
            // Parallelogram-shaped truss with m rows and n columns
            // Eigenvalues: i(2cos(kπ/(n+1)) ± √(m+1)), i2cos(kπ/(n+1)) repeated (m+2) times
            {
                const m = gridRowsInput ? parseInt(gridRowsInput.value) || 2 : 2;  // rows (height)
                const cols = gridColsInput ? parseInt(gridColsInput.value) || 4 : 4;  // columns (width)
                
                // Total vertices: (m+1) rows of (cols) vertices each
                n = (m + 1) * cols;
                numVerticesInput.value = n;
                
                generateGraph();
                
                // Index helper: (row, col) -> linear index
                const idx = (row, col) => row * cols + col;
                
                // Build the truss structure
                for (let row = 0; row <= m; row++) {
                    for (let col = 0; col < cols; col++) {
                        const current = idx(row, col);
                        
                        // Horizontal edge (along the row)
                        if (col < cols - 1) {
                            addBi(current, idx(row, col + 1));
                        }
                        
                        // Vertical edge (to next row)
                        if (row < m) {
                            addBi(current, idx(row + 1, col));
                        }
                        
                        // Diagonal edge (creates the truss pattern)
                        // Alternating diagonals based on row parity
                        if (row < m && col < cols - 1) {
                            if (row % 2 === 0) {
                                // Even rows: diagonal goes down-right
                                addBi(current, idx(row + 1, col + 1));
                            } else {
                                // Odd rows: diagonal goes down-left  
                                addBi(idx(row, col + 1), idx(row + 1, col));
                            }
                        }
                    }
                }
            }
            break;
            
        case 'four-bar':
        case 'five-bar':
        case 'six-bar':
        case 'seven-bar':
        case 'n-bar-mechanism':
            // n-bar mechanism generator
            // Structure: Two parallel rails (top and bottom) with connecting cells
            // Each cell has: corner nodes, intermediate nodes on rails, and an inner diamond node
            {
                // Determine number of bars
                let m;
                if (template === 'four-bar') m = 4;
                else if (template === 'five-bar') m = 5;
                else if (template === 'six-bar') m = 6;
                else if (template === 'seven-bar') m = 7;
                else {
                    const nBarInput = document.getElementById('n-bar-m');
                    m = nBarInput ? parseInt(nBarInput.value) || 5 : 5;
                }
                
                const cells = m - 3;  // 4-bar=1 cell, 5-bar=2 cells, etc.
                n = 5 * cells + 4;
                numVerticesInput.value = n;
                
                console.log(`Generating ${m}-bar mechanism: ${cells} cells, ${n} vertices`);
                
                // Clear and setup
                clearGraph();
                const radius = parseInt(radiusInput.value);
                
                // Initialize adjacency matrices with correct size
                state.adjacencyMatrix = Array(n).fill(null).map(() => Array(n).fill(0));
                state.symmetricAdjMatrix = Array(n).fill(null).map(() => Array(n).fill(0));
                
                // Build positions array explicitly (all n positions)
                const positions = new Array(n);
                
                // Layout parameters for better proportions
                // Make the cell wider so horizontal rail edges are comparable to diagonals
                const railSep = radius * 0.25;       // Vertical half-distance between rails
                const cellWidth = radius * 0.5;      // Width of each cell (corner to corner)
                const edgeNodeOffset = railSep * 1.2; // How far left/right edge nodes extend
                
                const totalWidth = cells * cellWidth;
                const startX = -totalWidth / 2;
                
                // Node indices:
                // - Corners: indices 0 to numCorners-1
                //   - Top corners at even indices: 0, 2, 4, ...
                //   - Bottom corners at odd indices: 1, 3, 5, ...
                // - Left edge node: numCorners
                // - Right edge node: numCorners + 1
                // - Top rail intermediates: numCorners + 2 + [0..cells-1]
                // - Bottom rail intermediates: numCorners + 2 + cells + [0..cells-1]
                // - Inner diamond nodes: numCorners + 2 + 2*cells + [0..cells-1]
                
                const numCorners = 2 * (cells + 1);
                const leftEdgeIdx = numCorners;
                const rightEdgeIdx = numCorners + 1;
                const topIntBase = numCorners + 2;
                const botIntBase = topIntBase + cells;
                const innerBase = botIntBase + cells;
                
                // Set corner positions (on the outer edges of each cell)
                for (let c = 0; c <= cells; c++) {
                    const x = startX + c * cellWidth;
                    // Top corner (even index) - NEGATIVE y is UP in our coordinate system
                    positions[2 * c] = { x: x, y: -railSep, z: 0 };
                    // Bottom corner (odd index)
                    positions[2 * c + 1] = { x: x, y: railSep, z: 0 };
                }
                
                // Left edge node (to the left of first corner pair)
                positions[leftEdgeIdx] = { x: startX - edgeNodeOffset, y: 0, z: 0 };
                
                // Right edge node (to the right of last corner pair)
                positions[rightEdgeIdx] = { x: startX + cells * cellWidth + edgeNodeOffset, y: 0, z: 0 };
                
                // Top rail intermediate nodes (between corner pairs on top rail)
                for (let c = 0; c < cells; c++) {
                    const x = startX + (c + 0.5) * cellWidth;
                    positions[topIntBase + c] = { x: x, y: -railSep, z: 0 };
                }
                
                // Bottom rail intermediate nodes
                for (let c = 0; c < cells; c++) {
                    const x = startX + (c + 0.5) * cellWidth;
                    positions[botIntBase + c] = { x: x, y: railSep, z: 0 };
                }
                
                // Inner diamond nodes (in the middle of each cell, between the rails)
                for (let c = 0; c < cells; c++) {
                    const x = startX + (c + 0.5) * cellWidth;
                    positions[innerBase + c] = { x: x, y: 0, z: 0 };
                }
                
                // Verify all positions are defined
                for (let i = 0; i < n; i++) {
                    if (!positions[i]) {
                        console.error(`Position ${i} is undefined!`);
                        positions[i] = { x: 0, y: 0, z: 0 };
                    }
                }
                
                // Create all vertices
                for (let i = 0; i < n; i++) {
                    const pos = new THREE.Vector3(positions[i].x, positions[i].y, positions[i].z);
                    createVertex(pos, i);
                }
                
                console.log(`Created ${state.vertexMeshes.length} vertices`);
                
                // Build edge list with directed edges (from -> to)
                // The direction follows the flow pattern in the mechanism
                const edgeList = [];
                
                // Top rail: flows left to right
                // corner -> intermediate -> corner -> intermediate -> ...
                for (let c = 0; c < cells; c++) {
                    const topL = 2 * c;           // Left corner of cell
                    const topR = 2 * (c + 1);     // Right corner of cell
                    const topInt = topIntBase + c; // Intermediate between them
                    edgeList.push([topL, topInt]);
                    edgeList.push([topInt, topR]);
                }
                
                // Bottom rail: flows left to right
                for (let c = 0; c < cells; c++) {
                    const botL = 2 * c + 1;
                    const botR = 2 * (c + 1) + 1;
                    const botInt = botIntBase + c;
                    edgeList.push([botL, botInt]);
                    edgeList.push([botInt, botR]);
                }
                
                // Left edge: top corner -> edge node -> bottom corner
                edgeList.push([0, leftEdgeIdx]);
                edgeList.push([leftEdgeIdx, 1]);
                
                // Right edge: top corner -> edge node -> bottom corner
                edgeList.push([2 * cells, rightEdgeIdx]);
                edgeList.push([rightEdgeIdx, 2 * cells + 1]);
                
                // Inner diamonds: corners connect through center
                // Pattern: topL -> inner, inner -> topR, botL -> inner, inner -> botR
                for (let c = 0; c < cells; c++) {
                    const inner = innerBase + c;
                    const topL = 2 * c;
                    const topR = 2 * (c + 1);
                    const botL = 2 * c + 1;
                    const botR = 2 * (c + 1) + 1;
                    edgeList.push([topL, inner]);
                    edgeList.push([inner, topR]);
                    edgeList.push([botL, inner]);
                    edgeList.push([inner, botR]);
                }
                
                console.log(`Adding ${edgeList.length} directed edges, bidir=${bidir}`);
                
                // Add edges respecting the skew-symmetric setting
                // bidir is already defined at the top of applyTemplate
                for (const [from, to] of edgeList) {
                    if (from >= 0 && from < n && to >= 0 && to < n) {
                        addEdge(from, to);
                        if (bidir) {
                            addEdge(to, from);  // Only add reverse if bidirectional mode
                        }
                    } else {
                        console.error(`Invalid edge: (${from}, ${to}) for n=${n}`);
                    }
                }
                
                console.log(`Edge objects created: ${state.edgeObjects.length}`);
                
                // Update UI
                updatePhaseNodeSelectors();
                invalidateCaches();
                updateStats();
                updateAnalyzeTabIfVisible();
                return;
            }
            break;
            
        case 'one-link-pendulum':
        case 'two-link-pendulum':
        case 'three-link-pendulum':
        case 'n-link-pendulum':
            // n-link pendulum generator
            // Structure: Like n-bar mechanism but with open end (no right tip nodes)
            {
                // Determine number of links
                let links;
                if (template === 'one-link-pendulum') links = 1;
                else if (template === 'two-link-pendulum') links = 2;
                else if (template === 'three-link-pendulum') links = 3;
                else {
                    const nLinkInput = document.getElementById('n-link-num');
                    links = nLinkInput ? parseInt(nLinkInput.value) || 2 : 2;
                }
                
                const cells = links;  // n-link has n cells
                n = 5 * links + 1;
                numVerticesInput.value = n;
                
                console.log(`Generating ${links}-link pendulum: ${cells} cells, ${n} vertices`);
                
                // Clear and setup
                clearGraph();
                const radius = parseInt(radiusInput.value);
                
                // Initialize adjacency matrices
                state.adjacencyMatrix = Array(n).fill(null).map(() => Array(n).fill(0));
                state.symmetricAdjMatrix = Array(n).fill(null).map(() => Array(n).fill(0));
                
                // Layout parameters
                const railSep = radius * 0.25;
                const cellWidth = radius * 0.5;
                const edgeNodeOffset = railSep * 1.2;
                
                const totalWidth = cells * cellWidth;
                const startX = -totalWidth / 2;
                
                // Node indices:
                // - Top corners: 0, 2, 4, ..., 2*(cells-1) (cells nodes)
                // - Bottom corners: 1, 3, 5, ..., 2*cells-1 (cells nodes)
                // - Left edge node: 2*cells
                // - Top intermediates: 2*cells+1 to 3*cells
                // - Bottom intermediates: 3*cells+1 to 4*cells
                // - Inner diamonds: 4*cells+1 to 5*cells
                
                const numCorners = 2 * cells;
                const leftEdgeIdx = numCorners;
                const topIntBase = numCorners + 1;
                const botIntBase = topIntBase + cells;
                const innerBase = botIntBase + cells;
                
                const positions = new Array(n);
                
                // Top corners
                for (let c = 0; c < cells; c++) {
                    const x = startX + c * cellWidth;
                    positions[2 * c] = { x: x, y: -railSep, z: 0 };
                }
                
                // Bottom corners
                for (let c = 0; c < cells; c++) {
                    const x = startX + c * cellWidth;
                    positions[2 * c + 1] = { x: x, y: railSep, z: 0 };
                }
                
                // Left edge node
                positions[leftEdgeIdx] = { x: startX - edgeNodeOffset, y: 0, z: 0 };
                
                // Top intermediates (including tip)
                for (let c = 0; c < cells; c++) {
                    const x = startX + (c + 0.5) * cellWidth;
                    positions[topIntBase + c] = { x: x, y: -railSep, z: 0 };
                }
                
                // Bottom intermediates (including tip)
                for (let c = 0; c < cells; c++) {
                    const x = startX + (c + 0.5) * cellWidth;
                    positions[botIntBase + c] = { x: x, y: railSep, z: 0 };
                }
                
                // Inner diamonds
                for (let c = 0; c < cells; c++) {
                    const x = startX + (c + 0.5) * cellWidth;
                    positions[innerBase + c] = { x: x, y: 0, z: 0 };
                }
                
                // Create vertices
                for (let i = 0; i < n; i++) {
                    if (!positions[i]) {
                        console.error(`Position ${i} is undefined!`);
                        positions[i] = { x: 0, y: 0, z: 0 };
                    }
                    const pos = new THREE.Vector3(positions[i].x, positions[i].y, positions[i].z);
                    createVertex(pos, i);
                }
                
                // Build edge list
                const edgeList = [];
                
                // Top rail (all cells except last connect to next corner)
                for (let c = 0; c < cells - 1; c++) {
                    const topL = 2 * c;
                    const topR = 2 * (c + 1);
                    const topInt = topIntBase + c;
                    edgeList.push([topL, topInt]);
                    edgeList.push([topInt, topR]);
                }
                // Last cell top: corner to intermediate only
                if (cells >= 1) {
                    const topL = 2 * (cells - 1);
                    const topInt = topIntBase + cells - 1;
                    edgeList.push([topL, topInt]);
                }
                
                // Bottom rail
                for (let c = 0; c < cells - 1; c++) {
                    const botL = 2 * c + 1;
                    const botR = 2 * (c + 1) + 1;
                    const botInt = botIntBase + c;
                    edgeList.push([botL, botInt]);
                    edgeList.push([botInt, botR]);
                }
                if (cells >= 1) {
                    const botL = 2 * (cells - 1) + 1;
                    const botInt = botIntBase + cells - 1;
                    edgeList.push([botL, botInt]);
                }
                
                // Left edge diamond
                edgeList.push([0, leftEdgeIdx]);
                edgeList.push([leftEdgeIdx, 1]);
                
                // Inner diamonds
                for (let c = 0; c < cells - 1; c++) {
                    const inner = innerBase + c;
                    const topL = 2 * c;
                    const topR = 2 * (c + 1);
                    const botL = 2 * c + 1;
                    const botR = 2 * (c + 1) + 1;
                    edgeList.push([topL, inner]);
                    edgeList.push([inner, topR]);
                    edgeList.push([botL, inner]);
                    edgeList.push([inner, botR]);
                }
                
                // Last cell inner diamond connects to CORNERS ONLY (not tips)
                // The tips are only connected via the rail edges (corner → tip)
                if (cells >= 1) {
                    const inner = innerBase + cells - 1;
                    const topL = 2 * (cells - 1);
                    const botL = 2 * (cells - 1) + 1;
                    // Connect corners to inner diamond only
                    edgeList.push([topL, inner]);
                    edgeList.push([botL, inner]);
                    // Do NOT connect inner to tips - tips only connect via rail edges
                }
                
                console.log(`Adding ${edgeList.length} directed edges, bidir=${bidir}`);
                
                // Add edges
                for (const [from, to] of edgeList) {
                    if (from >= 0 && from < n && to >= 0 && to < n) {
                        addEdge(from, to);
                        if (bidir) {
                            addEdge(to, from);
                        }
                    } else {
                        console.error(`Invalid edge: (${from}, ${to}) for n=${n}`);
                    }
                }
                
                console.log(`Edge objects created: ${state.edgeObjects.length}`);
                
                // Update UI
                updatePhaseNodeSelectors();
                invalidateCaches();
                updateStats();
                updateAnalyzeTabIfVisible();
                return;
            }
            break;
            
        case 'hypercube':
            // Configurable hypercube with any dimension
            {
                const dim = hypercubeDimInput ? parseInt(hypercubeDimInput.value) || 3 : 3;
                n = Math.pow(2, dim);
                numVerticesInput.value = n;
                
                if (n > 64) {
                    alert(`Q${dim} has ${n} vertices. Max recommended is Q6 (64 vertices).`);
                    return;
                }
                
                generateGraph();
                
                for (let i = 0; i < n; i++) {
                    for (let b = 0; b < dim; b++) {
                        const j = i ^ (1 << b);
                        if (i < j) addBi(i, j);
                    }
                }
            }
            break;
            
        case 'circular-ladder':
            // Circular ladder (prism): two cycles connected by rungs
            if (n < 6 || n % 2 !== 0) {
                alert('Circular ladder requires even n >= 6');
                return;
            }
            {
                const rungs = n / 2;
                
                // Set up 2-ring layout
                layoutTypeSelect.value = 'concentric-2';
                concentricOptions.style.display = 'block';
                if (middleRatioContainer) middleRatioContainer.style.display = 'none';
                innerRatioInput.value = 55;
                innerRatioLabel.textContent = '55%';
                splitModeSelect.value = 'custom';
                if (customSplitContainer) customSplitContainer.style.display = 'block';
                customSplitInput.value = `${rungs},${rungs}`;
                
                generateGraph();
                
                // Outer cycle
                for (let i = 0; i < rungs; i++) {
                    addBi(i, (i + 1) % rungs);
                }
                // Inner cycle
                for (let i = 0; i < rungs; i++) {
                    addBi(rungs + i, rungs + ((i + 1) % rungs));
                }
                // Rungs
                for (let i = 0; i < rungs; i++) {
                    addBi(i, rungs + i);
                }
            }
            break;
            
        case 'mobius-ladder':
            // Möbius ladder M_n: single cycle with antipodal chords
            // Each vertex connects to its neighbor AND to the vertex n/2 positions away
            if (n < 4 || n % 2 !== 0) {
                alert('Möbius ladder requires even n >= 4');
                return;
            }
            generateGraph();
            {
                const half = n / 2;
                
                // Single cycle: 0-1-2-...(n-1)-0
                for (let i = 0; i < n; i++) {
                    addBi(i, (i + 1) % n);
                }
                
                // Antipodal chords: connect i to i + n/2
                for (let i = 0; i < half; i++) {
                    addBi(i, i + half);
                }
            }
            break;
            
        case 'antiprism':
            // Antiprism: two cycles connected in alternating pattern
            if (n < 6 || n % 2 !== 0) {
                alert('Antiprism requires even n >= 6');
                return;
            }
            {
                const sides = n / 2;
                
                layoutTypeSelect.value = 'concentric-2';
                concentricOptions.style.display = 'block';
                if (middleRatioContainer) middleRatioContainer.style.display = 'none';
                innerRatioInput.value = 50;
                innerRatioLabel.textContent = '50%';
                splitModeSelect.value = 'custom';
                if (customSplitContainer) customSplitContainer.style.display = 'block';
                customSplitInput.value = `${sides},${sides}`;
                
                generateGraph();
                
                // Top polygon
                for (let i = 0; i < sides; i++) {
                    addBi(i, (i + 1) % sides);
                }
                // Bottom polygon
                for (let i = 0; i < sides; i++) {
                    addBi(sides + i, sides + ((i + 1) % sides));
                }
                // Alternating connections (each top vertex connects to two bottom)
                for (let i = 0; i < sides; i++) {
                    addBi(i, sides + i);
                    addBi(i, sides + ((i + 1) % sides));
                }
            }
            break;
            
        case 'hypercube2':
            // Q2: 4 vertices (square)
            if (n !== 4) {
                alert('Q₂ requires 4 vertices. Adjusting...');
                numVerticesInput.value = 4;
                n = 4;
            }
            generateGraph();
            for (let i = 0; i < 4; i++) {
                for (let b = 0; b < 2; b++) {
                    const j = i ^ (1 << b);
                    if (i < j) addBi(i, j);
                }
            }
            break;
            
        case 'hypercube5':
            // Q5: 32 vertices
            if (n !== 32) {
                alert('Q₅ requires 32 vertices. Adjusting...');
                numVerticesInput.value = 32;
                n = 32;
            }
            generateGraph();
            for (let i = 0; i < 32; i++) {
                for (let b = 0; b < 5; b++) {
                    const j = i ^ (1 << b);
                    if (i < j) addBi(i, j);
                }
            }
            break;
            
        case 'cuboctahedron':
            // Cuboctahedron: 12 vertices, 4-regular
            if (n !== 12) {
                alert('Cuboctahedron requires 12 vertices. Adjusting...');
                numVerticesInput.value = 12;
                n = 12;
            }
            generateGraph();
            {
                const cuboEdges = [
                    [0,1],[0,2],[0,3],[0,4],
                    [1,2],[1,5],[1,6],
                    [2,3],[2,7],
                    [3,4],[3,8],
                    [4,5],[4,9],
                    [5,6],[5,9],
                    [6,7],[6,10],
                    [7,8],[7,10],
                    [8,9],[8,11],
                    [9,11],
                    [10,11]
                ];
                for (const [a, b] of cuboEdges) {
                    addBi(a, b);
                }
            }
            break;
            
        // ==================== NEW PRIORITY 1 TEMPLATES ====================
        
        case 'helm':
            // Helm graph H_n: Wheel W_n with pendant vertex on each rim vertex
            // Vertices: center (0), rim (1 to n), pendants (n+1 to 2n)
            {
                if (n < 7 || (n - 1) % 2 !== 0) {
                    const newN = Math.max(7, n % 2 === 0 ? n + 1 : n);
                    numVerticesInput.value = newN;
                    n = newN;
                }
                const rimSize = (n - 1) / 2;
                generateGraph();
                
                // Wheel edges (center to rim, and rim cycle)
                for (let i = 1; i <= rimSize; i++) {
                    addBi(0, i); // Hub to rim
                    addBi(i, (i % rimSize) + 1); // Rim cycle
                }
                // Pendant edges
                for (let i = 1; i <= rimSize; i++) {
                    addBi(i, rimSize + i); // Rim to pendant
                }
            }
            break;
            
        case 'gear':
            // Gear graph G_n: Wheel with extra vertex between each pair of adjacent rim vertices
            // Vertices: center (0), main rim (1 to n), gear teeth (n+1 to 2n)
            {
                if (n < 7 || (n - 1) % 2 !== 0) {
                    const newN = Math.max(7, n % 2 === 0 ? n + 1 : n);
                    numVerticesInput.value = newN;
                    n = newN;
                }
                const rimSize = (n - 1) / 2;
                generateGraph();
                
                // Hub to main rim
                for (let i = 1; i <= rimSize; i++) {
                    addBi(0, i);
                }
                // Main rim to gear teeth, teeth connect adjacent main rim vertices
                for (let i = 1; i <= rimSize; i++) {
                    const tooth = rimSize + i;
                    addBi(i, tooth);
                    addBi(tooth, (i % rimSize) + 1);
                }
            }
            break;
            
        case 'sun':
            // Sun/Sunlet graph: Cycle C_n with pendant at each vertex
            // Vertices: cycle (0 to n/2-1), pendants (n/2 to n-1)
            {
                if (n < 4 || n % 2 !== 0) {
                    const newN = Math.max(4, n % 2 === 0 ? n : n + 1);
                    numVerticesInput.value = newN;
                    n = newN;
                }
                const cycleSize = n / 2;
                generateGraph();
                
                // Cycle edges
                for (let i = 0; i < cycleSize; i++) {
                    addBi(i, (i + 1) % cycleSize);
                }
                // Pendant edges
                for (let i = 0; i < cycleSize; i++) {
                    addBi(i, cycleSize + i);
                }
            }
            break;
            
        case 'gen-petersen':
            // Generalized Petersen graph GP(n, k)
            // Vertices: outer cycle (0 to gpN-1), inner star (gpN to 2*gpN-1)
            {
                const gpN = gpNInput ? parseInt(gpNInput.value) || 5 : 5;
                const gpK = gpKInput ? Math.min(parseInt(gpKInput.value) || 2, Math.floor(gpN/2)) : 2;
                n = 2 * gpN;
                numVerticesInput.value = n;
                
                // Set up concentric layout
                layoutTypeSelect.value = 'concentric-2';
                concentricOptions.style.display = 'block';
                innerRatioInput.value = 50;
                innerRatioLabel.textContent = '50%';
                splitModeSelect.value = 'custom';
                if (customSplitContainer) customSplitContainer.style.display = 'block';
                customSplitInput.value = `${gpN},${gpN}`;
                
                generateGraph();
                
                // Outer cycle
                for (let i = 0; i < gpN; i++) {
                    addBi(i, (i + 1) % gpN);
                }
                // Inner star (k-step connections)
                for (let i = 0; i < gpN; i++) {
                    addBi(gpN + i, gpN + ((i + gpK) % gpN));
                }
                // Spokes (outer to inner)
                for (let i = 0; i < gpN; i++) {
                    addBi(i, gpN + i);
                }
            }
            break;
            
        case 'book':
            // Book graph B_n: n triangles sharing a common edge (spine)
            // Vertices: spine (0, 1), pages (2 to n+1)
            {
                const pages = Math.max(2, n - 2);
                n = pages + 2;
                numVerticesInput.value = n;
                generateGraph();
                
                // Spine edge
                addBi(0, 1);
                // Page edges (triangles)
                for (let i = 2; i < n; i++) {
                    addBi(0, i);
                    addBi(1, i);
                }
            }
            break;
            
        case 'lollipop':
            // Lollipop graph L_{m,k}: Complete graph K_m connected to path P_k
            {
                const m = lollipopMInput ? parseInt(lollipopMInput.value) || 4 : 4;
                const pathLen = lollipopNInput ? parseInt(lollipopNInput.value) || 3 : 3;
                n = m + pathLen;
                numVerticesInput.value = n;
                generateGraph();
                
                // Complete graph K_m (vertices 0 to m-1)
                for (let i = 0; i < m; i++) {
                    for (let j = i + 1; j < m; j++) {
                        addBi(i, j);
                    }
                }
                // Path P_k (vertices m to n-1), connected to clique at vertex 0
                if (pathLen > 0) {
                    addBi(0, m); // Connect clique to path
                    for (let i = m; i < n - 1; i++) {
                        addBi(i, i + 1);
                    }
                }
            }
            break;
            
        case 'barbell':
            // Barbell graph: Two complete graphs K_m connected by a path
            {
                const m = lollipopMInput ? parseInt(lollipopMInput.value) || 4 : 4;
                const pathLen = lollipopNInput ? Math.max(1, parseInt(lollipopNInput.value) || 2) : 2;
                n = 2 * m + pathLen;
                numVerticesInput.value = n;
                generateGraph();
                
                // Left clique K_m (vertices 0 to m-1)
                for (let i = 0; i < m; i++) {
                    for (let j = i + 1; j < m; j++) {
                        addBi(i, j);
                    }
                }
                // Right clique K_m (vertices m+pathLen to 2m+pathLen-1)
                const rightStart = m + pathLen;
                for (let i = rightStart; i < n; i++) {
                    for (let j = i + 1; j < n; j++) {
                        addBi(i, j);
                    }
                }
                // Path connecting the cliques (vertices m to m+pathLen-1)
                addBi(0, m); // Left clique to path start
                for (let i = m; i < m + pathLen - 1; i++) {
                    addBi(i, i + 1);
                }
                addBi(m + pathLen - 1, rightStart); // Path end to right clique
            }
            break;
            
        case 'pan':
            // Pan/Tadpole graph: Cycle C_n with one pendant edge (handle)
            {
                if (n < 4) {
                    n = 4;
                    numVerticesInput.value = n;
                }
                const cycleSize = n - 1;
                generateGraph();
                
                // Cycle edges
                for (let i = 0; i < cycleSize; i++) {
                    addBi(i, (i + 1) % cycleSize);
                }
                // Handle (pendant)
                addBi(0, cycleSize);
            }
            break;
            
        // ==================== PHASE 2: PARAMETERIZED FAMILIES ====================
        
        case 'kneser':
            // Kneser graph K(n,k): vertices are k-subsets of {1,...,n}
            // Two vertices connected if subsets are disjoint
            // K(5,2) = Petersen graph
            {
                const kn = kneserNInput ? parseInt(kneserNInput.value) || 5 : 5;
                const kk = kneserKInput ? Math.min(parseInt(kneserKInput.value) || 2, Math.floor(kn/2)) : 2;
                
                // Generate all k-subsets of {0, 1, ..., n-1}
                function* combinations(arr, k) {
                    if (k === 0) { yield []; return; }
                    if (arr.length < k) return;
                    const [first, ...rest] = arr;
                    for (const combo of combinations(rest, k - 1)) {
                        yield [first, ...combo];
                    }
                    yield* combinations(rest, k);
                }
                
                const elements = Array.from({length: kn}, (_, i) => i);
                const subsets = [...combinations(elements, kk)];
                n = subsets.length;
                numVerticesInput.value = n;
                
                if (n > 50) {
                    alert(`K(${kn},${kk}) has ${n} vertices. Consider smaller parameters.`);
                    return;
                }
                
                generateGraph();
                
                // Connect disjoint subsets
                for (let i = 0; i < subsets.length; i++) {
                    for (let j = i + 1; j < subsets.length; j++) {
                        const setI = new Set(subsets[i]);
                        const disjoint = subsets[j].every(x => !setI.has(x));
                        if (disjoint) {
                            addBi(i, j);
                        }
                    }
                }
            }
            break;
            
        case 'rook':
            // Rook graph: Cartesian product K_m □ K_n
            // Vertices on m×n chessboard, connected if same row or column
            {
                const rm = rookMInput ? parseInt(rookMInput.value) || 3 : 3;
                const rn = rookNInput ? parseInt(rookNInput.value) || 3 : 3;
                n = rm * rn;
                numVerticesInput.value = n;
                
                generateGraph();
                
                // Connect vertices in same row or same column
                for (let r1 = 0; r1 < rm; r1++) {
                    for (let c1 = 0; c1 < rn; c1++) {
                        const idx1 = r1 * rn + c1;
                        // Same row connections
                        for (let c2 = c1 + 1; c2 < rn; c2++) {
                            addBi(idx1, r1 * rn + c2);
                        }
                        // Same column connections
                        for (let r2 = r1 + 1; r2 < rm; r2++) {
                            addBi(idx1, r2 * rn + c1);
                        }
                    }
                }
            }
            break;
            
        case 'web':
            // Web graph: Helm graph with outer cycle removed
            // Hub + inner cycle + outer pendants (but no outer cycle)
            {
                if (n < 7 || (n - 1) % 2 !== 0) {
                    const newN = Math.max(7, n % 2 === 0 ? n + 1 : n);
                    numVerticesInput.value = newN;
                    n = newN;
                }
                const spokes = (n - 1) / 2;
                generateGraph();
                
                // Hub to inner ring
                for (let i = 1; i <= spokes; i++) {
                    addBi(0, i);
                }
                // Inner ring cycle
                for (let i = 1; i <= spokes; i++) {
                    addBi(i, (i % spokes) + 1);
                }
                // Inner to outer (pendants)
                for (let i = 1; i <= spokes; i++) {
                    addBi(i, spokes + i);
                }
            }
            break;
            
        case 'stacked-prism':
            // Stacked prism Y_n: Two prism graphs stacked
            // Essentially C_n × P_3 (cycle × path of 3)
            {
                if (n < 6 || n % 3 !== 0) {
                    const newN = Math.max(6, Math.ceil(n / 3) * 3);
                    numVerticesInput.value = newN;
                    n = newN;
                }
                const cycleSize = n / 3;
                generateGraph();
                
                // Three layers of cycles
                for (let layer = 0; layer < 3; layer++) {
                    const offset = layer * cycleSize;
                    for (let i = 0; i < cycleSize; i++) {
                        addBi(offset + i, offset + (i + 1) % cycleSize);
                    }
                }
                // Connect adjacent layers
                for (let layer = 0; layer < 2; layer++) {
                    for (let i = 0; i < cycleSize; i++) {
                        addBi(layer * cycleSize + i, (layer + 1) * cycleSize + i);
                    }
                }
            }
            break;
            
        // ==================== PHASE 3: FAMOUS GRAPHS ====================
        
        case 'heawood':
            // Heawood graph: 14 vertices, 3-regular, girth 6
            // Incidence graph of Fano plane, also GP(7,2)
            if (n !== 14) {
                numVerticesInput.value = 14;
                n = 14;
            }
            layoutTypeSelect.value = 'concentric-2';
            concentricOptions.style.display = 'block';
            innerRatioInput.value = 50;
            splitModeSelect.value = 'custom';
            if (customSplitContainer) customSplitContainer.style.display = 'block';
            customSplitInput.value = '7,7';
            
            generateGraph();
            
            // GP(7,2): outer heptagon, inner heptagram (skip 2), spokes
            for (let i = 0; i < 7; i++) {
                addBi(i, (i + 1) % 7); // Outer heptagon
                addBi(i + 7, ((i + 2) % 7) + 7); // Inner (skip 2)
                addBi(i, i + 7); // Spokes
            }
            break;
            
        case 'pappus':
            // Pappus graph: 18 vertices, 3-regular, bipartite
            if (n !== 18) {
                numVerticesInput.value = 18;
                n = 18;
            }
            generateGraph();
            {
                // Pappus configuration edges
                const pappusEdges = [
                    [0,1],[1,2],[2,3],[3,4],[4,5],[5,0], // Outer hexagon
                    [0,6],[1,7],[2,8],[3,9],[4,10],[5,11], // Spokes to middle
                    [6,7],[7,8],[8,9],[9,10],[10,11],[11,6], // Middle hexagon
                    [6,12],[7,13],[8,14],[9,15],[10,16],[11,17], // Spokes to inner
                    [12,14],[14,16],[16,12],[13,15],[15,17],[17,13] // Inner triangles
                ];
                for (const [a, b] of pappusEdges) {
                    addBi(a, b);
                }
            }
            break;
            
        case 'desargues':
            // Desargues graph: GP(10,3), 20 vertices, 3-regular
            if (n !== 20) {
                numVerticesInput.value = 20;
                n = 20;
            }
            layoutTypeSelect.value = 'concentric-2';
            concentricOptions.style.display = 'block';
            innerRatioInput.value = 50;
            splitModeSelect.value = 'custom';
            if (customSplitContainer) customSplitContainer.style.display = 'block';
            customSplitInput.value = '10,10';
            
            generateGraph();
            
            for (let i = 0; i < 10; i++) {
                addBi(i, (i + 1) % 10); // Outer decagon
                addBi(i + 10, ((i + 3) % 10) + 10); // Inner (skip 3)
                addBi(i, i + 10); // Spokes
            }
            break;
            
        case 'mobius-kantor':
            // Already implemented earlier as GP(8,3)
            // Redirect to ensure it works
            if (n !== 16) {
                numVerticesInput.value = 16;
                n = 16;
            }
            layoutTypeSelect.value = 'concentric-2';
            concentricOptions.style.display = 'block';
            innerRatioInput.value = 50;
            splitModeSelect.value = 'custom';
            if (customSplitContainer) customSplitContainer.style.display = 'block';
            customSplitInput.value = '8,8';
            
            generateGraph();
            
            for (let i = 0; i < 8; i++) {
                addBi(i, (i + 1) % 8); // Outer octagon
                addBi(i + 8, ((i + 3) % 8) + 8); // Inner (skip 3)
                addBi(i, i + 8); // Spokes
            }
            break;
            
        case 'clebsch':
            // Clebsch graph: 16 vertices, 5-regular
            // Complement of folded 5-cube
            if (n !== 16) {
                numVerticesInput.value = 16;
                n = 16;
            }
            generateGraph();
            {
                // Clebsch graph edges (from known adjacency)
                // Vertices 0-15, connect if Hamming distance is 1 or 4 in folded 5-cube
                for (let i = 0; i < 16; i++) {
                    for (let j = i + 1; j < 16; j++) {
                        // XOR and count bits
                        let xor = i ^ j;
                        let bits = 0;
                        while (xor) { bits += xor & 1; xor >>= 1; }
                        // In Clebsch: connect if bits is 1 or 4
                        // Actually: vertices are adjacent if they differ in exactly 1 bit
                        // OR sum to 15 (complement) and differ in exactly 1 bit there
                        const comp = (i ^ 15) ^ j;
                        let compBits = 0;
                        let tmp = comp;
                        while (tmp) { compBits += tmp & 1; tmp >>= 1; }
                        if (bits === 1 || (bits === 4)) {
                            addBi(i, j);
                        }
                    }
                }
            }
            break;
            
        case 'shrikhande':
            // Shrikhande graph: 16 vertices, 6-regular
            // 4×4 torus with additional diagonal connections
            if (n !== 16) {
                numVerticesInput.value = 16;
                n = 16;
            }
            generateGraph();
            {
                // Position (r,c) → vertex r*4 + c
                const idx = (r, c) => ((r % 4 + 4) % 4) * 4 + ((c % 4 + 4) % 4);
                
                for (let r = 0; r < 4; r++) {
                    for (let c = 0; c < 4; c++) {
                        const v = idx(r, c);
                        // Horizontal neighbors (torus)
                        addBi(v, idx(r, c + 1));
                        // Vertical neighbors (torus)
                        addBi(v, idx(r + 1, c));
                        // Diagonal (down-right)
                        addBi(v, idx(r + 1, c + 1));
                    }
                }
            }
            break;
            
        case 'tutte-coxeter':
            // Tutte-Coxeter graph (Levi graph): 30 vertices, 3-regular
            // Incidence graph of generalized quadrangle GQ(2,2)
            if (n !== 30) {
                numVerticesInput.value = 30;
                n = 30;
            }
            generateGraph();
            {
                // Known edge list for Tutte-Coxeter
                const tcEdges = [];
                // Outer ring of 10
                for (let i = 0; i < 10; i++) {
                    tcEdges.push([i, (i + 1) % 10]);
                }
                // Middle ring of 10
                for (let i = 10; i < 20; i++) {
                    tcEdges.push([i, 10 + ((i - 10 + 1) % 10)]);
                }
                // Inner ring of 10
                for (let i = 20; i < 30; i++) {
                    tcEdges.push([i, 20 + ((i - 20 + 1) % 10)]);
                }
                // Connections between rings
                for (let i = 0; i < 10; i++) {
                    tcEdges.push([i, 10 + i]); // Outer to middle
                    tcEdges.push([10 + i, 20 + ((i + 3) % 10)]); // Middle to inner (offset)
                }
                for (const [a, b] of tcEdges) {
                    addBi(a, b);
                }
            }
            break;
            
        case 'franklin':
            // Franklin graph: 12 vertices, 3-regular, bipartite
            // GP(6,2)
            if (n !== 12) {
                numVerticesInput.value = 12;
                n = 12;
            }
            layoutTypeSelect.value = 'concentric-2';
            concentricOptions.style.display = 'block';
            innerRatioInput.value = 50;
            splitModeSelect.value = 'custom';
            if (customSplitContainer) customSplitContainer.style.display = 'block';
            customSplitInput.value = '6,6';
            
            generateGraph();
            
            for (let i = 0; i < 6; i++) {
                addBi(i, (i + 1) % 6); // Outer hexagon
                addBi(i + 6, ((i + 2) % 6) + 6); // Inner (skip 2)
                addBi(i, i + 6); // Spokes
            }
            break;
            
        case 'mcgee':
            // McGee graph: 24 vertices, 3-regular, (3,7)-cage
            if (n !== 24) {
                numVerticesInput.value = 24;
                n = 24;
            }
            generateGraph();
            {
                // McGee graph from LCF notation [12,7,-7]^8
                const mcgeeEdges = [];
                // Outer cycle of 24
                for (let i = 0; i < 24; i++) {
                    mcgeeEdges.push([i, (i + 1) % 24]);
                }
                // LCF chords: pattern [12, 7, -7] repeated 8 times
                const lcf = [12, 7, -7];
                for (let i = 0; i < 24; i++) {
                    const jump = lcf[i % 3];
                    const target = (i + jump + 24) % 24;
                    if (i < target) { // Avoid duplicates
                        mcgeeEdges.push([i, target]);
                    }
                }
                for (const [a, b] of mcgeeEdges) {
                    addBi(a, b);
                }
            }
            break;
            
        case 'nauru':
            // Nauru graph: GP(12,5), 24 vertices, 3-regular
            if (n !== 24) {
                numVerticesInput.value = 24;
                n = 24;
            }
            layoutTypeSelect.value = 'concentric-2';
            concentricOptions.style.display = 'block';
            innerRatioInput.value = 50;
            splitModeSelect.value = 'custom';
            if (customSplitContainer) customSplitContainer.style.display = 'block';
            customSplitInput.value = '12,12';
            
            generateGraph();
            
            for (let i = 0; i < 12; i++) {
                addBi(i, (i + 1) % 12); // Outer dodecagon
                addBi(i + 12, ((i + 5) % 12) + 12); // Inner (skip 5)
                addBi(i, i + 12); // Spokes
            }
            break;
            
        default:
            generateGraph();
    }
    
    updateStats();
}

// =====================================================
// EDIT MODE
// =====================================================

// Dragging state
let isDraggingVertex = false;
let draggedVertex = null;
let dragPlane = null;

function updateMode() {
    const addMode = addModeCheckbox && addModeCheckbox.checked;
    const deleteMode = deleteModeCheckbox && deleteModeCheckbox.checked;
    const dragMode = dragModeCheckbox && dragModeCheckbox.checked;
    const addVertexMode = currentEditMode === 'add-vertex';
    const deleteVertexMode = currentEditMode === 'delete-vertex';
    
    if (addMode) {
        modeIndicator.textContent = 'ADD EDGES MODE';
        modeIndicator.className = 'mode-indicator mode-add';
        container.className = 'edit-mode';
        controls.enabled = false;
    } else if (deleteMode) {
        modeIndicator.textContent = 'DELETE EDGES MODE';
        modeIndicator.className = 'mode-indicator mode-delete';
        container.className = 'delete-mode';
        controls.enabled = false;
    } else if (dragMode) {
        modeIndicator.textContent = 'DRAG VERTICES MODE (click and drag nodes)';
        modeIndicator.className = 'mode-indicator mode-drag';
        container.className = 'drag-mode';
        controls.enabled = false;
    } else if (addVertexMode) {
        modeIndicator.textContent = 'ADD VERTEX MODE (click empty space)';
        modeIndicator.className = 'mode-indicator mode-add';
        container.className = 'edit-mode';
        controls.enabled = false;
    } else if (deleteVertexMode) {
        modeIndicator.textContent = 'DELETE VERTEX MODE (click vertex to remove)';
        modeIndicator.className = 'mode-indicator mode-delete';
        container.className = 'delete-mode';
        controls.enabled = false;
    } else {
        modeIndicator.textContent = 'VIEW MODE (drag to rotate)';
        modeIndicator.className = 'mode-indicator mode-view';
        container.className = '';
        controls.enabled = true;
    }
}

function onMouseMove(event) {
    const addMode = addModeCheckbox && addModeCheckbox.checked;
    const deleteMode = deleteModeCheckbox && deleteModeCheckbox.checked;
    const dragMode = dragModeCheckbox && dragModeCheckbox.checked;
    const addVertexMode = currentEditMode === 'add-vertex';
    const deleteVertexMode = currentEditMode === 'delete-vertex';
    
    // Handle vertex dragging
    if (dragMode && isDraggingVertex && draggedVertex) {
        event.preventDefault();
        
        // Get mouse position in normalized device coordinates
        const rect = container.getBoundingClientRect();
        const mouseX = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        const mouseY = -((event.clientY - rect.top) / rect.height) * 2 + 1;
        
        // Create a ray from camera through mouse position
        const raycaster = new THREE.Raycaster();
        raycaster.setFromCamera({ x: mouseX, y: mouseY }, camera);
        
        // Intersect with drag plane (plane perpendicular to camera through vertex)
        if (dragPlane) {
            const intersection = new THREE.Vector3();
            raycaster.ray.intersectPlane(dragPlane, intersection);
            if (intersection) {
                draggedVertex.position.copy(intersection);
                updateAllEdges();
                updateVertexLabels();
            }
        }
        return;
    }
    
    if (!addMode && !deleteMode && !dragMode && !addVertexMode && !deleteVertexMode) return;
    
    const vertex = getIntersectedVertex(event);
    
    // Reset previous hover
    if (state.hoveredVertex && state.hoveredVertex !== state.selectedVertex) {
        setVertexMaterial(state.hoveredVertex, 'default');
    }
    
    // Set new hover and cursor
    if (vertex && vertex !== state.selectedVertex) {
        setVertexMaterial(vertex, 'hover');
        state.hoveredVertex = vertex;
        if (dragMode) {
            container.style.cursor = 'grab';
        } else if (deleteVertexMode) {
            container.style.cursor = 'not-allowed';
        } else {
            container.style.cursor = 'pointer';
        }
    } else {
        state.hoveredVertex = null;
        if (dragMode) {
            container.style.cursor = 'default';
        } else if (addVertexMode) {
            container.style.cursor = 'cell';
        } else {
            container.style.cursor = 'crosshair';
        }
    }
}

function onMouseDown(event) {
    const dragMode = dragModeCheckbox && dragModeCheckbox.checked;
    if (!dragMode) return;
    
    const vertex = getIntersectedVertex(event);
    if (vertex) {
        isDraggingVertex = true;
        draggedVertex = vertex;
        setVertexMaterial(vertex, 'selected');
        container.style.cursor = 'grabbing';
        
        // Create a plane perpendicular to camera, passing through the vertex
        const cameraDirection = new THREE.Vector3();
        camera.getWorldDirection(cameraDirection);
        dragPlane = new THREE.Plane();
        dragPlane.setFromNormalAndCoplanarPoint(cameraDirection, vertex.position);
    }
}

function onMouseUp(event) {
    if (isDraggingVertex && draggedVertex) {
        setVertexMaterial(draggedVertex, 'default');
        isDraggingVertex = false;
        draggedVertex = null;
        dragPlane = null;
        container.style.cursor = 'default';
        invalidateCaches(); // Reset dynamics caches after moving vertices
    }
}

function onMouseClick(event) {
    // Only handle clicks inside the 3D container
    if (!container.contains(event.target)) {
        return;
    }
    
    // SHIFT+CLICK: Pin/Unpin node for force layout (works in any mode)
    if (event.shiftKey) {
        const vertex = getIntersectedVertex(event);
        if (vertex) {
            const idx = vertex.userData.index;
            const nowPinned = togglePinNode(idx);
            
            // Update status display
            const pinnedCount = getPinnedNodeCount();
            if (pinnedCount > 0) {
                console.log(`[Pin] ${pinnedCount} node(s) pinned`);
            }
            
            // Visual feedback - don't override partition colors
            if (!vertex.userData.partitionColor) {
                if (nowPinned) {
                    setVertexMaterial(vertex, 'pinned');
                } else {
                    setVertexMaterial(vertex, 'default');
                }
            }
            
            // Update pin count display
            updatePinCountDisplay();
            
            return;  // Don't process other click actions
        }
    }
    
    const addMode = addModeCheckbox && addModeCheckbox.checked;
    const deleteMode = deleteModeCheckbox && deleteModeCheckbox.checked;
    const addVertexMode = currentEditMode === 'add-vertex';
    const deleteVertexMode = currentEditMode === 'delete-vertex';
    const dragMode = dragModeCheckbox && dragModeCheckbox.checked;
    
    // In VIEW mode, allow tap/click to select vertex for info display
    const isViewMode = !addMode && !deleteMode && !addVertexMode && !deleteVertexMode && !dragMode;
    
    if (isViewMode) {
        // Allow selecting vertices in view mode (for info purposes)
        const vertex = getIntersectedVertex(event);
        if (vertex) {
            // Deselect previous
            if (state.selectedVertex && state.selectedVertex !== vertex) {
                setVertexMaterial(state.selectedVertex, 'default');
            }
            // Select new vertex
            state.selectedVertex = vertex;
            setVertexMaterial(vertex, 'selected');
            
            // Show vertex info
            const idx = vertex.userData.index;
            const pos = vertex.position;
            console.log(`Selected vertex ${idx} at (${pos.x.toFixed(2)}, ${pos.y.toFixed(2)}, ${pos.z.toFixed(2)})`);
        } else if (state.selectedVertex) {
            // Clicked empty space - deselect
            setVertexMaterial(state.selectedVertex, 'default');
            state.selectedVertex = null;
        }
        return;
    }
    
    if (addMode) {
        const vertex = getIntersectedVertex(event);
        if (vertex) {
            if (state.selectedVertex === null) {
                // First vertex selected
                state.selectedVertex = vertex;
                setVertexMaterial(vertex, 'selected');
            } else if (vertex !== state.selectedVertex) {
                // Second vertex - create edge
                addEdge(state.selectedVertex.userData.index, vertex.userData.index);
                setVertexMaterial(state.selectedVertex, 'default');
                state.selectedVertex = null;
                updateStats();
                onGraphChanged();
            }
        } else if (state.selectedVertex) {
            // Clicked empty space - deselect
            setVertexMaterial(state.selectedVertex, 'default');
            state.selectedVertex = null;
        }
    } else if (deleteMode) {
        const edge = getIntersectedEdge(event);
        if (edge) {
            // Remove edge
            state.graphGroup.remove(edge.arrow);
            state.edgeObjects.splice(state.edgeObjects.indexOf(edge), 1);
            state.adjacencyMatrix[edge.from][edge.to] = 0;
            state.adjacencyMatrix[edge.to][edge.from] = 0;
            
            // Update symmetric matrix only if no reverse edge exists
            if (!state.edgeObjects.some(e => e.from === edge.to && e.to === edge.from)) {
                state.symmetricAdjMatrix[edge.from][edge.to] = 0;
                state.symmetricAdjMatrix[edge.to][edge.from] = 0;
            }
            
            updateStats();
            onGraphChanged();
        }
    } else if (addVertexMode) {
        // Add vertex: click empty space to place a new vertex
        const vertex = getIntersectedVertex(event);
        if (!vertex) {
            const rect = container.getBoundingClientRect();
            const mouse = new THREE.Vector2(
                ((event.clientX - rect.left) / rect.width) * 2 - 1,
                -((event.clientY - rect.top) / rect.height) * 2 + 1
            );
            
            const raycaster = new THREE.Raycaster();
            raycaster.setFromCamera(mouse, camera);
            
            // Determine which plane to intersect based on current projection/grid plane
            const gridPlane = getCurrentGridPlane();
            let plane;
            
            switch (gridPlane) {
                case 'xy': // Front view - Z = 0 plane
                    plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
                    break;
                case 'yz': // Side view - X = 0 plane
                    plane = new THREE.Plane(new THREE.Vector3(1, 0, 0), 0);
                    break;
                case 'xz': // Top view - Y = 0 plane (default)
                default:
                    plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
                    break;
            }
            
            const intersectPoint = new THREE.Vector3();
            const intersected = raycaster.ray.intersectPlane(plane, intersectPoint);
            
            if (intersected) {
                // Apply snap-to-grid based on current plane
                const snapped = snapToGrid(intersectPoint.x, intersectPoint.y, intersectPoint.z);
                addNewVertex(snapped.x, snapped.y, snapped.z);
                if (numVerticesInput) numVerticesInput.value = state.vertexMeshes.length;
                updateStats();
                invalidateCaches();
                console.log(`[ADD VERTEX] Placed at (${snapped.x.toFixed(1)}, ${snapped.y.toFixed(1)}, ${snapped.z.toFixed(1)}) on ${gridPlane} plane`);
            }
        }
    } else if (deleteVertexMode) {
        // Delete vertex: click on a vertex to remove it
        const vertex = getIntersectedVertex(event);
        if (vertex) {
            const index = vertex.userData.index;
            removeVertex(index);
            if (numVerticesInput) numVerticesInput.value = state.vertexMeshes.length;
            updateStats();
            invalidateCaches();
        }
    }
}

// =====================================================
// GRAPH FINDER FUNCTIONS
// =====================================================

async function findAllAnalyticGraphs() {
    // Use the finder's own vertices input, NOT the general BUILD tab input
    const n = parseInt(finderVerticesInput?.value) || 5;
    const connectedOnly = finderConnectedOnlyCheckbox ? finderConnectedOnlyCheckbox.checked : true;
    
    if (n > 7) {
        const totalGraphs = Math.pow(2, n*(n-1)/2);
        // For n=8, there are about 11.1M connected graphs vs 268M total
        const connectedEstimate = n === 8 ? '~11 million' : 'many millions of';
        
        let msg = `Finding graphs for n=${n} involves checking ${totalGraphs.toLocaleString()} edge combinations.\n\n`;
        
        if (connectedOnly) {
            msg += `With "Connected only" enabled, disconnected graphs will be skipped.\n`;
            msg += `(For n=8, there are ${connectedEstimate} connected graphs)\n\n`;
        } else {
            msg += `Consider enabling "Connected only" for faster results.\n\n`;
        }
        
        msg += `⚠️ MEMORY WARNING: This search may use 10+ GB of RAM.\n`;
        msg += `Close other applications before continuing.\n\n`;
        msg += `The search can be cancelled at any time.\n\nContinue?`;
        
        if (!confirm(msg)) {
            return;
        }
    }
    
    // Show progress UI and cancel button
    finderProgress.style.display = 'block';
    finderResults.style.display = 'none';
    finderProgressBar.style.width = '0%';
    findAnalyticBtn.disabled = true;
    findAnalyticBtn.textContent = 'Searching...';
    
    if (cancelSearchBtn) {
        cancelSearchBtn.style.display = 'inline-block';
        cancelSearchBtn.disabled = false;
        cancelSearchBtn.textContent = 'Cancel';
    }
    
    try {
        const results = await findAnalyticGraphs(n, { connectedOnly }, (progress) => {
            finderStatus.textContent = progress.message;
            if (progress.progress !== undefined) {
                finderProgressBar.style.width = (progress.progress * 100) + '%';
            }
        });
        
        // Store results
        discoveredGraphs = results.graphs;
        
        // Update UI
        finderProgress.style.display = 'none';
        finderResults.style.display = 'block';
        
        let summaryText;
        if (results.cancelled) {
            summaryText = `Cancelled. Found ${results.analyticCount} analytic graphs before stopping.`;
        } else {
            const filterNote = connectedOnly ? ' connected' : '';
            summaryText = `Found ${results.analyticCount} of ${results.totalUnique}${filterNote} graphs with closed-form eigenvalues (${results.elapsed.toFixed(1)}s)`;
            
            // Add optimization stats if available
            if (results.stats) {
                const s = results.stats;
                
                // Show skipped disconnected
                if (s.skippedDisconnected > 0) {
                    summaryText += `\n📊 Skipped ${s.skippedDisconnected.toLocaleString()} disconnected graphs`;
                }
                
                // Show instant resolutions
                const optimized = s.resolvedByProduct + s.resolvedByDisconnected + s.resolvedByPolyCache;
                if (optimized > 0) {
                    summaryText += `\n⚡ ${optimized} resolved via cache`;
                    if (s.resolvedByProduct > 0) summaryText += ` (${s.resolvedByProduct} products)`;
                    if (s.resolvedByPolyCache > 0) summaryText += ` (${s.resolvedByPolyCache} poly cache)`;
                    if (s.resolvedByDisconnected > 0) summaryText += ` (${s.resolvedByDisconnected} components)`;
                }
            }
        }
        finderSummary.textContent = summaryText;
        finderSummary.style.whiteSpace = 'pre-line';  // Allow line breaks
        
        // Populate dropdown
        analyticGraphSelect.innerHTML = '<option value="">-- Select a graph --</option>';
        results.graphs.forEach((g, i) => {
            const edgeStr = g.edgeCount === 0 ? 'no edges' : `${g.edgeCount} edge${g.edgeCount > 1 ? 's' : ''}`;
            const name = g.family || `Graph with ${edgeStr}`;
            const option = document.createElement('option');
            option.value = i;
            option.textContent = `[${i + 1}] ${name}`;
            analyticGraphSelect.appendChild(option);
        });
        
        selectedGraphInfo.style.display = 'none';
        
    } catch (error) {
        console.error('Graph finder error:', error);
        finderStatus.textContent = 'Error: ' + error.message;
    } finally {
        findAnalyticBtn.disabled = false;
        findAnalyticBtn.textContent = 'Find All Analytic Graphs';
        if (cancelSearchBtn) {
            cancelSearchBtn.style.display = 'none';
        }
    }
}

function showSelectedGraphInfo() {
    const idx = analyticGraphSelect.value;
    
    if (idx === '' || discoveredGraphs.length === 0) {
        selectedGraphInfo.style.display = 'none';
        return;
    }
    
    const graph = discoveredGraphs[parseInt(idx)];
    if (!graph) {
        selectedGraphInfo.style.display = 'none';
        return;
    }
    
    // Display family/name
    graphFamilyDisplay.textContent = graph.family || `Graph on ${graph.n} vertices`;
    
    // Display edges
    if (!graph.edges || graph.edges.length === 0) {
        graphEdgesDisplay.textContent = 'Edges: ∅ (no edges)';
    } else {
        const edgeStr = graph.edges.map(([i, j]) => `${i}-${j}`).join(', ');
        graphEdgesDisplay.textContent = `Edges: ${edgeStr}`;
    }
    
    // Display eigenvalues (stored as 'eigenvalues', not 'symmetricEigenvalues')
    const eigenvalues = graph.eigenvalues || graph.symmetricEigenvalues;
    if (eigenvalues && eigenvalues.length > 0) {
        const eigStr = eigenvalues.map(e => {
            if (typeof e === 'object' && e.form) {
                const mult = e.multiplicity > 1 ? ` (×${e.multiplicity})` : '';
                return e.form + mult;
            } else if (typeof e === 'object' && e.value !== undefined) {
                const mult = e.multiplicity > 1 ? ` (×${e.multiplicity})` : '';
                return e.value.toFixed(4) + mult;
            } else {
                return String(e);
            }
        }).join(', ');
        graphEigenvaluesDisplay.textContent = `λ: ${eigStr}`;
    } else {
        graphEigenvaluesDisplay.textContent = 'λ: (not computed)';
    }
    
    selectedGraphInfo.style.display = 'block';
}

function loadSelectedAnalyticGraph() {
    const idx = analyticGraphSelect.value;
    console.log('loadSelectedAnalyticGraph: idx =', idx, 'discoveredGraphs.length =', discoveredGraphs.length);
    
    if (idx === '' || discoveredGraphs.length === 0) {
        alert('Please select a graph first');
        return;
    }
    
    const graphIndex = parseInt(idx);
    const graph = discoveredGraphs[graphIndex];
    console.log('loadSelectedAnalyticGraph: graphIndex =', graphIndex, 'graph =', graph);
    
    if (!graph) {
        alert('Graph not found at index ' + graphIndex);
        return;
    }
    
    // Get layout type from UI
    const layoutType = finderLayoutSelect ? finderLayoutSelect.value : 'circle';
    console.log('loadSelectedAnalyticGraph: layoutType =', layoutType);
    
    // Load the graph into visualization
    const result = loadGraphFromResult(graph, layoutType);
    console.log('loadSelectedAnalyticGraph: loadGraphFromResult returned', result);
    
    if (!result) {
        alert('Failed to load graph - check console for details');
        return;
    }
    
    // Update UI
    if (numVerticesInput) {
        numVerticesInput.value = graph.n;
        console.log('loadSelectedAnalyticGraph: Set numVerticesInput to', graph.n);
    }
    if (templateSelect) templateSelect.value = 'custom';
    updateStats();
    updatePhaseNodeSelectors();
    invalidateCaches();  // Reset dynamics caches for new graph
    onGraphChanged();
    
    // Optionally show analysis
    setTimeout(() => showAnalysis(), 100);
    
    console.log('loadSelectedAnalyticGraph: Complete');
}

// =====================================================
// ENHANCED VISUALIZATION POPUP
// =====================================================

function setupEnhancedVizPopup() {
    if (!enhancedVizPopup) return;
    
    // Set up dynamics callback for real-time updates
    setDynamicsUpdateCallback(updateEnhancedVisualizations);
    
    // Open popup button
    if (openEnhancedVizBtn) {
        openEnhancedVizBtn.addEventListener('click', () => {
            enhancedVizPopup.style.display = 'block';
            enhancedVizActive = true;
            timeSeriesHistory = [];
            timeSeriesTimeStamps = [];
            enhancedPhaseTrail = []; // Clear phase trail when opening
            initialEnergy = null; // Reset energy tracking
            
            // Ensure spectrum is computed for frequency display
            ensureSpectrumComputed();
            
            updateEnhancedVisualizations();
        });
    }
    
    // Close button
    if (popupCloseBtn) {
        popupCloseBtn.addEventListener('click', () => {
            enhancedVizPopup.style.display = 'none';
            enhancedVizActive = false;
            timeSeriesHistory = [];
            timeSeriesTimeStamps = [];
            enhancedPhaseTrail = []; // Clear phase trail when closing
            initialEnergy = null;
        });
    }
    
    // Minimize button
    if (popupMinimizeBtn) {
        popupMinimizeBtn.addEventListener('click', () => {
            enhancedVizPopup.classList.toggle('minimized');
            popupMinimizeBtn.textContent = enhancedVizPopup.classList.contains('minimized') ? '+' : '−';
        });
    }
    
    // Maximize button
    if (popupMaximizeBtn) {
        popupMaximizeBtn.addEventListener('click', () => {
            enhancedVizPopup.classList.toggle('maximized');
            popupMaximizeBtn.textContent = enhancedVizPopup.classList.contains('maximized') ? '❐' : '□';
        });
    }
    
    // Zoom slider
    if (vizZoom) {
        vizZoom.addEventListener('input', () => {
            if (vizZoomLabel) vizZoomLabel.textContent = vizZoom.value + '%';
            updateEnhancedVisualizations();
        });
    }
    
    // Checkbox controls
    [vizShowBounds, vizShowEigenvectors, vizShowGrid].forEach(checkbox => {
        if (checkbox) {
            checkbox.addEventListener('change', updateEnhancedVisualizations);
        }
    });
    
    // Make popup draggable
    makePopupDraggable();
}

function makePopupDraggable() {
    if (!enhancedVizPopup) return;
    
    const header = enhancedVizPopup.querySelector('.popup-header');
    if (!header) return;
    
    let isDragging = false;
    let offsetX = 0, offsetY = 0;
    
    header.addEventListener('mousedown', (e) => {
        if (e.target.classList.contains('popup-btn')) return;
        isDragging = true;
        offsetX = e.clientX - enhancedVizPopup.offsetLeft;
        offsetY = e.clientY - enhancedVizPopup.offsetTop;
        enhancedVizPopup.style.transform = 'none';
    });
    
    document.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        enhancedVizPopup.style.left = (e.clientX - offsetX) + 'px';
        enhancedVizPopup.style.top = (e.clientY - offsetY) + 'px';
    });
    
    document.addEventListener('mouseup', () => {
        isDragging = false;
    });
}

// Ensure spectrum is computed for visualization
function ensureSpectrumComputed() {
    if (!currentSpectrum || !currentSpectrum.eigenvalues || currentSpectrum.eigenvalues.length === 0) {
        // Compute numerical spectrum from the graph
        const topology = detectPointGraphTopology();
        if (topology && topology.N >= 2) {
            if (topology.type === 'general' || topology.type === 'tree') {
                currentSpectrum = computeNumericalSpectrum(1.0, 1.0);
            } else {
                currentSpectrum = computeSpectrum(topology, 1.0, 1.0);
            }
        }
    }
}

// Update all enhanced visualizations (called from dynamics loop)
export function updateEnhancedVisualizations() {
    if (!enhancedVizActive || !enhancedVizPopup || enhancedVizPopup.style.display === 'none') return;
    
    try {
        // Ensure spectrum data is available
        ensureSpectrumComputed();
        
        // Update the enhanced phase trail from current dynamics state
        updateEnhancedPhaseTrail();
        
        drawEnhancedPhaseCurrent();
        drawEnhancedPhaseMain();
        drawFrequencySpectrum();
        drawTimeSeries();
        updateEnergyDisplay();
    } catch (e) {
        console.warn('Enhanced visualization error:', e);
    }
}

// Compute and store phase values for the Enhanced Visualization (independent of regular phase plot)
function updateEnhancedPhaseTrail() {
    const dynamicsState = getDynamicsState();
    if (!dynamicsState || dynamicsState.nodeStates.length < 2) return;
    if (!dynamicsState.nodeDerivatives || dynamicsState.nodeDerivatives.length === 0) return;
    
    const nodeStates = dynamicsState.nodeStates;
    const nodeDerivatives = dynamicsState.nodeDerivatives;
    
    // Get selected nodes and mode
    const nodeI = phaseNodeISelect ? parseInt(phaseNodeISelect.value) : 0;
    const nodeJ = phaseNodeJSelect ? parseInt(phaseNodeJSelect.value) : 1;
    const mode = phaseModeSelect ? phaseModeSelect.value : 'displacement';
    
    if (nodeI >= nodeStates.length || nodeJ >= nodeStates.length) return;
    
    const xi = nodeStates[nodeI];
    const xj = nodeStates[nodeJ];
    const dxi = nodeDerivatives[nodeI];
    const dxj = nodeDerivatives[nodeJ];
    
    // Get symmetric adjacency matrix entry for edge power calculation
    // Use symmetricAdjMatrix (1 if connected, 0 if not) rather than adjacencyMatrix (which has +1/-1 for direction)
    const symA = state.symmetricAdjMatrix;
    const A_ij = (symA && symA[nodeI] && symA[nodeI][nodeJ] !== undefined) ? symA[nodeI][nodeJ] : 0;
    
    let plotX, plotY;
    
    switch (mode) {
        case 'displacement':
            plotX = xi;
            plotY = xj;
            break;
        case 'velocity':
            plotX = xi;
            plotY = dxj;
            break;
        case 'node-power':
            plotX = xi;
            plotY = xi * dxi;
            break;
        case 'power-power':
            plotX = xi * dxi;
            plotY = xj * dxj;
            break;
        case 'edge-power':
            // True edge power: P_ij = A_ij · x_i · x_j (using symmetric adjacency)
            plotX = xi;
            plotY = A_ij * xi * xj;
            break;
        default:
            plotX = xi;
            plotY = xj;
    }
    
    enhancedPhaseTrail.push({ x: plotX, y: plotY, time: dynamicsState.simulationTime });
    
    // Limit trail length
    if (enhancedPhaseTrail.length > ENHANCED_PHASE_TRAIL_LENGTH) {
        enhancedPhaseTrail.shift();
    }
}

function drawEnhancedPhaseCurrent() {
    if (!enhancedPhaseCurrentCanvas) return;
    
    const canvas = enhancedPhaseCurrentCanvas;
    const ctx = canvas.getContext('2d');
    const W = canvas.width;
    const H = canvas.height;
    const cx = W / 2;
    const cy = H / 2;
    
    // Clear
    ctx.fillStyle = '#0a0a1a';
    ctx.fillRect(0, 0, W, H);
    
    // Get dynamics state
    const dynamicsState = getDynamicsState();
    if (!dynamicsState || dynamicsState.nodeStates.length < 2) {
        ctx.fillStyle = '#666';
        ctx.font = '12px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('Start dynamics to see phase plot', cx, cy);
        return;
    }
    
    // Get selected nodes and plot mode
    const nodeI = phaseNodeISelect ? parseInt(phaseNodeISelect.value) : 0;
    const nodeJ = phaseNodeJSelect ? parseInt(phaseNodeJSelect.value) : 1;
    const plotMode = phaseModeSelect ? phaseModeSelect.value : 'displacement';
    
    // Determine axis labels based on plot mode (matching actual HTML option values)
    let xAxisLabel, yAxisLabel;
    switch(plotMode) {
        case 'displacement':
            xAxisLabel = `x${nodeI}`;
            yAxisLabel = `x${nodeJ}`;
            break;
        case 'velocity':
            xAxisLabel = `x${nodeI}`;
            yAxisLabel = `ẋ${nodeJ}`;
            break;
        case 'node-power':
            xAxisLabel = `x${nodeI}`;
            yAxisLabel = `x${nodeI}·ẋ${nodeI}`;
            break;
        case 'power-power':
            xAxisLabel = `P${nodeI}`;
            yAxisLabel = `P${nodeJ}`;
            break;
        case 'edge-power':
            xAxisLabel = `x${nodeI}`;
            yAxisLabel = `P${nodeI}${nodeJ}`;
            break;
        default:
            xAxisLabel = `x${nodeI}`;
            yAxisLabel = `x${nodeJ}`;
            break;
    }
    
    const zoom = vizZoom ? parseInt(vizZoom.value) / 100 : 1.0;
    const scale = 50 * zoom;
    
    // Draw grid if enabled
    if (vizShowGrid && vizShowGrid.checked) {
        ctx.strokeStyle = '#1a1a3a';
        ctx.lineWidth = 0.5;
        for (let x = 0; x <= W; x += 40) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, H);
            ctx.stroke();
        }
        for (let y = 0; y <= H; y += 40) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(W, y);
            ctx.stroke();
        }
    }
    
    // Draw axes
    ctx.strokeStyle = '#333355';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, cy);
    ctx.lineTo(W, cy);
    ctx.moveTo(cx, 0);
    ctx.lineTo(cx, H);
    ctx.stroke();
    
    // Draw phase trail - use our own enhanced trail, not the one from dynamics state
    const trail = enhancedPhaseTrail;
    if (trail.length > 1) {
        ctx.strokeStyle = '#00ffff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        for (let i = 0; i < trail.length; i++) {
            const x = cx + trail[i].x * scale;
            const y = cy - trail[i].y * scale;
            if (i === 0) {
                ctx.moveTo(x, y);
            } else {
                ctx.lineTo(x, y);
            }
        }
        ctx.stroke();
        
        // Current point
        const last = trail[trail.length - 1];
        const px = cx + last.x * scale;
        const py = cy - last.y * scale;
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(px, py, 4, 0, 2 * Math.PI);
        ctx.fill();
    }
    
    // Axis labels with actual node numbers
    ctx.fillStyle = '#4a9eff';
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(xAxisLabel, W - 5, cy - 5);
    ctx.textAlign = 'left';
    ctx.fillText(yAxisLabel, cx + 5, 12);
}

function drawEnhancedPhaseMain() {
    if (!enhancedPhaseMainCanvas) return;
    
    const canvas = enhancedPhaseMainCanvas;
    const ctx = canvas.getContext('2d');
    const W = canvas.width;
    const H = canvas.height;
    const cx = W / 2;
    const cy = H / 2;
    
    // Clear
    ctx.fillStyle = '#0a0a1a';
    ctx.fillRect(0, 0, W, H);
    
    const dynamicsState = getDynamicsState();
    const zoom = vizZoom ? parseInt(vizZoom.value) / 100 : 1.0;
    const scale = 50 * zoom;
    
    // Get selected nodes and plot mode
    const nodeI = phaseNodeISelect ? parseInt(phaseNodeISelect.value) : 0;
    const nodeJ = phaseNodeJSelect ? parseInt(phaseNodeJSelect.value) : 1;
    const plotMode = phaseModeSelect ? phaseModeSelect.value : 'displacement';
    
    // Determine axis labels based on plot mode (matching actual HTML option values)
    let xAxisLabel, yAxisLabel, plotTitle;
    switch(plotMode) {
        case 'displacement':
            xAxisLabel = `x${nodeI}`;
            yAxisLabel = `x${nodeJ}`;
            plotTitle = `Displacement: node ${nodeI} vs node ${nodeJ}`;
            break;
        case 'velocity':
            xAxisLabel = `x${nodeI}`;
            yAxisLabel = `ẋ${nodeJ}`;
            plotTitle = `Node ${nodeI} displacement vs node ${nodeJ} velocity`;
            break;
        case 'node-power':
            xAxisLabel = `x${nodeI}`;
            yAxisLabel = `x${nodeI}·ẋ${nodeI}`;
            plotTitle = `Node ${nodeI}: displacement vs power`;
            break;
        case 'power-power':
            xAxisLabel = `P${nodeI}`;
            yAxisLabel = `P${nodeJ}`;
            plotTitle = `Power: node ${nodeI} vs node ${nodeJ}`;
            break;
        case 'edge-power':
            xAxisLabel = `x${nodeI}`;
            yAxisLabel = `P${nodeI}${nodeJ}`;
            plotTitle = `Edge power: node ${nodeI} to node ${nodeJ}`;
            break;
        default:
            xAxisLabel = `x${nodeI}`;
            yAxisLabel = `x${nodeJ}`;
            plotTitle = `Displacement: node ${nodeI} vs node ${nodeJ}`;
            break;
    }
    
    // Get b1 from spectrum
    let b1 = 2.0; // default
    // Get current energy for amplitude bound (replaces misleading b₁ bound)
    const dynamicsStateForBound = getDynamicsState();
    const currentEnergy = dynamicsStateForBound ? dynamicsStateForBound.energy : 4.0;
    const amplitudeBound = Math.sqrt(currentEnergy); // Max possible amplitude for a single node
    
    // Draw amplitude bound circle (energy-based, not b₁)
    if (vizShowBounds && vizShowBounds.checked) {
        const boundRadius = amplitudeBound * scale;
        const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, boundRadius);
        gradient.addColorStop(0, 'rgba(100, 180, 255, 0.12)');
        gradient.addColorStop(1, 'rgba(100, 180, 255, 0.02)');
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(cx, cy, boundRadius, 0, 2 * Math.PI);
        ctx.fill();
        
        // Amplitude boundary circle (dashed blue)
        ctx.strokeStyle = '#64b5f6';
        ctx.lineWidth = 2;
        ctx.setLineDash([8, 4]);
        ctx.beginPath();
        ctx.arc(cx, cy, boundRadius, 0, 2 * Math.PI);
        ctx.stroke();
        ctx.setLineDash([]);
        
        // Label
        ctx.fillStyle = '#64b5f6';
        ctx.font = '10px sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText(`√E = ${amplitudeBound.toFixed(2)}`, cx + boundRadius + 5, cy);
    }
    
    // Draw grid
    if (vizShowGrid && vizShowGrid.checked) {
        ctx.strokeStyle = '#1a1a3a';
        ctx.lineWidth = 0.5;
        for (let x = 0; x <= W; x += 40) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, H);
            ctx.stroke();
        }
        for (let y = 0; y <= H; y += 40) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(W, y);
            ctx.stroke();
        }
    }
    
    // Draw axes
    ctx.strokeStyle = '#444466';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, cy);
    ctx.lineTo(W, cy);
    ctx.moveTo(cx, 0);
    ctx.lineTo(cx, H);
    ctx.stroke();
    
    // Draw mode lines if enabled - show phase relationships for selected node pair
    if (vizShowEigenvectors && vizShowEigenvectors.checked && currentSpectrum && currentSpectrum.eigenvalues) {
        // Guard against undefined state
        if (!state || !state.vertexMeshes || state.vertexMeshes.length < 2) {
            // Skip mode lines if no graph data
        } else {
            ctx.lineWidth = 1.5;
            const uniqueFreqs = [...new Set(currentSpectrum.eigenvalues
                .map(e => Math.abs(e.im).toFixed(4))
                .filter(f => parseFloat(f) > 0.01)
            )].map(parseFloat).sort((a, b) => b - a).slice(0, 4);
            
            const modeColors = ['#ff9800', '#e91e63', '#9c27b0', '#00bcd4'];
            const n = state.vertexMeshes.length;
            
            uniqueFreqs.forEach((freq, modeIdx) => {
                const color = modeColors[modeIdx % modeColors.length];
                ctx.strokeStyle = color;
                
                // For a cycle, eigenvector components are exp(i*2πk*node/n)
                // The phase relationship between nodeI and nodeJ in mode k
                // determines the angle of the mode line
                const k = modeIdx + 1; // mode number (skip k=0 which has zero frequency)
                const phaseI = (2 * Math.PI * k * nodeI) / n;
                const phaseJ = (2 * Math.PI * k * nodeJ) / n;
                const phaseDiff = phaseJ - phaseI;
                
                // The mode line angle represents how nodeJ relates to nodeI in this mode
                const angle = phaseDiff;
                const len = Math.min(W, H) * 0.35;
                
                // Draw line in both directions
                ctx.beginPath();
                ctx.moveTo(cx - Math.cos(angle) * len, cy + Math.sin(angle) * len);
                ctx.lineTo(cx + Math.cos(angle) * len, cy - Math.sin(angle) * len);
                ctx.stroke();
                
                // Label
                ctx.fillStyle = color;
                ctx.font = '9px sans-serif';
                ctx.textAlign = 'left';
                ctx.fillText(`ω${modeIdx+1}=${freq.toFixed(2)}`, W - 65, 15 + modeIdx * 12);
            });
        }
    }
    
    // Draw phase trail - use our own enhanced trail, not the one from dynamics state
    if (enhancedPhaseTrail.length > 1) {
        const trail = enhancedPhaseTrail;
        ctx.strokeStyle = '#00ffff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        for (let i = 0; i < trail.length; i++) {
            const x = cx + trail[i].x * scale;
            const y = cy - trail[i].y * scale;
            if (i === 0) {
                ctx.moveTo(x, y);
            } else {
                ctx.lineTo(x, y);
            }
        }
        ctx.stroke();
        
        // Current point with glow
        const last = trail[trail.length - 1];
        const px = cx + last.x * scale;
        const py = cy - last.y * scale;
        
        // Glow
        const glow = ctx.createRadialGradient(px, py, 0, px, py, 10);
        glow.addColorStop(0, 'rgba(255, 255, 255, 0.8)');
        glow.addColorStop(1, 'rgba(255, 255, 255, 0)');
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(px, py, 10, 0, 2 * Math.PI);
        ctx.fill();
        
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(px, py, 4, 0, 2 * Math.PI);
        ctx.fill();
        
        // Show coordinates with actual node labels
        ctx.fillStyle = '#aaa';
        ctx.font = '10px monospace';
        ctx.textAlign = 'left';
        ctx.fillText(`(${xAxisLabel}=${last.x.toFixed(2)}, ${yAxisLabel}=${last.y.toFixed(2)})`, 10, H - 10);
    }
    
    // Axis labels with actual node numbers
    ctx.fillStyle = '#4a9eff';
    ctx.font = '11px sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(xAxisLabel, W - 8, cy - 8);
    ctx.textAlign = 'left';
    ctx.fillText(yAxisLabel, cx + 8, 15);
    
    // Plot title at top
    ctx.fillStyle = '#666';
    ctx.font = '9px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(plotTitle, 10, 12);
}

function drawFrequencySpectrum() {
    if (!enhancedSpectrumCanvas) return;
    
    const canvas = enhancedSpectrumCanvas;
    const ctx = canvas.getContext('2d');
    const W = canvas.width;
    const H = canvas.height;
    
    // Clear
    ctx.fillStyle = '#0a0a1a';
    ctx.fillRect(0, 0, W, H);
    
    // ALWAYS compute eigenvalues numerically from actual adjacency matrix
    // Use version WITH multiplicity to correctly count frequencies
    let freqData = [];
    
    if (state.adjacencyMatrix && state.adjacencyMatrix.length >= 2) {
        // Compute ALL numerical eigenvalues (including duplicates)
        const allEigs = computeSkewSymmetricEigenvaluesWithMultiplicity(state.adjacencyMatrix);
        
        if (allEigs && allEigs.length > 0) {
            // Count frequencies (absolute values of imaginary parts)
            const freqMap = new Map();
            allEigs.forEach(e => {
                const f = Math.abs(e.imag);
                if (f > 0.01) {
                    const key = f.toFixed(4);
                    freqMap.set(key, (freqMap.get(key) || 0) + 1);
                }
            });
            
            // Convert to array sorted by frequency (descending)
            freqData = Array.from(freqMap.entries())
                .map(([f, mult]) => ({ freq: parseFloat(f), mult }))
                .sort((a, b) => b.freq - a.freq);
        }
    }
    
    if (freqData.length === 0) {
        ctx.fillStyle = '#666';
        ctx.font = '11px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('Build a graph to see spectrum', W/2, H/2);
        return;
    }
    
    // Drawing area
    const margin = { left: 10, right: 10, top: 25, bottom: 20 };
    const plotW = W - margin.left - margin.right;
    const plotH = H - margin.top - margin.bottom;
    
    const maxFreq = Math.max(...freqData.map(d => d.freq), 1);
    const totalModes = freqData.length;
    
    // Title with count
    ctx.fillStyle = '#888';
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`Frequencies: ${totalModes} unique modes`, margin.left, 12);
    
    // Different display strategies based on number of modes
    if (totalModes <= 12) {
        // Show individual bars with labels
        const barWidth = Math.min(18, (plotW / totalModes) - 3);
        const totalBarsWidth = totalModes * (barWidth + 3);
        const startX = margin.left + (plotW - totalBarsWidth) / 2;
        
        freqData.forEach((data, i) => {
            const x = startX + i * (barWidth + 3);
            const barHeight = (data.freq / maxFreq) * plotH * 0.75;
            const y = margin.top + plotH - barHeight;
            
            // Bar gradient
            const gradient = ctx.createLinearGradient(x, y, x, margin.top + plotH);
            gradient.addColorStop(0, '#4a9eff');
            gradient.addColorStop(1, '#1a5a9f');
            ctx.fillStyle = gradient;
            
            // Rounded top
            const r = Math.min(3, barWidth / 2);
            ctx.beginPath();
            ctx.moveTo(x, margin.top + plotH);
            ctx.lineTo(x, y + r);
            ctx.quadraticCurveTo(x, y, x + r, y);
            ctx.lineTo(x + barWidth - r, y);
            ctx.quadraticCurveTo(x + barWidth, y, x + barWidth, y + r);
            ctx.lineTo(x + barWidth, margin.top + plotH);
            ctx.fill();
            
            // Frequency value on top
            ctx.fillStyle = '#ccc';
            ctx.font = '7px monospace';
            ctx.textAlign = 'center';
            ctx.fillText(data.freq.toFixed(2), x + barWidth/2, y - 2);
            
            // Mode label at bottom (show multiplicity if > 1)
            ctx.fillStyle = '#666';
            ctx.font = '7px sans-serif';
            const label = data.mult > 1 ? `ω${i+1}×${data.mult}` : `ω${i+1}`;
            ctx.fillText(label, x + barWidth/2, H - 3);
        });
    } else {
        // Many modes: show as spectrum line plot
        ctx.strokeStyle = '#4a9eff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        
        freqData.forEach((data, i) => {
            const x = margin.left + (i / (totalModes - 1)) * plotW;
            const y = margin.top + plotH - (data.freq / maxFreq) * plotH * 0.85;
            
            if (i === 0) {
                ctx.moveTo(x, y);
            } else {
                ctx.lineTo(x, y);
            }
        });
        ctx.stroke();
        
        // Fill under curve
        ctx.lineTo(margin.left + plotW, margin.top + plotH);
        ctx.lineTo(margin.left, margin.top + plotH);
        ctx.closePath();
        ctx.fillStyle = 'rgba(74, 158, 255, 0.2)';
        ctx.fill();
        
        // Draw points for significant frequencies
        ctx.fillStyle = '#4a9eff';
        const step = Math.max(1, Math.floor(totalModes / 8));
        for (let i = 0; i < totalModes; i += step) {
            const data = freqData[i];
            const x = margin.left + (i / (totalModes - 1)) * plotW;
            const y = margin.top + plotH - (data.freq / maxFreq) * plotH * 0.85;
            
            ctx.beginPath();
            ctx.arc(x, y, 3, 0, 2 * Math.PI);
            ctx.fill();
            
            // Label
            ctx.fillStyle = '#aaa';
            ctx.font = '7px monospace';
            ctx.textAlign = 'center';
            ctx.fillText(data.freq.toFixed(2), x, y - 5);
            ctx.fillStyle = '#4a9eff';
        }
        
        // Max and min labels
        ctx.fillStyle = '#4CAF50';
        ctx.font = '9px monospace';
        ctx.textAlign = 'left';
        ctx.fillText(`max: ${freqData[0].freq.toFixed(2)}`, margin.left, margin.top + 10);
        ctx.fillStyle = '#ff9800';
        ctx.textAlign = 'right';
        ctx.fillText(`min: ${freqData[totalModes-1].freq.toFixed(2)}`, W - margin.right, margin.top + 10);
    }
    
    // Draw horizontal axis line
    ctx.strokeStyle = '#333355';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(margin.left, margin.top + plotH);
    ctx.lineTo(W - margin.right, margin.top + plotH);
    ctx.stroke();
}

function drawTimeSeries() {
    if (!enhancedTimeseriesCanvas) return;
    
    const canvas = enhancedTimeseriesCanvas;
    const ctx = canvas.getContext('2d');
    const W = canvas.width;
    const H = canvas.height;
    
    // Clear
    ctx.fillStyle = '#0a0a1a';
    ctx.fillRect(0, 0, W, H);
    
    const dynamicsState = getDynamicsState();
    if (!dynamicsState || dynamicsState.nodeStates.length < 2) {
        ctx.fillStyle = '#666';
        ctx.font = '11px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('Start dynamics to see time series', W/2, H/2);
        return;
    }
    
    // Get selected nodes from phase diagram selectors
    const nodeI = phaseNodeISelect ? parseInt(phaseNodeISelect.value) : 0;
    const nodeJ = phaseNodeJSelect ? parseInt(phaseNodeJSelect.value) : 1;
    const selectedNodes = [nodeI, nodeJ];
    
    // Store current state with timestamp (store ALL node states)
    const currentTime = dynamicsState.simulationTime;
    const allStates = [...dynamicsState.nodeStates];
    
    timeSeriesHistory.push({
        time: currentTime,
        states: allStates
    });
    
    // Remove old data outside time window
    const minTime = currentTime - TIME_SERIES_WINDOW;
    while (timeSeriesHistory.length > 0 && timeSeriesHistory[0].time < minTime) {
        timeSeriesHistory.shift();
    }
    
    // Also limit total samples
    if (timeSeriesHistory.length > TIME_SERIES_LENGTH) {
        timeSeriesHistory.shift();
    }
    
    if (timeSeriesHistory.length < 2) return;
    
    // Drawing area
    const margin = { left: 35, right: 45, top: 15, bottom: 25 };
    const plotW = W - margin.left - margin.right;
    const plotH = H - margin.top - margin.bottom;
    
    // Time range
    const startTime = timeSeriesHistory[0].time;
    const endTime = timeSeriesHistory[timeSeriesHistory.length - 1].time;
    const timeRange = Math.max(endTime - startTime, 0.1);
    
    // Draw time axis
    ctx.strokeStyle = '#333355';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(margin.left, H - margin.bottom);
    ctx.lineTo(W - margin.right, H - margin.bottom);
    ctx.stroke();
    
    // Time labels
    ctx.fillStyle = '#888';
    ctx.font = '9px monospace';
    ctx.textAlign = 'center';
    
    const numTicks = 5;
    for (let i = 0; i <= numTicks; i++) {
        const t = startTime + (i / numTicks) * timeRange;
        const x = margin.left + (i / numTicks) * plotW;
        
        // Tick mark
        ctx.beginPath();
        ctx.moveTo(x, H - margin.bottom);
        ctx.lineTo(x, H - margin.bottom + 3);
        ctx.stroke();
        
        // Label
        ctx.fillText(t.toFixed(1), x, H - 5);
    }
    
    // Time label
    ctx.fillStyle = '#666';
    ctx.textAlign = 'right';
    ctx.fillText('t (s)', W - margin.right + 5, H - margin.bottom + 3);
    
    // Draw time series for SELECTED nodes
    const colors = ['#00ffff', '#ff9800'];
    const sectionHeight = plotH / 2;
    
    selectedNodes.forEach((nodeIdx, i) => {
        const baseY = margin.top + i * sectionHeight + sectionHeight / 2;
        
        // Find max amplitude for this node
        let maxVal = 0.1;
        timeSeriesHistory.forEach(entry => {
            if (entry.states[nodeIdx] !== undefined) {
                maxVal = Math.max(maxVal, Math.abs(entry.states[nodeIdx]));
            }
        });
        
        const scaleY = (sectionHeight * 0.4) / maxVal;
        
        // Draw center line (zero line)
        ctx.strokeStyle = '#222244';
        ctx.lineWidth = 1;
        ctx.setLineDash([3, 3]);
        ctx.beginPath();
        ctx.moveTo(margin.left, baseY);
        ctx.lineTo(W - margin.right, baseY);
        ctx.stroke();
        ctx.setLineDash([]);
        
        // Draw time series curve
        ctx.strokeStyle = colors[i];
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        let started = false;
        
        for (let j = 0; j < timeSeriesHistory.length; j++) {
            const entry = timeSeriesHistory[j];
            const x = margin.left + ((entry.time - startTime) / timeRange) * plotW;
            const y = baseY - (entry.states[nodeIdx] || 0) * scaleY;
            
            if (!started) {
                ctx.moveTo(x, y);
                started = true;
            } else {
                ctx.lineTo(x, y);
            }
        }
        ctx.stroke();
        
        // Node label on left
        ctx.fillStyle = colors[i];
        ctx.font = '10px sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText(`x${nodeIdx}`, 5, baseY - sectionHeight * 0.3);
        
        // Current value on right
        const currentVal = allStates[nodeIdx] || 0;
        ctx.textAlign = 'right';
        ctx.font = '9px monospace';
        ctx.fillText(currentVal.toFixed(3), W - 5, baseY + 3);
    });
    
    // Title showing selected nodes
    ctx.fillStyle = '#888';
    ctx.font = '9px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`Nodes ${nodeI} & ${nodeJ} vs time`, margin.left, 10);
}

function updateEnergyDisplay() {
    const dynamicsState = getDynamicsState();
    if (!dynamicsState || !energyBar || !energyValue) return;
    
    const energy = dynamicsState.energy || 1.0;
    
    // Track initial energy on first measurement
    if (initialEnergy === null && energy > 0) {
        initialEnergy = energy;
    }
    
    const refEnergy = initialEnergy || energy;
    const normalizedEnergy = Math.min(energy / refEnergy, 1.2); // Show up to 120% of initial
    
    energyBar.style.width = (normalizedEnergy * 100 / 1.2) + '%';
    energyValue.textContent = energy.toFixed(4);
    
    // Color based on relative conservation (compare to initial energy)
    const relativeError = Math.abs(energy - refEnergy) / refEnergy;
    
    if (relativeError < 0.001) {
        // Excellent conservation (< 0.1% error)
        energyBar.style.background = 'linear-gradient(90deg, #4CAF50, #8BC34A)';
    } else if (relativeError < 0.01) {
        // Good conservation (< 1% error)
        energyBar.style.background = 'linear-gradient(90deg, #8BC34A, #CDDC39)';
    } else if (relativeError < 0.05) {
        // Acceptable (< 5% error)
        energyBar.style.background = 'linear-gradient(90deg, #ff9800, #ffc107)';
    } else {
        // Poor conservation
        energyBar.style.background = 'linear-gradient(90deg, #f44336, #ff5722)';
    }
}

// Helper function is now imported from dynamics-animation.js
// getDynamicsState is imported at the top

// =====================================================
// BUILD ADVANCED TAB
// =====================================================

// Graph product algorithms
function computeCartesianProduct(adjA, adjB) {
    // G □ H: vertices are pairs (i,j), edges when:
    // - (i1,j) ~ (i2,j) if i1 ~ i2 in G (same j)
    // - (i,j1) ~ (i,j2) if j1 ~ j2 in H (same i)
    // Eigenvalues: λᵢ(G) + μⱼ(H)
    const nA = adjA.length;
    const nB = adjB.length;
    const n = nA * nB;
    
    const adj = Array(n).fill(null).map(() => Array(n).fill(0));
    
    for (let i1 = 0; i1 < nA; i1++) {
        for (let j = 0; j < nB; j++) {
            const v1 = i1 * nB + j;
            
            // Edges from G (vary i, fix j)
            for (let i2 = 0; i2 < nA; i2++) {
                if (adjA[i1][i2] !== 0) {
                    const v2 = i2 * nB + j;
                    adj[v1][v2] = adjA[i1][i2];
                }
            }
            
            // Edges from H (fix i, vary j)
            for (let j2 = 0; j2 < nB; j2++) {
                if (adjB[j][j2] !== 0) {
                    const v2 = i1 * nB + j2;
                    adj[v1][v2] = adjB[j][j2];
                }
            }
        }
    }
    
    return adj;
}

function computeTensorProduct(adjA, adjB) {
    // G ⊗ H: vertices are pairs (i,j), edges when:
    // - (i1,j1) ~ (i2,j2) if i1 ~ i2 in G AND j1 ~ j2 in H
    // Eigenvalues: λᵢ(G) · μⱼ(H)
    const nA = adjA.length;
    const nB = adjB.length;
    const n = nA * nB;
    
    const adj = Array(n).fill(null).map(() => Array(n).fill(0));
    
    for (let i1 = 0; i1 < nA; i1++) {
        for (let j1 = 0; j1 < nB; j1++) {
            const v1 = i1 * nB + j1;
            
            for (let i2 = 0; i2 < nA; i2++) {
                for (let j2 = 0; j2 < nB; j2++) {
                    if (adjA[i1][i2] !== 0 && adjB[j1][j2] !== 0) {
                        const v2 = i2 * nB + j2;
                        // Use product of edge weights
                        adj[v1][v2] = adjA[i1][i2] * adjB[j1][j2];
                    }
                }
            }
        }
    }
    
    return adj;
}

function computeStrongProduct(adjA, adjB) {
    // G ⊠ H = G □ H ∪ G ⊗ H
    // Eigenvalues: (1+λᵢ)(1+μⱼ) - 1 = λᵢ + μⱼ + λᵢμⱼ
    const nA = adjA.length;
    const nB = adjB.length;
    const n = nA * nB;
    
    const adj = Array(n).fill(null).map(() => Array(n).fill(0));
    
    for (let i1 = 0; i1 < nA; i1++) {
        for (let j1 = 0; j1 < nB; j1++) {
            const v1 = i1 * nB + j1;
            
            for (let i2 = 0; i2 < nA; i2++) {
                for (let j2 = 0; j2 < nB; j2++) {
                    if (i1 === i2 && j1 === j2) continue;
                    
                    const v2 = i2 * nB + j2;
                    const edgeG = adjA[i1][i2] !== 0;
                    const edgeH = adjB[j1][j2] !== 0;
                    const sameI = i1 === i2;
                    const sameJ = j1 === j2;
                    
                    // Strong product: edge if (edgeG AND sameJ) OR (sameI AND edgeH) OR (edgeG AND edgeH)
                    if ((edgeG && sameJ) || (sameI && edgeH) || (edgeG && edgeH)) {
                        adj[v1][v2] = 1;
                    }
                }
            }
        }
    }
    
    // Make skew-symmetric
    for (let i = 0; i < n; i++) {
        for (let j = i + 1; j < n; j++) {
            if (adj[i][j] !== 0 || adj[j][i] !== 0) {
                adj[i][j] = 1;
                adj[j][i] = -1;
            }
        }
    }
    
    return adj;
}

/**
 * Compute Realizable Product of two graphs.
 * 
 * This product preserves physical realizability by ensuring every mass-mass
 * connection goes through an explicit spring node.
 * 
 * Algorithm:
 * 1. Identify p-nodes (masses) and q-nodes (springs) in each graph via bipartite partition
 * 2. Extract "mass adjacency" - which masses connect via springs
 * 3. Form Cartesian product of mass sets
 * 4. For each edge in the product, insert an explicit spring node
 * 
 * @param {number[][]} adjA - Adjacency matrix of first graph
 * @param {number[][]} adjB - Adjacency matrix of second graph
 * @returns {Object} { adj: adjacency matrix, pIndices: mass indices, qIndices: spring indices }
 */
function computeRealizableProduct(adjA, adjB) {
    // Step 1: Find bipartite partitions (p=masses, q=springs)
    const partA = findBipartitePartition(adjA);
    const partB = findBipartitePartition(adjB);
    
    if (!partA || !partB) {
        console.warn('[RealizableProduct] One or both graphs are not bipartite');
        return null;
    }
    
    // Ensure we have the correct orientation (more p-nodes = masses typically)
    // For mass-spring systems, we usually have fewer masses than springs
    // But let's just use the partition as-is
    const massesA = partA.setA;  // p-nodes in A
    const massesB = partB.setA;  // p-nodes in B
    
    console.log(`[RealizableProduct] Graph A: ${massesA.length} masses, ${partA.setB.length} springs`);
    console.log(`[RealizableProduct] Graph B: ${massesB.length} masses, ${partB.setB.length} springs`);
    
    // Step 2: Build mass adjacency (which masses connect via springs)
    // Two masses are "adjacent" if there exists a spring connecting them
    const massAdjA = buildMassAdjacency(adjA, massesA, partA.setB);
    const massAdjB = buildMassAdjacency(adjB, massesB, partB.setB);
    
    console.log(`[RealizableProduct] Mass adjacency A:`, massAdjA);
    console.log(`[RealizableProduct] Mass adjacency B:`, massAdjB);
    
    // Step 3: Form Cartesian product of mass indices
    // Product masses: (mA, mB) for all mA in massesA, mB in massesB
    const nMassesA = massesA.length;
    const nMassesB = massesB.length;
    const nProductMasses = nMassesA * nMassesB;
    
    // Collect edges in the product (before inserting springs)
    const productEdges = [];
    
    // Edges from A structure (vary mass in A, fix mass in B)
    for (let iA = 0; iA < nMassesA; iA++) {
        for (let iB = 0; iB < nMassesB; iB++) {
            const v1 = iA * nMassesB + iB;  // Product vertex index
            
            // Check adjacency in A
            for (const jA of massAdjA[iA] || []) {
                const v2 = jA * nMassesB + iB;
                if (v1 < v2) {  // Avoid duplicates
                    productEdges.push([v1, v2, 'A']);  // Tag source
                }
            }
            
            // Check adjacency in B
            for (const jB of massAdjB[iB] || []) {
                const v2 = iA * nMassesB + jB;
                if (v1 < v2) {
                    productEdges.push([v1, v2, 'B']);
                }
            }
        }
    }
    
    console.log(`[RealizableProduct] Product has ${nProductMasses} masses, ${productEdges.length} edges to mediate`);
    
    // Step 4: Build final graph with explicit spring nodes
    // Total nodes: product masses + one spring per edge
    const nSprings = productEdges.length;
    const totalNodes = nProductMasses + nSprings;
    
    const adj = Array(totalNodes).fill(null).map(() => Array(totalNodes).fill(0));
    
    // p-indices: 0 to nProductMasses-1 (masses)
    // q-indices: nProductMasses to totalNodes-1 (springs)
    const pIndices = Array.from({ length: nProductMasses }, (_, i) => i);
    const qIndices = Array.from({ length: nSprings }, (_, i) => nProductMasses + i);
    
    // Connect masses through springs
    for (let e = 0; e < productEdges.length; e++) {
        const [m1, m2, source] = productEdges[e];
        const springIdx = nProductMasses + e;
        
        // m1 -> spring -> m2 (skew-symmetric)
        adj[m1][springIdx] = 1;
        adj[springIdx][m1] = -1;
        adj[springIdx][m2] = 1;
        adj[m2][springIdx] = -1;
    }
    
    return {
        adj,
        pIndices,
        qIndices,
        nMasses: nProductMasses,
        nSprings,
        massesA,
        massesB,
        productEdges
    };
}

/**
 * Find bipartite partition of a graph using BFS 2-coloring
 */
function findBipartitePartition(adj) {
    const n = adj.length;
    const color = new Array(n).fill(-1);
    const setA = [];
    const setB = [];
    
    for (let start = 0; start < n; start++) {
        if (color[start] !== -1) continue;
        
        const queue = [start];
        color[start] = 0;
        
        while (queue.length > 0) {
            const u = queue.shift();
            
            for (let v = 0; v < n; v++) {
                if (adj[u][v] !== 0 || adj[v][u] !== 0) {
                    if (color[v] === -1) {
                        color[v] = 1 - color[u];
                        queue.push(v);
                    } else if (color[v] === color[u]) {
                        return null;  // Not bipartite
                    }
                }
            }
        }
    }
    
    for (let i = 0; i < n; i++) {
        if (color[i] === 0) setA.push(i);
        else setB.push(i);
    }
    
    return { setA, setB };
}

/**
 * Build mass adjacency list: which masses connect through springs
 */
function buildMassAdjacency(adj, masses, springs) {
    const massSet = new Set(masses);
    const springSet = new Set(springs);
    const n = adj.length;
    
    // For each mass, find which other masses it connects to via springs
    const massAdj = {};
    for (const m of masses) {
        massAdj[masses.indexOf(m)] = [];
    }
    
    // For each spring, find the two masses it connects
    for (const s of springs) {
        const connectedMasses = [];
        for (let i = 0; i < n; i++) {
            if ((adj[s][i] !== 0 || adj[i][s] !== 0) && massSet.has(i)) {
                connectedMasses.push(masses.indexOf(i));
            }
        }
        
        // If spring connects exactly 2 masses, they're adjacent
        if (connectedMasses.length === 2) {
            const [m1, m2] = connectedMasses;
            if (!massAdj[m1].includes(m2)) massAdj[m1].push(m2);
            if (!massAdj[m2].includes(m1)) massAdj[m2].push(m1);
        }
        // If spring connects 1 mass (grounded), no adjacency added
    }
    
    return massAdj;
}

// Generate base graph adjacency matrices (skew-symmetric)
function generateBaseGraph(type, n) {
    // For realizable systems, n represents the number of masses
    // The actual graph size will be larger (masses + springs)
    
    switch (type) {
        case 'mass-chain': {
            // n masses + (n-1) internal springs + 2 ground springs = 2n+1 nodes
            const nMasses = n;
            const totalNodes = 2 * nMasses + 1;
            const adj = Array(totalNodes).fill(null).map(() => Array(totalNodes).fill(0));
            
            // Connect masses via internal springs (masses: 0 to n-1, springs: n to 2n-2)
            for (let i = 0; i < nMasses - 1; i++) {
                const spring = nMasses + i;
                adj[i][spring] = 1; adj[spring][i] = -1;
                adj[spring][i + 1] = 1; adj[i + 1][spring] = -1;
            }
            
            // Ground springs at ends (indices 2n-1 and 2n)
            adj[2 * nMasses - 1][0] = 1; adj[0][2 * nMasses - 1] = -1;
            adj[2 * nMasses][nMasses - 1] = 1; adj[nMasses - 1][2 * nMasses] = -1;
            
            return adj;
        }
        
        case 'mass-star': {
            // Central spring + n masses + n ground springs = 2n+1 nodes
            const nMasses = n;
            const totalNodes = 2 * nMasses + 1;
            const adj = Array(totalNodes).fill(null).map(() => Array(totalNodes).fill(0));
            
            // Central spring at index 0, masses at 1 to n, ground springs at n+1 to 2n
            for (let i = 0; i < nMasses; i++) {
                adj[0][i + 1] = 1; adj[i + 1][0] = -1;  // center to mass
                adj[i + 1][nMasses + 1 + i] = 1; adj[nMasses + 1 + i][i + 1] = -1;  // mass to ground
            }
            
            return adj;
        }
        
        case 'mass-cantilever': {
            // n masses + (n-1) internal springs + 1 ground spring = 2n nodes
            const nMasses = n;
            const totalNodes = 2 * nMasses;
            const adj = Array(totalNodes).fill(null).map(() => Array(totalNodes).fill(0));
            
            // Internal springs between masses
            for (let i = 0; i < nMasses - 1; i++) {
                const spring = nMasses + i;
                adj[i][spring] = 1; adj[spring][i] = -1;
                adj[spring][i + 1] = 1; adj[i + 1][spring] = -1;
            }
            
            // Ground spring at fixed end (index 2n-1 connects to mass 0)
            adj[2 * nMasses - 1][0] = 1; adj[0][2 * nMasses - 1] = -1;
            
            return adj;
        }
        
        default: {
            // Standard graphs (path, cycle, star, complete)
            const adj = Array(n).fill(null).map(() => Array(n).fill(0));
            
            switch (type) {
                case 'path':
                    for (let i = 0; i < n - 1; i++) {
                        adj[i][i + 1] = 1;
                        adj[i + 1][i] = -1;
                    }
                    break;
                    
                case 'cycle':
                    for (let i = 0; i < n; i++) {
                        const next = (i + 1) % n;
                        adj[i][next] = 1;
                        adj[next][i] = -1;
                    }
                    break;
                    
                case 'star':
                    for (let i = 1; i < n; i++) {
                        adj[0][i] = 1;
                        adj[i][0] = -1;
                    }
                    break;
                    
                case 'complete':
                    for (let i = 0; i < n; i++) {
                        for (let j = i + 1; j < n; j++) {
                            adj[i][j] = 1;
                            adj[j][i] = -1;
                        }
                    }
                    break;
            }
            
            return adj;
        }
    }
}

// Parameterized family builders
function buildSTree(d, p) {
    // S^d_p tree: depth d, p branches at center
    // N = d*p + 1 vertices
    const n = d * p + 1;
    const adj = Array(n).fill(null).map(() => Array(n).fill(0));
    
    // Vertex 0 is center, connects to p vertices at level 1
    // Each level-k vertex connects to one vertex at level k+1
    let vertexIndex = 1;
    
    // Create p branches
    for (let branch = 0; branch < p; branch++) {
        let parent = 0;
        for (let level = 1; level <= d; level++) {
            adj[parent][vertexIndex] = 1;
            adj[vertexIndex][parent] = -1;
            parent = vertexIndex;
            vertexIndex++;
        }
    }
    
    return { adj, n, name: `S${superscript(d)}${subscript(p)} Tree` };
}

function buildCirculant(n, steps) {
    // C(n, S): vertex i connects to i±s (mod n) for each s in S
    const adj = Array(n).fill(null).map(() => Array(n).fill(0));
    
    for (let i = 0; i < n; i++) {
        for (const s of steps) {
            const j = (i + s) % n;
            if (adj[i][j] === 0 && adj[j][i] === 0) {
                adj[i][j] = 1;
                adj[j][i] = -1;
            }
        }
    }
    
    return { adj, n, name: `Circulant C(${n}, {${steps.join(',')}})` };
}

function buildGeneralizedPetersen(n, k) {
    // GP(n,k): outer cycle + inner star polygon + connections
    // 2n vertices: 0..n-1 (outer), n..2n-1 (inner)
    const totalN = 2 * n;
    const adj = Array(totalN).fill(null).map(() => Array(totalN).fill(0));
    
    // Outer cycle
    for (let i = 0; i < n; i++) {
        const next = (i + 1) % n;
        adj[i][next] = 1;
        adj[next][i] = -1;
    }
    
    // Inner star polygon (step k)
    for (let i = 0; i < n; i++) {
        const inner_i = n + i;
        const inner_j = n + ((i + k) % n);
        if (adj[inner_i][inner_j] === 0 && adj[inner_j][inner_i] === 0) {
            adj[inner_i][inner_j] = 1;
            adj[inner_j][inner_i] = -1;
        }
    }
    
    // Spokes connecting outer to inner
    for (let i = 0; i < n; i++) {
        adj[i][n + i] = 1;
        adj[n + i][i] = -1;
    }
    
    return { adj, n: totalN, name: `GP(${n},${k})` };
}

function buildPrism(m) {
    // Prism Y_m = C_m □ P_2
    const adj = Array(2 * m).fill(null).map(() => Array(2 * m).fill(0));
    
    // Two cycles
    for (let i = 0; i < m; i++) {
        const next = (i + 1) % m;
        // Bottom cycle
        adj[i][next] = 1;
        adj[next][i] = -1;
        // Top cycle
        adj[m + i][m + next] = 1;
        adj[m + next][m + i] = -1;
    }
    
    // Vertical edges
    for (let i = 0; i < m; i++) {
        adj[i][m + i] = 1;
        adj[m + i][i] = -1;
    }
    
    return { adj, n: 2 * m, name: `Prism Y${subscript(m)}` };
}

function buildAntiprism(m) {
    // Antiprism: two m-cycles with alternating triangular faces
    const adj = Array(2 * m).fill(null).map(() => Array(2 * m).fill(0));
    
    // Two cycles
    for (let i = 0; i < m; i++) {
        const next = (i + 1) % m;
        adj[i][next] = 1;
        adj[next][i] = -1;
        adj[m + i][m + next] = 1;
        adj[m + next][m + i] = -1;
    }
    
    // Cross edges (each top vertex connects to two bottom vertices)
    for (let i = 0; i < m; i++) {
        // Connect top[i] to bottom[i] and bottom[(i+1) mod m]
        adj[i][m + i] = 1;
        adj[m + i][i] = -1;
        const next = (i + 1) % m;
        adj[i][m + next] = 1;
        adj[m + next][i] = -1;
    }
    
    return { adj, n: 2 * m, name: `Antiprism A${subscript(m)}` };
}

function buildMobiusLadder(n) {
    // Möbius ladder M_{2n}: cycle with antipodal chords
    // Actually M_n has n vertices
    const adj = Array(n).fill(null).map(() => Array(n).fill(0));
    
    // Cycle
    for (let i = 0; i < n; i++) {
        const next = (i + 1) % n;
        adj[i][next] = 1;
        adj[next][i] = -1;
    }
    
    // Antipodal chords (connect i to i + n/2)
    const half = Math.floor(n / 2);
    for (let i = 0; i < half; i++) {
        const j = i + half;
        adj[i][j] = 1;
        adj[j][i] = -1;
    }
    
    return { adj, n, name: `Möbius M${subscript(n)}` };
}

// Helper for superscript/subscript
function superscript(n) {
    const sups = '⁰¹²³⁴⁵⁶⁷⁸⁹';
    return String(n).split('').map(d => sups[parseInt(d)]).join('');
}

function subscript(n) {
    const subs = '₀₁₂₃₄₅₆₇₈₉';
    return String(n).split('').map(d => subs[parseInt(d)]).join('');
}

// Add a vertex at position (x, y, z)
function addVertex(x, y, z) {
    const position = new THREE.Vector3(x, y, z);
    const index = state.vertexMeshes.length;
    return createVertex(position, index);
}

// Apply built graph to the visualization
function applyBuiltGraph(adjMatrix, name, layoutType = 'circle', layoutParams = null) {
    const n = adjMatrix.length;
    
    // Clear current graph
    clearGraph();
    
    // Generate vertices in appropriate layout
    const radius = 40;
    
    if (layoutType === 'product-grid' && layoutParams) {
        // Product graph grid layout - lay out as nA × nB grid
        const { nA, nB } = layoutParams;
        const spacing = 25;
        for (let i = 0; i < n; i++) {
            const iA = Math.floor(i / nB);
            const iB = i % nB;
            const x = (iA - (nA - 1) / 2) * spacing;
            const y = (iB - (nB - 1) / 2) * spacing;
            addVertex(x, y, 0);
        }
    } else if (layoutType === 'grid' && Math.sqrt(n) === Math.floor(Math.sqrt(n))) {
        // Square grid layout
        const side = Math.floor(Math.sqrt(n));
        const spacing = radius * 2 / (side - 1);
        for (let i = 0; i < n; i++) {
            const row = Math.floor(i / side);
            const col = i % side;
            const x = (col - (side - 1) / 2) * spacing;
            const z = (row - (side - 1) / 2) * spacing;
            addVertex(x, 0, z);
        }
    } else if (layoutType === 'bipartite') {
        // Two-row layout for product graphs
        const half = Math.floor(n / 2);
        for (let i = 0; i < n; i++) {
            const angle = (i % half) / half * Math.PI - Math.PI / 2;
            const r = (i < half) ? radius : radius * 0.6;
            const y = (i < half) ? 10 : -10;
            addVertex(r * Math.cos(angle), y, r * Math.sin(angle));
        }
    } else {
        // Circle layout (default)
        for (let i = 0; i < n; i++) {
            const angle = (2 * Math.PI * i) / n;
            addVertex(radius * Math.cos(angle), 0, radius * Math.sin(angle));
        }
    }
    
    // Initialize adjacency matrices BEFORE adding edges
    state.adjacencyMatrix = Array(n).fill(null).map(() => Array(n).fill(0));
    state.symmetricAdjMatrix = Array(n).fill(null).map(() => Array(n).fill(0));
    
    // Copy the adjacency matrix and create visual edges
    for (let i = 0; i < n; i++) {
        for (let j = 0; j < n; j++) {
            state.adjacencyMatrix[i][j] = adjMatrix[i][j];
            state.symmetricAdjMatrix[i][j] = Math.abs(adjMatrix[i][j]);
        }
    }
    
    // Create visual edges from adjacency matrix
    // Dynamic scaling based on graph size
    const scaleFactor = n <= 5 ? 1.0 : n <= 20 ? 1.0 - (n - 5) * 0.025 : 0.625;
    
    for (let i = 0; i < n; i++) {
        for (let j = i + 1; j < n; j++) {
            if (adjMatrix[i][j] !== 0 || adjMatrix[j][i] !== 0) {
                // Create the arrow visual directly
                const fromPos = state.vertexMeshes[i].position;
                const toPos = state.vertexMeshes[j].position;
                
                const direction = new THREE.Vector3().subVectors(toPos, fromPos);
                const length = direction.length();
                direction.normalize();
                
                const arrowStart = fromPos.clone().add(direction.clone().multiplyScalar(VERTEX_RADIUS));
                const arrowLength = length - 2 * VERTEX_RADIUS - 1;
                
                if (arrowLength > 0) {
                    const arrow = new Arrow3D(
                        direction,
                        arrowStart,
                        arrowLength,
                        0xe57373,  // Soft coral/salmon
                        Math.min(arrowLength * 0.35 * scaleFactor, 5 * scaleFactor),
                        Math.min(arrowLength * 0.18 * scaleFactor, 2.5 * scaleFactor)
                    );
                    state.graphGroup.add(arrow);
                    state.edgeObjects.push({ from: i, to: j, arrow });
                }
            }
        }
    }
    
    updateStats();
    console.log(`Built: ${name} with ${n} vertices, ${state.edgeObjects.length} edges`);
}

/**
 * Apply a realizable product result with proper layout
 * Masses in grid, springs offset along edges
 */
function applyRealizableProduct(result, name) {
    const { adj, pIndices, qIndices, nMasses, nSprings, massesA, massesB, productEdges } = result;
    const n = adj.length;
    
    // Clear current graph
    clearGraph();
    
    // Calculate grid dimensions for mass layout
    const nA = massesA.length;
    const nB = massesB.length;
    const spacing = 25;
    
    // Position masses in a grid pattern
    const massPositions = [];
    for (let iA = 0; iA < nA; iA++) {
        for (let iB = 0; iB < nB; iB++) {
            const x = (iA - (nA - 1) / 2) * spacing;
            const y = (iB - (nB - 1) / 2) * spacing;
            massPositions.push(new THREE.Vector3(x, y, 0));
        }
    }
    
    // Create mass vertices (p-nodes)
    for (let i = 0; i < nMasses; i++) {
        addVertex(massPositions[i].x, massPositions[i].y, massPositions[i].z);
    }
    
    // Position springs at midpoints of edges, slightly offset
    for (let e = 0; e < productEdges.length; e++) {
        const [m1, m2, source] = productEdges[e];
        const p1 = massPositions[m1];
        const p2 = massPositions[m2];
        
        // Midpoint with slight offset perpendicular to edge
        const mid = new THREE.Vector3().addVectors(p1, p2).multiplyScalar(0.5);
        const dir = new THREE.Vector3().subVectors(p2, p1).normalize();
        const perp = new THREE.Vector3(-dir.y, dir.x, 0);  // 2D perpendicular
        
        // Offset based on source (A edges go one way, B edges go other way)
        const offset = source === 'A' ? 3 : -3;
        mid.add(perp.multiplyScalar(offset));
        
        addVertex(mid.x, mid.y, mid.z);
    }
    
    // Initialize adjacency matrices
    state.adjacencyMatrix = Array(n).fill(null).map(() => Array(n).fill(0));
    state.symmetricAdjMatrix = Array(n).fill(null).map(() => Array(n).fill(0));
    
    // Copy the adjacency matrix
    for (let i = 0; i < n; i++) {
        for (let j = 0; j < n; j++) {
            state.adjacencyMatrix[i][j] = adj[i][j];
            state.symmetricAdjMatrix[i][j] = Math.abs(adj[i][j]);
        }
    }
    
    // Create visual edges
    const scaleFactor = n <= 5 ? 1.0 : n <= 20 ? 1.0 - (n - 5) * 0.025 : 0.625;
    
    for (let i = 0; i < n; i++) {
        for (let j = i + 1; j < n; j++) {
            if (adj[i][j] !== 0 || adj[j][i] !== 0) {
                const fromPos = state.vertexMeshes[i].position;
                const toPos = state.vertexMeshes[j].position;
                
                const direction = new THREE.Vector3().subVectors(toPos, fromPos);
                const length = direction.length();
                direction.normalize();
                
                const arrowStart = fromPos.clone().add(direction.clone().multiplyScalar(VERTEX_RADIUS));
                const arrowLength = length - 2 * VERTEX_RADIUS - 1;
                
                if (arrowLength > 0) {
                    const arrow = new Arrow3D(
                        direction,
                        arrowStart,
                        arrowLength,
                        0xe57373,
                        Math.min(arrowLength * 0.35 * scaleFactor, 5 * scaleFactor),
                        Math.min(arrowLength * 0.18 * scaleFactor, 2.5 * scaleFactor)
                    );
                    state.graphGroup.add(arrow);
                    state.edgeObjects.push({ from: i, to: j, arrow });
                }
            }
        }
    }
    
    // Store partition info for physics
    if (typeof physicsPartition !== 'undefined') {
        physicsPartition.pIndices = [...pIndices];
        physicsPartition.qIndices = [...qIndices];
    }
    
    updateStats();
    
    // Trigger physics audit with the known partition
    if (typeof onGraphChanged === 'function') {
        onGraphChanged();
    }
    
    console.log(`Built Realizable Product: ${name}`);
    console.log(`  ${nMasses} masses (p-nodes): [${pIndices.join(', ')}]`);
    console.log(`  ${nSprings} springs (q-nodes): [${qIndices.join(', ')}]`);
}

// Setup Advanced Build tab event listeners
function setupAdvancedBuildTab() {
    // Product graph controls
    const productGraphA = document.getElementById('product-graph-a');
    const productNA = document.getElementById('product-n-a');
    const productNARow = document.getElementById('product-n-a-row');
    const productType = document.getElementById('product-type');
    const productGraphB = document.getElementById('product-graph-b');
    const productNB = document.getElementById('product-n-b');
    const productNBRow = document.getElementById('product-n-b-row');
    const productResultName = document.getElementById('product-result-name');
    const productResultVertices = document.getElementById('product-result-vertices');
    const productResultFormula = document.getElementById('product-result-formula');
    const buildProductBtn = document.getElementById('build-product-btn');
    
    // Show/hide n parameter rows based on selection
    function updateProductParamVisibility() {
        const typeA = productGraphA ? productGraphA.value : 'current';
        const typeB = productGraphB ? productGraphB.value : 'path';
        
        if (productNARow) {
            productNARow.style.display = (typeA === 'current') ? 'none' : 'flex';
        }
        if (productNBRow) {
            productNBRow.style.display = (typeB === 'current') ? 'none' : 'flex';
        }
    }
    
    // Update preview when parameters change
    function updateProductPreview() {
        if (!productGraphA || !productGraphB) return;
        
        updateProductParamVisibility();
        
        const typeA = productGraphA.value;
        const nA = typeA === 'current' ? state.vertexMeshes.length : (parseInt(productNA.value) || 4);
        const typeB = productGraphB.value;
        const nB = typeB === 'current' ? state.vertexMeshes.length : (parseInt(productNB.value) || 3);
        const prodType = productType.value;
        
        const nameA = typeA === 'current' ? `G(${nA})` : `${typeA.charAt(0).toUpperCase()}${subscript(nA)}`;
        const nameB = typeB === 'current' ? `G(${nB})` : `${typeB.charAt(0).toUpperCase()}${subscript(nB)}`;
        const symbol = prodType === 'cartesian' ? '□' : 
                      prodType === 'tensor' ? '⊗' : 
                      prodType === 'realizable' ? '⚡' : '⊠';
        
        // Can't use current graph for both A and B
        if (typeA === 'current' && typeB === 'current') {
            if (productResultName) productResultName.textContent = '⚠️ Cannot use current for both A and B';
            if (productResultVertices) productResultVertices.textContent = '';
            if (productResultFormula) productResultFormula.textContent = '';
            return;
        }
        
        const totalN = nA * nB;
        
        if (productResultName) {
            let resultName = `${nameA} ${symbol} ${nameB}`;
            // Special names for common products
            if (prodType === 'realizable') {
                resultName += ` (Mass-Spring)`;
            } else if (typeA === 'current' && typeB === 'path' && prodType === 'cartesian') {
                resultName += ` = Extrusion`;
            } else if (typeA === 'cycle' && typeB === 'path' && prodType === 'cartesian') {
                resultName += ` = Cylinder`;
            } else if (typeA === 'path' && typeB === 'path' && prodType === 'cartesian') {
                resultName += ` = Grid ${nA}×${nB}`;
            } else if (typeA === 'cycle' && typeB === 'cycle' && prodType === 'cartesian') {
                resultName += ` = Torus`;
            }
            productResultName.textContent = resultName;
        }
        
        if (productResultVertices) {
            if (typeA === 'current' && nA < 2) {
                productResultVertices.textContent = 'Build a graph first';
            } else if (prodType === 'realizable') {
                // For realizable product, estimate masses and springs
                // Masses = nA × nB, Springs = edges in Cartesian product of mass skeletons
                // For paths: edges = (nA-1)*nB + nA*(nB-1) for grid
                // This is approximate since we don't know exact structure
                productResultVertices.textContent = `≈ ${totalN} masses + springs (bipartite req.)`;
            } else {
                productResultVertices.textContent = `Vertices: ${totalN}`;
            }
        }
        
        if (productResultFormula) {
            if (prodType === 'cartesian') {
                productResultFormula.textContent = 'λᵢⱼ = λᵢ(A) + μⱼ(B)';
            } else if (prodType === 'tensor') {
                productResultFormula.textContent = 'λᵢⱼ = λᵢ(A) · μⱼ(B)';
            } else if (prodType === 'realizable') {
                productResultFormula.textContent = 'Preserves p/q partition';
            } else {
                productResultFormula.textContent = 'λᵢⱼ = (1+λᵢ)(1+μⱼ) - 1';
            }
        }
    }
    
    if (productGraphA) productGraphA.addEventListener('change', updateProductPreview);
    if (productNA) productNA.addEventListener('input', updateProductPreview);
    if (productType) productType.addEventListener('change', updateProductPreview);
    if (productGraphB) productGraphB.addEventListener('change', updateProductPreview);
    if (productNB) productNB.addEventListener('input', updateProductPreview);
    
    // Build product graph
    if (buildProductBtn) {
        buildProductBtn.addEventListener('click', () => {
            const typeA = productGraphA.value;
            const nA = parseInt(productNA.value) || 4;
            const typeB = productGraphB.value;
            const nB = parseInt(productNB.value) || 3;
            const prodType = productType.value;
            
            // Can't use current for both
            if (typeA === 'current' && typeB === 'current') {
                alert('Cannot use Current Graph for both A and B');
                return;
            }
            
            let adjA, adjB;
            let actualNA, actualNB;
            
            if (typeA === 'current') {
                adjA = state.adjacencyMatrix;
                if (!adjA || adjA.length < 2) {
                    alert('Build a graph first to use as Graph A');
                    return;
                }
                actualNA = adjA.length;
            } else {
                adjA = generateBaseGraph(typeA, nA);
                actualNA = nA;
            }
            
            if (typeB === 'current') {
                adjB = state.adjacencyMatrix;
                if (!adjB || adjB.length < 2) {
                    alert('Build a graph first to use as Graph B');
                    return;
                }
                actualNB = adjB.length;
            } else {
                adjB = generateBaseGraph(typeB, nB);
                actualNB = nB;
            }
            
            let productAdj;
            let productResult = null;
            
            if (prodType === 'cartesian') {
                productAdj = computeCartesianProduct(adjA, adjB);
            } else if (prodType === 'tensor') {
                productAdj = computeTensorProduct(adjA, adjB);
            } else if (prodType === 'realizable') {
                productResult = computeRealizableProduct(adjA, adjB);
                if (!productResult) {
                    alert('Realizable product requires both graphs to be bipartite.\nTry using graphs from the "⚡ Realizable Systems" templates.');
                    return;
                }
                productAdj = productResult.adj;
            } else {
                productAdj = computeStrongProduct(adjA, adjB);
            }
            
            const symbol = prodType === 'cartesian' ? '□' : 
                          prodType === 'tensor' ? '⊗' : 
                          prodType === 'realizable' ? '⚡' : '⊠';
            const nameA = typeA === 'current' ? `G${subscript(actualNA)}` : `${typeA.charAt(0).toUpperCase()}${subscript(actualNA)}`;
            const nameB = typeB === 'current' ? `G${subscript(actualNB)}` : `${typeB.charAt(0).toUpperCase()}${subscript(actualNB)}`;
            
            // For realizable product, use custom graph building to preserve partition info
            if (prodType === 'realizable' && productResult) {
                applyRealizableProduct(productResult, `${nameA} ${symbol} ${nameB}`);
            } else {
                // Use product-grid layout for better visualization
                applyBuiltGraph(productAdj, `${nameA} ${symbol} ${nameB}`, 'product-grid', { nA: actualNA, nB: actualNB });
            }
        });
    }
    
    // Parameterized families
    const paramFamily = document.getElementById('param-family');
    const buildFamilyBtn = document.getElementById('build-family-btn');
    
    // S-tree parameters
    const streeD = document.getElementById('stree-d');
    const streeP = document.getElementById('stree-p');
    const streeDLabel = document.getElementById('stree-d-label');
    const streePLabel = document.getElementById('stree-p-label');
    const streeVertices = document.getElementById('stree-vertices');
    const streeFormula = document.getElementById('stree-formula');
    
    // Circulant parameters
    const circulantN = document.getElementById('circulant-n');
    const circulantSteps = document.getElementById('circulant-steps');
    const circulantInfo = document.getElementById('circulant-info');
    
    // GP parameters
    const gpN = document.getElementById('gp-n');
    const gpK = document.getElementById('gp-k');
    const gpInfo = document.getElementById('gp-info');
    
    // Prism parameters
    const prismM = document.getElementById('prism-m');
    const prismInfo = document.getElementById('prism-info');
    
    // Show/hide parameter groups
    function updateParamVisibility() {
        const family = paramFamily ? paramFamily.value : 's-tree';
        
        document.getElementById('params-s-tree').style.display = family === 's-tree' ? 'block' : 'none';
        document.getElementById('params-circulant').style.display = family === 'circulant' ? 'block' : 'none';
        document.getElementById('params-gp').style.display = family === 'gp' ? 'block' : 'none';
        
        const prismParams = document.getElementById('params-prism');
        if (prismParams) {
            prismParams.style.display = (family === 'prism' || family === 'antiprism' || family === 'mobius') ? 'block' : 'none';
        }
    }
    
    if (paramFamily) paramFamily.addEventListener('change', updateParamVisibility);
    
    // Update S-tree info
    function updateStreeInfo() {
        const d = parseInt(streeD?.value) || 2;
        const p = parseInt(streeP?.value) || 4;
        
        if (streeDLabel) streeDLabel.textContent = d;
        if (streePLabel) streePLabel.textContent = p;
        if (streeVertices) streeVertices.textContent = `N = d·p + 1 = ${d * p + 1}`;
        
        if (streeFormula) {
            if (d === 2) {
                streeFormula.textContent = `λ = ±√(${p}+1) = ±${Math.sqrt(p+1).toFixed(3)}, ±1 (×${p-1}), 0`;
            } else {
                streeFormula.textContent = `Eigenvalues from ${d}×${d} tridiagonal matrix`;
            }
        }
    }
    
    if (streeD) streeD.addEventListener('input', updateStreeInfo);
    if (streeP) streeP.addEventListener('input', updateStreeInfo);
    
    // Update Circulant info
    function updateCirculantInfo() {
        const n = parseInt(circulantN?.value) || 8;
        const stepsStr = circulantSteps?.value || '1,2';
        const steps = stepsStr.split(',').map(s => parseInt(s.trim())).filter(s => !isNaN(s) && s > 0);
        
        let degree = 0;
        for (const s of steps) {
            degree += (s === n / 2) ? 1 : 2;
        }
        
        if (circulantInfo) {
            circulantInfo.textContent = `C(${n}, {${steps.join(',')}): ${n} vertices, ${degree}-regular`;
        }
    }
    
    if (circulantN) circulantN.addEventListener('input', updateCirculantInfo);
    if (circulantSteps) circulantSteps.addEventListener('input', updateCirculantInfo);
    
    // Update GP info
    function updateGPInfo() {
        const n = parseInt(gpN?.value) || 5;
        const k = parseInt(gpK?.value) || 2;
        
        if (gpInfo) {
            let name = `GP(${n},${k})`;
            if (n === 5 && k === 2) name += ' = Petersen';
            else if (n === 4 && k === 1) name += ' = Cube Q₃';
            gpInfo.textContent = `${name}: ${2*n} vertices`;
        }
    }
    
    if (gpN) gpN.addEventListener('input', updateGPInfo);
    if (gpK) gpK.addEventListener('input', updateGPInfo);
    
    // Update Prism info
    function updatePrismInfo() {
        const m = parseInt(prismM?.value) || 5;
        const family = paramFamily?.value || 'prism';
        
        if (prismInfo) {
            if (family === 'prism') {
                prismInfo.textContent = `Prism Y${subscript(m)}: ${2*m} vertices`;
            } else if (family === 'antiprism') {
                prismInfo.textContent = `Antiprism A${subscript(m)}: ${2*m} vertices`;
            } else if (family === 'mobius') {
                prismInfo.textContent = `Möbius M${subscript(m)}: ${m} vertices`;
            }
        }
    }
    
    if (prismM) prismM.addEventListener('input', updatePrismInfo);
    if (paramFamily) paramFamily.addEventListener('change', updatePrismInfo);
    
    // Build parameterized family
    if (buildFamilyBtn) {
        buildFamilyBtn.addEventListener('click', () => {
            const family = paramFamily?.value || 's-tree';
            let result;
            
            switch (family) {
                case 's-tree':
                    const d = parseInt(streeD?.value) || 2;
                    const p = parseInt(streeP?.value) || 4;
                    result = buildSTree(d, p);
                    break;
                    
                case 'circulant':
                    const n = parseInt(circulantN?.value) || 8;
                    const stepsStr = circulantSteps?.value || '1,2';
                    const steps = stepsStr.split(',').map(s => parseInt(s.trim())).filter(s => !isNaN(s) && s > 0);
                    result = buildCirculant(n, steps);
                    break;
                    
                case 'gp':
                    const gpn = parseInt(gpN?.value) || 5;
                    const gpk = parseInt(gpK?.value) || 2;
                    result = buildGeneralizedPetersen(gpn, gpk);
                    break;
                    
                case 'prism':
                    const prism_m = parseInt(prismM?.value) || 5;
                    result = buildPrism(prism_m);
                    break;
                    
                case 'antiprism':
                    const anti_m = parseInt(prismM?.value) || 5;
                    result = buildAntiprism(anti_m);
                    break;
                    
                case 'mobius':
                    const mob_m = parseInt(prismM?.value) || 8;
                    result = buildMobiusLadder(mob_m);
                    break;
                    
                default:
                    console.error('Unknown family:', family);
                    return;
            }
            
            if (result && result.adj) {
                applyBuiltGraph(result.adj, result.name);
            }
        });
    }
    
    // Initialize
    updateProductPreview();
    updateParamVisibility();
    updateStreeInfo();
    updateCirculantInfo();
    updateGPInfo();
    updatePrismInfo();
}

// =====================================================
// COPY TO CLIPBOARD FUNCTIONALITY
// =====================================================

function setupCopyButtons() {
    // Helper to copy text and show feedback
    function copyToClipboard(text, button) {
        navigator.clipboard.writeText(text).then(() => {
            const originalText = button.textContent;
            button.textContent = '✓';
            button.classList.add('copied');
            setTimeout(() => {
                button.textContent = originalText;
                button.classList.remove('copied');
            }, 1500);
        }).catch(err => {
            console.error('Copy failed:', err);
            alert('Copy failed. Please select and copy manually.');
        });
    }
    
    // Copy Symmetric Eigenvalues
    const copySymEigBtn = document.getElementById('copy-sym-eig-btn');
    if (copySymEigBtn) {
        copySymEigBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const formula = document.getElementById('analytic-formula-display')?.textContent || '';
            const numerical = document.getElementById('eigenvalues-display')?.textContent || '';
            const text = `Symmetric Eigenvalues\n${'='.repeat(40)}\nFormula: ${formula}\n\nNumerical Values:\n${numerical}`;
            copyToClipboard(text, copySymEigBtn);
        });
    }
    
    // Reset Eigenmode Button - restores graph to original shape
    const resetEigenmodeBtn = document.getElementById('reset-eigenmode-btn');
    if (resetEigenmodeBtn) {
        resetEigenmodeBtn.addEventListener('click', () => {
            import('./dynamics-animation.js').then(module => {
                module.stopEigenmodeAnimation();
                // Clear active eigenvalue highlight
                document.querySelectorAll('.eigenvalue-clickable').forEach(item => {
                    item.classList.remove('eigenvalue-active');
                });
                console.log('Graph shape reset to original');
            });
        });
    }
    
    // Copy Skew-Symmetric Eigenvalues
    const copySkewEigBtn = document.getElementById('copy-skew-eig-btn');
    if (copySkewEigBtn) {
        copySkewEigBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const formula = document.getElementById('skew-analytic-formula-display')?.textContent || '';
            const numerical = document.getElementById('skew-eigenvalues-display')?.textContent || '';
            const text = `Skew-Symmetric Eigenvalues\n${'='.repeat(40)}\nFormula: ${formula}\n\nNumerical Values:\n${numerical}`;
            copyToClipboard(text, copySkewEigBtn);
        });
    }
    
    // Copy Characteristic Polynomial
    const copyCharPolyBtn = document.getElementById('copy-charpoly-btn');
    if (copyCharPolyBtn) {
        copyCharPolyBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const poly = document.getElementById('char-polynomial-display')?.textContent || '';
            copyToClipboard(`Characteristic Polynomial:\n${poly}`, copyCharPolyBtn);
        });
    }
    
    // Copy Skew-Symmetric Matrix
    const copySkewMatrixBtn = document.getElementById('copy-skew-matrix-btn');
    if (copySkewMatrixBtn) {
        copySkewMatrixBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const n = state.adjacencyMatrix.length;
            if (n === 0) {
                alert('No graph to copy');
                return;
            }
            // Format as space-separated values
            let text = `Skew-Symmetric Adjacency Matrix (${n}×${n}):\n`;
            for (let i = 0; i < n; i++) {
                text += state.adjacencyMatrix[i].map(v => v >= 0 ? ` ${v}` : `${v}`).join(' ') + '\n';
            }
            copyToClipboard(text, copySkewMatrixBtn);
        });
    }
    
    // Copy Symmetric Matrix
    const copySymMatrixBtn = document.getElementById('copy-sym-matrix-btn');
    if (copySymMatrixBtn) {
        copySymMatrixBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const n = state.symmetricAdjMatrix.length;
            if (n === 0) {
                alert('No graph to copy');
                return;
            }
            // Format as space-separated values
            let text = `Symmetric Adjacency Matrix (${n}×${n}):\n`;
            for (let i = 0; i < n; i++) {
                text += state.symmetricAdjMatrix[i].join(' ') + '\n';
            }
            copyToClipboard(text, copySymMatrixBtn);
        });
    }
}

// =====================================================
// KEYBOARD SHORTCUTS
// =====================================================

function setupKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
        // Ignore if typing in an input field
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') {
            return;
        }
        
        switch (e.key.toLowerCase()) {
            case 'f':
                // Fit graph to view
                fitGraphToView();
                break;
            case 'escape':
                // Deselect current vertex
                if (state.selectedVertex !== null) {
                    setVertexMaterial(state.selectedVertex, 'default');
                    state.selectedVertex = null;
                }
                break;
        }
    });
}

// Fit graph to view - adjusts camera to show all vertices
function fitGraphToView() {
    if (state.vertexMeshes.length === 0) return;
    
    // Calculate bounding box of all vertices
    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;
    let minZ = Infinity, maxZ = -Infinity;
    
    for (const mesh of state.vertexMeshes) {
        const pos = mesh.position;
        minX = Math.min(minX, pos.x);
        maxX = Math.max(maxX, pos.x);
        minY = Math.min(minY, pos.y);
        maxY = Math.max(maxY, pos.y);
        minZ = Math.min(minZ, pos.z);
        maxZ = Math.max(maxZ, pos.z);
    }
    
    // Calculate center and size
    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;
    const centerZ = (minZ + maxZ) / 2;
    
    const sizeX = maxX - minX;
    const sizeY = maxY - minY;
    const sizeZ = maxZ - minZ;
    const maxSize = Math.max(sizeX, sizeY, sizeZ, 20); // Minimum size of 20
    
    // Position camera to see the whole graph
    const distance = maxSize * 1.8;
    
    // Set camera position (looking from front-top-right)
    camera.position.set(
        centerX + distance * 0.3,
        centerY + distance * 0.5,
        centerZ + distance
    );
    
    // Point camera at center
    controls.target.set(centerX, centerY, centerZ);
    controls.update();
    
    console.log(`Fit to view: center=(${centerX.toFixed(1)}, ${centerY.toFixed(1)}, ${centerZ.toFixed(1)}), size=${maxSize.toFixed(1)}`);
}

// =====================================================
// MOBILE MENU TOGGLE
// =====================================================

function setupMobileToggle() {
    const toggleBtn = document.getElementById('mobile-menu-toggle');
    const controlsPanel = document.getElementById('controls-panel');
    
    if (!toggleBtn || !controlsPanel) return;
    
    toggleBtn.addEventListener('click', () => {
        const isOpen = controlsPanel.classList.toggle('mobile-visible');
        toggleBtn.classList.toggle('menu-open', isOpen);
        
        // Update icon
        const icon = toggleBtn.querySelector('.toggle-icon');
        if (icon) {
            icon.textContent = isOpen ? '✕' : '☰';
        }
    });
    
    // Close menu when clicking outside (on the overlay)
    controlsPanel.addEventListener('click', (e) => {
        // If clicking on the overlay area (pseudo-element creates this effect)
        // Check if the click is outside the actual panel content
        const rect = controlsPanel.getBoundingClientRect();
        if (e.clientX < rect.left) {
            controlsPanel.classList.remove('mobile-visible');
            toggleBtn.classList.remove('menu-open');
            const icon = toggleBtn.querySelector('.toggle-icon');
            if (icon) icon.textContent = '☰';
        }
    });
    
    // Close menu when selecting a graph template on mobile
    if (window.innerWidth <= 768) {
        const templateSelect = document.getElementById('graph-template');
        if (templateSelect) {
            templateSelect.addEventListener('change', () => {
                // Auto-close menu after selecting a template
                setTimeout(() => {
                    controlsPanel.classList.remove('mobile-visible');
                    toggleBtn.classList.remove('menu-open');
                    const icon = toggleBtn.querySelector('.toggle-icon');
                    if (icon) icon.textContent = '☰';
                }, 500);
            });
        }
    }
}

// =====================================================
// PROJECTION BUTTONS (Edit Tab)
// =====================================================

function setupProjectionButtons() {
    const buttons = [
        { el: projectXYBtn, proj: 'xy', label: 'XY' },
        { el: projectXZBtn, proj: 'xz', label: 'XZ' },
        { el: projectYZBtn, proj: 'yz', label: 'YZ' },
        { el: project3DBtn, proj: '3d', label: '3D' }
    ];
    
    buttons.forEach(({ el, proj }) => {
        if (el) {
            el.addEventListener('click', () => {
                // Update active state
                [projectXYBtn, projectXZBtn, projectYZBtn, project3DBtn].forEach(btn => {
                    if (btn) btn.classList.remove('active');
                });
                el.classList.add('active');
                
                // Set camera projection (this also handles grid updates)
                setCameraProjection(proj);
                
                // If in add-vertex mode and switching to 3D, show warning
                if (currentEditMode === 'add-vertex' && proj === '3d') {
                    console.log('[PROJECTION] Grid hidden in 3D mode - switch to Top/Front/Side to place nodes on grid');
                }
            });
        }
    });
    
    console.log('[PROJECTION] Edit tab projection buttons initialized');
}

// =====================================================
// PROJECTION BUTTONS (Universe)
// =====================================================

function setupUniverseProjectionButtons() {
    const buttons = [
        { el: universeProjectXYBtn, proj: 'xy', label: 'XY' },
        { el: universeProjectXZBtn, proj: 'xz', label: 'XZ' },
        { el: universeProjectYZBtn, proj: 'yz', label: 'YZ' },
        { el: universeProject3DBtn, proj: '3d', label: '3D' }
    ];
    
    buttons.forEach(({ el, proj }) => {
        if (el) {
            el.addEventListener('click', async () => {
                // Update active state
                [universeProjectXYBtn, universeProjectXZBtn, universeProjectYZBtn, universeProject3DBtn].forEach(btn => {
                    if (btn) btn.classList.remove('active');
                });
                el.classList.add('active');
                
                // Set universe camera projection
                if (universeModule) {
                    universeModule.setUniverseCameraProjection(proj);
                } else {
                    console.warn('[PROJECTION] Universe module not loaded');
                }
            });
        }
    });
    
    console.log('[PROJECTION] Universe projection buttons initialized');
}

// =====================================================
// LIBRARY TAB
// =====================================================

function setupLibraryEventListeners() {
    // Initialize library UI
    updateLibraryUI();
    
    // Universe view toggle handlers
    if (libraryViewTableBtn) {
        libraryViewTableBtn.addEventListener('click', () => {
            switchToTableView();
        });
    }
    
    if (libraryViewUniverseBtn) {
        libraryViewUniverseBtn.addEventListener('click', async () => {
            await switchToUniverseView();
        });
    }
    
    // Universe navigation controls
    if (universeGalaxyJump) {
        universeGalaxyJump.addEventListener('change', () => {
            const family = universeGalaxyJump.value;
            if (family && universeModule) {
                universeModule.navigateToGalaxy(family);
            }
        });
    }
    
    if (universeResetView) {
        universeResetView.addEventListener('click', () => {
            if (universeModule) {
                // Reset camera to starting position
                const state = universeModule.getUniverseState();
                if (state && state.cameraPosition) {
                    universeModule.navigateToGalaxy(null); // Reset to origin
                }
                // Reset projection buttons to 3D
                [universeProjectXYBtn, universeProjectXZBtn, universeProjectYZBtn, universeProject3DBtn].forEach(btn => {
                    if (btn) btn.classList.remove('active');
                });
                if (universeProject3DBtn) universeProject3DBtn.classList.add('active');
            }
        });
    }
    
    if (universeZoomFit) {
        universeZoomFit.addEventListener('click', () => {
            // Zoom out to see all galaxies
            if (universeModule) {
                universeModule.zoomToFitAll();
            }
        });
    }
    
    // Universe projection buttons
    setupUniverseProjectionButtons();
    
    // Search and filter handlers
    if (librarySearch) {
        librarySearch.addEventListener('input', debounce(() => {
            updateLibraryTable();
        }, 300));
    }
    
    if (libraryFilterN) {
        libraryFilterN.addEventListener('change', updateLibraryTable);
    }
    
    if (libraryFilterFamily) {
        libraryFilterFamily.addEventListener('change', updateLibraryTable);
    }
    
    if (librarySort) {
        librarySort.addEventListener('change', updateLibraryTable);
    }
    
    // Select all checkbox
    if (librarySelectAll) {
        librarySelectAll.addEventListener('change', () => {
            const checkboxes = libraryTableBody.querySelectorAll('input[type="checkbox"]');
            checkboxes.forEach(cb => cb.checked = librarySelectAll.checked);
            updateLibraryActionButtons();
        });
    }
    
    // Load selected button
    if (libraryLoadSelected) {
        libraryLoadSelected.addEventListener('click', loadSelectedFromLibrary);
    }
    
    // Delete selected button
    if (libraryDeleteSelected) {
        libraryDeleteSelected.addEventListener('click', deleteSelectedFromLibrary);
    }
    
    // Export JSON
    if (libraryExportJSON) {
        libraryExportJSON.addEventListener('click', () => {
            const selected = getSelectedLibraryIds();
            if (selected.length > 0) {
                // Export only selected
                const graphs = selected.map(id => getGraphById(id)).filter(Boolean);
                const json = JSON.stringify({
                    exportVersion: 1,
                    exportDate: new Date().toISOString(),
                    type: 'collection',
                    graphs
                }, null, 2);
                downloadFileFromContent(json, `selected-graphs-${selected.length}.json`, 'application/json');
                showLibraryToast(`Exported ${selected.length} graph(s)`, 'success');
            } else {
                // Export entire library
                downloadLibraryJSON();
                showLibraryToast('Exported entire library', 'success');
            }
        });
    }
    
    // Export HTML
    if (libraryExportHTML) {
        libraryExportHTML.addEventListener('click', () => {
            const selected = getSelectedLibraryIds();
            if (selected.length === 1) {
                downloadGraphHTML(selected[0]);
                showLibraryToast('Exported graph as HTML', 'success');
            } else {
                downloadLibrarySummaryHTML();
                showLibraryToast('Exported library summary', 'success');
            }
        });
    }
    
    // Import JSON
    if (libraryImportBtn && libraryImportFile) {
        libraryImportBtn.addEventListener('click', () => {
            libraryImportFile.click();
        });
        
        libraryImportFile.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (!file) return;
            
            try {
                const text = await file.text();
                const result = importFromJSON(text);
                
                if (result.success) {
                    showLibraryToast(`Imported ${result.imported} graph(s), ${result.duplicates} duplicates skipped`, 'success');
                    updateLibraryUI();
                    
                    // Refresh Universe if it's active (use forceRefresh=true)
                    if (universeInitialized && universeModule) {
                        const state = universeModule.getUniverseState();
                        if (state.active) {
                            console.log('Refreshing Universe with imported library graphs...');
                            await switchToUniverseView(true);  // Force refresh
                        }
                    }
                } else {
                    showLibraryToast('Import failed: ' + result.error, 'error');
                }
            } catch (err) {
                showLibraryToast('Import error: ' + err.message, 'error');
            }
            
            // Reset file input
            libraryImportFile.value = '';
        });
    }
    
    // Clear all
    if (libraryClearAll) {
        libraryClearAll.addEventListener('click', () => {
            const stats = getLibraryStats();
            if (stats.total === 0) {
                showLibraryToast('Library is already empty', 'info');
                return;
            }
            
            if (confirm(`Are you sure you want to delete all ${stats.total} graphs from the library?\n\nThis cannot be undone!`)) {
                clearLibrary();
                updateLibraryUI();
                showLibraryToast('Library cleared', 'success');
            }
        });
    }
    
    // Add to library from finder
    if (addToLibraryBtn) {
        addToLibraryBtn.addEventListener('click', () => {
            const idx = analyticGraphSelect.value;
            if (idx === '' || discoveredGraphs.length === 0) {
                showLibraryToast('Please select a graph first', 'error');
                return;
            }
            
            const graph = discoveredGraphs[parseInt(idx)];
            if (!graph) return;
            
            const result = addToLibrary(graph, {
                source: 'search',
                searchParams: { n: graph.n }
            });
            
            if (result.success) {
                showLibraryToast(`Added "${result.graph.name}" to library`, 'success');
                updateLibraryUI();
            } else if (result.reason === 'duplicate') {
                showLibraryToast('Graph already in library', 'info');
            }
        });
    }
    
    // Add all to library from finder
    if (addAllToLibraryBtn) {
        addAllToLibraryBtn.addEventListener('click', () => {
            if (discoveredGraphs.length === 0) {
                showLibraryToast('No graphs to add', 'error');
                return;
            }
            
            const n = finderVerticesInput ? parseInt(finderVerticesInput.value) : 5;
            const result = addSearchResultsToLibrary(discoveredGraphs, { n });
            
            showLibraryToast(`Added ${result.added} graph(s), ${result.duplicates} duplicates`, 'success');
            updateLibraryUI();
        });
    }
}

/**
 * Update entire library UI
 */
function updateLibraryUI() {
    updateLibraryStats();
    updateLibraryFilters();
    updateLibraryTable();
    updateProductGraphLibraryOptions();
}

/**
 * Update library statistics display
 */
function updateLibraryStats() {
    const stats = getLibraryStats();
    
    if (libTotalDisplay) {
        libTotalDisplay.textContent = stats.total;
    }
    
    if (libFamiliesDisplay) {
        libFamiliesDisplay.textContent = Object.keys(stats.byFamily).length;
    }
}

/**
 * Update filter dropdowns
 */
function updateLibraryFilters() {
    const stats = getLibraryStats();
    
    // Update vertex count filter
    if (libraryFilterN) {
        const currentValue = libraryFilterN.value;
        libraryFilterN.innerHTML = '<option value="">All</option>';
        
        const nValues = Object.keys(stats.byVertexCount).map(Number).sort((a, b) => a - b);
        for (const n of nValues) {
            const count = stats.byVertexCount[n];
            const option = document.createElement('option');
            option.value = n;
            option.textContent = `n=${n} (${count})`;
            libraryFilterN.appendChild(option);
        }
        
        libraryFilterN.value = currentValue;
    }
    
    // Update family filter
    if (libraryFilterFamily) {
        const currentValue = libraryFilterFamily.value;
        libraryFilterFamily.innerHTML = '<option value="">All</option>';
        
        const families = Object.keys(stats.byFamily).sort();
        for (const family of families) {
            const count = stats.byFamily[family];
            const option = document.createElement('option');
            option.value = family;
            option.textContent = `${family} (${count})`;
            libraryFilterFamily.appendChild(option);
        }
        
        libraryFilterFamily.value = currentValue;
    }
}

/**
 * Update library table display
 */
function updateLibraryTable() {
    if (!libraryTableBody) return;
    
    // Get filter values
    const filters = {};
    if (librarySearch && librarySearch.value) {
        filters.query = librarySearch.value;
    }
    if (libraryFilterN && libraryFilterN.value) {
        filters.n = parseInt(libraryFilterN.value);
    }
    if (libraryFilterFamily && libraryFilterFamily.value) {
        filters.family = libraryFilterFamily.value;
    }
    
    // Get sort values
    let sortBy = 'dateAdded';
    let sortOrder = 'desc';
    if (librarySort && librarySort.value) {
        const [field, order] = librarySort.value.split('-');
        sortBy = field;
        sortOrder = order;
    }
    
    // Get filtered and sorted graphs
    let graphs = filterGraphs(filters);
    graphs = sortGraphs(graphs, sortBy, sortOrder);
    
    // Clear table
    libraryTableBody.innerHTML = '';
    
    // Show empty state if needed
    if (libraryEmpty) {
        libraryEmpty.style.display = graphs.length === 0 ? 'block' : 'none';
    }
    
    // Populate table
    for (const graph of graphs) {
        const row = createLibraryTableRow(graph);
        libraryTableBody.appendChild(row);
    }
    
    // Update action buttons
    updateLibraryActionButtons();
}

/**
 * Create a table row for a library graph
 */
function createLibraryTableRow(graph) {
    const row = document.createElement('tr');
    row.dataset.graphId = graph.id;
    
    // Checkbox cell
    const checkboxCell = document.createElement('td');
    checkboxCell.className = 'col-select';
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.addEventListener('change', () => {
        row.classList.toggle('selected', checkbox.checked);
        updateLibraryActionButtons();
    });
    checkboxCell.appendChild(checkbox);
    row.appendChild(checkboxCell);
    
    // Name cell
    const nameCell = document.createElement('td');
    nameCell.className = 'col-name';
    const nameDiv = document.createElement('div');
    nameDiv.className = 'graph-name-cell';
    
    const nameSpan = document.createElement('span');
    nameSpan.className = 'graph-name';
    nameSpan.textContent = graph.name;
    nameDiv.appendChild(nameSpan);
    
    if (graph.family && graph.family !== graph.name) {
        const familySpan = document.createElement('span');
        familySpan.className = 'graph-family';
        familySpan.textContent = graph.family;
        nameDiv.appendChild(familySpan);
    }
    
    nameCell.appendChild(nameDiv);
    row.appendChild(nameCell);
    
    // Vertex count cell
    const nCell = document.createElement('td');
    nCell.className = 'col-n';
    nCell.textContent = graph.n;
    row.appendChild(nCell);
    
    // Edge count cell
    const edgeCell = document.createElement('td');
    edgeCell.className = 'col-edges';
    edgeCell.textContent = graph.edgeCount;
    row.appendChild(edgeCell);
    
    // Actions cell
    const actionsCell = document.createElement('td');
    actionsCell.className = 'col-actions';
    
    // Load button
    const loadBtn = document.createElement('button');
    loadBtn.className = 'table-action-btn load-btn';
    loadBtn.innerHTML = '▶';
    loadBtn.title = 'Load this graph';
    loadBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        loadGraphFromLibrary(graph.id);
    });
    actionsCell.appendChild(loadBtn);
    
    // Export button
    const exportBtn = document.createElement('button');
    exportBtn.className = 'table-action-btn export-btn';
    exportBtn.innerHTML = '📥';
    exportBtn.title = 'Export as JSON';
    exportBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        downloadGraphJSON(graph.id);
        showLibraryToast('Exported graph', 'success');
    });
    actionsCell.appendChild(exportBtn);
    
    // Delete button
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'table-action-btn delete-btn';
    deleteBtn.innerHTML = '✕';
    deleteBtn.title = 'Remove from library';
    deleteBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (confirm(`Remove "${graph.name}" from library?`)) {
            removeFromLibrary(graph.id);
            updateLibraryUI();
            showLibraryToast('Removed from library', 'success');
        }
    });
    actionsCell.appendChild(deleteBtn);
    
    row.appendChild(actionsCell);
    
    // Row click to toggle selection
    row.addEventListener('click', (e) => {
        if (e.target.type !== 'checkbox' && !e.target.closest('button')) {
            checkbox.checked = !checkbox.checked;
            row.classList.toggle('selected', checkbox.checked);
            updateLibraryActionButtons();
        }
    });
    
    return row;
}

/**
 * Update action button states
 */
function updateLibraryActionButtons() {
    const selected = getSelectedLibraryIds();
    
    if (libraryLoadSelected) {
        libraryLoadSelected.disabled = selected.length !== 1;
        libraryLoadSelected.textContent = selected.length === 1 ? 'Load Selected' : 'Load (select 1)';
    }
    
    if (libraryDeleteSelected) {
        libraryDeleteSelected.disabled = selected.length === 0;
        libraryDeleteSelected.textContent = selected.length > 0 ? `Delete (${selected.length})` : 'Delete';
    }
}

/**
 * Get IDs of selected library items
 */
function getSelectedLibraryIds() {
    if (!libraryTableBody) return [];
    
    const selected = [];
    const checkboxes = libraryTableBody.querySelectorAll('input[type="checkbox"]:checked');
    checkboxes.forEach(cb => {
        const row = cb.closest('tr');
        if (row && row.dataset.graphId) {
            selected.push(row.dataset.graphId);
        }
    });
    
    return selected;
}

/**
 * Load a graph from library into visualization
 */
function loadGraphFromLibrary(graphId) {
    const graph = getGraphById(graphId);
    if (!graph) {
        showLibraryToast('Graph not found', 'error');
        return;
    }
    
    // Convert library format to finder result format
    const finderGraph = {
        n: graph.n,
        edges: graph.edges,
        edgeCount: graph.edgeCount,
        eigenvalues: graph.eigenvalues,
        family: graph.family
    };
    
    // Get layout type
    const layoutType = finderLayoutSelect ? finderLayoutSelect.value : 'circle';
    
    // Load the graph
    const result = loadGraphFromResult(finderGraph, layoutType);
    
    if (result) {
        if (numVerticesInput) numVerticesInput.value = graph.n;
        if (templateSelect) templateSelect.value = 'custom';
        updateStats();
        updatePhaseNodeSelectors();
        invalidateCaches();
        onGraphChanged();
        setTimeout(() => showAnalysis(), 100);
        showLibraryToast(`Loaded "${graph.name}"`, 'success');
    } else {
        showLibraryToast('Failed to load graph', 'error');
    }
}

/**
 * Load selected graph from library
 */
function loadSelectedFromLibrary() {
    const selected = getSelectedLibraryIds();
    if (selected.length === 1) {
        loadGraphFromLibrary(selected[0]);
    }
}

/**
 * Delete selected graphs from library
 */
function deleteSelectedFromLibrary() {
    const selected = getSelectedLibraryIds();
    if (selected.length === 0) return;
    
    if (confirm(`Delete ${selected.length} graph(s) from library?`)) {
        for (const id of selected) {
            removeFromLibrary(id);
        }
        updateLibraryUI();
        showLibraryToast(`Deleted ${selected.length} graph(s)`, 'success');
    }
}

/**
 * Update product graph library options
 */
function updateProductGraphLibraryOptions() {
    const graphs = getAllGraphs();
    
    // Update Graph A library group
    if (productALibraryGroup) {
        productALibraryGroup.innerHTML = '';
        for (const g of graphs) {
            const option = document.createElement('option');
            option.value = `lib:${g.id}`;
            option.textContent = `${g.name} (n=${g.n})`;
            productALibraryGroup.appendChild(option);
        }
    }
    
    // Update Graph B library group
    if (productBLibraryGroup) {
        productBLibraryGroup.innerHTML = '';
        for (const g of graphs) {
            const option = document.createElement('option');
            option.value = `lib:${g.id}`;
            option.textContent = `${g.name} (n=${g.n})`;
            productBLibraryGroup.appendChild(option);
        }
    }
}

/**
 * Show toast notification
 */
// =====================================================
// UNIVERSE VIEW MANAGEMENT
// =====================================================

let universeModule = null;
let universeInitialized = false;
let currentView = 'table';  // 'table' or 'universe'

/**
 * Lazy load the universe module
 */
async function loadUniverseModule() {
    if (universeModule) return universeModule;
    
    try {
        universeModule = await import('./graph-universe.js');
        console.log('Universe module loaded');
        return universeModule;
    } catch (e) {
        console.error('Failed to load universe module:', e);
        showLibraryToast('Failed to load Universe view: ' + e.message, 'error');
        return null;
    }
}

/**
 * Switch to table view
 */
function switchToTableView() {
    if (currentView === 'table') return;
    
    // IMPORTANT: Save Universe graphs to Library before stopping
    if (universeModule) {
        saveUniverseGraphsToLibrary();
    }
    
    currentView = 'table';
    
    // Update toggle buttons
    if (libraryViewTableBtn) libraryViewTableBtn.classList.add('active');
    if (libraryViewUniverseBtn) libraryViewUniverseBtn.classList.remove('active');
    
    // Hide universe nav controls
    if (universeNavControls) universeNavControls.style.display = 'none';
    
    // Stop universe (but graphs are now saved)
    if (universeModule) {
        universeModule.stopUniverse();
    }
    
    // Hide universe container
    if (universeContainer) {
        universeContainer.style.display = 'none';
    }
    
    // Show main 3D container
    if (container) {
        container.style.display = 'block';
    }
    
    // Refresh table to show any newly added graphs
    updateLibraryUI();
    
    console.log('Switched to table view (graphs preserved)');
}

/**
 * Save all graphs from Universe to Library (avoiding duplicates)
 */
function saveUniverseGraphsToLibrary() {
    if (!universeModule) return;
    
    const universeState = universeModule.getUniverseState();
    if (!universeState.graphNodes || universeState.graphNodes.size === 0) {
        console.log('[Library] No Universe graphs to save');
        return;
    }
    
    let added = 0;
    let duplicates = 0;
    
    universeState.graphNodes.forEach((nodeData, graphId) => {
        const graphData = nodeData.data;
        if (!graphData || !graphData.edges) return;
        
        // Try to add to library (handles deduplication internally)
        const result = addToLibrary(graphData, {
            name: graphData.name || graphData.family || `Graph ${graphData.n}`,
            source: 'universe',
            tags: graphData.isPhysicallyRealizable ? ['physically-realizable'] : []
        });
        
        if (result.success) {
            added++;
        } else if (result.reason === 'duplicate') {
            duplicates++;
        }
    });
    
    console.log(`[Library] Saved Universe graphs: ${added} added, ${duplicates} duplicates skipped`);
    
    if (added > 0) {
        showLibraryToast(`Saved ${added} graphs from Universe to Library`, 'success');
    }
}

/**
 * Switch to universe view
 * @param {boolean} forceRefresh - If true, refresh even if already in universe view
 */
async function switchToUniverseView(forceRefresh = false) {
    // Skip view switch logic if already in universe, but still refresh if requested
    const alreadyInUniverse = (currentView === 'universe');
    
    if (alreadyInUniverse && !forceRefresh) return;
    
    // Load module if not loaded
    const module = await loadUniverseModule();
    if (!module) {
        showLibraryToast('Universe module not available', 'error');
        return;
    }
    
    // Only do view switching if not already in universe
    if (!alreadyInUniverse) {
        currentView = 'universe';
        
        // Update toggle buttons
        if (libraryViewTableBtn) libraryViewTableBtn.classList.remove('active');
        if (libraryViewUniverseBtn) libraryViewUniverseBtn.classList.add('active');
        
        // Show universe nav controls
        if (universeNavControls) universeNavControls.style.display = 'block';
        
        // Hide main 3D container
        if (container) {
            container.style.display = 'none';
        }
        
        // Show universe container
        if (universeContainer) {
            universeContainer.style.display = 'block';
        }
    }
    
    // Initialize universe if needed
    if (!universeInitialized) {
        try {
            module.initUniverse(universeContainer);
            
            // Set up callback for graph selection (double-click)
            module.setOnGraphSelect((graphData) => {
                loadGraphFromLibraryData(graphData);
                switchToTableView();
                showLibraryToast(`Loaded "${graphData.name}" from Universe`, 'success');
            });
            
            // Set up callback for "Load in Build" button
            module.setOnLoadInBuild((graphData) => {
                // Load graph in Build tab
                loadGraphFromLibraryData(graphData);
                
                // Exit Universe view and switch to Build tab
                module.stopUniverse();
                switchToTableView();
                
                // Switch to BUILD tab
                const buildTab = document.querySelector('[data-tab="build"]');
                if (buildTab) {
                    buildTab.click();
                }
                
                showLibraryToast(`Loaded "${graphData.name || graphData.family}" in Build tab`, 'success');
            });
            
            universeInitialized = true;
            
            // Expose verification function to global scope for console testing
            window.verifySpectralPositioning = module.verifySpectralPositioning;
            console.log('✓ verifySpectralPositioning() available in console');
            
            // Expose export function
            window.exportUniverseTable = module.exportUniverseTable;
            console.log('✓ exportUniverseTable() available in console');
            
            // Expose expand/collapse function
            window.expandCollapseAll = module.expandCollapseAll;
            console.log('✓ expandCollapseAll(expand, galaxyFilter) available in console');
            
            // Expose debug function to find graphs without edges
            window.getGraphsWithoutEdges = module.getGraphsWithoutEdges;
            console.log('✓ getGraphsWithoutEdges() available in console');
        } catch (e) {
            console.error('Failed to initialize universe:', e);
            showLibraryToast('Failed to initialize Universe: ' + e.message, 'error');
            switchToTableView();
            return;
        }
    }
    
    // Backup custom graphs before repopulating
    let customGraphsBackup = [];
    if (universeInitialized && module.getUniverseState) {
        const state = module.getUniverseState();
        console.log(`Backup check: graphNodes size = ${state.graphNodes?.size || 0}`);
        if (state.graphNodes) {
            state.graphNodes.forEach((nodeData, graphId) => {
                console.log(`  Checking node ${graphId}: isCustom=${nodeData.mesh?.userData?.isCustom}`);
                if (nodeData.mesh?.userData?.isCustom) {
                    const data = nodeData.data;
                    console.log(`  Backing up custom graph: "${data.name}", family="${data.family}"`);
                    customGraphsBackup.push({
                        data: {
                            n: data.n,
                            edges: data.edges,
                            edgeCount: data.edgeCount,
                            name: data.name,
                            family: data.family,
                            eigenvalues: data.eigenvalues,
                            spectralRadius: data.spectralRadius,
                            analyticalRho: data.analyticalRho,
                            expectedAlpha: data.expectedAlpha
                        },
                        expanded: nodeData.expanded === true
                    });
                }
            });
        }
    }
    console.log(`Total custom graphs backed up: ${customGraphsBackup.length}`);
    
    // Populate with current library graphs
    const graphs = getAllGraphs();
    module.populateUniverse(graphs);
    
    // Restore custom graphs
    if (customGraphsBackup.length > 0) {
        console.log(`Restoring ${customGraphsBackup.length} custom graphs after library reload`);
        for (const customGraph of customGraphsBackup) {
            module.addCustomGraph(customGraph.data, customGraph.expanded);
        }
    }
    
    // Populate galaxy jump dropdown
    populateGalaxyDropdown(graphs);
    
    // Start rendering
    module.startUniverse();
    
    console.log(`${alreadyInUniverse ? 'Refreshed' : 'Switched to'} universe view with ${graphs.length} library graphs${customGraphsBackup.length > 0 ? ` + ${customGraphsBackup.length} custom graphs` : ''}`);
}

/**
 * Populate the galaxy jump dropdown
 */
function populateGalaxyDropdown(graphs) {
    if (!universeGalaxyJump) return;
    
    // Clear existing options
    universeGalaxyJump.innerHTML = '<option value="">-- Select Galaxy --</option>';
    
    // Galaxy name mapping - MUST match GALAXY_FAMILIES in graph-universe.js
    const galaxyNames = {
        'Path': 'The Cascades',
        'Cycle': 'The Vortexes',
        'Star': 'The Constellations',
        'Complete': 'The Nexus',
        'Complete Bipartite': 'The Duality',
        'Wheel': 'The Spinners',
        'Grid': 'The Lattices',
        'Ladder': 'The Rungs',
        'Prism': 'The Prisms',
        'Hypercube': 'The Tesseracts',
        'Tree': 'The Branches',
        'Binary Tree': 'The Binaries',
        'Empty': 'The Void',
        'Petersen': 'The Petersen',
        'Möbius': 'The Möbius',
        'Circulant': 'The Circulants',
        'Bipartite': 'The Bipartites',
        'Cartesian Product': 'The Products',
        'Tensor Product': 'The Tensors',
        'Line Graph': 'The Lines',
        'Complement': 'The Complements',
        'Unknown': 'The Nebulae'
    };
    
    // Helper to extract family base - MUST match groupGraphsByFamily in graph-universe.js
    function getFamilyBase(family) {
        if (!family) return 'Unknown';
        
        // Check for Cartesian products first (contains □)
        if (family.includes('□')) return 'Cartesian Product';
        // Check for tensor products (contains ×)
        if (family.includes('×') || family.includes('⊗')) return 'Tensor Product';
        // Check for line graphs
        if (family.startsWith('Line(') || family.includes('Line Graph')) return 'Line Graph';
        // Check for complement graphs
        if (family.includes('Complement') || family.includes('complement')) return 'Complement';
        
        // Standard family extraction
        const parts = family.split(' ');
        let familyBase = parts[0];
        
        // Handle special cases
        if (familyBase === 'Complete' && family.includes('Bipartite')) {
            familyBase = 'Complete Bipartite';
        } else if (familyBase === 'Binary') {
            familyBase = 'Binary Tree';
        }
        
        // If not a known family, return Unknown
        if (!galaxyNames[familyBase]) {
            return 'Unknown';
        }
        
        return familyBase;
    }
    
    // Get unique families with proper detection
    const families = new Map();
    for (const graph of graphs) {
        const familyBase = getFamilyBase(graph.family);
        if (!families.has(familyBase)) {
            families.set(familyBase, 0);
        }
        families.set(familyBase, families.get(familyBase) + 1);
    }
    
    // Add options sorted by galaxy name
    const sortedFamilies = [...families].sort((a, b) => {
        const nameA = galaxyNames[a[0]] || a[0];
        const nameB = galaxyNames[b[0]] || b[0];
        return nameA.localeCompare(nameB);
    });
    
    for (const [family, count] of sortedFamilies) {
        const option = document.createElement('option');
        option.value = family;
        const galaxyName = galaxyNames[family] || family;
        option.textContent = `${galaxyName} (${count})`;
        universeGalaxyJump.appendChild(option);
    }
}

/**
 * Load a graph from library data
 */
function loadGraphFromLibraryData(graphData) {
    if (!graphData || !graphData.edges) return;
    
    // Clear current graph
    clearGraph();
    
    const n = graphData.n;
    const radius = parseFloat(radiusInput?.value) || 40;
    
    // CRITICAL: Initialize adjacency matrices before creating vertices/edges
    state.adjacencyMatrix = Array(n).fill(null).map(() => Array(n).fill(0));
    state.symmetricAdjMatrix = Array(n).fill(null).map(() => Array(n).fill(0));
    
    // Generate positions
    let positions = getCirclePositions(n, radius);
    
    // Create vertices
    for (let i = 0; i < n; i++) {
        createVertex(positions[i], i);
    }
    
    // Update vertex count input
    if (numVerticesInput) {
        numVerticesInput.value = n;
    }
    
    // Add edges
    for (const [i, j] of graphData.edges) {
        addEdge(i, j);
    }
    
    updateAllEdges();
    updateVertexLabels();
    updateStats();
    onGraphChanged();
    
    // Switch to build tab
    const buildTab = document.querySelector('[data-tab="build"]');
    if (buildTab) {
        buildTab.click();
    }
}

function showLibraryToast(message, type = 'info') {
    // Remove existing toast
    const existingToast = document.querySelector('.library-toast');
    if (existingToast) {
        existingToast.remove();
    }
    
    // Create new toast
    const toast = document.createElement('div');
    toast.className = `library-toast ${type} show`;
    toast.textContent = message;
    document.body.appendChild(toast);
    
    // Auto-hide after 3 seconds
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

/**
 * Download helper for arbitrary content
 */
function downloadFileFromContent(content, filename, mimeType = 'application/json') {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

/**
 * Debounce utility
 */
function debounce(fn, delay) {
    let timeout;
    return function(...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => fn.apply(this, args), delay);
    };
}

// =====================================================
// UNIVERSE INTEGRATION
// =====================================================

/**
 * Get current graph data from Build tab
 */
function getCurrentGraphData() {
    const n = state.vertexMeshes.length;
    if (n === 0) return null;
    
    // Extract edges from symmetric adjacency matrix (for undirected representation)
    const edges = [];
    for (let i = 0; i < n; i++) {
        for (let j = i + 1; j < n; j++) {
            if (state.symmetricAdjMatrix[i] && state.symmetricAdjMatrix[i][j] === 1) {
                edges.push([i, j]);
            }
        }
    }
    
    // Also extract directed edges with orientation (for skew-symmetric eigenvalues)
    // This preserves the actual edge orientations from the adjacency matrix
    const directedEdges = [];
    for (let i = 0; i < n; i++) {
        for (let j = 0; j < n; j++) {
            if (state.adjacencyMatrix[i] && state.adjacencyMatrix[i][j] === 1) {
                directedEdges.push([i, j]);  // i → j (positive direction)
            }
        }
    }
    
    // Get custom name or generate one
    const customName = universeGraphNameInput?.value?.trim() || '';
    const name = customName || `Graph G(${n}, ${edges.length})`;
    
    // Try to compute eigenvalues
    let eigenvalues = [];
    try {
        const matrix = state.symmetricAdjMatrix;
        if (matrix && matrix.length > 0 && typeof computeEigenvalues !== 'undefined') {
            eigenvalues = computeEigenvalues(matrix);
        }
    } catch (e) {
        console.warn('Could not compute eigenvalues:', e);
    }
    
    return {
        n,
        edges,
        directedEdges,  // NEW: includes orientation information
        edgeCount: edges.length,
        name,
        family: 'Custom',
        eigenvalues,
        timestamp: Date.now()
    };
}

/**
 * Send current graph to Universe for visualization
 */
async function sendCurrentGraphToUniverse() {
    const graphData = getCurrentGraphData();
    
    if (!graphData || graphData.n === 0) {
        showLibraryToast('No graph to send! Create a graph first.', 'error');
        return;
    }
    
    // Make sure universe module is loaded
    if (!universeModule) {
        try {
            universeModule = await import('./graph-universe.js');
        } catch (e) {
            showLibraryToast('Failed to load Universe module: ' + e.message, 'error');
            return;
        }
    }
    
    // Check if universe is active, if not switch to it
    const universeState = universeModule.getUniverseState();
    if (!universeState.active) {
        // Switch to Library tab and Universe view
        const libraryTab = document.querySelector('[data-tab="library"]');
        if (libraryTab) {
            libraryTab.click();
        }
        
        // Wait a bit for tab switch, then switch to universe
        await new Promise(resolve => setTimeout(resolve, 100));
        await switchToUniverseView();
        await new Promise(resolve => setTimeout(resolve, 200));
    }
    
    // Add the graph to Universe
    const graphId = universeModule.addCustomGraph(graphData, true);
    
    if (graphId) {
        showLibraryToast(`"${graphData.name}" sent to Universe!`, 'success');
        
        // If we're not in universe view, offer to switch
        if (!document.getElementById('universe-container')?.style.display !== 'none') {
            const libraryTab = document.querySelector('[data-tab="library"]');
            if (libraryTab) {
                libraryTab.click();
            }
        }
    } else {
        showLibraryToast('Failed to add graph to Universe', 'error');
    }
}

/**
 * Save current graph to library
 */
function saveCurrentGraphToLibrary() {
    const graphData = getCurrentGraphData();
    
    console.log('[LIBRARY] Attempting to save graph:', graphData?.name);
    
    if (!graphData || graphData.n === 0) {
        showLibraryToast('No graph to save! Create a graph first.', 'error');
        return;
    }
    
    // Store in the analytic graphs library
    try {
        // Get existing library from localStorage
        const libraryKey = 'graphLibrary_custom';
        let customLibrary = [];
        
        try {
            const stored = localStorage.getItem(libraryKey);
            if (stored) {
                customLibrary = JSON.parse(stored);
                console.log('[LIBRARY] Found existing library with', customLibrary.length, 'graphs');
            }
        } catch (e) {
            console.warn('[LIBRARY] Could not parse existing library:', e);
            customLibrary = [];
        }
        
        // Check for duplicates by name
        const existingIndex = customLibrary.findIndex(g => g.name === graphData.name);
        if (existingIndex >= 0) {
            if (!confirm(`A graph named "${graphData.name}" already exists. Replace it?`)) {
                return;
            }
            customLibrary[existingIndex] = graphData;
            console.log('[LIBRARY] Replacing existing graph at index', existingIndex);
        } else {
            customLibrary.push(graphData);
            console.log('[LIBRARY] Adding new graph, library now has', customLibrary.length, 'graphs');
        }
        
        // Save back to localStorage
        localStorage.setItem(libraryKey, JSON.stringify(customLibrary));
        console.log('[LIBRARY] Saved to localStorage');
        
        // Also add to the current session's graph library (in-memory)
        try {
            addToLibrary(graphData);
            console.log('[LIBRARY] Added to in-memory library');
        } catch (e) {
            console.warn('[LIBRARY] Could not add to in-memory library:', e);
        }
        
        showLibraryToast(`"${graphData.name}" saved to library!`, 'success');
        
        // Refresh library UI
        updateLibraryUI();
        console.log('[LIBRARY] Updated library UI');
        
    } catch (e) {
        console.error('[LIBRARY] Failed to save to library:', e);
        showLibraryToast('Failed to save: ' + e.message, 'error');
    }
}

/**
 * Load custom graphs from localStorage into the library
 */
function loadCustomGraphsFromStorage() {
    try {
        const stored = localStorage.getItem('graphLibrary_custom');
        if (stored) {
            const customGraphs = JSON.parse(stored);
            console.log(`[LIBRARY] Loaded ${customGraphs.length} custom graphs from storage`);
            return customGraphs;
        }
    } catch (e) {
        console.warn('[LIBRARY] Could not load custom graphs:', e);
    }
    return [];
}

/**
 * Load custom graphs from localStorage and add them to the in-memory library
 */
function loadAndAddCustomGraphs() {
    const customGraphs = loadCustomGraphsFromStorage();
    if (customGraphs.length > 0) {
        for (const graph of customGraphs) {
            try {
                addToLibrary(graph);
            } catch (e) {
                console.warn('[LIBRARY] Could not add custom graph:', graph.name, e);
            }
        }
        console.log(`[LIBRARY] Added ${customGraphs.length} custom graphs to in-memory library`);
        updateLibraryUI();
    }
}

/**
 * Export full library including custom graphs
 */
function exportFullLibrary() {
    const allGraphs = getAllGraphs();
    const customGraphs = loadCustomGraphsFromStorage();
    
    const exportData = {
        version: '1.0',
        exportDate: new Date().toISOString(),
        standardGraphs: allGraphs,
        customGraphs: customGraphs,
        totalCount: allGraphs.length + customGraphs.length
    };
    
    const content = JSON.stringify(exportData, null, 2);
    downloadFileFromContent(content, 'graph-library-export.json', 'application/json');
    showLibraryToast(`Exported ${exportData.totalCount} graphs`, 'success');
}

/**
 * Generate test graphs (Path, Cycle, Star, Complete) for n=4 to 10
 * and send them to Universe for verification
 * 
 * Known analytical properties:
 * - Path P_n:     ρ = 2cos(π/(n+1)) ≈ 1.62-1.90, α ≈ 0 (bounded)
 * - Cycle C_n:    ρ = 2 (exactly), α = 0 (bounded)
 * - Star S_n:     ρ = √(n-1) ≈ 1.73-3.00, α = 0.5 (√n growth)
 * - Complete K_n: ρ = n-1, α = 1 (linear growth)
 * 
 * Expected Universe positioning (with default axes α, rationality, ρ):
 * - X (α): Complete (right) > Star (middle) > Path/Cycle (left)
 * - Y (rationality): Cycle (high - always 2) > Complete (high - integer n-1) > others
 * - Z (ρ): Complete (front) > Star > Path/Cycle (back)
 */
let isGeneratingTestGraphs = false;  // Guard against double-click

async function generateTestGraphsForUniverse() {
    // Prevent double execution
    if (isGeneratingTestGraphs) {
        console.log('Test graph generation already in progress, ignoring');
        return;
    }
    isGeneratingTestGraphs = true;
    
    try {
        await _generateTestGraphsForUniverseImpl();
    } finally {
        isGeneratingTestGraphs = false;
    }
}

async function _generateTestGraphsForUniverseImpl() {
    console.log('=== GENERATING TEST GRAPHS FOR UNIVERSE ===');
    
    // Make sure universe module is loaded
    if (!universeModule) {
        try {
            universeModule = await import('./graph-universe.js');
        } catch (e) {
            showLibraryToast('Failed to load Universe module: ' + e.message, 'error');
            return;
        }
    }
    
    // Check if universe is active, if not switch to it
    const universeState = universeModule.getUniverseState();
    if (!universeState.active) {
        const libraryTab = document.querySelector('[data-tab="library"]');
        if (libraryTab) {
            libraryTab.click();
        }
        await new Promise(resolve => setTimeout(resolve, 100));
        await switchToUniverseView();
        await new Promise(resolve => setTimeout(resolve, 300));
    }
    
    // Read UI controls
    const families = {
        path: document.getElementById('test-family-path')?.checked ?? true,
        cycle: document.getElementById('test-family-cycle')?.checked ?? true,
        star: document.getElementById('test-family-star')?.checked ?? true,
        complete: document.getElementById('test-family-complete')?.checked ?? true,
        wheel: document.getElementById('test-family-wheel')?.checked ?? true,
        petersen: document.getElementById('test-family-petersen')?.checked ?? true,
        bipartite: document.getElementById('test-family-bipartite')?.checked ?? true,
        hypercube: document.getElementById('test-family-hypercube')?.checked ?? true,
        // New families
        ladder: document.getElementById('test-family-ladder')?.checked ?? true,
        prism: document.getElementById('test-family-prism')?.checked ?? true,
        friendship: document.getElementById('test-family-friendship')?.checked ?? true,
        crown: document.getElementById('test-family-crown')?.checked ?? false,
        book: document.getElementById('test-family-book')?.checked ?? true,
        fan: document.getElementById('test-family-fan')?.checked ?? true,
        gear: document.getElementById('test-family-gear')?.checked ?? false,
        helm: document.getElementById('test-family-helm')?.checked ?? false,
        turan: document.getElementById('test-family-turan')?.checked ?? false,
        platonic: document.getElementById('test-family-platonic')?.checked ?? true,
        mobius: document.getElementById('test-family-mobius')?.checked ?? false,
        fivebar: document.getElementById('test-family-fivebar')?.checked ?? false,
        pendulum: document.getElementById('test-family-pendulum')?.checked ?? false,
        // Physically realizable systems
        massChain: document.getElementById('test-family-mass-chain')?.checked ?? true,
        massDrum: document.getElementById('test-family-mass-drum')?.checked ?? true,
        massCantilever: document.getElementById('test-family-mass-cantilever')?.checked ?? false
    };
    
    const nMin = parseInt(document.getElementById('test-n-min')?.value) || 4;
    const nMax = parseInt(document.getElementById('test-n-max')?.value) || 10;
    
    const testGraphs = [];
    
    // Generate graphs for n = nMin to nMax
    for (let n = nMin; n <= nMax; n++) {
        if (families.path) testGraphs.push(generatePathGraph(n));
        if (families.cycle && n >= 3) testGraphs.push(generateCycleGraph(n));
        if (families.star && n >= 3) testGraphs.push(generateStarGraph(n));
        if (families.complete && n >= 2) testGraphs.push(generateCompleteGraph(n));
        if (families.wheel && n >= 4) testGraphs.push(generateWheelGraph(n));
        
        // New families
        if (families.ladder && n >= 2) testGraphs.push(generateLadderGraph(n));
        if (families.prism && n >= 3) testGraphs.push(generatePrismGraph(n));
        if (families.friendship && n >= 2) testGraphs.push(generateFriendshipGraph(n));
        if (families.crown && n >= 3) testGraphs.push(generateCrownGraph(n));
        if (families.book && n >= 2) testGraphs.push(generateBookGraph(n));
        if (families.fan && n >= 2) testGraphs.push(generateFanGraph(n));
        if (families.gear && n >= 3) testGraphs.push(generateGearGraph(n));
        if (families.helm && n >= 3) testGraphs.push(generateHelmGraph(n));
        if (families.mobius && n >= 3) testGraphs.push(generateMoebiusLadder(n));
    }
    
    // Turán graphs (generate a few interesting ones)
    if (families.turan) {
        testGraphs.push(generateTuranGraph(6, 2));   // T(6,2) = K_{3,3}
        testGraphs.push(generateTuranGraph(6, 3));   // T(6,3) = 3 disjoint edges complement
        testGraphs.push(generateTuranGraph(9, 3));   // T(9,3)
        testGraphs.push(generateTuranGraph(10, 2));  // T(10,2) = K_{5,5}
        testGraphs.push(generateTuranGraph(12, 3));  // T(12,3)
        testGraphs.push(generateTuranGraph(12, 4));  // T(12,4)
    }
    
    // Platonic solids (fixed graphs, not parameterized)
    if (families.platonic) {
        testGraphs.push(generateTetrahedronGraph());
        testGraphs.push(generateCubeGraph());
        testGraphs.push(generateOctahedronGraph());
        testGraphs.push(generateDodecahedronGraph());
        testGraphs.push(generateIcosahedronGraph());
    }
    
    // Add special graphs (not dependent on n range)
    if (families.petersen) {
        // Classic Petersen graph GP(5,2)
        testGraphs.push(generatePetersenGraph());
        
        // Generate more Generalized Petersen graphs GP(n,k) where k < n/2
        // Valid GP(n,k) requires: n >= 3, 1 <= k < n/2
        const petersenVariants = [
            [6, 2],   // GP(6,2) - Dürer graph
            [7, 2],   // GP(7,2)
            [7, 3],   // GP(7,3)
            [8, 2],   // GP(8,2)
            [8, 3],   // GP(8,3) - Möbius-Kantor graph
            [9, 2],   // GP(9,2)
            [9, 3],   // GP(9,3)
            [9, 4],   // GP(9,4)
            [10, 2],  // GP(10,2)
            [10, 3],  // GP(10,3) - Desargues graph
            [10, 4],  // GP(10,4)
            [11, 2],  // GP(11,2)
            [11, 4],  // GP(11,4)
            [11, 5],  // GP(11,5)
            [12, 2],  // GP(12,2)
            [12, 4],  // GP(12,4)
            [12, 5],  // GP(12,5) - Nauru graph
        ];
        
        for (const [gpn, gpk] of petersenVariants) {
            testGraphs.push(generateGeneralizedPetersenGraph(gpn, gpk));
        }
    }
    
    if (families.bipartite) {
        // Generate several complete bipartite graphs
        for (let m = 2; m <= Math.min(5, nMax - 1); m++) {
            for (let k = m; k <= Math.min(m + 2, nMax); k++) {
                if (m + k >= nMin && m + k <= nMax + 2) {
                    testGraphs.push(generateCompleteBipartiteGraph(m, k));
                }
            }
        }
    }
    
    if (families.hypercube) {
        // Generate hypercubes Q_d for d = 2, 3, 4, 5
        for (let d = 2; d <= 5; d++) {
            const vertices = Math.pow(2, d);
            if (vertices >= nMin && vertices <= 32) {
                testGraphs.push(generateHypercubeGraph(d));
            }
        }
    }
    
    if (families.fivebar) {
        // Add n-bar mechanisms based on nMin/nMax vertex count
        // For m-bar mechanism: vertices = 5m - 11
        // So: 4-bar=9, 5-bar=14, 6-bar=19, 7-bar=24, 8-bar=29, 9-bar=34, 10-bar=39, etc.
        // Calculate max m from nMax: m = (nMax + 11) / 5
        const maxBars = Math.floor((nMax + 11) / 5);
        for (let m = 4; m <= Math.max(maxBars, 20); m++) {
            const vertices = 5 * m - 11;
            if (vertices >= nMin && vertices <= nMax) {
                testGraphs.push(generateNBarMechanismGraph(m));
            }
        }
    }
    
    if (families.pendulum) {
        // Add n-link pendulums based on nMin/nMax vertex count
        // For n-link pendulum: vertices = 5n + 1
        // So: 1-link=6, 2-link=11, 3-link=16, 4-link=21, etc.
        // Calculate max links from nMax: links = (nMax - 1) / 5
        const maxLinks = Math.floor((nMax - 1) / 5);
        for (let links = 1; links <= Math.max(maxLinks, 10); links++) {
            const vertices = 5 * links + 1;
            if (vertices >= nMin && vertices <= nMax) {
                testGraphs.push(generateNLinkPendulumGraph(links));
            }
        }
    }
    
    // Physically Realizable Systems
    if (families.massChain) {
        // Mass-spring chain: n masses connected by n+1 springs (including grounded ends)
        // Total vertices = 2n + 1 (n masses + n-1 internal springs + 2 grounded springs)
        // Actually simpler: n masses, n+1 springs = 2n+1 total for chain with both ends grounded
        for (let masses = 2; masses <= Math.min(8, nMax); masses++) {
            const totalNodes = 2 * masses + 1;  // masses + internal springs + 2 grounded
            if (totalNodes >= nMin && totalNodes <= nMax) {
                testGraphs.push(generateMassChainGraph(masses));
            }
        }
    }
    
    if (families.massDrum) {
        // Mass-spring drum: center mass + n outer masses connected by springs
        // For k branches: 1 center mass + k outer masses + k radial springs + k grounded springs
        // Total = 1 + k + k + k = 1 + 3k (but we double-count... actually 2k+1 nodes)
        for (let branches = 3; branches <= Math.min(10, nMax); branches++) {
            const totalNodes = 2 * branches + 1;  // 1 center + branches masses + branches springs
            if (totalNodes >= nMin && totalNodes <= nMax) {
                testGraphs.push(generateMassDrumGraph(branches));
            }
        }
    }
    
    if (families.massCantilever) {
        // Cantilever beam: fixed at one end, free at other
        // n sections: n masses, n springs (including 1 grounded at fixed end)
        for (let sections = 2; sections <= Math.min(8, nMax); sections++) {
            const totalNodes = 2 * sections;  // n masses + n springs
            if (totalNodes >= nMin && totalNodes <= nMax) {
                testGraphs.push(generateMassCantileverGraph(sections));
            }
        }
    }
    
    // Deduplicate test graphs themselves (in case of any logic issues)
    const seenTestKeys = new Set();
    const dedupedTestGraphs = testGraphs.filter(g => {
        const key = `${g.family}:${g.n}`;
        if (seenTestKeys.has(key)) {
            console.log(`  Internal duplicate removed: ${g.name} (${key})`);
            return false;
        }
        seenTestKeys.add(key);
        return true;
    });
    
    console.log(`Generated ${testGraphs.length} test graphs, ${dedupedTestGraphs.length} after internal dedup`);
    
    // Helper to extract BASE family name from graph (e.g., "Star S_6" → "Star", "Path P₅" → "Path")
    function extractFamily(g) {
        // Check both name and family fields - parse both to get base family
        const textsToCheck = [g.name, g.family].filter(Boolean);
        
        for (const text of textsToCheck) {
            // Common patterns - extract just the family name (case insensitive, word boundary)
            if (/^Star[\s_]/i.test(text) || text === 'Star') return 'Star';
            if (/^Cycle[\s_]/i.test(text) || text === 'Cycle') return 'Cycle';
            if (/^Path[\s_]/i.test(text) || text === 'Path') return 'Path';
            if (/^Complete Bipartite[\s_]/i.test(text)) return 'Complete Bipartite';
            if (/^Complete[\s_]/i.test(text) || text === 'Complete') return 'Complete';
            if (/^Wheel[\s_]/i.test(text) || text === 'Wheel') return 'Wheel';
            if (/^Hypercube[\s_]/i.test(text) || text === 'Hypercube') return 'Hypercube';
            if (/^Grid[\s_]/i.test(text) || text === 'Grid') return 'Grid';
            if (/^Ladder[\s_]/i.test(text) || text === 'Ladder') return 'Ladder';
            if (/^Petersen[\s_]/i.test(text) || text.includes('GP(')) return 'Petersen';
            if (/^Möbius[\s_]/i.test(text) || text === 'Möbius') return 'Möbius';
            if (/^Binary Tree[\s_]/i.test(text)) return 'Binary Tree';
            if (/Tree[\s_]/i.test(text) && !text.includes('□')) return 'Tree';
            // New families
            if (/^Prism[\s_]/i.test(text) || text === 'Prism') return 'Prism';
            if (/^Friendship[\s_]/i.test(text) || text === 'Friendship') return 'Friendship';
            if (/^Crown[\s_]/i.test(text) || text === 'Crown') return 'Crown';
            if (/^Book[\s_]/i.test(text) || text === 'Book') return 'Book';
            if (/^Fan[\s_]/i.test(text) || text === 'Fan') return 'Fan';
            if (/^Gear[\s_]/i.test(text) || text === 'Gear') return 'Gear';
            if (/^Helm[\s_]/i.test(text) || text === 'Helm') return 'Helm';
            if (/^Turán[\s_]/i.test(text) || /^Turan[\s_]/i.test(text) || text === 'Turán') return 'Turán';
            if (/^Tetrahedron/i.test(text) || /^Octahedron/i.test(text) || 
                /^Cube$/i.test(text) || /^Icosahedron/i.test(text) || 
                /^Dodecahedron/i.test(text) || text === 'Platonic') return 'Platonic';
            // Physically realizable systems
            if (/^Mass Chain/i.test(text) || text === 'Mass Chain') return 'Mass Chain';
            if (/^Mass Drum/i.test(text) || text === 'Mass Drum') return 'Mass Drum';
            if (/^Cantilever/i.test(text) || text === 'Cantilever') return 'Cantilever';
            if (/^Pendulum/i.test(text) || /Link Pendulum/i.test(text)) return 'Pendulum';
            if (/^n-Bar/i.test(text) || /-Bar Mechanism/i.test(text)) return 'n-Bar';
        }
        
        // Try type field as fallback
        if (g.type) {
            const typeMap = {
                'star': 'Star', 'cycle': 'Cycle', 'path': 'Path',
                'complete': 'Complete', 'complete_bipartite': 'Complete Bipartite',
                'wheel': 'Wheel', 'hypercube': 'Hypercube', 'grid': 'Grid',
                'ladder': 'Ladder', 'petersen': 'Petersen', 'tree': 'Tree',
                'prism': 'Prism', 'friendship': 'Friendship', 'crown': 'Crown',
                'book': 'Book', 'fan': 'Fan', 'gear': 'Gear', 'helm': 'Helm',
                'turan': 'Turán', 'platonic': 'Platonic', 'mobius': 'Möbius',
                'mass_chain': 'Mass Chain', 'mass_drum': 'Mass Drum', 
                'cantilever': 'Cantilever', 'pendulum': 'Pendulum', 'nbar': 'n-Bar'
            };
            if (typeMap[g.type]) return typeMap[g.type];
        }
        
        return 'Unknown';
    }
    
    // Debug: test extractFamily
    console.log('extractFamily test: "Star S_6" →', extractFamily({name: 'Star S_6'}));
    console.log('extractFamily test: "Star S₆" →', extractFamily({name: 'Star S₆'}));
    
    // Get existing library graphs to check for duplicates
    // Use (family, n) pair for comparison since naming may differ (e.g., "S_5" vs "S₅")
    const libraryGraphs = getAllGraphs();
    const libraryKeys = new Set();
    libraryGraphs.forEach(g => {
        const family = extractFamily(g);
        const key = `${family}:${g.n}`;
        libraryKeys.add(key);
        // Debug: log first few
        if (libraryKeys.size <= 5) {
            console.log(`  Library: "${g.name}" → family="${family}" → key="${key}"`);
        }
    });
    
    console.log(`Library has ${libraryKeys.size} unique family:n keys`);
    
    // Also check existing custom graphs in Universe (get fresh state after potential view switch)
    const currentUniverseState = universeModule.getUniverseState();
    const existingCustomKeys = new Set();
    
    // Debug: Log graphNodes state
    console.log(`  graphNodes exists: ${!!currentUniverseState.graphNodes}`);
    console.log(`  graphNodes size: ${currentUniverseState.graphNodes?.size || 0}`);
    
    if (currentUniverseState.graphNodes) {
        let customCount = 0;
        let nonCustomCount = 0;
        currentUniverseState.graphNodes.forEach((nodeData, id) => {
            const isCustom = nodeData.mesh?.userData?.isCustom;
            if (isCustom && nodeData.data) {
                customCount++;
                const d = nodeData.data;
                const family = extractFamily(d);
                const key = `${family}:${d.n}`;
                existingCustomKeys.add(key);
                console.log(`  Found custom: "${d.name}" → ${key}`);
            } else {
                nonCustomCount++;
            }
        });
        console.log(`  Custom: ${customCount}, Non-custom: ${nonCustomCount}`);
    }
    
    console.log(`Universe has ${existingCustomKeys.size} existing custom graphs`);
    
    // Filter out duplicates - only skip if already in Universe as custom graph
    // NOTE: We do NOT skip library duplicates because library graphs use old positioning
    // and test graphs use new axis-based positioning
    const uniqueTestGraphs = dedupedTestGraphs.filter(g => {
        const key = `${extractFamily(g)}:${g.n}`;
        const isDuplicateInUniverse = existingCustomKeys.has(key);
        if (isDuplicateInUniverse) {
            console.log(`  Skipping "${g.name}" - ${key} already in Universe as custom graph`);
        }
        // Note: Library graphs may exist but we add test graphs anyway for correct positioning
        return !isDuplicateInUniverse;
    });
    
    const skippedCount = testGraphs.length - uniqueTestGraphs.length;
    if (skippedCount > 0) {
        console.log(`Skipped ${skippedCount} duplicate graphs`);
    }
    
    // Log expected vs computed values
    console.log('\n=== TEST GRAPH SUMMARY ===');
    console.log('Format: Name | n | ρ (computed) | ρ (analytical) | α (expected)');
    console.log('-----------------------------------------------------------');
    
    // Send each to Universe with delay between
    let count = 0;
    for (const graphData of uniqueTestGraphs) {
        const graphId = universeModule.addCustomGraph(graphData, false); // Use bubble mode for test
        if (graphId) {
            count++;
            console.log(`${graphData.name} | n=${graphData.n} | ρ=${graphData.spectralRadius.toFixed(4)} | ρ_exact=${graphData.analyticalRho} | α=${graphData.expectedAlpha}`);
        }
        // Small delay to prevent overwhelming
        await new Promise(resolve => setTimeout(resolve, 50));
    }
    
    const msg = skippedCount > 0 
        ? `Generated ${count} test graphs (${skippedCount} duplicates skipped)`
        : `Generated ${count} test graphs in Universe`;
    showLibraryToast(msg, 'success');
    console.log(`\n=== ${count} TEST GRAPHS ADDED TO UNIVERSE ===`);
    console.log('Use "F" key to fit all in view');
    
    // Refresh axes to encompass all newly added graphs
    if (universeModule && universeModule.refreshUniverseAxes) {
        universeModule.refreshUniverseAxes();
    }
}

/**
 * Generate Path graph P_n
 * Eigenvalues: 2cos(kπ/(n+1)) for k = 1, 2, ..., n
 * Spectral radius: 2cos(π/(n+1))
 */
function generatePathGraph(n) {
    const edges = [];
    for (let i = 0; i < n - 1; i++) {
        edges.push([i, i + 1]);
    }
    
    // Analytical eigenvalues
    const eigenvalues = [];
    for (let k = 1; k <= n; k++) {
        eigenvalues.push({
            value: 2 * Math.cos(k * Math.PI / (n + 1)),
            form: `2cos(${k}π/${n + 1})`
        });
    }
    eigenvalues.sort((a, b) => Math.abs(b.value) - Math.abs(a.value));
    
    const rho = 2 * Math.cos(Math.PI / (n + 1));
    
    return {
        n,
        edges,
        edgeCount: edges.length,
        name: `Path P_${n}`,
        family: 'Path',
        eigenvalues,
        spectralRadius: rho,
        analyticalRho: `2cos(π/${n + 1})`,
        expectedAlpha: 0
    };
}

/**
 * Generate Cycle graph C_n
 * Eigenvalues: 2cos(2πk/n) for k = 0, 1, ..., n-1
 * Spectral radius: 2 (exactly, for all n ≥ 3)
 */
function generateCycleGraph(n) {
    const edges = [];
    for (let i = 0; i < n; i++) {
        edges.push([i, (i + 1) % n]);
    }
    
    // Analytical eigenvalues
    const eigenvalues = [];
    for (let k = 0; k < n; k++) {
        eigenvalues.push({
            value: 2 * Math.cos(2 * Math.PI * k / n),
            form: `2cos(2π·${k}/${n})`
        });
    }
    eigenvalues.sort((a, b) => Math.abs(b.value) - Math.abs(a.value));
    
    return {
        n,
        edges,
        edgeCount: edges.length,
        name: `Cycle C_${n}`,
        family: 'Cycle',
        eigenvalues,
        spectralRadius: 2,
        analyticalRho: '2',
        expectedAlpha: 0
    };
}

/**
 * Generate Star graph S_n (K_{1,n-1})
 * Eigenvalues: √(n-1), 0 (with multiplicity n-2), -√(n-1)
 * Spectral radius: √(n-1)
 */
function generateStarGraph(n) {
    const edges = [];
    // Center is vertex 0, leaves are 1 to n-1
    for (let i = 1; i < n; i++) {
        edges.push([0, i]);
    }
    
    const sqrtNm1 = Math.sqrt(n - 1);
    
    // Analytical eigenvalues
    const eigenvalues = [
        { value: sqrtNm1, form: `√${n - 1}` },
        { value: -sqrtNm1, form: `-√${n - 1}` }
    ];
    // Add zeros with multiplicity n-2
    for (let i = 0; i < n - 2; i++) {
        eigenvalues.push({ value: 0, form: '0' });
    }
    eigenvalues.sort((a, b) => Math.abs(b.value) - Math.abs(a.value));
    
    return {
        n,
        edges,
        edgeCount: edges.length,
        name: `Star S_${n}`,
        family: 'Star',
        eigenvalues,
        spectralRadius: sqrtNm1,
        analyticalRho: `√${n - 1}`,
        expectedAlpha: 0.5
    };
}

/**
 * Generate Complete graph K_n
 * Eigenvalues: n-1 (multiplicity 1), -1 (multiplicity n-1)
 * Spectral radius: n-1
 */
function generateCompleteGraph(n) {
    const edges = [];
    for (let i = 0; i < n; i++) {
        for (let j = i + 1; j < n; j++) {
            edges.push([i, j]);
        }
    }
    
    // Analytical eigenvalues
    const eigenvalues = [
        { value: n - 1, form: `${n - 1}` }
    ];
    // Add -1 with multiplicity n-1
    for (let i = 0; i < n - 1; i++) {
        eigenvalues.push({ value: -1, form: '-1' });
    }
    
    return {
        n,
        edges,
        edgeCount: edges.length,
        name: `Complete K_${n}`,
        family: 'Complete',
        eigenvalues,
        spectralRadius: n - 1,
        analyticalRho: `${n - 1}`,
        expectedAlpha: 1
    };
}

/**
 * Generate Wheel graph W_n (cycle C_{n-1} + central vertex)
 * Eigenvalues: 1, 1 + √(n-1), 1 - √(n-1), and 2cos(2πk/(n-1)) for k=1,...,n-2
 * Spectral radius: 1 + √(n-1) for n > 4
 */
function generateWheelGraph(n) {
    if (n < 4) return null;
    
    const edges = [];
    // Center is vertex 0, rim is vertices 1 to n-1
    // Connect center to all rim vertices
    for (let i = 1; i < n; i++) {
        edges.push([0, i]);
    }
    // Connect rim vertices in a cycle
    for (let i = 1; i < n - 1; i++) {
        edges.push([i, i + 1]);
    }
    edges.push([n - 1, 1]); // Close the cycle
    
    const sqrtNm1 = Math.sqrt(n - 1);
    const rho = 1 + sqrtNm1;
    
    // Eigenvalues (approximation)
    const eigenvalues = [
        { value: rho, form: `1+√${n-1}` },
        { value: 1 - sqrtNm1, form: `1-√${n-1}` }
    ];
    // Add eigenvalues from the cycle part
    for (let k = 1; k < n - 1; k++) {
        const val = 2 * Math.cos(2 * Math.PI * k / (n - 1));
        eigenvalues.push({ value: val, form: `2cos(2π·${k}/${n-1})` });
    }
    eigenvalues.sort((a, b) => Math.abs(b.value) - Math.abs(a.value));
    
    return {
        n,
        edges,
        edgeCount: edges.length,
        name: `Wheel W_${n}`,
        family: 'Wheel',
        eigenvalues,
        spectralRadius: rho,
        analyticalRho: `1+√${n-1}`,
        expectedAlpha: 0.5
    };
}

/**
 * Generate Petersen graph (n=10, e=15)
 * Famous 3-regular graph with eigenvalues: 3, 1 (mult 5), -2 (mult 4)
 */
function generatePetersenGraph() {
    const n = 10;
    const edges = [
        // Outer pentagon: 0-1-2-3-4-0
        [0, 1], [1, 2], [2, 3], [3, 4], [4, 0],
        // Inner pentagram: 5-7-9-6-8-5
        [5, 7], [7, 9], [9, 6], [6, 8], [8, 5],
        // Spokes connecting outer to inner
        [0, 5], [1, 6], [2, 7], [3, 8], [4, 9]
    ];
    
    const eigenvalues = [
        { value: 3, form: '3' },
        { value: 1, form: '1' },
        { value: 1, form: '1' },
        { value: 1, form: '1' },
        { value: 1, form: '1' },
        { value: 1, form: '1' },
        { value: -2, form: '-2' },
        { value: -2, form: '-2' },
        { value: -2, form: '-2' },
        { value: -2, form: '-2' }
    ];
    
    return {
        n,
        edges,
        edgeCount: edges.length,
        name: 'Petersen',
        family: 'Petersen',
        eigenvalues,
        spectralRadius: 3,
        analyticalRho: '3',
        expectedAlpha: 0 // Bounded, specific graph
    };
}

/**
 * Generate Generalized Petersen graph GP(n, k)
 * n outer vertices, n inner vertices, each inner vertex connected to outer vertex i and i+k
 */
function generateGeneralizedPetersenGraph(n, k) {
    const totalN = 2 * n;
    const edges = [];
    
    // Outer cycle: 0, 1, ..., n-1
    for (let i = 0; i < n; i++) {
        edges.push([i, (i + 1) % n]);
    }
    
    // Inner star/cycle: n, n+1, ..., 2n-1
    for (let i = 0; i < n; i++) {
        edges.push([n + i, n + ((i + k) % n)]);
    }
    
    // Spokes: i to n+i
    for (let i = 0; i < n; i++) {
        edges.push([i, n + i]);
    }
    
    // Calculate spectral radius numerically (3-regular)
    const rho = 3; // Approximate for regular graph
    
    return {
        n: totalN,
        edges,
        edgeCount: edges.length,
        name: `GP(${n},${k})`,
        family: 'Petersen',
        eigenvalues: [],
        spectralRadius: rho,
        analyticalRho: '≈3',
        expectedAlpha: 0
    };
}

/**
 * Generate Complete Bipartite graph K_{m,n}
 * Eigenvalues: √(mn), -√(mn), 0 (multiplicity m+n-2)
 */
function generateCompleteBipartiteGraph(m, k) {
    const n = m + k;
    const edges = [];
    
    // Vertices 0..m-1 in one partition, m..n-1 in other
    for (let i = 0; i < m; i++) {
        for (let j = m; j < n; j++) {
            edges.push([i, j]);
        }
    }
    
    const sqrtMK = Math.sqrt(m * k);
    
    const eigenvalues = [
        { value: sqrtMK, form: `√${m * k}` },
        { value: -sqrtMK, form: `-√${m * k}` }
    ];
    // Add zeros
    for (let i = 0; i < n - 2; i++) {
        eigenvalues.push({ value: 0, form: '0' });
    }
    
    return {
        n,
        edges,
        edgeCount: edges.length,
        name: `K_${m},${k}`,
        family: 'Complete Bipartite',
        eigenvalues,
        spectralRadius: sqrtMK,
        analyticalRho: `√${m * k}`,
        expectedAlpha: 0.5
    };
}

/**
 * Generate Hypercube graph Q_d (d-dimensional)
 * n = 2^d vertices, eigenvalues: d - 2k for k = 0, ..., d with binomial multiplicities
 */
function generateHypercubeGraph(d) {
    const n = Math.pow(2, d);
    const edges = [];
    
    // Connect vertices that differ by exactly one bit
    for (let i = 0; i < n; i++) {
        for (let bit = 0; bit < d; bit++) {
            const j = i ^ (1 << bit);
            if (i < j) {
                edges.push([i, j]);
            }
        }
    }
    
    // Eigenvalues: d - 2k with multiplicity C(d, k)
    const eigenvalues = [];
    for (let k = 0; k <= d; k++) {
        const val = d - 2 * k;
        const mult = binomial(d, k);
        for (let i = 0; i < mult; i++) {
            eigenvalues.push({ value: val, form: `${val}` });
        }
    }
    eigenvalues.sort((a, b) => Math.abs(b.value) - Math.abs(a.value));
    
    return {
        n,
        edges,
        edgeCount: edges.length,
        name: `Hypercube Q_${d}`,
        family: 'Hypercube',
        eigenvalues,
        spectralRadius: d,
        analyticalRho: `${d}`,
        expectedAlpha: 1 // Linear in dimension
    };
}

// Binomial coefficient helper
function binomial(n, k) {
    if (k < 0 || k > n) return 0;
    if (k === 0 || k === n) return 1;
    let result = 1;
    for (let i = 0; i < k; i++) {
        result = result * (n - i) / (i + 1);
    }
    return Math.round(result);
}

/**
 * Generate Five-Bar Mechanism graph from Zeid-Rosenberg Fig. 3
 * 14 vertices, 20 edges, specific gyro-bondgraph structure
 * 
 * ANALYTIC EIGENVALUE SOLUTION:
 * Characteristic polynomial factors as:
 * p(λ) = λ⁴(λ-1)(λ+1)(λ²-3)(λ²-5)(λ⁴-11λ²+12)
 * 
 * The quartic λ⁴-11λ²+12=0 reduces via μ=λ² to μ²-11μ+12=0
 * with discriminant 121-48=73, giving μ = (11±√73)/2
 * 
 * Exact eigenvalues:
 * - 0 (multiplicity 4)
 * - ±1
 * - ±√3
 * - ±√5
 * - ±√((11+√73)/2)
 * - ±√((11-√73)/2)
 */
/**
 * Generate n-Bar Mechanism graph
 * Based on gyro-bondgraph structures from planar linkage mechanisms
 * 
 * Structure:
 * - m-bar mechanism has (m-3) internal "cells"
 * - 4-bar: 1 cell, 9 vertices, 12 edges
 * - 5-bar: 2 cells, 14 vertices, 20 edges
 * - 6-bar: 3 cells, 19 vertices, 28 edges
 * - General: vertices = 5(m-3) + 4, edges = 8(m-3) + 4
 * 
 * @param {number} m - Number of bars (minimum 4)
 */
function generateNBarMechanismGraph(m) {
    if (m < 4) m = 4;
    
    const cells = m - 3;  // 4-bar = 1 cell, 5-bar = 2 cells, etc.
    
    // Total vertices: 5*cells + 4
    // Layout:
    // - (cells+1) top corners at even indices: 0, 2, 4, ..., 2*cells
    // - (cells+1) bottom corners at odd indices: 1, 3, 5, ..., 2*cells+1
    // - 1 left edge node
    // - 1 right edge node
    // - cells top intermediates
    // - cells bottom intermediates
    // - cells inner diamond nodes
    
    const numCorners = 2 * (cells + 1);
    const leftEdge = numCorners;
    const rightEdge = numCorners + 1;
    const topIntBase = numCorners + 2;
    const botIntBase = topIntBase + cells;
    const innerBase = botIntBase + cells;
    
    const n = 5 * cells + 4;
    const edges = [];
    
    // Top rail: corner - intermediate - corner - intermediate - ...
    for (let c = 0; c < cells; c++) {
        const topL = 2 * c;
        const topR = 2 * (c + 1);
        const topInt = topIntBase + c;
        edges.push([topL, topInt]);
        edges.push([topInt, topR]);
    }
    
    // Bottom rail: same pattern
    for (let c = 0; c < cells; c++) {
        const botL = 2 * c + 1;
        const botR = 2 * (c + 1) + 1;
        const botInt = botIntBase + c;
        edges.push([botL, botInt]);
        edges.push([botInt, botR]);
    }
    
    // Left edge node connects top-left (0) and bottom-left (1) corners
    edges.push([0, leftEdge]);
    edges.push([leftEdge, 1]);
    
    // Right edge node connects top-right and bottom-right corners
    edges.push([2 * cells, rightEdge]);
    edges.push([rightEdge, 2 * cells + 1]);
    
    // Inner diamonds - each connects 4 corners of a cell
    for (let c = 0; c < cells; c++) {
        const inner = innerBase + c;
        const topL = 2 * c;
        const topR = 2 * (c + 1);
        const botL = 2 * c + 1;
        const botR = 2 * (c + 1) + 1;
        edges.push([topL, inner]);
        edges.push([inner, topR]);
        edges.push([botL, inner]);
        edges.push([inner, botR]);
    }
    
    // Spectral properties (approximate for general case)
    // For small m, we can give exact values
    let spectralRadius, analyticalRho;
    
    if (m === 4) {
        // 4-bar: exact eigenvalues known
        spectralRadius = (1 + Math.sqrt(5)) / 2 + 1;  // ≈ 2.618
        analyticalRho = '1 + φ ≈ 2.618';
    } else if (m === 5) {
        // 5-bar: exact from previous analysis
        const sqrt73 = Math.sqrt(73);
        spectralRadius = Math.sqrt((11 + sqrt73) / 2);  // ≈ 3.126
        analyticalRho = '√((11+√73)/2) ≈ 3.126';
    } else {
        // Approximate for larger mechanisms
        spectralRadius = Math.sqrt(2 * cells + 2);
        analyticalRho = `≈√${2 * cells + 2}`;
    }
    
    return {
        n,
        edges,
        edgeCount: edges.length,
        name: `${m}-Bar Mechanism`,
        family: 'Mechanism',
        spectralRadius: spectralRadius,
        analyticalRho: analyticalRho,
        expectedAlpha: 0,  // Bounded spectral radius
        cells: cells,
        description: `Planar ${m}-bar linkage mechanism bond graph with ${cells} cell${cells > 1 ? 's' : ''}`
    };
}

// Keep legacy function for backward compatibility
function generateFiveBarMechanismGraph() {
    return generateNBarMechanismGraph(5);
}

// Convenience functions for common mechanisms
function generateFourBarMechanismGraph() {
    return generateNBarMechanismGraph(4);
}

function generateSixBarMechanismGraph() {
    return generateNBarMechanismGraph(6);
}

function generateSevenBarMechanismGraph() {
    return generateNBarMechanismGraph(7);
}

/**
 * Generate n-Link Pendulum graph
 * Derived from (n+3)-bar mechanism by removing the 3 tip nodes
 * (right edge node, rightmost top corner, rightmost bottom corner)
 * 
 * Structure:
 * - n-link pendulum has n "cells" (like n-bar mechanism has n-3 cells)
 * - Vertices: 5n + 1
 * - Edges: 8n - 2
 * 
 * Examples:
 * - 1-link: 6 vertices, 6 edges (from 4-bar minus 3 tip nodes)
 * - 2-link: 11 vertices, 14 edges (from 5-bar minus 3 tip nodes)
 * - 3-link: 16 vertices, 22 edges (from 6-bar minus 3 tip nodes)
 * 
 * Characteristic polynomial pattern:
 * - Always has λ^(n+1) factor (n+1 zero eigenvalues)
 * - Remaining factors are quartics in λ² that can be solved analytically
 * 
 * @param {number} links - Number of links (minimum 1)
 */
function generateNLinkPendulumGraph(links) {
    if (links < 1) links = 1;
    
    const cells = links;  // n-link has n cells
    const n = 5 * links + 1;  // Total vertices
    const edges = [];
    
    // Node layout (similar to mechanism but without right tip):
    // - Top corners: 0, 2, 4, ..., 2*(cells-1) = 2*cells-2 (cells nodes, not cells+1)
    // - Bottom corners: 1, 3, 5, ..., 2*cells-1 (cells nodes)
    // - Left edge node: 2*cells
    // - Top intermediates: 2*cells+1 to 2*cells+cells = 3*cells
    // - Bottom intermediates: 3*cells+1 to 4*cells
    // - Inner diamonds: 4*cells+1 to 5*cells (but last one connects differently)
    
    const numCorners = 2 * cells;  // cells top + cells bottom (no rightmost pair)
    const leftEdgeIdx = numCorners;
    const topIntBase = numCorners + 1;
    const botIntBase = topIntBase + cells;
    const innerBase = botIntBase + cells;
    
    // Top rail: corner - intermediate - corner
    // But the last cell doesn't have a right corner, so it ends at intermediate
    for (let c = 0; c < cells - 1; c++) {
        const topL = 2 * c;
        const topR = 2 * (c + 1);
        const topInt = topIntBase + c;
        edges.push([topL, topInt]);
        edges.push([topInt, topR]);
    }
    // Last cell top rail: corner to intermediate (no right corner)
    if (cells >= 1) {
        const topL = 2 * (cells - 1);
        const topInt = topIntBase + cells - 1;
        edges.push([topL, topInt]);
        // topInt is the end of top rail
    }
    
    // Bottom rail: same pattern
    for (let c = 0; c < cells - 1; c++) {
        const botL = 2 * c + 1;
        const botR = 2 * (c + 1) + 1;
        const botInt = botIntBase + c;
        edges.push([botL, botInt]);
        edges.push([botInt, botR]);
    }
    // Last cell bottom rail
    if (cells >= 1) {
        const botL = 2 * (cells - 1) + 1;
        const botInt = botIntBase + cells - 1;
        edges.push([botL, botInt]);
    }
    
    // Left edge node connects first top (0) and first bottom (1) corners
    edges.push([0, leftEdgeIdx]);
    edges.push([leftEdgeIdx, 1]);
    
    // Inner diamonds - each connects 4 corners of a cell
    // For cells 0 to cells-2: normal diamond pattern
    for (let c = 0; c < cells - 1; c++) {
        const inner = innerBase + c;
        const topL = 2 * c;
        const topR = 2 * (c + 1);
        const botL = 2 * c + 1;
        const botR = 2 * (c + 1) + 1;
        edges.push([topL, inner]);
        edges.push([inner, topR]);
        edges.push([botL, inner]);
        edges.push([inner, botR]);
    }
    
    // Last cell inner diamond connects to CORNERS ONLY (not tips)
    // The tips are only connected via the rail edges (corner → tip)
    if (cells >= 1) {
        const inner = innerBase + cells - 1;
        const topL = 2 * (cells - 1);
        const botL = 2 * (cells - 1) + 1;
        // Connect corners to inner diamond only
        edges.push([topL, inner]);
        edges.push([botL, inner]);
        // Do NOT connect inner to tips
    }
    
    // The tip intermediates are already connected via rail edges
    // No additional connections needed
    
    // Calculate spectral properties
    let spectralRadius, analyticalRho, charPoly;
    
    if (links === 1) {
        // 1-link pendulum: p(λ) = λ²(λ²-1)(λ²-5)
        spectralRadius = Math.sqrt(5);
        analyticalRho = '√5';
        charPoly = 'λ²(λ²-1)(λ²-5)';
    } else if (links === 2) {
        // 2-link pendulum: p(λ) = λ³(λ⁴-3λ²+1)(λ⁴-11λ²+21)
        const sqrt37 = Math.sqrt(37);
        spectralRadius = Math.sqrt((11 + sqrt37) / 2);
        analyticalRho = '√((11+√37)/2)';
        charPoly = 'λ³(λ⁴-3λ²+1)(λ⁴-11λ²+21)';
    } else if (links === 3) {
        // 3-link: No closed form - computed numerically
        spectralRadius = 3.166399;  // √10.0260825878
        analyticalRho = '≈3.166 (numerical)';
        charPoly = 'λ⁴·Q(μ), μ=λ², Q has irrational coefficients';
    } else if (links === 4) {
        // 4-link: No closed form - computed numerically
        spectralRadius = 3.276954;
        analyticalRho = '≈3.277 (numerical)';
        charPoly = 'λ⁵·Q(μ), μ=λ², Q has irrational coefficients';
    } else {
        // General n ≥ 5: Empirical formula ρ ≈ √(2n+4)
        spectralRadius = Math.sqrt(2 * links + 4);
        analyticalRho = `≈√${2 * links + 4} (numerical)`;
        charPoly = `λ^${links+1}·Q(μ), μ=λ², no closed form`;
    }
    
    return {
        n,
        edges,
        edgeCount: edges.length,
        name: `${links}-Link Pendulum`,
        family: 'Pendulum',
        spectralRadius: spectralRadius,
        analyticalRho: analyticalRho,
        expectedAlpha: 0,  // Bounded spectral radius
        links: links,
        characteristicPolynomial: charPoly,
        description: `${links}-link pendulum bond graph (from ${links+3}-bar mechanism)`
    };
}

// Convenience functions for common pendulums
function generateOneLinkPendulumGraph() {
    return generateNLinkPendulumGraph(1);
}

function generateTwoLinkPendulumGraph() {
    return generateNLinkPendulumGraph(2);
}

function generateThreeLinkPendulumGraph() {
    return generateNLinkPendulumGraph(3);
}

// =====================================================
// PHYSICALLY REALIZABLE SYSTEM GENERATORS
// =====================================================

/**
 * Generate Mass-Spring Chain graph
 * Chain with n masses connected by springs, grounded at both ends
 * Total: n masses + (n-1) internal springs + 2 grounded springs = 2n+1 nodes
 * Structure: G - M - S - M - S - M - ... - M - G
 *            (grounded spring - mass - spring - mass - ... - grounded spring)
 */
function generateMassChainGraph(masses) {
    if (masses < 2) masses = 2;
    
    // Layout: masses (0 to masses-1), internal springs (masses to 2*masses-2), 
    //         left grounded (2*masses-1), right grounded (2*masses)
    const n = 2 * masses + 1;
    const edges = [];
    
    // Indices
    const massBase = 0;
    const springBase = masses;
    const leftGround = 2 * masses - 1;
    const rightGround = 2 * masses;
    
    // Left grounded spring connects to first mass
    edges.push([leftGround, massBase]);
    
    // Internal springs connect adjacent masses
    for (let i = 0; i < masses - 1; i++) {
        const spring = springBase + i;
        const massLeft = massBase + i;
        const massRight = massBase + i + 1;
        edges.push([massLeft, spring]);
        edges.push([spring, massRight]);
    }
    
    // Right grounded spring connects to last mass
    edges.push([massBase + masses - 1, rightGround]);
    
    // Spectral radius for chain (approximately related to 2cos pattern)
    const spectralRadius = 2;  // Approximate - exact depends on topology
    
    return {
        n,
        edges,
        edgeCount: edges.length,
        name: `Mass Chain (${masses})`,
        family: 'Mass Chain',
        spectralRadius: spectralRadius,
        analyticalRho: '≈2 (bounded)',
        expectedAlpha: 0,
        masses: masses,
        isPhysicallyRealizable: true,
        description: `${masses}-mass chain with grounded ends`
    };
}

/**
 * Generate Mass-Spring Drum graph
 * Center mass connected to k outer masses via springs, outer masses have grounded springs
 * Total: 1 center + k outer masses + k radial springs + k grounded springs = 2k+1 nodes
 */
function generateMassDrumGraph(branches) {
    if (branches < 3) branches = 3;
    
    // Layout: center mass (0), outer masses (1 to branches), 
    //         radial springs (branches+1 to 2*branches), 
    //         grounded springs would be separate but for simplicity we use star topology
    const n = 2 * branches + 1;
    const edges = [];
    
    // Center mass at index 0
    // Outer masses at indices 1 to branches
    // Radial springs at indices branches+1 to 2*branches
    
    const centerMass = 0;
    const outerMassBase = 1;
    const radialSpringBase = branches + 1;
    
    // Connect center to outer masses via radial springs
    for (let i = 0; i < branches; i++) {
        const outerMass = outerMassBase + i;
        const radialSpring = radialSpringBase + i;
        // Center - spring - outer
        edges.push([centerMass, radialSpring]);
        edges.push([radialSpring, outerMass]);
    }
    
    // Spectral radius: star-like structure
    const spectralRadius = Math.sqrt(branches);
    
    return {
        n,
        edges,
        edgeCount: edges.length,
        name: `Mass Drum (${branches})`,
        family: 'Mass Drum',
        spectralRadius: spectralRadius,
        analyticalRho: `√${branches}`,
        expectedAlpha: 0,
        branches: branches,
        isPhysicallyRealizable: true,
        description: `${branches}-branch drum: center mass with ${branches} outer masses via springs`
    };
}

/**
 * Generate Mass-Spring Cantilever graph
 * Beam fixed at one end: n masses connected by springs, one end grounded
 * Total: n masses + n springs (including 1 grounded at fixed end) = 2n nodes
 */
function generateMassCantileverGraph(sections) {
    if (sections < 2) sections = 2;
    
    const n = 2 * sections;
    const edges = [];
    
    // Masses: 0 to sections-1
    // Internal springs: sections to 2*sections-2
    // Grounded spring: 2*sections-1
    
    const massBase = 0;
    const springBase = sections;
    const groundedSpring = 2 * sections - 1;
    
    // Grounded spring at fixed end connects to first mass
    edges.push([groundedSpring, massBase]);
    
    // Internal springs connect adjacent masses
    for (let i = 0; i < sections - 1; i++) {
        const spring = springBase + i;
        const massLeft = massBase + i;
        const massRight = massBase + i + 1;
        edges.push([massLeft, spring]);
        edges.push([spring, massRight]);
    }
    
    // Spectral radius (cantilever modes)
    const spectralRadius = 2;  // Approximate
    
    return {
        n,
        edges,
        edgeCount: edges.length,
        name: `Cantilever (${sections})`,
        family: 'Cantilever',
        spectralRadius: spectralRadius,
        analyticalRho: '≈2 (bounded)',
        expectedAlpha: 0,
        sections: sections,
        isPhysicallyRealizable: true,
        description: `${sections}-section cantilever beam (fixed at one end)`
    };
}

// =====================================================
// ADDITIONAL GRAPH FAMILY GENERATORS
// =====================================================

/**
 * Generate Ladder graph L_n (two parallel paths connected by rungs)
 * L_n has 2n vertices and 3n-2 edges
 * Eigenvalues: Related to path eigenvalues, α ≈ 0 (bounded)
 */
function generateLadderGraph(n) {
    const vertices = 2 * n;
    const edges = [];
    
    // Top rail: 0 - 1 - 2 - ... - (n-1)
    for (let i = 0; i < n - 1; i++) {
        edges.push([i, i + 1]);
    }
    
    // Bottom rail: n - (n+1) - ... - (2n-1)
    for (let i = n; i < 2 * n - 1; i++) {
        edges.push([i, i + 1]);
    }
    
    // Rungs: connect i to i+n
    for (let i = 0; i < n; i++) {
        edges.push([i, i + n]);
    }
    
    // Spectral radius for ladder: approximately 2 + 2cos(π/(n+1))
    // For large n, approaches 4
    const rho = 2 + 2 * Math.cos(Math.PI / (n + 1));
    
    return {
        n: vertices,
        edges,
        edgeCount: edges.length,
        name: `Ladder L_${n}`,
        family: 'Ladder',
        spectralRadius: rho,
        analyticalRho: `2 + 2cos(π/${n+1})`,
        expectedAlpha: 0  // Bounded
    };
}

/**
 * Generate Prism graph (also called Circular Ladder) Pr_n
 * Cycle_n □ K_2 = two n-cycles connected by n rungs
 * Has 2n vertices and 3n edges
 */
function generatePrismGraph(n) {
    const vertices = 2 * n;
    const edges = [];
    
    // Top cycle: 0 - 1 - 2 - ... - (n-1) - 0
    for (let i = 0; i < n; i++) {
        edges.push([i, (i + 1) % n]);
    }
    
    // Bottom cycle: n - (n+1) - ... - (2n-1) - n
    for (let i = 0; i < n; i++) {
        edges.push([n + i, n + (i + 1) % n]);
    }
    
    // Rungs: connect i to i+n
    for (let i = 0; i < n; i++) {
        edges.push([i, i + n]);
    }
    
    // Spectral radius: 4 (3-regular graph)
    // Eigenvalues: 2cos(2πk/n) + 1 and 2cos(2πk/n) - 1 for k = 0, ..., n-1
    const rho = 3;  // For prism, max eigenvalue is 3 (degree)
    
    return {
        n: vertices,
        edges,
        edgeCount: edges.length,
        name: `Prism Pr_${n}`,
        family: 'Prism',
        spectralRadius: rho,
        analyticalRho: '3',
        expectedAlpha: 0  // Bounded (3-regular)
    };
}

/**
 * Generate Friendship graph (Windmill graph) F_n
 * n triangles sharing a single vertex
 * Has 2n+1 vertices and 3n edges
 * Spectral radius: (1 + √(1+8n))/2
 */
function generateFriendshipGraph(n) {
    const vertices = 2 * n + 1;
    const edges = [];
    
    // Central vertex is 0
    // Each triangle uses vertices (2i+1, 2i+2) for i = 0, ..., n-1
    for (let i = 0; i < n; i++) {
        const v1 = 2 * i + 1;
        const v2 = 2 * i + 2;
        
        // Triangle edges
        edges.push([0, v1]);    // Center to first
        edges.push([0, v2]);    // Center to second
        edges.push([v1, v2]);   // Edge of triangle
    }
    
    // Spectral radius: (1 + √(1+8n))/2
    const rho = (1 + Math.sqrt(1 + 8 * n)) / 2;
    
    return {
        n: vertices,
        edges,
        edgeCount: edges.length,
        name: `Friendship F_${n}`,
        family: 'Friendship',
        spectralRadius: rho,
        analyticalRho: `(1 + √${1 + 8*n})/2`,
        expectedAlpha: 0.5  // √n growth
    };
}

/**
 * Generate Crown graph S_n^0
 * Complete bipartite K_{n,n} minus a perfect matching
 * Has 2n vertices and n(n-1) edges
 * Regular with degree n-1
 */
function generateCrownGraph(n) {
    const vertices = 2 * n;
    const edges = [];
    
    // Vertices 0..n-1 in one partition, n..2n-1 in other
    // Connect i to all j except i+n
    for (let i = 0; i < n; i++) {
        for (let j = 0; j < n; j++) {
            if (i !== j) {  // Skip the perfect matching edge
                edges.push([i, n + j]);
            }
        }
    }
    
    // Spectral radius: n-1 (degree-regular)
    const rho = n - 1;
    
    return {
        n: vertices,
        edges,
        edgeCount: edges.length,
        name: `Crown S^0_${n}`,
        family: 'Crown',
        spectralRadius: rho,
        analyticalRho: `${n - 1}`,
        expectedAlpha: 0.5  // √n growth for spectral radius relative to 2n vertices
    };
}

/**
 * Generate Möbius ladder M_n
 * Like a ladder but with twisted ends (Möbius strip topology)
 * Has 2n vertices, 3n edges, is 3-regular
 */
function generateMoebiusLadder(n) {
    if (n < 3) n = 3;
    const vertices = 2 * n;
    const edges = [];
    
    // Two "rails" forming a cycle with twist
    // Top cycle: 0 - 1 - ... - (n-1) connecting to (2n-1) at end
    for (let i = 0; i < n - 1; i++) {
        edges.push([i, i + 1]);
    }
    edges.push([n - 1, 2 * n - 1]);  // Twist!
    
    // Bottom cycle: n - (n+1) - ... - (2n-1) connecting to 0 at end  
    for (let i = n; i < 2 * n - 1; i++) {
        edges.push([i, i + 1]);
    }
    edges.push([2 * n - 1, 0]);  // This creates the Möbius twist
    
    // Actually, let me redo this properly
    // Möbius ladder: vertices 0, 1, ..., 2n-1
    // Edges: i connected to (i+1) mod 2n, and i connected to (i+n) mod 2n
    const edgesSet = new Set();
    const addEdge = (a, b) => {
        const key = a < b ? `${a}-${b}` : `${b}-${a}`;
        if (!edgesSet.has(key)) {
            edgesSet.add(key);
            edges.length = 0; // Clear and rebuild
        }
    };
    
    // Rebuild edges correctly
    edges.length = 0;
    for (let i = 0; i < 2 * n; i++) {
        // Cycle edge
        const next = (i + 1) % (2 * n);
        if (i < next) edges.push([i, next]);
        else edges.push([next, i]);
        
        // Rung edge (with twist)
        const rung = (i + n) % (2 * n);
        if (i < rung) edges.push([i, rung]);
    }
    
    // Deduplicate
    const uniqueEdges = [...new Set(edges.map(e => e.sort((a,b) => a-b).join('-')))]
        .map(s => s.split('-').map(Number));
    
    // 3-regular, spectral radius = 3
    return {
        n: vertices,
        edges: uniqueEdges,
        edgeCount: uniqueEdges.length,
        name: `Möbius M_${n}`,
        family: 'Möbius',
        spectralRadius: 3,
        analyticalRho: '3',
        expectedAlpha: 0  // Bounded (3-regular)
    };
}

/**
 * Generate Book graph B_n (also called Stacked triangles)
 * n triangles sharing a common edge (the "spine")
 * Has n+2 vertices and 2n+1 edges
 */
function generateBookGraph(n) {
    const vertices = n + 2;
    const edges = [];
    
    // Spine edge: vertices 0 and 1
    edges.push([0, 1]);
    
    // Each page is a triangle with vertices 0, 1, and (i+2)
    for (let i = 0; i < n; i++) {
        edges.push([0, i + 2]);
        edges.push([1, i + 2]);
    }
    
    // Spectral radius depends on n
    // For book graph: ρ = (1 + √(1 + 4n)) / 2
    const rho = (1 + Math.sqrt(1 + 4 * n)) / 2;
    
    return {
        n: vertices,
        edges,
        edgeCount: edges.length,
        name: `Book B_${n}`,
        family: 'Book',
        spectralRadius: rho,
        analyticalRho: `(1 + √${1 + 4*n})/2`,
        expectedAlpha: 0.5  // √n growth
    };
}

/**
 * Generate Fan graph F_{1,n}
 * Path P_n with a universal vertex connected to all
 * Has n+1 vertices and 2n-1 edges
 */
function generateFanGraph(n) {
    const vertices = n + 1;
    const edges = [];
    
    // Path: 1 - 2 - 3 - ... - n (vertices 1 to n)
    for (let i = 1; i < n; i++) {
        edges.push([i, i + 1]);
    }
    
    // Universal vertex 0 connects to all path vertices
    for (let i = 1; i <= n; i++) {
        edges.push([0, i]);
    }
    
    // Spectral radius: approximately √(n + 1/4) + 1/2 for large n
    const rho = Math.sqrt(n + 0.25) + 0.5;
    
    return {
        n: vertices,
        edges,
        edgeCount: edges.length,
        name: `Fan F_{1,${n}}`,
        family: 'Fan',
        spectralRadius: rho,
        analyticalRho: `≈√${n} + O(1)`,
        expectedAlpha: 0.5  // √n growth
    };
}

/**
 * Generate Gear graph Ge_n
 * Wheel with an extra vertex between each spoke and the rim
 * Has 2n+1 vertices
 */
function generateGearGraph(n) {
    const vertices = 2 * n + 1;
    const edges = [];
    
    // Center vertex is 0
    // Inner vertices (spoke endpoints): 1, 2, ..., n
    // Outer vertices (gear teeth): n+1, n+2, ..., 2n
    
    // Spokes from center to inner vertices
    for (let i = 1; i <= n; i++) {
        edges.push([0, i]);
    }
    
    // Inner to outer vertices
    for (let i = 1; i <= n; i++) {
        edges.push([i, n + i]);
    }
    
    // Outer rim: connects adjacent teeth
    for (let i = 1; i <= n; i++) {
        const next = i === n ? 1 : i + 1;
        edges.push([n + i, n + next]);
    }
    
    // Spectral radius: approximately √n for large n
    const rho = Math.sqrt(n);
    
    return {
        n: vertices,
        edges,
        edgeCount: edges.length,
        name: `Gear Ge_${n}`,
        family: 'Gear',
        spectralRadius: rho,
        analyticalRho: `≈√${n}`,
        expectedAlpha: 0.25  // Slower than √n for vertices (2n+1 vertices, √n spectral radius)
    };
}

/**
 * Generate Helm graph H_n  
 * Wheel W_n with a pendant vertex attached to each rim vertex
 * Has 2n+1 vertices and 3n edges
 */
function generateHelmGraph(n) {
    const vertices = 2 * n + 1;
    const edges = [];
    
    // Center is 0
    // Rim vertices: 1, 2, ..., n
    // Pendant vertices: n+1, n+2, ..., 2n
    
    // Wheel part
    // Spokes
    for (let i = 1; i <= n; i++) {
        edges.push([0, i]);
    }
    
    // Rim cycle
    for (let i = 1; i <= n; i++) {
        const next = i === n ? 1 : i + 1;
        edges.push([i, next]);
    }
    
    // Pendant edges
    for (let i = 1; i <= n; i++) {
        edges.push([i, n + i]);
    }
    
    // Spectral radius: approximately √n for large n (similar to wheel)
    const rho = Math.sqrt(n);
    
    return {
        n: vertices,
        edges,
        edgeCount: edges.length,
        name: `Helm H_${n}`,
        family: 'Helm',
        spectralRadius: rho,
        analyticalRho: `≈√${n}`,
        expectedAlpha: 0.25  // Slower than √n for vertices
    };
}

/**
 * Generate Turán graph T(n,r)
 * Complete r-partite graph with parts as equal as possible
 * Maximizes edges among n vertices with no (r+1)-clique
 */
function generateTuranGraph(n, r) {
    if (r > n) r = n;
    const vertices = n;
    const edges = [];
    
    // Divide vertices into r parts as evenly as possible
    const baseSize = Math.floor(n / r);
    const extras = n % r;
    
    const partitions = [];
    let start = 0;
    for (let i = 0; i < r; i++) {
        const size = baseSize + (i < extras ? 1 : 0);
        partitions.push({ start, end: start + size });
        start += size;
    }
    
    // Connect all vertices in different partitions
    for (let p1 = 0; p1 < r; p1++) {
        for (let p2 = p1 + 1; p2 < r; p2++) {
            for (let i = partitions[p1].start; i < partitions[p1].end; i++) {
                for (let j = partitions[p2].start; j < partitions[p2].end; j++) {
                    edges.push([i, j]);
                }
            }
        }
    }
    
    // For balanced Turán graph, spectral radius ≈ n(1 - 1/r)
    const rho = (n - 1) * (1 - 1/r) + (1 - 1/r);  // Approximation
    
    return {
        n: vertices,
        edges,
        edgeCount: edges.length,
        name: `Turán T(${n},${r})`,
        family: 'Turán',
        spectralRadius: rho,
        analyticalRho: `≈${n}(1-1/${r})`,
        expectedAlpha: 1  // Linear growth (dense graph)
    };
}

/**
 * Generate Platonic solid graphs
 */
function generateTetrahedronGraph() {
    return {
        n: 4,
        edges: [[0,1], [0,2], [0,3], [1,2], [1,3], [2,3]],
        edgeCount: 6,
        name: 'Tetrahedron',
        family: 'Platonic',
        spectralRadius: 3,
        analyticalRho: '3',
        expectedAlpha: 0  // Bounded (3-regular, fixed size)
    };
}

function generateOctahedronGraph() {
    // 6 vertices, 12 edges, 4-regular
    return {
        n: 6,
        edges: [[0,1], [0,2], [0,3], [0,4], [1,2], [1,4], [1,5], [2,3], [2,5], [3,4], [3,5], [4,5]],
        edgeCount: 12,
        name: 'Octahedron',
        family: 'Platonic',
        spectralRadius: 4,
        analyticalRho: '4',
        expectedAlpha: 0  // Bounded
    };
}

function generateCubeGraph() {
    // 8 vertices, 12 edges, 3-regular (same as Hypercube Q_3)
    return {
        n: 8,
        edges: [[0,1], [0,2], [0,4], [1,3], [1,5], [2,3], [2,6], [3,7], [4,5], [4,6], [5,7], [6,7]],
        edgeCount: 12,
        name: 'Cube',
        family: 'Platonic',
        spectralRadius: 3,
        analyticalRho: '3',
        expectedAlpha: 0  // Bounded (3-regular)
    };
}

function generateIcosahedronGraph() {
    // 12 vertices, 30 edges, 5-regular
    const edges = [
        [0,1], [0,2], [0,3], [0,4], [0,5],
        [1,2], [2,3], [3,4], [4,5], [5,1],
        [1,6], [2,6], [2,7], [3,7], [3,8], [4,8], [4,9], [5,9], [5,10], [1,10],
        [6,7], [7,8], [8,9], [9,10], [10,6],
        [6,11], [7,11], [8,11], [9,11], [10,11]
    ];
    return {
        n: 12,
        edges,
        edgeCount: 30,
        name: 'Icosahedron',
        family: 'Platonic',
        spectralRadius: 5,
        analyticalRho: '5',
        expectedAlpha: 0  // Bounded (5-regular)
    };
}

function generateDodecahedronGraph() {
    // 20 vertices, 30 edges, 3-regular
    const edges = [
        [0,1], [1,2], [2,3], [3,4], [4,0],  // Pentagon 1
        [0,5], [1,6], [2,7], [3,8], [4,9],  // Connectors
        [5,10], [6,10], [6,11], [7,11], [7,12], [8,12], [8,13], [9,13], [9,14], [5,14],
        [10,15], [11,16], [12,17], [13,18], [14,19],
        [15,16], [16,17], [17,18], [18,19], [19,15]  // Pentagon 2
    ];
    return {
        n: 20,
        edges,
        edgeCount: 30,
        name: 'Dodecahedron',
        family: 'Platonic',
        spectralRadius: 3,
        analyticalRho: '3',
        expectedAlpha: 0  // Bounded (3-regular)
    };
}

// =====================================================
// PHYSICS ENGINE PANEL
// =====================================================

/**
 * Setup physics panel event listeners and initialization
 */
function setupPhysicsPanel() {
    // Audit button
    if (physicsAuditBtn) {
        physicsAuditBtn.addEventListener('click', performPhysicsAudit);
    }
    
    // Auto-discover partition button
    if (physicsAutoDiscoverBtn) {
        physicsAutoDiscoverBtn.addEventListener('click', autoDiscoverPartition);
    }
    
    // Rectify Yes button
    if (physicsRectifyYesBtn) {
        physicsRectifyYesBtn.addEventListener('click', performPhysicsRectification);
    }
    
    // Undo button
    if (physicsUndoBtn) {
        physicsUndoBtn.addEventListener('click', undoPhysicsRectification);
    }
    
    // Toggle B-matrix button
    if (physicsToggleBMatrixBtn) {
        physicsToggleBMatrixBtn.addEventListener('click', toggleBMatrixDisplay);
    }
    
    // N value input (always visible now)
    if (physicsNValue) {
        physicsNValue.addEventListener('change', () => {
            // Reset partition and re-audit
            physicsPartition = { pIndices: [], qIndices: [] };
            originalMatrixBackup = null; // Clear backup
            hideRectificationUI();
            performPhysicsAudit();
        });
    }
    
    // Play/Pause button
    if (physicsPlayBtn) {
        physicsPlayBtn.addEventListener('click', togglePhysicsAnimation);
    }
    
    // Reset button
    if (physicsResetBtn) {
        physicsResetBtn.addEventListener('click', resetPhysicsAnimation);
    }
    
    // Auto-audit checkbox
    if (physicsAutoAuditCheckbox) {
        physicsAutoAuditCheckbox.addEventListener('change', (e) => {
            console.log('[Physics] Auto-audit:', e.target.checked ? 'enabled' : 'disabled');
        });
    }
    
    // Initial audit
    setTimeout(() => {
        if (state.adjacencyMatrix && state.adjacencyMatrix.length > 0) {
            performPhysicsAudit();
        }
    }, 500);
    
    console.log('[Physics] Panel initialized with rectification support');
}

/**
 * Hide rectification UI elements
 */
function hideRectificationUI() {
    if (physicsRectifyPrompt) physicsRectifyPrompt.style.display = 'none';
    if (physicsUndoPanel) physicsUndoPanel.style.display = 'none';
    
    // Also hide the partition suggestion panel
    const suggestionPanel = document.getElementById('physics-partition-suggestion');
    if (suggestionPanel) suggestionPanel.style.display = 'none';
}

/**
 * Show rectification prompt (when non-realizable)
 */
function showRectifyPrompt() {
    if (physicsRectifyPrompt) physicsRectifyPrompt.style.display = 'block';
    if (physicsUndoPanel) physicsUndoPanel.style.display = 'none';
}

/**
 * Show undo panel (after rectification)
 */
function showUndoPanel() {
    if (physicsRectifyPrompt) physicsRectifyPrompt.style.display = 'none';
    if (physicsUndoPanel) physicsUndoPanel.style.display = 'block';
}

/**
 * Toggle B-matrix display
 */
function toggleBMatrixDisplay() {
    if (!physicsBMatrixContainer) return;
    
    const isVisible = physicsBMatrixContainer.style.display !== 'none';
    
    if (isVisible) {
        physicsBMatrixContainer.style.display = 'none';
        if (physicsToggleBMatrixBtn) physicsToggleBMatrixBtn.textContent = 'Show';
    } else {
        physicsBMatrixContainer.style.display = 'block';
        if (physicsToggleBMatrixBtn) physicsToggleBMatrixBtn.textContent = 'Hide';
        
        if (currentPhysicsEngine && physicsBMatrixContent) {
            physicsBMatrixContent.textContent = currentPhysicsEngine.formatBMatrix();
        }
    }
}

/**
 * Get current physics settings (N value)
 */
function getPhysicsN() {
    return physicsNValue ? parseInt(physicsNValue.value) : Math.floor(state.adjacencyMatrix.length / 2);
}

/**
 * Perform physics audit and update UI
 */
function performPhysicsAudit() {
    if (!state.adjacencyMatrix || state.adjacencyMatrix.length === 0) {
        updatePhysicsUINoGraph();
        return null;
    }
    
    const matrixSize = state.adjacencyMatrix.length;
    
    // Thresholds for different operations
    const MAX_SIZE_FOR_FULL_AUDIT = 100;  // Full column analysis
    const MAX_SIZE_FOR_GRID = 40;          // Interactive partition grid
    
    const isLargeGraph = matrixSize > MAX_SIZE_FOR_FULL_AUDIT;
    
    try {
        
        // ALWAYS discover partition for any size graph (BFS is O(n+e), fast)
        // But respect template-provided partitions if they're valid
        const partitionTotal = physicsPartition.pIndices.length + physicsPartition.qIndices.length;
        const partitionMax = Math.max(
            ...physicsPartition.pIndices, 
            ...physicsPartition.qIndices, 
            -1
        );
        
        const needsNewPartition = partitionTotal !== matrixSize || partitionMax >= matrixSize;
        
        if (needsNewPartition) {
            console.log(`[Physics] Partition invalid for n=${matrixSize}, attempting auto-discovery...`);
            
            // Try automatic bipartite partition discovery
            const { engine: testEngine, discovery } = PhysicsEngine.createWithOptimalPartition(state.adjacencyMatrix);
            
            if (discovery.isBipartite) {
                console.log('[Physics] Bipartite partition found:', discovery.reason);
                console.log('[Physics] Mode:', testEngine.mode);
                
                // Use the partition from the engine (may have been swapped for realizability)
                physicsPartition.pIndices = [...testEngine.pIndices];
                physicsPartition.qIndices = [...testEngine.qIndices];
                
                // Update N input to match discovered partition
                if (physicsNValue) {
                    physicsNValue.value = testEngine.pIndices.length;
                }
                
                // Store engine for later use
                currentPhysicsEngine = testEngine;
            } else {
                console.log('[Physics] Graph not bipartite:', discovery.reason);
                // Fall back to sequential partition
                const N = physicsNValue ? parseInt(physicsNValue.value) : Math.floor(matrixSize / 2);
                physicsPartition.pIndices = Array.from({ length: N }, (_, i) => i);
                physicsPartition.qIndices = Array.from({ length: matrixSize - N }, (_, i) => N + i);
                
                // Create engine with sequential partition
                currentPhysicsEngine = new PhysicsEngine(state.adjacencyMatrix, N);
            }
        } else {
            // Valid partition exists (likely from template) - use it
            console.log(`[Physics] Using existing partition: p=${physicsPartition.pIndices.length}, q=${physicsPartition.qIndices.length}`);
            
            // Update N input to match
            if (physicsNValue) {
                physicsNValue.value = physicsPartition.pIndices.length;
            }
            
            // Create engine with template partition
            currentPhysicsEngine = new PhysicsEngine(
                state.adjacencyMatrix,
                null,
                physicsPartition.pIndices,
                physicsPartition.qIndices
            );
        }
        
        // Build partition grid (shows message for large graphs)
        buildPartitionGrid(matrixSize);
        
        // For large graphs, skip expensive full audit but show partition info
        if (isLargeGraph) {
            console.log(`[Physics] Graph large (n=${matrixSize}), skipping full audit`);
            
            // Show simplified status for large graphs
            if (physicsAuditResult) {
                const isBipartite = physicsPartition.pIndices.length > 0 && physicsPartition.qIndices.length > 0;
                const N = physicsPartition.pIndices.length;
                const M = physicsPartition.qIndices.length;
                
                physicsAuditResult.innerHTML = `
                    <div style="color:#ff9800;">
                        <strong>Large Graph (n=${matrixSize})</strong><br>
                        Full audit skipped for performance.<br><br>
                        <span style="color:#4fc3f7;">Partition discovered:</span><br>
                        N (masses) = ${N}<br>
                        M (springs) = ${M}<br>
                        ${isBipartite ? '<span style="color:#4ade80;">✓ Graph is bipartite</span>' : '<span style="color:#f87171;">✗ Graph not bipartite</span>'}
                    </div>`;
            }
            
            // Update status badge
            if (physicsStatusBadge) {
                physicsStatusBadge.textContent = 'LARGE GRAPH';
                physicsStatusBadge.className = 'status-badge status-warning';
            }
            
            // Still update node colors based on partition
            updateNodePartitionColors(physicsPartition.pIndices, physicsPartition.qIndices, []);
            
            return null;  // Skip full audit
        }
        
        // For smaller graphs, continue with full audit
        // Create engine with current partition if not already created
        if (!currentPhysicsEngine || needsNewPartition) {
            if (physicsPartition.pIndices.length > 0 && physicsPartition.qIndices.length > 0) {
                currentPhysicsEngine = new PhysicsEngine(
                    state.adjacencyMatrix,
                    null,
                    physicsPartition.pIndices,
                    physicsPartition.qIndices
                );
            } else {
                // Fallback
                const actualN = physicsNValue ? parseInt(physicsNValue.value) : Math.floor(matrixSize / 2);
                currentPhysicsEngine = new PhysicsEngine(state.adjacencyMatrix, actualN);
                physicsPartition.pIndices = [...currentPhysicsEngine.pIndices];
                physicsPartition.qIndices = [...currentPhysicsEngine.qIndices];
            }
        }
        
        updatePartitionGrid();
        
        // Initialize state with random perturbation
        currentPhysicsEngine.initializeState('random', 1.0);
        
        const report = currentPhysicsEngine.audit();
        const energy = currentPhysicsEngine.getHamiltonian();
        
        // Update node colors based on partition and grounded status
        // p=blue, q=orange, grounded q=teal
        const groundedQIndices = [];
        if (report.columnAnalysis) {
            for (const col of report.columnAnalysis) {
                if (col.isGrounded) {
                    // Get the global q-node index for this grounded column
                    groundedQIndices.push(col.globalIndex);
                }
            }
        }
        updateNodePartitionColors(physicsPartition.pIndices, physicsPartition.qIndices, groundedQIndices);
        
        updatePhysicsUI(report, energy);
        
        // Update B-matrix if visible
        if (physicsBMatrixContainer && physicsBMatrixContainer.style.display !== 'none') {
            if (physicsBMatrixContent) {
                physicsBMatrixContent.textContent = currentPhysicsEngine.formatBMatrix();
            }
        }
        
        // Update column analysis
        updateColumnAnalysis(report.columnAnalysis);
        
        // Build state cells
        buildStateCells();
        
        // Reset energy history
        resetEnergyHistory();
        
        // Show/hide rectification UI based on result
        if (!report.isPhysical && !originalMatrixBackup) {
            // Show rectification prompt (only if not already rectified)
            showRectifyPrompt();
        } else if (originalMatrixBackup) {
            // Show undo panel (if we have a backup, graph was rectified)
            showUndoPanel();
        } else {
            // Physical - hide all rectification UI
            hideRectificationUI();
        }
        
        console.log('[Physics] Audit complete:', report.isPhysical ? 'REALIZABLE' : 'NOT REALIZABLE');
        console.log('[Physics] Mode:', currentPhysicsEngine.mode);
        console.log('[Physics] N =', currentPhysicsEngine.N, ', M =', currentPhysicsEngine.M);
        console.log('[Physics] p =', currentPhysicsEngine.pIndices, ', q =', currentPhysicsEngine.qIndices);
        return report;
    } catch (e) {
        console.error('[Physics] Audit error:', e);
        return null;
    }
}

/**
 * Force auto-discovery of optimal bipartite partition
 */
function autoDiscoverPartition() {
    if (!state.adjacencyMatrix || state.adjacencyMatrix.length === 0) {
        showPhysicsToast('No graph loaded', 'warning');
        return;
    }
    
    const discovery = PhysicsEngine.discoverBipartitePartition(state.adjacencyMatrix);
    
    if (discovery.isBipartite) {
        // Apply discovered partition
        physicsPartition.pIndices = [...discovery.pIndices];
        physicsPartition.qIndices = [...discovery.qIndices];
        
        // Update N input
        if (physicsNValue) {
            physicsNValue.value = discovery.pIndices.length;
        }
        
        // Clear rectification state
        originalMatrixBackup = null;
        
        // Re-run audit with new partition
        performPhysicsAudit();
        
        showPhysicsToast(`✓ Found bipartite partition: ${discovery.pIndices.length}p + ${discovery.qIndices.length}q`);
    } else {
        showPhysicsToast(`Graph not bipartite: ${discovery.reason}`, 'warning');
    }
}

/**
 * Build the clickable partition grid
 */
function buildPartitionGrid(matrixSize) {
    if (!physicsNodeGrid) return;
    
    // Skip for large graphs to prevent UI slowdown
    const MAX_GRID_SIZE = 40;
    if (matrixSize > MAX_GRID_SIZE) {
        physicsNodeGrid.innerHTML = `<span style="color:#888;font-size:0.85em;">Grid disabled for n>${MAX_GRID_SIZE}</span>`;
        return;
    }
    
    // Initialize partition if empty
    if (physicsPartition.pIndices.length === 0 && physicsPartition.qIndices.length === 0) {
        const N = physicsNValue ? parseInt(physicsNValue.value) : Math.floor(matrixSize / 2);
        physicsPartition.pIndices = [];
        physicsPartition.qIndices = [];
        for (let i = 0; i < N; i++) {
            physicsPartition.pIndices.push(i);
        }
        for (let i = N; i < matrixSize; i++) {
            physicsPartition.qIndices.push(i);
        }
    }
    
    // Use Set for O(1) lookup instead of includes() which is O(n)
    const pSet = new Set(physicsPartition.pIndices);
    
    // Build buttons
    let html = '';
    for (let i = 0; i < matrixSize; i++) {
        const isP = pSet.has(i);
        const cls = isP ? 'is-p' : 'is-q';
        html += `<button class="physics-node-btn ${cls}" data-index="${i}" onclick="toggleNodePartition(${i})">${i}</button>`;
    }
    physicsNodeGrid.innerHTML = html;
    
    updatePartitionSummary();
}

/**
 * Update the partition grid button states
 */
function updatePartitionGrid() {
    if (!physicsNodeGrid) return;
    
    const buttons = physicsNodeGrid.querySelectorAll('.physics-node-btn');
    buttons.forEach(btn => {
        const idx = parseInt(btn.dataset.index);
        const isP = physicsPartition.pIndices.includes(idx);
        btn.className = `physics-node-btn ${isP ? 'is-p' : 'is-q'}`;
    });
    
    updatePartitionSummary();
}

/**
 * Update the partition summary display
 */
function updatePartitionSummary() {
    if (physicsPIndices) {
        physicsPIndices.textContent = physicsPartition.pIndices.length > 0 
            ? `{${physicsPartition.pIndices.sort((a,b) => a-b).join(', ')}}` 
            : '∅';
    }
    if (physicsQIndices) {
        physicsQIndices.textContent = physicsPartition.qIndices.length > 0 
            ? `{${physicsPartition.qIndices.sort((a,b) => a-b).join(', ')}}` 
            : '∅';
    }
}

/**
 * Toggle a node between p (momentum) and q (displacement)
 */
window.toggleNodePartition = function(nodeIndex) {
    const pIdx = physicsPartition.pIndices.indexOf(nodeIndex);
    const qIdx = physicsPartition.qIndices.indexOf(nodeIndex);
    
    if (pIdx !== -1) {
        // Move from p to q
        physicsPartition.pIndices.splice(pIdx, 1);
        physicsPartition.qIndices.push(nodeIndex);
    } else if (qIdx !== -1) {
        // Move from q to p
        physicsPartition.qIndices.splice(qIdx, 1);
        physicsPartition.pIndices.push(nodeIndex);
    }
    
    // Update UI
    updatePartitionGrid();
    
    // Re-run audit with new partition (this will also update colors with grounded info)
    if (physicsPartition.pIndices.length > 0 && physicsPartition.qIndices.length > 0) {
        runAuditWithCustomPartition();
    } else {
        // No valid partition yet - just color without grounded info
        updateNodePartitionColors(physicsPartition.pIndices, physicsPartition.qIndices);
    }
};

/**
 * Run audit with the current custom partition
 */
function runAuditWithCustomPartition() {
    if (!state.adjacencyMatrix || state.adjacencyMatrix.length === 0) return;
    
    try {
        currentPhysicsEngine = new PhysicsEngine(
            state.adjacencyMatrix, 
            null,
            physicsPartition.pIndices,
            physicsPartition.qIndices
        );
        
        currentPhysicsEngine.initializeState('random', 1.0);
        
        const report = currentPhysicsEngine.audit();
        const energy = currentPhysicsEngine.getHamiltonian();
        
        // Update node colors with grounded info (p=blue, q=orange, grounded=teal)
        const groundedQIndices = [];
        if (report.columnAnalysis) {
            for (const col of report.columnAnalysis) {
                if (col.isGrounded) {
                    groundedQIndices.push(col.globalIndex);
                }
            }
        }
        updateNodePartitionColors(physicsPartition.pIndices, physicsPartition.qIndices, groundedQIndices);
        
        updatePhysicsUI(report, energy);
        
        if (physicsBMatrixContainer && physicsBMatrixContainer.style.display !== 'none') {
            if (physicsBMatrixContent) {
                physicsBMatrixContent.textContent = currentPhysicsEngine.formatBMatrix();
            }
        }
        
        updateColumnAnalysis(report.columnAnalysis);
        buildStateCells();
        resetEnergyHistory();
        
        console.log('[Physics] Custom partition audit:', report.isPhysical ? 'PHYSICAL' : 'NON-PHYSICAL');
        console.log('[Physics] p =', physicsPartition.pIndices, ', q =', physicsPartition.qIndices);
        if (groundedQIndices.length > 0) {
            console.log('[Physics] Grounded q-nodes:', groundedQIndices);
        }
    } catch (e) {
        console.error('[Physics] Custom partition audit error:', e);
    }
}

/**
 * Build state cells for p and q visualization
 */
function buildStateCells() {
    if (!currentPhysicsEngine) return;
    
    const N = currentPhysicsEngine.N;
    const M = currentPhysicsEngine.M;
    const pIndices = currentPhysicsEngine.pIndices || Array.from({length: N}, (_, i) => i);
    const qIndices = currentPhysicsEngine.qIndices || Array.from({length: M}, (_, i) => N + i);
    
    // Build p cells (momentum) - show actual indices
    if (physicsPStates) {
        let html = '';
        for (let i = 0; i < N; i++) {
            const actualIdx = pIndices[i];
            html += `<div class="physics-state-cell p-cell" id="p-cell-${i}" title="p[${actualIdx}]">${actualIdx}</div>`;
        }
        physicsPStates.innerHTML = html;
    }
    
    // Build q cells (displacement) - show actual indices
    if (physicsQStates) {
        let html = '';
        for (let j = 0; j < M; j++) {
            const actualIdx = qIndices[j];
            html += `<div class="physics-state-cell q-cell" id="q-cell-${j}" title="q[${actualIdx}]">${actualIdx}</div>`;
        }
        physicsQStates.innerHTML = html;
    }
}

/**
 * Update state cell visualization based on current state vector
 */
function updateStateCells() {
    if (!currentPhysicsEngine) return;
    
    const x = currentPhysicsEngine.stateVector;
    const N = currentPhysicsEngine.N;
    const M = currentPhysicsEngine.M;
    
    // Find max value for normalization
    const maxVal = Math.max(...x.map(Math.abs), 0.001);
    
    // Update p cells (momentum states - full size, vibrant)
    for (let i = 0; i < N; i++) {
        const cell = document.getElementById(`p-cell-${i}`);
        if (cell) {
            const val = x[i];
            const intensity = Math.abs(val) / maxVal;
            const alpha = 0.2 + intensity * 0.6;
            cell.style.background = `rgba(248, 113, 113, ${alpha})`;
            cell.style.transform = `scale(${0.9 + intensity * 0.2})`;
            cell.title = `p${i} = ${val.toFixed(3)}`;
        }
    }
    
    // Update q cells (displacement states - smaller, more subtle animation)
    for (let j = 0; j < M; j++) {
        const cell = document.getElementById(`q-cell-${j}`);
        if (cell) {
            const val = x[N + j];
            const intensity = Math.abs(val) / maxVal;
            // More subtle opacity range for q cells
            const alpha = 0.15 + intensity * 0.45;
            cell.style.background = `rgba(79, 209, 197, ${alpha})`;
            // Smaller scale range for smaller cells
            cell.style.transform = `scale(${0.92 + intensity * 0.12})`;
            cell.title = `q${j} = ${val.toFixed(3)}`;
        }
    }
}

/**
 * Reset energy history
 */
function resetEnergyHistory() {
    physicsEnergyHistory = { t: [], T: [], V: [], H: [] };
    physicsTime = 0;
    if (physicsTimeValue) physicsTimeValue.textContent = '0.00';
}

/**
 * Toggle physics animation play/pause
 */
function togglePhysicsAnimation() {
    if (physicsIsPlaying) {
        stopPhysicsAnimation();
    } else {
        startPhysicsAnimation();
    }
}

/**
 * Start physics animation
 */
function startPhysicsAnimation() {
    if (!currentPhysicsEngine) {
        performPhysicsAudit();
    }
    
    physicsIsPlaying = true;
    if (physicsPlayBtn) {
        physicsPlayBtn.textContent = '⏸';
        physicsPlayBtn.classList.add('playing');
    }
    
    physicsAnimationLoop();
}

/**
 * Stop physics animation
 */
function stopPhysicsAnimation() {
    physicsIsPlaying = false;
    if (physicsAnimationId) {
        cancelAnimationFrame(physicsAnimationId);
        physicsAnimationId = null;
    }
    if (physicsPlayBtn) {
        physicsPlayBtn.textContent = '▶';
        physicsPlayBtn.classList.remove('playing');
    }
}

/**
 * Reset physics animation
 */
function resetPhysicsAnimation() {
    stopPhysicsAnimation();
    
    if (currentPhysicsEngine) {
        currentPhysicsEngine.initializeState('random', 1.0);
    }
    
    resetEnergyHistory();
    updateStateCells();
    
    const energy = currentPhysicsEngine ? currentPhysicsEngine.getHamiltonian() : null;
    if (energy) {
        updatePhysicsEnergyValues(energy);
    }
    
    clearEnergyCanvas();
}

/**
 * Physics animation loop
 */
function physicsAnimationLoop() {
    if (!physicsIsPlaying || !currentPhysicsEngine) return;
    
    // Step the simulation
    physicsSimulationStep();
    
    // Update visualization
    updateStateCells();
    
    // Update energy display
    const energy = currentPhysicsEngine.getHamiltonian();
    updatePhysicsEnergyValues(energy);
    
    // Record history and plot
    recordEnergyHistory(energy);
    plotEnergyHistory();
    
    // Update time
    physicsTime += PHYSICS_DT;
    if (physicsTimeValue) {
        physicsTimeValue.textContent = physicsTime.toFixed(2);
    }
    
    // Check conservation
    checkEnergyConservation();
    
    // Continue loop
    physicsAnimationId = requestAnimationFrame(physicsAnimationLoop);
}

/**
 * Single simulation step using Cayley transform (energy-conserving)
 * The Cayley transform is orthogonal for skew-symmetric matrices,
 * exactly preserving ||x||² and thus the Hamiltonian H = ½||x||²
 */
function physicsSimulationStep() {
    if (!currentPhysicsEngine) return;
    
    const dt = PHYSICS_DT * 2; // Simulation speed factor
    
    // Use Cayley integrator (energy-conserving)
    currentPhysicsEngine.stepCayley(dt);
}

/**
 * Update physics panel energy display values
 */
function updatePhysicsEnergyValues(energy) {
    if (!energy) return;
    
    if (physicsLiveKinetic) {
        physicsLiveKinetic.textContent = energy.kinetic.toFixed(3);
    }
    if (physicsLivePotential) {
        physicsLivePotential.textContent = energy.potential.toFixed(3);
    }
    if (physicsLiveTotal) {
        physicsLiveTotal.textContent = energy.total.toFixed(3);
    }
}

/**
 * Record energy to history
 */
function recordEnergyHistory(energy) {
    if (!energy) return;
    
    physicsEnergyHistory.t.push(physicsTime);
    physicsEnergyHistory.T.push(energy.kinetic);
    physicsEnergyHistory.V.push(energy.potential);
    physicsEnergyHistory.H.push(energy.total);
    
    // Trim to max length
    if (physicsEnergyHistory.t.length > PHYSICS_HISTORY_LENGTH) {
        physicsEnergyHistory.t.shift();
        physicsEnergyHistory.T.shift();
        physicsEnergyHistory.V.shift();
        physicsEnergyHistory.H.shift();
    }
}

/**
 * Plot energy history on canvas
 */
function plotEnergyHistory() {
    if (!physicsEnergyCanvas) return;
    
    const ctx = physicsEnergyCanvas.getContext('2d');
    const width = physicsEnergyCanvas.width;
    const height = physicsEnergyCanvas.height;
    
    // Clear canvas
    ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
    ctx.fillRect(0, 0, width, height);
    
    const history = physicsEnergyHistory;
    if (history.t.length < 2) return;
    
    // Find Y range
    const allValues = [...history.T, ...history.V, ...history.H];
    const maxY = Math.max(...allValues, 0.1);
    const minY = Math.min(...allValues, 0);
    const rangeY = maxY - minY || 1;
    
    // Draw grid lines
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
        const y = height * i / 4;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
    }
    
    // Scale functions
    const scaleX = (i) => (i / (PHYSICS_HISTORY_LENGTH - 1)) * width;
    const scaleY = (v) => height - ((v - minY) / rangeY) * (height - 10) - 5;
    
    // Draw T (kinetic) - red
    ctx.strokeStyle = '#F87171';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    history.T.forEach((v, i) => {
        const x = scaleX(i);
        const y = scaleY(v);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
    });
    ctx.stroke();
    
    // Draw V (potential) - cyan
    ctx.strokeStyle = '#4FD1C5';
    ctx.beginPath();
    history.V.forEach((v, i) => {
        const x = scaleX(i);
        const y = scaleY(v);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
    });
    ctx.stroke();
    
    // Draw H (total) - yellow, thicker
    ctx.strokeStyle = '#FBBF24';
    ctx.lineWidth = 2;
    ctx.beginPath();
    history.H.forEach((v, i) => {
        const x = scaleX(i);
        const y = scaleY(v);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
    });
    ctx.stroke();
}

/**
 * Clear energy canvas
 */
function clearEnergyCanvas() {
    if (!physicsEnergyCanvas) return;
    const ctx = physicsEnergyCanvas.getContext('2d');
    ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
    ctx.fillRect(0, 0, physicsEnergyCanvas.width, physicsEnergyCanvas.height);
}

/**
 * Check and display energy conservation status
 */
function checkEnergyConservation() {
    if (!physicsConservationStatus || physicsEnergyHistory.H.length < 10) return;
    
    const H = physicsEnergyHistory.H;
    const initial = H[0];
    const current = H[H.length - 1];
    const drift = Math.abs(current - initial) / (initial || 1);
    
    if (drift < 0.01) {
        physicsConservationStatus.textContent = 'Energy Conserved ✓';
        physicsConservationStatus.className = 'physics-conservation-ok';
    } else if (drift < 0.05) {
        physicsConservationStatus.textContent = `Drift: ${(drift * 100).toFixed(1)}%`;
        physicsConservationStatus.className = 'physics-conservation-warning';
    } else {
        physicsConservationStatus.textContent = `Drift: ${(drift * 100).toFixed(1)}%`;
        physicsConservationStatus.className = 'physics-conservation-warning';
    }
}

/**
 * Update column analysis display
 */
function updateColumnAnalysis(columnAnalysis) {
    if (!physicsColumnAnalysis || !physicsColumnList || !columnAnalysis || !currentPhysicsEngine) {
        return;
    }
    
    // Count violations
    const violationCount = columnAnalysis.filter(c => !c.isValid).length;
    const totalCount = columnAnalysis.length;
    
    // Update header with violation count
    const header = physicsColumnAnalysis.querySelector('.physics-column-header');
    if (header) {
        if (violationCount > 0) {
            header.innerHTML = `Column Analysis <span class="violation-count">(${violationCount}/${totalCount} violations)</span>`;
        } else {
            header.innerHTML = `Column Analysis <span class="all-valid">(all ${totalCount} valid ✓)</span>`;
        }
    }
    
    // Show the section
    physicsColumnAnalysis.style.display = 'block';
    
    // Build column list HTML - show invalid columns first
    const sortedAnalysis = [...columnAnalysis].sort((a, b) => {
        if (a.isValid === b.isValid) return a.columnIndex - b.columnIndex;
        return a.isValid ? 1 : -1;  // Invalid first
    });
    
    let html = '';
    for (const col of sortedAnalysis) {
        const statusIcon = col.isValid ? '✓' : '✗';
        const statusClass = col.isValid ? 'valid' : 'invalid';
        const sumClass = col.sum === 0 ? 'zero' : 'nonzero';
        
        // Get the actual column index (from qIndices if custom partition)
        const actualColIndex = currentPhysicsEngine.qIndices 
            ? currentPhysicsEngine.qIndices[col.columnIndex] 
            : col.globalIndex;
        
        // Format the column values with actual p indices
        const values = [];
        for (let i = 0; i < currentPhysicsEngine.N; i++) {
            // Safety check for B matrix bounds
            if (!currentPhysicsEngine.B || !currentPhysicsEngine.B[i]) {
                values.push('?');
                continue;
            }
            const val = currentPhysicsEngine.B[i][col.columnIndex];
            if (val === undefined || val === null) {
                values.push('?');
            } else if (val === 1) {
                values.push(`+1`);
            } else if (val === -1) {
                values.push(`-1`);
            } else if (val === 0) {
                values.push(` 0`);
            } else {
                values.push(val.toString().padStart(2));
            }
        }
        
        // Add violation reason for invalid columns
        const violationReason = !col.isValid ? 
            `<div class="physics-column-violation">${col.violation || 'Newton violation'}</div>` : '';
        
        html += `<div class="physics-column-item ${statusClass}">
            <div class="physics-column-main">
                <span class="physics-column-index">q[${actualColIndex !== undefined ? actualColIndex : '?'}]:</span>
                <span class="physics-column-values">[${values.join(', ')}]ᵀ</span>
            </div>
            <div class="physics-column-info">
                <span class="physics-column-sum ${sumClass}">Σ = ${col.sum}</span>
                <span class="physics-column-status">${statusIcon}</span>
            </div>
            ${violationReason}
        </div>`;
    }
    
    physicsColumnList.innerHTML = html;
}

/**
 * Perform physics rectification
 * Stores the original matrix for undo and applies rectification
 */
function performPhysicsRectification() {
    if (!currentPhysicsEngine || !state.adjacencyMatrix) {
        console.error('[Physics] No engine or matrix available for rectification');
        return null;
    }
    
    try {
        // Set flag to prevent auto-audit from overwriting our results
        window._skipPhysicsAutoAudit = true;
        
        // Store backup of original matrix (deep copy)
        originalMatrixBackup = state.adjacencyMatrix.map(row => [...row]);
        
        const result = currentPhysicsEngine.autoRectify();
        
        // Check for partition incompatibility (pre-check detected would disconnect)
        if (result.wouldDisconnect) {
            console.warn('[Physics] Rectification would disconnect the graph!');
            console.log('[Physics] Reason:', result.reason);
            console.log('[Physics] Message:', result.message);
            
            // Restore original matrix
            state.adjacencyMatrix = originalMatrixBackup.map(row => [...row]);
            originalMatrixBackup = null;
            
            // Reset flag
            window._skipPhysicsAutoAudit = false;
            
            // Hide rectification prompt
            hideRectificationUI();
            
            if (result.reason === 'partition_incompatible' && result.suggestedPartition) {
                // Offer to apply the suggested bipartite partition
                const suggested = result.suggestedPartition;
                console.log('[Physics] Suggested partition:', suggested);
                
                // Show a more helpful message with the suggestion
                const pStr = '{' + suggested.pIndices.slice(0, 8).join(', ') + (suggested.pIndices.length > 8 ? ', ...' : '') + '}';
                const qStr = '{' + suggested.qIndices.slice(0, 8).join(', ') + (suggested.qIndices.length > 8 ? ', ...' : '') + '}';
                
                // Store suggested partition for the apply button
                window._suggestedPartition = suggested;
                
                // Show the partition suggestion panel
                const suggestionPanel = document.getElementById('physics-partition-suggestion');
                const suggestionMessage = document.getElementById('physics-suggestion-message');
                const suggestedP = document.getElementById('physics-suggested-p');
                const suggestedQ = document.getElementById('physics-suggested-q');
                const applyBtn = document.getElementById('physics-apply-partition-btn');
                
                if (suggestionPanel) {
                    suggestionPanel.style.display = 'block';
                    
                    if (suggestionMessage) {
                        suggestionMessage.textContent = 'The graph is bipartite. For realizability, all edges must connect p-nodes to q-nodes. The current partition has same-type connections that would disconnect the graph.';
                    }
                    
                    if (suggestedP) suggestedP.textContent = pStr;
                    if (suggestedQ) suggestedQ.textContent = qStr;
                    
                    // Set up apply button handler
                    if (applyBtn) {
                        // Remove any existing listeners
                        const newApplyBtn = applyBtn.cloneNode(true);
                        applyBtn.parentNode.replaceChild(newApplyBtn, applyBtn);
                        
                        newApplyBtn.addEventListener('click', () => {
                            if (window._suggestedPartition) {
                                // Apply the suggested partition
                                physicsPartition.pIndices = [...window._suggestedPartition.pIndices];
                                physicsPartition.qIndices = [...window._suggestedPartition.qIndices];
                                
                                // Update N value input
                                if (physicsNValue) {
                                    physicsNValue.value = physicsPartition.pIndices.length;
                                }
                                
                                // Update partition grid
                                updatePartitionGrid();
                                
                                // Hide suggestion panel
                                suggestionPanel.style.display = 'none';
                                
                                // Re-create engine with new partition
                                currentPhysicsEngine = new PhysicsEngine(
                                    state.adjacencyMatrix,
                                    null,
                                    physicsPartition.pIndices,
                                    physicsPartition.qIndices
                                );
                                
                                // Re-run audit
                                showPhysicsToast('✓ Bipartite partition applied', 'success');
                                performPhysicsAudit();
                                
                                window._suggestedPartition = null;
                            }
                        });
                    }
                }
                
                // Update status to show warning
                const statusIndicator = document.getElementById('physics-status-indicator');
                const statusText = document.getElementById('physics-status-text');
                if (statusIndicator) {
                    statusIndicator.className = 'physics-status-dot status-warning';
                }
                if (statusText) {
                    statusText.innerHTML = '<span style="color:#f59e0b;">Partition incompatible</span>';
                }
                
                showPhysicsToast('Partition incompatible - bipartite partition suggested', 'warning');
            } else if (result.reason === 'not_bipartite') {
                // Graph is not bipartite - cannot be fixed by partition change
                showPhysicsToast('Graph is not bipartite - cannot be realized as port-Hamiltonian', 'error');
                
                // Update status to show error
                const statusIndicator = document.getElementById('physics-status-indicator');
                const statusText = document.getElementById('physics-status-text');
                if (statusIndicator) {
                    statusIndicator.className = 'physics-status-dot status-error';
                }
                if (statusText) {
                    statusText.innerHTML = '<span style="color:#f87171;">Not bipartite - cannot be physical</span>';
                }
            } else {
                // Generic disconnection error
                showPhysicsToast(`Rectification failed: would create ${result.connectivity.componentCount} disconnected components`, 'warning');
            }
            
            return null;
        }
        
        // Check for disconnection (after actual rectification)
        if (result.connectivity && !result.connectivity.isConnected) {
            console.warn('[Physics] Rectification would disconnect the graph!');
            console.log('[Physics] Components:', result.connectivity.componentCount);
            
            // Restore original matrix
            state.adjacencyMatrix = originalMatrixBackup.map(row => [...row]);
            originalMatrixBackup = null;
            
            showPhysicsToast(`Rectification failed: would create ${result.connectivity.componentCount} disconnected components`, 'warning');
            
            // Reset flag
            window._skipPhysicsAutoAudit = false;
            
            // Hide rectification UI, re-run audit with original
            hideRectificationUI();
            performPhysicsAudit();
            
            return null;
        }
        
        if (result.success) {
            const edgesRectified = result.summary ? result.summary.edgesRectified : result.changes.length;
            const edgesPruned = result.summary ? result.summary.edgesPruned : (result.pruned ? result.pruned.length : 0);
            const diagonalCleared = result.summary ? result.summary.diagonalCleared : (result.clearedDiagonal ? result.clearedDiagonal.length : 0);
            
            console.log('[Physics] Rectification complete');
            console.log('[Physics] Changes:', edgesRectified, 'edges rectified,', edgesPruned, 'connections pruned,', diagonalCleared, 'diagonal entries cleared');
            
            // Get the rectified matrix and update graph state
            const rectifiedMatrix = currentPhysicsEngine.getRectifiedMatrix();
            
            // Deep copy to state
            state.adjacencyMatrix = rectifiedMatrix.map(row => [...row]);
            
            // Verify the rectification worked by creating a test engine WITH the same partition
            const verifyEngine = new PhysicsEngine(
                state.adjacencyMatrix, 
                null,
                currentPhysicsEngine.pIndices,
                currentPhysicsEngine.qIndices
            );
            const verifyReport = verifyEngine.audit();
            console.log('[Physics] Verification audit:', verifyReport.isPhysical ? 'REALIZABLE ✓' : 'STILL NOT REALIZABLE');
            
            if (!verifyReport.isPhysical) {
                console.warn('[Physics] Verification failed! Debugging info:');
                console.log('[Physics] state.adjacencyMatrix size:', state.adjacencyMatrix.length);
                console.log('[Physics] N:', verifyEngine.N, 'M:', verifyEngine.M);
                console.log('[Physics] Verify B-matrix:');
                for (let i = 0; i < verifyEngine.N; i++) {
                    console.log(`  Row ${i}:`, verifyEngine.B[i]);
                }
                console.log('[Physics] Original engine B-matrix (post-rectify):');
                for (let i = 0; i < currentPhysicsEngine.N; i++) {
                    console.log(`  Row ${i}:`, currentPhysicsEngine.B[i]);
                }
                
                // Check column analysis for violations
                console.log('[Physics] Column analysis violations:');
                for (const col of verifyReport.columnAnalysis) {
                    if (!col.isValid) {
                        console.log(`  Col ${col.columnIndex}: sum=${col.sum}, nonZero=${col.nonZeroCount}, violation: ${col.violation}`);
                    }
                }
                
                // Verify B-matrix consistency
                const consistency = currentPhysicsEngine.verifyBMatrixConsistency();
                console.log('[Physics] B-matrix consistency:', consistency.isConsistent ? 'OK' : 'MISMATCH');
                if (!consistency.isConsistent) {
                    console.log('[Physics] Consistency issues:', consistency.issues);
                }
            }
            
            // Rebuild the 3D edge visualization from the new matrix
            rebuildEdgesFromMatrix();
            
            // Update the overall display (eigenvalues, stats, etc.)
            if (typeof updateStats === 'function') {
                updateStats();
            }
            
            // Use the verified report for UI (or the original if verification passed)
            const finalReport = verifyReport.isPhysical ? verifyReport : result.auditAfter;
            const finalEngine = verifyReport.isPhysical ? verifyEngine : currentPhysicsEngine;
            
            // Update the current engine to the verified one
            currentPhysicsEngine = finalEngine;
            currentPhysicsEngine.initializeState('random', 1.0);
            
            // Update UI with results
            const energy = currentPhysicsEngine.getHamiltonian();
            updatePhysicsUI(finalReport, energy);
            if (finalReport.columnAnalysis) {
                updateColumnAnalysis(finalReport.columnAnalysis);
            }
            buildStateCells();
            resetEnergyHistory();
            
            // Update node colors with grounded info (p=blue, q=orange, grounded=gold)
            const groundedQIndices = [];
            if (finalReport.columnAnalysis) {
                for (const col of finalReport.columnAnalysis) {
                    if (col.isGrounded) {
                        groundedQIndices.push(col.globalIndex);
                    }
                }
            }
            updateNodePartitionColors(
                currentPhysicsEngine.pIndices || physicsPartition.pIndices,
                currentPhysicsEngine.qIndices || physicsPartition.qIndices,
                groundedQIndices
            );
            
            if (physicsBMatrixContainer && physicsBMatrixContainer.style.display !== 'none') {
                if (physicsBMatrixContent) {
                    physicsBMatrixContent.textContent = currentPhysicsEngine.formatBMatrix();
                }
            }
            
            // Show undo panel
            showUndoPanel();
            
            // Build informative toast message
            let toastMsg = `✓ Graph rectified`;
            const parts = [];
            if (edgesRectified > 0) parts.push(`${edgesRectified} edges adjusted`);
            if (edgesPruned > 0) parts.push(`${edgesPruned} pruned`);
            if (diagonalCleared > 0) parts.push(`${diagonalCleared} diagonal cleared`);
            if (parts.length > 0) toastMsg += ` (${parts.join(', ')})`;
            showPhysicsToast(toastMsg);
            
            // Clear the skip flag after a delay to allow pending events to settle
            setTimeout(() => {
                window._skipPhysicsAutoAudit = false;
            }, 300);
            
        } else if (result.alreadyPhysical) {
            // Already physical - no changes needed
            originalMatrixBackup = null;
            window._skipPhysicsAutoAudit = false;
            showPhysicsToast('Graph is already realizable', 'info');
        } else {
            // Rectification failed - clear backup
            originalMatrixBackup = null;
            window._skipPhysicsAutoAudit = false;
            
            const unrectCount = result.summary ? result.summary.unrectifiable : 0;
            showPhysicsToast(`⚠ Rectification incomplete (${unrectCount} issues remain)`, 'warning');
        }
        
        return result;
    } catch (e) {
        console.error('[Physics] Rectification error:', e);
        originalMatrixBackup = null;
        window._skipPhysicsAutoAudit = false;
        return null;
    }
}

// Expose to window for onclick handler
window.performPhysicsRectification = performPhysicsRectification;

/**
 * Undo physics rectification
 * Restores the original matrix from backup
 */
function undoPhysicsRectification() {
    if (!originalMatrixBackup) {
        console.warn('[Physics] No backup available for undo');
        return;
    }
    
    try {
        // Restore original matrix
        state.adjacencyMatrix = originalMatrixBackup.map(row => [...row]);
        originalMatrixBackup = null;
        
        // Rebuild the 3D edge visualization from the restored matrix
        rebuildEdgesFromMatrix();
        
        // Update the display
        if (typeof updateStats === 'function') {
            updateStats();
        }
        
        // Reset partition and re-audit
        physicsPartition = { pIndices: [], qIndices: [] };
        performPhysicsAudit();
        
        showPhysicsToast('↩ Rectification undone');
        
        console.log('[Physics] Rectification undone, original matrix restored');
    } catch (e) {
        console.error('[Physics] Undo error:', e);
    }
}

// Expose to window for onclick handler
window.undoPhysicsRectification = undoPhysicsRectification;

/**
 * Update physics UI when no graph is loaded
 */
function updatePhysicsUINoGraph() {
    if (physicsStatusIndicator) {
        physicsStatusIndicator.className = 'physics-status-dot';
    }
    if (physicsStatusText) {
        physicsStatusText.textContent = 'No graph loaded';
    }
    if (physicsStatusBadge) {
        physicsStatusBadge.textContent = '';
        physicsStatusBadge.className = 'physics-badge';
    }
    
    if (physicsDimN) physicsDimN.textContent = '-';
    if (physicsDimM) physicsDimM.textContent = '-';
    if (physicsDimViolations) {
        physicsDimViolations.textContent = '-';
        physicsDimViolations.className = 'physics-dim-value violation-count';
    }
    
    if (physicsViolationsPanel) {
        physicsViolationsPanel.style.display = 'none';
    }
    
    if (physicsBMatrixContent) {
        physicsBMatrixContent.textContent = '';
    }
    
    if (physicsColumnAnalysis) {
        physicsColumnAnalysis.style.display = 'none';
    }
    if (physicsColumnList) {
        physicsColumnList.innerHTML = '';
    }
    
    // Clear partition grid
    if (physicsNodeGrid) physicsNodeGrid.innerHTML = '';
    if (physicsPIndices) physicsPIndices.textContent = '-';
    if (physicsQIndices) physicsQIndices.textContent = '-';
    
    if (physicsPStates) physicsPStates.innerHTML = '';
    if (physicsQStates) physicsQStates.innerHTML = '';
    
    // Hide rectification UI
    hideRectificationUI();
    originalMatrixBackup = null;
    
    stopPhysicsAnimation();
    clearEnergyCanvas();
}

/**
 * Update physics UI with audit results
 */
function updatePhysicsUI(report, energy) {
    // Status indicator and badge
    if (physicsStatusIndicator) {
        physicsStatusIndicator.className = 'physics-status-dot ' + 
            (report.isPhysical ? 'physical' : 'non-physical');
    }
    
    if (physicsStatusText) {
        // Check for connectivity violation specifically
        const connectivityViolation = report.violations.find(v => v.type === 'CONNECTIVITY_VIOLATION');
        
        if (connectivityViolation) {
            physicsStatusText.textContent = `Disconnected: ${connectivityViolation.componentCount} components`;
        } else if (report.isPhysical) {
            const grounded = report.summary.groundedSprings || 0;
            const standard = report.summary.standardSprings || 0;
            if (grounded > 0) {
                physicsStatusText.textContent = `Realizable ✓ (${standard} springs, ${grounded} grounded)`;
            } else {
                physicsStatusText.textContent = 'Realizable for Linear System ✓';
            }
        } else {
            physicsStatusText.textContent = `${report.violations.length} violation(s) found`;
        }
    }
    
    if (physicsStatusBadge) {
        physicsStatusBadge.textContent = report.isPhysical ? 'REALIZABLE' : 'NOT REALIZABLE';
        physicsStatusBadge.className = 'physics-badge ' + 
            (report.isPhysical ? 'physical' : 'non-physical');
    }
    
    // Dimensions and Violations
    if (physicsDimN) physicsDimN.textContent = report.summary.nodeCount;
    if (physicsDimM) physicsDimM.textContent = report.summary.edgeCount;
    if (physicsDimViolations) {
        const violationCount = report.violations.length;
        physicsDimViolations.textContent = violationCount === 0 ? '0 ✓' : violationCount;
        physicsDimViolations.className = 'physics-dim-value violation-count' + 
            (violationCount === 0 ? ' zero' : '');
    }
    
    // Energy display
    if (energy) {
        updatePhysicsEnergyValues(energy);
    }
    
    // Violations detail panel
    if (physicsViolationsPanel && physicsViolationsList) {
        if (report.violations.length > 0) {
            physicsViolationsPanel.style.display = 'block';
            physicsViolationsList.innerHTML = report.violations
                .map(v => `<li>${v.message}</li>`)
                .join('');
        } else {
            physicsViolationsPanel.style.display = 'none';
        }
    }
}

/**
 * Show a toast notification for physics actions
 */
function showPhysicsToast(message, type = 'success') {
    const toast = document.createElement('div');
    
    const bgGradient = type === 'warning' 
        ? 'linear-gradient(135deg, #F59E0B, #D97706)'
        : 'linear-gradient(135deg, #10B981, #059669)';
    const shadowColor = type === 'warning'
        ? 'rgba(245, 158, 11, 0.4)'
        : 'rgba(16, 185, 129, 0.4)';
    
    toast.style.cssText = `
        position: fixed;
        bottom: 20px;
        right: 320px;
        background: ${bgGradient};
        color: white;
        padding: 12px 20px;
        border-radius: 8px;
        font-size: 13px;
        font-weight: 600;
        box-shadow: 0 4px 12px ${shadowColor};
        z-index: 10000;
        animation: slideInToast 0.3s ease;
    `;
    toast.textContent = message;
    
    // Add animation keyframes if not already present
    if (!document.getElementById('physics-toast-style')) {
        const style = document.createElement('style');
        style.id = 'physics-toast-style';
        style.textContent = `
            @keyframes slideInToast {
                from { transform: translateY(20px); opacity: 0; }
                to { transform: translateY(0); opacity: 1; }
            }
        `;
        document.head.appendChild(style);
    }
    
    document.body.appendChild(toast);
    
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(20px)';
        toast.style.transition = 'all 0.3s';
        setTimeout(() => toast.remove(), 300);
    }, 2500);
}

/**
 * Trigger physics audit on graph change (called from graph modification functions)
 */
function onGraphChanged() {
    // Skip auto-audit if we just rectified (the rectification handles its own UI update)
    if (window._skipPhysicsAutoAudit) {
        console.log('[Physics] Skipping auto-audit (rectification in progress)');
        return;
    }
    
    // Clear rectification state - this is a new/modified graph
    // The backup from a previous graph is no longer relevant
    originalMatrixBackup = null;
    hideRectificationUI();
    
    // Check if current partition is valid for the new graph size
    // Only reset if partition doesn't match current matrix size
    const matrixSize = state.adjacencyMatrix ? state.adjacencyMatrix.length : 0;
    const partitionTotal = physicsPartition.pIndices.length + physicsPartition.qIndices.length;
    const partitionMax = Math.max(
        ...physicsPartition.pIndices, 
        ...physicsPartition.qIndices, 
        -1
    );
    
    // Only reset partition if it's invalid for the current graph
    // This preserves template-provided partitions
    if (partitionTotal !== matrixSize || partitionMax >= matrixSize) {
        console.log('[Physics] Resetting invalid partition for graph change');
        physicsPartition = { pIndices: [], qIndices: [] };
    } else {
        console.log('[Physics] Keeping valid partition from template');
    }
    
    // Clear eigenvalue caches so they're recomputed for the new graph
    clearAnalyticCache();
    
    // Update phase diagram node selectors to show all nodes
    updatePhaseNodeSelectors();
    
    if (physicsAutoAuditCheckbox && physicsAutoAuditCheckbox.checked) {
        // Debounce the audit
        if (window._physicsAuditTimeout) {
            clearTimeout(window._physicsAuditTimeout);
        }
        window._physicsAuditTimeout = setTimeout(() => {
            performPhysicsAudit();
        }, 100);
    }
}

// =====================================================
// AUTO-START
// =====================================================

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
