@echo off
echo Starting Noe Operations Servers...
echo.

REM Kill any existing processes on the ports we use
echo Killing existing processes on ports 3000, 3001, 5000...
for /f "tokens=5" %%a in ('netstat -aon ^| find ":3000" ^| find "LISTENING"') do taskkill /f /pid %%a 2>nul
for /f "tokens=5" %%a in ('netstat -aon ^| find ":3001" ^| find "LISTENING"') do taskkill /f /pid %%a 2>nul
for /f "tokens=5" %%a in ('netstat -aon ^| find ":5000" ^| find "LISTENING"') do taskkill /f /pid %%a 2>nul
echo.

REM Wait a moment for processes to fully terminate
timeout /t 2 /nobreak >nul

echo Starting API Server (Port 5000)...
start "API Server (TypeScript)" cmd /k "cd /d packages\server && npm run dev"

echo Waiting for API server to start...
timeout /t 3 /nobreak >nul

echo Starting Odoo Proxy Server (Port 3001)...
start "Odoo Proxy (Bun)" cmd /k "bun start"

echo Waiting for proxy server to start...
timeout /t 3 /nobreak >nul

echo Starting Vite Frontend (Port 3000)...
start "Vite Frontend" cmd /k "cd /d packages\client && npm run dev"

echo.
echo ✅ All servers starting up!
echo.
echo 🚀 API Server (TypeScript): http://localhost:5000
echo 🔗 Odoo Proxy (Bun): http://localhost:3001
echo ⚡ Vite Frontend: http://localhost:3000
echo.
echo Press any key to exit this script (servers will continue running)...
pause >nul