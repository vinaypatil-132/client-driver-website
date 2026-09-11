<#
.SYNOPSIS
    Windows Bootstrapper / Installer for Licensed Nav Brahmi Driver Packages
.DESCRIPTION
    Production-grade Windows 11 bootstrapper script that cleanly handles:
      1. Machine Identity: Derives stable hardware/OS binding (MachineGuid + System UUID).
      2. Licensing: Validates license key with backend over HTTPS.
      3. Activation: Obtains asymmetric cryptographically signed Ed25519 token.
      4. Secure Download: Requests presigned Backblaze B2 URLs and verifies SHA-256 checksums.
      5. Driver & Font Installation: Installs authentic Windows keyboard layout drivers (MSI/DLLs) and unicode fonts.
      6. Security & Cleanup: Operates with strict URL security and cleans up all temporary artifacts.
.PARAMETER LicenseKey
    License key for validation and machine activation.
.PARAMETER BackendUrl
    Base URL of the license server backend.
.PARAMETER MachineOverride
    DEMO/TEST ONLY: Simulated machine ID for testing identity isolation.
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
 Nav Brahmi Windows Licensed Driver Installer (Bootstrapper)
=============================================================================

Usage:
  .\setup.ps1 -LicenseKey "<KEY>" -BackendUrl "<URL>" [-MachineOverride "<SIMULATED_ID>"]

Options:
  -LicenseKey, -k <KEY>     License key for validation (or set env var LICENSE_KEY)
  -BackendUrl, -b <URL>     Backend URL (or set env var BACKEND_URL)
  -MachineOverride, -m <ID> TEST ONLY: Simulated machine ID override
  -Help                     Display this help message

Security & Architecture:
  - HTTPS required for all remote backend endpoints.
  - Machine binding cryptographically locked to Windows MachineGuid / System UUID.
  - Package downloads verified via authoritative SHA-256 checksums.
  - Installs authentic Nav Brahmi keyboard layout drivers and unicode fonts.
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
    Write-LogInfo "Contacting backend to validate license..."
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
function Invoke-MachineActivation([string]$Key, [string]$MachineId, [string]$ProductCode, [string]$BaseUrl) {
    Write-LogInfo "Activating license for Windows machine identity ($MachineId)..."
    $endpoint = "$BaseUrl/api/activation"

    $bodyJson = @{
        license_key  = $Key
        machine_id   = $MachineId
        product_code = $ProductCode
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
    if (-not $ValidationData.packages -or $ValidationData.packages.PSObject.Properties.Count -eq 0) {
        Write-LogError "No package download metadata provided by backend."
        exit 1
    }

    Write-LogInfo "Downloading authorized Nav Brahmi driver package..."
    $downloadedFiles = @()

    foreach ($pkgProp in $ValidationData.packages.PSObject.Properties) {
        $pkgInfo = $pkgProp.Value
        $downloadUrl = $pkgInfo.url
        $expectedSha256 = $pkgInfo.sha256
        $filename = if ($pkgInfo.filename) { $pkgInfo.filename } else { "$($pkgProp.Name).zip" }

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
        Write-LogSuccess "Authoritative checksum verified for $filename ($actualSha256)"
        $downloadedFiles += $destFile
    }

    return $downloadedFiles
}

# ---------------------------------------------------------------------------
# MODULE 5: FONT INSTALLATION HELPER
# ---------------------------------------------------------------------------
function Install-FontFiles([string]$DirectoryPath, [bool]$IsAdmin) {
    $fontFiles = Get-ChildItem -Path $DirectoryPath -Filter "*.ttf" -Recurse
    if (-not $fontFiles -or $fontFiles.Count -eq 0) {
        $fontFiles = Get-ChildItem -Path $DirectoryPath -Filter "*.otf" -Recurse
    }

    if (-not $fontFiles -or $fontFiles.Count -eq 0) {
        return
    }

    foreach ($font in $fontFiles) {
        Write-LogInfo "Installing font: $($font.Name)..."
        try {
            if ($IsAdmin) {
                $targetPath = Join-Path "C:\Windows\Fonts" $font.Name
                Copy-Item -Path $font.FullName -Destination $targetPath -Force -ErrorAction SilentlyContinue
                $fontRegName = "$([System.IO.Path]::GetFileNameWithoutExtension($font.Name)) (TrueType)"
                New-ItemProperty -Path "HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Fonts" -Name $fontRegName -Value $font.Name -PropertyType String -Force -ErrorAction SilentlyContinue | Out-Null
                Write-LogSuccess "Font registered system-wide: $($font.Name)"
            } else {
                $userFontDir = Join-Path $env:LOCALAPPDATA "Microsoft\Windows\Fonts"
                if (-not (Test-Path $userFontDir)) {
                    New-Item -ItemType Directory -Path $userFontDir -Force | Out-Null
                }
                $targetPath = Join-Path $userFontDir $font.Name
                Copy-Item -Path $font.FullName -Destination $targetPath -Force -ErrorAction SilentlyContinue
                $fontRegName = "$([System.IO.Path]::GetFileNameWithoutExtension($font.Name)) (TrueType)"
                New-ItemProperty -Path "HKCU:\Software\Microsoft\Windows NT\CurrentVersion\Fonts" -Name $fontRegName -Value $targetPath -PropertyType String -Force -ErrorAction SilentlyContinue | Out-Null
                Write-LogSuccess "Font registered in user profile: $($font.Name)"
            }
        } catch {
            Write-LogWarn "Could not automatically register font $($font.Name): $_"
        }
    }
}

# ---------------------------------------------------------------------------
# MODULE 6: NAV BRAHMI DRIVER PACKAGE INSTALLATION
# ---------------------------------------------------------------------------
function Invoke-NavBrahmiDriverInstallation([string[]]$PackageFiles, [string]$TargetDir) {
    if (-not $PackageFiles -or $PackageFiles.Count -eq 0) {
        throw "No package files provided for installation."
    }

    $isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
    $installedAny = $false
    $rebootRequired = $false
    $arch = $env:PROCESSOR_ARCHITECTURE.ToLower()

    foreach ($pkgFile in $PackageFiles) {
        Write-LogInfo "Extracting driver package: $(Split-Path $pkgFile -Leaf)..."
        $extractDir = Join-Path $TargetDir "extracted_driver_$([Guid]::NewGuid().ToString('N').Substring(0,6))"
        Expand-Archive -Path $pkgFile -DestinationPath $extractDir -Force

        # 1. Install Unicode Fonts
        Install-FontFiles -DirectoryPath $extractDir -IsAdmin $isAdmin

        # 2. Locate MSIs
        $msiFiles = Get-ChildItem -Path $extractDir -Filter "*.msi" -Recurse
        if (-not $msiFiles -or $msiFiles.Count -eq 0) {
            Write-LogError "No .msi installer found inside driver package."
            throw "Driver package extraction failed: No .msi installer found in $pkgFile"
        }

        # Select matching architecture MSI
        $targetMsi = $null
        if ($arch -eq "amd64" -or $arch -eq "x64" -or $arch -eq "arm64") {
            $targetMsi = $msiFiles | Where-Object { $_.Name -like "*amd64*.msi" -or $_.Name -like "*x64*.msi" } | Select-Object -First 1
        } elseif ($arch -eq "ia64") {
            $targetMsi = $msiFiles | Where-Object { $_.Name -like "*ia64*.msi" } | Select-Object -First 1
        } else {
            $targetMsi = $msiFiles | Where-Object { $_.Name -like "*i386*.msi" -or $_.Name -like "*x86*.msi" } | Select-Object -First 1
        }

        if (-not $targetMsi) {
            $targetMsi = $msiFiles | Select-Object -First 1
        }

        Write-LogInfo "Selected MSI installer for architecture ($arch): $($targetMsi.Name)"

        if (-not $isAdmin) {
            Write-LogWarn "=================================================================="
            Write-LogWarn " ADMINISTRATOR ELEVATION REQUIRED FOR SYSTEM REGISTRATION"
            Write-LogWarn "=================================================================="
            Write-LogWarn " Registering Windows keyboard layout drivers into System32 requires"
            Write-LogWarn " Administrator privileges."
            Write-LogWarn " "
            Write-LogWarn " Please run PowerShell as Administrator:"
            Write-LogWarn "   Right-click PowerShell -> 'Run as administrator'"
            Write-LogWarn "=================================================================="

            # Attempt installation and catch elevation errors gracefully
            $msiLog = Join-Path $TargetDir "msi_install.log"
            $proc = Start-Process msiexec.exe -ArgumentList @('/i', "`"$($targetMsi.FullName)`"", '/qn', '/norestart', '/l*v', "`"$msiLog`"") -Wait -PassThru

            if ($proc.ExitCode -eq 0) {
                Write-LogSuccess "Driver package installed successfully."
                $installedAny = $true
            } elseif ($proc.ExitCode -eq 3010) {
                Write-LogSuccess "Driver package installed successfully (reboot required)."
                $installedAny = $true
                $rebootRequired = $true
            } elseif ($proc.ExitCode -eq 1603) {
                Write-LogError "Installation was blocked due to insufficient permissions (Exit Code 1603: Access Denied)."
                Write-LogError "Please re-run this installer from an elevated Administrator PowerShell prompt."
                throw "Administrator elevation required to install keyboard layout driver to System32."
            } else {
                throw "Driver MSI installation failed with exit code $($proc.ExitCode)."
            }
        } else {
            # Running as Administrator
            $msiLog = Join-Path $TargetDir "msi_install.log"
            Write-LogInfo "Executing driver MSI installation..."
            $proc = Start-Process msiexec.exe -ArgumentList @('/i', "`"$($targetMsi.FullName)`"", '/qn', '/norestart', '/l*v', "`"$msiLog`"") -Wait -PassThru

            if ($proc.ExitCode -eq 0) {
                Write-LogSuccess "Driver package installed and registered successfully."
                $installedAny = $true
            } elseif ($proc.ExitCode -eq 3010) {
                Write-LogSuccess "Driver package installed successfully (system reboot required to finalize)."
                $installedAny = $true
                $rebootRequired = $true
            } else {
                if (Test-Path $msiLog) {
                    $errSnippet = Get-Content $msiLog | Select-String -Pattern "Return value 3|Error [0-9]+" | Select-Object -First 3
                    if ($errSnippet) {
                        Write-LogError "MSI Error Details:"
                        foreach ($line in $errSnippet) { Write-LogError "  $line" }
                    }
                }
                throw "Driver MSI installation failed with exit code $($proc.ExitCode)."
            }
        }
    }

    return [PSCustomObject]@{
        Success        = $installedAny
        RebootRequired = $rebootRequired
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
$TempDir = Join-Path ([System.IO.Path]::GetTempPath()) "navbrahmi_install_$([Guid]::NewGuid().ToString('N').Substring(0,8))"
New-Item -ItemType Directory -Path $TempDir -Force | Out-Null

try {
    Write-Host "`n=============================================================================" -ForegroundColor Cyan
    Write-Host " STARTING NAV BRAHMI WINDOWS DRIVER & SOFTWARE INSTALLATION" -ForegroundColor Cyan
    Write-Host "=============================================================================`n" -ForegroundColor Cyan

    # 1. Resolve Machine Identity
    $machineId = Get-WindowsMachineIdentity -Override $MachineOverride
    Write-LogInfo "Windows Machine Identity: $machineId"
    if ($MachineOverride) {
        Write-LogWarn "[TEST OVERRIDE] Simulating machine ID using test override: '$MachineOverride'"
    }

    # 2. License Validation
    $valData = Invoke-LicenseValidation -Key $LicenseKey -BaseUrl $BackendUrl
    if (-not $valData.valid) {
        Write-LogError "License key is invalid or revoked."
        exit 1
    }
    Write-LogSuccess "License key verified for product: $($valData.product_name) (License ID: $($valData.license_id))"

    # 3. Machine Activation
    $productCode = if ($valData.product_code) { $valData.product_code } else { "NAV-BRAHMI-DRIVER" }
    $actData = Invoke-MachineActivation -Key $LicenseKey -MachineId $machineId -ProductCode $productCode -BaseUrl $BackendUrl
    if (-not $actData.success -or -not $actData.activated) {
        Write-LogError "Machine activation failed."
        exit 1
    }
    $token = $actData.token
    Write-LogSuccess "Machine activation approved! Signed Ed25519 token received."

    # Save activation token to persistent location
    $tokenFile = $null
    $installDir = "C:\Program Files\NavBrahmi"
    try {
        if (-not (Test-Path $installDir)) {
            New-Item -ItemType Directory -Path $installDir -Force -ErrorAction Stop | Out-Null
        }
        $targetTokenFile = Join-Path $installDir "activation.token"
        Set-Content -Path $targetTokenFile -Value $token -Encoding UTF8 -ErrorAction Stop
        $tokenFile = $targetTokenFile
    } catch {
        $appDataDir = Join-Path $env:LOCALAPPDATA "NavBrahmi"
        New-Item -ItemType Directory -Path $appDataDir -Force -ErrorAction SilentlyContinue | Out-Null
        $targetTokenFile = Join-Path $appDataDir "activation.token"
        Set-Content -Path $targetTokenFile -Value $token -Encoding UTF8
        $tokenFile = $targetTokenFile
    }
    Write-LogInfo "Activation token saved to: $tokenFile"

    # 4. Package Download & SHA-256 Checksum Verification
    $downloadedFiles = Invoke-PackageDownloadAndVerification -ValidationData $valData -DestinationDir $TempDir

    # 5. Driver Package Installation
    $driverResult = Invoke-NavBrahmiDriverInstallation -PackageFiles $downloadedFiles -TargetDir $TempDir

    if ($driverResult.RebootRequired) {
        Write-Host "`n=============================================================================" -ForegroundColor Yellow
        Write-Host " NAV BRAHMI INSTALLATION COMPLETED (SYSTEM RESTART REQUIRED)" -ForegroundColor Yellow
        Write-Host " Product:       $($valData.product_name)" -ForegroundColor Yellow
        Write-Host " Machine ID:    $machineId" -ForegroundColor Yellow
        Write-Host " License ID:    $($valData.license_id)" -ForegroundColor Yellow
        Write-Host " Token File:    $tokenFile" -ForegroundColor Yellow
        Write-Host " Reboot Status: Driver installed. Please restart your computer to finalize." -ForegroundColor Yellow
        Write-Host "=============================================================================`n" -ForegroundColor Yellow
    } else {
        Write-Host "`n=============================================================================" -ForegroundColor Green
        Write-Host " NAV BRAHMI DRIVER INSTALLATION COMPLETED SUCCESSFULLY" -ForegroundColor Green
        Write-Host " Product:    $($valData.product_name)" -ForegroundColor Green
        Write-Host " Machine ID: $machineId" -ForegroundColor Green
        Write-Host " License ID: $($valData.license_id)" -ForegroundColor Green
        Write-Host " Token File: $tokenFile" -ForegroundColor Green
        Write-Host "=============================================================================`n" -ForegroundColor Green
    }

} catch {
    Write-Host "`n=============================================================================" -ForegroundColor Red
    Write-Host " NAV BRAHMI INSTALLATION FAILED" -ForegroundColor Red
    Write-Host " Error: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "=============================================================================`n" -ForegroundColor Red
    exit 1
} finally {
    # 6. Temporary File Cleanup
    if (Test-Path $TempDir) {
        Remove-Item -Path $TempDir -Recurse -Force -ErrorAction SilentlyContinue
    }
}
