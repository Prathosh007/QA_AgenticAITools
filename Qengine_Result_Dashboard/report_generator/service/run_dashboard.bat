@echo off
REM ============================================================
REM  Launches the QEngine dashboard service with file logging.
REM  Usage: run_dashboard.bat [full\path\to\python.exe]
REM  (the installer passes the resolved python path as arg 1)
REM ============================================================
setlocal
REM Project root = two levels up from this script (report_generator\service\..\..)
set "PROJ=%~dp0..\.."
set "PY=%~1"
if "%PY%"=="" set "PY=python"

cd /d "%PROJ%"
if not exist "logs" mkdir "logs"

echo. >> "logs\service.log"
echo [%date% %time%] Starting QEngine dashboard service with "%PY%" >> "logs\service.log"
"%PY%" -m report_generator.server >> "logs\service.log" 2>&1

echo [%date% %time%] Service process exited with code %ERRORLEVEL% >> "logs\service.log"
endlocal
