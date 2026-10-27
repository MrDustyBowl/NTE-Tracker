@echo off
setlocal
cd /d "%~dp0"
where node >nul 2>nul || (echo Install Node.js first: https://nodejs.org/ & pause & exit /b 1)
where cargo >nul 2>nul || (echo Install Rust first: https://rustup.rs/ & pause & exit /b 1)
echo Installing JavaScript dependencies...
call npm install --no-audit --no-fund || (echo NPM installation failed. & pause & exit /b 1)
echo Building NTE Tracker Windows installer...
call npm run tauri build || (echo Build failed. Check the messages above. & pause & exit /b 1)
echo.
echo Done. Windows installer folder:
echo %~dp0src-tauri\target\release\bundle\nsis\
start "" "%~dp0src-tauri\target\release\bundle\nsis\"
pause
