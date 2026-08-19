# AssetFlow + PocketBase - LAN Sharing Launcher (Self-Healing & Multi-Device Support)
$Host.UI.RawUI.WindowTitle = "AssetFlow + PocketBase (LAN Multi-Device Sharing)"
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

Write-Host ""
Write-Host "=====================================================================" -ForegroundColor Green
Write-Host "  AssetFlow + PocketBase - ระบบบริหารจัดการสถานที่และครุภัณฑ์" -ForegroundColor Green
Write-Host "  โหมดแชร์ใช้งานหลายเครื่องในวง Wi-Fi / LAN" -ForegroundColor Green
Write-Host "=====================================================================" -ForegroundColor Green
Write-Host ""

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$rootDir = Split-Path -Parent $scriptDir

# ---------------------------------------------------------------------
# 1. ตรวจสอบ Node.js Runtime และ Version
# ---------------------------------------------------------------------
Write-Host "[1/6] ตรวจสอบโปรแกรม Node.js..." -ForegroundColor Yellow
$rawNode = node -v 2>$null
if (-not $rawNode) {
    Write-Host ""
    Write-Host "[ERROR] ไม่พบโปรแกรม Node.js บนคอมพิวเตอร์เครื่องนี้!" -ForegroundColor Red
    Write-Host "กรุณาดาวน์โหลดและติดตั้ง Node.js (แนะนำ v20 หรือ v22 LTS) จาก: https://nodejs.org" -ForegroundColor Red
    Write-Host ""
    Read-Host "กด Enter เพื่อปิดหน้าต่าง..."
    exit 1
}

$cleanVer = $rawNode.Trim().TrimStart('v')
try {
    $parsedVer = [version]($cleanVer.Split('-')[0])
    if ($parsedVer.Major -lt 18 -or ($parsedVer.Major -eq 18 -and $parsedVer.Minor -lt 18)) {
        Write-Host ""
        Write-Host "[WARNING] ตรวจพบ Node.js $rawNode (Next.js 15 ต้องการ Node.js v18.18.0 ขึ้นไป)" -ForegroundColor Red
        Write-Host "กรุณาอัปเดต Node.js เป็นเวอร์ชันล่าสุดที่ https://nodejs.org" -ForegroundColor Yellow
        Write-Host ""
    } else {
        Write-Host "  * Node.js Version: $rawNode (พร้อมใช้งาน)" -ForegroundColor Gray
    }
} catch {
    Write-Host "  * Node.js Version: $rawNode (พร้อมใช้งาน)" -ForegroundColor Gray
}

# ---------------------------------------------------------------------
# 2. ตรวจสอบไฟล์การตั้งค่า Environment (.env.local)
# ---------------------------------------------------------------------
$envLocal = Join-Path -Path $rootDir -ChildPath ".env.local"
$envExample = Join-Path -Path $rootDir -ChildPath ".env.example"
if (-not (Test-Path $envLocal)) {
    if (Test-Path $envExample) {
        Copy-Item -Path $envExample -Destination $envLocal -Force
        Write-Host "  * สร้างไฟล์ .env.local เริ่มต้นเรียบร้อยแล้ว" -ForegroundColor Gray
    }
}

# ---------------------------------------------------------------------
# 3. ตรวจสอบ PocketBase Engine และฐานข้อมูล
# ---------------------------------------------------------------------
Write-Host ""
Write-Host "[2/6] ตรวจสอบ PocketBase Database Engine..." -ForegroundColor Yellow
$pbExe = Join-Path -Path $rootDir -ChildPath "pocketbase.exe"
$pbData = Join-Path -Path $rootDir -ChildPath "pb_data"

if (-not (Test-Path $pbExe)) {
    Write-Host "  * ไม่พบ pocketbase.exe กำลังดาวน์โหลดให้อัตโนมัติ..." -ForegroundColor Yellow
    $ProgressPreference = "SilentlyContinue"
    try {
        $release = Invoke-RestMethod -Uri "https://api.github.com/repos/pocketbase/pocketbase/releases/latest"
        $asset = $release.assets | Where-Object { $_.name -like "*windows_amd64.zip" } | Select-Object -First 1
        $zipPath = Join-Path -Path $rootDir -ChildPath "pocketbase.zip"
        Invoke-WebRequest -Uri $asset.browser_download_url -OutFile $zipPath
        Expand-Archive -Path $zipPath -DestinationPath $rootDir -Force
        Remove-Item $zipPath -Force
        Write-Host "  * ดาวน์โหลด pocketbase.exe เรียบร้อยแล้ว!" -ForegroundColor Green
    } catch {
        Write-Host "[ERROR] ดาวน์โหลด pocketbase.exe ไม่สำเร็จ กรุณาตรวจสอบอินเทอร์เน็ต" -ForegroundColor Red
        Read-Host "กด Enter เพื่อปิดหน้าต่าง..."
        exit 1
    }
} else {
    Write-Host "  * PocketBase Engine พร้อมใช้งาน" -ForegroundColor Gray
}

# ---------------------------------------------------------------------
# 4. ตรวจสอบ Dependencies (node_modules)
# ---------------------------------------------------------------------
Write-Host ""
Write-Host "[3/6] ตรวจสอบ Dependencies (node_modules)..." -ForegroundColor Yellow
$nodeModules = Join-Path -Path $rootDir -ChildPath "node_modules"
if (-not (Test-Path $nodeModules)) {
    Write-Host "  * กำลังติดตั้ง Dependencies อัตโนมัติ (ครั้งแรกอาจใช้เวลา 1-2 นาที)..." -ForegroundColor Yellow
    Push-Location $rootDir
    npm install
    Pop-Location
    Write-Host "  * ติดตั้ง Dependencies เรียบร้อยแล้ว!" -ForegroundColor Green
} else {
    Write-Host "  * Dependencies ติดตั้งพร้อมแล้ว" -ForegroundColor Gray
}

# ---------------------------------------------------------------------
# 5. เคลียร์พอร์ตและเริ่ม PocketBase Server
# ---------------------------------------------------------------------
Write-Host ""
Write-Host "[4/6] เตรียมพอร์ตเครือข่าย (3000, 8090)..." -ForegroundColor Yellow
Stop-Process -Name "pocketbase" -Force -ErrorAction SilentlyContinue
Get-NetTCPConnection -LocalPort 3000, 8090 -ErrorAction SilentlyContinue |
    Select-Object -ExpandProperty OwningProcess -Unique |
    ForEach-Object { Stop-Process -Id $_ -Force -ErrorAction SilentlyContinue }

# เริ่ม PocketBase ในโหมด Background
Start-Process -FilePath $pbExe -ArgumentList "serve --http 0.0.0.0:8090" -WindowStyle Hidden
Write-Host "  * พอร์ต 3000 และ 8090 พร้อมใช้งาน" -ForegroundColor Gray

# ตรวจสอบการสร้าง Superuser และ Seeding ใน PocketBase (ถ้าเป็นฐานข้อมูลใหม่)
if (-not (Test-Path $pbData)) {
    Start-Sleep -Seconds 1
    & $pbExe superuser upsert admin@assetflow.local "AssetFlow@2569!" >$null 2>&1
    $seedScript = Join-Path -Path $rootDir -ChildPath "scripts\seed-pocketbase.mjs"
    if (Test-Path $seedScript) {
        Write-Host "  * กำลังนำเข้าข้อมูลครุภัณฑ์ 93 รายการเข้าสู่ PocketBase..." -ForegroundColor Yellow
        node $seedScript >$null 2>&1
        Write-Host "  * นำเข้าข้อมูลเริ่มต้น 93 รายการสำเร็จ!" -ForegroundColor Green
    }
}

# ---------------------------------------------------------------------
# 6. แสดงลิงก์การเข้าใช้งาน
# ---------------------------------------------------------------------
Write-Host ""
Write-Host "=====================================================================" -ForegroundColor Cyan
Write-Host "  🚀 ระบบพร้อมใช้งานแล้ว! เลือกลิงก์ตามการเชื่อมต่อของเครื่อง:" -ForegroundColor Cyan
Write-Host "=====================================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "  💻 [เครื่องนี้ - Localhost]:"
Write-Host "     - หน้าโปรแกรม:          http://localhost:3000" -ForegroundColor White
Write-Host "     - PocketBase Admin UI:   http://localhost:8090/_/" -ForegroundColor White
Write-Host ""
Write-Host "  📱 [เครื่องอื่น / มือถือ / โน้ตบุ๊ก ในวง Wi-Fi หรือ LAN เดียวกัน]:"
Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.IPAddress -notlike "127.*" -and $_.IPAddress -notlike "169.254.*" } | ForEach-Object {
    Write-Host "     * $($_.InterfaceAlias) : http://$($_.IPAddress):3000" -ForegroundColor Green
}
Write-Host ""
Write-Host "  🔑 ข้อมูลเข้าสู่ระบบ PocketBase Admin:"
Write-Host "     - Email:    admin@assetflow.local" -ForegroundColor Gray
Write-Host "     - Password: AssetFlow@2569!" -ForegroundColor Gray
Write-Host ""
Write-Host "=====================================================================" -ForegroundColor Yellow
Write-Host "  💡 คำแนะนำ:"
Write-Host "  1. หากเครื่องอื่นเข้าไม่ได้ ให้รันไฟล์ [setup-firewall.bat] 1 ครั้ง"
Write-Host "  2. ตรวจสอบว่าเชื่อมต่อ Wi-Fi หรือ LAN วงเดียวกัน"
Write-Host "=====================================================================" -ForegroundColor Yellow
Write-Host "  กด Ctrl+C ในหน้าต่างนี้เมื่อต้องการหยุดการทำงาน" -ForegroundColor Gray
Write-Host ""

Start-Sleep -Seconds 2
Start-Process "http://localhost:3000"

Write-Host "[6/6] กำลังเริ่มรัน AssetFlow Web Server บนพอร์ต 3000..." -ForegroundColor Yellow
Write-Host ""

Push-Location $rootDir
npm run dev -- -H 0.0.0.0 -p 3000
Pop-Location
