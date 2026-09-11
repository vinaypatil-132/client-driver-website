import fs from 'fs';
import path from 'path';
import os from 'os';
import crypto from 'crypto';
import { execSync } from 'child_process';
import { prisma } from '../src/lib/prisma';
import { verifyPurchaseAuthToken } from '../src/lib/license';

const BACKEND_URL = 'http://localhost:3000';

async function safeFetch(url: string, options?: RequestInit, maxRetries = 3): Promise<Response> {
  let lastError;
  for (let i = 0; i < maxRetries; i++) {
    try {
      const res = await fetch(url, options);
      return res;
    } catch (err) {
      lastError = err;
      await new Promise((r) => setTimeout(r, 400));
    }
  }
  throw lastError;
}

async function main() {
  console.log('================================================================');
  console.log(' TESTING USER-FRIENDLY AUTO-LICENSE & RECOVERY INSTALLATION FLOW');
  console.log('================================================================\n');

  let passed = 0;
  let failed = 0;

  function assertTest(condition: boolean, title: string, details?: string) {
    if (condition) {
      console.log(`✅ [PASS] ${title}`);
      if (details) console.log(`   ${details}`);
      passed++;
    } else {
      console.error(`❌ [FAIL] ${title}`);
      if (details) console.error(`   ${details}`);
      failed++;
    }
  }

  // -------------------------------------------------------------
  // TEST 1: Purchase flow & Pre-Authorized Setup.exe Generation
  // -------------------------------------------------------------
  const customerEmail = `auto-license-user-${Date.now()}@example.com`;
  console.log(`1. Simulating customer purchase for: ${customerEmail}`);

  const purchaseRes = await safeFetch(`${BACKEND_URL}/api/purchase`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: customerEmail,
      productName: 'Nav Brahmi — Brahmi Tamil Grantha (2026)',
    }),
  });

  const purchaseData = await purchaseRes.json();
  assertTest(
    purchaseRes.ok && purchaseData.success && !!purchaseData.licenseKey,
    'Step 1: Purchase completed and license generated in PostgreSQL',
    `License: ${purchaseData.licenseKey} | Product: ${purchaseData.product?.name}`
  );

  const rawLicenseKey = purchaseData.licenseKey;

  // -------------------------------------------------------------
  // TEST 2: Download Pre-Authorized Setup.exe
  // -------------------------------------------------------------
  console.log('\n2. Downloading pre-authorized Setup.exe via /api/download-installer...');
  const downloadUrl = `${BACKEND_URL}/api/download-installer?platform=windows&licenseKey=${encodeURIComponent(rawLicenseKey)}`;
  const downloadRes = await safeFetch(downloadUrl);

  if (!downloadRes.ok) {
    throw new Error(`Download failed with status ${downloadRes.status}`);
  }

  const exeBuffer = Buffer.from(await downloadRes.arrayBuffer());
  const isPE = exeBuffer[0] === 0x4d && exeBuffer[1] === 0x5a; // 'MZ'

  assertTest(
    isPE && exeBuffer.length > 25000,
    'Step 2: Downloaded binary is valid Windows PE executable (Setup.exe)',
    `Size: ${exeBuffer.length} bytes | Magic: MZ`
  );

  // -------------------------------------------------------------
  // TEST 3: Verify Embedded Authorization Payload in Binary Footer
  // -------------------------------------------------------------
  console.log('\n3. Verifying embedded authorization payload in binary footer...');
  const exeTail = exeBuffer.slice(Math.max(0, exeBuffer.length - 4096)).toString('utf-8');
  const startTag = '---NAV_BRAHMI_AUTH_START---';
  const endTag = '---NAV_BRAHMI_AUTH_END---';
  const hasTags = exeTail.includes(startTag) && exeTail.includes(endTag);

  let embeddedKey = '';
  let embeddedToken = '';

  if (hasTags) {
    const sIdx = exeTail.indexOf(startTag) + startTag.length;
    const eIdx = exeTail.indexOf(endTag);
    const jsonStr = exeTail.substring(sIdx, eIdx).trim();
    try {
      const parsed = JSON.parse(jsonStr);
      embeddedKey = parsed.licenseKey;
      embeddedToken = parsed.token;
    } catch (e) {
      console.error('Failed to parse embedded json:', e);
    }
  }

  const tokenVerified = embeddedToken ? verifyPurchaseAuthToken(embeddedToken) : { valid: false };

  assertTest(
    hasTags &&
      embeddedKey === rawLicenseKey &&
      tokenVerified.valid &&
      tokenVerified.payload?.license_key === rawLicenseKey,
    'Step 3: Appended authorization payload contains cryptographically signed purchase token',
    `Embedded Key: ${embeddedKey} | Token valid: ${tokenVerified.valid}`
  );

  // -------------------------------------------------------------
  // TEST 4: Token Resolution API (/api/license/resolve-token)
  // -------------------------------------------------------------
  console.log('\n4. Testing /api/license/resolve-token endpoint...');
  const resolveRes = await safeFetch(`${BACKEND_URL}/api/license/resolve-token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token: embeddedToken }),
  });
  const resolveData = await resolveRes.json();

  assertTest(
    resolveRes.ok &&
      resolveData.success &&
      resolveData.license_key === rawLicenseKey &&
      resolveData.email === customerEmail,
    'Step 4: Token resolution API securely resolves token to active customer license',
    `Resolved License: ${resolveData.license_key} | Email: ${resolveData.email}`
  );

  // -------------------------------------------------------------
  // TEST 5: Automatic License Identification Execution (Setup.exe)
  // -------------------------------------------------------------
  console.log('\n5. Executing pre-authorized Setup.exe (Testing Automatic License Detection)...');
  const tempExePath = path.resolve(os.tmpdir(), `Setup-Authorized-Test-${Date.now()}.exe`);
  fs.writeFileSync(tempExePath, exeBuffer);

  try {
    // Run Setup.exe silently WITHOUT passing -LicenseKey. It must auto-detect from the payload!
    const cmd = `cmd.exe /c "\"${tempExePath}\" -Silent -MachineOverride AUTO_DETECT_TEST_MACHINE_1"`;
    console.log(`   Running: ${cmd}`);
    execSync(cmd, { encoding: 'utf-8' });

    assertTest(
      true,
      'Step 5: Setup.exe auto-identified license from payload and installed without manual input!'
    );
  } catch (err: any) {
    console.error('Execution failed:', err.stdout || err.message);
    assertTest(false, 'Step 5: Setup.exe execution with auto-detected license failed');
  } finally {
    if (fs.existsSync(tempExePath)) {
      try {
        fs.unlinkSync(tempExePath);
      } catch {}
    }
  }

  // -------------------------------------------------------------
  // TEST 6: Customer License Recovery Flow (/api/license/recover)
  // -------------------------------------------------------------
  console.log('\n6. Testing Lost License Recovery flow for customer email...');
  const recoverRes = await safeFetch(`${BACKEND_URL}/api/license/recover`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: customerEmail }),
  });
  const recoverData = await recoverRes.json();

  const recoveredLicense = recoverData.licenses?.[0];
  assertTest(
    recoverRes.ok &&
      recoverData.success &&
      recoverData.count >= 1 &&
      recoveredLicense?.license_key === rawLicenseKey &&
      recoveredLicense?.download_url.includes('/api/download-installer?platform=windows&token='),
    'Step 6: Customer recovery API returned active licenses and pre-authorized download link',
    `Found ${recoverData.count} license(s) | Pre-authorized download URL provided`
  );

  // -------------------------------------------------------------
  // TEST 7: Download and Execute from Recovered Download URL (Customer PC)
  // -------------------------------------------------------------
  console.log('\n7. Downloading installer using the recovered pre-authorized download URL...');
  const recDownloadUrl = `${BACKEND_URL}${recoveredLicense.download_url}`;
  const recDownloadRes = await safeFetch(recDownloadUrl);
  const recExeBuffer = Buffer.from(await recDownloadRes.arrayBuffer());

  const tempRecExePath = path.resolve(os.tmpdir(), `Setup-Recovered-Test-${Date.now()}.exe`);
  fs.writeFileSync(tempRecExePath, recExeBuffer);

  try {
    const cmd = `cmd.exe /c "\"${tempRecExePath}\" -Silent -MachineOverride AUTO_DETECT_TEST_MACHINE_1"`;
    console.log(`   Running: ${cmd}`);
    execSync(cmd, { encoding: 'utf-8' });

    assertTest(
      true,
      'Step 7: Recovered Setup.exe auto-detected license and completed machine activation on customer machine!'
    );
  } catch (err: any) {
    console.error('Recovered execution failed:', err.stdout || err.message);
    assertTest(false, 'Step 7: Execution of recovered Setup.exe failed');
  } finally {
    if (fs.existsSync(tempRecExePath)) {
      try {
        fs.unlinkSync(tempRecExePath);
      } catch {}
    }
  }

  // -------------------------------------------------------------
  // TEST 8: Manual License Key Entry Fallback
  // -------------------------------------------------------------
  console.log('\n8. Testing manual license key fallback on generic un-appended Setup.exe...');
  // Create a fresh purchase to test manual license key entry fallback
  const manualCustomerEmail = `manual-key-user-${Date.now()}@example.com`;
  const manualPurchaseRes = await safeFetch(`${BACKEND_URL}/api/purchase`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: manualCustomerEmail,
      productName: 'Nav Brahmi — Brahmi Tamil Grantha (2026)',
    }),
  });
  const manualPurchaseData = await manualPurchaseRes.json();
  const manualLicenseKey = manualPurchaseData.licenseKey;

  const genericExePath = path.resolve(process.cwd(), 'Requirements', 'windows-driver', 'Setup.exe');

  try {
    // Run generic Setup.exe with manual -LicenseKey argument
    const cmd = `cmd.exe /c "\"${genericExePath}\" -Silent -LicenseKey \"${manualLicenseKey}\" -MachineOverride MANUAL_KEY_TEST_MACHINE"`;
    console.log(`   Running: ${cmd}`);
    execSync(cmd, { encoding: 'utf-8' });

    assertTest(
      true,
      'Step 8: Manual License Key entry fallback succeeded on generic Setup.exe'
    );
  } catch (err: any) {
    console.error('Manual fallback execution failed:', err.stdout || err.message);
    assertTest(false, 'Step 8: Manual license key entry fallback failed');
  }

  // -------------------------------------------------------------
  // SUMMARY
  // -------------------------------------------------------------
  console.log('\n================================================================');
  console.log(` AUTO-LICENSE & RECOVERY TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
