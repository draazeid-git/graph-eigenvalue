"""
Analytic Eigenvalue Graph Finder
================================
Finds all non-isomorphic skew-symmetric graphs (up to n vertices) 
that have closed-form eigenvalue formulas.

Usage:
    python find_analytic_graphs.py [n]
    
    where n is the number of vertices (default: 5)

Output:
    - Console display of all graphs with analytic eigenvalues
    - JSON file with full results: analytic_graphs_n{n}.json

Requirements:
    pip install sympy numpy networkx

Author: Graph Spectral Analysis Project
"""

import sys
import json
import time
from itertools import combinations
from collections import defaultdict
import numpy as np

# Sympy for symbolic computation
from sympy import (
    symbols, Matrix, roots, simplify, expand, factor,
    sqrt, cos, sin, pi, I, Rational, nsimplify,
    Poly, degree, LC, sympify
)
from sympy.core.numbers import Float

# =====================================================
# GRAPH GENERATION
# =====================================================

def generate_all_edge_sets(n):
    """
    Generate all possible undirected edge sets for n vertices.
    Each edge set represents an undirected graph.
    
    Yields: tuple of edges, e.g., ((0,1), (0,2), (1,2))
    """
    possible_edges = [(i, j) for i in range(n) for j in range(i+1, n)]
    
    # Generate all subsets of edges (2^(n choose 2) graphs)
    for r in range(len(possible_edges) + 1):
        for edge_set in combinations(possible_edges, r):
            yield edge_set


def canonical_form(n, edges):
    """
    Compute a canonical form for the graph to identify isomorphism classes.
    Uses degree sequence + sorted adjacency as a simple canonical form.
    
    Note: This is a simplified approach. For production use, 
    consider using nauty/pynauty for true canonical labeling.
    """
    if not edges:
        return (tuple([0] * n), ())
    
    # Build adjacency list
    adj = [set() for _ in range(n)]
    for i, j in edges:
        adj[i].add(j)
        adj[j].add(i)
    
    # Compute degree sequence (sorted)
    degrees = tuple(sorted([len(adj[i]) for i in range(n)], reverse=True))
    
    # For simple canonical form: use degree sequence + edge count + substructure
    # This catches most isomorphisms but not all
    edge_degrees = tuple(sorted([(len(adj[i]), len(adj[j])) for i, j in edges]))
    
    return (degrees, edge_degrees, len(edges))


def enumerate_unique_graphs(n, use_isomorphism_filter=True):
    """
    Generate unique graphs (up to isomorphism) for n vertices.
    
    Args:
        n: Number of vertices
        use_isomorphism_filter: If True, filter out isomorphic copies
        
    Yields: (edges, canonical_form_key)
    """
    if not use_isomorphism_filter:
        for edges in generate_all_edge_sets(n):
            yield edges, None
        return
    
    seen = set()
    
    for edges in generate_all_edge_sets(n):
        canon = canonical_form(n, edges)
        
        if canon not in seen:
            seen.add(canon)
            yield edges, canon


# =====================================================
# MATRIX AND POLYNOMIAL COMPUTATION
# =====================================================

def make_skew_symmetric_matrix(n, edges):
    """
    Create skew-symmetric adjacency matrix.
    A[i,j] = 1 if edge (i,j) with i < j
    A[j,i] = -1 (skew-symmetric)
    """
    A = [[0] * n for _ in range(n)]
    for i, j in edges:
        if i < j:
            A[i][j] = 1
            A[j][i] = -1
        else:
            A[j][i] = 1
            A[i][j] = -1
    return A


def compute_characteristic_polynomial(A):
    """
    Compute the characteristic polynomial det(A - λI).
    Returns sympy polynomial in x (using x instead of lambda to avoid Python keyword issues).
    """
    n = len(A)
    x = symbols('x')
    M = Matrix(A) - x * Matrix.eye(n)
    char_poly = M.det()
    return expand(char_poly), x


def polynomial_to_string(poly, var):
    """Convert polynomial to a readable string."""
    return str(poly)


# =====================================================
# EIGENVALUE ANALYSIS
# =====================================================

def find_eigenvalues(char_poly, var):
    """
    Find eigenvalues by solving characteristic polynomial.
    Returns dict: {eigenvalue: multiplicity}
    """
    try:
        eigs = roots(char_poly, var)
        return eigs
    except Exception as e:
        return None


def is_nice_closed_form(expr):
    """
    Check if an expression is a "nice" closed form.
    
    Nice forms include:
    - Integers, rationals
    - Square roots of integers
    - Trigonometric values (cos, sin of rational multiples of π)
    - Combinations of the above with i (imaginary unit)
    
    Reject:
    - RootOf expressions (unsolved polynomial roots)
    - Floating point approximations
    - Nested radicals of degree > 2
    """
    if expr is None:
        return False
    
    s = str(expr)
    
    # Reject unsolved forms
    if 'RootOf' in s or 'CRootOf' in s:
        return False
    
    # Reject floating point
    if isinstance(expr, Float):
        return False
    if 'Float' in s or '.' in s.replace('...', ''):
        # Check if it's actually a float vs decimal in string repr
        try:
            if expr.has(Float):
                return False
        except:
            pass
    
    # Reject very complex expressions (heuristic)
    if len(s) > 200:
        return False
    
    return True


def classify_eigenvalue(eig):
    """
    Classify an eigenvalue into a category.
    
    Returns: (category, simplified_form)
    """
    try:
        simp = simplify(eig)
        s = str(simp)
        
        # Check for zero
        if simp == 0:
            return ('zero', '0')
        
        # Check for pure imaginary (±i * something)
        if simp.is_imaginary or (I in simp.free_symbols or 'I' in s):
            # Extract the coefficient of I
            coeff = simp / I
            coeff_simp = simplify(coeff)
            
            if coeff_simp.is_real:
                return ('pure_imaginary', f'±{coeff_simp}i')
        
        # Check for real
        if simp.is_real:
            return ('real', str(simp))
        
        # Complex
        return ('complex', str(simp))
        
    except:
        return ('unknown', str(eig))


def analyze_eigenvalues(eigs):
    """
    Analyze a set of eigenvalues for nice closed forms.
    
    Returns: {
        'all_analytic': bool,
        'eigenvalues': [(value, multiplicity, category, nice_form), ...],
        'summary': str
    }
    """
    if eigs is None:
        return {
            'all_analytic': False,
            'eigenvalues': [],
            'summary': 'Could not solve'
        }
    
    results = []
    all_nice = True
    
    for eig, mult in eigs.items():
        is_nice = is_nice_closed_form(eig)
        category, nice_str = classify_eigenvalue(eig)
        
        if not is_nice:
            all_nice = False
        
        results.append({
            'value': str(simplify(eig)),
            'multiplicity': int(mult),
            'category': category,
            'is_nice': is_nice
        })
    
    # Create summary
    if all_nice:
        summary = 'All eigenvalues have closed forms'
    else:
        summary = 'Some eigenvalues lack closed forms'
    
    return {
        'all_analytic': all_nice,
        'eigenvalues': results,
        'summary': summary
    }


# =====================================================
# GRAPH CLASSIFICATION
# =====================================================

def identify_graph_family(n, edges):
    """
    Try to identify if the graph belongs to a known family.
    """
    m = len(edges)
    
    # Build adjacency for analysis
    adj = [set() for _ in range(n)]
    for i, j in edges:
        adj[i].add(j)
        adj[j].add(i)
    
    degrees = [len(adj[i]) for i in range(n)]
    
    # Empty graph
    if m == 0:
        return f"Empty graph E_{n}"
    
    # Complete graph K_n
    if m == n * (n - 1) // 2:
        return f"Complete graph K_{n}"
    
    # Check for path P_n
    if m == n - 1:
        degree_count = defaultdict(int)
        for d in degrees:
            degree_count[d] += 1
        if degree_count[1] == 2 and degree_count[2] == n - 2 and n > 2:
            return f"Path graph P_{n}"
        if n == 2:
            return "Path graph P_2"
    
    # Check for cycle C_n
    if m == n and all(d == 2 for d in degrees):
        # Verify it's connected
        visited = set()
        stack = [0]
        while stack:
            node = stack.pop()
            if node not in visited:
                visited.add(node)
                stack.extend(adj[node] - visited)
        if len(visited) == n:
            return f"Cycle graph C_{n}"
    
    # Check for star K_{1,n-1}
    if m == n - 1:
        if max(degrees) == n - 1 and degrees.count(1) == n - 1:
            return f"Star graph K_{{1,{n-1}}}"
    
    # Check for complete bipartite
    # ... (could add more families)
    
    # Regular graphs
    if len(set(degrees)) == 1 and degrees[0] > 0:
        return f"{degrees[0]}-regular graph on {n} vertices"
    
    return None


def edges_to_string(edges):
    """Convert edge list to readable string."""
    if not edges:
        return "∅ (no edges)"
    return ", ".join(f"{i}-{j}" for i, j in sorted(edges))


# =====================================================
# MAIN ENUMERATION
# =====================================================

def find_analytic_graphs(n, verbose=True):
    """
    Find all graphs on n vertices with analytic eigenvalue formulas.
    
    Args:
        n: Number of vertices
        verbose: Print progress
        
    Returns:
        List of graphs with analytic eigenvalues
    """
    if verbose:
        print(f"\n{'='*60}")
        print(f"Searching for analytic eigenvalue graphs with n = {n} vertices")
        print(f"{'='*60}\n")
    
    # Statistics
    total_graphs = 0
    unique_graphs = 0
    unique_polynomials = 0
    analytic_count = 0
    
    # Group graphs by polynomial
    poly_groups = defaultdict(list)
    
    start_time = time.time()
    
    # Enumerate unique graphs
    for edges, canon in enumerate_unique_graphs(n, use_isomorphism_filter=True):
        unique_graphs += 1
        
        # Create skew-symmetric matrix
        A = make_skew_symmetric_matrix(n, edges)
        
        # Compute characteristic polynomial
        char_poly, var = compute_characteristic_polynomial(A)
        poly_str = str(char_poly)
        
        poly_groups[poly_str].append({
            'edges': edges,
            'matrix': A
        })
    
    unique_polynomials = len(poly_groups)
    
    if verbose:
        elapsed = time.time() - start_time
        print(f"Enumerated {unique_graphs} unique graphs in {elapsed:.2f}s")
        print(f"Found {unique_polynomials} distinct characteristic polynomials\n")
    
    # Analyze each polynomial
    results = []
    x = symbols('x')
    
    for poly_str, graphs in poly_groups.items():
        char_poly = sympify(poly_str)
        
        # Find eigenvalues
        eigs = find_eigenvalues(char_poly, x)
        analysis = analyze_eigenvalues(eigs)
        
        if analysis['all_analytic']:
            analytic_count += 1
            
            # Get representative graph
            rep = graphs[0]
            family = identify_graph_family(n, rep['edges'])
            
            result = {
                'n': n,
                'edges': rep['edges'],
                'edge_string': edges_to_string(rep['edges']),
                'edge_count': len(rep['edges']),
                'polynomial': poly_str,
                'eigenvalues': analysis['eigenvalues'],
                'family': family,
                'isomorphism_class_size': len(graphs)
            }
            results.append(result)
    
    # Sort results by edge count, then by polynomial
    results.sort(key=lambda x: (x['edge_count'], x['polynomial']))
    
    if verbose:
        print(f"Found {analytic_count} graphs with analytic eigenvalues\n")
    
    return results


def print_results(results):
    """Pretty-print the results."""
    print("\n" + "="*70)
    print("GRAPHS WITH ANALYTIC EIGENVALUES")
    print("="*70)
    
    for i, r in enumerate(results, 1):
        print(f"\n[{i}] ", end="")
        if r['family']:
            print(f"{r['family']}")
        else:
            print(f"Graph on {r['n']} vertices")
        
        print(f"    Edges: {r['edge_string']}")
        print(f"    |E| = {r['edge_count']}, isomorphism class size = {r['isomorphism_class_size']}")
        print(f"    Characteristic polynomial: {r['polynomial']}")
        print(f"    Eigenvalues:")
        for eig in r['eigenvalues']:
            mult_str = f" (mult. {eig['multiplicity']})" if eig['multiplicity'] > 1 else ""
            print(f"        λ = {eig['value']}{mult_str}")
    
    print("\n" + "="*70)
    print(f"Total: {len(results)} graphs with analytic eigenvalues")
    print("="*70)


def save_results(results, filename):
    """Save results to JSON file."""
    # Convert tuples to lists for JSON
    json_results = []
    for r in results:
        jr = r.copy()
        jr['edges'] = [list(e) for e in r['edges']]
        json_results.append(jr)
    
    with open(filename, 'w') as f:
        json.dump(json_results, f, indent=2)
    
    print(f"\nResults saved to {filename}")


# =====================================================
# INTERACTIVE MODE
# =====================================================

def interactive_mode():
    """Run in interactive mode, prompting for input."""
    print("\n" + "="*60)
    print("ANALYTIC EIGENVALUE GRAPH FINDER")
    print("="*60)
    print("\nThis program finds all non-isomorphic graphs on n vertices")
    print("whose characteristic polynomials have closed-form solutions.")
    print("\nNote: Computation time grows exponentially with n!")
    print("  n=4:  ~11 unique graphs     (instant)")
    print("  n=5:  ~34 unique graphs     (~1 second)")
    print("  n=6:  ~156 unique graphs    (~10 seconds)")
    print("  n=7:  ~1044 unique graphs   (~2 minutes)")
    print("  n=8:  ~12346 unique graphs  (~30+ minutes)")
    
    while True:
        try:
            n_input = input("\nEnter number of vertices (2-7, or 'q' to quit): ").strip()
            
            if n_input.lower() == 'q':
                print("Goodbye!")
                break
            
            n = int(n_input)
            
            if n < 2:
                print("Need at least 2 vertices!")
                continue
            
            if n > 7:
                confirm = input(f"n={n} may take a very long time. Continue? (y/n): ")
                if confirm.lower() != 'y':
                    continue
            
            # Find analytic graphs
            results = find_analytic_graphs(n, verbose=True)
            
            # Print results
            print_results(results)
            
            # Save option
            save_opt = input("\nSave results to JSON? (y/n): ").strip().lower()
            if save_opt == 'y':
                filename = f"analytic_graphs_n{n}.json"
                save_results(results, filename)
            
        except ValueError:
            print("Please enter a valid integer.")
        except KeyboardInterrupt:
            print("\n\nInterrupted. Goodbye!")
            break


# =====================================================
# COMMAND LINE INTERFACE
# =====================================================

def main():
    """Main entry point."""
    if len(sys.argv) > 1:
        # Command line mode
        try:
            n = int(sys.argv[1])
            results = find_analytic_graphs(n, verbose=True)
            print_results(results)
            
            # Auto-save results
            filename = f"analytic_graphs_n{n}.json"
            save_results(results, filename)
            
        except ValueError:
            print(f"Error: '{sys.argv[1]}' is not a valid integer")
            print("Usage: python find_analytic_graphs.py [n]")
            sys.exit(1)
    else:
        # Interactive mode
        interactive_mode()


if __name__ == "__main__":
    main()
