<#
.SYNOPSIS
    Authenticode Code Signing Helper for Setup.exe
.DESCRIPTION
    Signs Setup.exe with Authenticode using a production PFX certificate (if provided)
    or generates and uses a dedicated demonstration/test code signing certificate.
#>

param(
    [string]$ExePath = "Requirements\windows-driver\Setup.exe",
    [string]$PfxPath = $env:CODE_SIGNING_PFX_PATH,
    [string]$PfxPassword = $env:CODE_SIGNING_PFX_PASSWORD
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path $ExePath)) {
    Write-Error "Target executable not found at: $ExePath"
    exit 1
}

Write-Host "====================================================" -ForegroundColor Cyan
Write-Host " Nav Brahmi Authenticode Code Signing" -ForegroundColor Cyan
Write-Host "====================================================" -ForegroundColor Cyan
Write-Host "Target: $ExePath"

$cert = $null

# 1. Check for Production PFX Certificate
if ($PfxPath -and (Test-Path $PfxPath)) {
    Write-Host "[SIGN] Loading production/custom PFX certificate: $PfxPath" -ForegroundColor Green
    $secPass = if ($PfxPassword) { ConvertTo-SecureString $PfxPassword -AsPlainText -Force } else { $null }
    $cert = Get-PfxCertificate -FilePath $PfxPath
} else {
    # 2. Look for existing Test Code Signing Certificate in CurrentUser\My
    $existingCerts = Get-ChildItem -Path Cert:\CurrentUser\My -CodeSigningCert | Where-Object { $_.Subject -like "*Nav Brahmi*" }
    if ($existingCerts) {
        $cert = $existingCerts | Select-Object -First 1
        Write-Host "[SIGN] Using existing demonstration code signing certificate (Thumbprint: $($cert.Thumbprint))" -ForegroundColor Yellow
    } else {
        Write-Host "[SIGN] Generating self-signed demonstration code signing certificate..." -ForegroundColor Yellow
        $cert = New-SelfSignedCertificate `
            -Type CodeSigningCert `
            -Subject "CN=Nav Brahmi (Demonstration / Test Code Signing)" `
            -CertStoreLocation "Cert:\CurrentUser\My" `
            -HashAlgorithm "SHA256" `
            -NotAfter (Get-Date).AddYears(3)
        Write-Host "[SIGN] Created demonstration certificate (Thumbprint: $($cert.Thumbprint))" -ForegroundColor Yellow
    }
}

if (-not $cert) {
    Write-Error "Failed to obtain a code signing certificate."
    exit 1
}

# 3. Apply Authenticode Signature
Write-Host "[SIGN] Applying Authenticode signature (SHA-256)..."
$sigResult = Set-AuthenticodeSignature -FilePath $ExePath -Certificate $cert -HashAlgorithm SHA256

# 4. Verify Signature & Output Metadata
Write-Host "`n[VERIFY] Verifying Authenticode Signature..."
$verify = Get-AuthenticodeSignature -FilePath $ExePath

Write-Host "  Signer Subject: $($verify.SignerCertificate.Subject)"
Write-Host "  Signer Issuer:  $($verify.SignerCertificate.Issuer)"
Write-Host "  Thumbprint:     $($verify.SignerCertificate.Thumbprint)"
Write-Host "  Status:         $($verify.Status)"
Write-Host "  Status Message: $($verify.StatusMessage)"

# 5. Verify Windows File Version Info (Publisher Metadata)
$fvi = [System.Diagnostics.FileVersionInfo]::GetVersionInfo((Resolve-Path $ExePath).Path)
Write-Host "`n[METADATA] File & Product Properties:"
Write-Host "  File Description: $($fvi.FileDescription)"
Write-Host "  Product Name:     $($fvi.ProductName)"
Write-Host "  Company Name:     $($fvi.CompanyName)"
Write-Host "  Legal Copyright:  $($fvi.LegalCopyright)"
Write-Host "  File Version:     $($fvi.FileVersion)"
Write-Host "  Product Version:  $($fvi.ProductVersion)"

Write-Host "`n====================================================" -ForegroundColor Green
Write-Host " Authenticode Signing & Metadata Configuration Complete!" -ForegroundColor Green
Write-Host " (Demonstration certificate applied; ready for CA re-signing)" -ForegroundColor Gray
Write-Host "====================================================`n" -ForegroundColor Green
