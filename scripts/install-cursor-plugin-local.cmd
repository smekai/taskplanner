@echo off
setlocal EnableExtensions

set "REPO_ROOT=%~dp0.."
set "PLUGIN_SRC=%REPO_ROOT%\plugins\taskplanner"
set "PLUGIN_DEST=%USERPROFILE%\.cursor\plugins\taskplanner"
set "PLUGIN_DEST_LOCAL=%USERPROFILE%\.cursor\plugins\local\taskplanner"

echo [taskplanner] Building plugin artifacts...
pushd "%REPO_ROOT%"
call npm run build
if errorlevel 1 goto :fail
call npm run validate:cursor-plugin
if errorlevel 1 goto :fail
popd

echo [taskplanner] Removing old local installs...
if exist "%PLUGIN_DEST_LOCAL%" rmdir /s /q "%PLUGIN_DEST_LOCAL%"
if exist "%PLUGIN_DEST%" rmdir /s /q "%PLUGIN_DEST%"

echo [taskplanner] Copying plugin to %PLUGIN_DEST% ...
mkdir "%PLUGIN_DEST%"
xcopy /E /I /Y "%PLUGIN_SRC%" "%PLUGIN_DEST%"
if errorlevel 1 goto :fail

echo.
echo [taskplanner] Verifying install...
if not exist "%PLUGIN_DEST%\.cursor-plugin\plugin.json" (
  echo ERROR: plugin.json not found at plugin root.
  goto :fail
)
if not exist "%PLUGIN_DEST%\dist\mcp-server.js" (
  echo ERROR: dist\mcp-server.js not found.
  goto :fail
)
if not exist "%PLUGIN_DEST%\ui\board\index.html" (
  echo ERROR: ui\board\index.html not found.
  goto :fail
)

echo.
echo [taskplanner] Local plugin install complete.
echo.
echo Registering plugin metadata...
call "%~dp0register-cursor-plugin-local.cmd"
if errorlevel 1 goto :fail

echo.
echo Next steps:
echo   1. Ensure Cursor setting is ON:
echo      Include third-party Plugins, Skills, and other configs
echo   2. Fully restart Cursor (File -^> Exit, then reopen)
echo   3. Open Customize and check User scope for:
echo      - MCP: taskplanner
echo      - Skills: taskplanner
echo      - Rules: taskplanner-workflow
echo      - Commands: /list-tasks, /next-task, /continue-task
echo   4. In Agent chat, ask: open the visual task board
echo.
exit /b 0

:fail
echo [taskplanner] Install failed.
exit /b 1
