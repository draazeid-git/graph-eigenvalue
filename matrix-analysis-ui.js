/**
 * Matrix Analysis UI Module
 * Handles adjacency matrix display, eigenvalue analysis, and graph statistics
 */

import { state } from './graph-core.js';
import {
    detectGraphType, computeGraphProperties, isConnected,
    computeCharacteristicPolynomial, formatPolynomial,
    computeEigenvaluesNumerical, computeSkewSymmetricEigenvalues,
    detectTrigEigenvalues, formatTrigForm, subscript,
    detectClosedForm, analyzeEigenvaluesForClosedForms, analyzeEigenvaluesForClosedFormsWithN,
    SpectralEngine, PolynomialFactorizer, analyzeCharacteristicPolynomial
} from './spectral-analysis.js';

// Import the new robust analytic detection module
import {
    detectAnalyticEigenspectrum,
    verifyDetection,
    computeGraphInvariants
} from './analytic-detection.js';

// Import dynamics control for eigenmode animation
import {
    startEigenmodeAnimation,
    stopEigenmodeAnimation,
    isEigenmodeActive
} from './dynamics-animation.js';

// =====================================================
// DOM ELEMENT REFERENCES
// =====================================================

let matrixModal, matrixContent, modalHeader, closeModalBtn;
let statVertices, statEdges, statType;

// Modal dragging state
let isDragging = false;
let dragOffsetX = 0;
let dragOffsetY = 0;

// =====================================================
// CACHED ANALYTIC DETECTION RESULT
// =====================================================
// Computed once at build time, reused in analysis display
let cachedAnalyticResult = null;

// Cached eigenvalues for complex plane redraw (updated when graph changes)
let cachedSymmetricEigs = null;
let cachedSkewEigs = null;

export function getCachedAnalyticResult() {
    return cachedAnalyticResult;
}

export function clearAnalyticCache() {
    cachedAnalyticResult = null;
    cachedSymmetricEigs = null;
    cachedSkewEigs = null;
}

// =====================================================
// EIGENMODE ANIMATION HANDLER
// =====================================================

/**
 * Handle click on eigenvalue to start eigenmode animation
 */
function handleEigenvalueClick(event) {
    const el = event.currentTarget;
    const index = parseInt(el.dataset.index);
    const value = parseFloat(el.dataset.value);
    const type = el.dataset.type;  // 'symmetric' or 'skew'
    
    const n = state.vertexMeshes.length;
    if (n === 0) return;
    
    console.log(`Eigenmode clicked: index=${index}, value=${value}, type=${type}`);
    
    // IMPORTANT: Reset graph to original state before starting new eigenmode
    stopEigenmodeAnimation();
    
    // Detect graph type for analytical eigenvector computation
    const graphInfo = detectGraphType();
    const graphType = graphInfo?.type || null;
    
    // Check if this looks like a mass-spring system (bipartite with unequal parts)
    // In that case, skip analytical formulas as they won't apply
    let isMassSpringSystem = false;
    if (graphType === 'path' && n > 3) {
        // Check if degrees alternate (mass-spring pattern)
        // In a true path, all internal nodes have degree 2
        // In a mass-spring path, there's an alternating pattern
        const degrees = [];
        for (let i = 0; i < n; i++) {
            let d = 0;
            for (let j = 0; j < n; j++) {
                if (state.symmetricAdjMatrix[i][j] === 1) d++;
            }
            degrees.push(d);
        }
        // Check for bipartite structure by seeing if node count >> edge count indicates masses+springs
        // A simple path Pn has n-1 edges. Mass-spring chain with m masses has 2m nodes and 2m-1 edges
        const edgeCount = state.edgeObjects.length;
        if (edgeCount > 0 && n > edgeCount + 1) {
            // More nodes than a simple path would have for this edge count
            isMassSpringSystem = true;
            console.log('[Eigenmode] Detected mass-spring structure, using numerical eigenvector');
        }
    }
    
    // Try to compute eigenvector analytically first
    let eigenvector = null;
    let formula = null;
    
    if (graphType && ['cycle', 'path', 'star', 'complete'].includes(graphType) && !isMassSpringSystem) {
        // Use analytical formula
        const analyticEv = SpectralEngine.computeAnalyticEigenvector(
            graphType, n, index, type === 'skew'
        );
        if (analyticEv) {
            eigenvector = { real: analyticEv.real, imag: analyticEv.imag };
            formula = analyticEv.formula;
            console.log(`Using analytical eigenvector for ${graphType}: ${formula}`);
        }
    }
    
    // Fall back to numerical computation if needed
    if (!eigenvector) {
        const A = type === 'skew' ? state.adjacencyMatrix : state.symmetricAdjMatrix;
        const evResult = SpectralEngine.computeEigenvector(A, value, type === 'skew');
        if (evResult && evResult.converged) {
            eigenvector = { real: evResult.real, imag: evResult.imag };
            formula = value.toFixed(4);
            console.log(`Using numerical eigenvector (converged: ${evResult.converged})`);
        } else {
            // Generate a simple standing wave pattern as fallback
            eigenvector = { real: new Array(n), imag: new Array(n) };
            for (let i = 0; i < n; i++) {
                eigenvector.real[i] = Math.cos(2 * Math.PI * index * i / n);
                eigenvector.imag[i] = Math.sin(2 * Math.PI * index * i / n);
            }
            formula = `mode ${index + 1}`;
            console.log('Using fallback wave pattern');
        }
    }
    
    // Construct eigenmode data
    const eigenmode = {
        eigenvalue: type === 'skew' ? 
            { real: 0, imag: value } : 
            { real: value, imag: 0 },
        eigenvector: eigenvector,
        formula: formula,
        modeIndex: index,
        graphType: graphType
    };
    
    // Highlight selected eigenvalue
    document.querySelectorAll('.eigenvalue-clickable').forEach(item => {
        item.classList.remove('eigenvalue-active');
    });
    el.classList.add('eigenvalue-active');
    
    // Start eigenmode animation
    startEigenmodeAnimation(eigenmode);
}

// =====================================================
// INITIALIZATION
// =====================================================

export function initMatrixAnalysis(elements) {
    matrixModal = elements.matrixModal;
    matrixContent = elements.matrixContent;
    modalHeader = elements.modalHeader;
    closeModalBtn = elements.closeModalBtn;
    statVertices = elements.statVertices;
    statEdges = elements.statEdges;
    statType = elements.statType;
    
    setupModalDragging();
}

// =====================================================
// MODAL DRAGGING
// =====================================================

function setupModalDragging() {
    if (!modalHeader || !matrixContent) return;
    
    modalHeader.addEventListener('mousedown', (e) => {
        isDragging = true;
        const rect = matrixContent.getBoundingClientRect();
        dragOffsetX = e.clientX - rect.left;
        dragOffsetY = e.clientY - rect.top;
        matrixContent.style.transition = 'none';
    });
    
    document.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        const x = e.clientX - dragOffsetX;
        const y = e.clientY - dragOffsetY;
        matrixContent.style.left = Math.max(0, x) + 'px';
        matrixContent.style.top = Math.max(0, y) + 'px';
        matrixContent.style.right = 'auto';
        matrixContent.style.bottom = 'auto';
    });
    
    document.addEventListener('mouseup', () => {
        isDragging = false;
    });
}

export function initModalPosition() {
    if (!matrixContent) return;
    matrixContent.style.right = '320px';
    matrixContent.style.top = '10px';
    matrixContent.style.left = 'auto';
    matrixContent.style.bottom = 'auto';
}

export function showModal() {
    if (matrixModal) {
        matrixModal.classList.add('show');
        initModalPosition();
    }
}

export function hideModal() {
    if (matrixModal) {
        matrixModal.classList.remove('show');
    }
    
    // Stop any running eigenmode animation and reset graph when closing modal
    import('./dynamics-animation.js').then(module => {
        if (module.isEigenmodeActive && module.isEigenmodeActive()) {
            module.stopEigenmodeAnimation();
            document.querySelectorAll('.eigenvalue-clickable').forEach(item => {
                item.classList.remove('eigenvalue-active');
            });
            console.log('Animation stopped and graph reset on modal close');
        }
    }).catch(() => {});
}

// =====================================================
// STATISTICS
// =====================================================

export function updateStats() {
    const props = computeGraphProperties();
    if (statVertices) statVertices.textContent = props.vertices;
    if (statEdges) statEdges.textContent = props.edges;
    
    const n = props.vertices;
    const MAX_SIZE_FOR_DETECTION = 40;
    
    // Compute and cache the analytic eigenspectrum detection
    // Skip for large graphs to prevent freezing
    if (n <= MAX_SIZE_FOR_DETECTION) {
        cachedAnalyticResult = detectAnalyticEigenspectrum();
    } else {
        cachedAnalyticResult = { type: 'unknown', name: `Graph (n=${n})` };
    }
    
    // Use the cached result for the type display
    // Fall back to simpler detection only if analytic detection found nothing specific
    const displayName = (cachedAnalyticResult && cachedAnalyticResult.type !== 'unknown' && cachedAnalyticResult.type !== 'empty')
        ? cachedAnalyticResult.name
        : (n <= MAX_SIZE_FOR_DETECTION ? detectGraphType().name : `Graph (n=${n})`);
    
    if (statType) statType.textContent = displayName || 'Unknown';
    
    // Update analyze tab content if visible (for tabbed sidebar design)
    const analyzeTab = document.getElementById('sidebar-analyze');
    if (analyzeTab && analyzeTab.classList.contains('active')) {
        // Call full showAnalysis to update everything including graph type header
        showAnalysis();
    }
    
    return props;
}

// Helper function to update analysis displays without showing modal
function updateAnalysisDisplays(graphInfo, props) {
    const n = state.vertexMeshes.length;
    if (n === 0) return;
    
    const MAX_SIZE = 40;
    const isLargeGraph = n > MAX_SIZE;
    
    // Skip all expensive computations for large graphs
    if (isLargeGraph) {
        console.log(`[Analysis] Skipping updateAnalysisDisplays for large graph (n=${n})`);
        return;
    }
    
    const charPoly = computeCharacteristicPolynomial(state.symmetricAdjMatrix);
    
    // Graph properties
    const graphPropertiesDisplay = document.getElementById('graph-properties');
    if (graphPropertiesDisplay) {
        let propsHtml = '';
        const propItems = [
            { label: 'Connected', value: props.connected, isBoolean: true },
            { label: 'Bipartite', value: props.bipartite, isBoolean: true },
            { label: 'Regular', value: props.regular ? `Yes (deg ${props.degree})` : 'No', isBoolean: false, isNo: !props.regular }
        ];
        propItems.forEach(item => {
            const valueClass = item.isBoolean ? (item.value ? '' : 'no') : (item.isNo ? 'no' : '');
            const displayValue = item.isBoolean ? (item.value ? 'Yes' : 'No') : item.value;
            propsHtml += `<div class="property-item"><span class="property-label">${item.label}</span><span class="property-value ${valueClass}">${displayValue}</span></div>`;
        });
        graphPropertiesDisplay.innerHTML = propsHtml;
    }
    
    // The rest of the analysis is done by showAnalysis()
    // Just call it to update eigenvalues, polynomial, etc.
    const numEigs = computeEigenvaluesNumerical(state.symmetricAdjMatrix);
    const symAnalysis = analyzeEigenvaluesForClosedFormsWithN(numEigs, n);
    
    // Symmetric eigenvalue formula
    const analyticFormulaDisplay = document.getElementById('analytic-formula-display');
    if (analyticFormulaDisplay) {
        if (graphInfo.formula) {
            analyticFormulaDisplay.innerHTML = `<span class="formula">${graphInfo.formula}</span>`;
        } else if (symAnalysis.allAnalytic) {
            const formulaParts = symAnalysis.eigenvalues.map(e => {
                const mult = e.multiplicity > 1 ? ` (×${e.multiplicity})` : '';
                return `${e.form}${mult}`;
            });
            analyticFormulaDisplay.innerHTML = `<span class="formula">λ: ${formulaParts.join(', ')}</span>`;
        } else {
            analyticFormulaDisplay.innerHTML = '<span class="hint">No closed-form eigenvalues</span>';
        }
    }
    
    // Skew-symmetric eigenvalues
    const skewEigs = computeSkewSymmetricEigenvalues(state.adjacencyMatrix);
    const skewImagParts = skewEigs.map(e => Math.abs(e.imag));
    // Group with full precision (not toFixed which loses precision!)
    const skewGroups = [];
    const groupTolerance = 1e-6;
    for (const v of skewImagParts) {
        let found = false;
        for (const group of skewGroups) {
            if (Math.abs(group.value - v) < groupTolerance) {
                group.count++;
                found = true;
                break;
            }
        }
        if (!found) {
            skewGroups.push({ value: v, count: 1 });
        }
    }
    const uniqueSkewImag = [];
    for (const group of skewGroups) {
        const mult = group.value < 1e-4 ? group.count : group.count / 2;
        if (mult > 0) uniqueSkewImag.push({ value: group.value, multiplicity: mult });
    }
    uniqueSkewImag.sort((a, b) => b.value - a.value);
    
    // Use graph size n for proper denominator detection, not the number of unique eigenvalues
    const skewAnalysis = analyzeEigenvaluesForClosedFormsWithN(uniqueSkewImag.map(e => e.value), n);
    
    const skewAnalyticFormulaDisplay = document.getElementById('skew-analytic-formula-display');
    if (skewAnalyticFormulaDisplay) {
        if (graphInfo.skewFormula) {
            skewAnalyticFormulaDisplay.innerHTML = `<span class="formula">${graphInfo.skewFormula}</span>`;
        } else if (skewAnalysis.allAnalytic) {
            const formulaParts = skewAnalysis.eigenvalues.map((e, i) => {
                const mult = uniqueSkewImag[i]?.multiplicity > 1 ? ` (×${uniqueSkewImag[i].multiplicity})` : '';
                const formStr = e.value < 1e-4 ? '0' : `±${e.form}i`;
                return `${formStr}${mult}`;
            });
            skewAnalyticFormulaDisplay.innerHTML = `<span class="formula">λ: ${formulaParts.join(', ')}</span>`;
        } else {
            skewAnalyticFormulaDisplay.innerHTML = '<span class="hint">No closed-form eigenvalues</span>';
        }
    }
    
    // Store eigenvalues for eigenmode animation
    cachedSymmetricEigs = numEigs;
    cachedSkewEigs = skewEigs;
    
    // Numerical eigenvalues - make clickable for eigenmode animation
    const eigenvaluesDisplay = document.getElementById('eigenvalues-display');
    if (eigenvaluesDisplay) {
        let eigHtml = '<div class="eigenmode-hint">Click eigenvalue to animate mode</div>';
        numEigs.forEach((ev, i) => {
            eigHtml += `<div class="eigenvalue-item eigenvalue-clickable" data-index="${i}" data-value="${ev}" data-type="symmetric" title="Click to animate this eigenmode">` +
                       `λ${subscript(i+1)} = <span class="real-part">${ev.toFixed(6)}</span>` +
                       `<span class="eigenmode-icon">▶</span></div>`;
        });
        eigenvaluesDisplay.innerHTML = eigHtml || '<span class="hint">No eigenvalues</span>';
        
        // Add click handlers
        eigenvaluesDisplay.querySelectorAll('.eigenvalue-clickable').forEach(el => {
            el.addEventListener('click', handleEigenvalueClick);
        });
    }
    
    const skewEigenvaluesDisplay = document.getElementById('skew-eigenvalues-display');
    if (skewEigenvaluesDisplay) {
        let skewHtml = '<div class="eigenmode-hint">Click eigenvalue to animate mode</div>';
        skewEigs.forEach((ev, i) => {
            skewHtml += `<div class="eigenvalue-item eigenvalue-clickable" data-index="${i}" data-value="${ev.imag}" data-type="skew" title="Click to animate this eigenmode">` +
                        `λ${subscript(i+1)} = <span class="imag-part">${ev.imag >= 0 ? '+' : ''}${ev.imag.toFixed(6)}i</span>` +
                        `<span class="eigenmode-icon">▶</span></div>`;
        });
        skewEigenvaluesDisplay.innerHTML = skewHtml || '<span class="hint">No eigenvalues</span>';
        
        // Add click handlers
        skewEigenvaluesDisplay.querySelectorAll('.eigenvalue-clickable').forEach(el => {
            el.addEventListener('click', handleEigenvalueClick);
        });
    }
    
    // Polynomial - show both symmetric and skew-symmetric
    const charPolyDisplay = document.getElementById('char-polynomial-display');
    if (charPolyDisplay) {
        let skewPolyHtml = '';
        try {
            const skewPoly = computeCharacteristicPolynomial(state.adjacencyMatrix);
            skewPolyHtml = formatPolynomial(skewPoly);
        } catch (e) {
            skewPolyHtml = '<span class="hint">Unable to compute</span>';
        }
        
        charPolyDisplay.innerHTML = `
            <div style="margin-bottom:8px;">
                <span style="color:#4fc3f7;font-weight:bold;">Symmetric:</span>
                <span class="polynomial">${formatPolynomial(charPoly)}</span>
            </div>
            <div>
                <span style="color:#ff9800;font-weight:bold;">Skew-Sym:</span>
                <span class="polynomial">${skewPolyHtml}</span>
            </div>`;
    }
    
    // Complex plane eigenvalue visualization
    drawComplexPlane(numEigs, skewEigs);
}

// =====================================================
// MATRIX & EIGENVALUE ANALYSIS
// =====================================================

export function showAnalysis() {
    // Show modal if it exists (backward compatibility)
    if (matrixModal) {
        matrixModal.classList.add('show');
    }
    
    const n = state.vertexMeshes.length;
    
    // Size limit for expensive operations to prevent freezing
    const MAX_SIZE_FOR_FULL_ANALYSIS = 40;
    const isLargeGraph = n > MAX_SIZE_FOR_FULL_ANALYSIS;
    
    if (isLargeGraph) {
        console.log(`Large graph (n=${n}): skipping expensive analysis operations`);
    }
    
    // Use cached analytic result from updateStats(), or compute if not available
    // Skip for large graphs
    const analyticResult = isLargeGraph ? { type: 'unknown', name: `Graph (n=${n})` } 
        : (cachedAnalyticResult || detectAnalyticEigenspectrum());
    
    // Also get old detection for comparison (fallback) - skip for large graphs
    const graphInfo = isLargeGraph ? { type: 'unknown', name: `Graph (n=${n})` } : detectGraphType();
    const props = computeGraphProperties();
    
    // Skip expensive polynomial computation for large graphs
    const charPoly = isLargeGraph ? [] : computeCharacteristicPolynomial(state.symmetricAdjMatrix);
    
    // Prefer the new detection if it found something specific
    const detectedInfo = (analyticResult.type !== 'unknown' && analyticResult.type !== 'empty') 
        ? analyticResult 
        : graphInfo;
    
    // Graph type display
    const graphTypeDisplay = document.getElementById('graph-type-display');
    if (graphTypeDisplay) {
        const isKnown = analyticResult.type !== 'unknown' && analyticResult.type !== 'empty';
        graphTypeDisplay.innerHTML = `
            <div class="graph-type-box ${isKnown ? '' : 'unknown'}">
                <div class="graph-type-name">${analyticResult.name || graphInfo.name}</div>
            </div>`;
    }
    
    // Graph properties
    const graphPropertiesDisplay = document.getElementById('graph-properties');
    if (graphPropertiesDisplay) {
        graphPropertiesDisplay.innerHTML = `
            <div class="property-list">
                <div class="property-item">
                    <span class="property-label">Vertices</span>
                    <span class="property-value">${props.vertices}</span>
                </div>
                <div class="property-item">
                    <span class="property-label">Edges</span>
                    <span class="property-value">${props.edges}</span>
                </div>
                <div class="property-item">
                    <span class="property-label">Connected</span>
                    <span class="property-value ${props.connected ? '' : 'no'}">${props.connected ? 'Yes' : 'No'}</span>
                </div>
                <div class="property-item">
                    <span class="property-label">Bipartite</span>
                    <span class="property-value ${props.bipartite ? '' : 'no'}">${props.bipartite ? 'Yes' : 'No'}</span>
                </div>
                <div class="property-item">
                    <span class="property-label">Regular</span>
                    <span class="property-value ${props.regular ? '' : 'no'}">${props.regular ? 'Yes (degree ' + props.degree + ')' : 'No'}</span>
                </div>
            </div>`;
    }
    
    // Characteristic polynomials - show BOTH symmetric and skew-symmetric
    const charPolyDisplay = document.getElementById('char-polynomial-display');
    if (charPolyDisplay) {
        // SYMMETRIC characteristic polynomial
        let symFactorizationHtml = '';
        try {
            const polyAnalysis = analyzeCharacteristicPolynomial(state.symmetricAdjMatrix);
            if (polyAnalysis.factorization && polyAnalysis.factors.length > 0) {
                const methodNote = polyAnalysis.usedMuSubstitution ? 
                    ' <span style="color:#4fc3f7;font-size:0.8em;">(μ=λ² substitution)</span>' : '';
                symFactorizationHtml = `<div class="factorization" style="margin-top:4px;font-size:0.85em;color:#888;">
                    Factorization: p(λ) = ${polyAnalysis.factorization}${methodNote}
                </div>`;
            }
        } catch (e) {
            console.warn('Symmetric polynomial factorization failed:', e);
        }
        
        // SKEW-SYMMETRIC characteristic polynomial
        let skewPolyHtml = '';
        let skewFactorizationHtml = '';
        try {
            const skewPoly = computeCharacteristicPolynomial(state.adjacencyMatrix);
            skewPolyHtml = formatPolynomial(skewPoly);
            
            const skewPolyAnalysis = analyzeCharacteristicPolynomial(state.adjacencyMatrix);
            if (skewPolyAnalysis.factorization && skewPolyAnalysis.factors.length > 0) {
                const methodNote = skewPolyAnalysis.usedMuSubstitution ? 
                    ' <span style="color:#ff9800;font-size:0.8em;">(μ=λ² substitution)</span>' : '';
                skewFactorizationHtml = `<div class="factorization" style="margin-top:4px;font-size:0.85em;color:#888;">
                    Factorization: p(λ) = ${skewPolyAnalysis.factorization}${methodNote}
                </div>`;
            }
        } catch (e) {
            console.warn('Skew-symmetric polynomial computation failed:', e);
            skewPolyHtml = '<span class="hint">Unable to compute</span>';
        }
        
        charPolyDisplay.innerHTML = `
            <div class="polynomial-box" style="margin-bottom:12px;">
                <div style="font-weight:bold;color:#4fc3f7;margin-bottom:4px;">Symmetric Adjacency Matrix:</div>
                <div class="polynomial">${formatPolynomial(charPoly)}</div>
                ${symFactorizationHtml}
                <div style="font-size:0.8em;color:#666;margin-top:4px;">
                    → Eigenvalues are <b>real</b> (λ ∈ ℝ)
                </div>
            </div>
            <div class="polynomial-box" style="border-top:1px solid #444;padding-top:12px;">
                <div style="font-weight:bold;color:#ff9800;margin-bottom:4px;">Skew-Symmetric Adjacency Matrix:</div>
                <div class="polynomial">${skewPolyHtml}</div>
                ${skewFactorizationHtml}
                <div style="font-size:0.8em;color:#666;margin-top:4px;">
                    → Eigenvalues are <b>purely imaginary</b> (λ = ±iω)
                </div>
            </div>`;
    }
    
    // Compute numerical eigenvalues once for use in multiple sections
    // For large graphs, still compute eigenvalues but skip expensive analysis
    const numEigs = computeEigenvaluesNumerical(state.symmetricAdjMatrix);
    const symAnalysis = isLargeGraph ? { allAnalytic: false, eigenvalues: [] } 
        : analyzeEigenvaluesForClosedFormsWithN(numEigs, n);
    
    // Try polynomial factorization for unknown graphs - skip for large graphs
    let polyFactorResult = null;
    if (!isLargeGraph && (analyticResult.type === 'unknown' || analyticResult.type === 'empty')) {
        try {
            polyFactorResult = analyzeCharacteristicPolynomial(state.symmetricAdjMatrix);
        } catch (e) {
            console.warn('Polynomial factorization failed:', e);
        }
    }
    
    // Analytic eigenvalue formula (symmetric) - Use new detection first
    const analyticFormulaDisplay = document.getElementById('analytic-formula-display');
    if (analyticFormulaDisplay) {
        if (analyticResult.formula && analyticResult.type !== 'unknown') {
            // New robust detection found a match
            analyticFormulaDisplay.innerHTML = `<div class="formula-box detected"><div class="formula">${analyticResult.formula}</div></div>`;
        } else if (graphInfo.formula && graphInfo.type !== 'unknown') {
            // Fall back to old detection
            analyticFormulaDisplay.innerHTML = `<div class="formula-box"><div class="formula">${graphInfo.formula}</div></div>`;
        } else if (polyFactorResult && polyFactorResult.allExact && polyFactorResult.roots.length > 0) {
            // Polynomial factorization found exact roots!
            const formulaParts = polyFactorResult.roots.map(r => {
                // Count multiplicity
                const matches = polyFactorResult.roots.filter(r2 => Math.abs(r2.value - r.value) < 1e-9);
                return r.form;
            });
            // Deduplicate and add multiplicities
            const rootCounts = new Map();
            for (const r of polyFactorResult.roots) {
                const key = r.form;
                rootCounts.set(key, (rootCounts.get(key) || 0) + 1);
            }
            const uniqueParts = [];
            for (const [form, count] of rootCounts) {
                const mult = count > 1 ? ` (×${count})` : '';
                uniqueParts.push(`${form}${mult}`);
            }
            const methodNote = polyFactorResult.usedMuSubstitution ? 
                '<br><span style="font-size:0.75em;color:#666;">Found via μ=λ² substitution</span>' : '';
            analyticFormulaDisplay.innerHTML = `<div class="formula-box factored">
                <div class="formula" style="color:#4fc3f7;">λ: ${uniqueParts.join(', ')}</div>
                <div class="formula-note" style="font-size:0.85em;color:#888;margin-top:4px;">
                    <b>p(λ) = ${polyFactorResult.factorization}</b>${methodNote}
                </div>
            </div>`;
        } else if (symAnalysis.allAnalytic) {
            // Unknown family but has closed-form eigenvalues - show them
            const formulaParts = symAnalysis.eigenvalues.map(e => {
                const mult = e.multiplicity > 1 ? ` (×${e.multiplicity})` : '';
                return `${e.form}${mult}`;
            });
            analyticFormulaDisplay.innerHTML = `<div class="formula-box"><div class="formula">λ: ${formulaParts.join(', ')}</div></div>`;
        } else {
            analyticFormulaDisplay.innerHTML = '<div class="formula-box"><div class="formula">No closed-form solution detected</div></div>';
        }
    }
    
    // Skew-symmetric eigenvalues for formula section
    const skewEigs = computeSkewSymmetricEigenvalues(state.adjacencyMatrix);
    const skewImagParts = skewEigs.map(e => Math.abs(e.imag));
    
    // Cache eigenvalues for eigenmode animation
    cachedSymmetricEigs = numEigs;
    cachedSkewEigs = skewEigs;
    
    // Skip expensive analysis for large graphs
    let uniqueSkewImag = [];
    let skewAnalysis = { allAnalytic: false, eigenvalues: [] };
    
    if (!isLargeGraph) {
        // Group skew eigenvalues properly (conjugate pairs) - preserve full precision!
        const skewGroups = [];
        const groupTolerance = 1e-6;  // Use same tolerance for grouping
        for (const v of skewImagParts) {
            let found = false;
            for (const group of skewGroups) {
                if (Math.abs(group.value - v) < groupTolerance) {
                    group.count++;
                    found = true;
                    break;
                }
            }
            if (!found) {
                skewGroups.push({ value: v, count: 1 });
            }
        }
        for (const group of skewGroups) {
            // For non-zero values, divide count by 2 (conjugate pairs ±λi)
            const mult = group.value < 1e-4 ? group.count : group.count / 2;
            if (mult > 0) uniqueSkewImag.push({ value: group.value, multiplicity: mult });
        }
        uniqueSkewImag.sort((a, b) => b.value - a.value);
        // Pass graph size n for proper denominator detection (same as symmetric)
        skewAnalysis = analyzeEigenvaluesForClosedFormsWithN(uniqueSkewImag.map(e => e.value), n);
    }
    
    // Analytic eigenvalue formula (skew-symmetric) - Prefer new detection
    const skewAnalyticFormulaDisplay = document.getElementById('skew-analytic-formula-display');
    if (skewAnalyticFormulaDisplay) {
        // Try polynomial factorization for skew-symmetric - skip for large graphs
        let skewPolyFactorResult = null;
        if (!isLargeGraph && (analyticResult.type === 'unknown' || analyticResult.type === 'empty')) {
            try {
                skewPolyFactorResult = analyzeCharacteristicPolynomial(state.adjacencyMatrix);
            } catch (e) {
                console.warn('Skew polynomial factorization failed:', e);
            }
        }
        
        // Build formula from new detection eigenvalues if available
        let skewFormulaStr = null;
        if (analyticResult.eigenvalues && analyticResult.type !== 'unknown') {
            // Format eigenvalues from new detection
            const eigGroups = new Map();
            for (const e of analyticResult.eigenvalues) {
                const key = Math.abs(e.im).toFixed(4);
                eigGroups.set(key, (eigGroups.get(key) || 0) + 1);
            }
            const parts = [];
            for (const [key, count] of eigGroups) {
                const val = parseFloat(key);
                const mult = val < 1e-4 ? count : Math.ceil(count / 2);
                if (mult > 0) {
                    const multStr = mult > 1 ? ` (×${mult})` : '';
                    if (val < 1e-4) {
                        parts.push(`0${multStr}`);
                    } else {
                        parts.push(`±${val.toFixed(4)}i${multStr}`);
                    }
                }
            }
            skewFormulaStr = `λ: ${parts.join(', ')}`;
        }
        
        if (skewFormulaStr && analyticResult.type !== 'unknown') {
            // New robust detection found eigenvalues
            // Prefer the exact skewFormula if available, otherwise use computed formula
            const displayFormula = analyticResult.skewFormula || skewFormulaStr;
            skewAnalyticFormulaDisplay.innerHTML = `<div class="formula-box detected" style="border-left-color:#2196F3;"><div class="formula" style="color:#64b5f6;">${analyticResult.formula}<br><small>${displayFormula}</small></div></div>`;
        } else if (graphInfo.skewFormula) {
            // Fall back to old detection
            skewAnalyticFormulaDisplay.innerHTML = `<div class="formula-box" style="border-left-color:#2196F3;"><div class="formula" style="color:#64b5f6;">${graphInfo.skewFormula}</div></div>`;
        } else if (skewPolyFactorResult && skewPolyFactorResult.allExact && skewPolyFactorResult.roots.length > 0) {
            // Polynomial factorization found exact roots for skew-symmetric
            // For skew-symmetric, eigenvalues are ±iω, so show roots as imaginary
            const rootCounts = new Map();
            for (const r of skewPolyFactorResult.roots) {
                const key = r.form;
                rootCounts.set(key, (rootCounts.get(key) || 0) + 1);
            }
            const uniqueParts = [];
            for (const [form, count] of rootCounts) {
                const mult = count > 1 ? ` (×${count})` : '';
                // Convert real root forms to imaginary: λ² = -ω² means λ = ±iω
                // If form is "0", keep it; otherwise prefix with ±i
                if (form === '0') {
                    uniqueParts.push(`0${mult}`);
                } else {
                    uniqueParts.push(`±${form}i${mult}`);
                }
            }
            const methodNote = skewPolyFactorResult.usedMuSubstitution ? 
                '<br><span style="font-size:0.75em;color:#666;">Found via μ=λ² substitution</span>' : '';
            skewAnalyticFormulaDisplay.innerHTML = `<div class="formula-box factored" style="border-left-color:#2196F3;">
                <div class="formula" style="color:#64b5f6;">λ: ${uniqueParts.join(', ')}</div>
                <div class="formula-note" style="font-size:0.85em;color:#888;margin-top:4px;">
                    <b>p(λ) = ${skewPolyFactorResult.factorization}</b>${methodNote}
                </div>
            </div>`;
        } else if (skewAnalysis.allAnalytic) {
            // Unknown family but has closed-form eigenvalues
            const formulaParts = skewAnalysis.eigenvalues.map((e, i) => {
                const mult = uniqueSkewImag[i]?.multiplicity > 1 ? ` (×${uniqueSkewImag[i].multiplicity})` : '';
                const formStr = e.value < 1e-4 ? '0' : `±${e.form}i`;
                return `${formStr}${mult}`;
            });
            skewAnalyticFormulaDisplay.innerHTML = `<div class="formula-box" style="border-left-color:#2196F3;"><div class="formula" style="color:#64b5f6;">λ: ${formulaParts.join(', ')}</div></div>`;
        } else {
            skewAnalyticFormulaDisplay.innerHTML = '<div class="formula-box" style="border-left-color:#2196F3;"><div class="formula" style="color:#64b5f6;">No closed-form skew-symmetric formula</div></div>';
        }
    }
    
    // Adjacency matrix display
    const matrixDisplay = document.getElementById('matrix-display');
    if (matrixDisplay) {
        if (n > 0) {
            matrixDisplay.innerHTML = renderMatrixTable(state.adjacencyMatrix, true);
        } else {
            matrixDisplay.innerHTML = '<p>No vertices</p>';
        }
    }
    
    // Symmetric adjacency matrix display
    const symmetricMatrixDisplay = document.getElementById('symmetric-matrix-display');
    if (symmetricMatrixDisplay) {
        if (n > 0) {
            symmetricMatrixDisplay.innerHTML = renderMatrixTable(state.symmetricAdjMatrix, false);
        } else {
            symmetricMatrixDisplay.innerHTML = '<p>No vertices</p>';
        }
    }
    
    // Skew-symmetric eigenvalues (numerical) - make clickable for eigenmode animation
    const skewEigenvaluesDisplay = document.getElementById('skew-eigenvalues-display');
    if (skewEigenvaluesDisplay) {
        let skewEigHtml = '<div class="eigenmode-hint">Click eigenvalue to animate mode</div>';
        skewEigs.forEach((ev, i) => {
            skewEigHtml += `
                <div class="eigenvalue-item eigenvalue-clickable" data-index="${i}" data-value="${ev.imag}" data-type="skew" title="Click to animate this eigenmode">
                    λ${subscript(i+1)} = <span class="real-part">0</span> 
                    <span class="imag-part">${ev.imag >= 0 ? '+' : '-'} ${Math.abs(ev.imag).toFixed(6)}i</span>
                    <span class="eigenmode-icon">▶</span>
                </div>`;
        });
        skewEigenvaluesDisplay.innerHTML = skewEigHtml || '<p>No eigenvalues</p>';
        
        // Add click handlers
        skewEigenvaluesDisplay.querySelectorAll('.eigenvalue-clickable').forEach(el => {
            el.addEventListener('click', handleEigenvalueClick);
        });
    }
    
    // Symmetric eigenvalues (numerical) - make clickable for eigenmode animation
    const eigenvaluesDisplay = document.getElementById('eigenvalues-display');
    if (eigenvaluesDisplay) {
        let eigHtml = '<div class="eigenmode-hint">Click eigenvalue to animate mode</div>';
        numEigs.forEach((ev, i) => {
            eigHtml += `
                <div class="eigenvalue-item eigenvalue-clickable" data-index="${i}" data-value="${ev}" data-type="symmetric" title="Click to animate this eigenmode">
                    λ${subscript(i+1)} = <span class="real-part">${ev.toFixed(6)}</span>
                    <span class="eigenmode-icon">▶</span>
                </div>`;
        });
        eigenvaluesDisplay.innerHTML = eigHtml || '<p>No eigenvalues</p>';
        
        // Add click handlers
        eigenvaluesDisplay.querySelectorAll('.eigenvalue-clickable').forEach(el => {
            el.addEventListener('click', handleEigenvalueClick);
        });
    }
    
    // Analytic eigenvalues (symmetric) - reuse symAnalysis computed earlier
    const analyticEigenvaluesDisplay = document.getElementById('analytic-eigenvalues-display');
    if (analyticEigenvaluesDisplay) {
        // Try graph family formulas first, then fall back to numerical detection
        if (graphInfo.eigenvalues) {
            let anaHtml = '<div class="eigenvalues-list">';
            graphInfo.eigenvalues.forEach(ev => {
                const value = ev.value !== undefined ? ev.value : ev;
                anaHtml += `
                    <div class="eigenvalue-item">
                        λ = <span class="real-part">${value.toFixed(6)}</span>
                        ${ev.multiplicity ? ' (mult. ' + ev.multiplicity + ')' : ''}
                    </div>`;
            });
            anaHtml += '</div>';
            analyticEigenvaluesDisplay.innerHTML = anaHtml;
        } else if (symAnalysis.allAnalytic) {
            let anaHtml = '<div class="eigenvalues-list">';
            symAnalysis.eigenvalues.forEach(ev => {
                const multStr = ev.multiplicity > 1 ? ` (mult. ${ev.multiplicity})` : '';
                anaHtml += `
                    <div class="eigenvalue-item">
                        λ = <span class="real-part">${ev.form}</span>${multStr}
                    </div>`;
            });
            anaHtml += '</div>';
            analyticEigenvaluesDisplay.innerHTML = anaHtml;
        } else {
            analyticEigenvaluesDisplay.innerHTML = '<div class="formula-box"><div class="formula-note">No closed-form eigenvalues available</div></div>';
        }
    }
    
    // Analytic eigenvalues (skew-symmetric) - reuse skewAnalysis computed earlier
    const skewAnalyticEigenvaluesDisplay = document.getElementById('skew-analytic-eigenvalues-display');
    if (skewAnalyticEigenvaluesDisplay) {
        if (graphInfo.skewEigenvalues) {
            let skewAnaHtml = '<div class="eigenvalues-list">';
            graphInfo.skewEigenvalues.forEach(ev => {
                const imagStr = ev.imag === 0 ? '0' : (ev.imag >= 0 ? '+' : '') + ev.imag.toFixed(6) + 'i';
                skewAnaHtml += `
                    <div class="eigenvalue-item">
                        λ = <span class="imag-part">${imagStr}</span>
                        ${ev.multiplicity ? ' (mult. ' + ev.multiplicity + ')' : ''}
                    </div>`;
            });
            skewAnaHtml += '</div>';
            skewAnalyticEigenvaluesDisplay.innerHTML = skewAnaHtml;
        } else if (skewAnalysis.allAnalytic) {
            let skewAnaHtml = '<div class="eigenvalues-list">';
            skewAnalysis.eigenvalues.forEach((ev, i) => {
                const mult = uniqueSkewImag[i]?.multiplicity || ev.multiplicity;
                const multStr = mult > 1 ? ` (mult. ${mult})` : '';
                // Format as ±(form)i
                const formStr = ev.value < 1e-4 ? '0' : `±${ev.form}i`;
                skewAnaHtml += `
                    <div class="eigenvalue-item">
                        λ = <span class="imag-part">${formStr}</span>${multStr}
                    </div>`;
            });
            skewAnaHtml += '</div>';
            skewAnalyticEigenvaluesDisplay.innerHTML = skewAnaHtml;
        } else {
            skewAnalyticEigenvaluesDisplay.innerHTML = '<div class="formula-box"><div class="formula-note">No closed-form skew-symmetric eigenvalues available</div></div>';
        }
    }
    
    // Draw complex plane with computed eigenvalues
    drawComplexPlane(numEigs, skewEigs);
}

// =====================================================
// HELPER FUNCTIONS
// =====================================================

function renderMatrixTable(matrix, showNegative = true) {
    const n = matrix.length;
    if (n === 0) return '<p>No vertices</p>';
    
    let html = '<table class="matrix-table"><tr><th></th>';
    
    // Header row
    for (let j = 0; j < n; j++) {
        html += `<th>${j}</th>`;
    }
    html += '</tr>';
    
    // Data rows
    for (let i = 0; i < n; i++) {
        html += `<tr><th>${i}</th>`;
        for (let j = 0; j < n; j++) {
            const val = matrix[i][j];
            let cssClass;
            if (val > 0) {
                cssClass = 'positive';
            } else if (val < 0 && showNegative) {
                cssClass = 'negative';
            } else {
                cssClass = 'zero';
            }
            html += `<td class="${cssClass}">${val}</td>`;
        }
        html += '</tr>';
    }
    
    html += '</table>';
    return html;
}

// =====================================================
// UTILITY EXPORTS
// =====================================================

export function getGraphInfo() {
    return detectGraphType();
}

export function getGraphProperties() {
    return computeGraphProperties();
}

export function getCharacteristicPolynomial() {
    return computeCharacteristicPolynomial(state.symmetricAdjMatrix);
}

export function getEigenvalues() {
    return {
        symmetric: computeEigenvaluesNumerical(state.symmetricAdjMatrix),
        skewSymmetric: computeSkewSymmetricEigenvalues(state.adjacencyMatrix)
    };
}

// =====================================================
// COMPLEX PLANE EIGENVALUE VISUALIZATION
// =====================================================

let complexPlaneCanvas = null;
let complexPlaneCtx = null;
let eigenvaluePoints = []; // Store for hover detection

export function initComplexPlane() {
    complexPlaneCanvas = document.getElementById('analyze-complex-plane');
    if (complexPlaneCanvas) {
        complexPlaneCtx = complexPlaneCanvas.getContext('2d');
        
        // Add hover listener for tooltip
        complexPlaneCanvas.addEventListener('mousemove', handleComplexPlaneHover);
        complexPlaneCanvas.addEventListener('mouseleave', hideEigenvalueTooltip);
    }
    
    // Toggle visibility checkbox
    const showCheckbox = document.getElementById('show-complex-plane');
    if (showCheckbox) {
        showCheckbox.addEventListener('change', () => {
            const container = document.getElementById('complex-plane-container');
            if (container) {
                container.style.display = showCheckbox.checked ? 'block' : 'none';
            }
        });
    }
}

function handleComplexPlaneHover(e) {
    const rect = complexPlaneCanvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    // Scale to canvas coordinates
    const scaleX = complexPlaneCanvas.width / rect.width;
    const scaleY = complexPlaneCanvas.height / rect.height;
    const canvasX = x * scaleX;
    const canvasY = y * scaleY;
    
    // Check if near any eigenvalue point
    const hitRadius = 8;
    let found = null;
    
    for (const pt of eigenvaluePoints) {
        const dx = canvasX - pt.x;
        const dy = canvasY - pt.y;
        if (dx * dx + dy * dy < hitRadius * hitRadius) {
            found = pt;
            break;
        }
    }
    
    const tooltip = document.getElementById('eigenvalue-tooltip');
    if (found && tooltip) {
        const re = found.re;
        const im = found.im;
        const sign = im >= 0 ? '+' : '';
        tooltip.textContent = `λ${found.index} = ${re.toFixed(4)} ${sign} ${im.toFixed(4)}i`;
        tooltip.style.left = (x + 10) + 'px';
        tooltip.style.top = (y - 20) + 'px';
        tooltip.classList.add('visible');
    } else if (tooltip) {
        tooltip.classList.remove('visible');
    }
}

function hideEigenvalueTooltip() {
    const tooltip = document.getElementById('eigenvalue-tooltip');
    if (tooltip) {
        tooltip.classList.remove('visible');
    }
}

export function drawComplexPlane(symmetricEigs, skewEigs) {
    // Store eigenvalues in cache if provided
    if (symmetricEigs !== undefined) {
        cachedSymmetricEigs = symmetricEigs;
    }
    if (skewEigs !== undefined) {
        cachedSkewEigs = skewEigs;
    }
    
    // Use cached values if not provided
    const symEigs = symmetricEigs !== undefined ? symmetricEigs : cachedSymmetricEigs;
    const skEigs = skewEigs !== undefined ? skewEigs : cachedSkewEigs;
    
    if (!complexPlaneCanvas || !complexPlaneCtx) {
        complexPlaneCanvas = document.getElementById('analyze-complex-plane');
        if (!complexPlaneCanvas) return;
        complexPlaneCtx = complexPlaneCanvas.getContext('2d');
    }
    
    const ctx = complexPlaneCtx;
    const W = complexPlaneCanvas.width;
    const H = complexPlaneCanvas.height;
    
    // Clear
    ctx.fillStyle = '#0a0a1a';
    ctx.fillRect(0, 0, W, H);
    
    eigenvaluePoints = []; // Reset for hover detection
    
    // Get α and β from sliders (check both ANALYZE and BOUNDS tabs)
    let alpha = 1.0, beta = 1.0;
    const analyzeAlpha = document.getElementById('analyze-alpha');
    const analyzeBeta = document.getElementById('analyze-beta');
    const zrAlpha = document.getElementById('zr-alpha-slider');
    const zrBeta = document.getElementById('zr-beta-slider');
    
    if (analyzeAlpha) alpha = parseInt(analyzeAlpha.value) / 10;
    else if (zrAlpha) alpha = parseInt(zrAlpha.value) / 10;
    
    if (analyzeBeta) beta = parseInt(analyzeBeta.value) / 10;
    else if (zrBeta) beta = parseInt(zrBeta.value) / 10;
    
    // Handle empty/no eigenvalues
    if ((!symEigs || symEigs.length === 0) && 
        (!skEigs || skEigs.length === 0)) {
        ctx.fillStyle = '#666680';
        ctx.font = '12px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('Build a graph to see eigenvalues', W/2, H/2);
        updateComplexPlaneInfo(0, false, alpha, beta);
        return;
    }
    
    // Compute system eigenvalues: λ_system = -α ± i·β·b
    // For skew-symmetric: b values are the imaginary parts
    const systemEigs = [];
    let maxBaseImag = 0.5; // Max of the base graph eigenvalues (before β scaling)
    
    if (skEigs && skEigs.length > 0) {
        skEigs.forEach((ev, idx) => {
            const b = ev.imag !== undefined ? ev.imag : ev;
            // Track max base eigenvalue for fixed scaling
            if (Math.abs(b) > maxBaseImag) maxBaseImag = Math.abs(b);
            // Each graph eigenvalue b gives system eigenvalue at -α + i·β·b
            systemEigs.push({ 
                re: -alpha, 
                im: beta * b, 
                graphEig: b, 
                index: idx + 1 
            });
        });
    } else if (symEigs && symEigs.length > 0) {
        // Fallback: use symmetric eigenvalues
        symEigs.forEach((b, idx) => {
            if (Math.abs(b) > maxBaseImag) maxBaseImag = Math.abs(b);
            systemEigs.push({ 
                re: -alpha, 
                im: beta * b, 
                graphEig: b, 
                index: idx + 1 
            });
        });
    }
    
    // Use FIXED scale based on max base eigenvalue and reasonable α/β ranges
    // This ensures eigenvalues visually move when α/β change
    const maxAlphaRange = 5.0;  // Assume α can go up to 5
    const maxBetaRange = 5.0;   // Assume β can go up to 5
    const maxImag = maxBaseImag * maxBetaRange * 1.2;
    const maxReal = Math.max(maxAlphaRange * 1.5, 0.5);
    
    // Compute scale with more room on left for stable region
    const scaleX = (W * 0.4) / maxReal;
    const scaleY = (H * 0.42) / maxImag;
    const cx = W * 0.55; // Origin slightly right of center
    const cy = H / 2;
    
    // Draw stable region (Re < 0)
    ctx.fillStyle = 'rgba(76, 175, 80, 0.12)';
    ctx.fillRect(0, 0, cx, H);
    
    // Label stable region
    ctx.fillStyle = 'rgba(76, 175, 80, 0.4)';
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('Stable', 5, 15);
    
    // Draw axes
    ctx.strokeStyle = '#444466';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, cy);
    ctx.lineTo(W, cy);
    ctx.moveTo(cx, 0);
    ctx.lineTo(cx, H);
    ctx.stroke();
    
    // Axis labels
    ctx.fillStyle = '#666';
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText('Re(λ)', W - 5, cy - 5);
    ctx.textAlign = 'left';
    ctx.fillText('Im(λ)', cx + 5, 12);
    
    // Draw stability boundary (Re = 0)
    ctx.strokeStyle = '#4CAF50';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx, 0);
    ctx.lineTo(cx, H);
    ctx.stroke();
    
    // Draw alpha line (Re = -α)
    if (alpha > 0) {
        const alphaX = cx - alpha * scaleX;
        if (alphaX > 5 && alphaX < W - 5) {
            ctx.strokeStyle = '#9c27b0';
            ctx.lineWidth = 1;
            ctx.setLineDash([4, 4]);
            ctx.beginPath();
            ctx.moveTo(alphaX, 0);
            ctx.lineTo(alphaX, H);
            ctx.stroke();
            ctx.setLineDash([]);
            
            // Label
            ctx.fillStyle = '#9c27b0';
            ctx.font = '9px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(`-α = -${alpha.toFixed(1)}`, alphaX, 12);
        }
    }
    
    // Draw bounding rectangle
    if (systemEigs.length > 0) {
        const minIm = Math.min(...systemEigs.map(e => e.im));
        const maxIm = Math.max(...systemEigs.map(e => e.im));
        
        const x1 = cx - alpha * scaleX - 3;
        const x2 = cx - alpha * scaleX + 3;
        const y1 = cy - maxIm * scaleY;
        const y2 = cy - minIm * scaleY;
        
        ctx.strokeStyle = '#ff9800';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([5, 5]);
        ctx.strokeRect(x1, y1, x2 - x1, y2 - y1);
        ctx.setLineDash([]);
    }
    
    // Draw eigenvalue count at bottom
    const n = systemEigs.length;
    ctx.fillStyle = '#888';
    ctx.font = '9px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`n=${n}`, 5, H - 5);
    
    // Draw α, β values
    ctx.textAlign = 'left';
    ctx.fillStyle = '#9c27b0';
    ctx.fillText(`α=${alpha.toFixed(1)}, β=${beta.toFixed(1)}`, 5, H - 18);
    
    // Draw eigenvalues
    systemEigs.forEach((e, i) => {
        const x = cx + e.re * scaleX;
        const y = cy - e.im * scaleY;
        
        // All eigenvalues are at Re = -α, so all stable if α > 0
        const isStable = e.re < 0;
        ctx.fillStyle = isStable ? '#4CAF50' : '#f44336';
        
        ctx.beginPath();
        ctx.arc(x, y, 4, 0, 2 * Math.PI);
        ctx.fill();
        
        // Outline for visibility
        ctx.strokeStyle = isStable ? '#2E7D32' : '#c62828';
        ctx.lineWidth = 1;
        ctx.stroke();
        
        eigenvaluePoints.push({ x, y, re: e.re, im: e.im, index: e.index, graphEig: e.graphEig });
    });
    
    // Update info display
    const allStable = alpha > 0;
    updateComplexPlaneInfo(n, allStable, alpha, beta);
}

function updateComplexPlaneInfo(count, isStable, alpha, beta) {
    const countEl = document.getElementById('analyze-ev-count');
    if (countEl) {
        countEl.textContent = `${count} eigenvalues (α=${alpha.toFixed(1)}, β=${beta.toFixed(1)})`;
    }
    
    const stabilityEl = document.getElementById('analyze-stability');
    if (stabilityEl) {
        if (count === 0) {
            stabilityEl.textContent = '--';
            stabilityEl.className = 'stability-badge';
        } else if (isStable) {
            stabilityEl.textContent = 'Stable (Re < 0)';
            stabilityEl.className = 'stability-badge stable';
        } else {
            stabilityEl.textContent = 'Unstable';
            stabilityEl.className = 'stability-badge unstable';
        }
    }
}