@echo off
echo Starting Graph Visualization Server...
echo.
echo Press Ctrl+C to stop the server when done.
echo.

REM Start Chrome with cache disabled for development
set CHROME_FLAGS=--disable-application-cache --disk-cache-size=0
set URL=http://localhost:8000

REM Try to open in Chrome (common installation paths)
start "" "C:\Program Files\Google\Chrome\Application\chrome.exe" %CHROME_FLAGS% %URL%
if %ERRORLEVEL% NEQ 0 (
    start "" "C:\Program Files (x86)\Google\Chrome\Application\chrome.exe" %CHROME_FLAGS% %URL%
)

python -m http.server 8000