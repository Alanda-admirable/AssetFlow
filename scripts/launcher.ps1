# AssetFlow + PocketBase - LAN Sharing Launcher
$Host.UI.RawUI.WindowTitle = "AssetFlow + PocketBase (LAN Multi-Device Sharing)"
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

Write-Host ""
Write-Host "=====================================================================" -ForegroundColor Green
Write-Host "  AssetFlow + PocketBase - Asset and Location Management System" -ForegroundColor Green
Write-Host "  LAN Multi-Device Sharing Mode" -ForegroundColor Green
Write-Host "=====================================================================" -ForegroundColor Green
Write-Host ""

# 1. Check Node.js
Write-Host "[1/5] Checking Node.js runtime..." -ForegroundColor Yellow
$nodeVersion = node -v 2>$null
if (-not $nodeVersion) {
    Write-Host ""
    Write-Host "[ERROR] Node.js is not installed on this computer!" -ForegroundColor Red
    Write-Host "Please download and install Node.js from: https://nodejs.org" -ForegroundColor Red
    Write-Host ""
    Read-Host "Press Enter to exit..."
    exit 1
}
Write-Host "  * Node.js Version: $nodeVersion (Ready)" -ForegroundColor Gray

# 2. Check PocketBase Engine
Write-Host ""
Write-Host "[2/5] Checking PocketBase Database Engine..." -ForegroundColor Yellow
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$rootDir = Split-Path -Parent $scriptDir
$pbExe = Join-Path -Path $rootDir -ChildPath "pocketbase.exe"

if (-not (Test-Path $pbExe)) {
    Write-Host "  * pocketbase.exe not found. Downloading automatically..." -ForegroundColor Yellow
    $ProgressPreference = "SilentlyContinue"
    try {
        $release = Invoke-RestMethod -Uri "https://api.github.com/repos/pocketbase/pocketbase/releases/latest"
        $asset = $release.assets | Where-Object { $_.name -like "*windows_amd64.zip" } | Select-Object -First 1
        $zipPath = Join-Path -Path $rootDir -ChildPath "pocketbase.zip"
        Invoke-WebRequest -Uri $asset.browser_download_url -OutFile $zipPath
        Expand-Archive -Path $zipPath -DestinationPath $rootDir -Force
        Remove-Item $zipPath -Force
        Write-Host "  * pocketbase.exe downloaded successfully!" -ForegroundColor Green
    } catch {
        Write-Host "[ERROR] Failed to download PocketBase. Please check your internet connection." -ForegroundColor Red
        Read-Host "Press Enter to exit..."
        exit 1
    }
} else {
    Write-Host "  * PocketBase Engine is ready" -ForegroundColor Gray
}

# 3. Check Dependencies (node_modules)
Write-Host ""
Write-Host "[3/5] Checking Dependencies (node_modules)..." -ForegroundColor Yellow
$nodeModules = Join-Path -Path $rootDir -ChildPath "node_modules"
if (-not (Test-Path $nodeModules)) {
    Write-Host "  * Installing dependencies automatically (may take 1-2 minutes)..." -ForegroundColor Yellow
    Push-Location $rootDir
    npm install
    Pop-Location
    Write-Host "  * Dependencies installed successfully!" -ForegroundColor Green
} else {
    Write-Host "  * Dependencies are ready" -ForegroundColor Gray
}

# 4. Prepare Ports and Start PocketBase
Write-Host ""
Write-Host "[4/5] Preparing network ports (3000, 8090)..." -ForegroundColor Yellow
Stop-Process -Name "pocketbase" -Force -ErrorAction SilentlyContinue
Get-NetTCPConnection -LocalPort 3000, 8090 -ErrorAction SilentlyContinue |
    Select-Object -ExpandProperty OwningProcess -Unique |
    ForEach-Object { Stop-Process -Id $_ -Force -ErrorAction SilentlyContinue }

Start-Process -FilePath $pbExe -ArgumentList "serve --http 0.0.0.0:8090" -WindowStyle Hidden
Write-Host "  * Ports 3000 and 8090 are ready" -ForegroundColor Gray

# 5. Display Access URLs
Write-Host ""
Write-Host "=====================================================================" -ForegroundColor Cyan
Write-Host "  System is Ready! Access URLs for all devices:" -ForegroundColor Cyan
Write-Host "=====================================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "  [Local Machine] On this PC:"
Write-Host "     - Web Application:    http://localhost:3000" -ForegroundColor White
Write-Host "     - PocketBase Admin:   http://localhost:8090/_/" -ForegroundColor White
Write-Host ""
Write-Host "  [Other Devices] Mobile / Laptops on same Wi-Fi / LAN:"
Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.IPAddress -notlike "127.*" -and $_.IPAddress -notlike "169.254.*" } | ForEach-Object {
    Write-Host "     * $($_.InterfaceAlias) : http://$($_.IPAddress):3000" -ForegroundColor Green
}
Write-Host ""
Write-Host "  [PocketBase Admin Credentials]"
Write-Host "     - Email:    admin@assetflow.local" -ForegroundColor Gray
Write-Host "     - Password: AssetFlow@2569!" -ForegroundColor Gray
Write-Host ""
Write-Host "=====================================================================" -ForegroundColor Yellow
Write-Host "  Troubleshooting:"
Write-Host "  1. Run [setup-firewall.bat] once if other devices cannot connect"
Write-Host "  2. Make sure all devices are on the same Wi-Fi or LAN network"
Write-Host "=====================================================================" -ForegroundColor Yellow
Write-Host "  Press Ctrl+C to stop the servers." -ForegroundColor Gray
Write-Host ""

Start-Sleep -Seconds 2
Start-Process "http://localhost:3000"

Write-Host "[5/5] Starting AssetFlow Web Server on Port 3000..." -ForegroundColor Yellow
Write-Host ""

Push-Location $rootDir
npx next dev -H 0.0.0.0 -p 3000
Pop-Location
