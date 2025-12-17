#!/usr/bin/env python3
"""
Simple HTTP server with no-cache headers.
Prevents browser caching during development.
"""

import http.server
import socketserver
import sys

PORT = 8000

class NoCacheHTTPRequestHandler(http.server.SimpleHTTPRequestHandler):
    """HTTP request handler with no-cache headers."""
    
    def end_headers(self):
        # Add no-cache headers to every response
        self.send_header('Cache-Control', 'no-cache, no-store, must-revalidate')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Expires', '0')
        super().end_headers()
    
    def log_message(self, format, *args):
        # Cleaner log output
        print(f"[{self.log_date_time_string()}] {args[0]}")

if __name__ == '__main__':
    if len(sys.argv) > 1:
        PORT = int(sys.argv[1])
    
    with socketserver.TCPServer(("", PORT), NoCacheHTTPRequestHandler) as httpd:
        print(f"╔══════════════════════════════════════════════════════════╗")
        print(f"║  Graph Eigenvalue Visualization Server                   ║")
        print(f"║  http://localhost:{PORT:<5}                                 ║")
        print(f"║                                                          ║")
        print(f"║  ✓ No-cache headers enabled (auto-refresh)               ║")
        print(f"║  Press Ctrl+C to stop                                    ║")
        print(f"╚══════════════════════════════════════════════════════════╝")
        print()
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nServer stopped.")
