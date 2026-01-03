/**
 * Graph Core Module
 * Three.js setup, rendering, force layout, vertex/edge management, layouts
 */

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// =====================================================
// EXPORTS - State and functions accessible to other modules
// =====================================================

export const state = {
    vertexMeshes: [],
    vertexLabels: [],
    edgeObjects: [],
    adjacencyMatrix: [],
    symmetricAdjMatrix: [],
    graphGroup: null,
    selectedVertex: null,
    hoveredVertex: null,
    forceSimulationRunning: false,
    velocities: [],
    // Face rendering (v21)
    faceMeshes: [],
    facesVisible: false,
    faceOpacity: 0.7  // Default 70% opacity for better visibility
};

export let scene, camera, renderer, controls, raycaster, mouse;

// =====================================================
// CONSTANTS
// =====================================================

export const VERTEX_RADIUS = 2.0;

// Softer, more appealing color palette for vertices
const defaultVertexMaterial = new THREE.MeshStandardMaterial({ 
    color: 0x5dade2,      // Soft sky blue
    emissive: 0x1a5276,   // Deep blue glow
    metalness: 0.35,
    roughness: 0.35
});

const hoverVertexMaterial = new THREE.MeshStandardMaterial({ 
    color: 0xf7dc6f,      // Soft gold/yellow
    emissive: 0x7d6608,   // Warm glow
    metalness: 0.35,
    roughness: 0.35
});

const selectedVertexMaterial = new THREE.MeshStandardMaterial({ 
    color: 0x58d68d,      // Soft mint green
    emissive: 0x1e8449,   // Deep green glow
    metalness: 0.35,
    roughness: 0.35
});

// Force-directed layout parameters
const REPULSION_STRENGTH = 2000;  // Stronger repulsion to spread nodes
const ATTRACTION_STRENGTH = 0.08;  // Moderate attraction
const DAMPING = 0.90;  // Less damping for faster convergence
const MIN_DISTANCE = 5;
const IDEAL_EDGE_LENGTH = 40;  // Larger for tree structures

// =====================================================
// 3D ARROW CREATION
// =====================================================

export function interpolateYellowBlue(t, intensity = 1.0) {
    const absT = Math.abs(t);
    const smoothT = Math.pow(absT, 0.7);
    
    let r, g, b;
    if (t >= 0) {
        r = 1.0;
        g = 0.7 - smoothT * 0.35;
        b = 0.1 * (1 - smoothT);
    } else {
        r = 0.1 * (1 - smoothT);
        g = 0.45 + smoothT * 0.3;
        b = 0.75 + smoothT * 0.3;
    }
    
    const boost = 0.5 + intensity * 0.7;
    r *= boost;
    g *= boost;
    b *= boost;
    
    return new THREE.Color(
        Math.min(1, r),
        Math.min(1, g),
        Math.min(1, b)
    );
}

// Power flow color palette
// Net gain: Cyan/Teal #4FD1C5 (0.31, 0.82, 0.77)
// Net loss: Coral #F87171 (0.97, 0.44, 0.44)
// Neutral: Gray-blue #94A3B8 (0.58, 0.64, 0.72)
const POWER_COLORS = {
    gain: new THREE.Color(0x4FD1C5),    // Cyan/teal - absorbing energy
    loss: new THREE.Color(0xF87171),    // Coral/ember - bleeding energy
    neutral: new THREE.Color(0x94A3B8)  // Desaturated gray-blue - balanced
};

export function interpolatePowerColor(normalizedPower) {
    // normalizedPower: -1 (full loss) to +1 (full gain), 0 = neutral
    const absP = Math.min(Math.abs(normalizedPower), 1.0);
    // Smooth step for better visual transition
    const smoothP = absP * absP * (3 - 2 * absP);
    
    const result = new THREE.Color();
    
    if (absP < 0.05) {
        // Near neutral - use gray-blue
        result.copy(POWER_COLORS.neutral);
    } else if (normalizedPower > 0) {
        // Gaining energy - interpolate neutral → cyan
        result.lerpColors(POWER_COLORS.neutral, POWER_COLORS.gain, smoothP);
    } else {
        // Losing energy - interpolate neutral → coral
        result.lerpColors(POWER_COLORS.neutral, POWER_COLORS.loss, smoothP);
    }
    
    return result;
}

// Legacy function name for compatibility
export function interpolateRedGreen(t, intensity = 1.0) {
    return interpolatePowerColor(t);
}

export function create3DArrow(direction, origin, length, color, headLength, headRadius) {
    const group = new THREE.Group();
    
    headLength = headLength || Math.min(length * 0.35, 5);
    headRadius = headRadius || Math.min(length * 0.18, 2.5);
    const shaftLength = Math.max(0.1, length - headLength);
    const shaftRadius = headRadius * 0.35;
    
    // Enhanced shaft with gradient-like taper and more segments
    const shaftGeom = new THREE.CylinderGeometry(shaftRadius * 0.7, shaftRadius, shaftLength, 16);
    const shaftMat = new THREE.MeshStandardMaterial({
        color: color,
        emissive: color.clone().multiplyScalar(0.4),
        metalness: 0.5,
        roughness: 0.2
    });
    const shaft = new THREE.Mesh(shaftGeom, shaftMat);
    shaft.position.y = shaftLength / 2;
    group.add(shaft);
    
    // Collar ring at base of arrow head for 3D depth effect
    const collarGeom = new THREE.TorusGeometry(headRadius * 0.7, shaftRadius * 0.5, 8, 16);
    const collarMat = new THREE.MeshStandardMaterial({
        color: color,
        emissive: color.clone().multiplyScalar(0.5),
        metalness: 0.6,
        roughness: 0.15
    });
    const collar = new THREE.Mesh(collarGeom, collarMat);
    collar.rotation.x = Math.PI / 2;
    collar.position.y = shaftLength;
    group.add(collar);
    
    // Enhanced arrow head with more segments for smoother look
    const headGeom = new THREE.ConeGeometry(headRadius, headLength, 24);
    const headMat = new THREE.MeshStandardMaterial({
        color: color,
        emissive: color.clone().multiplyScalar(0.55),
        metalness: 0.55,
        roughness: 0.1
    });
    const head = new THREE.Mesh(headGeom, headMat);
    head.position.y = shaftLength + headLength / 2;
    group.add(head);
    
    group.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.clone().normalize());
    group.position.copy(origin);
    
    group.userData.shaft = shaft;
    group.userData.head = head;
    group.userData.collar = collar;
    group.userData.shaftMat = shaftMat;
    group.userData.headMat = headMat;
    group.userData.collarMat = collarMat;
    
    return group;
}

export function update3DArrowColor(arrowGroup, color) {
    if (arrowGroup.userData.shaftMat) {
        arrowGroup.userData.shaftMat.color.copy(color);
        arrowGroup.userData.shaftMat.emissive.copy(color).multiplyScalar(0.4);
    }
    if (arrowGroup.userData.headMat) {
        arrowGroup.userData.headMat.color.copy(color);
        arrowGroup.userData.headMat.emissive.copy(color).multiplyScalar(0.55);
    }
    if (arrowGroup.userData.collarMat) {
        arrowGroup.userData.collarMat.color.copy(color);
        arrowGroup.userData.collarMat.emissive.copy(color).multiplyScalar(0.5);
    }
}

export function update3DArrowGeometry(arrowGroup, direction, origin, length, headLength, headRadius) {
    headLength = headLength || Math.min(length * 0.3, 4);
    headRadius = headRadius || Math.min(length * 0.125, 2);
    const shaftLength = Math.max(0.1, length - headLength);
    const shaftRadius = headRadius * 0.3;
    
    const shaft = arrowGroup.userData.shaft;
    const head = arrowGroup.userData.head;
    const collar = arrowGroup.userData.collar;
    
    if (shaft && head) {
        shaft.geometry.dispose();
        shaft.geometry = new THREE.CylinderGeometry(shaftRadius * 0.7, shaftRadius, shaftLength, 16);
        shaft.position.y = shaftLength / 2;
        
        head.geometry.dispose();
        head.geometry = new THREE.ConeGeometry(headRadius, headLength, 24);
        head.position.y = shaftLength + headLength / 2;
        
        if (collar) {
            collar.geometry.dispose();
            collar.geometry = new THREE.TorusGeometry(headRadius * 0.7, shaftRadius * 0.5, 8, 16);
            collar.position.y = shaftLength;
        }
    }
    
    arrowGroup.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.clone().normalize());
    arrowGroup.position.copy(origin);
}

// Arrow3D class - provides ArrowHelper-compatible interface with 3D geometry
export class Arrow3D extends THREE.Group {
    constructor(direction, origin, length, color, headLength, headRadius) {
        super();
        
        this._direction = direction.clone().normalize();
        this._length = length;
        this._headLength = headLength || Math.min(length * 0.35, 5);
        this._headRadius = headRadius || Math.min(length * 0.18, 2.5);
        
        this._buildArrow(color);
        this._updateOrientation();
        this.position.copy(origin);
    }
    
    _buildArrow(color) {
        const colorObj = (color instanceof THREE.Color) ? color : new THREE.Color(color);
        
        const shaftLength = Math.max(0.1, this._length - this._headLength);
        const shaftRadius = this._headRadius * 0.35;
        
        // Glow cylinder (larger, transparent, for "breathing" effect)
        const glowGeom = new THREE.CylinderGeometry(shaftRadius * 2.5, shaftRadius * 2.5, shaftLength * 0.9, 12);
        this._glowMat = new THREE.MeshBasicMaterial({
            color: colorObj,
            transparent: true,
            opacity: 0,
            depthWrite: false
        });
        this._glow = new THREE.Mesh(glowGeom, this._glowMat);
        this._glow.position.y = shaftLength / 2;
        this.add(this._glow);
        
        // Shaft with taper
        const shaftGeom = new THREE.CylinderGeometry(shaftRadius * 0.7, shaftRadius, shaftLength, 16);
        this._shaftMat = new THREE.MeshStandardMaterial({
            color: colorObj,
            emissive: colorObj.clone().multiplyScalar(0.4),
            metalness: 0.5,
            roughness: 0.2
        });
        this._shaft = new THREE.Mesh(shaftGeom, this._shaftMat);
        this._shaft.position.y = shaftLength / 2;
        this.add(this._shaft);
        
        // Collar ring
        const collarGeom = new THREE.TorusGeometry(this._headRadius * 0.7, shaftRadius * 0.5, 8, 16);
        this._collarMat = new THREE.MeshStandardMaterial({
            color: colorObj,
            emissive: colorObj.clone().multiplyScalar(0.5),
            metalness: 0.6,
            roughness: 0.15
        });
        this._collar = new THREE.Mesh(collarGeom, this._collarMat);
        this._collar.rotation.x = Math.PI / 2;
        this._collar.position.y = shaftLength;
        this.add(this._collar);
        
        // Arrow head
        const headGeom = new THREE.ConeGeometry(this._headRadius, this._headLength, 24);
        this._headMat = new THREE.MeshStandardMaterial({
            color: colorObj,
            emissive: colorObj.clone().multiplyScalar(0.55),
            metalness: 0.55,
            roughness: 0.1
        });
        this._head = new THREE.Mesh(headGeom, this._headMat);
        this._head.position.y = shaftLength + this._headLength / 2;
        this.add(this._head);
        
        // Store references for updates
        this.userData.shaft = this._shaft;
        this.userData.head = this._head;
        this.userData.collar = this._collar;
        this.userData.glow = this._glow;
        this.userData.shaftMat = this._shaftMat;
        this.userData.headMat = this._headMat;
        this.userData.collarMat = this._collarMat;
        this.userData.glowMat = this._glowMat;
    }
    
    _updateOrientation() {
        this.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), this._direction);
    }
    
    setColor(color) {
        const colorObj = (color instanceof THREE.Color) ? color : new THREE.Color(color);
        
        this._shaftMat.color.copy(colorObj);
        this._shaftMat.emissive.copy(colorObj).multiplyScalar(0.4);
        
        this._collarMat.color.copy(colorObj);
        this._collarMat.emissive.copy(colorObj).multiplyScalar(0.5);
        
        this._headMat.color.copy(colorObj);
        this._headMat.emissive.copy(colorObj).multiplyScalar(0.55);
        
        this._glowMat.color.copy(colorObj);
    }
    
    // Set glow intensity (0-1) - makes arrow "breathe"
    setGlow(intensity) {
        if (this._glowMat) {
            this._glowMat.opacity = Math.min(intensity * 0.35, 0.3);
        }
    }
    
    setDirection(direction) {
        this._direction = direction.clone().normalize();
        this._updateOrientation();
    }
    
    setLength(length, headLength, headRadius) {
        this._length = length;
        this._headLength = headLength || Math.min(length * 0.35, 5);
        this._headRadius = headRadius || Math.min(length * 0.18, 2.5);
        
        const shaftLength = Math.max(0.1, length - this._headLength);
        const shaftRadius = this._headRadius * 0.35;
        
        // Update glow
        this._glow.geometry.dispose();
        this._glow.geometry = new THREE.CylinderGeometry(shaftRadius * 2.5, shaftRadius * 2.5, shaftLength * 0.9, 12);
        this._glow.position.y = shaftLength / 2;
        
        // Update shaft
        this._shaft.geometry.dispose();
        this._shaft.geometry = new THREE.CylinderGeometry(shaftRadius * 0.7, shaftRadius, shaftLength, 16);
        this._shaft.position.y = shaftLength / 2;
        
        // Update collar
        this._collar.geometry.dispose();
        this._collar.geometry = new THREE.TorusGeometry(this._headRadius * 0.7, shaftRadius * 0.5, 8, 16);
        this._collar.position.y = shaftLength;
        
        // Update head
        this._head.geometry.dispose();
        this._head.geometry = new THREE.ConeGeometry(this._headRadius, this._headLength, 24);
        this._head.position.y = shaftLength + this._headLength / 2;
    }
    
    dispose() {
        this._glow.geometry.dispose();
        this._glowMat.dispose();
        this._shaft.geometry.dispose();
        this._shaftMat.dispose();
        this._collar.geometry.dispose();
        this._collarMat.dispose();
        this._head.geometry.dispose();
        this._headMat.dispose();
    }
}

// =====================================================
// SCENE INITIALIZATION
// =====================================================

// Background color presets
const BACKGROUND_PRESETS = {
    dark: 0x0d1117,      // Original dark blue-black
    gray: 0x404040,      // Medium gray
    light: 0x808080,     // Light gray
    white: 0xcccccc,     // Near white
    black: 0x000000      // Pure black
};

let currentBackground = 'dark';

export function setBackgroundColor(preset) {
    if (!scene) return;
    
    if (typeof preset === 'string' && BACKGROUND_PRESETS[preset]) {
        currentBackground = preset;
        scene.background = new THREE.Color(BACKGROUND_PRESETS[preset]);
    } else if (typeof preset === 'number') {
        scene.background = new THREE.Color(preset);
    }
    console.log('Background set to:', preset);
}

export function getBackgroundPreset() {
    return currentBackground;
}

export function initScene(container) {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(BACKGROUND_PRESETS.dark);
    
    camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(0, 30, 80);
    
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    container.appendChild(renderer.domElement);
    
    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.rotateSpeed = 0.8;
    controls.zoomSpeed = 1.2;
    controls.panSpeed = 0.8;
    controls.enabled = true;
    
    // Enhanced lighting for better color rendering
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.45);
    scene.add(ambientLight);
    
    const keyLight = new THREE.DirectionalLight(0xfff5e6, 0.85);  // Warm key light
    keyLight.position.set(50, 80, 50);
    scene.add(keyLight);
    
    const fillLight = new THREE.DirectionalLight(0x88ccff, 0.4);  // Cool fill
    fillLight.position.set(-50, 40, -30);
    scene.add(fillLight);
    
    const backLight = new THREE.DirectionalLight(0xffbb99, 0.35);  // Warm rim
    backLight.position.set(0, -50, -50);
    scene.add(backLight);
    
    // Raycaster for mouse interaction
    raycaster = new THREE.Raycaster();
    mouse = new THREE.Vector2();
    
    // Graph group
    state.graphGroup = new THREE.Group();
    scene.add(state.graphGroup);
    
    // Window resize handler
    window.addEventListener('resize', () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    });
    
    return { scene, camera, renderer, controls };
}

// =====================================================
// VERTEX MANAGEMENT
// =====================================================

export function createVertex(position, index) {
    const geometry = new THREE.SphereGeometry(VERTEX_RADIUS, 32, 32);
    const mesh = new THREE.Mesh(geometry, defaultVertexMaterial.clone());
    mesh.position.copy(position);
    mesh.userData.index = index;
    
    // Create power ring (outer glow ring that shows |P_i|)
    const ringGeometry = new THREE.RingGeometry(VERTEX_RADIUS * 1.15, VERTEX_RADIUS * 1.35, 32);
    const ringMaterial = new THREE.MeshBasicMaterial({
        color: 0x4FD1C5,
        transparent: true,
        opacity: 0,
        side: THREE.DoubleSide
    });
    const ring = new THREE.Mesh(ringGeometry, ringMaterial);
    ring.rotation.x = Math.PI / 2; // Make ring horizontal initially
    mesh.add(ring); // Parent to vertex so it moves with it
    mesh.userData.powerRing = ring;
    
    state.graphGroup.add(mesh);
    state.vertexMeshes.push(mesh);
    
    // Create label
    const label = createVertexLabel(index.toString(), position);
    state.vertexLabels.push(label);
    
    return mesh;
}

// Update power ring visibility and color
export function updateVertexPowerRing(mesh, normalizedPower, color) {
    const ring = mesh.userData.powerRing;
    if (!ring) return;
    
    const absP = Math.abs(normalizedPower);
    
    // Ring opacity proportional to |P_i|, disappears near zero
    ring.material.opacity = absP > 0.05 ? Math.min(absP * 0.8, 0.7) : 0;
    ring.material.color.copy(color);
    
    // Make ring face camera (billboard effect)
    if (camera) {
        ring.quaternion.copy(camera.quaternion);
    }
}

function createVertexLabel(text, position) {
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    canvas.width = 64;
    canvas.height = 64;
    
    context.fillStyle = 'rgba(0, 0, 0, 0)';
    context.fillRect(0, 0, 64, 64);
    
    context.font = 'bold 40px Arial';
    context.fillStyle = '#ffffff';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText(text, 32, 32);
    
    const texture = new THREE.CanvasTexture(canvas);
    const material = new THREE.SpriteMaterial({ map: texture, transparent: true });
    const sprite = new THREE.Sprite(material);
    
    sprite.position.copy(position);
    sprite.position.y += VERTEX_RADIUS + 2;
    sprite.scale.set(4, 4, 1);
    
    state.graphGroup.add(sprite);
    return sprite;
}

export function updateVertexLabels() {
    for (let i = 0; i < state.vertexMeshes.length; i++) {
        if (state.vertexLabels[i]) {
            state.vertexLabels[i].position.copy(state.vertexMeshes[i].position);
            state.vertexLabels[i].position.y += VERTEX_RADIUS + 2;
        }
    }
}

/**
 * Update node colors based on p/q partition
 * p-nodes (momentum/masses): Blue
 * q-nodes (displacement/springs): Orange
 * 
 * @param {number[]} pIndices - Array of p-node indices
 * @param {number[]} qIndices - Array of q-node indices
 */
/**
 * Update node colors based on p/q partition
 * p-nodes (momentum/masses): Blue
 * q-nodes (displacement/springs): Orange
 * q-nodes (grounded springs): Green-teal
 * 
 * @param {number[]} pIndices - Array of p-node indices
 * @param {number[]} qIndices - Array of q-node indices
 * @param {number[]} groundedQIndices - Optional array of q-node indices that are grounded
 */
export function updateNodePartitionColors(pIndices, qIndices, groundedQIndices = []) {
    if (!state.vertexMeshes || state.vertexMeshes.length === 0) {
        console.log('[NodeColor] No vertex meshes to color');
        return;
    }
    
    const pSet = new Set(pIndices || []);
    const qSet = new Set(qIndices || []);
    const groundedSet = new Set(groundedQIndices || []);
    
    console.log(`[NodeColor] Coloring ${state.vertexMeshes.length} nodes: p=[${[...pSet].join(',')}], q=[${[...qSet].join(',')}], grounded=[${[...groundedSet].join(',')}]`);
    
    // Colors for p and q nodes
    const pColor = new THREE.Color(0x5dade2);  // Blue (masses)
    const pEmissive = new THREE.Color(0x1a5276);
    const qColor = new THREE.Color(0xf5a623);  // Orange (standard springs)
    const qEmissive = new THREE.Color(0x8b5a00);
    const groundedColor = new THREE.Color(0xF1C40F);  // Gold (grounded springs)
    const groundedEmissive = new THREE.Color(0x8B7000);
    
    for (let i = 0; i < state.vertexMeshes.length; i++) {
        const mesh = state.vertexMeshes[i];
        if (!mesh || !mesh.material) continue;
        
        if (groundedSet.has(i)) {
            // Grounded q-node: gold
            mesh.material.color.copy(groundedColor);
            mesh.material.emissive.copy(groundedEmissive);
        } else if (qSet.has(i)) {
            // Standard q-node: orange
            mesh.material.color.copy(qColor);
            mesh.material.emissive.copy(qEmissive);
        } else if (pSet.has(i)) {
            // p-node: blue
            mesh.material.color.copy(pColor);
            mesh.material.emissive.copy(pEmissive);
        } else {
            // Default: blue
            mesh.material.color.copy(pColor);
            mesh.material.emissive.copy(pEmissive);
        }
        
        mesh.material.needsUpdate = true;
        
        // Reset power ring to hidden state (avoid orphaned visible rings)
        const ring = mesh.userData.powerRing;
        if (ring && ring.material) {
            ring.material.opacity = 0;
        }
    }
    
    console.log('[NodeColor] Coloring complete');
}

/**
 * Reset all node colors to default (blue) and hide power rings
 */
export function resetNodeColors() {
    if (!state.vertexMeshes || state.vertexMeshes.length === 0) return;
    
    const defaultColor = new THREE.Color(0x5dade2);
    const defaultEmissive = new THREE.Color(0x1a5276);
    
    for (const mesh of state.vertexMeshes) {
        if (!mesh || !mesh.material) continue;
        mesh.material.color.copy(defaultColor);
        mesh.material.emissive.copy(defaultEmissive);
        mesh.material.needsUpdate = true;
        
        // Reset power ring to hidden
        const ring = mesh.userData.powerRing;
        if (ring && ring.material) {
            ring.material.opacity = 0;
        }
    }
}

/**
 * Hide all power rings (call before graph modifications)
 */
export function hideAllPowerRings() {
    if (!state.vertexMeshes) return;
    
    for (const mesh of state.vertexMeshes) {
        if (!mesh) continue;
        const ring = mesh.userData.powerRing;
        if (ring && ring.material) {
            ring.material.opacity = 0;
        }
    }
}

/**
 * Recursively dispose of an object and all its children
 */
function disposeObject(obj) {
    if (!obj) return;
    
    // First dispose all children recursively
    while (obj.children && obj.children.length > 0) {
        disposeObject(obj.children[0]);
        obj.remove(obj.children[0]);
    }
    
    // Dispose geometry
    if (obj.geometry) {
        obj.geometry.dispose();
    }
    
    // Dispose material(s)
    if (obj.material) {
        if (Array.isArray(obj.material)) {
            obj.material.forEach(m => {
                if (m.map) m.map.dispose();
                m.dispose();
            });
        } else {
            if (obj.material.map) obj.material.map.dispose();
            obj.material.dispose();
        }
    }
}

export function clearGraph() {
    // Remove and dispose all objects from the graph group recursively
    while (state.graphGroup.children.length > 0) {
        const child = state.graphGroup.children[0];
        disposeObject(child);
        state.graphGroup.remove(child);
    }
    
    state.vertexMeshes = [];
    state.vertexLabels = [];
    state.edgeObjects = [];
    state.adjacencyMatrix = [];
    state.symmetricAdjMatrix = [];
    state.selectedVertex = null;
    state.hoveredVertex = null;
    state.faceMeshes = [];
}

export function setVertexMaterial(mesh, type) {
    if (!mesh || !mesh.material) {
        console.warn('[VERTEX] setVertexMaterial called with invalid mesh');
        return;
    }
    if (type === 'hover') {
        mesh.material = hoverVertexMaterial.clone();
    } else if (type === 'selected') {
        mesh.material = selectedVertexMaterial.clone();
    } else {
        mesh.material = defaultVertexMaterial.clone();
    }
}

// =====================================================
// EDGE MANAGEMENT
// =====================================================

// Helper function for dynamic arrow scaling based on node count
function getArrowScaleFactor() {
    const n = state.vertexMeshes.length;
    // For small graphs (<=5): full size
    // For medium graphs (6-20): scale down gradually
    // For large graphs (>20): compact arrows
    if (n <= 5) return 1.0;
    if (n <= 20) return 1.0 - (n - 5) * 0.025;
    return 0.625;
}

export function addEdge(fromIdx, toIdx) {
    if (fromIdx === toIdx) return false;
    
    // Safety check: ensure adjacency matrix rows exist
    const n = state.vertexMeshes.length;
    if (fromIdx >= n || toIdx >= n || fromIdx < 0 || toIdx < 0) {
        console.warn(`[EDGE] Invalid indices: from=${fromIdx}, to=${toIdx}, n=${n}`);
        return false;
    }
    
    // Safety check: ensure matrix rows are initialized
    if (!state.adjacencyMatrix[fromIdx] || !state.adjacencyMatrix[toIdx]) {
        console.warn(`[EDGE] Adjacency matrix not initialized for indices ${fromIdx}, ${toIdx}. Initializing...`);
        ensureMatrixSize(n);
    }
    
    if (state.adjacencyMatrix[fromIdx][toIdx] === 1) return false;
    
    state.adjacencyMatrix[fromIdx][toIdx] = 1;
    state.adjacencyMatrix[toIdx][fromIdx] = -1;
    state.symmetricAdjMatrix[fromIdx][toIdx] = 1;
    state.symmetricAdjMatrix[toIdx][fromIdx] = 1;
    
    const fromPos = state.vertexMeshes[fromIdx].position;
    const toPos = state.vertexMeshes[toIdx].position;
    
    const direction = new THREE.Vector3().subVectors(toPos, fromPos);
    const length = direction.length();
    direction.normalize();
    
    const arrowStart = fromPos.clone().add(direction.clone().multiplyScalar(VERTEX_RADIUS));
    const arrowLength = length - 2 * VERTEX_RADIUS - 1;
    
    // Dynamic scaling based on graph size
    const scaleFactor = getArrowScaleFactor();
    
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
        state.edgeObjects.push({ from: fromIdx, to: toIdx, arrow });
    }
    
    return true;
}

// Helper function to ensure adjacency matrices are properly sized
function ensureMatrixSize(n) {
    // Expand or create adjacency matrix rows
    while (state.adjacencyMatrix.length < n) {
        const newRow = Array(n).fill(0);
        state.adjacencyMatrix.push(newRow);
    }
    // Ensure each row has the right number of columns
    for (let i = 0; i < n; i++) {
        if (!state.adjacencyMatrix[i]) {
            state.adjacencyMatrix[i] = Array(n).fill(0);
        }
        while (state.adjacencyMatrix[i].length < n) {
            state.adjacencyMatrix[i].push(0);
        }
    }
    
    // Same for symmetric matrix
    while (state.symmetricAdjMatrix.length < n) {
        const newRow = Array(n).fill(0);
        state.symmetricAdjMatrix.push(newRow);
    }
    for (let i = 0; i < n; i++) {
        if (!state.symmetricAdjMatrix[i]) {
            state.symmetricAdjMatrix[i] = Array(n).fill(0);
        }
        while (state.symmetricAdjMatrix[i].length < n) {
            state.symmetricAdjMatrix[i].push(0);
        }
    }
}

export function removeEdge(fromIdx, toIdx) {
    const edgeIdx = state.edgeObjects.findIndex(e => e.from === fromIdx && e.to === toIdx);
    if (edgeIdx === -1) return false;
    
    const edge = state.edgeObjects[edgeIdx];
    state.graphGroup.remove(edge.arrow);
    state.edgeObjects.splice(edgeIdx, 1);
    
    state.adjacencyMatrix[fromIdx][toIdx] = 0;
    state.adjacencyMatrix[toIdx][fromIdx] = 0;
    
    // Check if reverse edge exists
    const reverseExists = state.edgeObjects.some(e => e.from === toIdx && e.to === fromIdx);
    if (!reverseExists) {
        state.symmetricAdjMatrix[fromIdx][toIdx] = 0;
        state.symmetricAdjMatrix[toIdx][fromIdx] = 0;
    }
    
    return true;
}

export function clearAllEdges() {
    for (const edge of state.edgeObjects) {
        state.graphGroup.remove(edge.arrow);
    }
    state.edgeObjects = [];
    
    const n = state.vertexMeshes.length;
    for (let i = 0; i < n; i++) {
        for (let j = 0; j < n; j++) {
            state.adjacencyMatrix[i][j] = 0;
            state.symmetricAdjMatrix[i][j] = 0;
        }
    }
}

/**
 * Rebuild edge objects from the current adjacency matrix
 * This clears all visual edges and recreates them from the matrix data
 * Used after operations that modify the matrix (like rectification)
 */
export function rebuildEdgesFromMatrix() {
    // First, clear all edge objects (visual only)
    for (const edge of state.edgeObjects) {
        state.graphGroup.remove(edge.arrow);
    }
    state.edgeObjects = [];
    
    const n = state.vertexMeshes.length;
    if (n === 0) return;
    
    // Ensure matrices are properly sized
    while (state.adjacencyMatrix.length < n) {
        state.adjacencyMatrix.push(Array(n).fill(0));
    }
    while (state.symmetricAdjMatrix.length < n) {
        state.symmetricAdjMatrix.push(Array(n).fill(0));
    }
    
    // Rebuild symmetric matrix and edges from adjacency matrix
    for (let i = 0; i < n; i++) {
        for (let j = 0; j < n; j++) {
            // Check for positive edge (i -> j)
            if (state.adjacencyMatrix[i] && state.adjacencyMatrix[i][j] === 1) {
                // Update symmetric matrix
                state.symmetricAdjMatrix[i][j] = 1;
                state.symmetricAdjMatrix[j][i] = 1;
                
                // Create the visual edge
                const fromPos = state.vertexMeshes[i].position;
                const toPos = state.vertexMeshes[j].position;
                
                const direction = new THREE.Vector3().subVectors(toPos, fromPos);
                const length = direction.length();
                direction.normalize();
                
                const arrowStart = fromPos.clone().add(direction.clone().multiplyScalar(VERTEX_RADIUS));
                const arrowLength = length - 2 * VERTEX_RADIUS - 1;
                
                const scaleFactor = getArrowScaleFactor();
                
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
    
    console.log(`[Graph] Rebuilt ${state.edgeObjects.length} edges from matrix`);
}

// Remove a vertex and all its connected edges
export function removeVertex(index) {
    const n = state.vertexMeshes.length;
    if (index < 0 || index >= n) return false;
    
    // Remove all edges connected to this vertex
    const edgesToRemove = state.edgeObjects.filter(e => e.from === index || e.to === index);
    for (const edge of edgesToRemove) {
        state.graphGroup.remove(edge.arrow);
    }
    state.edgeObjects = state.edgeObjects.filter(e => e.from !== index && e.to !== index);
    
    // Remove vertex mesh and label
    const mesh = state.vertexMeshes[index];
    const label = state.vertexLabels[index];
    if (mesh) {
        // First dispose power ring (child of mesh)
        const ring = mesh.userData.powerRing;
        if (ring) {
            if (ring.geometry) ring.geometry.dispose();
            if (ring.material) ring.material.dispose();
            mesh.remove(ring);
        }
        // Then dispose mesh itself
        if (mesh.geometry) mesh.geometry.dispose();
        if (mesh.material) mesh.material.dispose();
        state.graphGroup.remove(mesh);
    }
    if (label) {
        if (label.material && label.material.map) label.material.map.dispose();
        if (label.material) label.material.dispose();
        state.graphGroup.remove(label);
    }
    
    // Remove from arrays
    state.vertexMeshes.splice(index, 1);
    state.vertexLabels.splice(index, 1);
    
    // Rebuild adjacency matrices with new indices
    const newN = n - 1;
    const newAdj = Array(newN).fill(null).map(() => Array(newN).fill(0));
    const newSymAdj = Array(newN).fill(null).map(() => Array(newN).fill(0));
    
    for (let i = 0; i < n; i++) {
        if (i === index) continue;
        const newI = i < index ? i : i - 1;
        for (let j = 0; j < n; j++) {
            if (j === index) continue;
            const newJ = j < index ? j : j - 1;
            newAdj[newI][newJ] = state.adjacencyMatrix[i][j];
            newSymAdj[newI][newJ] = state.symmetricAdjMatrix[i][j];
        }
    }
    state.adjacencyMatrix = newAdj;
    state.symmetricAdjMatrix = newSymAdj;
    
    // Update edge indices
    for (const edge of state.edgeObjects) {
        if (edge.from > index) edge.from--;
        if (edge.to > index) edge.to--;
    }
    
    // Update vertex indices in meshes
    for (let i = 0; i < state.vertexMeshes.length; i++) {
        state.vertexMeshes[i].userData.index = i;
    }
    
    // Update vertex labels
    rebuildVertexLabels();
    
    return true;
}

// Rebuild all vertex labels (after removing/adding vertices)
function rebuildVertexLabels() {
    // Remove old labels
    for (const label of state.vertexLabels) {
        if (label) {
            if (label.material && label.material.map) label.material.map.dispose();
            if (label.material) label.material.dispose();
            state.graphGroup.remove(label);
        }
    }
    state.vertexLabels = [];
    
    // Create new labels
    for (let i = 0; i < state.vertexMeshes.length; i++) {
        const pos = state.vertexMeshes[i].position;
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.width = 64;
        canvas.height = 64;
        
        context.fillStyle = 'rgba(0, 0, 0, 0)';
        context.fillRect(0, 0, 64, 64);
        
        context.font = 'bold 40px Arial';
        context.fillStyle = '#ffffff';
        context.textAlign = 'center';
        context.textBaseline = 'middle';
        context.fillText(i.toString(), 32, 32);
        
        const texture = new THREE.CanvasTexture(canvas);
        const material = new THREE.SpriteMaterial({ map: texture, transparent: true });
        const sprite = new THREE.Sprite(material);
        
        sprite.position.copy(pos);
        sprite.position.y += VERTEX_RADIUS + 2;
        sprite.scale.set(4, 4, 1);
        
        state.graphGroup.add(sprite);
        state.vertexLabels.push(sprite);
    }
}

// Add a new vertex at a position (expands adjacency matrices)
export function addNewVertex(x, y, z) {
    const n = state.vertexMeshes.length;
    const position = new THREE.Vector3(x, y, z);
    
    // Expand adjacency matrices - ensure they exist first
    if (n === 0) {
        // First vertex - initialize with single-element arrays
        state.adjacencyMatrix = [[0]];
        state.symmetricAdjMatrix = [[0]];
    } else {
        // Add column to each existing row
        for (let i = 0; i < n; i++) {
            if (state.adjacencyMatrix[i]) {
                state.adjacencyMatrix[i].push(0);
            }
            if (state.symmetricAdjMatrix[i]) {
                state.symmetricAdjMatrix[i].push(0);
            }
        }
        // Add new row
        state.adjacencyMatrix.push(Array(n + 1).fill(0));
        state.symmetricAdjMatrix.push(Array(n + 1).fill(0));
    }
    
    // Create the vertex
    return createVertex(position, n);
}

// Arrange vertices on a 2D grid (m rows × n cols)
export function arrangeOnGrid(rows, cols, spacing = 15) {
    const n = state.vertexMeshes.length;
    if (n === 0) return;
    
    // Calculate actual grid size needed
    const actualRows = rows || Math.ceil(Math.sqrt(n));
    const actualCols = cols || Math.ceil(n / actualRows);
    
    // Center the grid
    const offsetX = (actualCols - 1) * spacing / 2;
    const offsetZ = (actualRows - 1) * spacing / 2;
    
    for (let i = 0; i < n; i++) {
        const row = Math.floor(i / actualCols);
        const col = i % actualCols;
        
        const x = col * spacing - offsetX;
        const z = row * spacing - offsetZ;
        
        state.vertexMeshes[i].position.set(x, 0, z);
    }
    
    updateVertexLabels();
    updateAllEdges();
}

// Arrange vertices in a circle
export function arrangeOnCircle(radius = 40) {
    const n = state.vertexMeshes.length;
    if (n === 0) return;
    
    for (let i = 0; i < n; i++) {
        const angle = (2 * Math.PI * i) / n;
        const x = radius * Math.cos(angle);
        const z = radius * Math.sin(angle);
        state.vertexMeshes[i].position.set(x, 0, z);
    }
    
    updateVertexLabels();
    updateAllEdges();
}

export function updateAllEdges() {
    for (const edgeObj of state.edgeObjects) {
        const fromPos = state.vertexMeshes[edgeObj.from].position;
        const toPos = state.vertexMeshes[edgeObj.to].position;
        
        const direction = new THREE.Vector3().subVectors(toPos, fromPos);
        const length = direction.length();
        direction.normalize();
        
        const arrowStart = fromPos.clone().add(direction.clone().multiplyScalar(VERTEX_RADIUS));
        const arrowLength = length - 2 * VERTEX_RADIUS - 1;
        
        if (arrowLength > 0) {
            // Dynamic scaling based on graph size
            const scaleFactor = getArrowScaleFactor();
            
            // Update existing arrow in place using Arrow3D methods
            edgeObj.arrow.setDirection(direction);
            edgeObj.arrow.position.copy(arrowStart);
            edgeObj.arrow.setLength(
                arrowLength,
                Math.min(arrowLength * 0.35 * scaleFactor, 5 * scaleFactor),
                Math.min(arrowLength * 0.18 * scaleFactor, 2.5 * scaleFactor)
            );
        }
    }
}

export function generateRandomEdges(count) {
    const n = state.vertexMeshes.length;
    if (n < 2) return;
    
    let added = 0;
    let attempts = 0;
    const maxAttempts = count * 10;
    
    while (added < count && attempts < maxAttempts) {
        const from = Math.floor(Math.random() * n);
        const to = Math.floor(Math.random() * n);
        if (addEdge(from, to)) {
            added++;
        }
        attempts++;
    }
}

// =====================================================
// LAYOUT FUNCTIONS
// =====================================================

export function getCirclePositions(count, radius) {
    const points = [];
    for (let i = 0; i < count; i++) {
        const angle = (2 * Math.PI * i) / count - Math.PI / 2;
        const x = radius * Math.cos(angle);
        const y = radius * Math.sin(angle);
        points.push(new THREE.Vector3(x, y, 0));
    }
    return points;
}

export function getSpherePositions(count, radius) {
    const points = [];
    const phi = Math.PI * (Math.sqrt(5) - 1);
    for (let i = 0; i < count; i++) {
        const y = 1 - (i / (count - 1)) * 2;
        const radiusAtY = Math.sqrt(1 - y * y);
        const theta = phi * i;
        const x = Math.cos(theta) * radiusAtY;
        const z = Math.sin(theta) * radiusAtY;
        points.push(new THREE.Vector3(x, y, z).multiplyScalar(radius));
    }
    return points;
}

export function getConcentricCirclePositions2(count, outerRadius, innerRatio, splitMode, customSplit) {
    const points = [];
    const innerRadius = outerRadius * (innerRatio / 100);
    
    let outerCount, innerCount;
    if (splitMode === 'custom' && customSplit) {
        const parts = customSplit.split(',').map(s => parseInt(s.trim()));
        if (parts.length >= 2 && parts.every(p => !isNaN(p) && p > 0)) {
            outerCount = parts[0];
            innerCount = parts[1];
            if (outerCount + innerCount !== count) {
                const ratio = count / (outerCount + innerCount);
                outerCount = Math.round(outerCount * ratio);
                innerCount = count - outerCount;
            }
        } else {
            outerCount = Math.ceil(count / 2);
            innerCount = count - outerCount;
        }
    } else {
        outerCount = Math.ceil(count / 2);
        innerCount = count - outerCount;
    }
    
    for (let i = 0; i < outerCount; i++) {
        const angle = (2 * Math.PI * i) / outerCount - Math.PI / 2;
        points.push(new THREE.Vector3(
            outerRadius * Math.cos(angle),
            outerRadius * Math.sin(angle),
            0
        ));
    }
    
    const innerOffset = Math.PI / innerCount;
    for (let i = 0; i < innerCount; i++) {
        const angle = (2 * Math.PI * i) / innerCount - Math.PI / 2 + innerOffset;
        points.push(new THREE.Vector3(
            innerRadius * Math.cos(angle),
            innerRadius * Math.sin(angle),
            0
        ));
    }
    
    return points;
}

export function getConcentricCirclePositions3(count, outerRadius, innerRatio, middleRatio, splitMode, customSplit) {
    const points = [];
    const innerRadius = outerRadius * (innerRatio / 100);
    const middleRadius = outerRadius * (middleRatio / 100);
    
    let outerCount, middleCount, innerCount;
    if (splitMode === 'custom' && customSplit) {
        const parts = customSplit.split(',').map(s => parseInt(s.trim()));
        if (parts.length >= 3 && parts.every(p => !isNaN(p) && p > 0)) {
            outerCount = parts[0];
            middleCount = parts[1];
            innerCount = parts[2];
            const total = outerCount + middleCount + innerCount;
            if (total !== count) {
                const ratio = count / total;
                outerCount = Math.round(outerCount * ratio);
                middleCount = Math.round(middleCount * ratio);
                innerCount = count - outerCount - middleCount;
            }
        } else {
            outerCount = Math.floor(count / 3);
            middleCount = Math.floor(count / 3);
            innerCount = count - outerCount - middleCount;
        }
    } else {
        outerCount = Math.floor(count / 3);
        middleCount = Math.floor(count / 3);
        innerCount = count - outerCount - middleCount;
    }
    
    for (let i = 0; i < outerCount; i++) {
        const angle = (2 * Math.PI * i) / outerCount - Math.PI / 2;
        points.push(new THREE.Vector3(
            outerRadius * Math.cos(angle),
            outerRadius * Math.sin(angle),
            0
        ));
    }
    
    const middleOffset = Math.PI / middleCount;
    for (let i = 0; i < middleCount; i++) {
        const angle = (2 * Math.PI * i) / middleCount - Math.PI / 2 + middleOffset;
        points.push(new THREE.Vector3(
            middleRadius * Math.cos(angle),
            middleRadius * Math.sin(angle),
            0
        ));
    }
    
    const innerOffset = Math.PI / innerCount * 0.5;
    for (let i = 0; i < innerCount; i++) {
        const angle = (2 * Math.PI * i) / innerCount - Math.PI / 2 + innerOffset;
        points.push(new THREE.Vector3(
            innerRadius * Math.cos(angle),
            innerRadius * Math.sin(angle),
            0
        ));
    }
    
    return points;
}

export function getConcentricSpherePositions2(count, outerRadius, innerRatio, splitMode, customSplit) {
    const points = [];
    const innerRadius = outerRadius * (innerRatio / 100);
    
    let outerCount, innerCount;
    if (splitMode === 'custom' && customSplit) {
        const parts = customSplit.split(',').map(s => parseInt(s.trim()));
        if (parts.length >= 2 && parts.every(p => !isNaN(p) && p > 0)) {
            outerCount = parts[0];
            innerCount = parts[1];
            if (outerCount + innerCount !== count) {
                const ratio = count / (outerCount + innerCount);
                outerCount = Math.round(outerCount * ratio);
                innerCount = count - outerCount;
            }
        } else {
            outerCount = Math.ceil(count / 2);
            innerCount = count - outerCount;
        }
    } else {
        outerCount = Math.ceil(count / 2);
        innerCount = count - outerCount;
    }
    
    const outerPoints = getSpherePositions(outerCount, outerRadius);
    const innerPoints = getSpherePositions(innerCount, innerRadius);
    
    return [...outerPoints, ...innerPoints];
}

// =====================================================
// FORCE-DIRECTED LAYOUT
// =====================================================

let forceAnimationId = null;

export function startForceLayout(forceSpeedInput, force3DCheckbox, onUpdate) {
    if (state.forceSimulationRunning) return;
    if (state.vertexMeshes.length < 2) return;
    
    state.forceSimulationRunning = true;
    state.velocities = state.vertexMeshes.map(() => new THREE.Vector3(0, 0, 0));
    
    // Add small z-perturbation to kick-start 3D force simulation
    // Without this, coplanar graphs stay flat even with 3D enabled
    const use3D = force3DCheckbox.checked;
    if (use3D) {
        const n = state.vertexMeshes.length;
        for (let i = 0; i < n; i++) {
            const pos = state.vertexMeshes[i].position;
            // Add small random z-offset to break coplanarity
            pos.z += (Math.random() - 0.5) * 5;
        }
        console.log('[Force Layout] Added z-perturbation for 3D simulation');
    }
    
    // Debug: count edges in matrix
    const n = state.vertexMeshes.length;
    let edgeCount = 0;
    for (let i = 0; i < n; i++) {
        if (!state.symmetricAdjMatrix[i]) continue;
        for (let j = i + 1; j < n; j++) {
            if (state.symmetricAdjMatrix[i][j] === 1) edgeCount++;
        }
    }
    console.log(`[Force Layout] Starting with ${n} vertices and ${edgeCount} edges in matrix`);
    
    runForceSimulation(forceSpeedInput, force3DCheckbox, onUpdate);
}

export function stopForceLayout() {
    state.forceSimulationRunning = false;
    if (forceAnimationId) {
        cancelAnimationFrame(forceAnimationId);
        forceAnimationId = null;
    }
}

function runForceSimulation(forceSpeedInput, force3DCheckbox, onUpdate) {
    if (!state.forceSimulationRunning) return;
    
    const n = state.vertexMeshes.length;
    const speed = parseInt(forceSpeedInput.value);
    const use3D = force3DCheckbox.checked;
    const dt = 0.1 * speed;
    
    const forces = state.vertexMeshes.map(() => new THREE.Vector3(0, 0, 0));
    
    // Repulsive forces
    for (let i = 0; i < n; i++) {
        for (let j = i + 1; j < n; j++) {
            const pi = state.vertexMeshes[i].position;
            const pj = state.vertexMeshes[j].position;
            
            const dx = pi.x - pj.x;
            const dy = pi.y - pj.y;
            const dz = use3D ? (pi.z - pj.z) : 0;
            
            let dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
            dist = Math.max(dist, MIN_DISTANCE);
            
            const forceMag = REPULSION_STRENGTH / (dist * dist);
            
            const fx = (dx / dist) * forceMag;
            const fy = (dy / dist) * forceMag;
            const fz = use3D ? (dz / dist) * forceMag : 0;
            
            forces[i].x += fx;
            forces[i].y += fy;
            forces[i].z += fz;
            
            forces[j].x -= fx;
            forces[j].y -= fy;
            forces[j].z -= fz;
        }
    }
    
    // Attractive forces along edges
    for (let i = 0; i < n; i++) {
        if (!state.symmetricAdjMatrix[i]) continue;  // Safety check
        for (let j = 0; j < n; j++) {
            if (state.symmetricAdjMatrix[i][j] === 1 && i < j) {
                const pi = state.vertexMeshes[i].position;
                const pj = state.vertexMeshes[j].position;
                
                const dx = pj.x - pi.x;
                const dy = pj.y - pi.y;
                const dz = use3D ? (pj.z - pi.z) : 0;
                
                let dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
                dist = Math.max(dist, MIN_DISTANCE);
                
                const displacement = dist - IDEAL_EDGE_LENGTH;
                const forceMag = ATTRACTION_STRENGTH * displacement;
                
                const fx = (dx / dist) * forceMag;
                const fy = (dy / dist) * forceMag;
                const fz = use3D ? (dz / dist) * forceMag : 0;
                
                forces[i].x += fx;
                forces[i].y += fy;
                forces[i].z += fz;
                
                forces[j].x -= fx;
                forces[j].y -= fy;
                forces[j].z -= fz;
            }
        }
    }
    
    // Centering force
    const CENTER_STRENGTH = 0.01;
    for (let i = 0; i < n; i++) {
        const p = state.vertexMeshes[i].position;
        forces[i].x -= CENTER_STRENGTH * p.x;
        forces[i].y -= CENTER_STRENGTH * p.y;
        if (use3D) forces[i].z -= CENTER_STRENGTH * p.z;
    }
    
    // Update velocities and positions
    for (let i = 0; i < n; i++) {
        state.velocities[i].x = (state.velocities[i].x + forces[i].x * dt) * DAMPING;
        state.velocities[i].y = (state.velocities[i].y + forces[i].y * dt) * DAMPING;
        if (use3D) {
            state.velocities[i].z = (state.velocities[i].z + forces[i].z * dt) * DAMPING;
        } else {
            state.velocities[i].z = 0;
        }
        
        const maxVel = 5 * speed;
        const vel = state.velocities[i].length();
        if (vel > maxVel) {
            state.velocities[i].multiplyScalar(maxVel / vel);
        }
        
        state.vertexMeshes[i].position.x += state.velocities[i].x * dt;
        state.vertexMeshes[i].position.y += state.velocities[i].y * dt;
        if (use3D) {
            state.vertexMeshes[i].position.z += state.velocities[i].z * dt;
        } else {
            state.vertexMeshes[i].position.z = 0;
        }
    }
    
    updateAllEdges();
    updateVertexLabels();
    
    if (onUpdate) onUpdate();
    
    forceAnimationId = requestAnimationFrame(() => 
        runForceSimulation(forceSpeedInput, force3DCheckbox, onUpdate)
    );
}

// =====================================================
// RAYCASTING / INTERACTION HELPERS
// =====================================================

export function getIntersectedVertex(event) {
    const rect = renderer.domElement.getBoundingClientRect();
    mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    
    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObjects(state.vertexMeshes);
    
    return intersects.length > 0 ? intersects[0].object : null;
}

export function getIntersectedEdge(event) {
    const rect = renderer.domElement.getBoundingClientRect();
    mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    
    raycaster.setFromCamera(mouse, camera);
    
    for (const edgeObj of state.edgeObjects) {
        const intersects = raycaster.intersectObject(edgeObj.arrow, true);
        if (intersects.length > 0) {
            return edgeObj;
        }
    }
    return null;
}

// =====================================================
// FACE RENDERING (Solid Polyhedron Mode)
// =====================================================

// Scene background is 0x0d1117 (very dark blue-black, ~5% luminance)
// ALL face colors must have HIGH luminance to be visible

// Face color settings - user adjustable
let faceColorBrightness = 1.0;  // 0.5 to 1.5
let faceColorSaturation = 1.0;  // 0.5 to 1.5

// Base hues for face colors (evenly distributed around color wheel)
const FACE_HUES = [
    0,      // Red
    30,     // Orange  
    55,     // Yellow-Gold
    120,    // Green
    175,    // Cyan
    200,    // Sky Blue
    280,    // Purple
    310,    // Magenta
    340,    // Pink
    85,     // Lime
    150,    // Teal
    230,    // Blue
];

/**
 * Generate a bright face color from hue index
 * Uses HSL with LUMINANCE-AWARE adjustment to guarantee visibility against dark backgrounds
 * Ensures minimum perceived luminance (not just lightness) for true visibility
 */
function generateFaceColor(index) {
    const hue = FACE_HUES[index % FACE_HUES.length];
    // High saturation for vivid colors
    const saturation = Math.min(100, Math.max(50, 80 * faceColorSaturation));
    // Start with high lightness
    let lightness = Math.min(90, Math.max(60, 70 * faceColorBrightness));
    
    // Convert HSL to RGB
    const h = hue / 360;
    const s = saturation / 100;
    let l = lightness / 100;
    
    const hslToRgb = (h, s, l) => {
        let r, g, b;
        if (s === 0) {
            r = g = b = l;
        } else {
            const hue2rgb = (p, q, t) => {
                if (t < 0) t += 1;
                if (t > 1) t -= 1;
                if (t < 1/6) return p + (q - p) * 6 * t;
                if (t < 1/2) return q;
                if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
                return p;
            };
            const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
            const p = 2 * l - q;
            r = hue2rgb(p, q, h + 1/3);
            g = hue2rgb(p, q, h);
            b = hue2rgb(p, q, h - 1/3);
        }
        return { r, g, b };
    };
    
    // Calculate perceived luminance using standard formula
    // Human eye is most sensitive to green, then red, then blue
    const calcLuminance = (r, g, b) => 0.299 * r + 0.587 * g + 0.114 * b;
    
    // Generate initial color
    let rgb = hslToRgb(h, s, l);
    let luminance = calcLuminance(rgb.r, rgb.g, rgb.b);
    
    // LUMINANCE-AWARE ADJUSTMENT
    // Minimum luminance threshold (0.4 ensures good contrast against dark ~0.05 background)
    const MIN_LUMINANCE = 0.4;
    
    // If luminance is too low, boost lightness iteratively
    let iterations = 0;
    while (luminance < MIN_LUMINANCE && l < 0.95 && iterations < 10) {
        l += 0.05;  // Increase lightness
        rgb = hslToRgb(h, s, l);
        luminance = calcLuminance(rgb.r, rgb.g, rgb.b);
        iterations++;
    }
    
    // If still too dark (e.g., pure blue), add a minimum RGB floor
    const MIN_COMPONENT = 0.3;  // Ensure no channel is too dark
    rgb.r = Math.max(rgb.r, MIN_COMPONENT * (1 - s));
    rgb.g = Math.max(rgb.g, MIN_COMPONENT * (1 - s));
    rgb.b = Math.max(rgb.b, MIN_COMPONENT * (1 - s));
    
    return (Math.round(rgb.r * 255) << 16) | (Math.round(rgb.g * 255) << 8) | Math.round(rgb.b * 255);
}

/**
 * Set face color brightness (0.5 to 1.5)
 */
export function setFaceColorBrightness(value) {
    faceColorBrightness = Math.max(0.5, Math.min(1.5, value));
    regenerateFaceColors();
}

/**
 * Set face color saturation (0.5 to 1.5)  
 */
export function setFaceColorSaturation(value) {
    faceColorSaturation = Math.max(0.5, Math.min(1.5, value));
    regenerateFaceColors();
}

/**
 * Get current face color settings
 */
export function getFaceColorSettings() {
    return { brightness: faceColorBrightness, saturation: faceColorSaturation };
}

/**
 * Regenerate all face colors with current settings
 */
function regenerateFaceColors() {
    if (!state.faceMeshes || state.faceMeshes.length === 0) return;
    
    state.faceMeshes.forEach((mesh, index) => {
        const color = generateFaceColor(index);
        const colorObj = new THREE.Color(color);
        mesh.material.color.copy(colorObj);
        // MeshBasicMaterial doesn't have emissive, so check first
        if (mesh.material.emissive) {
            mesh.material.emissive.copy(colorObj);
        }
        mesh.userData.faceColor = color;
    });
}

// Track assigned colors per face for smarter assignment
let faceColorAssignments = [];

/**
 * Get a face color that avoids adjacent face duplicates
 * Uses golden ratio distribution for better spread
 */
function getFaceColor(faceIndex, faceVertices = null) {
    // Use golden ratio-based distribution for better color spread
    const goldenRatio = 0.618033988749895;
    const baseIndex = Math.floor(faceIndex * goldenRatio * FACE_HUES.length) % FACE_HUES.length;
    
    return generateFaceColor(baseIndex);
}

/**
 * Detect faces in the graph based on minimal cycles
 * Uses proper 3D angle sorting and quadrilateral detection
 */
export function detectFaces() {
    const n = state.vertexMeshes.length;
    if (n < 3) return [];
    
    // No global limit - individual methods have their own limits based on complexity
    // Triangle and Quad detection: fast, no limit
    // Pentagon: O(n*d^4), limit to n <= 50
    // Hexagon: O(n*d^5), limit to n <= 40
    // Octagon: O(n*d^7), limit to n <= 30
    
    console.log(`[Face Detection] Starting for n=${n} vertices`);
    
    // Build adjacency list and edge set
    const adj = Array(n).fill(null).map(() => []);
    const edgeSet = new Set();
    
    for (const edge of state.edgeObjects) {
        const i = edge.from;
        const j = edge.to;
        if (!adj[i].includes(j)) adj[i].push(j);
        if (!adj[j].includes(i)) adj[j].push(i);
        edgeSet.add(`${Math.min(i,j)}-${Math.max(i,j)}`);
    }
    
    // Helper to check if edge exists
    const hasEdge = (a, b) => edgeSet.has(`${Math.min(a,b)}-${Math.max(a,b)}`);
    
    // Helper to check if a cycle is minimal (no diagonal/shortcut edges)
    // A minimal cycle has no edges between non-adjacent vertices
    const isMinimalCycle = (cycle) => {
        const len = cycle.length;
        if (len <= 3) return true; // Triangles are always minimal
        
        for (let i = 0; i < len; i++) {
            for (let j = i + 2; j < len; j++) {
                // Skip the edge between first and last vertex (that's part of the cycle)
                if (i === 0 && j === len - 1) continue;
                
                // If there's an edge between non-adjacent vertices, it's not minimal
                if (hasEdge(cycle[i], cycle[j])) {
                    return false;
                }
            }
        }
        return true;
    };
    
    // Sort neighbors by 3D angle using local coordinate frame
    for (let i = 0; i < n; i++) {
        const pos = state.vertexMeshes[i].position;
        
        if (adj[i].length < 2) continue;
        
        // Compute average normal for this vertex's neighborhood
        const neighbors = adj[i];
        const vectors = neighbors.map(j => {
            const npos = state.vertexMeshes[j].position;
            return new THREE.Vector3(npos.x - pos.x, npos.y - pos.y, npos.z - pos.z).normalize();
        });
        
        // Use first neighbor as reference direction
        const refDir = vectors[0].clone();
        
        // Compute approximate normal (cross product of first two neighbor directions)
        let normal = new THREE.Vector3(0, 0, 1);
        if (vectors.length >= 2) {
            normal = new THREE.Vector3().crossVectors(vectors[0], vectors[1]).normalize();
            if (normal.length() < 0.001) {
                // Vectors are parallel, use Z-up
                normal.set(0, 0, 1);
            }
        }
        
        // Sort by angle around the normal
        adj[i].sort((a, b) => {
            const posA = state.vertexMeshes[a].position;
            const posB = state.vertexMeshes[b].position;
            const vecA = new THREE.Vector3(posA.x - pos.x, posA.y - pos.y, posA.z - pos.z).normalize();
            const vecB = new THREE.Vector3(posB.x - pos.x, posB.y - pos.y, posB.z - pos.z).normalize();
            
            // Compute signed angle around normal
            const angleA = Math.atan2(
                new THREE.Vector3().crossVectors(refDir, vecA).dot(normal),
                refDir.dot(vecA)
            );
            const angleB = Math.atan2(
                new THREE.Vector3().crossVectors(refDir, vecB).dot(normal),
                refDir.dot(vecB)
            );
            
            return angleA - angleB;
        });
    }
    
    const faces = [];
    const visitedEdges = new Set();
    const faceSignatures = new Set();
    
    // Method 1: Edge-walking for triangles and small faces
    // Increased max face size from 8 to 12 to catch larger cycles
    for (let start = 0; start < n; start++) {
        for (const firstNeighbor of adj[start]) {
            const edgeKey = `${Math.min(start, firstNeighbor)}-${Math.max(start, firstNeighbor)}-${start < firstNeighbor ? 'f' : 'r'}`;
            
            if (visitedEdges.has(edgeKey)) continue;
            
            const face = findMinimalFace(start, firstNeighbor, adj, n);
            
            if (face && face.length >= 3 && face.length <= 12) {
                for (let i = 0; i < face.length; i++) {
                    const curr = face[i];
                    const next = face[(i + 1) % face.length];
                    const key = `${Math.min(curr, next)}-${Math.max(curr, next)}-${curr < next ? 'f' : 'r'}`;
                    visitedEdges.add(key);
                }
                
                const sortedFace = [...face].sort((a, b) => a - b).join(',');
                if (!faceSignatures.has(sortedFace)) {
                    faceSignatures.add(sortedFace);
                    faces.push(face);
                }
            }
        }
    }
    
    // Method 2: Explicit quadrilateral detection
    // Find all 4-cycles: look for pairs of edges that share endpoints
    for (let a = 0; a < n; a++) {
        for (const b of adj[a]) {
            if (b <= a) continue; // Only process each edge once
            
            // Find common neighbors of a and b (potential quad vertices)
            for (const c of adj[b]) {
                if (c === a) continue;
                
                for (const d of adj[a]) {
                    if (d === b || d === c) continue;
                    
                    // Check if c-d edge exists (completing the quadrilateral)
                    if (hasEdge(c, d)) {
                        const quad = [a, b, c, d];
                        const sortedQuad = [...quad].sort((x, y) => x - y).join(',');
                        
                        if (!faceSignatures.has(sortedQuad)) {
                            // Verify it's a proper quadrilateral (4 edges, no diagonals)
                            const hasAllEdges = hasEdge(a, b) && hasEdge(b, c) && 
                                               hasEdge(c, d) && hasEdge(d, a);
                            
                            if (hasAllEdges && isMinimalCycle(quad)) {
                                faceSignatures.add(sortedQuad);
                                faces.push(quad);
                            }
                        }
                    }
                }
            }
        }
    }
    
    // Method 3: Triangle detection (ensure we catch all triangles)
    for (let a = 0; a < n; a++) {
        for (let bi = 0; bi < adj[a].length; bi++) {
            const b = adj[a][bi];
            if (b <= a) continue;
            
            for (let ci = bi + 1; ci < adj[a].length; ci++) {
                const c = adj[a][ci];
                if (c <= b) continue;
                
                // Check if b-c edge exists
                if (hasEdge(b, c)) {
                    const tri = [a, b, c];
                    const sortedTri = tri.join(',');
                    
                    if (!faceSignatures.has(sortedTri)) {
                        faceSignatures.add(sortedTri);
                        faces.push(tri);
                    }
                }
            }
        }
    }
    
    // Method 4: Pentagon (5-cycle) detection
    // Only for medium graphs due to O(n * d^4) complexity
    if (n <= 100) {
        for (let a = 0; a < n; a++) {
            for (const b of adj[a]) {
                if (b <= a) continue;
                for (const c of adj[b]) {
                    if (c === a) continue;
                    for (const d of adj[c]) {
                        if (d === b || d === a) continue;
                        for (const e of adj[d]) {
                            if (e === c || e === b) continue;
                            // Check if e-a edge exists (completing the pentagon)
                            if (hasEdge(e, a)) {
                                const pent = [a, b, c, d, e];
                                const sortedPent = [...pent].sort((x, y) => x - y).join(',');
                                
                                if (!faceSignatures.has(sortedPent)) {
                                    // Verify all edges exist and no diagonals
                                    const hasAllEdges = hasEdge(a, b) && hasEdge(b, c) && 
                                                       hasEdge(c, d) && hasEdge(d, e) && hasEdge(e, a);
                                    if (hasAllEdges && isMinimalCycle(pent)) {
                                        faceSignatures.add(sortedPent);
                                        faces.push(pent);
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }
    
    // Method 5: Hexagon (6-cycle) detection - for medium graphs
    // O(n * d^5) complexity
    if (n <= 100) {
        for (let a = 0; a < n; a++) {
            for (const b of adj[a]) {
                if (b <= a) continue;
                for (const c of adj[b]) {
                    if (c === a) continue;
                    for (const d of adj[c]) {
                        if (d === b || d === a) continue;
                        for (const e of adj[d]) {
                            if (e === c || e === b || e === a) continue;
                            for (const f of adj[e]) {
                                if (f === d || f === c || f === b) continue;
                                // Check if f-a edge exists (completing the hexagon)
                                if (hasEdge(f, a)) {
                                    const hex = [a, b, c, d, e, f];
                                    const sortedHex = [...hex].sort((x, y) => x - y).join(',');
                                    
                                    if (!faceSignatures.has(sortedHex)) {
                                        const hasAllEdges = hasEdge(a, b) && hasEdge(b, c) && 
                                                           hasEdge(c, d) && hasEdge(d, e) && 
                                                           hasEdge(e, f) && hasEdge(f, a);
                                        if (hasAllEdges && isMinimalCycle(hex)) {
                                            faceSignatures.add(sortedHex);
                                            faces.push(hex);
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }
    
    // Method 6: Octagon (8-cycle) detection
    // Important for Mass-Spring grids/drums which have 8-cycle faces
    // O(n * d^7) complexity but d is typically low (2-4) for these graphs
    if (n <= 100) {
        for (let a = 0; a < n; a++) {
            for (const b of adj[a]) {
                if (b <= a) continue;
                for (const c of adj[b]) {
                    if (c === a) continue;
                    for (const d of adj[c]) {
                        if (d === b || d === a) continue;
                        for (const e of adj[d]) {
                            if (e === c || e === b || e === a) continue;
                            for (const f of adj[e]) {
                                if (f === d || f === c || f === b || f === a) continue;
                                for (const g of adj[f]) {
                                    if (g === e || g === d || g === c || g === b) continue;
                                    for (const h of adj[g]) {
                                        if (h === f || h === e || h === d || h === c || h === b) continue;
                                        // Check if h-a edge exists (completing the octagon)
                                        if (hasEdge(h, a)) {
                                            const oct = [a, b, c, d, e, f, g, h];
                                            const sortedOct = [...oct].sort((x, y) => x - y).join(',');
                                        
                                            if (!faceSignatures.has(sortedOct)) {
                                                // Verify all edges exist and no diagonals
                                                const hasAllEdges = hasEdge(a, b) && hasEdge(b, c) && 
                                                                   hasEdge(c, d) && hasEdge(d, e) && 
                                                                   hasEdge(e, f) && hasEdge(f, g) &&
                                                                   hasEdge(g, h) && hasEdge(h, a);
                                                if (hasAllEdges && isMinimalCycle(oct)) {
                                                    faceSignatures.add(sortedOct);
                                                    faces.push(oct);
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }
    
    // Filter out smaller faces that are subsets of larger faces
    // This prevents triangles from appearing inside pentagons/hexagons/etc.
    const filteredFaces = filterRedundantFaces(faces);
    
    // Log face sizes for debugging
    const sizeCounts = {};
    for (const face of filteredFaces) {
        const size = face.length;
        sizeCounts[size] = (sizeCounts[size] || 0) + 1;
    }
    console.log(`Detected ${filteredFaces.length} faces (filtered from ${faces.length} candidates)`);
    console.log(`Face sizes:`, sizeCounts);
    return filteredFaces;
}

/**
 * Filter out faces that are subsets of larger faces
 * A face A is redundant if all its vertices are contained in a larger face B
 */
function filterRedundantFaces(faces) {
    if (faces.length <= 1) return faces;
    
    // Sort faces by size (largest first) for efficient filtering
    const sortedFaces = [...faces].sort((a, b) => b.length - a.length);
    
    const kept = [];
    const vertexSets = []; // Cache vertex sets for kept faces
    
    for (const face of sortedFaces) {
        const faceSet = new Set(face);
        
        // Check if this face is a subset of any already-kept larger face
        let isRedundant = false;
        
        for (let i = 0; i < kept.length; i++) {
            const largerFace = kept[i];
            const largerSet = vertexSets[i];
            
            // Only check if the larger face is actually larger
            if (largerFace.length > face.length) {
                // Check if all vertices of this face are in the larger face
                let allContained = true;
                for (const v of face) {
                    if (!largerSet.has(v)) {
                        allContained = false;
                        break;
                    }
                }
                
                if (allContained) {
                    isRedundant = true;
                    break;
                }
            }
        }
        
        if (!isRedundant) {
            kept.push(face);
            vertexSets.push(faceSet);
        }
    }
    
    return kept;
}

/**
 * Check if a set of 3D points are approximately coplanar
 * Uses the normal vector method: compute normal from first 3 points,
 * then check if remaining points have small distance to that plane
 */
function isCoplanar(positions, tolerance = 0.15) {
    if (positions.length <= 3) return true;
    
    // Get first three points to define the plane
    const p0 = positions[0];
    const p1 = positions[1];
    const p2 = positions[2];
    
    // Compute two edge vectors
    const v1 = new THREE.Vector3(p1.x - p0.x, p1.y - p0.y, p1.z - p0.z);
    const v2 = new THREE.Vector3(p2.x - p0.x, p2.y - p0.y, p2.z - p0.z);
    
    // Compute normal via cross product
    const normal = new THREE.Vector3().crossVectors(v1, v2);
    const normalLength = normal.length();
    
    // If normal is too small, points are collinear (degenerate)
    if (normalLength < 0.001) return false;
    
    normal.divideScalar(normalLength); // Normalize
    
    // Plane equation: normal · (p - p0) = 0
    // Check all other points
    for (let i = 3; i < positions.length; i++) {
        const pi = positions[i];
        const toPoint = new THREE.Vector3(pi.x - p0.x, pi.y - p0.y, pi.z - p0.z);
        const distance = Math.abs(normal.dot(toPoint));
        
        // Scale tolerance by the size of the face
        const maxEdge = Math.max(v1.length(), v2.length(), 1);
        if (distance > tolerance * maxEdge) {
            return false;
        }
    }
    
    return true;
}

/**
 * Find a minimal face starting from a directed edge
 */
function findMinimalFace(start, next, adj, n) {
    const face = [start, next];
    let current = next;
    let prev = start;
    const maxSteps = n + 1;
    
    for (let step = 0; step < maxSteps; step++) {
        const neighbors = adj[current];
        if (neighbors.length < 2) return null;
        
        // Find the next vertex by taking the "left-most" turn
        const prevIndex = neighbors.indexOf(prev);
        if (prevIndex === -1) return null;
        
        // Next vertex is the one after prev in the sorted neighbor list
        const nextIndex = (prevIndex + 1) % neighbors.length;
        const nextVertex = neighbors[nextIndex];
        
        if (nextVertex === start) {
            // Completed the face
            return face;
        }
        
        if (face.includes(nextVertex)) {
            // Hit a vertex we've already visited (not the start) - invalid face
            return null;
        }
        
        face.push(nextVertex);
        prev = current;
        current = nextVertex;
    }
    
    return null;
}

/**
 * Create face meshes from detected faces
 * Uses "Frosted Glass / Cyberpunk Gemstone" aesthetic with emissive glow
 * @param {Array} faces - Array of face vertex indices (optional, will detect if null)
 * @param {Array} colors - Array of hex colors for each face (optional, will assign if null)
 */
export function createFaceMeshes(faces = null, colors = null) {
    // Clear existing face meshes
    clearFaceMeshes();
    
    // Check if we have vertices
    if (!state.vertexMeshes || state.vertexMeshes.length < 3) {
        console.log('Not enough vertices for face detection');
        return;
    }
    
    if (!faces) {
        faces = detectFaces();
    }
    
    if (!faces || faces.length === 0) {
        console.log('No faces detected');
        return;
    }
    
    // Only log during initial creation, not during animation updates
    if (!colors) {
        console.log(`Creating ${faces.length} face meshes`);
    }
    
    // Create meshes for each face
    faces.forEach((face, faceIndex) => {
        // Validate face
        if (!face || !Array.isArray(face) || face.length < 3) return;
        
        // Validate all vertex indices
        const validIndices = face.every(i => 
            typeof i === 'number' && i >= 0 && i < state.vertexMeshes.length
        );
        if (!validIndices) {
            console.warn(`Face ${faceIndex} has invalid vertex indices`);
            return;
        }
        
        const vertices = face.map(i => state.vertexMeshes[i].position.clone());
        
        if (vertices.length < 3) return;
        
        // Create geometry from face vertices
        const geometry = createFaceGeometry(vertices);
        if (!geometry) return;
        
        // Use provided color or choose from Jewel Tone palette
        const color = (colors && colors[faceIndex]) ? colors[faceIndex] : getFaceColor(faceIndex);
        const colorObj = new THREE.Color(color);
        
        // ADDITIVE BLENDING material for light-on-dark glow effect
        // - AdditiveBlending: overlapping faces become brighter (natural glow)
        // - depthWrite: false: vertices and edges always render on top
        // - DoubleSide: faces visible from both sides
        const material = new THREE.MeshBasicMaterial({
            color: colorObj,
            transparent: true,
            opacity: state.faceOpacity * 0.7,  // Slightly lower base opacity for additive
            side: THREE.DoubleSide,
            depthWrite: false,
            blending: THREE.AdditiveBlending
        });
        
        const mesh = new THREE.Mesh(geometry, material);
        mesh.userData.faceIndex = faceIndex;
        mesh.userData.faceVertices = face.slice();  // Clone the array
        mesh.userData.faceColor = color;
        // Render faces first (lower order), then edges (0), then vertices (higher)
        // Combined with depthWrite: false, this ensures graph skeleton is always visible
        mesh.renderOrder = -10;
        
        state.graphGroup.add(mesh);
        state.faceMeshes.push(mesh);
    });
    
    // Create glowing edge lines for better visibility
    if (state.faceMeshes.length > 0) {
        createFaceEdges();
    }
    
    // Update visibility state
    state.facesVisible = true;
    console.log(`Created ${state.faceMeshes.length} face objects`);
}

/**
 * Create geometry for a single face
 */
function createFaceGeometry(vertices) {
    if (vertices.length < 3) return null;
    
    // Calculate centroid
    const centroid = new THREE.Vector3();
    for (const v of vertices) {
        centroid.add(v);
    }
    centroid.divideScalar(vertices.length);
    
    // Calculate face normal
    const v0 = vertices[0];
    const v1 = vertices[1];
    const v2 = vertices[2];
    const edge1 = new THREE.Vector3().subVectors(v1, v0);
    const edge2 = new THREE.Vector3().subVectors(v2, v0);
    const normal = new THREE.Vector3().crossVectors(edge1, edge2).normalize();
    
    // Create triangulated geometry (fan triangulation from centroid)
    const geometry = new THREE.BufferGeometry();
    const positions = [];
    const normals = [];
    
    for (let i = 0; i < vertices.length; i++) {
        const v0 = vertices[i];
        const v1 = vertices[(i + 1) % vertices.length];
        
        // Triangle: centroid, v0, v1
        positions.push(centroid.x, centroid.y, centroid.z);
        positions.push(v0.x, v0.y, v0.z);
        positions.push(v1.x, v1.y, v1.z);
        
        // All triangles share the same normal
        for (let j = 0; j < 3; j++) {
            normals.push(normal.x, normal.y, normal.z);
        }
    }
    
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
    
    return geometry;
}

/**
 * Create glowing edge lines on top of faces for better visibility
 * Uses white/cyan "rim light" for cyberpunk aesthetic with additive glow
 */
function createFaceEdges() {
    if (!state.faceMeshes || state.faceMeshes.length === 0) return;
    
    // Glowing rim edge material - white with additive blending for glow
    const edgeMaterial = new THREE.LineBasicMaterial({
        color: 0x88ddff,  // Soft cyan rim light
        linewidth: 2,
        transparent: true,
        opacity: 0.5,
        blending: THREE.AdditiveBlending,
        depthWrite: false
    });
    
    const processedEdges = new Set();
    
    // Store edges to add separately (don't modify array while iterating)
    const edgesToAdd = [];
    
    for (const faceMesh of state.faceMeshes) {
        const faceVertices = faceMesh.userData?.faceVertices;
        
        // Skip if no face vertices (e.g., edge lines or invalid meshes)
        if (!faceVertices || !Array.isArray(faceVertices)) continue;
        
        for (let i = 0; i < faceVertices.length; i++) {
            const a = faceVertices[i];
            const b = faceVertices[(i + 1) % faceVertices.length];
            const edgeKey = `${Math.min(a, b)}-${Math.max(a, b)}`;
            
            if (processedEdges.has(edgeKey)) continue;
            processedEdges.add(edgeKey);
            
            // Validate vertex indices
            if (a >= state.vertexMeshes.length || b >= state.vertexMeshes.length) continue;
            
            const posA = state.vertexMeshes[a].position;
            const posB = state.vertexMeshes[b].position;
            
            const points = [posA.clone(), posB.clone()];
            const geometry = new THREE.BufferGeometry().setFromPoints(points);
            const line = new THREE.Line(geometry, edgeMaterial.clone());
            line.userData.isFaceEdge = true;
            // Render face edges after face polygons (-10) but with same order as main edges
            line.renderOrder = -5;
            
            edgesToAdd.push(line);
        }
    }
    
    // Add edges to scene and tracking array
    for (const line of edgesToAdd) {
        state.graphGroup.add(line);
        state.faceMeshes.push(line);
    }
}

/**
 * Clear all face meshes
 */
export function clearFaceMeshes() {
    if (!state.faceMeshes) {
        state.faceMeshes = [];
        return;
    }
    
    for (const mesh of state.faceMeshes) {
        if (mesh) {
            if (mesh.geometry) mesh.geometry.dispose();
            if (mesh.material) mesh.material.dispose();
            if (state.graphGroup) state.graphGroup.remove(mesh);
        }
    }
    state.faceMeshes = [];
}

/**
 * Toggle face visibility
 */
export function toggleFaces(visible) {
    state.facesVisible = visible;
    
    if (visible) {
        createFaceMeshes();
    } else {
        clearFaceMeshes();
    }
}

/**
 * Update face opacity
 */
export function setFaceOpacity(opacity) {
    state.faceOpacity = opacity;
    
    for (const mesh of state.faceMeshes) {
        if (mesh.material && !mesh.userData.isFaceEdge) {
            // Apply 0.7 multiplier for additive blending (avoids over-bright overlaps)
            mesh.material.opacity = opacity * 0.7;
        }
    }
}

/**
 * Update face positions after vertex movement
 * Recreates face meshes with current vertex positions
 */
export function updateFaceMeshes() {
    if (!state.facesVisible || state.faceMeshes.length === 0) return;
    
    // Collect face vertex indices AND colors before clearing
    const faces = [];
    const colors = [];
    for (const mesh of state.faceMeshes) {
        if (mesh.userData.faceVertices && !mesh.userData.isFaceEdge) {
            faces.push(mesh.userData.faceVertices.slice());
            colors.push(mesh.userData.faceColor);
        }
    }
    
    if (faces.length > 0) {
        // Recreate all face meshes with current vertex positions, preserving colors
        createFaceMeshes(faces, colors);
    }
}

// =====================================================
// SNAP GRID FOR ADD VERTEX MODE
// =====================================================

let snapGridGroup = null;
let snapGridSize = 5;
let snapToGridEnabled = true;
let currentProjection = '3d';
let currentGridPlane = 'xz'; // 'xz', 'xy', 'yz'

/**
 * Create a 2D grid on the specified plane
 * @param {string} plane - 'xz', 'xy', or 'yz'
 * @param {number} gridSize - Grid cell size
 * @param {number} gridExtent - Total grid extent
 */
function createGridOnPlane(plane, gridSize, gridExtent) {
    const group = new THREE.Group();
    const divisions = Math.floor(gridExtent / gridSize);
    const halfExtent = gridExtent;
    
    // Material for grid lines - thin and subtle
    const majorMaterial = new THREE.LineBasicMaterial({ 
        color: 0x00acc1,  // Cyan for major lines
        transparent: true, 
        opacity: 0.35,
        depthWrite: false
    });
    const minorMaterial = new THREE.LineBasicMaterial({ 
        color: 0x26a69a,  // Teal for minor lines
        transparent: true, 
        opacity: 0.15,
        depthWrite: false
    });
    
    // Create grid lines
    for (let i = -divisions; i <= divisions; i++) {
        const pos = i * gridSize;
        const isMajor = (i % 5 === 0);
        const material = isMajor ? majorMaterial : minorMaterial;
        
        // Create two perpendicular lines for each position
        const points1 = [];
        const points2 = [];
        
        switch (plane) {
            case 'xz': // Horizontal plane (Y = 0)
                // Lines along X axis
                points1.push(new THREE.Vector3(-halfExtent, 0, pos));
                points1.push(new THREE.Vector3(halfExtent, 0, pos));
                // Lines along Z axis
                points2.push(new THREE.Vector3(pos, 0, -halfExtent));
                points2.push(new THREE.Vector3(pos, 0, halfExtent));
                break;
            case 'xy': // Vertical front plane (Z = 0)
                // Lines along X axis
                points1.push(new THREE.Vector3(-halfExtent, pos, 0));
                points1.push(new THREE.Vector3(halfExtent, pos, 0));
                // Lines along Y axis
                points2.push(new THREE.Vector3(pos, -halfExtent, 0));
                points2.push(new THREE.Vector3(pos, halfExtent, 0));
                break;
            case 'yz': // Vertical side plane (X = 0)
                // Lines along Y axis
                points1.push(new THREE.Vector3(0, -halfExtent, pos));
                points1.push(new THREE.Vector3(0, halfExtent, pos));
                // Lines along Z axis
                points2.push(new THREE.Vector3(0, pos, -halfExtent));
                points2.push(new THREE.Vector3(0, pos, halfExtent));
                break;
        }
        
        const geometry1 = new THREE.BufferGeometry().setFromPoints(points1);
        const geometry2 = new THREE.BufferGeometry().setFromPoints(points2);
        
        group.add(new THREE.Line(geometry1, material));
        group.add(new THREE.Line(geometry2, material));
    }
    
    return group;
}

/**
 * Show snap grid for the current projection
 * @param {number} gridSize - Grid cell size (default 5)
 * @param {number} gridExtent - Total grid extent (default 100)
 */
export function showSnapGrid(gridSize = 5, gridExtent = 100) {
    hideSnapGrid(); // Remove existing grid first
    
    // Don't show grid in 3D mode
    if (currentProjection === '3d') {
        console.log('[GRID] No grid in 3D mode');
        return;
    }
    
    snapGridSize = gridSize;
    
    // Determine which plane to use based on projection
    switch (currentProjection) {
        case 'xz': currentGridPlane = 'xz'; break; // Top view
        case 'xy': currentGridPlane = 'xy'; break; // Front view
        case 'yz': currentGridPlane = 'yz'; break; // Side view
        default: currentGridPlane = 'xz';
    }
    
    snapGridGroup = createGridOnPlane(currentGridPlane, gridSize, gridExtent);
    scene.add(snapGridGroup);
    
    console.log(`[GRID] Snap grid shown: plane=${currentGridPlane}, size=${gridSize}, extent=${gridExtent}`);
}

/**
 * Hide and remove the snap grid
 */
export function hideSnapGrid() {
    if (snapGridGroup) {
        // Dispose all children
        snapGridGroup.traverse((child) => {
            if (child.geometry) child.geometry.dispose();
            if (child.material) child.material.dispose();
        });
        scene.remove(snapGridGroup);
        snapGridGroup = null;
        console.log('[GRID] Snap grid hidden');
    }
}

/**
 * Set snap-to-grid enabled state
 * @param {boolean} enabled 
 */
export function setSnapToGrid(enabled) {
    snapToGridEnabled = enabled;
    console.log(`[GRID] Snap to grid: ${enabled}`);
}

/**
 * Set grid size and recreate if visible
 * @param {number} size 
 */
export function setSnapGridSize(size) {
    snapGridSize = size;
    if (snapGridGroup) {
        showSnapGrid(size);
    }
}

/**
 * Snap a position to the grid based on current plane
 * @param {THREE.Vector3} point - The 3D point to snap
 * @returns {THREE.Vector3} Snapped position
 */
export function snapToGrid(x, y, z) {
    if (!snapToGridEnabled) {
        return { x, y, z };
    }
    
    // Snap based on current grid plane
    switch (currentGridPlane) {
        case 'xz':
            return {
                x: Math.round(x / snapGridSize) * snapGridSize,
                y: 0,
                z: Math.round(z / snapGridSize) * snapGridSize
            };
        case 'xy':
            return {
                x: Math.round(x / snapGridSize) * snapGridSize,
                y: Math.round(y / snapGridSize) * snapGridSize,
                z: 0
            };
        case 'yz':
            return {
                x: 0,
                y: Math.round(y / snapGridSize) * snapGridSize,
                z: Math.round(z / snapGridSize) * snapGridSize
            };
        default:
            return { x, y, z };
    }
}

/**
 * Get current grid state
 */
export function getSnapGridState() {
    return {
        visible: snapGridGroup !== null,
        size: snapGridSize,
        snapEnabled: snapToGridEnabled,
        plane: currentGridPlane,
        projection: currentProjection
    };
}

/**
 * Get current grid plane for vertex placement
 */
export function getCurrentGridPlane() {
    return currentGridPlane;
}

// =====================================================
// CAMERA PROJECTION VIEWS
// =====================================================

/**
 * Set camera to a specific projection view
 * @param {string} projection - 'xy', 'xz', 'yz', or '3d'
 * @param {boolean} animate - Whether to animate the transition
 */
export function setCameraProjection(projection, animate = true) {
    if (!camera || !controls) {
        console.warn('[CAMERA] Camera or controls not initialized');
        return;
    }
    
    const previousProjection = currentProjection;
    currentProjection = projection;
    
    // Calculate scene bounds to determine camera distance
    let maxDist = 50;
    const center = new THREE.Vector3(0, 0, 0);
    
    if (state.vertexMeshes.length > 0) {
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
            center.add(pos);
        }
        center.divideScalar(state.vertexMeshes.length);
        
        const sizeX = maxX - minX;
        const sizeY = maxY - minY;
        const sizeZ = maxZ - minZ;
        maxDist = Math.max(sizeX, sizeY, sizeZ, 50) / 2 + 30;
    }
    
    const distance = Math.max(maxDist * 2, 80);
    let targetPos;
    
    switch (projection) {
        case 'xy': // Front view (looking at XY plane, camera on +Z axis)
            targetPos = new THREE.Vector3(center.x, center.y, center.z + distance);
            break;
        case 'xz': // Top view (looking down at XZ plane, camera on +Y axis)
            targetPos = new THREE.Vector3(center.x, center.y + distance, center.z + 0.001); // Small offset to avoid gimbal lock
            break;
        case 'yz': // Side view (looking at YZ plane, camera on +X axis)
            targetPos = new THREE.Vector3(center.x + distance, center.y, center.z);
            break;
        case '3d':
        default:
            // Isometric-ish 3D view
            targetPos = new THREE.Vector3(
                center.x + distance * 0.5,
                center.y + distance * 0.35,
                center.z + distance * 0.7
            );
            break;
    }
    
    console.log(`[CAMERA] Setting projection: ${projection}, distance: ${distance.toFixed(1)}, center: (${center.x.toFixed(1)}, ${center.y.toFixed(1)}, ${center.z.toFixed(1)})`);
    
    // Update grid visibility based on projection
    // Only update if grid is currently showing
    if (snapGridGroup) {
        if (projection === '3d') {
            hideSnapGrid();
        } else {
            // Recreate grid for new plane orientation
            showSnapGrid(snapGridSize);
        }
    }
    
    if (animate) {
        animateCameraTo(targetPos, center.clone());
    } else {
        camera.position.copy(targetPos);
        controls.target.copy(center);
        camera.lookAt(center);
        controls.update();
    }
}

/**
 * Animate camera to target position smoothly
 */
function animateCameraTo(targetPos, targetLookAt) {
    const startPos = camera.position.clone();
    const startTarget = controls.target.clone();
    const duration = 400; // ms
    const startTime = performance.now();
    
    function animateStep() {
        const elapsed = performance.now() - startTime;
        const t = Math.min(elapsed / duration, 1);
        
        // Ease out cubic for smooth deceleration
        const easeT = 1 - Math.pow(1 - t, 3);
        
        camera.position.lerpVectors(startPos, targetPos, easeT);
        controls.target.lerpVectors(startTarget, targetLookAt, easeT);
        controls.update();
        
        if (t < 1) {
            requestAnimationFrame(animateStep);
        } else {
            // Ensure final position is exact
            camera.position.copy(targetPos);
            controls.target.copy(targetLookAt);
            controls.update();
        }
    }
    
    animateStep();
}

/**
 * Get current projection mode
 */
export function getCurrentProjection() {
    return currentProjection;
}

/**
 * Debug: List all objects in the scene (for finding orphaned objects)
 */
export function debugSceneObjects() {
    console.log('=== SCENE DEBUG ===');
    console.log('Scene children:', scene.children.length);
    
    scene.traverse((obj) => {
        const type = obj.type;
        const name = obj.name || '(unnamed)';
        const geo = obj.geometry ? obj.geometry.type : 'none';
        const mat = obj.material ? (obj.material.type || 'material') : 'none';
        const parent = obj.parent ? (obj.parent.name || obj.parent.type) : 'root';
        
        // Highlight potential orphans (rings not under a vertex)
        if (geo === 'RingGeometry' && parent !== 'Mesh') {
            console.warn(`ORPHAN RING: ${name} parent=${parent}`);
        }
        
        console.log(`  ${type}: "${name}" geo=${geo} mat=${mat} parent=${parent}`);
    });
    
    console.log('GraphGroup children:', state.graphGroup.children.length);
    console.log('VertexMeshes tracked:', state.vertexMeshes.length);
    console.log('===================');
}

// Expose to window for debugging
if (typeof window !== 'undefined') {
    window.debugSceneObjects = debugSceneObjects;
}

// =====================================================
// ANIMATION LOOP
// =====================================================

export function animate() {
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
}
