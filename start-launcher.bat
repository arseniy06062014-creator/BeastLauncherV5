@echo off
cd /d "%~dp0"
if not exist node_modules (
  echo First run: installing dependencies...
  call npm install
  if errorlevel 1 goto fail
)
echo Starting BeastLauncher...
call npm run electron:start
if errorlevel 1 goto fail
exit /b 0
:fail
echo Failed. Check the errors above.
pause
exit /b 1
