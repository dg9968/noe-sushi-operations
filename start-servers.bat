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
start "API Server" cmd /k "cd /d api && npm start"

echo Waiting for API server to start...
timeout /t 3 /nobreak >nul

echo Starting Odoo Proxy Server (Port 3001)...
start "Odoo Proxy" cmd /k "npm start"

echo Waiting for proxy server to start...
timeout /t 3 /nobreak >nul

echo Starting React Frontend (Port 3000)...
start "React Frontend" cmd /k "cd /d noe-sushi-operations && npm start"

echo.
echo ✅ All servers starting up!
echo.
echo 🚀 API Server: http://localhost:5000
echo 🔗 Odoo Proxy: http://localhost:3001
echo 🌐 React App: http://localhost:3000
echo.
echo Press any key to exit this script (servers will continue running)...
pause >nul