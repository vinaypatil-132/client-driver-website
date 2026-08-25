# =============================================================================
# Windows Bootstrapper Pnputil Result & Exit-Code Test Suite
# Tests: Exit code 0 (Success), 3010 (Reboot Required), 5 (Failure/Access Denied), 259 (Non-Success)
# =============================================================================

$ErrorActionPreference = "Stop"

Write-Host "`n================================================================" -ForegroundColor Cyan
Write-Host " RUNNING WINDOWS BOOTSTRAPPER PNPUTIL EXIT-CODE TEST SUITE" -ForegroundColor Cyan
Write-Host "================================================================`n" -ForegroundColor Cyan

$passed = 0
$failed = 0

function Assert-Test([bool]$Condition, [string]$Title, [string]$Details = "") {
    if ($Condition) {
        Write-Host "✅ [PASS] $Title" -ForegroundColor Green
        if ($Details) { Write-Host "   $Details" -ForegroundColor Gray }
        $script:passed++
    } else {
        Write-Host "❌ [FAIL] $Title" -ForegroundColor Red
        if ($Details) { Write-Host "   $Details" -ForegroundColor Yellow }
        $script:failed++
    }
}

# 1. Syntax check on setup.ps1
$syntaxOk = $false
try {
    $scriptContent = Get-Content -Path "Requirements/windows-driver/setup.ps1" -Raw
    [System.Management.Automation.Language.Parser]::ParseInput($scriptContent, [ref]$null, [ref]$null) | Out-Null
    $syntaxOk = $true
} catch {
    $syntaxOk = $false
}
Assert-Test -Condition $syntaxOk -Title "1. setup.ps1 PowerShell abstract syntax tree parse check"

# Create a test harness directory
$testHarnessDir = Join-Path ([System.IO.Path]::GetTempPath()) "bootstrapper_test_harness_$([Guid]::NewGuid().ToString('N').Substring(0,8))"
New-Item -ItemType Directory -Path $testHarnessDir -Force | Out-Null

try {
    # Create a mock driver package zip with a dummy .inf
    $dummyPkgDir = Join-Path $testHarnessDir "dummy_pkg"
    New-Item -ItemType Directory -Path $dummyPkgDir -Force | Out-Null
    Set-Content -Path (Join-Path $dummyPkgDir "kbfiltr.inf") -Value "; Dummy test inf"
    $testZipPath = Join-Path $testHarnessDir "test-driver-pkg.zip"
    Compress-Archive -Path (Join-Path $dummyPkgDir "*") -DestinationPath $testZipPath -Force

    # Helper function to test Invoke-WindowsDriverInstallation isolated logic
    function Test-PnputilExitCodeBehavior([int]$MockCode, [string]$MockOutput) {
        $testTargetDir = Join-Path $testHarnessDir "target_$MockCode"
        New-Item -ItemType Directory -Path $testTargetDir -Force | Out-Null

        # Extract helper functions from setup.ps1
        $setupLines = Get-Content -Path "Requirements/windows-driver/setup.ps1"
        $funcLines = @()
        $inFunctions = $false
        foreach ($line in $setupLines) {
            if ($line -match "^function Write-LogInfo") {
                $inFunctions = $true
            }
            if ($line -match "MAIN BOOTSTRAPPER") {
                break
            }
            if ($inFunctions) {
                $funcLines += $line
            }
        }
        $funcScript = $funcLines -join "`r`n"

        $runnerFile = Join-Path $testHarnessDir "runner_$MockCode.ps1"
        $resultJsonFile = Join-Path $testHarnessDir "result_$MockCode.json"

        $runnerHeader = @"
`$ErrorActionPreference = 'Stop'

function pnputil {
    param([Parameter(ValueFromRemainingArguments=`$true)]`$allArgs)
    Write-Output '$MockOutput'
    `$global:LASTEXITCODE = $MockCode
}
"@
        $runnerFooter = @"
try {
    `$res = Invoke-WindowsDriverInstallation -PackageFiles @('$testZipPath') -TargetDir '$testTargetDir'
    [PSCustomObject]@{
        ThrewException = `$false
        Success        = `$res.Success
        RebootRequired = `$res.RebootRequired
        ErrorMessage   = ''
    } | ConvertTo-Json | Set-Content -Path '$resultJsonFile'
} catch {
    [PSCustomObject]@{
        ThrewException = `$true
        Success        = `$false
        RebootRequired = `$false
        ErrorMessage   = `$_.Exception.Message
    } | ConvertTo-Json | Set-Content -Path '$resultJsonFile'
}
"@
        Set-Content -Path $runnerFile -Value ($runnerHeader + "`r`n" + $funcScript + "`r`n" + $runnerFooter)

        $runnerOut = powershell -NoProfile -ExecutionPolicy Bypass -File $runnerFile 2>&1
        if (-not (Test-Path $resultJsonFile)) {
            Write-Host "Runner execution failed for code $MockCode. Output:`n$($runnerOut | Out-String)" -ForegroundColor Red
            return [PSCustomObject]@{
                ThrewException = $true
                Success        = $false
                RebootRequired = $false
                ErrorMessage   = "Runner failed: $($runnerOut | Out-String)"
            }
        }
        $parsed = Get-Content -Path $resultJsonFile -Raw | ConvertFrom-Json
        return $parsed
    }

    # TEST 2: pnputil Exit Code 0 -> Success without reboot
    $res0 = Test-PnputilExitCodeBehavior -MockCode 0 -MockOutput "Driver package added successfully."
    $pass0 = (-not $res0.ThrewException) -and ($res0.Success -eq $true) -and ($res0.RebootRequired -eq $false)
    Assert-Test -Condition $pass0 -Title "2. pnputil Exit Code 0: Installation succeeds without reboot required"

    # TEST 3: pnputil Exit Code 3010 -> Success with RebootRequired = true
    $res3010 = Test-PnputilExitCodeBehavior -MockCode 3010 -MockOutput "Driver package added. Reboot required."
    $pass3010 = (-not $res3010.ThrewException) -and ($res3010.Success -eq $true) -and ($res3010.RebootRequired -eq $true)
    Assert-Test -Condition $pass3010 -Title "3. pnputil Exit Code 3010: Installation succeeds with RebootRequired=true"

    # TEST 4: pnputil Exit Code 5 (Access Denied) -> Throws exception, does not continue
    $res5 = Test-PnputilExitCodeBehavior -MockCode 5 -MockOutput "Failed to add driver package: Access is denied."
    $pass5 = ($res5.ThrewException -eq $true) -and ($res5.ErrorMessage -match "exit code 5")
    Assert-Test -Condition $pass5 -Title "4. pnputil Exit Code 5: Throws exception and prevents false success" -Details "Caught: $($res5.ErrorMessage)"

    # TEST 5: pnputil Exit Code 259 -> Treated as non-zero error, throws exception
    $res259 = Test-PnputilExitCodeBehavior -MockCode 259 -MockOutput "Unexpected error 259."
    $pass259 = ($res259.ThrewException -eq $true) -and ($res259.ErrorMessage -match "exit code 259")
    Assert-Test -Condition $pass259 -Title "5. pnputil Exit Code 259: Treated as failure and throws exception" -Details "Caught: $($res259.ErrorMessage)"

    # TEST 6: End-to-End setup.ps1 execution test with exit code 5 (Failure)
    $purchaseRes = Invoke-RestMethod -Uri 'http://localhost:3000/api/purchase' -Method Post -ContentType 'application/json' -Body '{"email":"pnputil-fail-test@example.com"}'
    $testLicKey = $purchaseRes.licenseKey

    $stdoutFile = Join-Path $testHarnessDir "e2e_stdout.txt"
    $stderrFile = Join-Path $testHarnessDir "e2e_stderr.txt"

    $e2eRunnerScript = @"
function global:pnputil {
    param([Parameter(ValueFromRemainingArguments=`$true)]`$allArgs)
    Write-Output "Failed to add driver package: Access is denied."
    `$global:LASTEXITCODE = 5
}

& '$PSScriptRoot\..\Requirements\windows-driver\setup.ps1' -LicenseKey '$testLicKey' -BackendUrl 'http://localhost:3000'
exit `$LASTEXITCODE
"@
    $e2eRunnerFile = Join-Path $testHarnessDir "e2e_runner_file.ps1"
    Set-Content -Path $e2eRunnerFile -Value $e2eRunnerScript

    $proc = Start-Process -FilePath "powershell.exe" -ArgumentList "-NoProfile -ExecutionPolicy Bypass -File `"$e2eRunnerFile`"" -Wait -PassThru -NoNewWindow -RedirectStandardOutput $stdoutFile -RedirectStandardError $stderrFile

    $stdoutText = if (Test-Path $stdoutFile) { Get-Content -Path $stdoutFile -Raw } else { "" }

    $e2eExitCodeNonZero = $proc.ExitCode -ne 0
    $e2eHasFailBanner = $stdoutText -match "WINDOWS INSTALLATION BOOTSTRAPPER FAILED"
    $e2eHasNoSuccessBanner = -not ($stdoutText -match "WINDOWS INSTALLATION BOOTSTRAPPER COMPLETED SUCCESSFULLY")

    Assert-Test -Condition ($e2eExitCodeNonZero -and $e2eHasFailBanner -and $e2eHasNoSuccessBanner) -Title "6. End-to-End setup.ps1 failure with Exit Code 5: Exits non-zero, displays failure banner, NEVER prints success banner" -Details "Process Exit Code: $($proc.ExitCode)"

    # TEST 7: End-to-End setup.ps1 execution test with exit code 3010 (Reboot Required)
    $purchaseRes2 = Invoke-RestMethod -Uri 'http://localhost:3000/api/purchase' -Method Post -ContentType 'application/json' -Body '{"email":"pnputil-3010-test@example.com"}'
    $testLicKey2 = $purchaseRes2.licenseKey

    $stdout3010File = Join-Path $testHarnessDir "e2e_3010_stdout.txt"
    $stderr3010File = Join-Path $testHarnessDir "e2e_3010_stderr.txt"

    $e2e3010RunnerScript = @"
function global:pnputil {
    param([Parameter(ValueFromRemainingArguments=`$true)]`$allArgs)
    Write-Output "Driver package added successfully. Reboot required."
    `$global:LASTEXITCODE = 3010
}

& '$PSScriptRoot\..\Requirements\windows-driver\setup.ps1' -LicenseKey '$testLicKey2' -BackendUrl 'http://localhost:3000'
exit `$LASTEXITCODE
"@
    $e2e3010RunnerFile = Join-Path $testHarnessDir "e2e_3010_runner_file.ps1"
    Set-Content -Path $e2e3010RunnerFile -Value $e2e3010RunnerScript

    $proc3010 = Start-Process -FilePath "powershell.exe" -ArgumentList "-NoProfile -ExecutionPolicy Bypass -File `"$e2e3010RunnerFile`"" -Wait -PassThru -NoNewWindow -RedirectStandardOutput $stdout3010File -RedirectStandardError $stderr3010File

    $stdout3010Text = if (Test-Path $stdout3010File) { Get-Content -Path $stdout3010File -Raw } else { "" }

    $e2e3010ExitCodeSuccess = ($proc3010.ExitCode -eq 0 -or $proc3010.ExitCode -eq 3010)
    $e2e3010HasRebootBanner = $stdout3010Text -match "WINDOWS INSTALLATION BOOTSTRAPPER COMPLETED \(REBOOT REQUIRED\)"

    $stderr3010Text = if (Test-Path $stderr3010File) { Get-Content -Path $stderr3010File -Raw } else { "" }
    Assert-Test -Condition ($e2e3010ExitCodeSuccess -and $e2e3010HasRebootBanner) -Title "7. End-to-End setup.ps1 with Exit Code 3010: Exits with success/reboot-required status and displays REBOOT REQUIRED banner" -Details "Exit Code: $($proc3010.ExitCode)"

    # TEST 8: End-to-End setup.ps1 execution test with exit code 0 (Success)
    $purchaseRes3 = Invoke-RestMethod -Uri 'http://localhost:3000/api/purchase' -Method Post -ContentType 'application/json' -Body '{"email":"pnputil-0-test@example.com"}'
    $testLicKey3 = $purchaseRes3.licenseKey

    $stdout0File = Join-Path $testHarnessDir "e2e_0_stdout.txt"
    $stderr0File = Join-Path $testHarnessDir "e2e_0_stderr.txt"

    $e2e0RunnerScript = @"
function global:pnputil {
    param([Parameter(ValueFromRemainingArguments=`$true)]`$allArgs)
    Write-Output "Driver package added successfully."
    `$global:LASTEXITCODE = 0
}

& '$PSScriptRoot\..\Requirements\windows-driver\setup.ps1' -LicenseKey '$testLicKey3' -BackendUrl 'http://localhost:3000'
exit `$LASTEXITCODE
"@
    $e2e0RunnerFile = Join-Path $testHarnessDir "e2e_0_runner_file.ps1"
    Set-Content -Path $e2e0RunnerFile -Value $e2e0RunnerScript

    $proc0 = Start-Process -FilePath "powershell.exe" -ArgumentList "-NoProfile -ExecutionPolicy Bypass -File `"$e2e0RunnerFile`"" -Wait -PassThru -NoNewWindow -RedirectStandardOutput $stdout0File -RedirectStandardError $stderr0File

    $stdout0Text = if (Test-Path $stdout0File) { Get-Content -Path $stdout0File -Raw } else { "" }
    $stderr0Text = if (Test-Path $stderr0File) { Get-Content -Path $stderr0File -Raw } else { "" }

    $e2e0ExitCodeZero = $proc0.ExitCode -eq 0
    $e2e0HasSuccessBanner = $stdout0Text -match "WINDOWS INSTALLATION BOOTSTRAPPER COMPLETED SUCCESSFULLY"

    Assert-Test -Condition ($e2e0ExitCodeZero -and $e2e0HasSuccessBanner) -Title "8. End-to-End setup.ps1 with Exit Code 0: Exits 0 and displays COMPLETED SUCCESSFULLY banner" -Details "Exit Code: $($proc0.ExitCode)`nStdout: $stdout0Text`nStderr: $stderr0Text"

} finally {
    if (Test-Path $testHarnessDir) {
        Remove-Item -Path $testHarnessDir -Recurse -Force -ErrorAction SilentlyContinue
    }
}

Write-Host "`n----------------------------------------------------------------" -ForegroundColor Cyan
Write-Host " PNPUTIL TEST SUITE SUMMARY: $passed PASSED, $failed FAILED" -ForegroundColor Cyan
Write-Host "----------------------------------------------------------------`n" -ForegroundColor Cyan

if ($failed -gt 0) {
    exit 1
}
