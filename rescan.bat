@echo off
chcp 65001 >nul
title 重新扫描画廊
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo [错误] 没找到 node。
  pause
  exit /b 1
)
node tools/scan-gallery.mjs
echo.
pause