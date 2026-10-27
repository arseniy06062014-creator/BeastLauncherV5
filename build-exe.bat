@echo off
echo Installing dependencies...
call npm install
if errorlevel 1 goto fail
echo Building BeastLauncher.exe...
call npm run build:win
if errorlevel 1 goto fail
echo.
echo Done! Your exe is in the "release" folder.
pause
exit /b 0
:fail
echo Build failed. Check the errors above.
pause
exit /b 1
