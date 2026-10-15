@echo off
title FlowMonitor
cd /d "%~dp0"
where py >nul 2>nul
if %errorlevel%==0 (
  py flowmonitor.py %*
) else (
  python flowmonitor.py %*
)
pause
