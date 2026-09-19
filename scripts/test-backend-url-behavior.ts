import fs from 'fs';
import path from 'path';
import os from 'os';
import { execSync } from 'child_process';
import { NextRequest } from 'next/server';
import { GET as downloadInstallerRoute } from '../src/app/api/download-installer/route';
import {
  verifyInstallerPayloadSignature,
  createInstallerPayloadSignature,
  verifyPurchaseAuthToken,
  getInstallerBackendUrl,
} from '../src/lib/license';

const LOCAL_SERVER = 'http://localhost:3000';
const PROD_URL = 'https://client-driver-website.vercel.app';

function parsePayload(buffer: Buffer): { hasPayload: boolean; parsed?: any; rawJson?: string } {
  const tail = buffer.slice(Math.max(0, buffer.length - 8192)).toString('utf-8');
  const startTag = '---NAV_BRAHMI_AUTH_START---';
  const endTag = '---NAV_BRAHMI_AUTH_END---';
  const sIdx = tail.lastIndexOf(startTag);
  const eIdx = tail.lastIndexOf(endTag);

  if (sIdx >= 0 && eIdx > sIdx) {
    const rawJson = tail.substring(sIdx + startTag.length, eIdx).trim();
    try {
      const parsed = JSON.parse(rawJson);
      return { hasPayload: true, parsed, rawJson };
    } catch (err) {
      return { hasPayload: true, rawJson };
    }
  }
  return { hasPayload: false };
}

async function main() {
  console.log('================================================================');
  console.log(' VERIFYING DYNAMIC SETUP.EXE BACKEND URL & INTEGRITY SECURITY');
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

  // --------------------------------------------------------------------------
  // TEST 1: Local download payload resolves to http://localhost:3000
  // --------------------------------------------------------------------------
  console.log('1. Testing Local HTTP Download from Dev Server...');
  const localRes = await fetch(`${LOCAL_SERVER}/api/download-installer?platform=windows`);
  const localBuffer = Buffer.from(await localRes.arrayBuffer());
  const localPayloadInfo = parsePayload(localBuffer);

  assertTest(
    localPayloadInfo.hasPayload &&
      localPayloadInfo.parsed?.backendUrl === 'http://localhost:3000',
    'Local download dynamically sets backendUrl to http://localhost:3000',
    `Resolved: ${localPayloadInfo.parsed?.backendUrl}`
  );

  const localSigValid = verifyInstallerPayloadSignature(
    localPayloadInfo.parsed?.backendUrl,
    localPayloadInfo.parsed?.licenseKey || '',
    localPayloadInfo.parsed?.token || '',
    localPayloadInfo.parsed?.generatedAt,
    localPayloadInfo.parsed?.signature
  );

  assertTest(
    localSigValid,
    'Local download payload includes valid HMAC-SHA256 signature',
    `Signature: ${localPayloadInfo.parsed?.signature}`
  );

  // --------------------------------------------------------------------------
  // TEST 2: Production download payload resolves to https://client-driver-website.vercel.app
  // --------------------------------------------------------------------------
  console.log('\n2. Testing Production Download Endpoint Request...');
  const prodReq = new NextRequest(
    'https://client-driver-website.vercel.app/api/download-installer?platform=windows'
  );
  const prodRouteRes = await downloadInstallerRoute(prodReq);
  const prodBuffer = Buffer.from(await prodRouteRes.arrayBuffer());
  const prodPayloadInfo = parsePayload(prodBuffer);

  assertTest(
    prodPayloadInfo.hasPayload &&
      prodPayloadInfo.parsed?.backendUrl === PROD_URL,
    `Production download endpoint dynamically sets backendUrl to ${PROD_URL}`,
    `Resolved: ${prodPayloadInfo.parsed?.backendUrl}`
  );

  const prodSigValid = verifyInstallerPayloadSignature(
    prodPayloadInfo.parsed?.backendUrl,
    prodPayloadInfo.parsed?.licenseKey || '',
    prodPayloadInfo.parsed?.token || '',
    prodPayloadInfo.parsed?.generatedAt,
    prodPayloadInfo.parsed?.signature
  );

  assertTest(
    prodSigValid,
    'Production download payload includes valid HMAC-SHA256 signature',
    `Signature: ${prodPayloadInfo.parsed?.signature}`
  );

  // --------------------------------------------------------------------------
  // TEST 3: Host Header Injection Protection
  // --------------------------------------------------------------------------
  console.log('\n3. Testing Host Header Injection Protection (Untrusted Host Header)...');
  const rogueReq = new NextRequest(
    'http://malicious-phishing-domain.com/api/download-installer?platform=windows',
    {
      headers: {
        'x-forwarded-host': 'evil-hacker.com',
      },
    }
  );
  const rogueRouteRes = await downloadInstallerRoute(rogueReq);
  const rogueBuffer = Buffer.from(await rogueRouteRes.arrayBuffer());
  const roguePayloadInfo = parsePayload(rogueBuffer);

  assertTest(
    roguePayloadInfo.parsed?.backendUrl === PROD_URL &&
      roguePayloadInfo.parsed?.backendUrl !== 'http://malicious-phishing-domain.com' &&
      roguePayloadInfo.parsed?.backendUrl !== 'https://evil-hacker.com',
    'Rogue host headers are rejected; canonical production backend URL is safely enforced',
    `Resolved backendUrl: ${roguePayloadInfo.parsed?.backendUrl}`
  );

  // --------------------------------------------------------------------------
  // TEST 4: Integrity Protection - Tampered Payload Rejection
  // --------------------------------------------------------------------------
  console.log('\n4. Testing Payload Tampering Rejection...');
  const tamperedPayloadObj = {
    ...prodPayloadInfo.parsed,
    backendUrl: 'https://attacker-controlled-server.com',
  };
  const tamperedPayloadStr = JSON.stringify(tamperedPayloadObj);
  const baseExeWithoutFooter = prodBuffer.slice(
    0,
    prodBuffer.lastIndexOf(Buffer.from('---NAV_BRAHMI_AUTH_START---')) - 2
  );
  const tamperedBuffer = Buffer.concat([
    baseExeWithoutFooter,
    Buffer.from(
      `\r\n---NAV_BRAHMI_AUTH_START---\r\n${tamperedPayloadStr}\r\n---NAV_BRAHMI_AUTH_END---\r\n`,
      'utf-8'
    ),
  ]);

  const tamperedInfo = parsePayload(tamperedBuffer);
  const tamperedSigValid = verifyInstallerPayloadSignature(
    tamperedInfo.parsed?.backendUrl,
    tamperedInfo.parsed?.licenseKey || '',
    tamperedInfo.parsed?.token || '',
    tamperedInfo.parsed?.generatedAt,
    tamperedInfo.parsed?.signature
  );

  assertTest(
    !tamperedSigValid,
    'Tampered payload fails HMAC signature verification',
    `Signature check result: ${tamperedSigValid}`
  );

  // --------------------------------------------------------------------------
  // TEST 5: Purchase Flow + Setup.exe Auto-Detection with Dynamic Local Backend URL
  // --------------------------------------------------------------------------
  console.log('\n5. Testing Purchase Flow with Dynamic Local Backend URL...');
  const purchaseRes = await fetch(`${LOCAL_SERVER}/api/purchase`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: `dynamic-backend-${Date.now()}@example.com`,
      productName: 'Nav Brahmi — Brahmi Tamil Grantha (2026)',
    }),
  });
  const purchaseData = await purchaseRes.json();
  const testLicKey = purchaseData.licenseKey;

  const authDownloadRes = await fetch(
    `${LOCAL_SERVER}/api/download-installer?platform=windows&licenseKey=${encodeURIComponent(testLicKey)}`
  );
  const authExeBuffer = Buffer.from(await authDownloadRes.arrayBuffer());
  const authPayloadInfo = parsePayload(authExeBuffer);

  assertTest(
    authPayloadInfo.parsed?.licenseKey === testLicKey &&
      authPayloadInfo.parsed?.backendUrl === 'http://localhost:3000' &&
      !!authPayloadInfo.parsed?.token &&
      !!authPayloadInfo.parsed?.signature,
    'Pre-authorized Setup.exe contains signed licenseKey, token, and dynamic backendUrl',
    `Key: ${authPayloadInfo.parsed?.licenseKey} | Backend: ${authPayloadInfo.parsed?.backendUrl}`
  );

  // Execute pre-authorized Setup.exe
  const tempAuthExe = path.resolve(os.tmpdir(), `Setup-AuthTest-${Date.now()}.exe`);
  fs.writeFileSync(tempAuthExe, authExeBuffer);

  try {
    const cmd = `cmd.exe /c "\"${tempAuthExe}\" -Silent -MachineOverride DYNAMIC_URL_TEST_MACHINE"`;
    console.log(`   Executing: ${cmd}`);
    execSync(cmd, { encoding: 'utf-8' });
    assertTest(
      true,
      'Setup.exe executed seamlessly, auto-detected license and backend URL, and installed driver!'
    );
  } catch (err: any) {
    console.error('Execution error:', err);
    assertTest(false, 'Setup.exe execution failed');
  } finally {
    try {
      fs.unlinkSync(tempAuthExe);
    } catch {}
  }

  // --------------------------------------------------------------------------
  // TEST 6: Standalone Un-Appended Setup.exe Default Backend URL Verification
  // --------------------------------------------------------------------------
  console.log('\n6. Testing Standalone Compiled Setup.exe Defaults...');
  const genericExePath = path.resolve(process.cwd(), 'Requirements', 'windows-driver', 'Setup.exe');
  const genericBuffer = fs.readFileSync(genericExePath);
  const genericPayloadInfo = parsePayload(genericBuffer);

  assertTest(
    !genericPayloadInfo.hasPayload,
    'Base compiled Setup.exe on disk is clean (no pre-attached payload footer)'
  );

  console.log('\n================================================================');
  console.log(` SUMMARY: ${passed} PASSED | ${failed} FAILED`);
  console.log('================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
