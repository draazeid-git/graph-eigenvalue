# Realizability Analysis

## Overview

**Realizability** determines whether a graph structure can represent a valid physical network. For port-Hamiltonian systems with uniform parameters (±1), realizability requires specific topological and sign constraints.

## Physical Network Analogs

The same graph structure can represent:

| Domain | p-nodes (Inertia) | q-nodes (Stiffness) | Grounded |
|--------|-------------------|---------------------|----------|
| Mechanical (translational) | Mass | Spring | Fixed wall |
| Mechanical (rotational) | Rotational inertia | Torsional spring | Fixed shaft |
| Electrical | Inductor | Capacitor | Ground reference |

## Realizability Conditions

### 1. Bipartite Structure

The graph must be **bipartite** with vertex sets P (inertia nodes) and Q (stiffness nodes):
- All edges connect P to Q
- No edges within P or within Q

```
Valid:          Invalid:
p──q──p         p──p
│  │  │         │  │
q──p──q         q──q
```

### 2. Incidence Matrix Structure

The **incidence matrix B** must satisfy:

```
J = [ 0    B  ]
    [-Bᵀ   0  ]
```

where:
- Rows of B correspond to p-nodes
- Columns of B correspond to q-nodes (as edges)
- Entries are ±1

### 3. Newton's Third Law (Action-Reaction)

Each internal stiffness element (q-node) connects exactly two inertia elements (p-nodes):

```
Column of B for internal spring:
[...  +1  ...  -1  ...]ᵀ

Exactly one +1 and one -1.
```

### 4. Grounded Elements

Grounded stiffness elements connect one inertia element to fixed reference:

```
Column of B for grounded spring:
[...  ±1  ...  0  ...]ᵀ

Exactly one ±1, rest zeros.
```

---

## The Audit Process

### Step 1: Check Bipartiteness

```javascript
function isBipartite(graph) {
    // 2-coloring algorithm
    const color = new Array(n).fill(-1);
    const queue = [0];
    color[0] = 0;
    
    while (queue.length > 0) {
        const u = queue.shift();
        for (const v of neighbors(u)) {
            if (color[v] === -1) {
                color[v] = 1 - color[u];
                queue.push(v);
            } else if (color[v] === color[u]) {
                return false;  // Odd cycle found
            }
        }
    }
    return true;
}
```

### Step 2: Extract Partition

Identify p-nodes and q-nodes from the 2-coloring:
- Color 0 → p-nodes (inertia)
- Color 1 → q-nodes (stiffness)

### Step 3: Build B-Matrix

Construct incidence matrix with proper signs:

```javascript
function buildIncidenceMatrix(graph, pNodes, qNodes) {
    const N = pNodes.length;
    const M = qNodes.length;
    const B = zeros(N, M);
    
    for (const [u, v, sign] of edges) {
        if (pNodes.includes(u) && qNodes.includes(v)) {
            B[pIndex(u)][qIndex(v)] = sign;
        } else if (qNodes.includes(u) && pNodes.includes(v)) {
            B[pIndex(v)][qIndex(u)] = -sign;
        }
    }
    return B;
}
```

### Step 4: Validate Columns

Check each column of B:

```javascript
function validateColumns(B) {
    const violations = [];
    
    for (let j = 0; j < M; j++) {
        const col = B.map(row => row[j]);
        const nonzero = col.filter(x => x !== 0);
        
        if (nonzero.length === 0) {
            violations.push({col: j, type: 'isolated'});
        } else if (nonzero.length === 1) {
            // Grounded element - OK
        } else if (nonzero.length === 2) {
            // Internal element - check signs
            if (nonzero[0] + nonzero[1] !== 0) {
                violations.push({col: j, type: 'sign_mismatch'});
            }
        } else {
            violations.push({col: j, type: 'too_many_connections'});
        }
    }
    return violations;
}
```

---

## Violation Types

| Type | Description | Physical Meaning |
|------|-------------|------------------|
| **Not bipartite** | Odd cycle exists | Cannot assign p/q roles |
| **Sign mismatch** | Column doesn't sum to 0 | Violates action-reaction |
| **Isolated** | Zero column | Disconnected element |
| **Over-connected** | >2 nonzeros in column | Invalid spring topology |

---

## Rectification

Non-realizable graphs can sometimes be **rectified** by adjusting edge signs:

### Algorithm

1. For each violating column, identify sign conflicts
2. Flip edge signs to achieve +1/-1 pattern
3. Propagate changes to maintain consistency
4. Re-verify after changes

### Implementation

```javascript
function rectify(graph) {
    // Save original for undo
    const original = deepCopy(graph);
    
    // Process each q-node
    for (const q of qNodes) {
        const connectedP = getConnectedPNodes(q);
        if (connectedP.length === 2) {
            // Ensure opposite signs
            const [p1, p2] = connectedP;
            const sign1 = getEdgeSign(p1, q);
            const sign2 = getEdgeSign(p2, q);
            
            if (sign1 === sign2) {
                // Flip one sign
                flipEdgeSign(p2, q);
            }
        }
    }
    
    return {rectified: graph, original: original};
}
```

---

## Grounded vs. Internal Elements

### Internal Stiffness (Spring/Capacitor)

- Connects two inertia elements
- Column has one +1, one -1
- Energy storage between elements

### Grounded Stiffness

- Connects one inertia element to fixed reference
- Column has single ±1
- Provides restoring force to equilibrium

### Detecting Grounded Elements

```javascript
function classifyQNodes(B) {
    const internal = [];
    const grounded = [];
    
    for (let j = 0; j < M; j++) {
        const nonzeros = countNonzeros(B, j);
        if (nonzeros === 2) {
            internal.push(j);
        } else if (nonzeros === 1) {
            grounded.push(j);
        }
    }
    
    return {internal, grounded};
}
```

---

## Physical Implications

### Without Grounding

- System has **rigid-body modes** (zero eigenvalues)
- Free translation/rotation possible
- Energy can drift to unbounded motion

### With Grounding

- All eigenvalues nonzero (for connected system)
- Unique equilibrium position
- Bounded oscillations

### Modal Analysis

The eigenvalue structure reveals:
- **Zero eigenvalues**: Number of rigid-body modes
- **Positive eigenvalues**: Oscillation frequencies ω = √λ
- **Multiplicity**: Symmetry in the structure

---

## Uniform Parameter Assumption

### What It Means

All physical parameters are set to ±1:
- Mass m = 1 (or normalized)
- Spring constant k = 1
- Inductance L = 1
- Capacitance C = 1

### Why This Matters

With uniform parameters:
- Eigenspectrum depends **only on topology**
- Different physical domains share identical spectra
- Simplifies analysis to graph structure

### Limitations

- Real systems have varying parameters
- This tool studies topological effects
- Parameter variation is a separate study

---

## References

- van der Schaft, A., & Maschke, B. (2014). Port-Hamiltonian Systems on Graphs. *SIAM J. Control Optim.*
- Anderson, B. D. O., & Vongpanitlerd, S. (1973). *Network Analysis and Synthesis*. Prentice-Hall.
- Willems, J. C. (2007). The Behavioral Approach to Open and Interconnected Systems. *IEEE Control Systems Magazine*.
