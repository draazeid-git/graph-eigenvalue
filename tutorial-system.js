/**
 * Tutorial System for Zeid-Rosenberg Eigenvalue Explorer
 * Interactive guided tours for students and researchers
 * 
 * Features:
 * - Spotlight highlighting
 * - Step-by-step navigation
 * - Wait for user actions
 * - Progress persistence
 * - Multiple tour support
 */

// =====================================================
// TUTORIAL ENGINE CLASS
// =====================================================

export class TutorialEngine {
    constructor() {
        this.currentTour = null;
        this.currentStepIndex = 0;
        this.isActive = false;
        this.actionResolver = null;
        this.boundActionHandler = null;
        
        // Create overlay elements
        this.createOverlayElements();
        
        // Load progress from localStorage
        this.progress = this.loadProgress();
        
        // Bind keyboard handler
        this.handleKeydown = this.handleKeydown.bind(this);
    }
    
    // =====================================================
    // OVERLAY CREATION
    // =====================================================
    
    createOverlayElements() {
        // Main overlay backdrop
        this.overlay = document.createElement('div');
        this.overlay.className = 'tutorial-overlay';
        this.overlay.innerHTML = `
            <div class="tutorial-backdrop"></div>
            <div class="tutorial-spotlight"></div>
            <div class="tutorial-dialog">
                <div class="tutorial-header">
                    <span class="tutorial-tour-name"></span>
                    <span class="tutorial-step-counter"></span>
                </div>
                <div class="tutorial-content">
                    <div class="tutorial-title"></div>
                    <div class="tutorial-description"></div>
                    <div class="tutorial-action-hint"></div>
                </div>
                <div class="tutorial-footer">
                    <div class="tutorial-progress-bar">
                        <div class="tutorial-progress-fill"></div>
                    </div>
                    <div class="tutorial-buttons">
                        <button class="tutorial-btn tutorial-btn-skip">Skip Tour</button>
                        <div class="tutorial-nav">
                            <button class="tutorial-btn tutorial-btn-prev">← Back</button>
                            <button class="tutorial-btn tutorial-btn-next">Next →</button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        document.body.appendChild(this.overlay);
        
        // Cache element references
        this.backdrop = this.overlay.querySelector('.tutorial-backdrop');
        this.spotlight = this.overlay.querySelector('.tutorial-spotlight');
        this.dialog = this.overlay.querySelector('.tutorial-dialog');
        this.tourNameEl = this.overlay.querySelector('.tutorial-tour-name');
        this.stepCounterEl = this.overlay.querySelector('.tutorial-step-counter');
        this.titleEl = this.overlay.querySelector('.tutorial-title');
        this.descriptionEl = this.overlay.querySelector('.tutorial-description');
        this.actionHintEl = this.overlay.querySelector('.tutorial-action-hint');
        this.progressFill = this.overlay.querySelector('.tutorial-progress-fill');
        this.prevBtn = this.overlay.querySelector('.tutorial-btn-prev');
        this.nextBtn = this.overlay.querySelector('.tutorial-btn-next');
        this.skipBtn = this.overlay.querySelector('.tutorial-btn-skip');
        
        // Button event listeners
        this.prevBtn.addEventListener('click', () => this.prevStep());
        this.nextBtn.addEventListener('click', () => this.nextStep());
        this.skipBtn.addEventListener('click', () => this.endTour());
        
        // Click on overlay to advance (if no action required)
        this.overlay.addEventListener('click', (e) => {
            if (e.target === this.overlay && !this.currentStep?.waitFor) {
                this.nextStep();
            }
        });
    }
    
    // =====================================================
    // TOUR CONTROL
    // =====================================================
    
    startTour(tour) {
        if (!tour || !tour.steps || tour.steps.length === 0) {
            console.error('[Tutorial] Invalid tour:', tour);
            return;
        }
        
        this.currentTour = tour;
        this.currentStepIndex = 0;
        this.isActive = true;
        
        // Show overlay
        this.overlay.classList.add('active');
        document.addEventListener('keydown', this.handleKeydown);
        
        // Update tour name
        this.tourNameEl.textContent = tour.name || 'Tutorial';
        
        console.log(`[Tutorial] Starting tour: ${tour.id}`);
        this.showStep(0);
    }
    
    endTour(completed = false) {
        if (!this.isActive) return;
        
        // Clean up action listener if any
        this.cleanupActionListener();
        
        // Hide overlay
        this.overlay.classList.remove('active');
        this.spotlight.style.display = 'none';
        
        // Remove keyboard listener
        document.removeEventListener('keydown', this.handleKeydown);
        
        // Save progress
        if (completed && this.currentTour) {
            this.progress[this.currentTour.id] = {
                completed: true,
                completedAt: new Date().toISOString()
            };
            this.saveProgress();
        }
        
        console.log(`[Tutorial] Ended tour: ${this.currentTour?.id}, completed: ${completed}`);
        
        this.currentTour = null;
        this.currentStepIndex = 0;
        this.isActive = false;
    }
    
    // =====================================================
    // STEP NAVIGATION
    // =====================================================
    
    get currentStep() {
        if (!this.currentTour) return null;
        return this.currentTour.steps[this.currentStepIndex];
    }
    
    showStep(index) {
        if (!this.currentTour) return;
        
        const steps = this.currentTour.steps;
        if (index < 0 || index >= steps.length) return;
        
        // Clean up previous action listener
        this.cleanupActionListener();
        
        this.currentStepIndex = index;
        const step = steps[index];
        
        // Update step counter
        this.stepCounterEl.textContent = `Step ${index + 1} of ${steps.length}`;
        
        // Update progress bar
        const progress = ((index + 1) / steps.length) * 100;
        this.progressFill.style.width = `${progress}%`;
        
        // Update content
        this.titleEl.innerHTML = step.title || '';
        this.descriptionEl.innerHTML = step.description || '';
        
        // Update action hint
        if (step.waitFor) {
            this.actionHintEl.innerHTML = `<span class="action-indicator">👆</span> ${step.actionHint || 'Complete the action to continue'}`;
            this.actionHintEl.style.display = 'block';
            this.nextBtn.disabled = true;
            this.nextBtn.textContent = 'Waiting...';
        } else {
            this.actionHintEl.style.display = 'none';
            this.nextBtn.disabled = false;
            this.nextBtn.textContent = index === steps.length - 1 ? 'Finish ✓' : 'Next →';
        }
        
        // Update prev button
        this.prevBtn.disabled = index === 0;
        
        // Execute pre-step action (e.g., switch tabs)
        if (step.beforeShow) {
            try {
                step.beforeShow();
            } catch (e) {
                console.warn('[Tutorial] beforeShow error:', e);
            }
        }
        
        // Highlight target element
        if (step.target) {
            this.highlightElement(step.target, step.spotlightPadding);
        } else {
            this.spotlight.style.display = 'none';
            this.backdrop.style.display = 'block'; // Show backdrop when no target
            this.centerDialog();
        }
        
        // Position dialog
        if (step.dialogPosition) {
            this.positionDialog(step.dialogPosition);
        } else if (step.target) {
            this.positionDialogNearTarget(step.target);
        }
        
        // Set up action listener if waiting for action
        if (step.waitFor) {
            this.setupActionListener(step.waitFor);
        }
    }
    
    nextStep() {
        if (!this.currentTour) return;
        
        // If waiting for action, don't allow manual advance
        if (this.currentStep?.waitFor && this.nextBtn.disabled) {
            return;
        }
        
        if (this.currentStepIndex < this.currentTour.steps.length - 1) {
            this.showStep(this.currentStepIndex + 1);
        } else {
            // Tour complete
            this.endTour(true);
            this.showCompletionMessage();
        }
    }
    
    prevStep() {
        if (this.currentStepIndex > 0) {
            this.showStep(this.currentStepIndex - 1);
        }
    }
    
    // =====================================================
    // SPOTLIGHT & POSITIONING
    // =====================================================
    
    highlightElement(selector, padding = 8) {
        const element = typeof selector === 'string' 
            ? document.querySelector(selector) 
            : selector;
            
        if (!element) {
            console.warn(`[Tutorial] Target element not found: ${selector}`);
            this.spotlight.style.display = 'none';
            this.backdrop.style.display = 'block'; // Show backdrop when no target
            return;
        }
        
        const rect = element.getBoundingClientRect();
        
        // Hide backdrop, show spotlight (spotlight creates its own dark overlay via box-shadow)
        this.backdrop.style.display = 'none';
        this.spotlight.style.display = 'block';
        this.spotlight.style.left = `${rect.left - padding}px`;
        this.spotlight.style.top = `${rect.top - padding}px`;
        this.spotlight.style.width = `${rect.width + padding * 2}px`;
        this.spotlight.style.height = `${rect.height + padding * 2}px`;
        
        // Scroll element into view if needed
        if (rect.top < 0 || rect.bottom > window.innerHeight) {
            element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }
    
    positionDialogNearTarget(selector) {
        const element = typeof selector === 'string' 
            ? document.querySelector(selector) 
            : selector;
            
        if (!element) {
            this.centerDialog();
            return;
        }
        
        const rect = element.getBoundingClientRect();
        const dialogRect = this.dialog.getBoundingClientRect();
        const margin = 20;
        
        let left, top;
        
        // Determine best position (prefer right, then bottom, then left, then top)
        const spaceRight = window.innerWidth - rect.right;
        const spaceBottom = window.innerHeight - rect.bottom;
        const spaceLeft = rect.left;
        const spaceTop = rect.top;
        
        if (spaceRight >= dialogRect.width + margin) {
            // Position to the right
            left = rect.right + margin;
            top = Math.max(margin, Math.min(rect.top, window.innerHeight - dialogRect.height - margin));
        } else if (spaceBottom >= dialogRect.height + margin) {
            // Position below
            left = Math.max(margin, Math.min(rect.left, window.innerWidth - dialogRect.width - margin));
            top = rect.bottom + margin;
        } else if (spaceLeft >= dialogRect.width + margin) {
            // Position to the left
            left = rect.left - dialogRect.width - margin;
            top = Math.max(margin, Math.min(rect.top, window.innerHeight - dialogRect.height - margin));
        } else if (spaceTop >= dialogRect.height + margin) {
            // Position above
            left = Math.max(margin, Math.min(rect.left, window.innerWidth - dialogRect.width - margin));
            top = rect.top - dialogRect.height - margin;
        } else {
            // Default to center
            this.centerDialog();
            return;
        }
        
        this.dialog.style.left = `${left}px`;
        this.dialog.style.top = `${top}px`;
        this.dialog.style.transform = 'none';
    }
    
    positionDialog(position) {
        const margin = 20;
        const dialogRect = this.dialog.getBoundingClientRect();
        
        switch (position) {
            case 'center':
                this.centerDialog();
                break;
            case 'top-left':
                this.dialog.style.left = `${margin}px`;
                this.dialog.style.top = `${margin}px`;
                this.dialog.style.transform = 'none';
                break;
            case 'top-right':
                this.dialog.style.left = `${window.innerWidth - dialogRect.width - margin}px`;
                this.dialog.style.top = `${margin}px`;
                this.dialog.style.transform = 'none';
                break;
            case 'bottom-left':
                this.dialog.style.left = `${margin}px`;
                this.dialog.style.top = `${window.innerHeight - dialogRect.height - margin}px`;
                this.dialog.style.transform = 'none';
                break;
            case 'bottom-right':
                this.dialog.style.left = `${window.innerWidth - dialogRect.width - margin}px`;
                this.dialog.style.top = `${window.innerHeight - dialogRect.height - margin}px`;
                this.dialog.style.transform = 'none';
                break;
            default:
                this.centerDialog();
        }
    }
    
    centerDialog() {
        this.dialog.style.left = '50%';
        this.dialog.style.top = '50%';
        this.dialog.style.transform = 'translate(-50%, -50%)';
    }
    
    // =====================================================
    // ACTION WAITING
    // =====================================================
    
    setupActionListener(waitConfig) {
        const { selector, event, validator } = waitConfig;
        
        const element = typeof selector === 'string' 
            ? document.querySelector(selector) 
            : selector;
            
        if (!element) {
            console.warn(`[Tutorial] Wait target not found: ${selector}`);
            // Auto-advance after timeout as fallback
            setTimeout(() => this.completeAction(), 2000);
            return;
        }
        
        this.boundActionHandler = (e) => {
            // If there's a validator, check it
            if (validator && !validator(e)) {
                return;
            }
            this.completeAction();
        };
        
        element.addEventListener(event || 'click', this.boundActionHandler);
        this.actionListenerElement = element;
        this.actionListenerEvent = event || 'click';
    }
    
    cleanupActionListener() {
        if (this.boundActionHandler && this.actionListenerElement) {
            this.actionListenerElement.removeEventListener(
                this.actionListenerEvent, 
                this.boundActionHandler
            );
        }
        this.boundActionHandler = null;
        this.actionListenerElement = null;
        this.actionListenerEvent = null;
    }
    
    completeAction() {
        // Clean up listener
        this.cleanupActionListener();
        
        // Enable next button and auto-advance
        this.nextBtn.disabled = false;
        this.nextBtn.textContent = 'Next →';
        this.actionHintEl.innerHTML = '<span class="action-complete">✓</span> Action completed!';
        
        // Auto-advance after brief delay
        setTimeout(() => {
            if (this.isActive) {
                this.nextStep();
            }
        }, 500);
    }
    
    // =====================================================
    // KEYBOARD HANDLING
    // =====================================================
    
    handleKeydown(e) {
        if (!this.isActive) return;
        
        switch (e.key) {
            case 'Escape':
                this.endTour(false);
                break;
            case 'ArrowRight':
            case 'Enter':
                if (!this.nextBtn.disabled) {
                    this.nextStep();
                }
                break;
            case 'ArrowLeft':
                if (!this.prevBtn.disabled) {
                    this.prevStep();
                }
                break;
        }
    }
    
    // =====================================================
    // PROGRESS PERSISTENCE
    // =====================================================
    
    loadProgress() {
        try {
            const saved = localStorage.getItem('tutorial_progress');
            return saved ? JSON.parse(saved) : {};
        } catch (e) {
            return {};
        }
    }
    
    saveProgress() {
        try {
            localStorage.setItem('tutorial_progress', JSON.stringify(this.progress));
        } catch (e) {
            console.warn('[Tutorial] Could not save progress:', e);
        }
    }
    
    isTourCompleted(tourId) {
        return this.progress[tourId]?.completed || false;
    }
    
    resetProgress() {
        this.progress = {};
        this.saveProgress();
    }
    
    // =====================================================
    // COMPLETION MESSAGE
    // =====================================================
    
    showCompletionMessage() {
        const tourName = this.currentTour?.name || 'Tutorial';
        
        // Create a temporary completion overlay
        const completion = document.createElement('div');
        completion.className = 'tutorial-completion';
        completion.innerHTML = `
            <div class="tutorial-completion-dialog">
                <div class="tutorial-completion-icon">🎉</div>
                <div class="tutorial-completion-title">Tour Complete!</div>
                <div class="tutorial-completion-message">
                    You've completed the <strong>${tourName}</strong> tour.
                </div>
                <button class="tutorial-btn tutorial-btn-primary">Got it!</button>
            </div>
        `;
        
        document.body.appendChild(completion);
        
        // Animate in
        requestAnimationFrame(() => {
            completion.classList.add('active');
        });
        
        // Close on button click
        completion.querySelector('button').addEventListener('click', () => {
            completion.classList.remove('active');
            setTimeout(() => completion.remove(), 300);
        });
        
        // Auto-close after 3 seconds
        setTimeout(() => {
            if (document.body.contains(completion)) {
                completion.classList.remove('active');
                setTimeout(() => completion.remove(), 300);
            }
        }, 3000);
    }
}

// =====================================================
// TOUR DEFINITIONS
// =====================================================

export const TOURS = {
    // Tour 1: Building Graphs
    buildGraphs: {
        id: 'build-graphs',
        name: '🏗️ Building Graphs',
        description: 'Learn to create and customize graphs',
        steps: [
            {
                title: 'Welcome to the Eigenvalue Explorer! 👋',
                description: `
                    <p>This tool helps you explore <strong>spectral graph theory</strong> through interactive visualization.</p>
                    <p>In this tour, you'll learn how to:</p>
                    <ul>
                        <li>Create graphs from templates</li>
                        <li>Use force-directed layouts</li>
                        <li>Visualize polygon faces</li>
                    </ul>
                `,
                dialogPosition: 'center'
            },
            {
                title: 'The BUILD Tab',
                description: `
                    <p>This is the <strong>BUILD</strong> tab where you create graphs.</p>
                    <p>You can select from 60+ built-in templates or build custom graphs.</p>
                `,
                target: '[data-tab="build"]',
                beforeShow: () => {
                    document.querySelector('[data-tab="build"]')?.click();
                }
            },
            {
                title: 'Select a Graph from QUICK TEMPLATES',
                description: `
                    <p>Use this dropdown to choose a graph type.</p>
                    <p>Try selecting <strong>"Wheel W_n"</strong> - a classic graph with interesting eigenvalues.</p>
                `,
                target: '#template-select',
                waitFor: {
                    selector: '#template-select',
                    event: 'change'
                },
                actionHint: 'Select a preset from the dropdown (currently shows "Custom")'
            },
            {
                title: 'Set Parameters',
                description: `
                    <p>Many templates have a parameter <strong>n</strong> that controls the size.</p>
                    <p>For a Wheel graph, n is the number of outer vertices.</p>
                    <p>You can adjust this value before applying the template.</p>
                `,
                target: '#param-n'
            },
            {
                title: 'Apply the Template',
                description: `
                    <p>Click <strong>"Apply Template"</strong> to generate the graph!</p>
                    <p>The graph will appear in the 3D view on the left.</p>
                `,
                target: '#apply-template-btn',
                waitFor: {
                    selector: '#apply-template-btn',
                    event: 'click'
                },
                actionHint: 'Click the Apply Template button'
            },
            {
                title: 'Your Graph is Ready! 🎉',
                description: `
                    <p>Excellent! You've created your first graph.</p>
                    <p>You can <strong>click and drag</strong> to rotate the 3D view, and <strong>scroll</strong> to zoom.</p>
                `,
                dialogPosition: 'center'
            },
            {
                title: 'Layout Options',
                description: `
                    <p>Choose how vertices are arranged:</p>
                    <ul>
                        <li><strong>Circle</strong> - 2D circular layout</li>
                        <li><strong>Sphere</strong> - 3D spherical layout</li>
                        <li><strong>Grid</strong> - Regular grid pattern</li>
                        <li><strong>Concentric</strong> - Multiple rings</li>
                    </ul>
                `,
                target: '#layout-type'
            },
            {
                title: 'Force-Directed Layout',
                description: `
                    <p>Click <strong>"▶ Start"</strong> to run the force-directed layout.</p>
                    <p>This simulates physical forces:</p>
                    <ul>
                        <li>Edges act like springs (attraction)</li>
                        <li>Vertices repel each other</li>
                        <li>Result: aesthetically pleasing layout</li>
                    </ul>
                `,
                target: '#force-layout-btn',
                waitFor: {
                    selector: '#force-layout-btn',
                    event: 'click'
                },
                actionHint: 'Click ▶ Start to run force layout'
            },
            {
                title: 'Solid Faces (Polyhedron View)',
                description: `
                    <p>Toggle <strong>"Solid Faces"</strong> to visualize polygon faces in the graph.</p>
                    <p>Faces are colored regions bounded by cycles:</p>
                    <ul>
                        <li>Helps see graph structure</li>
                        <li>Shows enclosed regions</li>
                        <li>Great for polyhedra visualization</li>
                    </ul>
                `,
                target: '#solid-faces-checkbox'
            },
            {
                title: 'Graph Products (Advanced)',
                description: `
                    <p>You can combine graphs using <strong>product operations</strong> in the ADVANCED tab:</p>
                    <ul>
                        <li><strong>□ Cartesian</strong> - Connect vertices if equal in one graph AND adjacent in other</li>
                        <li><strong>⊗ Tensor</strong> - Connect if adjacent in BOTH graphs</li>
                        <li><strong>⚡ Strong</strong> - Cartesian ∪ Tensor</li>
                    </ul>
                    <p>Products let you build complex graphs from simple ones!</p>
                `,
                target: '[data-tab="advanced"]',
                beforeShow: () => {
                    document.querySelector('[data-tab="advanced"]')?.click();
                }
            },
            {
                title: 'BUILD Tour Complete! ✓',
                description: `
                    <p>You've learned the basics of graph construction!</p>
                    <p><strong>Next steps:</strong></p>
                    <ul>
                        <li>Try the <strong>EDIT</strong> tour to modify graphs</li>
                        <li>Try the <strong>ANALYZE</strong> tour to explore eigenvalues</li>
                    </ul>
                `,
                dialogPosition: 'center'
            }
        ]
    },
    
    // Tour 2: Editing Graphs
    editGraphs: {
        id: 'edit-graphs',
        name: '✏️ Editing Graphs',
        description: 'Learn to modify graphs manually',
        steps: [
            {
                title: 'The EDIT Tab',
                description: `
                    <p>The <strong>EDIT</strong> tab provides tools for manual graph modification.</p>
                    <p>You can add/remove vertices, create edges, and reposition nodes.</p>
                `,
                target: '[data-tab="edit"]',
                beforeShow: () => {
                    document.querySelector('[data-tab="edit"]')?.click();
                }
            },
            {
                title: 'Edit Mode Buttons',
                description: `
                    <p>Select your editing mode:</p>
                    <ul>
                        <li><strong>👁 View</strong> - Rotate and zoom the view</li>
                        <li><strong>✋ Drag</strong> - Move vertices in 3D</li>
                        <li><strong>➕ Add Edge</strong> - Click two vertices to connect</li>
                        <li><strong>🗑 Del Edge</strong> - Click edges to remove</li>
                        <li><strong>⊕ Add Node</strong> - Click to place new vertices</li>
                        <li><strong>⊖ Del Node</strong> - Click vertices to remove</li>
                    </ul>
                `,
                target: '#view-mode-btn'
            },
            {
                title: 'Drag Mode',
                description: `
                    <p>Click <strong>"✋ Drag"</strong> to reposition vertices interactively.</p>
                    <p>Click and drag any vertex to move it in 3D space.</p>
                `,
                target: '#drag-mode-btn',
                waitFor: {
                    selector: '#drag-mode-btn',
                    event: 'click'
                },
                actionHint: 'Click the Drag button'
            },
            {
                title: 'Camera Projection',
                description: `
                    <p>Switch between projection planes for easier editing:</p>
                    <ul>
                        <li><strong>XY</strong> - Top-down view</li>
                        <li><strong>XZ</strong> - Front view</li>
                        <li><strong>YZ</strong> - Side view</li>
                    </ul>
                `,
                target: '.projection-buttons'
            },
            {
                title: 'Snap to Grid',
                description: `
                    <p>Enable <strong>Snap to Grid</strong> for precise vertex placement.</p>
                    <p>Adjust grid size for finer or coarser snapping.</p>
                    <p>The snap grid controls appear when in Drag mode.</p>
                `,
                target: '#snap-grid-controls'
            },
            {
                title: 'EDIT Tour Complete! ✓',
                description: `
                    <p>You now know how to modify graphs manually!</p>
                    <p><strong>Tips:</strong></p>
                    <ul>
                        <li>Use keyboard shortcuts for faster editing</li>
                        <li>Combine with force layout for hybrid approaches</li>
                    </ul>
                `,
                dialogPosition: 'center'
            }
        ]
    },
    
    // Tour 3: Spectral Analysis
    spectralAnalysis: {
        id: 'spectral-analysis',
        name: '📊 Spectral Analysis',
        description: 'Explore matrices, polynomials, and eigenvalues',
        steps: [
            {
                title: 'The ANALYZE Tab',
                description: `
                    <p>The <strong>ANALYZE</strong> tab reveals the mathematical structure of your graph.</p>
                    <p>View matrices, characteristic polynomials, and eigenvalues.</p>
                `,
                target: '[data-tab="analyze"]',
                beforeShow: () => {
                    document.querySelector('[data-tab="analyze"]')?.click();
                }
            },
            {
                title: 'Symmetric Eigenvalues',
                description: `
                    <p>The <strong>symmetric eigenvalues</strong> come from the undirected adjacency matrix.</p>
                    <p>For many graph families, <strong>closed-form formulas</strong> are detected automatically.</p>
                    <p>Example: Cycle Cₙ has λₖ = 2cos(2πk/n)</p>
                `,
                target: '#analytic-formula-display'
            },
            {
                title: 'Eigenvalue List',
                description: `
                    <p>The numerical eigenvalues are listed below the formula.</p>
                    <p>They reveal fundamental properties like spectral radius and energy.</p>
                `,
                target: '#eigenvalues-display'
            },
            {
                title: 'Click to Animate! 🎬',
                description: `
                    <p><strong>Click any eigenvalue</strong> to animate the corresponding eigenmode!</p>
                    <p>Watch the vertices oscillate according to the eigenvector.</p>
                `,
                target: '#eigenvalues-display',
                waitFor: {
                    selector: '#eigenvalues-display',
                    event: 'click'
                },
                actionHint: 'Click an eigenvalue to see its eigenmode'
            },
            {
                title: 'Skew-Symmetric Eigenvalues',
                description: `
                    <p>The <strong>skew-symmetric eigenvalues</strong> are purely imaginary: ±iλ</p>
                    <p>These drive the port-Hamiltonian dynamics simulation.</p>
                `,
                target: '#skew-eigenvalues-display'
            },
            {
                title: 'Complex Plane',
                description: `
                    <p>The <strong>complex plane</strong> visualizes all eigenvalues.</p>
                    <p>Adjust α (damping) and β (coupling) to see how system poles move.</p>
                `,
                target: '#analyze-complex-plane'
            },
            {
                title: 'Characteristic Polynomial',
                description: `
                    <p>The <strong>characteristic polynomial</strong> det(λI - A) is computed using the <strong>SFF algorithm</strong>.</p>
                    <p>This uses exact BigInt arithmetic for precise coefficients.</p>
                `,
                target: '#char-polynomial-display'
            },
            {
                title: 'ANALYZE Tour Complete! ✓',
                description: `
                    <p>You've explored the spectral properties of graphs!</p>
                    <p><strong>Key concepts:</strong></p>
                    <ul>
                        <li>Eigenvalues reveal graph properties</li>
                        <li>Click eigenvalues to visualize modes</li>
                        <li>Complex plane shows system stability</li>
                    </ul>
                `,
                dialogPosition: 'center'
            }
        ]
    },
    
    // Tour 4: Dynamics Simulation
    dynamicsSimulation: {
        id: 'dynamics-simulation',
        name: '🎬 Dynamics & Power Flow',
        description: 'Animate nodes and visualize energy flow',
        steps: [
            {
                title: 'The SIMULATE Tab',
                description: `
                    <p>The <strong>SIMULATE</strong> tab brings your graph to life!</p>
                    <p>Watch nodes oscillate and see power flow along edges.</p>
                `,
                target: '[data-tab="simulate"]',
                beforeShow: () => {
                    document.querySelector('[data-tab="simulate"]')?.click();
                }
            },
            {
                title: 'Start Dynamics',
                description: `
                    <p>Click <strong>"Start"</strong> to begin the simulation.</p>
                    <p>The system evolves according to ẋ = Jx where J is skew-symmetric.</p>
                `,
                target: '#start-dynamics-btn',
                waitFor: {
                    selector: '#start-dynamics-btn',
                    event: 'click'
                },
                actionHint: 'Click Start to begin simulation'
            },
            {
                title: '🆕 Choose an Integrator',
                description: `
                    <p>Select the numerical integration method:</p>
                    <ul>
                        <li><strong>Rodrigues</strong> - Exact exponential for skew-symmetric matrices. Perfect energy conservation!</li>
                        <li><strong>Cayley</strong> - Symplectic method, good stability and energy preservation</li>
                        <li><strong>Trapezoidal</strong> - Standard implicit method, may have small energy drift</li>
                    </ul>
                    <p>For skew-symmetric J, Rodrigues is mathematically exact.</p>
                `,
                target: '#integrator-select'
            },
            {
                title: 'Timestep & Speed',
                description: `
                    <p>Adjust simulation parameters:</p>
                    <ul>
                        <li><strong>Timestep</strong> - Larger = faster but less accurate</li>
                        <li><strong>Speed</strong> - Visual playback speed multiplier</li>
                    </ul>
                `,
                target: '#timestep-select'
            },
            {
                title: 'Power Flow Arrows',
                description: `
                    <p>Arrows on edges show <strong>power flow</strong> direction and magnitude.</p>
                    <p>Power Pᵢⱼ = Aᵢⱼ · xᵢ · xⱼ flows between connected nodes.</p>
                    <p>Arrow direction shows energy transfer!</p>
                `,
                dialogPosition: 'center'
            },
            {
                title: 'Node State Colors',
                description: `
                    <p>Node colors indicate state magnitude:</p>
                    <ul>
                        <li><strong>Cyan</strong> - Positive state (+xᵢ)</li>
                        <li><strong>Magenta</strong> - Negative state (-xᵢ)</li>
                        <li><strong>Intensity</strong> - State magnitude |xᵢ|</li>
                    </ul>
                `,
                dialogPosition: 'center'
            },
            {
                title: 'Phase Diagram',
                description: `
                    <p>The <strong>phase diagram</strong> plots the state of two nodes against each other.</p>
                    <p>Choose different modes:</p>
                    <ul>
                        <li><strong>xᵢ vs xⱼ</strong> - Displacement relationship</li>
                        <li><strong>xᵢ vs ẋⱼ</strong> - Phase portrait</li>
                        <li><strong>Power vs Power</strong> - Energy flow comparison</li>
                        <li><strong>Edge Power</strong> - Power along specific edge</li>
                    </ul>
                `,
                target: '#phase-mode-select'
            },
            {
                title: '🆕 Enhanced Visualization Dashboard',
                description: `
                    <p>Click <strong>"Enhanced View"</strong> for a comprehensive dashboard!</p>
                    <p>Features:</p>
                    <ul>
                        <li>Large phase plot with mode eigenvectors</li>
                        <li>Frequency spectrum visualization</li>
                        <li>Time series for all nodes</li>
                        <li>Energy bar chart</li>
                    </ul>
                `,
                target: '#open-enhanced-viz-btn',
                waitFor: {
                    selector: '#open-enhanced-viz-btn',
                    event: 'click'
                },
                actionHint: 'Click to open Enhanced Visualization'
            },
            {
                title: 'Enhanced Dashboard Controls',
                description: `
                    <p>In the Enhanced Visualization:</p>
                    <ul>
                        <li>Toggle grids, bounds, eigenvector lines</li>
                        <li>Adjust zoom level</li>
                        <li>Select nodes for phase comparison</li>
                        <li>Watch time series of all selected nodes</li>
                    </ul>
                `,
                dialogPosition: 'center'
            },
            {
                title: 'SIMULATE Tour Complete! ✓',
                description: `
                    <p>You've learned to animate and analyze dynamics!</p>
                    <p><strong>Remember:</strong></p>
                    <ul>
                        <li>Rodrigues integrator is exact for skew-symmetric J</li>
                        <li>Power flows along edges between nodes</li>
                        <li>Enhanced View gives deep visualization</li>
                    </ul>
                `,
                dialogPosition: 'center'
            }
        ]
    },
    
    // Tour 5: Eigenmode Animation
    eigenmodeAnimation: {
        id: 'eigenmode-animation',
        name: '🌊 Eigenmode Animation',
        description: 'Visualize characteristic vectors in motion',
        steps: [
            {
                title: 'What are Eigenmodes?',
                description: `
                    <p><strong>Eigenmodes</strong> are natural oscillation patterns of the graph.</p>
                    <p>Each eigenvalue λ has an eigenvector v that describes how nodes move together.</p>
                `,
                dialogPosition: 'center'
            },
            {
                title: 'Select an Eigenvalue',
                description: `
                    <p>Go to the <strong>ANALYZE</strong> tab and click any eigenvalue.</p>
                    <p>The graph will animate showing that eigenmode.</p>
                `,
                target: '[data-tab="analyze"]',
                beforeShow: () => {
                    document.querySelector('[data-tab="analyze"]')?.click();
                }
            },
            {
                title: 'Eigenvalue List',
                description: `
                    <p>Each row shows an eigenvalue with its:</p>
                    <ul>
                        <li>Numerical value</li>
                        <li>Multiplicity (if repeated)</li>
                        <li>Closed-form expression (if known)</li>
                    </ul>
                    <p>Click any row to animate!</p>
                `,
                target: '#eigenvalue-list'
            },
            {
                title: 'Watch the Animation',
                description: `
                    <p>In the 3D view, vertices oscillate according to x(t) = cos(ωt)·v</p>
                    <p>Nodes with same-sign eigenvector components move together.</p>
                `,
                dialogPosition: 'center'
            },
            {
                title: 'Compare Different Modes',
                description: `
                    <p>Try clicking different eigenvalues to see how modes differ:</p>
                    <ul>
                        <li><strong>Low frequency</strong> - Smooth, global motion</li>
                        <li><strong>High frequency</strong> - Rapid, localized motion</li>
                    </ul>
                `,
                dialogPosition: 'center'
            },
            {
                title: 'Eigenmode Tour Complete! ✓',
                description: `
                    <p>You understand eigenmode visualization!</p>
                    <p><strong>Key insight:</strong> Eigenvectors reveal which nodes oscillate together.</p>
                `,
                dialogPosition: 'center'
            }
        ]
    },
    
    // Tour 6: Physics & Realizable Systems
    physicsSystems: {
        id: 'physics-systems',
        name: '⚙️ Realizable Linear Systems',
        description: 'Mass-spring systems and port-Hamiltonian analysis',
        steps: [
            {
                title: 'Realizable Systems',
                description: `
                    <p>A graph is <strong>"realizable"</strong> if it can represent a physical mass-spring network.</p>
                    <p>This requires a bipartite structure with proper interconnections.</p>
                `,
                dialogPosition: 'center'
            },
            {
                title: 'Mass-Spring Templates',
                description: `
                    <p>The BUILD tab has pre-built <strong>realizable templates</strong>:</p>
                    <ul>
                        <li>Mass-Spring Chain</li>
                        <li>Mass-Spring Grid</li>
                        <li>Drum (radial)</li>
                        <li>And more...</li>
                    </ul>
                `,
                target: '#realizable-select',
                beforeShow: () => {
                    document.querySelector('[data-tab="build"]')?.click();
                }
            },
            {
                title: 'Create a Realizable System',
                description: `
                    <p>Select <strong>"Mass-Spring Chain"</strong> and click Create.</p>
                `,
                target: '#realizable-select',
                waitFor: {
                    selector: '#create-graph-btn',
                    event: 'click'
                },
                actionHint: 'Select a template and click Create'
            },
            {
                title: 'p-nodes and q-nodes',
                description: `
                    <p>In a realizable system:</p>
                    <ul>
                        <li><strong>p-nodes (blue)</strong> = Masses (momentum)</li>
                        <li><strong>q-nodes (orange)</strong> = Springs (displacement)</li>
                    </ul>
                    <p>Edges connect masses to springs, never mass-to-mass or spring-to-spring.</p>
                `,
                dialogPosition: 'center'
            },
            {
                title: '🆕 Grounded Springs',
                description: `
                    <p><strong>Grounded springs</strong> connect masses to fixed points (ground).</p>
                    <ul>
                        <li><strong>Teal nodes</strong> = Grounded springs</li>
                        <li>One end fixed, one end connected to mass</li>
                        <li>Essential for boundary conditions</li>
                    </ul>
                    <p>Without grounding, the system has rigid-body modes.</p>
                `,
                dialogPosition: 'center'
            },
            {
                title: 'Physics Audit',
                description: `
                    <p>Go to <strong>SIMULATE → Physics</strong> and click "Audit Realizability".</p>
                    <p>This checks if the graph satisfies physical constraints.</p>
                `,
                target: '[data-tab="simulate"]',
                beforeShow: () => {
                    document.querySelector('[data-tab="simulate"]')?.click();
                }
            },
            {
                title: 'B-Matrix Analysis',
                description: `
                    <p>The <strong>B-matrix</strong> (incidence matrix) shows connections.</p>
                    <p>Each column should have exactly one +1 and one -1 (Newton's 3rd Law).</p>
                    <p>Grounded springs have only one connection (+1 or -1).</p>
                `,
                target: '#physics-section'
            },
            {
                title: '🆕 Pin/Freeze Nodes',
                description: `
                    <p>Use <strong>Pin/Freeze</strong> to lock nodes during simulation:</p>
                    <ul>
                        <li><strong>Pin nodes</strong> - Fix position during force layout</li>
                        <li><strong>Freeze nodes</strong> - Stop dynamics while showing edge power flow</li>
                    </ul>
                    <p>Great for teaching: freeze nodes to see only energy exchange!</p>
                `,
                target: '#freeze-nodes-checkbox'
            },
            {
                title: 'Rectification',
                description: `
                    <p>Non-realizable graphs can be <strong>rectified</strong> automatically.</p>
                    <p>This adjusts the structure to satisfy physical constraints.</p>
                `,
                target: '#rectify-btn'
            },
            {
                title: 'Physics Tour Complete! ✓',
                description: `
                    <p>You understand port-Hamiltonian realizability!</p>
                    <p><strong>Key concepts:</strong></p>
                    <ul>
                        <li>Bipartite partition into p/q nodes</li>
                        <li>Grounded springs for boundary conditions</li>
                        <li>B-matrix encodes interconnections</li>
                        <li>Pin/Freeze for teaching demonstrations</li>
                    </ul>
                `,
                dialogPosition: 'center'
            }
        ]
    },
    
    // Tour 7: Graph Universe
    graphUniverse: {
        id: 'graph-universe',
        name: '🌌 Graph Universe',
        description: 'Explore graphs in 3D spectral space',
        steps: [
            {
                title: 'Welcome to the Graph Universe! 🌌',
                description: `
                    <p>The <strong>Graph Universe</strong> visualizes graphs positioned by their spectral properties in 3D space.</p>
                    <p>In this tour, you'll learn to:</p>
                    <ul>
                        <li>Populate the Universe with graph families</li>
                        <li>Navigate and configure the 3D view</li>
                        <li>Discover spectral clustering patterns</li>
                    </ul>
                `,
                dialogPosition: 'center'
            },
            {
                title: 'Step 1: Generate Test Graphs',
                description: `
                    <p>First, let's populate the Universe with known graph families.</p>
                    <p>Scroll down to find <strong>"🧪 Generate Test Graphs"</strong> in the BUILD tab.</p>
                    <p>This creates Paths, Cycles, Complete graphs, Wheels, and more!</p>
                `,
                target: '#test-universe-btn',
                beforeShow: () => {
                    document.querySelector('[data-tab="build"]')?.click();
                }
            },
            {
                title: 'Configure Test Generation',
                description: `
                    <p>Select which graph families to generate:</p>
                    <ul>
                        <li>Check/uncheck families like Path, Cycle, Complete, Wheel</li>
                        <li>Set the range of n values (e.g., n=4 to n=10)</li>
                    </ul>
                    <p>Click <strong>"🧪 Generate Test Graphs"</strong> to create them.</p>
                `,
                target: '#test-universe-btn',
                waitFor: {
                    selector: '#test-universe-btn',
                    event: 'click'
                },
                actionHint: 'Click Generate Test Graphs'
            },
            {
                title: 'Send Current Graph to Universe',
                description: `
                    <p>You can also send your <strong>current graph</strong> to the Universe.</p>
                    <p>Give it a name and click <strong>"🚀 Send to Universe"</strong>.</p>
                    <p>This adds a single point representing your graph.</p>
                `,
                target: '#send-to-universe-btn'
            },
            {
                title: 'Step 2: Enter Universe View',
                description: `
                    <p>Now let's view the Universe!</p>
                    <p>Go to the <strong>LIBRARY</strong> tab to access the Universe View.</p>
                `,
                target: '[data-tab="library"]',
                beforeShow: () => {
                    document.querySelector('[data-tab="library"]')?.click();
                }
            },
            {
                title: 'Switch to Universe View',
                description: `
                    <p>Click the <strong>🌌 Universe</strong> button to enter the 3D graph space.</p>
                    <p>Each point represents a graph positioned by its spectral properties!</p>
                `,
                target: '#library-view-universe',
                waitFor: {
                    selector: '#library-view-universe',
                    event: 'click'
                },
                actionHint: 'Click the Universe button'
            },
            {
                title: '⚠️ IMPORTANT: How to Exit Universe',
                description: `
                    <p><strong>To return to the normal view:</strong></p>
                    <ol>
                        <li>Stay in the <strong>LIBRARY</strong> tab</li>
                        <li>Click the <strong>📋 Table</strong> button</li>
                    </ol>
                    <p>This switches back to Table View and restores the main graph canvas.</p>
                    <p><em>Note: You must be in Library tab to exit Universe view.</em></p>
                `,
                target: '#library-view-table'
            },
            {
                title: 'Navigation Controls',
                description: `
                    <p>Navigate the 3D Universe:</p>
                    <ul>
                        <li><strong>Drag</strong> - Rotate view</li>
                        <li><strong>Scroll</strong> - Zoom in/out</li>
                        <li><strong>WASD keys</strong> - Pan camera</li>
                        <li><strong>F key</strong> - Fit all graphs in view</li>
                    </ul>
                `,
                dialogPosition: 'center'
            },
            {
                title: 'Configure Axes',
                description: `
                    <p>Each axis can show a different <strong>spectral property</strong>:</p>
                    <ul>
                        <li><strong>Spectral Radius</strong> - Maximum |λ|</li>
                        <li><strong>Energy</strong> - Sum of |λ|</li>
                        <li><strong>Spectral Gap</strong> - λ₁ - λ₂</li>
                        <li><strong>Vertex Count</strong>, <strong>Edge Count</strong>, etc.</li>
                    </ul>
                `,
                target: '#universe-x-axis'
            },
            {
                title: 'Discover Spectral Clustering',
                description: `
                    <p>Try these axis combinations to see patterns:</p>
                    <ul>
                        <li><strong>X: Vertices, Y: Spectral Radius</strong> - See how radius grows with size</li>
                        <li><strong>X: Energy, Y: Spectral Gap</strong> - Compare graph families</li>
                        <li><strong>X: Edges, Y: Energy</strong> - Density vs energy relationship</li>
                    </ul>
                    <p>Notice how different graph families <strong>cluster together</strong>!</p>
                `,
                dialogPosition: 'center'
            },
            {
                title: 'Select and Load Graphs',
                description: `
                    <p><strong>Click</strong> a point to see its details.</p>
                    <p><strong>Double-click</strong> to load it into the editor.</p>
                    <p>This lets you explore any graph from the Universe!</p>
                `,
                dialogPosition: 'center'
            },
            {
                title: 'Log Scale & Filters',
                description: `
                    <p>Additional controls:</p>
                    <ul>
                        <li><strong>Log Scale</strong> - Spreads out clustered data</li>
                        <li><strong>Family Filter</strong> - Show only specific graph types</li>
                        <li><strong>Projection buttons</strong> - Top/Front/Side views</li>
                    </ul>
                `,
                target: '#universe-nav-controls'
            },
            {
                title: 'Exiting Universe View',
                description: `
                    <p>Remember: To exit Universe and return to normal editing:</p>
                    <ol>
                        <li>Go to <strong>LIBRARY</strong> tab</li>
                        <li>Click <strong>📋 Table</strong> button</li>
                    </ol>
                    <p>The main graph canvas will reappear.</p>
                `,
                target: '#library-view-table',
                waitFor: {
                    selector: '#library-view-table',
                    event: 'click'
                },
                actionHint: 'Click Table to exit Universe view'
            },
            {
                title: 'UNIVERSE Tour Complete! ✓',
                description: `
                    <p>You've mastered the Graph Universe!</p>
                    <p><strong>Key takeaways:</strong></p>
                    <ul>
                        <li>Generate test graphs to populate Universe</li>
                        <li>Configure axes to discover spectral patterns</li>
                        <li>Exit via LIBRARY → Table button</li>
                    </ul>
                `,
                dialogPosition: 'center'
            }
        ]
    },
    
    // Tour 8: Analytic Graph Finder
    analyticFinder: {
        id: 'analytic-finder',
        name: '🔍 Analytic Graph Finder',
        description: 'Find graphs with symbolic eigenvalues',
        steps: [
            {
                title: 'The ADVANCED Tab',
                description: `
                    <p>The <strong>ADVANCED</strong> tab contains specialized tools.</p>
                    <p>The Analytic Graph Finder searches for graphs with symbolic eigenvalues.</p>
                `,
                target: '[data-tab="advanced"]',
                beforeShow: () => {
                    document.querySelector('[data-tab="advanced"]')?.click();
                }
            },
            {
                title: 'Search Parameters',
                description: `
                    <p>Specify search criteria:</p>
                    <ul>
                        <li><strong>Target eigenvalue</strong> - e.g., √5, φ (golden ratio)</li>
                        <li><strong>Graph size range</strong></li>
                        <li><strong>Graph families</strong> to include</li>
                    </ul>
                `,
                target: '#finder-section'
            },
            {
                title: 'Run Search',
                description: `
                    <p>Click <strong>"Search"</strong> to find matching graphs.</p>
                    <p>Results show graphs with the specified eigenvalue.</p>
                `,
                target: '#run-finder-btn'
            },
            {
                title: 'Load Results',
                description: `
                    <p>Click any result to load it into the editor.</p>
                    <p>Then explore its properties in the ANALYZE tab.</p>
                `,
                dialogPosition: 'center'
            },
            {
                title: 'Analytic Finder Tour Complete! ✓',
                description: `
                    <p>You can now find graphs with specific spectral properties!</p>
                `,
                dialogPosition: 'center'
            }
        ]
    },
    
    // Tour 9: Library & Saving
    librarySaving: {
        id: 'library-saving',
        name: '📚 Library & Saving',
        description: 'Save, load, and manage your graphs',
        steps: [
            {
                title: 'The LIBRARY Tab',
                description: `
                    <p>The <strong>LIBRARY</strong> tab stores your saved graphs.</p>
                    <p>Graphs persist in your browser's local storage.</p>
                `,
                target: '[data-tab="library"]',
                beforeShow: () => {
                    document.querySelector('[data-tab="library"]')?.click();
                }
            },
            {
                title: 'Save Current Graph',
                description: `
                    <p>Click <strong>"Save to Library"</strong> to store your current graph.</p>
                    <p>Give it a descriptive name for easy identification.</p>
                `,
                target: '#save-to-library-btn'
            },
            {
                title: 'Browse Saved Graphs',
                description: `
                    <p>Your saved graphs appear in the table.</p>
                    <p>See name, size, type, and when it was saved.</p>
                `,
                target: '#library-table'
            },
            {
                title: 'Load a Graph',
                description: `
                    <p>Select a graph and click <strong>"Load"</strong> to restore it.</p>
                    <p>This replaces the current graph in the editor.</p>
                `,
                target: '#library-load-btn'
            },
            {
                title: 'Delete Graphs',
                description: `
                    <p>Select graphs and click <strong>"Delete"</strong> to remove them.</p>
                    <p>This action cannot be undone!</p>
                `,
                target: '#library-delete-btn'
            },
            {
                title: 'Keyboard Shortcuts',
                description: `
                    <p>Useful shortcuts throughout the app:</p>
                    <ul>
                        <li><strong>F</strong> - Fit graph to view</li>
                        <li><strong>Esc</strong> - Deselect / stop animation</li>
                        <li><strong>Space</strong> - Start/stop dynamics</li>
                    </ul>
                `,
                dialogPosition: 'center'
            },
            {
                title: 'LIBRARY Tour Complete! ✓',
                description: `
                    <p>You know how to save and manage your work!</p>
                    <p><strong>Tip:</strong> Save interesting graphs before trying modifications.</p>
                `,
                dialogPosition: 'center'
            }
        ]
    },
    
    // Tour 10: Mechanisms (Planar Links)
    mechanisms: {
        id: 'mechanisms',
        name: '🔗 Planar Links & Mechanisms',
        description: 'N-bar mechanisms and linkage systems',
        steps: [
            {
                title: 'Planar Linkages',
                description: `
                    <p>The tool can model <strong>planar linkage mechanisms</strong>.</p>
                    <p>These are systems of rigid bars connected by revolute joints.</p>
                `,
                dialogPosition: 'center'
            },
            {
                title: 'N-Bar Mechanisms',
                description: `
                    <p>Common mechanisms:</p>
                    <ul>
                        <li><strong>4-bar</strong> - Classic coupler curves</li>
                        <li><strong>6-bar</strong> - Watt and Stephenson types</li>
                        <li><strong>Slider-crank</strong> - Converts rotation to translation</li>
                    </ul>
                `,
                dialogPosition: 'center'
            },
            {
                title: 'Create a Mechanism',
                description: `
                    <p>Use the BUILD tab templates or manually construct linkages.</p>
                    <p>The graph structure encodes the kinematic chain.</p>
                `,
                target: '[data-tab="build"]',
                beforeShow: () => {
                    document.querySelector('[data-tab="build"]')?.click();
                }
            },
            {
                title: "Grübler's Formula",
                description: `
                    <p>Degrees of freedom: DOF = 3(n-1) - 2j</p>
                    <p>Where n = links and j = joints.</p>
                    <p>DOF = 1 means the mechanism has one input motion.</p>
                `,
                dialogPosition: 'center'
            },
            {
                title: 'Mechanisms Tour Complete! ✓',
                description: `
                    <p>You've learned about planar linkage modeling!</p>
                `,
                dialogPosition: 'center'
            }
        ]
    },
    
    // Tour 11: Bounds & Zeid-Rosenberg Analysis
    boundsAnalysis: {
        id: 'bounds-analysis',
        name: '📐 Bounds & Zeid-Rosenberg',
        description: 'Eigenvalue bounds and spectral estimation',
        steps: [
            {
                title: 'The BOUNDS Tab',
                description: `
                    <p>The <strong>BOUNDS</strong> tab provides eigenvalue estimation tools.</p>
                    <p>Get bounds on spectral properties without full eigenvalue computation.</p>
                `,
                target: '[data-tab="bounds"]',
                beforeShow: () => {
                    document.querySelector('[data-tab="bounds"]')?.click();
                }
            },
            {
                title: 'Zeid-Rosenberg Method',
                description: `
                    <p>The <strong>Zeid-Rosenberg</strong> algorithm provides tight bounds on eigenvalues.</p>
                    <p>It uses matrix structure to estimate spectral radius and spread.</p>
                `,
                target: '#zr-bounds-section'
            },
            {
                title: 'Spectral Radius Bounds',
                description: `
                    <p>The <strong>spectral radius</strong> ρ(A) = max|λ| bounds the maximum eigenvalue magnitude.</p>
                    <p>Upper/lower bounds help verify numerical results.</p>
                `,
                target: '#spectral-radius-bounds'
            },
            {
                title: 'Energy Bounds',
                description: `
                    <p><strong>Graph energy</strong> E(G) = Σ|λᵢ| can be bounded using:</p>
                    <ul>
                        <li>Degree sequence</li>
                        <li>Edge count</li>
                        <li>Triangle count</li>
                    </ul>
                `,
                target: '#energy-bounds'
            },
            {
                title: 'Spectral Gap',
                description: `
                    <p>The <strong>spectral gap</strong> λ₁ - λ₂ measures graph connectivity.</p>
                    <p>Larger gaps indicate better expansion properties.</p>
                `,
                target: '#spectral-gap-display'
            },
            {
                title: 'Compare with Exact Values',
                description: `
                    <p>Use bounds to validate exact eigenvalue computations.</p>
                    <p>If exact values fall outside bounds, there may be numerical errors.</p>
                `,
                dialogPosition: 'center'
            },
            {
                title: 'BOUNDS Tour Complete! ✓',
                description: `
                    <p>You understand eigenvalue bounds estimation!</p>
                    <p><strong>Key uses:</strong></p>
                    <ul>
                        <li>Quick spectral property estimation</li>
                        <li>Validation of numerical results</li>
                        <li>Theoretical analysis</li>
                    </ul>
                `,
                dialogPosition: 'center'
            }
        ]
    },
    
    // Tour 12: Keyboard Shortcuts
    keyboardShortcuts: {
        id: 'keyboard-shortcuts',
        name: '⌨️ Keyboard Shortcuts',
        description: 'Speed up your workflow with hotkeys',
        steps: [
            {
                title: 'Keyboard Shortcuts',
                description: `
                    <p>Master these shortcuts to work faster with the Eigenvalue Explorer.</p>
                    <p>Most shortcuts work from any tab.</p>
                `,
                dialogPosition: 'center'
            },
            {
                title: 'View Controls',
                description: `
                    <p><strong>Camera & View:</strong></p>
                    <ul>
                        <li><code>F</code> - Fit graph to view</li>
                        <li><code>R</code> - Reset camera</li>
                        <li><code>1/2/3</code> - XY/XZ/YZ projection</li>
                        <li><code>Mouse drag</code> - Rotate view</li>
                        <li><code>Scroll</code> - Zoom in/out</li>
                    </ul>
                `,
                dialogPosition: 'center'
            },
            {
                title: 'Editing Shortcuts',
                description: `
                    <p><strong>Graph Editing:</strong></p>
                    <ul>
                        <li><code>Delete/Backspace</code> - Delete selected</li>
                        <li><code>Esc</code> - Deselect all</li>
                        <li><code>Ctrl+A</code> - Select all vertices</li>
                        <li><code>E</code> - Expand selection</li>
                        <li><code>C</code> - Collapse selection</li>
                    </ul>
                `,
                dialogPosition: 'center'
            },
            {
                title: 'Simulation Shortcuts',
                description: `
                    <p><strong>Dynamics & Animation:</strong></p>
                    <ul>
                        <li><code>Space</code> - Start/Stop dynamics</li>
                        <li><code>Esc</code> - Stop eigenmode animation</li>
                        <li><code>+/-</code> - Adjust simulation speed</li>
                    </ul>
                `,
                dialogPosition: 'center'
            },
            {
                title: 'Force Layout Shortcuts',
                description: `
                    <p><strong>Layout:</strong></p>
                    <ul>
                        <li><code>L</code> - Toggle force layout</li>
                        <li><code>G</code> - Arrange on grid</li>
                        <li><code>O</code> - Arrange on circle</li>
                    </ul>
                `,
                dialogPosition: 'center'
            },
            {
                title: 'Quick Tips',
                description: `
                    <p><strong>Pro Tips:</strong></p>
                    <ul>
                        <li>Hold <code>Shift</code> while clicking to multi-select</li>
                        <li>Hold <code>Ctrl</code> while dragging for constrained movement</li>
                        <li>Double-click eigenvalue for instant animation</li>
                    </ul>
                `,
                dialogPosition: 'center'
            },
            {
                title: 'Shortcuts Tour Complete! ✓',
                description: `
                    <p>You're now a power user! 🚀</p>
                    <p>Practice these shortcuts to speed up your workflow.</p>
                `,
                dialogPosition: 'center'
            }
        ]
    }
};

// =====================================================
// TUTORIAL MENU COMPONENT
// =====================================================

export function createTutorialMenu(tutorialEngine) {
    const menu = document.createElement('div');
    menu.className = 'tutorial-menu';
    menu.innerHTML = `
        <div class="tutorial-menu-header">
            <span>📚 Tutorials</span>
            <button class="tutorial-menu-close">×</button>
        </div>
        <div class="tutorial-menu-content">
            <div class="tutorial-menu-section">
                <div class="tutorial-menu-section-title">Getting Started</div>
                <div class="tutorial-menu-item" data-tour="buildGraphs">
                    <span class="tutorial-menu-icon">🏗️</span>
                    <div class="tutorial-menu-info">
                        <div class="tutorial-menu-name">Building Graphs</div>
                        <div class="tutorial-menu-desc">Create, customize, and combine graphs</div>
                    </div>
                    <span class="tutorial-menu-status"></span>
                </div>
                <div class="tutorial-menu-item" data-tour="editGraphs">
                    <span class="tutorial-menu-icon">✏️</span>
                    <div class="tutorial-menu-info">
                        <div class="tutorial-menu-name">Editing Graphs</div>
                        <div class="tutorial-menu-desc">Drag, view, project, distribute</div>
                    </div>
                    <span class="tutorial-menu-status"></span>
                </div>
            </div>
            <div class="tutorial-menu-section">
                <div class="tutorial-menu-section-title">Analysis</div>
                <div class="tutorial-menu-item" data-tour="spectralAnalysis">
                    <span class="tutorial-menu-icon">📊</span>
                    <div class="tutorial-menu-info">
                        <div class="tutorial-menu-name">Spectral Analysis</div>
                        <div class="tutorial-menu-desc">Skew-symmetric matrix, polynomial, eigenvalues</div>
                    </div>
                    <span class="tutorial-menu-status"></span>
                </div>
                <div class="tutorial-menu-item" data-tour="eigenmodeAnimation">
                    <span class="tutorial-menu-icon">🌊</span>
                    <div class="tutorial-menu-info">
                        <div class="tutorial-menu-name">Eigenmode Animation</div>
                        <div class="tutorial-menu-desc">Animate characteristic vectors</div>
                    </div>
                    <span class="tutorial-menu-status"></span>
                </div>
                <div class="tutorial-menu-item" data-tour="boundsAnalysis">
                    <span class="tutorial-menu-icon">📐</span>
                    <div class="tutorial-menu-info">
                        <div class="tutorial-menu-name">Bounds & Zeid-Rosenberg</div>
                        <div class="tutorial-menu-desc">Eigenvalue bounds estimation</div>
                    </div>
                    <span class="tutorial-menu-status"></span>
                </div>
            </div>
            <div class="tutorial-menu-section">
                <div class="tutorial-menu-section-title">Simulation</div>
                <div class="tutorial-menu-item" data-tour="dynamicsSimulation">
                    <span class="tutorial-menu-icon">🎬</span>
                    <div class="tutorial-menu-info">
                        <div class="tutorial-menu-name">Dynamics & Power Flow</div>
                        <div class="tutorial-menu-desc">Animate nodes, integrators, enhanced viz</div>
                    </div>
                    <span class="tutorial-menu-status"></span>
                </div>
                <div class="tutorial-menu-item" data-tour="physicsSystems">
                    <span class="tutorial-menu-icon">⚙️</span>
                    <div class="tutorial-menu-info">
                        <div class="tutorial-menu-name">Realizable Linear Systems</div>
                        <div class="tutorial-menu-desc">Mass-spring, grounded springs, pin/freeze</div>
                    </div>
                    <span class="tutorial-menu-status"></span>
                </div>
            </div>
            <div class="tutorial-menu-section">
                <div class="tutorial-menu-section-title">Advanced</div>
                <div class="tutorial-menu-item" data-tour="graphUniverse">
                    <span class="tutorial-menu-icon">🌌</span>
                    <div class="tutorial-menu-info">
                        <div class="tutorial-menu-name">Graph Universe</div>
                        <div class="tutorial-menu-desc">3D spectral space, spectral radius, spread</div>
                    </div>
                    <span class="tutorial-menu-status"></span>
                </div>
                <div class="tutorial-menu-item" data-tour="analyticFinder">
                    <span class="tutorial-menu-icon">🔍</span>
                    <div class="tutorial-menu-info">
                        <div class="tutorial-menu-name">Analytic Graph Finder</div>
                        <div class="tutorial-menu-desc">Find graphs with symbolic eigenvalues</div>
                    </div>
                    <span class="tutorial-menu-status"></span>
                </div>
                <div class="tutorial-menu-item" data-tour="mechanisms">
                    <span class="tutorial-menu-icon">🔗</span>
                    <div class="tutorial-menu-info">
                        <div class="tutorial-menu-name">Planar Links & Mechanisms</div>
                        <div class="tutorial-menu-desc">N-bar linkage systems</div>
                    </div>
                    <span class="tutorial-menu-status"></span>
                </div>
            </div>
            <div class="tutorial-menu-section">
                <div class="tutorial-menu-section-title">Utilities</div>
                <div class="tutorial-menu-item" data-tour="librarySaving">
                    <span class="tutorial-menu-icon">📚</span>
                    <div class="tutorial-menu-info">
                        <div class="tutorial-menu-name">Library & Saving</div>
                        <div class="tutorial-menu-desc">Save, load, and manage graphs</div>
                    </div>
                    <span class="tutorial-menu-status"></span>
                </div>
                <div class="tutorial-menu-item" data-tour="keyboardShortcuts">
                    <span class="tutorial-menu-icon">⌨️</span>
                    <div class="tutorial-menu-info">
                        <div class="tutorial-menu-name">Keyboard Shortcuts</div>
                        <div class="tutorial-menu-desc">Speed up your workflow</div>
                    </div>
                    <span class="tutorial-menu-status"></span>
                </div>
            </div>
            <div class="tutorial-menu-footer">
                <button class="tutorial-btn tutorial-btn-reset">Reset Progress</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(menu);
    
    // Update completion status
    function updateStatus() {
        menu.querySelectorAll('.tutorial-menu-item').forEach(item => {
            const tourId = item.dataset.tour;
            const tour = TOURS[tourId];
            if (tour && tutorialEngine.isTourCompleted(tour.id)) {
                item.querySelector('.tutorial-menu-status').textContent = '✓';
                item.classList.add('completed');
            } else {
                item.querySelector('.tutorial-menu-status').textContent = '';
                item.classList.remove('completed');
            }
        });
    }
    
    updateStatus();
    
    // Event handlers
    menu.querySelector('.tutorial-menu-close').addEventListener('click', () => {
        menu.classList.remove('active');
    });
    
    menu.querySelectorAll('.tutorial-menu-item').forEach(item => {
        item.addEventListener('click', () => {
            const tourId = item.dataset.tour;
            const tour = TOURS[tourId];
            if (tour) {
                menu.classList.remove('active');
                tutorialEngine.startTour(tour);
            }
        });
    });
    
    menu.querySelector('.tutorial-btn-reset').addEventListener('click', () => {
        if (confirm('Reset all tutorial progress?')) {
            tutorialEngine.resetProgress();
            updateStatus();
        }
    });
    
    return {
        element: menu,
        show: () => {
            updateStatus();
            menu.classList.add('active');
        },
        hide: () => menu.classList.remove('active'),
        toggle: () => {
            updateStatus();
            menu.classList.toggle('active');
        }
    };
}

// =====================================================
// INITIALIZATION
// =====================================================

let tutorialEngineInstance = null;
let tutorialMenuInstance = null;

export function initTutorialSystem() {
    // Create engine
    tutorialEngineInstance = new TutorialEngine();
    
    // Create menu
    tutorialMenuInstance = createTutorialMenu(tutorialEngineInstance);
    
    // Create help button with inline styles as fallback
    const helpBtn = document.createElement('button');
    helpBtn.className = 'tutorial-help-btn';
    helpBtn.innerHTML = '?';
    helpBtn.title = 'Tutorials & Help';
    // Add inline styles as fallback in case CSS doesn't load
    helpBtn.style.cssText = `
        position: fixed;
        bottom: 20px;
        right: 20px;
        width: 48px;
        height: 48px;
        border-radius: 50%;
        background: linear-gradient(135deg, #4a9eff 0%, #00d4aa 100%);
        border: none;
        color: #fff;
        font-size: 24px;
        font-weight: bold;
        cursor: pointer;
        z-index: 9999;
        box-shadow: 0 4px 15px rgba(74, 158, 255, 0.4), 0 0 20px rgba(74, 158, 255, 0.2);
        transition: all 0.3s ease;
    `;
    helpBtn.addEventListener('click', () => tutorialMenuInstance.toggle());
    helpBtn.addEventListener('mouseenter', () => {
        helpBtn.style.transform = 'scale(1.1)';
    });
    helpBtn.addEventListener('mouseleave', () => {
        helpBtn.style.transform = 'scale(1)';
    });
    document.body.appendChild(helpBtn);
    
    console.log('[Tutorial] System initialized, help button added to DOM');
    
    return {
        engine: tutorialEngineInstance,
        menu: tutorialMenuInstance,
        startTour: (tourId) => {
            const tour = TOURS[tourId];
            if (tour) {
                tutorialEngineInstance.startTour(tour);
            }
        }
    };
}

export function getTutorialEngine() {
    return tutorialEngineInstance;
}

export function getTutorialMenu() {
    return tutorialMenuInstance;
}
