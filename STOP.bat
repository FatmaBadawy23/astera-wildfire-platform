@echo off
title NASA Astera Watch - Safe Shutdown
set "ROOT_DIR=%~dp0"
set "CTL_SCRIPT=%ROOT_DIR%astera-wildfire-platform\scripts\launcher_ctl.ps1"
if not exist "%CTL_SCRIPT%" set "CTL_SCRIPT=%ROOT_DIR%scripts\launcher_ctl.ps1"
if not exist "%CTL_SCRIPT%" goto :missing_script
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%CTL_SCRIPT%" -Action Stop %*
set "EXIT_CODE=%ERRORLEVEL%"
if "%~1"=="" pause
exit /b %EXIT_CODE%
:missing_script
echo [ERROR] Could not locate scripts\launcher_ctl.ps1 from "%ROOT_DIR%".
if "%~1"=="" pause
exit /b 1
