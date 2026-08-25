<#
.SYNOPSIS
    Windows Bootstrapper / Installer for Licensed Software & Driver Package
.DESCRIPTION
    Production-grade Windows 11 bootstrapper script that cleanly separates:
      1. Licensing: Validates license key with backend over HTTPS.
      2. Activation: Generates stable Windows machine identity (MachineGUID + System UUID) and retrieves signed Ed25519 token.
      3. Package Download: Requests presigned Backblaze B2 URLs and verifies SHA-256 checksums.
      4. Driver Installation: Installs Windows driver package using Pnputil / SetupAPI when package exists.
.PARAMETER LicenseKey
    License key for validation and machine activation.
.PARAMETER BackendUrl
    Base URL of the license server backend.
.PARAMETER MachineOverride
    DEMO ONLY: Simulated machine ID for testing identity isolation.
#>

[CmdletBinding()]
param(
    [Alias("k", "License")]
    [string]$LicenseKey = $env:LICENSE_KEY,

    [Alias("b", "Backend")]
    [string]$BackendUrl = $env:BACKEND_URL,

    [Alias("m", "MachineId")]
    [string]$MachineOverride = $env:DEMO_MACHINE_ID,

    [switch]$Help
)

$ErrorActionPreference = "Stop"

# ---------------------------------------------------------------------------
# HELP
# ---------------------------------------------------------------------------
function Show-Help {
    Write-Host @"
=============================================================================
 Windows Licensed Driver Package Installer (Bootstrapper)
=============================================================================

Usage:
  .\setup.ps1 -LicenseKey "<KEY>" -BackendUrl "<URL>" [-MachineOverride "<SIMULATED_ID>"]

Options:
  -LicenseKey, -k <KEY>     License key for validation (or set env var LICENSE_KEY)
  -BackendUrl, -b <URL>     Backend URL (or set env var BACKEND_URL)
  -MachineOverride, -m <ID> DEMO ONLY: Simulated machine ID override
  -Help                     Display this help message

Security & Binding Architecture:
  - HTTPS required for all remote backend endpoints.
  - License is bound cryptographically to Windows MachineGUID / System UUID.
  - All package downloads are SHA-256 verified against authoritative server checksums.
  - Driver installation via Pnputil (requires Administrator privilege).
"@
}

# ---------------------------------------------------------------------------
# COLOR / LOGGING HELPERS
# ---------------------------------------------------------------------------
function Write-LogInfo([string]$Message) {
    Write-Host "[INFO] $Message" -ForegroundColor Cyan
}

function Write-LogSuccess([string]$Message) {
    Write-Host "[SUCCESS] $Message" -ForegroundColor Green
}

function Write-LogWarn([string]$Message) {
    Write-Host "[WARN] $Message" -ForegroundColor Yellow
}

function Write-LogError([string]$Message) {
    Write-Host "[ERROR] $Message" -ForegroundColor Red
}

# ---------------------------------------------------------------------------
# URL SECURITY VALIDATION
# ---------------------------------------------------------------------------
function Assert-UrlSecurity([string]$Url, [string]$ContextName) {
    if ($Url.StartsWith("https://", [System.StringComparison]::OrdinalIgnoreCase)) {
        return $true
    }
    if ($Url -match '^http://(localhost|127\.0\.0\.1)(:[0-9]+)?(/.*)?$') {
        return $true
    }
    Write-LogError "Insecure URL detected for ${ContextName}: $Url"
    Write-LogError "HTTPS is required for remote endpoints. HTTP is allowed only for localhost / 127.0.0.1."
    return $false
}

# ---------------------------------------------------------------------------
# MODULE 1: WINDOWS MACHINE IDENTITY (STABLE HARDWARE/OS BINDING)
# ---------------------------------------------------------------------------
function Get-WindowsMachineIdentity([string]$Override) {
    if ($Override -and $Override.Trim().Length -gt 0) {
        $bytes = [System.Text.Encoding]::UTF8.GetBytes("DEMO_SIMULATED_WINDOWS_MACHINE:$($Override.Trim())")
        $sha = [System.Security.Cryptography.SHA256]::Create()
        $hashBytes = $sha.ComputeHash($bytes)
        return -join ($hashBytes | ForEach-Object { "{0:x2}" -f $_ })
    }

    $rawComponents = @()

    # 1. HKLM Registry MachineGuid (Windows OS installation GUID)
    try {
        $regGuid = (Get-ItemProperty -Path "HKLM:\SOFTWARE\Microsoft\Cryptography" -Name "MachineGuid" -ErrorAction SilentlyContinue).MachineGuid
        if ($regGuid) { $rawComponents += "REG_GUID:$regGuid" }
    } catch {}

    # 2. System Hardware UUID via CIM / WMI (Motherboard / System UUID)
    try {
        $sysProduct = Get-CimInstance -ClassName Win32_ComputerSystemProduct -ErrorAction SilentlyContinue
        if ($sysProduct -and $sysProduct.UUID) { $rawComponents += "SYS_UUID:$($sysProduct.UUID)" }
    } catch {}

    # Fallback if WMI/Registry fail
    if ($rawComponents.Count -eq 0) {
        $rawComponents += "FALLBACK_HOST:$env:COMPUTERNAME-$env:PROCESSOR_ARCHITECTURE"
    }

    $combinedRaw = $rawComponents -join "|"
    $bytes = [System.Text.Encoding]::UTF8.GetBytes("WINDOWS_MACHINE:$combinedRaw")
    $sha = [System.Security.Cryptography.SHA256]::Create()
    $hashBytes = $sha.ComputeHash($bytes)
    return -join ($hashBytes | ForEach-Object { "{0:x2}" -f $_ })
}

# ---------------------------------------------------------------------------
# MODULE 2: LICENSING (LICENSE VALIDATION & DOWNLOAD AUTHORIZATION)
# ---------------------------------------------------------------------------
function Invoke-LicenseValidation([string]$Key, [string]$BaseUrl) {
    Write-LogInfo "Contacting backend to validate Windows license..."
    $endpoint = "$BaseUrl/api/validate-license"
    
    $bodyJson = @{
        license_key = $Key
        platform    = "WINDOWS"
    } | ConvertTo-Json

    try {
        $response = Invoke-RestMethod -Uri $endpoint -Method Post -ContentType "application/json" -Body $bodyJson
        return $response
    } catch {
        Write-LogError "Failed to validate license with backend at ${endpoint}: $_"
        exit 1
    }
}

# ---------------------------------------------------------------------------
# MODULE 3: ACTIVATION (MACHINE ACTIVATION & SIGNED TOKEN RECEIPT)
# ---------------------------------------------------------------------------
function Invoke-MachineActivation([string]$Key, [string]$MachineId, [string]$BaseUrl) {
    Write-LogInfo "Activating license for Windows machine identity ($MachineId)..."
    $endpoint = "$BaseUrl/api/activation"

    $bodyJson = @{
        license_key  = $Key
        machine_id   = $MachineId
        product_code = "KEYBOARD-DRIVER-DEMO"
        platform     = "WINDOWS"
    } | ConvertTo-Json

    try {
        $response = Invoke-RestMethod -Uri $endpoint -Method Post -ContentType "application/json" -Body $bodyJson
        return $response
    } catch {
        $errResponse = $_.Exception.Response
        if ($errResponse) {
            $reader = New-Object System.IO.StreamReader($errResponse.GetResponseStream())
            $jsonStr = $reader.ReadToEnd()
            try {
                $errObj = $jsonStr | ConvertFrom-Json
                Write-LogError "=================================================================="
                Write-LogError " ACTIVATION REJECTED BY SERVER"
                Write-LogError "=================================================================="
                Write-LogError " Reason: $($errObj.error)"
                Write-LogError " This license cannot be used on this computer."
                Write-LogError " Installation aborted to prevent unauthorized execution."
                Write-LogError "=================================================================="
                exit 1
            } catch {}
        }
        Write-LogError "Machine activation failed: $_"
        exit 1
    }
}

# ---------------------------------------------------------------------------
# MODULE 4: PACKAGE DOWNLOAD & CHECKSUM VERIFICATION
# ---------------------------------------------------------------------------
function Invoke-PackageDownloadAndVerification([object]$ValidationData, [string]$DestinationDir) {
    if ($ValidationData.package_status -eq "PENDING_WINDOWS_BUILD" -or -not $ValidationData.packages -or $ValidationData.packages.Count -eq 0) {
        Write-LogWarn "=================================================================="
        Write-LogWarn " NOTICE: WINDOWS DRIVER PACKAGE IS PENDING WINDOWS 11 BUILD"
        Write-LogWarn "=================================================================="
        Write-LogWarn " Backend License Validation: PASSED"
        Write-LogWarn " Machine Activation & Binding: PASSED"
        Write-LogWarn " Package Status: PENDING_WINDOWS_BUILD"
        Write-LogWarn " "
        Write-LogWarn " Next Step:"
        Write-LogWarn "   1. Boot Windows 11 & build kbfiltr solution in Visual Studio + WDK."
        Write-LogWarn "   2. Copy generated package output into Requirements/windows-driver/."
        Write-LogWarn "   3. Upload package to B2 using 'npm run upload:windows-package'."
        Write-LogWarn "=================================================================="
        return $null
    }

    Write-LogInfo "Downloading authorized Windows driver package files..."
    $downloadedFiles = @()

    foreach ($pkgKey in $ValidationData.packages.PSObject.Properties.Name) {
        $pkgInfo = $ValidationData.packages.$pkgKey
        $downloadUrl = $pkgInfo.url
        $expectedSha256 = $pkgInfo.sha256
        $filename = if ($pkgInfo.filename) { $pkgInfo.filename } else { "$pkgKey.zip" }

        if (-not (Assert-UrlSecurity -Url $downloadUrl -ContextName "Package download ($filename)")) {
            exit 1
        }

        $destFile = Join-Path $DestinationDir $filename
        Write-LogInfo "Downloading $filename..."
        Invoke-WebRequest -Uri $downloadUrl -OutFile $destFile -UseBasicParsing

        if (-not (Test-Path $destFile)) {
            Write-LogError "Failed to download package file: $filename"
            exit 1
        }

        # Verify SHA-256 checksum
        Write-LogInfo "Verifying SHA-256 checksum for $filename..."
        $actualSha256 = (Get-FileHash -Path $destFile -Algorithm SHA256).Hash.ToLower()
        if ($actualSha256 -ne $expectedSha256.ToLower()) {
            Write-LogError "SHA-256 Checksum verification FAILED for $filename!"
            Write-LogError "  Expected: $expectedSha256"
            Write-LogError "  Actual:   $actualSha256"
            Write-LogError "Aborting installation to prevent corrupted or tampered driver installation."
            exit 1
        }
        Write-LogSuccess "Checksum verified for $filename ($actualSha256)"
        $downloadedFiles += $destFile
    }

    return $downloadedFiles
}

# ---------------------------------------------------------------------------
# MODULE 5: WINDOWS DRIVER PACKAGE INSTALLATION
# ---------------------------------------------------------------------------
function Invoke-WindowsDriverInstallation([string[]]$PackageFiles, [string]$TargetDir) {
    if (-not $PackageFiles -or $PackageFiles.Count -eq 0) {
        Write-LogInfo "[SCAFFOLD] No downloaded package files present (Pending Windows 11 Build)."
        Write-LogInfo "[SCAFFOLD] Driver installation mechanism ready for Pnputil execution."
        return [PSCustomObject]@{
            Success        = $true
            RebootRequired = $false
            Scaffold       = $true
        }
    }

    Write-LogInfo "Extracting and installing Windows driver package..."
    $installedAny = $false
    $rebootRequired = $false

    foreach ($pkgFile in $PackageFiles) {
        if ($pkgFile.EndsWith(".zip", [System.StringComparison]::OrdinalIgnoreCase)) {
            $extractDir = Join-Path $TargetDir "extracted_driver"
            Expand-Archive -Path $pkgFile -DestinationPath $extractDir -Force

            # Search for .inf driver package manifest
            $infFiles = Get-ChildItem -Path $extractDir -Filter "*.inf" -Recurse
            if (-not $infFiles -or $infFiles.Count -eq 0) {
                Write-LogError "No .inf driver manifest found inside package: $pkgFile"
                throw "Driver package extraction failed: No .inf file found in $pkgFile"
            }

            foreach ($inf in $infFiles) {
                Write-LogInfo "Installing Windows driver package via Pnputil: $($inf.FullName)"
                $pnpOutput = & pnputil /add-driver "$($inf.FullName)" /install 2>&1
                $exitCode = $LASTEXITCODE
                foreach ($line in $pnpOutput) {
                    Write-Host "  [pnputil] $line" -ForegroundColor Gray
                }

                if ($exitCode -eq 0) {
                    Write-LogSuccess "Driver package installed successfully via Pnputil: $($inf.Name)"
                    $installedAny = $true
                } elseif ($exitCode -eq 3010) {
                    Write-LogSuccess "Driver package installed successfully (system reboot required, code 3010): $($inf.Name)"
                    $installedAny = $true
                    $rebootRequired = $true
                } else {
                    Write-LogError "=================================================================="
                    Write-LogError " DRIVER INSTALLATION FAILED VIA PNPUTIL"
                    Write-LogError "=================================================================="
                    Write-LogError " Target INF: $($inf.FullName)"
                    Write-LogError " Exit Code:  $exitCode"
                    Write-LogError " Error:      Pnputil returned unexpected exit code $exitCode"
                    Write-LogError "=================================================================="
                    throw "Pnputil driver installation failed with exit code $exitCode for $($inf.Name)"
                }
            }
        }
    }

    return [PSCustomObject]@{
        Success        = $installedAny
        RebootRequired = $rebootRequired
        Scaffold       = $false
    }
}

# ===========================================================================
# MAIN BOOTSTRAPPER EXECUTION FLOW
# ===========================================================================
if ($Help) {
    Show-Help
    exit 0
}

# ---------------------------------------------------------------------------
# INPUT VALIDATION & URL SECURITY
# ---------------------------------------------------------------------------
if (-not $LicenseKey) {
    Write-LogError "License key is required. Pass -LicenseKey '<KEY>' or set LICENSE_KEY environment variable."
    exit 1
}

if (-not $BackendUrl) {
    Write-LogError "Backend URL is required. Pass -BackendUrl '<URL>' or set BACKEND_URL environment variable."
    exit 1
}

$BackendUrl = $BackendUrl.TrimEnd('/')

if (-not (Assert-UrlSecurity -Url $BackendUrl -ContextName "Backend API")) {
    exit 1
}

# ---------------------------------------------------------------------------
# INSTALLATION WORKFLOW EXECUTION
# ---------------------------------------------------------------------------
$TempDir = Join-Path ([System.IO.Path]::GetTempPath()) "win_driver_install_$([Guid]::NewGuid().ToString('N').Substring(0,8))"
New-Item -ItemType Directory -Path $TempDir -Force | Out-Null

try {
    Write-Host "`n=============================================================================" -ForegroundColor Cyan
    Write-Host " STARTING WINDOWS LICENSED SOFTWARE & DRIVER INSTALLATION" -ForegroundColor Cyan
    Write-Host "=============================================================================`n" -ForegroundColor Cyan

    # 1. Resolve Machine Identity
    $machineId = Get-WindowsMachineIdentity -Override $MachineOverride
    Write-LogInfo "Windows Machine Identity Derived: $machineId"
    if ($MachineOverride) {
        Write-LogWarn "[DEMO OVERRIDE] Simulating machine ID using test override: '$MachineOverride'"
    }

    # 2. License Validation
    $valData = Invoke-LicenseValidation -Key $LicenseKey -BaseUrl $BackendUrl
    if (-not $valData.valid) {
        Write-LogError "License key is invalid or revoked."
        exit 1
    }
    Write-LogSuccess "License key verified! (License ID: $($valData.license_id))"

    # 3. Machine Activation
    $actData = Invoke-MachineActivation -Key $LicenseKey -MachineId $machineId -BaseUrl $BackendUrl
    if (-not $actData.success -or -not $actData.activated) {
        Write-LogError "Machine activation failed."
        exit 1
    }
    $token = $actData.token
    Write-LogSuccess "Machine activation approved! Signed token received."

    # Save activation token to persistent location
    $tokenFile = $null
    $installDir = "C:\Program Files\KeyboardDriverDemo"
    try {
        if (-not (Test-Path $installDir)) {
            New-Item -ItemType Directory -Path $installDir -Force -ErrorAction Stop | Out-Null
        }
        $targetTokenFile = Join-Path $installDir "activation.token"
        Set-Content -Path $targetTokenFile -Value $token -Encoding UTF8 -ErrorAction Stop
        $tokenFile = $targetTokenFile
    } catch {
        $localDir = if ($PSScriptRoot) { $PSScriptRoot } else { (Get-Location).Path }
        $targetTokenFile = Join-Path $localDir "activation.token"
        try {
            Set-Content -Path $targetTokenFile -Value $token -Encoding UTF8 -ErrorAction Stop
            $tokenFile = $targetTokenFile
        } catch {
            $appDataDir = Join-Path $env:LOCALAPPDATA "KeyboardDriverDemo"
            New-Item -ItemType Directory -Path $appDataDir -Force -ErrorAction SilentlyContinue | Out-Null
            $targetTokenFile = Join-Path $appDataDir "activation.token"
            Set-Content -Path $targetTokenFile -Value $token -Encoding UTF8
            $tokenFile = $targetTokenFile
        }
    }
    Write-LogInfo "Activation token saved to: $tokenFile"

    # 4. Package Download & SHA-256 Checksum Verification
    $downloadedFiles = Invoke-PackageDownloadAndVerification -ValidationData $valData -DestinationDir $TempDir

    # 5. Driver Package Installation
    $driverResult = Invoke-WindowsDriverInstallation -PackageFiles $downloadedFiles -TargetDir $TempDir

    if ($driverResult.RebootRequired) {
        Write-Host "`n=============================================================================" -ForegroundColor Yellow
        Write-Host " WINDOWS INSTALLATION BOOTSTRAPPER COMPLETED (REBOOT REQUIRED)" -ForegroundColor Yellow
        Write-Host " Machine ID:     $machineId" -ForegroundColor Yellow
        Write-Host " License ID:    $($valData.license_id)" -ForegroundColor Yellow
        Write-Host " Token File:    $tokenFile" -ForegroundColor Yellow
        Write-Host " Reboot Status: Driver installed successfully. System restart required to activate." -ForegroundColor Yellow
        Write-Host "=============================================================================`n" -ForegroundColor Yellow
    } else {
        Write-Host "`n=============================================================================" -ForegroundColor Green
        Write-Host " WINDOWS INSTALLATION BOOTSTRAPPER COMPLETED SUCCESSFULLY" -ForegroundColor Green
        Write-Host " Machine ID:  $machineId" -ForegroundColor Green
        Write-Host " License ID: $($valData.license_id)" -ForegroundColor Green
        Write-Host " Token File: $tokenFile" -ForegroundColor Green
        Write-Host "=============================================================================`n" -ForegroundColor Green
    }

} catch {
    Write-Host "`n=============================================================================" -ForegroundColor Red
    Write-Host " WINDOWS INSTALLATION BOOTSTRAPPER FAILED" -ForegroundColor Red
    Write-Host " Error: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "=============================================================================`n" -ForegroundColor Red
    exit 1
} finally {
    # 6. Temporary File Cleanup
    if (Test-Path $TempDir) {
        Remove-Item -Path $TempDir -Recurse -Force -ErrorAction SilentlyContinue
    }
}
