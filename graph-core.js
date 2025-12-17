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
    velocities: []
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

export function initScene(container) {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0d1117);  // Softer dark background
    
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

export function clearGraph() {
    // Remove all meshes from the graph group
    while (state.graphGroup.children.length > 0) {
        const child = state.graphGroup.children[0];
        if (child.geometry) child.geometry.dispose();
        if (child.material) {
            if (Array.isArray(child.material)) {
                child.material.forEach(m => m.dispose());
            } else {
                child.material.dispose();
            }
        }
        state.graphGroup.remove(child);
    }
    
    state.vertexMeshes = [];
    state.vertexLabels = [];
    state.edgeObjects = [];
    state.adjacencyMatrix = [];
    state.symmetricAdjMatrix = [];
    state.selectedVertex = null;
    state.hoveredVertex = null;
}

export function setVertexMaterial(mesh, type) {
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
    
    // Expand adjacency matrices
    for (let i = 0; i < n; i++) {
        state.adjacencyMatrix[i].push(0);
        state.symmetricAdjMatrix[i].push(0);
    }
    state.adjacencyMatrix.push(Array(n + 1).fill(0));
    state.symmetricAdjMatrix.push(Array(n + 1).fill(0));
    
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
// ANIMATION LOOP
// =====================================================

export function animate() {
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
}
