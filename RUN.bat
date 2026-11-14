@echo off
title NASA Astera Watch - One-Click Launcher
set "ROOT_DIR=%~dp0"
set "CTL_SCRIPT=%ROOT_DIR%astera-wildfire-platform\scripts\launcher_ctl.ps1"
if not exist "%CTL_SCRIPT%" set "CTL_SCRIPT=%ROOT_DIR%scripts\launcher_ctl.ps1"
if not exist "%CTL_SCRIPT%" goto :missing_script
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%CTL_SCRIPT%" -Action Start %*
if errorlevel 1 goto :launch_failed
exit /b 0
:missing_script
echo [ERROR] Could not locate scripts\launcher_ctl.ps1 from "%ROOT_DIR%".
if "%~1"=="" pause
exit /b 1
:launch_failed
echo.
echo [ERROR] NASA Astera Watch failed to start.
if "%~1"=="" pause
exit /b 1
