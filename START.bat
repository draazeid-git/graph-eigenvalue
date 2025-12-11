@echo off
echo Starting Graph Visualization Server...
echo.
echo Press Ctrl+C to stop the server when done.
echo.

REM Try to open in Chrome (common installation paths)
start "" "C:\Program Files\Google\Chrome\Application\chrome.exe" http://localhost:8000
if %ERRORLEVEL% NEQ 0 (
    start "" "C:\Program Files (x86)\Google\Chrome\Application\chrome.exe" http://localhost:8000
)

python -m http.server 8000
