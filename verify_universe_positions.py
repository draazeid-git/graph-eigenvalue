#!/usr/bin/env python3
"""
Universe Position Verification Script
=====================================
Verifies that graph positions match the pure absolute formula:
  X = n × 8
  Y = ρ × 15
  Z = (E - 8) × 8

Usage: python verify_universe_positions.py [exported_file.txt]
"""

import sys
import csv
import math
from collections import defaultdict

# Position formula constants (must match graph-universe.js)
N_SCALE = 8.0          # X = n × 8
RHO_SCALE = 15.0       # Y = ρ × 15  
ENERGY_SCALE = 8.0     # Z = (E - 8) × 8
ENERGY_CENTER = 8.0

def parse_csv_from_file(filepath):
    """Parse CSV data from exported Universe file."""
    graphs = []
    in_csv = False
    csv_lines = []
    
    with open(filepath, 'r') as f:
        for line in f:
            if '--- CSV FORMAT' in line:
                in_csv = True
                continue
            if in_csv and line.strip():
                csv_lines.append(line.strip())
    
    if not csv_lines:
        print("No CSV data found in file. Looking for raw CSV...")
        with open(filepath, 'r') as f:
            csv_lines = [line.strip() for line in f if line.strip()]
    
    if not csv_lines:
        return []
    
    # Parse CSV
    reader = csv.DictReader(csv_lines)
    for row in reader:
        try:
            graphs.append({
                'name': row.get('Name', ''),
                'family': row.get('Family', ''),
                'n': int(row.get('n', 0)),
                'edges': int(row.get('Edges', 0)),
                'spectralRadius': float(row.get('SpectralRadius', 0)),
                'energy': float(row.get('Energy', 0)),
                'x': float(row.get('X', 0)),
                'y': float(row.get('Y', 0)),
                'z': float(row.get('Z', 0)),
                'expectedX': float(row.get('ExpectedX', 0)) if 'ExpectedX' in row else None,
                'expectedY': float(row.get('ExpectedY', 0)) if 'ExpectedY' in row else None,
                'expectedZ': float(row.get('ExpectedZ', 0)) if 'ExpectedZ' in row else None,
            })
        except (ValueError, KeyError) as e:
            print(f"Warning: Could not parse row: {e}")
            continue
    
    return graphs

def compute_expected_position(graph):
    """Compute expected position from pure absolute formula."""
    n = graph['n']
    rho = graph['spectralRadius']
    energy = graph['energy']
    
    return (
        n * N_SCALE,
        rho * RHO_SCALE,
        (energy - ENERGY_CENTER) * ENERGY_SCALE
    )

def verify_positions(graphs):
    """Verify all graph positions."""
    print("\n" + "="*70)
    print("UNIVERSE POSITION VERIFICATION (Pure Absolute Positioning)")
    print("="*70)
    print(f"\nPosition Formula:")
    print(f"  X = n × {N_SCALE}")
    print(f"  Y = ρ × {RHO_SCALE}")
    print(f"  Z = (E - {ENERGY_CENTER}) × {ENERGY_SCALE}")
    print(f"\nTotal graphs: {len(graphs)}")
    
    discrepancies = []
    perfect = 0
    
    for g in graphs:
        exp_x, exp_y, exp_z = compute_expected_position(g)
        
        dx = abs(g['x'] - exp_x)
        dy = abs(g['y'] - exp_y)
        dz = abs(g['z'] - exp_z)
        dist = math.sqrt(dx*dx + dy*dy + dz*dz)
        
        if dist < 0.1:
            perfect += 1
        else:
            discrepancies.append({
                'name': g['name'],
                'family': g['family'],
                'n': g['n'],
                'rho': g['spectralRadius'],
                'energy': g['energy'],
                'expected': (exp_x, exp_y, exp_z),
                'actual': (g['x'], g['y'], g['z']),
                'distance': dist
            })
    
    print(f"\n✓ {perfect} graphs at correct positions")
    
    if discrepancies:
        print(f"✗ {len(discrepancies)} discrepancies found:\n")
        for d in discrepancies[:20]:  # Show first 20
            print(f"  {d['name']} [{d['family']}]")
            print(f"    n={d['n']}, ρ={d['rho']:.4f}, E={d['energy']:.2f}")
            print(f"    Expected: ({d['expected'][0]:.1f}, {d['expected'][1]:.1f}, {d['expected'][2]:.1f})")
            print(f"    Actual:   ({d['actual'][0]:.1f}, {d['actual'][1]:.1f}, {d['actual'][2]:.1f})")
            print(f"    Distance: {d['distance']:.1f} units")
        if len(discrepancies) > 20:
            print(f"\n  ... and {len(discrepancies) - 20} more")
    else:
        print("\n✓ All graphs positioned correctly!")
    
    print("="*70)
    
    return {
        'total': len(graphs),
        'correct': perfect,
        'discrepancies': discrepancies
    }

def main():
    if len(sys.argv) < 2:
        print("Usage: python verify_universe_positions.py <exported_file.txt>")
        print("\nThis script verifies that graph positions follow the pure absolute formula:")
        print("  X = n × 8")
        print("  Y = ρ × 15")
        print("  Z = (E - 8) × 8")
        sys.exit(1)
    
    filepath = sys.argv[1]
    print(f"Loading {filepath}...")
    
    graphs = parse_csv_from_file(filepath)
    
    if not graphs:
        print("No graphs found in file.")
        sys.exit(1)
    
    print(f"Loaded {len(graphs)} graphs")
    
    result = verify_positions(graphs)
    
    print(f"\nSummary: {result['correct']}/{result['total']} correct")

if __name__ == '__main__':
    main()
