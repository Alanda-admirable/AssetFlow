@echo off
cd /d "%~dp0"
chcp 65001 >nul
title AssetFlow - ล้างแคชและติดตั้งใหม่สำหรับเครื่องใหม่

echo =====================================================================
echo   AssetFlow - ล้างแคชและติดตั้งใหม่สำหรับเครื่องใหม่ (Clean Setup)
echo =====================================================================
echo.

echo [1/3] กำลังล้างแคชเก่า (.next)...
if exist ".next\" rmdir /s /q ".next"

echo [2/3] กำลังล้าง node_modules เก่า...
if exist "node_modules\" rmdir /s /q "node_modules"

echo [3/3] กำลังติดตั้ง Dependencies ใหม่ทั้งหมด...
call npm install

echo.
echo =====================================================================
echo   ✅ ติดตั้งและล้างแคชเรียบร้อยแล้ว!
echo   กำลังเริ่มรันระบบ AssetFlow...
echo =====================================================================
echo.
pause

call "%~dp0start-lan.bat"
