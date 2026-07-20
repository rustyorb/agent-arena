@echo off
rem Start Agent Arena: dev server minimized + browser
cd /d "%~dp0"
start "agent-arena" /min cmd /c "npm run dev"
timeout /t 4 /nobreak >nul
start http://localhost:3000
