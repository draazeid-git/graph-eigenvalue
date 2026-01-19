# Visualization Modes

The Simulate tab provides three visualization modes for understanding the dynamics of ẋ = Ax on graphs with skew-symmetric adjacency matrices. Each mode highlights different physical aspects of the system.

## Overview

| Mode | Focus | Shows | Requires Partition? |
|------|-------|-------|---------------------|
| **Displacement** | State values | Node magnitudes xᵢ | No |
| **Power** | Energy FLOW | Transfer rates between nodes | No |
| **Energy** | Energy STORAGE | Kinetic vs Potential distribution | **Yes** |

---

## Displacement Mode

The default mode showing instantaneous state values.

### Visual Elements
- **Node color**: Cyan (+) / Magenta (−) based on state value xᵢ
- **Arrows**: Show product xᵢ·xⱼ between connected nodes

### Use Case
Basic visualization of oscillatory dynamics. Good for seeing wave-like patterns propagate through the graph.

---

## Power Mode (Energy Flow)

Shows **how energy moves between nodes** in real-time.

### The Physics

For the dynamics ẋ = Ax, the rate of change of node i's energy is:

$$\frac{dE_i}{dt} = x_i \dot{x}_i = x_i \sum_j A_{ij} x_j = \sum_j P_{ij}$$

where the **edge power** is:

$$P_{ij} = A_{ij} \cdot x_i \cdot x_j$$

This represents the rate at which energy transfers along edge (i,j):
- **Pᵢⱼ > 0**: Energy flows **from j to i** (node i gains energy)
- **Pᵢⱼ < 0**: Energy flows **from i to j** (node i loses energy)

### Conservation Law

For skew-symmetric A:
$$P_{ij} = -P_{ji}$$

What one node gains, the other loses. Total energy is conserved.

### Visual Elements

| Element | Meaning |
|---------|---------|
| **Node color** | Cyan = net energy gain, Coral = net energy loss |
| **Node size** | Pulses larger when more energy flows through |
| **Arrow direction** | Points in direction of energy flow |
| **Arrow length** | Proportional to transfer rate \|Pᵢⱼ\| |
| **Glow halo** | Intensity indicates relative power (normalized to max) |

### Glow Intensity Calculation

1. Compute edge power: $P_{ij} = A_{ij} \cdot x_i \cdot x_j$
2. Find maximum: $P_{max} = \max_{edges} |P_{ij}|$
3. Normalize: $\tilde{P}_{ij} = |P_{ij}| / P_{max}$ (range 0 to 1)
4. Glow opacity: $0.35 \times \tilde{P}_{ij}$ (max 30% opacity)

### Use Case
Understanding energy exchange dynamics. See which edges are "active" (transferring energy) and which are "quiet". Works on **any graph** - no partition required.

### Analogy
Like watching money being wired between bank accounts in real-time. The arrows show transfers, and the glow shows how large each transfer is relative to others.

---

## Energy Mode (Energy Storage)

Shows **where energy is stored** using the Hamiltonian decomposition into kinetic and potential energy.

### The Physics

For a physically realizable system with bipartite partition P (momentum nodes) and Q (displacement nodes):

**Kinetic Energy (T)**: Energy stored in momentum states
$$T = \frac{1}{2} \sum_{i \in P} x_i^2$$

**Potential Energy (V)**: Energy stored in displacement states  
$$V = \frac{1}{2} \sum_{i \in Q} x_i^2$$

**Total Hamiltonian**: Conserved quantity
$$H = T + V = \text{constant}$$

### The T ↔ V Oscillation

In Hamiltonian systems, energy continuously converts between kinetic and potential forms:
- When T > V: momentum nodes have more energy
- When V > T: displacement nodes have more energy
- The bars show this oscillation as percentages of total H

### Requires Valid Partition!

Energy mode **only works** when the graph has a valid bipartite partition. Use the **Auto** button in the Analyze tab to find one. Non-bipartite graphs (like odd cycles or Möbius-Kantor) cannot be decomposed this way.

### Visual Elements

| Element | Meaning |
|---------|---------|
| **Node color** | Orange = p-node (kinetic), Cyan = q-node (potential) |
| **Node glow** | Brightness proportional to energy stored in that node |
| **Node size** | Scales with individual node energy |
| **Arrows** | Static (default edge appearance) |
| **T bar** | Percentage of total energy that is kinetic |
| **V bar** | Percentage of total energy that is potential |
| **H bar** | Total energy (always 100%, should be constant) |
| **Flow indicator** | Shows current direction: T→V or V→T |

### Glow Boost Effect

Nodes get brighter when their "type" of energy dominates:
- When T > V: p-nodes (kinetic) glow brighter
- When V > T: q-nodes (potential) glow brighter

This creates a visual "breathing" effect across the graph as energy oscillates.

### Use Case
Understanding the port-Hamiltonian structure. See the fundamental T ↔ V energy exchange that characterizes physical oscillators (springs, LC circuits, etc.).

### Analogy
Like watching balances in checking (T) vs savings (V) accounts. The bars show how the total wealth is distributed, even though the total stays constant.

---

## Comparison: Power vs Energy

These modes answer **different questions**:

| Question | Mode | Answer |
|----------|------|--------|
| "Which edges are active right now?" | Power | Arrow glow shows transfer rates |
| "Who is gaining/losing energy?" | Power | Node colors (cyan/coral) |
| "How fast is energy moving on edge (i,j)?" | Power | Arrow length and glow |
| "How much energy is kinetic vs potential?" | Energy | T and V bars |
| "Which partition has more energy?" | Energy | Bar percentages, node glow |
| "Is energy being conserved?" | Both | ΔH or ΔE indicator |

### Key Distinction

- **Power Mode** = **Dynamics of transfer** (edge-centric)
  - Works on any graph
  - Shows real-time energy movement
  
- **Energy Mode** = **State of storage** (node-centric)
  - Requires bipartite partition
  - Shows T/V decomposition

---

## Technical Notes

### State Vector Normalization
The initial state vector is normalized to ||x||² = 4 (energy H = 2), providing consistent visualization across different graphs.

### Conservation Monitoring
Both modes display energy drift (ΔH or ΔE):
- < 0.1%: Green checkmark ✓ (conserved)
- ≥ 0.1%: Warning ⚠ (numerical drift)

The Rodrigues integrator (matrix exponential) provides exact energy conservation.

### Frame Rate
The animation runs at display refresh rate (typically 60 FPS) with configurable speed multiplier and integration time step.
