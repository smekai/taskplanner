@echo off
setlocal EnableExtensions

set "PLUGIN_DEST=%USERPROFILE%\.cursor\plugins\taskplanner"

if not exist "%PLUGIN_DEST%\.cursor-plugin\plugin.json" (
  echo ERROR: Plugin not installed. Run scripts\install-cursor-plugin-local.cmd first.
  exit /b 1
)

node "%~dp0register-cursor-plugin-local.js"
if errorlevel 1 goto :fail

echo.
echo [taskplanner] Plugin registration updated.
echo Restart Cursor fully, then check Customize (User scope).
exit /b 0

:fail
echo [taskplanner] Registration failed.
exit /b 1
