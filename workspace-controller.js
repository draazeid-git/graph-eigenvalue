/**
 * Workspace Controller
 * Manages the 5-workspace UI: Lab, Studio, Eigenspectrum, Dynamics, Archives
 * 
 * Handles:
 * - Workspace navigation and tab switching
 * - Context-sensitive sidebar content
 * - Bottom tray state
 * - Keyboard shortcuts
 * - Cross-workspace data synchronization
 */

// Current workspace state
let currentWorkspace = 'lab';
const workspaces = ['lab', 'studio', 'spectrum', 'dynamics', 'archives'];

// DOM references
let workspaceTabs = null;
let workspaceContents = null;
let trayPanels = null;
let bottomTray = null;

/**
 * Initialize the workspace controller
 */
export function initWorkspaceController() {
    // Get DOM references
    workspaceTabs = document.querySelectorAll('.workspace-tab');
    workspaceContents = document.querySelectorAll('.workspace-content');
    trayPanels = document.querySelectorAll('.tray-panel');
    bottomTray = document.getElementById('bottom-tray');
    
    // Setup workspace tab clicks
    workspaceTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const workspace = tab.dataset.workspace;
            switchWorkspace(workspace);
        });
    });
    
    // Setup bottom tray toggle
    const trayToggle = document.getElementById('tray-toggle');
    if (trayToggle) {
        trayToggle.addEventListener('click', toggleBottomTray);
    }
    
    // Setup collapsible sections
    setupCollapsibles();
    
    // Setup keyboard shortcuts
    setupKeyboardShortcuts();
    
    // Setup template quick buttons
    setupTemplateButtons();
    
    // Setup tool palette
    setupToolPalette();
    
    // Setup eigenmode selector sync
    setupEigenmodeSyncĘ();
    
    console.log('WorkspaceController initialized');
}

/**
 * Switch to a different workspace
 */
export function switchWorkspace(workspace) {
    if (!workspaces.includes(workspace)) {
        console.warn(`Unknown workspace: ${workspace}`);
        return;
    }
    
    currentWorkspace = workspace;
    
    // Update body class for workspace-specific styling
    document.body.className = `workspace-${workspace}`;
    
    // Update tabs
    workspaceTabs.forEach(tab => {
        tab.classList.toggle('active', tab.dataset.workspace === workspace);
    });
    
    // Update sidebar content
    workspaceContents.forEach(content => {
        const wsId = content.id.replace('ws-', '');
        content.classList.toggle('active', wsId === workspace);
    });
    
    // Update bottom tray
    trayPanels.forEach(panel => {
        const panelWs = panel.id.replace('tray-', '');
        panel.classList.toggle('active', panelWs === workspace);
    });
    
    // Workspace-specific initialization
    onWorkspaceEnter(workspace);
    
    console.log(`Switched to workspace: ${workspace}`);
}

/**
 * Called when entering a workspace
 */
function onWorkspaceEnter(workspace) {
    switch (workspace) {
        case 'lab':
            // Optionally auto-open universe view
            break;
            
        case 'studio':
            // Refresh template preview
            break;
            
        case 'spectrum':
            // Refresh eigenvalue display
            refreshEigenspectrum();
            break;
            
        case 'dynamics':
            // Sync eigenmode selector with spectrum data
            syncEigenmodeSelector();
            break;
            
        case 'archives':
            // Refresh library gallery
            refreshLibraryGallery();
            break;
    }
}

/**
 * Toggle bottom tray expanded/collapsed
 */
function toggleBottomTray() {
    if (bottomTray) {
        bottomTray.classList.toggle('expanded');
    }
}

/**
 * Setup collapsible sections
 */
function setupCollapsibles() {
    document.querySelectorAll('.collapsible .collapsible-header').forEach(header => {
        header.addEventListener('click', () => {
            header.closest('.collapsible').classList.toggle('expanded');
        });
    });
}

/**
 * Setup keyboard shortcuts
 */
function setupKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
        // Ignore if typing in input
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
            return;
        }
        
        switch (e.key) {
            case '1':
                switchWorkspace('lab');
                break;
            case '2':
                switchWorkspace('studio');
                break;
            case '3':
                switchWorkspace('spectrum');
                break;
            case '4':
                switchWorkspace('dynamics');
                break;
            case '5':
                switchWorkspace('archives');
                break;
            case ' ':
                e.preventDefault();
                toggleDynamics();
                break;
            case 'r':
            case 'R':
                resetDynamics();
                break;
            case 'u':
            case 'U':
                toggleUniverseView();
                break;
            case '?':
                showHelpModal();
                break;
        }
    });
}

/**
 * Setup template quick buttons in Studio
 */
function setupTemplateButtons() {
    document.querySelectorAll('.template-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const template = btn.dataset.template;
            const templateSelect = document.getElementById('template-select');
            if (templateSelect) {
                templateSelect.value = template;
                templateSelect.dispatchEvent(new Event('change'));
            }
        });
    });
}

/**
 * Setup tool palette in Studio
 */
function setupToolPalette() {
    const tools = document.querySelectorAll('.tool-btn');
    tools.forEach(tool => {
        tool.addEventListener('click', () => {
            // Deactivate all tools
            tools.forEach(t => t.classList.remove('active'));
            // Activate clicked tool
            tool.classList.add('active');
            
            // Trigger tool mode change (connect to existing edit system)
            const toolId = tool.id;
            activateTool(toolId);
        });
    });
}

/**
 * Activate a specific edit tool
 */
function activateTool(toolId) {
    // Map to existing checkbox system for compatibility
    const addMode = document.getElementById('add-mode-checkbox');
    const deleteMode = document.getElementById('delete-mode-checkbox');
    const dragMode = document.getElementById('drag-mode-checkbox');
    
    if (addMode) addMode.checked = false;
    if (deleteMode) deleteMode.checked = false;
    if (dragMode) dragMode.checked = false;
    
    switch (toolId) {
        case 'tool-select':
            if (dragMode) dragMode.checked = true;
            break;
        case 'tool-add-vertex':
            // Custom add vertex mode
            break;
        case 'tool-add-edge':
            if (addMode) addMode.checked = true;
            break;
        case 'tool-delete':
            if (deleteMode) deleteMode.checked = true;
            break;
    }
}

/**
 * Setup eigenmode selector synchronization
 */
function setupEigenmodeSync() {
    // This will be called when eigenvalues are computed
    // to populate the eigenmode buttons in the Dynamics workspace
}

/**
 * Sync eigenmode selector with computed eigenvalues
 */
function syncEigenmodeSelector() {
    const container = document.getElementById('eigenmode-selector');
    if (!container) return;
    
    // Get cached eigenvalues from spectrum module
    // This would integrate with spectral-analysis.js
    const eigenvalues = getCachedEigenvalues();
    
    if (!eigenvalues || eigenvalues.length === 0) {
        container.innerHTML = '<p class="placeholder">Build a graph to see modes</p>';
        return;
    }
    
    container.innerHTML = '';
    
    eigenvalues.forEach((ev, i) => {
        const btn = document.createElement('button');
        btn.className = 'eigenmode-btn';
        btn.dataset.index = i;
        btn.dataset.value = typeof ev === 'number' ? ev : ev.value;
        
        // Format display
        const value = typeof ev === 'number' ? ev : ev.value;
        btn.textContent = value.toFixed(2);
        btn.title = ev.formula || `λ${i + 1}`;
        
        btn.addEventListener('click', () => {
            // Deactivate all
            container.querySelectorAll('.eigenmode-btn').forEach(b => 
                b.classList.remove('active'));
            // Activate this one
            btn.classList.add('active');
            // Trigger eigenmode animation
            startEigenmodeForIndex(i);
        });
        
        container.appendChild(btn);
    });
}

/**
 * Start eigenmode animation for a given index
 */
function startEigenmodeForIndex(index) {
    // Dispatch event for dynamics-animation.js to handle
    const event = new CustomEvent('startEigenmode', { detail: { index } });
    document.dispatchEvent(event);
    
    // Update info display
    const infoPanel = document.getElementById('active-eigenmode-info');
    if (infoPanel) {
        infoPanel.classList.remove('hidden');
    }
}

/**
 * Refresh eigenspectrum display
 */
function refreshEigenspectrum() {
    // Trigger spectral analysis refresh
    const event = new CustomEvent('refreshSpectrum');
    document.dispatchEvent(event);
}

/**
 * Refresh library gallery
 */
function refreshLibraryGallery() {
    const gallery = document.getElementById('library-gallery');
    if (!gallery) return;
    
    // Get saved graphs from localStorage or library module
    const graphs = getSavedGraphs();
    
    if (!graphs || graphs.length === 0) {
        gallery.innerHTML = '<p class="placeholder">No saved graphs</p>';
        return;
    }
    
    gallery.innerHTML = graphs.map((g, i) => `
        <div class="gallery-item" data-index="${i}">
            <div class="gallery-preview">
                <span>${g.vertices || g.n || '?'} vertices</span>
            </div>
            <div class="gallery-name">${g.name || `Graph ${i + 1}`}</div>
            <div class="gallery-meta">${g.edges || '?'} edges • ${g.type || 'Unknown'}</div>
        </div>
    `).join('');
    
    // Add click handlers
    gallery.querySelectorAll('.gallery-item').forEach(item => {
        item.addEventListener('click', () => {
            const index = parseInt(item.dataset.index);
            loadGraphFromLibrary(index);
        });
    });
}

/**
 * Get saved graphs from library
 */
function getSavedGraphs() {
    try {
        const saved = localStorage.getItem('graphLibrary');
        return saved ? JSON.parse(saved) : [];
    } catch (e) {
        return [];
    }
}

/**
 * Load a graph from the library
 */
function loadGraphFromLibrary(index) {
    const event = new CustomEvent('loadGraph', { detail: { index } });
    document.dispatchEvent(event);
}

/**
 * Get cached eigenvalues (stub - integrate with spectral-analysis.js)
 */
function getCachedEigenvalues() {
    // This would be populated by spectral-analysis.js
    return window.cachedEigenvalues || [];
}

/**
 * Toggle dynamics simulation
 */
function toggleDynamics() {
    const startBtn = document.getElementById('start-dynamics-btn');
    const stopBtn = document.getElementById('stop-dynamics-btn');
    
    if (startBtn && startBtn.style.display !== 'none') {
        startBtn.click();
    } else if (stopBtn && stopBtn.style.display !== 'none') {
        stopBtn.click();
    }
}

/**
 * Reset dynamics simulation
 */
function resetDynamics() {
    const resetBtn = document.getElementById('reset-dynamics-btn');
    if (resetBtn) resetBtn.click();
}

/**
 * Toggle universe view
 */
function toggleUniverseView() {
    const toggleBtn = document.getElementById('toggle-universe-btn');
    if (toggleBtn) toggleBtn.click();
}

/**
 * Show help modal
 */
function showHelpModal() {
    const helpModal = document.getElementById('help-modal');
    if (helpModal) {
        helpModal.classList.remove('hidden');
    }
}

/**
 * Update navigation graph info
 */
export function updateNavGraphInfo(info) {
    const navInfo = document.getElementById('nav-graph-info');
    const analyticBadge = document.getElementById('nav-analytic-badge');
    
    if (navInfo) {
        navInfo.textContent = info.name || `${info.n} vertices, ${info.m} edges`;
    }
    
    if (analyticBadge) {
        if (info.isAnalytic) {
            analyticBadge.classList.remove('hidden');
            analyticBadge.textContent = info.analyticType || 'Analytic';
        } else {
            analyticBadge.classList.add('hidden');
        }
    }
}

/**
 * Update quick stats in bottom tray
 */
export function updateQuickStats(stats) {
    const elements = {
        vertices: document.getElementById('qs-vertices'),
        edges: document.getElementById('qs-edges'),
        type: document.getElementById('qs-type'),
        rho: document.getElementById('qs-rho')
    };
    
    if (elements.vertices) elements.vertices.textContent = stats.n || '0';
    if (elements.edges) elements.edges.textContent = stats.m || '0';
    if (elements.type) elements.type.textContent = stats.type || '-';
    if (elements.rho) elements.rho.textContent = stats.rho?.toFixed(4) || '-';
}

/**
 * Update invariants display in Eigenspectrum
 */
export function updateInvariants(inv) {
    const elements = {
        n: document.getElementById('inv-n'),
        m: document.getElementById('inv-m'),
        rho: document.getElementById('inv-rho'),
        gap: document.getElementById('inv-gap')
    };
    
    if (elements.n) elements.n.textContent = inv.n || '-';
    if (elements.m) elements.m.textContent = inv.m || '-';
    if (elements.rho) elements.rho.textContent = inv.rho?.toFixed(3) || '-';
    if (elements.gap) elements.gap.textContent = inv.gap?.toFixed(3) || '-';
}

/**
 * Update detection badge in Eigenspectrum
 */
export function updateDetectionBadge(detection) {
    const nameEl = document.getElementById('graph-detection-result')?.querySelector('.detection-name');
    const confEl = document.getElementById('graph-detection-result')?.querySelector('.detection-confidence');
    
    if (nameEl) nameEl.textContent = detection.name || 'Unknown Graph';
    if (confEl) confEl.textContent = detection.confidence ? `${(detection.confidence * 100).toFixed(0)}%` : '';
}

/**
 * Update polynomial display
 */
export function updatePolynomialDisplay(polyString) {
    const display = document.getElementById('char-poly-display');
    if (display) {
        display.innerHTML = `<span class="polynomial">${polyString}</span>`;
    }
}

/**
 * Update eigenvalue table
 */
export function updateEigenvalueTable(eigenvalues, containerId = 'eigenvalue-table') {
    const container = document.getElementById(containerId);
    if (!container) return;
    
    if (!eigenvalues || eigenvalues.length === 0) {
        container.innerHTML = '<p class="placeholder">No eigenvalues computed</p>';
        return;
    }
    
    container.innerHTML = eigenvalues.map((ev, i) => {
        const value = typeof ev === 'number' ? ev : ev.value;
        const formula = ev.formula || '';
        const mult = ev.multiplicity > 1 ? `×${ev.multiplicity}` : '';
        
        return `
            <div class="eigenvalue-item" data-index="${i}" data-value="${value}">
                <span class="eig-value">${value.toFixed(6)}</span>
                <span class="eig-formula">${formula}</span>
                <span class="eig-mult">${mult}</span>
                <span class="eig-play">▶</span>
            </div>
        `;
    }).join('');
    
    // Add click handlers for eigenmode animation
    container.querySelectorAll('.eigenvalue-item').forEach(item => {
        item.addEventListener('click', () => {
            const index = parseInt(item.dataset.index);
            
            // Highlight selection
            container.querySelectorAll('.eigenvalue-item').forEach(el => 
                el.classList.remove('active'));
            item.classList.add('active');
            
            // Trigger eigenmode animation
            startEigenmodeForIndex(index);
            
            // Switch to dynamics if not there
            if (currentWorkspace !== 'dynamics') {
                switchWorkspace('dynamics');
            }
        });
    });
}

// Export current workspace getter
export function getCurrentWorkspace() {
    return currentWorkspace;
}

// Auto-initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initWorkspaceController);
} else {
    // Small delay to ensure main.js has loaded
    setTimeout(initWorkspaceController, 100);
}
