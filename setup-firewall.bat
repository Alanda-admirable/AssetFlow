@echo off
setlocal
cd /d "%~dp0"

:: Check for Administrator permissions
net session >nul 2>&1
if %errorlevel% neq 0 (
    echo [INFO] กำลังขอสิทธิ์ Administrator เพื่อปลดล็อก Firewall และตั้งค่า Private Network...
    powershell -NoProfile -ExecutionPolicy Bypass -Command "Start-Process cmd.exe -ArgumentList '/c \"\"%~dpnx0\"\"' -Verb RunAs"
    exit /b
)

echo =====================================================================
echo   AssetFlow - ปลดล็อก Windows Firewall และตั้งค่าเครือข่ายสำหรับ LAN
echo =====================================================================
echo.

REM 1. เปิดพอร์ต 3000 (Web App)
echo [1/4] กำลังเปิดพอร์ต 3000 (AssetFlow Web App)...
netsh advfirewall firewall delete rule name="AssetFlow-Web-3000" >nul 2>&1
netsh advfirewall firewall add rule name="AssetFlow-Web-3000" dir=in action=allow protocol=TCP localport=3000 profile=any >nul 2>&1

REM 2. เปิดพอร์ต 8090 (PocketBase Database)
echo [2/4] กำลังเปิดพอร์ต 8090 (PocketBase Engine)...
netsh advfirewall firewall delete rule name="AssetFlow-PocketBase-8090" >nul 2>&1
netsh advfirewall firewall add rule name="AssetFlow-PocketBase-8090" dir=in action=allow protocol=TCP localport=8090 profile=any >nul 2>&1

REM 3. เปิดการตอบสนอง Ping (ICMP) เพื่อให้เครื่องอื่นมองเห็นเครื่องนี้
echo [3/4] กำลังเปิดอนุญาตการเชื่อมต่อ ICMP (Ping Echo)...
netsh advfirewall firewall delete rule name="AssetFlow-ICMP" >nul 2>&1
netsh advfirewall firewall add rule name="AssetFlow-ICMP" dir=in action=allow protocol=icmpv4:8,any profile=any >nul 2>&1

REM 4. เปลี่ยนประเภทเครือข่าย (Ethernet / Wi-Fi) จาก Public เป็น Private
echo [4/4] กำลังเปลี่ยนสถานะเครือข่ายเป็น Private Network (เพื่อให้เครื่องอื่นเชื่อมต่อได้)...
powershell -NoProfile -ExecutionPolicy Bypass -Command "Get-NetConnectionProfile | Set-NetConnectionProfile -NetworkCategory Private -ErrorAction SilentlyContinue"

echo.
echo =====================================================================
echo   ✅ ปลดล็อกระบบเครือข่ายและ Firewall เรียบร้อยแล้ว!
echo   สามารถรัน start-lan.bat เพื่อเปิดใช้งานได้ทันที
echo =====================================================================
echo.
pause
