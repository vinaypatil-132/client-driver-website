@echo off
REM ==============================================================================
REM Windows Driver Installer Batch Launcher
REM Passes arguments directly to Powershell setup.ps1 script
REM ==============================================================================
setlocal enableextensions enabledelayedexpansion

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0setup.ps1" %*

exit /b %ERRORLEVEL%
