@echo off
chcp 65001 >nul
title TERMINAL CASINO - OFFLINE
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0offline-launcher.ps1" %*
if errorlevel 1 (
  echo.
  echo The game could not start. Keep this window open and report the error above.
  pause
)
