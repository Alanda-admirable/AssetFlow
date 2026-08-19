# AssetFlow + PocketBase - LAN Sharing Launcher (ASCII-Safe & Multi-Device Support)
$Host.UI.RawUI.WindowTitle = "AssetFlow + PocketBase (LAN Multi-Device Sharing)"
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

Write-Host ""
Write-Host "=====================================================================" -ForegroundColor Green
Write-Host "  AssetFlow + PocketBase - Asset and Location Management System" -ForegroundColor Green
Write-Host "  LAN Multi-Device Sharing Mode" -ForegroundColor Green
Write-Host "=====================================================================" -ForegroundColor Green
Write-Host ""

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$rootDir = Split-Path -Parent $scriptDir

# 1. Check Node.js
Write-Host "[1/5] Checking Node.js runtime..." -ForegroundColor Yellow
$rawNode = node -v 2>$null
if (-not $rawNode) {
    Write-Host ""
    Write-Host "[ERROR] Node.js is not installed on this computer!" -ForegroundColor Red
    Write-Host "Please download and install Node.js (v20 or v22 LTS) from: https://nodejs.org" -ForegroundColor Red
    Write-Host ""
    Read-Host "Press Enter to exit..."
    exit 1
}

$cleanVer = $rawNode.Trim().TrimStart("v")
try {
    $parsedVer = [version]($cleanVer.Split("-")[0])
    if ($parsedVer.Major -lt 18 -or ($parsedVer.Major -eq 18 -and $parsedVer.Minor -lt 18)) {
        Write-Host ""
        Write-Host "[WARNING] Node.js $rawNode detected. Next.js 15 requires Node.js v18.18.0 or newer." -ForegroundColor Red
        Write-Host "Please update Node.js at https://nodejs.org" -ForegroundColor Yellow
        Write-Host ""
    } else {
        Write-Host "  * Node.js Version: $rawNode (Ready)" -ForegroundColor Gray
    }
} catch {
    Write-Host "  * Node.js Version: $rawNode (Ready)" -ForegroundColor Gray
}

# 2. Check and copy .env.local if missing
$envLocal = Join-Path -Path $rootDir -ChildPath ".env.local"
$envExample = Join-Path -Path $rootDir -ChildPath ".env.example"
if (-not (Test-Path $envLocal)) {
    if (Test-Path $envExample) {
        Copy-Item -Path $envExample -Destination $envLocal -Force
        Write-Host "  * Created default .env.local from template" -ForegroundColor Gray
    }
}

# 3. Check PocketBase Engine
Write-Host ""
Write-Host "[2/5] Checking PocketBase Database Engine..." -ForegroundColor Yellow
$pbExe = Join-Path -Path $rootDir -ChildPath "pocketbase.exe"
$pbData = Join-Path -Path $rootDir -ChildPath "pb_data"

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

# 4. Check Dependencies (node_modules)
Write-Host ""
Write-Host "[3/5] Checking Dependencies (node_modules)..." -ForegroundColor Yellow
$nodeModules = Join-Path -Path $rootDir -ChildPath "node_modules"
if (-not (Test-Path $nodeModules)) {
    Write-Host "  * Installing dependencies (this may take 1-2 minutes on first run)..." -ForegroundColor Yellow
    Push-Location $rootDir
    npm install
    Pop-Location
    Write-Host "  * Dependencies installed successfully!" -ForegroundColor Green
} else {
    Write-Host "  * Dependencies are ready" -ForegroundColor Gray
}

# 5. Prepare Ports and Start PocketBase
Write-Host ""
Write-Host "[4/5] Preparing network ports (3000, 8090)..." -ForegroundColor Yellow
Stop-Process -Name "pocketbase" -Force -ErrorAction SilentlyContinue
Get-NetTCPConnection -LocalPort 3000, 8090 -ErrorAction SilentlyContinue |
    Select-Object -ExpandProperty OwningProcess -Unique |
    ForEach-Object { Stop-Process -Id $_ -Force -ErrorAction SilentlyContinue }

Start-Process -FilePath $pbExe -ArgumentList "serve --http 0.0.0.0:8090" -WindowStyle Hidden
Write-Host "  * Ports 3000 and 8090 are ready" -ForegroundColor Gray

# Seed PocketBase if first-time run
if (-not (Test-Path $pbData)) {
    Start-Sleep -Seconds 1
    & $pbExe superuser upsert admin@assetflow.local "AssetFlow@2569!" >$null 2>&1
    $seedScript = Join-Path -Path $rootDir -ChildPath "scripts\seed-pocketbase.mjs"
    if (Test-Path $seedScript) {
        Write-Host "  * Initializing database with 93 asset records..." -ForegroundColor Yellow
        node $seedScript >$null 2>&1
        Write-Host "  * 93 assets seeded successfully!" -ForegroundColor Green
    }
}

# 6. Display Access URLs
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
npm run dev -- -H 0.0.0.0 -p 3000
Pop-Location
