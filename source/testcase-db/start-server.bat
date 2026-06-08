@echo off
:: Testcase DB Server — Startup Script
:: Run this script to start the DB server on prathosh-14802-t
:: The server will be available to the whole team at http://prathosh-14802-t:3000

cd /d "%~dp0"

echo Checking if Node.js is available...
node --version >nul 2>&1
if errorlevel 1 (
    echo ERROR: Node.js is not installed or not in PATH.
    echo Install Node.js from https://nodejs.org/ then re-run this script.
    pause
    exit /b 1
)

echo Installing dependencies if needed...
if not exist node_modules (
    npm install
)

echo.
echo ============================================================
echo  UEMS Testcase DB Server
echo  URL  : http://prathosh-14802-t:3000
echo  Viewer: http://prathosh-14802-t:3000/view
echo  Health: http://prathosh-14802-t:3000/health
echo ============================================================
echo.
echo Press Ctrl+C to stop the server.
echo.

node server.js
