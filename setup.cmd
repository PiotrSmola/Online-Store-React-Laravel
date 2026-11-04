@echo off
rem Windows launcher for setup.ps1 (works without changing the PowerShell execution policy)
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0setup.ps1" %*
if errorlevel 1 pause
