"""
Analytic Eigenvalue Graph Finder (Optimized Version)
===================================================
Finds non-isomorphic skew-symmetric graphs (up to n vertices) that have 
closed-form eigenvalue formulas.

Optimizations Implemented:
    1. Pre-Exclusion: Skips all known analytic families (Empty, Complete, Cycle, 
       Path, Star) to focus the search on novel structures.
    2. Irreducible Factor Degree Cutoff: Skips root-finding for any characteristic 
       polynomial that contains an irreducible factor of degree 5 or greater, 
       as these are not generally solvable by algebraic means (Abel-Ruffini theorem).
    3. Weisfeiler-Lehman Hashing: Robust isomorphism detection via NetworkX.

Usage:
    python find_analytic_graphs.py [n]
    python find_analytic_graphs.py --json [n]   # Output JSON only (for web integration)
    
    where n is the number of vertices (default: 5)

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
    sqrt, cos, sin, pi, I, Rational, nsimplify, sympify, factor_list, Abs
)
from sympy.core.numbers import Float
from sympy.polys.rootoftools import RootOf

# NetworkX for graph structure and isomorphism handling
import networkx as nx

# =====================================================
# CONFIGURATION
# =====================================================

# Known families that always have analytic eigenvalues (skip calculation)
KNOWN_ANALYTIC_FAMILIES = {
    "Empty graph", "Complete graph", "Cycle graph", "Path graph", "Star graph"
}

# Max degree for which a general polynomial is solvable in terms of radicals
# (Abel-Ruffini theorem)
MAX_ANALYTIC_DEGREE = 4 

# =====================================================
# GRAPH GENERATION & ISOMORPHISM FILTERING
# =====================================================

def generate_all_edge_sets(n):
    """
    Generate all possible undirected edge sets for n vertices.
    Yields: tuple of edges
    """
    possible_edges = [(i, j) for i in range(n) for j in range(i+1, n)]
    
    for r in range(len(possible_edges) + 1):
        for edge_set in combinations(possible_edges, r):
            yield edge_set


def get_networkx_graph(n, edges):
    """Create a NetworkX graph object."""
    G = nx.Graph()
    G.add_nodes_from(range(n))
    G.add_edges_from(edges)
    return G


def canonical_form_nx(n, edges):
    """Compute the NetworkX graph's canonical label string using WL hash."""
    G = get_networkx_graph(n, edges)
    return nx.algorithms.graph_hashing.weisfeiler_lehman_graph_hash(G)


def enumerate_unique_graphs(n, use_isomorphism_filter=True):
    """
    Generate unique graphs (up to isomorphism) for n vertices.
    Yields: (edges, canonical_form_key)
    """
    if not use_isomorphism_filter:
        for edges in generate_all_edge_sets(n):
            yield edges, None
        return
    
    seen = set()
    
    for edges in generate_all_edge_sets(n):
        canon = canonical_form_nx(n, edges)
        
        if canon not in seen:
            seen.add(canon)
            yield edges, canon


# =====================================================
# MATRIX AND POLYNOMIAL COMPUTATION
# =====================================================

def make_skew_symmetric_matrix(n, edges):
    """Create skew-symmetric adjacency matrix."""
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
    Returns factored sympy polynomial in x.
    """
    n = len(A)
    x = symbols('x')
    M = Matrix(A) - x * Matrix.eye(n)
    char_poly = M.det()
    # Factoring helps both root-finding and the degree cutoff check
    return factor(char_poly), x


# =====================================================
# EIGENVALUE ANALYSIS (WITH DEGREE CUTOFF)
# =====================================================

def check_degree_cutoff(char_poly, var):
    """
    Check if the polynomial contains an irreducible factor of degree > 4.
    If so, solving it is generally impossible in closed form (Abel-Ruffini).
    
    Returns: True if degree > MAX_ANALYTIC_DEGREE, False otherwise.
    """
    try:
        # Get a list of (irreducible factor, multiplicity)
        factors = factor_list(char_poly, var)[1]
        
        for factor_poly, _ in factors:
            if factor_poly.as_poly(var).degree() > MAX_ANALYTIC_DEGREE:
                return True
        return False
    except Exception:
        # If factoring fails, allow the more expensive root-finding to proceed
        return False


def find_eigenvalues(char_poly, var):
    """
    Find eigenvalues by solving characteristic polynomial.
    Returns dict: {eigenvalue: multiplicity}
    """
    try:
        eigs = roots(char_poly, var)
        return eigs
    except Exception:
        return None


def is_nice_closed_form(expr):
    """
    Check if an expression is a "nice" closed form.
    Accepts: exact algebraic forms (sqrt, trig, etc.)
    Rejects: Float approximations, RootOf/CRootOf placeholder solutions.
    """
    if expr is None:
        return False
    
    # Reject Floating Point Approximations
    if expr.has(Float):
        return False
    
    # Reject Unsolved Algebraic Forms (RootOf means SymPy couldn't solve)
    if expr.has(RootOf) or 'CRootOf' in str(expr):
        return False
        
    return True


def classify_eigenvalue(eig):
    """
    Classify an eigenvalue (skew-symmetric implies zero or pure imaginary).
    Returns: (category, display_string)
    """
    try:
        simp = simplify(eig)
        
        if simp == 0:
            return ('zero', '0')
        
        # Check if purely imaginary: simp / I should be real
        coeff = simp / I
        coeff_simp = simplify(coeff)
        
        if coeff_simp.is_real:
            abs_coeff = simplify(Abs(coeff_simp))
            return ('pure_imaginary', f'±{abs_coeff}i')
        else:
            return ('complex/error', str(simp))
        
    except:
        return ('unknown', str(eig))


def format_eigenvalue_for_js(eig):
    """
    Format eigenvalue for JavaScript consumption.
    Try to express in terms of sqrt, cos, sin, etc.
    """
    try:
        simp = simplify(eig)
        
        if simp == 0:
            return {'value': 0, 'formula': '0', 'type': 'zero'}
        
        # Extract imaginary coefficient
        coeff = simplify(simp / I)
        
        if coeff.is_real:
            # Try to nsimplify to find nice form
            nice = nsimplify(coeff, rational=False)
            
            # Check for sqrt patterns
            nice_str = str(nice)
            
            # Try to detect cos/sin patterns
            for k in range(1, 20):
                for n in range(k+1, 30):
                    test_cos = 2 * cos(pi * k / n)
                    test_sin = 2 * sin(pi * k / n)
                    
                    if abs(float(nice) - float(test_cos)) < 1e-10:
                        return {
                            'value': float(nice),
                            'formula': f'2cos({k}π/{n})',
                            'type': 'trig',
                            'k': k, 'n': n, 'func': 'cos'
                        }
                    if abs(float(nice) - float(test_sin)) < 1e-10:
                        return {
                            'value': float(nice),
                            'formula': f'2sin({k}π/{n})',
                            'type': 'trig',
                            'k': k, 'n': n, 'func': 'sin'
                        }
            
            # Check for sqrt patterns
            for base in range(1, 20):
                if abs(float(nice) - float(sqrt(base))) < 1e-10:
                    return {
                        'value': float(nice),
                        'formula': f'√{base}',
                        'type': 'sqrt',
                        'radicand': base
                    }
            
            return {
                'value': float(nice),
                'formula': nice_str,
                'type': 'algebraic'
            }
        
        return {'value': str(simp), 'formula': str(simp), 'type': 'complex'}
        
    except Exception as e:
        return {'value': str(eig), 'formula': str(eig), 'type': 'unknown', 'error': str(e)}


def analyze_eigenvalues(char_poly, x):
    """
    Analyze a polynomial for nice closed forms, applying the degree cutoff.
    """
    # OPTIMIZATION: Check for irreducible factors of degree > 4
    if check_degree_cutoff(char_poly, x):
        return {
            'all_analytic': False,
            'eigenvalues': [],
            'skipped_reason': f'irreducible_factor_degree>{MAX_ANALYTIC_DEGREE}',
            'summary': f'Skipped: Contains irreducible factor of degree > {MAX_ANALYTIC_DEGREE}'
        }

    # Proceed to root-finding
    eigs = find_eigenvalues(char_poly, x)
    
    if eigs is None:
        return {
            'all_analytic': False,
            'eigenvalues': [],
            'skipped_reason': 'solve_failed',
            'summary': 'Could not solve polynomial analytically'
        }
    
    results = []
    all_nice = True
    
    for eig, mult in eigs.items():
        is_nice = is_nice_closed_form(eig)
        category, nice_str = classify_eigenvalue(eig)
        js_format = format_eigenvalue_for_js(eig)
        
        if not is_nice:
            all_nice = False
        
        results.append({
            'raw': str(simplify(eig)),
            'multiplicity': int(mult),
            'category': category,
            'display': nice_str,
            'is_nice': is_nice,
            'js': js_format
        })
    
    # Create summary
    if all_nice:
        summary = 'All eigenvalues have closed forms'
    else:
        summary = 'Some eigenvalues lack closed forms (RootOf or Float)'
    
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
    Identify if the graph belongs to a known family.
    Returns (family_base_name, full_description) or (None, None)
    """
    G = get_networkx_graph(n, edges)
    m = G.number_of_edges()
    is_connected = nx.is_connected(G) if n > 0 else False
    degrees = sorted([d for _, d in G.degree()], reverse=True)
    
    # Empty graph
    if m == 0:
        return ("Empty graph", f"Empty graph E_{n}")
    
    # Complete graph
    if m == n * (n - 1) // 2:
        return ("Complete graph", f"Complete graph K_{n}")
    
    if is_connected:
        # Cycle
        if m == n and all(d == 2 for d in degrees):
            return ("Cycle graph", f"Cycle graph C_{n}")
        
        # Path
        if m == n - 1 and degrees == sorted([1, 1] + [2] * (n - 2), reverse=True):
            return ("Path graph", f"Path graph P_{n}")
        
        # Star
        if m == n - 1 and degrees == sorted([n - 1] + [1] * (n - 1), reverse=True):
            return ("Star graph", f"Star graph S_{n}")
        
        # Wheel (star + outer cycle)
        if m == 2 * (n - 1) and degrees[0] == n - 1:
            non_hub = degrees[1:]
            if all(d == 3 for d in non_hub):
                return ("Wheel graph", f"Wheel graph W_{n}")
        
        # Ladder
        if n % 2 == 0:
            rungs = n // 2
            expected_edges = 3 * rungs - 2  # 2*(rungs-1) + rungs
            if m == expected_edges and all(d in [2, 3] for d in degrees):
                return ("Ladder graph", f"Ladder graph L_{rungs}")
    
    # Regular graphs
    if len(set(degrees)) == 1 and degrees[0] > 0:
        return (None, f"{degrees[0]}-regular graph on {n} vertices")
    
    # Tree detection
    if is_connected and m == n - 1:
        return ("Tree", f"Tree on {n} vertices")
    
    return (None, None)


def edges_to_string(edges):
    """Convert edge list to readable string."""
    if not edges:
        return "∅ (no edges)"
    return ", ".join(f"{i}-{j}" for i, j in sorted(edges))


def edges_to_adjacency_matrix(n, edges):
    """Convert edges to adjacency matrix (for skew-symmetric)."""
    A = [[0] * n for _ in range(n)]
    for i, j in edges:
        if i < j:
            A[i][j] = 1
            A[j][i] = -1
        else:
            A[j][i] = 1
            A[i][j] = -1
    return A


# =====================================================
# MAIN ENUMERATION
# =====================================================

def find_analytic_graphs(n, verbose=True, include_known=False):
    """
    Find all graphs on n vertices with analytic eigenvalue formulas.
    
    Args:
        n: Number of vertices
        verbose: Print progress
        include_known: Include known analytic families in output
    
    Returns:
        List of result dictionaries
    """
    if verbose:
        print(f"\n{'='*60}")
        print(f"Searching for analytic eigenvalue graphs with n = {n} vertices")
        print(f"{'='*60}\n")
    
    # Statistics
    graphs_total = 0
    graphs_skipped_known = 0
    graphs_skipped_poly = 0
    
    poly_groups = defaultdict(list)
    known_family_results = []
    start_time = time.time()
    
    # Pass 1: Generate and filter
    for edges, canon in enumerate_unique_graphs(n, use_isomorphism_filter=True):
        graphs_total += 1
        family_base, family_desc = identify_graph_family(n, edges)
        
        graph_data = {
            'edges': edges,
            'family_base': family_base,
            'family': family_desc,
            'canon': canon
        }
        
        # Check if known analytic family
        if family_base in KNOWN_ANALYTIC_FAMILIES:
            graphs_skipped_known += 1
            if include_known:
                known_family_results.append(graph_data)
            continue
        
        # Compute polynomial and group by it
        A = make_skew_symmetric_matrix(n, edges)
        char_poly, var = compute_characteristic_polynomial(A)
        poly_str = str(char_poly)
        
        graph_data['polynomial'] = poly_str
        poly_groups[poly_str].append(graph_data)

    if verbose:
        print(f"Total unique graphs: {graphs_total}")
        print(f"Skipped {graphs_skipped_known} known analytic families")
        print(f"Unique polynomials to analyze: {len(poly_groups)}\n")
    
    # Pass 2: Analyze unique polynomials
    results = []
    x = symbols('x')
    
    for poly_str, graphs in poly_groups.items():
        char_poly = sympify(poly_str)
        
        analysis = analyze_eigenvalues(char_poly, x)
        
        if analysis.get('skipped_reason'):
            graphs_skipped_poly += len(graphs)
            continue
            
        if analysis['all_analytic']:
            rep = graphs[0]
            
            result = {
                'n': n,
                'edges': [list(e) for e in rep['edges']],
                'edge_string': edges_to_string(rep['edges']),
                'edge_count': len(rep['edges']),
                'adjacency_matrix': edges_to_adjacency_matrix(n, rep['edges']),
                'polynomial': poly_str,
                'eigenvalues': analysis['eigenvalues'],
                'family': rep['family'],
                'isomorphism_class_size': len(graphs)
            }
            results.append(result)
    
    # Add known families if requested
    if include_known:
        for graph_data in known_family_results:
            A = make_skew_symmetric_matrix(n, graph_data['edges'])
            char_poly, var = compute_characteristic_polynomial(A)
            analysis = analyze_eigenvalues(char_poly, x)
            
            result = {
                'n': n,
                'edges': [list(e) for e in graph_data['edges']],
                'edge_string': edges_to_string(graph_data['edges']),
                'edge_count': len(graph_data['edges']),
                'adjacency_matrix': edges_to_adjacency_matrix(n, graph_data['edges']),
                'polynomial': str(char_poly),
                'eigenvalues': analysis.get('eigenvalues', []),
                'family': graph_data['family'],
                'known_family': True,
                'isomorphism_class_size': 1
            }
            results.append(result)
    
    if verbose:
        elapsed = time.time() - start_time
        print(f"Skipped {graphs_skipped_poly} graphs (irreducible degree > {MAX_ANALYTIC_DEGREE})")
        print(f"Time: {elapsed:.2f}s\n")
        print(f"Found {len(results)} non-isomorphic graphs with analytic eigenvalues")
    
    # Sort by edge count
    results.sort(key=lambda x: (x['edge_count'], x.get('polynomial', '')))
    
    return results


def print_results(results):
    """Pretty-print the results."""
    print("\n" + "="*70)
    print("GRAPHS WITH ANALYTIC EIGENVALUES")
    print("="*70)
    
    for i, r in enumerate(results, 1):
        print(f"\n[{i}] ", end="")
        if r.get('family'):
            print(f"{r['family']}")
        else:
            print(f"Graph on {r['n']} vertices")
        
        print(f"    Edges: {r['edge_string']}")
        print(f"    |E| = {r['edge_count']}, isomorphism class size = {r.get('isomorphism_class_size', 1)}")
        print(f"    Characteristic polynomial: {r['polynomial']}")
        print(f"    Eigenvalues:")
        
        for eig in r.get('eigenvalues', []):
            mult_str = f" (mult. {eig['multiplicity']})" if eig['multiplicity'] > 1 else ""
            js = eig.get('js', {})
            formula = js.get('formula', eig.get('display', eig.get('raw', '?')))
            print(f"        λ = {formula}{mult_str}")
    
    print("\n" + "="*70)
    print(f"Total: {len(results)} graphs with analytic eigenvalues")
    print("="*70)


def save_results(results, filename):
    """Save results to JSON file."""
    with open(filename, 'w') as f:
        json.dump(results, f, indent=2)
    print(f"\nResults saved to {filename}")


# =====================================================
# WEB API MODE (for integration with server.py)
# =====================================================

def json_mode(n):
    """Output JSON only, for web integration."""
    results = find_analytic_graphs(n, verbose=False, include_known=True)
    print(json.dumps(results, indent=2))


# =====================================================
# INTERACTIVE MODE
# =====================================================

def interactive_mode():
    """Run in interactive mode, prompting for input."""
    print("\n" + "="*60)
    print("ANALYTIC EIGENVALUE GRAPH FINDER")
    print("="*60)
    print(f"\nUsing Abel-Ruffini cutoff: degree > {MAX_ANALYTIC_DEGREE} skipped")
    
    while True:
        try:
            n_input = input("\nEnter number of vertices (2-8, or 'q' to quit): ").strip()
            
            if n_input.lower() == 'q':
                print("Goodbye!")
                break
            
            n = int(n_input)
            
            if n < 2:
                print("Need at least 2 vertices!")
                continue
            
            if n > 8:
                confirm = input(f"n={n} will be slow. Continue? (y/n): ")
                if confirm.lower() != 'y':
                    continue
            
            results = find_analytic_graphs(n, verbose=True)
            print_results(results)
            
            save_opt = input("\nSave results to JSON? (y/n): ").strip().lower()
            if save_opt == 'y':
                filename = f"analytic_graphs_n{n}.json"
                save_results(results, filename)
            
        except ValueError:
            print("Please enter a valid integer.")
        except KeyboardInterrupt:
            print("\n\nInterrupted. Goodbye!")
            break
        except Exception as e:
            print(f"\nError: {e}")
            import traceback
            traceback.print_exc()


# =====================================================
# MAIN
# =====================================================

def main():
    """Main entry point."""
    if len(sys.argv) > 1:
        if sys.argv[1] == '--json':
            # JSON mode for web integration
            n = int(sys.argv[2]) if len(sys.argv) > 2 else 5
            json_mode(n)
        else:
            # Command line mode
            try:
                n = int(sys.argv[1])
                results = find_analytic_graphs(n, verbose=True)
                print_results(results)
                
                filename = f"analytic_graphs_n{n}.json"
                save_results(results, filename)
                
            except ValueError:
                print(f"Error: '{sys.argv[1]}' is not a valid integer")
                print("Usage: python find_analytic_graphs.py [n]")
                print("       python find_analytic_graphs.py --json [n]")
                sys.exit(1)
    else:
        interactive_mode()


if __name__ == "__main__":
    main()
