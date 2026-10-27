# One-time initialization. Run on your own Windows PC in PowerShell.
# Requires Node.js/npm; does NOT require Rust or Visual Studio.
$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot
if (-not (Get-Command npm -ErrorAction SilentlyContinue)) { throw 'Install Node.js 22+ (https://nodejs.org/) and restart PowerShell.' }
$keyDir = Join-Path $HOME 'nte-tracker-signing'
$keyFile = Join-Path $keyDir 'nte-updater.key'
if (Test-Path $keyFile) { throw "A signing key already exists at $keyFile. DO NOT generate a new one: keep the original signing identity." }
New-Item -ItemType Directory -Force -Path $keyDir | Out-Null
Write-Host 'Installing Tauri CLI for key generation...'
npm install --no-audit --no-fund
if ($LASTEXITCODE -ne 0) { throw 'npm install failed.' }
Write-Host 'Create a signing key. Save its passphrase: you must provide it to GitHub Actions.'
# Call the locally installed Tauri CLI directly. npm can interpret -w as its own
# --workspace option, preventing generation of the signing keys.
$tauriCli = Join-Path $PSScriptRoot 'node_modules\.bin\tauri.cmd'
if (-not (Test-Path $tauriCli)) { throw 'Local Tauri CLI not found after npm install.' }
& $tauriCli signer generate --write-keys $keyFile
if ($LASTEXITCODE -ne 0) { throw 'Key generation failed.' }
$publicKey = (Get-Content "$keyFile.pub" -Raw).Trim()
$configPath = 'src-tauri/tauri.conf.json'
$config = Get-Content $configPath -Raw | ConvertFrom-Json
$config.plugins.updater.pubkey = $publicKey
[System.IO.File]::WriteAllText((Join-Path $PSScriptRoot $configPath), ($config | ConvertTo-Json -Depth 25), (New-Object System.Text.UTF8Encoding($false)))
Write-Host ''
Write-Host 'PUBLIC key inserted into src-tauri/tauri.conf.json. Commit this file to GitHub.' -ForegroundColor Green
Write-Host "PRIVATE key file (DO NOT UPLOAD): $keyFile" -ForegroundColor Yellow
Write-Host 'GitHub > Settings > Secrets and variables > Actions > New repository secret:'
Write-Host '  TAURI_SIGNING_PRIVATE_KEY = entire contents of your .key file'
Write-Host '  TAURI_SIGNING_PRIVATE_KEY_PASSWORD = passphrase you chose'
Write-Host 'Keep a second secure copy of the key AND its password outside your PC.'
