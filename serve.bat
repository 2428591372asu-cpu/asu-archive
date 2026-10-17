@echo off
rem ============================================================
rem  A_SU ARCHIVE - local preview server
rem  Double-click this file, then the browser opens the site.
rem  Requirement: Python on PATH (python -m http.server).
rem ============================================================
cd /d "%~dp0"
start "" http://127.0.0.1:8777/index.html
python -m http.server 8777 --bind 127.0.0.1
pause
