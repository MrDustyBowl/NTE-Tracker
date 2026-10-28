@echo off
setlocal
cd /d "%~dp0"
echo Preparing NTE Tracker 2.0 while keeping your signing key...
node scripts\prepare-v2-live.cjs
if errorlevel 1 goto fail
echo.
echo Checking the shared game catalogue...
node test-catalog-v2.cjs
if errorlevel 1 goto fail
echo.
echo Done. Commit your changes on v2-development in GitHub Desktop.
pause
exit /b 0
:fail
echo.
echo Preparation failed. Do not push until you fix the error.
pause
exit /b 1
