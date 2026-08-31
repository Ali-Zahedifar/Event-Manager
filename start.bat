@echo off
setlocal
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  if exist "C:\Program Files\nodejs\node.exe" (
    set "NODE_CMD=C:\Program Files\nodejs\node.exe"
  ) else (
    echo Node.js was not found. Please install Node.js LTS from https://nodejs.org
    pause
    exit /b 1
  )
) else (
  set "NODE_CMD=node"
)

echo Starting Event Manager...
echo Open http://localhost:3000 in your browser if it does not open automatically.
start "" cmd /c "timeout /t 2 /nobreak >nul & start "" http://localhost:3000"
%NODE_CMD% server.js

pause
