@echo off
rem Stop Agent Arena: kill whatever is listening on port 3000
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :3000 ^| findstr LISTENING') do taskkill /f /pid %%a
echo Agent Arena stopped.
timeout /t 2 /nobreak >nul
