/**
 * Analytic Graph Library Module
 * =============================
 * Persistent library for storing, organizing, and sharing analytic graphs.
 * 
 * Features:
 * - JSON export/import for individual graphs and entire library
 * - Auto-save to localStorage
 * - Beautiful table view with sorting and filtering
 * - BUILD tab integration for product graph factors
 * - HTML export for standalone sharing
 */

// =====================================================
// LIBRARY DATA STRUCTURE
// =====================================================

const LIBRARY_STORAGE_KEY = 'analyticGraphLibrary';
const LIBRARY_VERSION = 1;

let graphLibrary = {
    version: LIBRARY_VERSION,
    lastModified: null,
    graphs: [],  // Array of LibraryGraph objects
    collections: {},  // Named collections for organization
    metadata: {
        totalGraphs: 0,
        lastSearch: null,
        searchParams: null
    }
};

/**
 * LibraryGraph structure:
 * {
 *   id: string (UUID),
 *   name: string,
 *   n: number (vertex count),
 *   edges: [[i,j], ...],
 *   edgeCount: number,
 *   eigenvalues: [{value, form?, multiplicity?}, ...],
 *   family: string | null,
 *   isKnownFamily: boolean,
 *   dateAdded: ISO string,
 *   dateModified: ISO string,
 *   tags: string[],
 *   notes: string,
 *   source: 'search' | 'template' | 'manual' | 'import',
 *   searchParams: {n, connectedOnly} | null
 * }
 */

// =====================================================
// UUID GENERATION
// =====================================================

function generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

// =====================================================
// LIBRARY OPERATIONS
// =====================================================

/**
 * Initialize library from localStorage
 */
export function initLibrary() {
    try {
        const stored = localStorage.getItem(LIBRARY_STORAGE_KEY);
        if (stored) {
            const data = JSON.parse(stored);
            if (data.version === LIBRARY_VERSION) {
                graphLibrary = data;
                console.log(`Graph Library loaded: ${graphLibrary.graphs.length} graphs`);
                return true;
            } else {
                console.warn('Library version mismatch, migrating...');
                migrateLibrary(data);
                return true;
            }
        }
    } catch (e) {
        console.warn('Failed to load graph library:', e);
    }
    return false;
}

/**
 * Save library to localStorage
 */
export function saveLibrary() {
    try {
        graphLibrary.lastModified = new Date().toISOString();
        graphLibrary.metadata.totalGraphs = graphLibrary.graphs.length;
        localStorage.setItem(LIBRARY_STORAGE_KEY, JSON.stringify(graphLibrary));
        return true;
    } catch (e) {
        console.warn('Failed to save graph library:', e);
        return false;
    }
}

/**
 * Auto-save on changes
 */
let autoSaveTimeout = null;
function scheduleAutoSave() {
    if (autoSaveTimeout) clearTimeout(autoSaveTimeout);
    autoSaveTimeout = setTimeout(() => {
        saveLibrary();
        console.log('Library auto-saved');
    }, 1000);  // 1 second debounce
}

/**
 * Migrate old library format
 */
function migrateLibrary(oldData) {
    graphLibrary = {
        version: LIBRARY_VERSION,
        lastModified: new Date().toISOString(),
        graphs: oldData.graphs || [],
        collections: oldData.collections || {},
        metadata: {
            totalGraphs: (oldData.graphs || []).length,
            lastSearch: null,
            searchParams: null
        }
    };
    saveLibrary();
}

// =====================================================
// GRAPH MANAGEMENT
// =====================================================

/**
 * Add a graph to the library
 */
export function addToLibrary(graphData, options = {}) {
    const {
        name = null,
        tags = [],
        notes = '',
        source = 'manual',
        searchParams = null
    } = options;
    
    // Check for duplicates by canonical hash
    const canonicalKey = getCanonicalKey(graphData.n, graphData.edges);
    const existing = graphLibrary.graphs.find(g => 
        getCanonicalKey(g.n, g.edges) === canonicalKey
    );
    
    if (existing) {
        console.log('Graph already in library:', existing.id);
        return { success: false, reason: 'duplicate', existing };
    }
    
    // Create library entry
    const libraryGraph = {
        id: generateUUID(),
        name: name || graphData.family || generateGraphName(graphData),
        n: graphData.n,
        edges: graphData.edges || [],
        edgeCount: graphData.edgeCount || (graphData.edges || []).length,
        eigenvalues: graphData.eigenvalues || [],
        family: graphData.family || null,
        isKnownFamily: graphData.knownFamily || false,
        dateAdded: new Date().toISOString(),
        dateModified: new Date().toISOString(),
        tags,
        notes,
        source,
        searchParams
    };
    
    graphLibrary.graphs.push(libraryGraph);
    scheduleAutoSave();
    
    return { success: true, graph: libraryGraph };
}

/**
 * Add multiple graphs from search results
 */
export function addSearchResultsToLibrary(results, searchParams = null) {
    let added = 0;
    let duplicates = 0;
    
    for (const graph of results) {
        const result = addToLibrary(graph, {
            source: 'search',
            searchParams
        });
        
        if (result.success) {
            added++;
        } else if (result.reason === 'duplicate') {
            duplicates++;
        }
    }
    
    // Update metadata
    graphLibrary.metadata.lastSearch = new Date().toISOString();
    graphLibrary.metadata.searchParams = searchParams;
    
    return { added, duplicates, total: results.length };
}

/**
 * Remove a graph from the library
 */
export function removeFromLibrary(graphId) {
    const index = graphLibrary.graphs.findIndex(g => g.id === graphId);
    if (index >= 0) {
        graphLibrary.graphs.splice(index, 1);
        scheduleAutoSave();
        return true;
    }
    return false;
}

/**
 * Update a graph in the library
 */
export function updateInLibrary(graphId, updates) {
    const graph = graphLibrary.graphs.find(g => g.id === graphId);
    if (graph) {
        Object.assign(graph, updates);
        graph.dateModified = new Date().toISOString();
        scheduleAutoSave();
        return true;
    }
    return false;
}

/**
 * Get graph by ID
 */
export function getGraphById(graphId) {
    return graphLibrary.graphs.find(g => g.id === graphId);
}

/**
 * Get all graphs
 */
export function getAllGraphs() {
    return [...graphLibrary.graphs];
}

/**
 * Get library statistics
 */
export function getLibraryStats() {
    const graphs = graphLibrary.graphs;
    const byN = {};
    const byFamily = {};
    
    for (const g of graphs) {
        byN[g.n] = (byN[g.n] || 0) + 1;
        if (g.family) {
            const familyBase = g.family.split(' ')[0];
            byFamily[familyBase] = (byFamily[familyBase] || 0) + 1;
        }
    }
    
    return {
        total: graphs.length,
        byVertexCount: byN,
        byFamily,
        lastModified: graphLibrary.lastModified
    };
}

// =====================================================
// FILTERING & SORTING
// =====================================================

/**
 * Filter library graphs
 */
export function filterGraphs(filters = {}) {
    let results = [...graphLibrary.graphs];
    
    // Filter by vertex count
    if (filters.n !== undefined && filters.n !== null) {
        results = results.filter(g => g.n === filters.n);
    }
    
    // Filter by vertex range
    if (filters.minN !== undefined) {
        results = results.filter(g => g.n >= filters.minN);
    }
    if (filters.maxN !== undefined) {
        results = results.filter(g => g.n <= filters.maxN);
    }
    
    // Filter by edge count
    if (filters.minEdges !== undefined) {
        results = results.filter(g => g.edgeCount >= filters.minEdges);
    }
    if (filters.maxEdges !== undefined) {
        results = results.filter(g => g.edgeCount <= filters.maxEdges);
    }
    
    // Filter by family
    if (filters.family) {
        const familyLower = filters.family.toLowerCase();
        results = results.filter(g => 
            g.family && g.family.toLowerCase().includes(familyLower)
        );
    }
    
    // Filter by tags
    if (filters.tags && filters.tags.length > 0) {
        results = results.filter(g => 
            filters.tags.some(tag => g.tags.includes(tag))
        );
    }
    
    // Filter by search query (name, family, notes)
    if (filters.query) {
        const queryLower = filters.query.toLowerCase();
        results = results.filter(g => 
            g.name.toLowerCase().includes(queryLower) ||
            (g.family && g.family.toLowerCase().includes(queryLower)) ||
            (g.notes && g.notes.toLowerCase().includes(queryLower))
        );
    }
    
    // Filter known families only
    if (filters.knownFamilyOnly) {
        results = results.filter(g => g.isKnownFamily);
    }
    
    return results;
}

/**
 * Sort library graphs
 */
export function sortGraphs(graphs, sortBy = 'dateAdded', sortOrder = 'desc') {
    const sorted = [...graphs];
    
    sorted.sort((a, b) => {
        let comparison = 0;
        
        switch (sortBy) {
            case 'n':
            case 'vertices':
                comparison = a.n - b.n;
                break;
            case 'edges':
            case 'edgeCount':
                comparison = a.edgeCount - b.edgeCount;
                break;
            case 'name':
                comparison = a.name.localeCompare(b.name);
                break;
            case 'family':
                comparison = (a.family || '').localeCompare(b.family || '');
                break;
            case 'dateAdded':
                comparison = new Date(a.dateAdded) - new Date(b.dateAdded);
                break;
            case 'dateModified':
                comparison = new Date(a.dateModified) - new Date(b.dateModified);
                break;
            default:
                comparison = 0;
        }
        
        return sortOrder === 'desc' ? -comparison : comparison;
    });
    
    return sorted;
}

// =====================================================
// JSON EXPORT/IMPORT
// =====================================================

/**
 * Export single graph to JSON
 */
export function exportGraphToJSON(graphId) {
    const graph = graphLibrary.graphs.find(g => g.id === graphId);
    if (!graph) return null;
    
    return JSON.stringify({
        exportVersion: 1,
        exportDate: new Date().toISOString(),
        type: 'single',
        graph: graph
    }, null, 2);
}

/**
 * Export multiple graphs to JSON
 */
export function exportGraphsToJSON(graphIds) {
    const graphs = graphIds.map(id => 
        graphLibrary.graphs.find(g => g.id === id)
    ).filter(Boolean);
    
    return JSON.stringify({
        exportVersion: 1,
        exportDate: new Date().toISOString(),
        type: 'collection',
        graphs: graphs
    }, null, 2);
}

/**
 * Export entire library to JSON
 */
export function exportLibraryToJSON() {
    return JSON.stringify({
        exportVersion: 1,
        exportDate: new Date().toISOString(),
        type: 'library',
        library: {
            ...graphLibrary,
            graphs: graphLibrary.graphs
        }
    }, null, 2);
}

/**
 * Import from JSON
 */
export function importFromJSON(jsonString) {
    try {
        const data = JSON.parse(jsonString);
        
        if (!data.exportVersion) {
            throw new Error('Invalid export format: missing version');
        }
        
        let imported = 0;
        let duplicates = 0;
        
        if (data.type === 'single' && data.graph) {
            const result = importSingleGraph(data.graph);
            if (result.success) imported++;
            else if (result.reason === 'duplicate') duplicates++;
        } else if (data.type === 'collection' && data.graphs) {
            for (const graph of data.graphs) {
                const result = importSingleGraph(graph);
                if (result.success) imported++;
                else if (result.reason === 'duplicate') duplicates++;
            }
        } else if (data.type === 'library' && data.library) {
            for (const graph of data.library.graphs) {
                const result = importSingleGraph(graph);
                if (result.success) imported++;
                else if (result.reason === 'duplicate') duplicates++;
            }
        }
        
        return { success: true, imported, duplicates };
    } catch (e) {
        console.error('Import error:', e);
        return { success: false, error: e.message };
    }
}

/**
 * Import single graph (internal)
 */
function importSingleGraph(graphData) {
    // Regenerate ID to avoid conflicts
    const importedGraph = {
        ...graphData,
        id: generateUUID(),
        dateAdded: new Date().toISOString(),
        dateModified: new Date().toISOString(),
        source: 'import'
    };
    
    // Check for duplicates
    const canonicalKey = getCanonicalKey(importedGraph.n, importedGraph.edges);
    const existing = graphLibrary.graphs.find(g => 
        getCanonicalKey(g.n, g.edges) === canonicalKey
    );
    
    if (existing) {
        return { success: false, reason: 'duplicate' };
    }
    
    graphLibrary.graphs.push(importedGraph);
    scheduleAutoSave();
    return { success: true };
}

// =====================================================
// HTML EXPORT
// =====================================================

/**
 * Export graph to standalone HTML with visualization
 */
export function exportGraphToHTML(graphId) {
    const graph = graphLibrary.graphs.find(g => g.id === graphId);
    if (!graph) return null;
    
    const eigenStr = formatEigenvaluesHTML(graph.eigenvalues);
    const edgesStr = graph.edges.map(([i,j]) => `[${i},${j}]`).join(', ');
    
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${escapeHTML(graph.name)} - Analytic Graph</title>
    <style>
        :root {
            --bg: #0a0a1a;
            --card: #1a1a2e;
            --text: #ffffff;
            --text-muted: #a0a0b0;
            --accent: #4a9eff;
            --green: #4CAF50;
            --border: #333355;
        }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body {
            font-family: 'Segoe UI', system-ui, sans-serif;
            background: var(--bg);
            color: var(--text);
            min-height: 100vh;
            padding: 20px;
        }
        .container { max-width: 1200px; margin: 0 auto; }
        .header {
            text-align: center;
            margin-bottom: 30px;
            padding-bottom: 20px;
            border-bottom: 1px solid var(--border);
        }
        h1 {
            font-size: 2em;
            margin-bottom: 10px;
            color: var(--accent);
        }
        .subtitle { color: var(--text-muted); }
        .grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 20px;
            margin-bottom: 20px;
        }
        @media (max-width: 800px) {
            .grid { grid-template-columns: 1fr; }
        }
        .card {
            background: var(--card);
            border-radius: 12px;
            padding: 20px;
            border: 1px solid var(--border);
        }
        .card h3 {
            color: var(--accent);
            margin-bottom: 15px;
            font-size: 1.1em;
            display: flex;
            align-items: center;
            gap: 8px;
        }
        .stat-row {
            display: flex;
            justify-content: space-between;
            padding: 8px 0;
            border-bottom: 1px solid var(--border);
        }
        .stat-row:last-child { border-bottom: none; }
        .stat-label { color: var(--text-muted); }
        .stat-value { font-weight: 600; }
        .eigenvalues {
            font-family: 'Consolas', 'Monaco', monospace;
            background: rgba(74, 158, 255, 0.1);
            padding: 15px;
            border-radius: 8px;
            line-height: 1.8;
        }
        .edge-list {
            font-family: monospace;
            font-size: 0.9em;
            word-break: break-all;
        }
        canvas {
            width: 100%;
            height: 300px;
            background: #12122a;
            border-radius: 8px;
        }
        .footer {
            text-align: center;
            color: var(--text-muted);
            font-size: 0.85em;
            margin-top: 30px;
        }
        .family-badge {
            display: inline-block;
            background: var(--green);
            color: white;
            padding: 4px 12px;
            border-radius: 20px;
            font-size: 0.85em;
            margin-top: 10px;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>${escapeHTML(graph.name)}</h1>
            <div class="subtitle">Analytic Graph with Closed-Form Eigenvalues</div>
            ${graph.family ? `<div class="family-badge">📊 ${escapeHTML(graph.family)}</div>` : ''}
        </div>
        
        <div class="grid">
            <div class="card">
                <h3>📈 Graph Properties</h3>
                <div class="stat-row">
                    <span class="stat-label">Vertices (n)</span>
                    <span class="stat-value">${graph.n}</span>
                </div>
                <div class="stat-row">
                    <span class="stat-label">Edges</span>
                    <span class="stat-value">${graph.edgeCount}</span>
                </div>
                <div class="stat-row">
                    <span class="stat-label">Density</span>
                    <span class="stat-value">${(2 * graph.edgeCount / (graph.n * (graph.n - 1)) * 100).toFixed(1)}%</span>
                </div>
            </div>
            
            <div class="card">
                <h3>λ Eigenvalues (Symmetric)</h3>
                <div class="eigenvalues">${eigenStr}</div>
            </div>
        </div>
        
        <div class="card">
            <h3>🔗 Edge List</h3>
            <div class="edge-list">${edgesStr || '∅ (empty graph)'}</div>
        </div>
        
        <div class="card">
            <h3>📊 Visualization</h3>
            <canvas id="graph-canvas"></canvas>
        </div>
        
        <div class="footer">
            <p>Exported from Analytic Graph Library • ${new Date().toLocaleDateString()}</p>
            <p>Part of the Zeid-Rosenberg Graph Analysis Tool</p>
        </div>
    </div>
    
    <script>
        // Graph data
        const graphData = ${JSON.stringify({n: graph.n, edges: graph.edges})};
        
        // Simple canvas visualization
        const canvas = document.getElementById('graph-canvas');
        const ctx = canvas.getContext('2d');
        canvas.width = canvas.offsetWidth * 2;
        canvas.height = 600;
        
        const n = graphData.n;
        const edges = graphData.edges;
        const cx = canvas.width / 2;
        const cy = canvas.height / 2;
        const radius = Math.min(cx, cy) * 0.7;
        
        // Calculate positions
        const positions = [];
        for (let i = 0; i < n; i++) {
            const angle = (2 * Math.PI * i / n) - Math.PI / 2;
            positions.push({
                x: cx + radius * Math.cos(angle),
                y: cy + radius * Math.sin(angle)
            });
        }
        
        // Draw edges
        ctx.strokeStyle = '#4a9eff';
        ctx.lineWidth = 2;
        for (const [i, j] of edges) {
            ctx.beginPath();
            ctx.moveTo(positions[i].x, positions[i].y);
            ctx.lineTo(positions[j].x, positions[j].y);
            ctx.stroke();
        }
        
        // Draw vertices
        const nodeRadius = Math.max(12, Math.min(25, 200 / n));
        for (let i = 0; i < n; i++) {
            ctx.fillStyle = '#1a1a2e';
            ctx.strokeStyle = '#4a9eff';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.arc(positions[i].x, positions[i].y, nodeRadius, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
            
            // Label
            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold ' + Math.max(10, nodeRadius * 0.8) + 'px sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(i.toString(), positions[i].x, positions[i].y);
        }
    </script>
</body>
</html>`;
}

/**
 * Export library summary to HTML
 */
export function exportLibrarySummaryHTML() {
    const stats = getLibraryStats();
    const graphs = sortGraphs(getAllGraphs(), 'n', 'asc');
    
    let tableRows = '';
    for (const g of graphs) {
        tableRows += `
            <tr>
                <td>${escapeHTML(g.name)}</td>
                <td>${g.n}</td>
                <td>${g.edgeCount}</td>
                <td>${escapeHTML(g.family || '—')}</td>
                <td class="eigenvalues-cell">${formatEigenvaluesCompact(g.eigenvalues)}</td>
            </tr>`;
    }
    
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Analytic Graph Library Summary</title>
    <style>
        :root {
            --bg: #0a0a1a;
            --card: #1a1a2e;
            --text: #ffffff;
            --text-muted: #a0a0b0;
            --accent: #4a9eff;
            --green: #4CAF50;
            --border: #333355;
        }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body {
            font-family: 'Segoe UI', system-ui, sans-serif;
            background: var(--bg);
            color: var(--text);
            padding: 20px;
        }
        .container { max-width: 1400px; margin: 0 auto; }
        h1 { color: var(--accent); margin-bottom: 20px; }
        .stats {
            display: flex;
            gap: 20px;
            margin-bottom: 30px;
            flex-wrap: wrap;
        }
        .stat-card {
            background: var(--card);
            padding: 20px;
            border-radius: 12px;
            border: 1px solid var(--border);
            min-width: 150px;
        }
        .stat-value { font-size: 2em; font-weight: bold; color: var(--accent); }
        .stat-label { color: var(--text-muted); font-size: 0.9em; }
        table {
            width: 100%;
            border-collapse: collapse;
            background: var(--card);
            border-radius: 12px;
            overflow: hidden;
        }
        th, td {
            padding: 12px 15px;
            text-align: left;
            border-bottom: 1px solid var(--border);
        }
        th {
            background: rgba(74, 158, 255, 0.2);
            color: var(--accent);
            font-weight: 600;
        }
        tr:hover { background: rgba(74, 158, 255, 0.05); }
        .eigenvalues-cell {
            font-family: monospace;
            font-size: 0.85em;
            max-width: 300px;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }
        .footer {
            text-align: center;
            color: var(--text-muted);
            margin-top: 30px;
            font-size: 0.85em;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>📊 Analytic Graph Library</h1>
        
        <div class="stats">
            <div class="stat-card">
                <div class="stat-value">${stats.total}</div>
                <div class="stat-label">Total Graphs</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">${Object.keys(stats.byVertexCount).length}</div>
                <div class="stat-label">Vertex Sizes</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">${Object.keys(stats.byFamily).length}</div>
                <div class="stat-label">Graph Families</div>
            </div>
        </div>
        
        <table>
            <thead>
                <tr>
                    <th>Name</th>
                    <th>n</th>
                    <th>Edges</th>
                    <th>Family</th>
                    <th>Eigenvalues</th>
                </tr>
            </thead>
            <tbody>
                ${tableRows}
            </tbody>
        </table>
        
        <div class="footer">
            Exported ${new Date().toLocaleDateString()} • Zeid-Rosenberg Graph Analysis Tool
        </div>
    </div>
</body>
</html>`;
}

// =====================================================
// HELPER FUNCTIONS
// =====================================================

/**
 * Generate canonical key for duplicate detection
 */
function getCanonicalKey(n, edges) {
    if (!edges || edges.length === 0) return `E${n}`;
    
    // Sort edges consistently
    const sortedEdges = edges.map(([i, j]) => 
        i < j ? `${i}-${j}` : `${j}-${i}`
    ).sort();
    
    return `n${n}:${sortedEdges.join(',')}`;
}

/**
 * Generate a name for a graph without family
 */
function generateGraphName(graphData) {
    const n = graphData.n;
    const e = graphData.edgeCount || (graphData.edges || []).length;
    
    if (e === 0) return `Empty E_${n}`;
    if (e === n * (n - 1) / 2) return `Complete K_${n}`;
    
    return `Graph G(${n}, ${e})`;
}

/**
 * Format eigenvalues for HTML display
 */
function formatEigenvaluesHTML(eigenvalues) {
    if (!eigenvalues || eigenvalues.length === 0) return '—';
    
    return eigenvalues.map(e => {
        let str = '';
        if (typeof e === 'object') {
            if (e.form) str = e.form;
            else if (e.formula) str = e.formula;
            else if (e.value !== undefined) str = e.value.toFixed(4);
            else str = String(e);
            
            if (e.multiplicity && e.multiplicity > 1) {
                str += ` <span style="color:#888">(×${e.multiplicity})</span>`;
            }
        } else {
            str = String(e);
        }
        return str;
    }).join('<br>');
}

/**
 * Format eigenvalues compactly
 */
function formatEigenvaluesCompact(eigenvalues) {
    if (!eigenvalues || eigenvalues.length === 0) return '—';
    
    const formatted = eigenvalues.slice(0, 5).map(e => {
        if (typeof e === 'object') {
            if (e.form) return e.form;
            if (e.formula) return e.formula;
            if (e.value !== undefined) return e.value.toFixed(3);
        }
        return String(e);
    });
    
    let str = formatted.join(', ');
    if (eigenvalues.length > 5) str += ` ... (+${eigenvalues.length - 5})`;
    return str;
}

/**
 * Escape HTML special characters
 */
function escapeHTML(str) {
    if (!str) return '';
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

// =====================================================
// CLEAR LIBRARY
// =====================================================

/**
 * Clear entire library
 */
export function clearLibrary() {
    graphLibrary = {
        version: LIBRARY_VERSION,
        lastModified: new Date().toISOString(),
        graphs: [],
        collections: {},
        metadata: {
            totalGraphs: 0,
            lastSearch: null,
            searchParams: null
        }
    };
    saveLibrary();
}

// =====================================================
// FILE DOWNLOAD HELPERS
// =====================================================

/**
 * Trigger file download
 */
export function downloadFile(content, filename, mimeType = 'application/json') {
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
 * Download graph as JSON
 */
export function downloadGraphJSON(graphId) {
    const graph = getGraphById(graphId);
    if (!graph) return false;
    
    const json = exportGraphToJSON(graphId);
    const filename = `${graph.name.replace(/[^a-z0-9]/gi, '_')}.json`;
    downloadFile(json, filename, 'application/json');
    return true;
}

/**
 * Download library as JSON
 */
export function downloadLibraryJSON() {
    const json = exportLibraryToJSON();
    const filename = `analytic-graph-library-${new Date().toISOString().slice(0,10)}.json`;
    downloadFile(json, filename, 'application/json');
    return true;
}

/**
 * Download graph as HTML
 */
export function downloadGraphHTML(graphId) {
    const graph = getGraphById(graphId);
    if (!graph) return false;
    
    const html = exportGraphToHTML(graphId);
    const filename = `${graph.name.replace(/[^a-z0-9]/gi, '_')}.html`;
    downloadFile(html, filename, 'text/html');
    return true;
}

/**
 * Download library summary as HTML
 */
export function downloadLibrarySummaryHTML() {
    const html = exportLibrarySummaryHTML();
    const filename = `library-summary-${new Date().toISOString().slice(0,10)}.html`;
    downloadFile(html, filename, 'text/html');
    return true;
}

// =====================================================
// EXPORTS
// =====================================================

export { graphLibrary };
