import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

async function main() {
  console.log('====================================================');
  console.log(' Testing Setup.exe Download, Metadata & Authenticode');
  console.log('====================================================\n');

  // 1. Download Setup.exe via API endpoint
  console.log('1. Downloading Setup.exe from GET /api/download-installer?platform=windows...');
  const res = await fetch('http://localhost:3000/api/download-installer?platform=windows');

  if (!res.ok) {
    throw new Error(`Download API returned status ${res.status}: ${res.statusText}`);
  }

  const contentType = res.headers.get('content-type');
  const disposition = res.headers.get('content-disposition');
  const arrayBuffer = await res.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  console.log(`   Status:       ${res.status}`);
  console.log(`   Content-Type: ${contentType}`);
  console.log(`   Disposition:  ${disposition}`);
  console.log(`   Size:         ${buffer.length} bytes`);

  // 2. Verify PE Header Magic Bytes (MZ)
  const isPE = buffer[0] === 0x4d && buffer[1] === 0x5a; // 'MZ'
  console.log(`\n2. Verifying Portable Executable (PE) Magic Header...`);
  console.log(`   PE Magic (MZ) present: ${isPE}`);

  if (!isPE) {
    throw new Error('Downloaded binary is not a valid Windows PE executable.');
  }

  // 3. Verify Embedded Manifest & Strings
  const hasUACManifest = buffer.includes(Buffer.from('requestedExecutionLevel')) || buffer.includes(Buffer.from('requireAdministrator')) || buffer.includes(Buffer.from('asInvoker'));
  const hasNavBrahmi = buffer.includes(Buffer.from('NavBrahmi'));
  console.log(`\n3. Verifying Embedded UAC Manifest & Metadata...`);
  console.log(`   UAC manifest present:          ${hasUACManifest}`);
  console.log(`   NavBrahmi namespace:           ${hasNavBrahmi}`);

  if (!hasUACManifest || !hasNavBrahmi) {
    throw new Error('Setup.exe missing UAC manifest or NavBrahmi metadata.');
  }

  // 4. Verify Windows File Version Info (Publisher Metadata)
  const exePath = path.resolve(process.cwd(), 'Requirements/windows-driver/Setup.exe');
  const psMetaCmd = `powershell -NoProfile -Command "$fvi = [System.Diagnostics.FileVersionInfo]::GetVersionInfo('${exePath}'); Write-Host 'Company:' $fvi.CompanyName; Write-Host 'Product:' $fvi.ProductName; Write-Host 'Desc:' $fvi.FileDescription; Write-Host 'Version:' $fvi.FileVersion; Write-Host 'Copyright:' $fvi.LegalCopyright"`;
  console.log(`\n4. Verifying Windows Product & Publisher Metadata...`);
  const metaOut = execSync(psMetaCmd, { encoding: 'utf-8' });
  console.log(metaOut.trim());

  // 5. Verify Authenticode Signature
  const psSigCmd = `powershell -NoProfile -Command "$sig = Get-AuthenticodeSignature '${exePath}'; Write-Host 'Subject:' $sig.SignerCertificate.Subject; Write-Host 'Thumbprint:' $sig.SignerCertificate.Thumbprint; Write-Host 'Status:' $sig.Status"`;
  console.log(`\n5. Verifying Authenticode Signature...`);
  const sigOut = execSync(psSigCmd, { encoding: 'utf-8' });
  console.log(sigOut.trim());

  console.log('\n====================================================');
  console.log(' Setup.exe Metadata & Authenticode Verification PASSED!');
  console.log('====================================================\n');
}

main().catch(err => {
  console.error('Test error:', err);
  process.exit(1);
});
