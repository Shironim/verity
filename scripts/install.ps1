# Verity One-Line Installer for Windows
# Usage in PowerShell:
#   irm https://raw.githubusercontent.com/shironim/verity/master/scripts/install.ps1 | iex

$ErrorActionPreference = "Stop"

$Repo = "shironim/verity"
$Target = "verity-windows-x64.exe"
$InstallDir = "$env:LOCALAPPDATA\Programs\verity"
$ExePath = "$InstallDir\verity.exe"

Write-Host "⚡ [Verity Installer] Menginstal Verity untuk Windows (x64)..." -ForegroundColor Cyan

if (-not (Test-Path $InstallDir)) {
    New-Item -ItemType Directory -Path $InstallDir -Force | Out-Null
}

$DownloadUrl = "https://github.com/$Repo/releases/latest/download/$Target"
Write-Host "⬇️  Mengunduh Verity dari $DownloadUrl..." -ForegroundColor Cyan

try {
    Invoke-WebRequest -Uri $DownloadUrl -OutFile $ExePath -UseBasicParsing
} catch {
    Write-Warning "Gagal mengunduh biner rilis GitHub. Memeriksa ketersediaan Bun lokal..."
    if (Get-Command bun -ErrorAction SilentlyContinue) {
        Write-Host "🔨 Mengompilasi Verity menggunakan Bun lokal..." -ForegroundColor Yellow
        bun build ./src/cli/index.ts --compile --outfile $ExePath
    } else {
        Write-Error "Gagal mengunduh biner dan Bun tidak terpasang di sistem."
    }
}

# Tambahkan $InstallDir ke User PATH jika belum ada
$UserPath = [Environment]::GetEnvironmentVariable("Path", "User")
if ($UserPath -notlike "*$InstallDir*") {
    Write-Host "🔧 Menambahkan $InstallDir ke PATH pengguna..." -ForegroundColor Yellow
    [Environment]::SetEnvironmentVariable("Path", "$UserPath;$InstallDir", "User")
    $env:Path = "$env:Path;$InstallDir"
}

Write-Host "✅ Instalasi Berhasil!" -ForegroundColor Green
& $ExePath --version
Write-Host "Jalankan 'verity --help' atau 'verity init' di proyek Anda untuk memulai." -ForegroundColor Green
