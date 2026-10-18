@echo off
chcp 65001 >nul
title 文案编辑器 - A_SU ARCHIVE
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo [错误] 没找到 node。请先安装 Node.js，或者直接用 VS Code 改文件。
  pause
  exit /b 1
)

echo ============================================
echo   A_SU ARCHIVE - 文案编辑器
echo   启动前会先扫描一遍画廊文件夹
echo   改完点「保存到 data.js」，站点刷新即生效
echo   关闭这个窗口即停止
echo ============================================
echo.

node tools/scan-gallery.mjs
echo.

node tools/cms.mjs
pause