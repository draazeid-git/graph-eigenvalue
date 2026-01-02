/**
 * Physics Engine UI Integration
 * =============================
 * 
 * Adds a Physics Realizability panel to the Zeid-Rosenberg Eigenvalue Explorer.
 * Provides visual feedback on whether a graph represents a physically realizable
 * mechanical network and offers one-click rectification.
 * 
 * VERSION: 1.0.0
 */

import {
    PhysicsEngine,
    auditCurrentGraph,
    rectifyCurrentGraph,
    createStatusBadge,
    createAuditPanel
} from './physics-engine.js';

import { state } from './graph-core.js';

// =====================================================
// STATE
// =====================================================

let physicsPanel = null;
let currentEngine = null;
let autoAuditEnabled = true;

// =====================================================
// INITIALIZATION
// =====================================================

/**
 * Initialize the Physics UI panel
 * Call this after DOM is ready
 */
export function initPhysicsUI() {
    createPhysicsPanel();
    setupEventListeners();
    
    // Initial audit if graph exists
    if (state.adjacencyMatrix && state.adjacencyMatrix.length > 0) {
        performAudit();
    }
    
    console.log('[Physics UI] Initialized');
}

/**
 * Create the physics panel DOM element
 */
function createPhysicsPanel() {
    // Find the control panel container (usually left side)
    const controlContainer = document.querySelector('.control-panel') || 
                            document.querySelector('#control-panel') ||
                            document.querySelector('.sidebar') ||
                            document.body;
    
    // Create panel
    physicsPanel = document.createElement('div');
    physicsPanel.id = 'physics-panel';
    physicsPanel.className = 'physics-panel collapsible-section';
    
    physicsPanel.innerHTML = `
        <div class="section-header physics-header" onclick="window.togglePhysicsPanel()">
            <span class="section-icon">⚛️</span>
            <span class="section-title">Physical Realizability</span>
            <span class="collapse-indicator">▼</span>
            <span id="physics-status-badge" class="status-badge"></span>
        </div>
        
        <div class="section-content physics-content">
            <!-- Status Summary -->
            <div id="physics-status-summary" class="physics-status-summary">
                <div class="status-indicator" id="physics-indicator">
                    <span class="status-dot"></span>
                    <span class="status-text">No graph loaded</span>
                </div>
            </div>
            
            <!-- Dimensions Display -->
            <div class="physics-dimensions" id="physics-dimensions">
                <div class="dim-item">
                    <span class="dim-label">N (nodes)</span>
                    <span class="dim-value" id="dim-n">-</span>
                </div>
                <div class="dim-item">
                    <span class="dim-label">M (edges)</span>
                    <span class="dim-value" id="dim-m">-</span>
                </div>
                <div class="dim-item">
                    <span class="dim-label">State dim</span>
                    <span class="dim-value" id="dim-total">-</span>
                </div>
            </div>
            
            <!-- Energy Display -->
            <div class="physics-energy" id="physics-energy">
                <div class="energy-header">Hamiltonian Energy</div>
                <div class="energy-bar-container">
                    <div class="energy-bar kinetic" id="energy-kinetic" style="width: 50%"></div>
                    <div class="energy-bar potential" id="energy-potential" style="width: 50%"></div>
                </div>
                <div class="energy-labels">
                    <span class="energy-label kinetic">T = <span id="kinetic-value">0.00</span></span>
                    <span class="energy-label potential">V = <span id="potential-value">0.00</span></span>
                </div>
                <div class="energy-total">
                    H = <span id="total-energy">0.00</span>
                    <span id="conservation-status" class="conservation-check">✓</span>
                </div>
            </div>
            
            <!-- Violations List -->
            <div class="physics-violations" id="physics-violations" style="display: none;">
                <div class="violations-header">
                    <span class="violations-icon">⚠️</span>
                    <span>Newton's Law Violations</span>
                </div>
                <ul class="violations-list" id="violations-list"></ul>
            </div>
            
            <!-- Divergence Display -->
            <div class="physics-divergence" id="physics-divergence">
                <div class="divergence-header">Nodal Divergence (∇·F)</div>
                <div class="divergence-grid" id="divergence-grid"></div>
            </div>
            
            <!-- Action Buttons -->
            <div class="physics-actions">
                <button id="audit-btn" class="physics-btn audit-btn" onclick="window.physicsAudit()">
                    <span class="btn-icon">🔍</span>
                    Audit
                </button>
                <button id="rectify-btn" class="physics-btn rectify-btn" onclick="window.physicsRectify()">
                    <span class="btn-icon">🔧</span>
                    Rectify
                </button>
                <button id="show-matrix-btn" class="physics-btn matrix-btn" onclick="window.physicsShowMatrix()">
                    <span class="btn-icon">📊</span>
                    Matrix
                </button>
            </div>
            
            <!-- Auto-audit toggle -->
            <div class="physics-options">
                <label class="option-label">
                    <input type="checkbox" id="auto-audit-checkbox" checked onchange="window.toggleAutoAudit(this.checked)">
                    <span>Auto-audit on graph change</span>
                </label>
            </div>
            
            <!-- Matrix Display (hidden by default) -->
            <div class="physics-matrix-display" id="physics-matrix-display" style="display: none;">
                <div class="matrix-header">
                    <span>Augmented Matrix J</span>
                    <button class="close-btn" onclick="window.hidePhysicsMatrix()">×</button>
                </div>
                <pre class="matrix-content" id="matrix-content"></pre>
            </div>
        </div>
    `;
    
    // Add styles
    addPhysicsStyles();
    
    // Insert panel (try to find a good location)
    const analysisSection = document.querySelector('#analysis-section') ||
                           document.querySelector('.analysis-panel');
    if (analysisSection) {
        analysisSection.parentNode.insertBefore(physicsPanel, analysisSection.nextSibling);
    } else {
        controlContainer.appendChild(physicsPanel);
    }
}

/**
 * Add CSS styles for the physics panel
 */
function addPhysicsStyles() {
    const styleId = 'physics-panel-styles';
    if (document.getElementById(styleId)) return;
    
    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = `
        .physics-panel {
            background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
            border: 1px solid #2d3a5c;
            border-radius: 8px;
            margin: 10px 0;
            overflow: hidden;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.3);
        }
        
        .physics-header {
            display: flex;
            align-items: center;
            gap: 8px;
            padding: 12px 15px;
            background: linear-gradient(90deg, #2d3a5c 0%, #1f2b47 100%);
            cursor: pointer;
            user-select: none;
            transition: background 0.2s;
        }
        
        .physics-header:hover {
            background: linear-gradient(90deg, #3d4a6c 0%, #2f3b57 100%);
        }
        
        .section-icon {
            font-size: 16px;
        }
        
        .section-title {
            flex-grow: 1;
            font-weight: 600;
            color: #e0e0e0;
            font-size: 13px;
        }
        
        .collapse-indicator {
            color: #888;
            transition: transform 0.3s;
        }
        
        .physics-panel.collapsed .collapse-indicator {
            transform: rotate(-90deg);
        }
        
        .physics-panel.collapsed .physics-content {
            display: none;
        }
        
        .status-badge {
            padding: 2px 8px;
            border-radius: 10px;
            font-size: 10px;
            font-weight: bold;
            text-transform: uppercase;
        }
        
        .status-badge.green {
            background: #10b981;
            color: white;
        }
        
        .status-badge.orange {
            background: #f97316;
            color: white;
        }
        
        .status-badge.yellow {
            background: #f59e0b;
            color: #1a1a2e;
        }
        
        .physics-content {
            padding: 15px;
        }
        
        .physics-status-summary {
            margin-bottom: 15px;
        }
        
        .status-indicator {
            display: flex;
            align-items: center;
            gap: 8px;
            padding: 8px 12px;
            background: rgba(0, 0, 0, 0.2);
            border-radius: 6px;
        }
        
        .status-dot {
            width: 10px;
            height: 10px;
            border-radius: 50%;
            background: #666;
            box-shadow: 0 0 6px currentColor;
        }
        
        .status-dot.green {
            background: #10b981;
            box-shadow: 0 0 10px #10b981;
        }
        
        .status-dot.orange {
            background: #f97316;
            box-shadow: 0 0 10px #f97316;
            animation: pulse-orange 1.5s infinite;
        }
        
        @keyframes pulse-orange {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.5; }
        }
        
        .status-text {
            color: #e0e0e0;
            font-size: 12px;
        }
        
        .physics-dimensions {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 8px;
            margin-bottom: 15px;
        }
        
        .dim-item {
            background: rgba(0, 0, 0, 0.2);
            padding: 8px;
            border-radius: 6px;
            text-align: center;
        }
        
        .dim-label {
            display: block;
            font-size: 10px;
            color: #888;
            margin-bottom: 4px;
        }
        
        .dim-value {
            display: block;
            font-size: 18px;
            font-weight: bold;
            color: #4FD1C5;
            font-family: 'JetBrains Mono', monospace;
        }
        
        .physics-energy {
            background: rgba(0, 0, 0, 0.2);
            padding: 12px;
            border-radius: 6px;
            margin-bottom: 15px;
        }
        
        .energy-header {
            font-size: 11px;
            color: #888;
            margin-bottom: 8px;
            text-transform: uppercase;
            letter-spacing: 1px;
        }
        
        .energy-bar-container {
            display: flex;
            height: 8px;
            background: #1a1a2e;
            border-radius: 4px;
            overflow: hidden;
            margin-bottom: 8px;
        }
        
        .energy-bar {
            height: 100%;
            transition: width 0.3s ease;
        }
        
        .energy-bar.kinetic {
            background: linear-gradient(90deg, #F87171, #FB923C);
        }
        
        .energy-bar.potential {
            background: linear-gradient(90deg, #4FD1C5, #38BDF8);
        }
        
        .energy-labels {
            display: flex;
            justify-content: space-between;
            font-size: 11px;
            margin-bottom: 4px;
        }
        
        .energy-label.kinetic {
            color: #F87171;
        }
        
        .energy-label.potential {
            color: #4FD1C5;
        }
        
        .energy-total {
            text-align: center;
            font-size: 14px;
            font-weight: bold;
            color: #e0e0e0;
            font-family: 'JetBrains Mono', monospace;
        }
        
        .conservation-check {
            color: #10b981;
            margin-left: 8px;
        }
        
        .conservation-check.warning {
            color: #f97316;
        }
        
        .physics-violations {
            background: rgba(248, 113, 113, 0.1);
            border: 1px solid rgba(248, 113, 113, 0.3);
            padding: 12px;
            border-radius: 6px;
            margin-bottom: 15px;
        }
        
        .violations-header {
            display: flex;
            align-items: center;
            gap: 8px;
            color: #F87171;
            font-size: 12px;
            font-weight: 600;
            margin-bottom: 8px;
        }
        
        .violations-list {
            margin: 0;
            padding-left: 20px;
            font-size: 11px;
            color: #FCA5A5;
        }
        
        .violations-list li {
            margin-bottom: 4px;
        }
        
        .physics-divergence {
            background: rgba(0, 0, 0, 0.2);
            padding: 12px;
            border-radius: 6px;
            margin-bottom: 15px;
        }
        
        .divergence-header {
            font-size: 11px;
            color: #888;
            margin-bottom: 8px;
            text-transform: uppercase;
            letter-spacing: 1px;
        }
        
        .divergence-grid {
            display: flex;
            flex-wrap: wrap;
            gap: 4px;
        }
        
        .div-cell {
            width: 28px;
            height: 28px;
            display: flex;
            align-items: center;
            justify-content: center;
            border-radius: 4px;
            font-size: 10px;
            font-weight: bold;
            font-family: 'JetBrains Mono', monospace;
        }
        
        .div-cell.positive {
            background: rgba(248, 113, 113, 0.3);
            color: #F87171;
        }
        
        .div-cell.negative {
            background: rgba(79, 209, 197, 0.3);
            color: #4FD1C5;
        }
        
        .div-cell.zero {
            background: rgba(148, 163, 184, 0.2);
            color: #94A3B8;
        }
        
        .physics-actions {
            display: flex;
            gap: 8px;
            margin-bottom: 10px;
        }
        
        .physics-btn {
            flex: 1;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 6px;
            padding: 8px 12px;
            border: none;
            border-radius: 6px;
            cursor: pointer;
            font-size: 11px;
            font-weight: 600;
            transition: all 0.2s;
        }
        
        .btn-icon {
            font-size: 14px;
        }
        
        .audit-btn {
            background: linear-gradient(135deg, #3B82F6, #1D4ED8);
            color: white;
        }
        
        .audit-btn:hover {
            background: linear-gradient(135deg, #60A5FA, #3B82F6);
            transform: translateY(-1px);
        }
        
        .rectify-btn {
            background: linear-gradient(135deg, #10B981, #059669);
            color: white;
        }
        
        .rectify-btn:hover {
            background: linear-gradient(135deg, #34D399, #10B981);
            transform: translateY(-1px);
        }
        
        .rectify-btn:disabled {
            background: #374151;
            color: #6B7280;
            cursor: not-allowed;
            transform: none;
        }
        
        .matrix-btn {
            background: linear-gradient(135deg, #8B5CF6, #6D28D9);
            color: white;
        }
        
        .matrix-btn:hover {
            background: linear-gradient(135deg, #A78BFA, #8B5CF6);
            transform: translateY(-1px);
        }
        
        .physics-options {
            padding: 8px 0;
            border-top: 1px solid rgba(255, 255, 255, 0.1);
        }
        
        .option-label {
            display: flex;
            align-items: center;
            gap: 8px;
            font-size: 11px;
            color: #9CA3AF;
            cursor: pointer;
        }
        
        .option-label input {
            accent-color: #4FD1C5;
        }
        
        .physics-matrix-display {
            background: #0a0a1a;
            border: 1px solid #2d3a5c;
            border-radius: 6px;
            margin-top: 15px;
            overflow: hidden;
        }
        
        .matrix-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 8px 12px;
            background: #1a1a2e;
            font-size: 12px;
            color: #e0e0e0;
        }
        
        .close-btn {
            background: none;
            border: none;
            color: #888;
            cursor: pointer;
            font-size: 18px;
            padding: 0 4px;
        }
        
        .close-btn:hover {
            color: #F87171;
        }
        
        .matrix-content {
            padding: 12px;
            margin: 0;
            font-family: 'JetBrains Mono', 'Fira Code', monospace;
            font-size: 10px;
            line-height: 1.4;
            color: #4FD1C5;
            overflow-x: auto;
            white-space: pre;
        }
    `;
    
    document.head.appendChild(style);
}

/**
 * Setup event listeners for graph changes
 */
function setupEventListeners() {
    // Expose functions to window for onclick handlers
    window.togglePhysicsPanel = togglePanel;
    window.physicsAudit = performAudit;
    window.physicsRectify = performRectification;
    window.physicsShowMatrix = showMatrix;
    window.hidePhysicsMatrix = hideMatrix;
    window.toggleAutoAudit = (enabled) => { autoAuditEnabled = enabled; };
    
    // Listen for graph changes (you may need to dispatch these events from graph-core.js)
    document.addEventListener('graphChanged', () => {
        if (autoAuditEnabled) {
            performAudit();
        }
    });
}

// =====================================================
// PANEL ACTIONS
// =====================================================

/**
 * Toggle panel collapse state
 */
function togglePanel() {
    if (!physicsPanel) return;
    physicsPanel.classList.toggle('collapsed');
}

/**
 * Perform audit and update UI
 */
export function performAudit() {
    if (!state.adjacencyMatrix || state.adjacencyMatrix.length === 0) {
        updateUINoGraph();
        return null;
    }
    
    currentEngine = new PhysicsEngine();
    const report = currentEngine.audit();
    const energy = currentEngine.getHamiltonian();
    const conservation = currentEngine.checkEnergyConservation();
    const divergences = currentEngine.getAllDivergences();
    
    updateUIWithReport(report, energy, conservation, divergences);
    
    return report;
}

/**
 * Perform rectification
 */
export function performRectification() {
    if (!currentEngine) {
        currentEngine = new PhysicsEngine();
    }
    
    const result = currentEngine.autoRectify();
    
    if (result.success) {
        // Update the global adjacency matrix with rectified values
        // Note: This updates the incidence-based orientation, not the original adjacency matrix
        console.log('[Physics] Rectification successful:', result.rectifications.length, 'edges adjusted');
        
        // Re-audit to update UI
        performAudit();
        
        // Show success feedback
        showRectificationFeedback(result);
    }
    
    return result;
}

/**
 * Show the augmented matrix
 */
function showMatrix() {
    if (!currentEngine) {
        currentEngine = new PhysicsEngine();
    }
    
    const matrixDisplay = document.getElementById('physics-matrix-display');
    const matrixContent = document.getElementById('matrix-content');
    
    if (matrixDisplay && matrixContent) {
        matrixContent.textContent = currentEngine.formatAugmentedMatrix();
        matrixDisplay.style.display = 'block';
    }
}

/**
 * Hide the matrix display
 */
function hideMatrix() {
    const matrixDisplay = document.getElementById('physics-matrix-display');
    if (matrixDisplay) {
        matrixDisplay.style.display = 'none';
    }
}

// =====================================================
// UI UPDATE FUNCTIONS
// =====================================================

/**
 * Update UI when no graph is loaded
 */
function updateUINoGraph() {
    const indicator = document.getElementById('physics-indicator');
    const badge = document.getElementById('physics-status-badge');
    
    if (indicator) {
        indicator.querySelector('.status-dot').className = 'status-dot';
        indicator.querySelector('.status-text').textContent = 'No graph loaded';
    }
    
    if (badge) {
        badge.textContent = '';
        badge.className = 'status-badge';
    }
    
    // Reset dimensions
    ['dim-n', 'dim-m', 'dim-total'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.textContent = '-';
    });
    
    // Hide violations
    const violations = document.getElementById('physics-violations');
    if (violations) violations.style.display = 'none';
}

/**
 * Update UI with audit report
 */
function updateUIWithReport(report, energy, conservation, divergences) {
    // Status indicator
    const indicator = document.getElementById('physics-indicator');
    const badge = document.getElementById('physics-status-badge');
    
    if (indicator) {
        const dot = indicator.querySelector('.status-dot');
        const text = indicator.querySelector('.status-text');
        
        dot.className = 'status-dot ' + report.statusColor.toLowerCase();
        text.textContent = report.isPhysical 
            ? 'Physically Realizable ✓' 
            : `${report.violations.length} violation(s) found`;
    }
    
    if (badge) {
        badge.textContent = report.isPhysical ? 'PHYSICAL' : 'NON-PHYSICAL';
        badge.className = 'status-badge ' + report.statusColor.toLowerCase();
    }
    
    // Dimensions
    document.getElementById('dim-n').textContent = report.summary.nodeCount;
    document.getElementById('dim-m').textContent = report.summary.edgeCount;
    document.getElementById('dim-total').textContent = report.summary.stateSpaceDim;
    
    // Energy
    const total = energy.total || 1;
    const kineticPercent = (energy.kinetic / total) * 100;
    const potentialPercent = (energy.potential / total) * 100;
    
    document.getElementById('energy-kinetic').style.width = kineticPercent + '%';
    document.getElementById('energy-potential').style.width = potentialPercent + '%';
    document.getElementById('kinetic-value').textContent = energy.kinetic.toFixed(3);
    document.getElementById('potential-value').textContent = energy.potential.toFixed(3);
    document.getElementById('total-energy').textContent = energy.total.toFixed(3);
    
    const conservationEl = document.getElementById('conservation-status');
    if (conservation.isConserved) {
        conservationEl.textContent = '✓';
        conservationEl.className = 'conservation-check';
    } else {
        conservationEl.textContent = '⚠';
        conservationEl.className = 'conservation-check warning';
    }
    
    // Violations
    const violationsEl = document.getElementById('physics-violations');
    const violationsList = document.getElementById('violations-list');
    
    if (report.violations.length > 0) {
        violationsEl.style.display = 'block';
        violationsList.innerHTML = report.violations
            .map(v => `<li>Edge ${v.edge}: ${v.message}</li>`)
            .join('');
    } else {
        violationsEl.style.display = 'none';
    }
    
    // Divergences
    const divergenceGrid = document.getElementById('divergence-grid');
    if (divergenceGrid && divergences) {
        divergenceGrid.innerHTML = divergences.map((d, i) => {
            const cls = d > 0 ? 'positive' : d < 0 ? 'negative' : 'zero';
            const sign = d > 0 ? '+' : '';
            return `<div class="div-cell ${cls}" title="Node ${i}: ∇·F = ${d}">${sign}${d}</div>`;
        }).join('');
    }
    
    // Rectify button state
    const rectifyBtn = document.getElementById('rectify-btn');
    if (rectifyBtn) {
        rectifyBtn.disabled = report.isPhysical;
    }
}

/**
 * Show rectification feedback
 */
function showRectificationFeedback(result) {
    // Create temporary toast notification
    const toast = document.createElement('div');
    toast.style.cssText = `
        position: fixed;
        bottom: 20px;
        right: 20px;
        background: linear-gradient(135deg, #10B981, #059669);
        color: white;
        padding: 12px 20px;
        border-radius: 8px;
        font-size: 13px;
        font-weight: 600;
        box-shadow: 0 4px 12px rgba(16, 185, 129, 0.4);
        z-index: 10000;
        animation: slideIn 0.3s ease;
    `;
    toast.textContent = `✓ Rectified ${result.rectifications.length} edge(s)`;
    
    document.body.appendChild(toast);
    
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(20px)';
        toast.style.transition = 'all 0.3s';
        setTimeout(() => toast.remove(), 300);
    }, 2500);
}

// =====================================================
// EXPORTS
// =====================================================

export {
    togglePanel,
    showMatrix,
    hideMatrix
};

export const PHYSICS_UI_VERSION = '1.0.0';
