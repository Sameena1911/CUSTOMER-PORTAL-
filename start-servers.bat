@echo off
echo Starting PORTAL1 Customer Portal...
echo.

echo Starting Backend Server...
start "Backend Server" cmd /k "cd backend && node index.js"

timeout /t 3 /nobreak >nul

echo Starting Frontend Development Server...
start "Frontend Server" cmd /k "cd frontend && ng serve"

echo.
echo Both servers are starting...
echo Backend: http://localhost:3000
echo Frontend: http://localhost:4200
echo.
pause
