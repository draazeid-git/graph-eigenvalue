@echo off
echo ============================================================
echo   Graph Eigenvalue Visualization Server
echo   No-Cache Mode - Changes load automatically!
echo ============================================================
echo.

REM Open browser
start http://localhost:8000

REM Start server with no-cache headers
python server.py 8000
