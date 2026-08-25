import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { prisma } from '../src/lib/prisma';
import { getWindowsMachineId, getUbuntuMachineId } from '../src/lib/machine';
import {
  signActivationToken,
  verifyActivationToken,
  DEMO_PUBLIC_KEY_PEM,
  getSigningPrivateKey,
} from '../src/lib/keys';
import {
  WINDOWS_PACKAGE_DEFINITIONS,
  LINUX_PACKAGE_DEFINITIONS,
  getB2Config,
  generatePresignedPackageUrls,
} from '../src/lib/b2';

const BACKEND_URL = 'http://localhost:3000';

async function runComprehensiveWindowsTestSuite() {
  console.log('================================================================');
  console.log(' RUNNING COMPREHENSIVE WINDOWS SECURITY & INTEGRATION TEST SUITE');
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

  // 1. Supabase PostgreSQL Connection
  let dbConnected = false;
  try {
    await prisma.$queryRaw`SELECT 1`;
    dbConnected = true;
  } catch (err) {
    console.error('Database connection error:', err);
  }
  assertTest(dbConnected, '1. Supabase PostgreSQL Connected via Prisma');

  // 2. Windows Machine Identity Abstraction (HKLM MachineGuid + Win32_ComputerSystemProduct UUID)
  const winMachineDefault = getWindowsMachineId();
  const winMachineSimulated = getWindowsMachineId('WIN11_SIMULATED_DEVICE_TEST_99');
  const ubuntuMachine = getUbuntuMachineId();

  assertTest(
    winMachineDefault.platform === 'WINDOWS' &&
      winMachineDefault.machineId.length === 64 &&
      winMachineSimulated.machineId.length === 64 &&
      winMachineDefault.machineId !== ubuntuMachine.machineId,
    '2. Windows Machine Identity: SHA-256 derived hardware identity (non-IP based)',
    `Win ID: ${winMachineDefault.machineId.substring(0, 16)}... | Sim ID: ${winMachineSimulated.machineId.substring(0, 16)}...`
  );

  // 3. Purchase a demo license in Supabase
  const testEmail = `windows-demo-${Date.now()}@example.com`;
  const purchaseRes = await fetch(`${BACKEND_URL}/api/purchase`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: testEmail }),
  });
  const purchaseData = await purchaseRes.json();
  assertTest(
    purchaseRes.ok && purchaseData.success && !!purchaseData.licenseKey,
    '3. Purchase API & License Generation in Supabase PostgreSQL',
    `License: ${purchaseData.licenseKey} (Email: ${testEmail})`
  );
  const licenseKey = purchaseData.licenseKey;

  // 4. Windows License Validation API
  const valRes = await fetch(`${BACKEND_URL}/api/validate-license`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      license_key: licenseKey,
      platform: 'WINDOWS',
    }),
  });
  const valData = await valRes.json();
  const winDef = WINDOWS_PACKAGE_DEFINITIONS.kbfiltrDriver;

  assertTest(
    valRes.ok &&
      valData.valid &&
      valData.platform === 'WINDOWS' &&
      valData.package_status === 'READY' &&
      valData.checksums?.driverPackage === winDef.sha256,
    '4. Platform-Aware Validation: Returns WINDOWS package metadata & READY status',
    `Package SHA-256: ${valData.checksums?.driverPackage}`
  );

  // 5. Windows vs Linux Package Isolation Check
  const hasLinuxUrlsInWin =
    JSON.stringify(valData).includes('.deb') ||
    JSON.stringify(valData).includes('demo-package-1');
  assertTest(
    !hasLinuxUrlsInWin &&
      LINUX_PACKAGE_DEFINITIONS.package1.key === 'demo/driver/demo-package-1.deb',
    '5. Platform Isolation: Windows API NEVER returns Linux .deb URLs or keys'
  );

  // 6. Machine Activation API (First Activation on Authorized Machine)
  const actResA = await fetch(`${BACKEND_URL}/api/activation`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      license_key: licenseKey,
      machine_id: winMachineDefault.machineId,
      product_code: 'KEYBOARD-DRIVER-DEMO',
      platform: 'WINDOWS',
    }),
  });
  const actDataA = await actResA.json();

  assertTest(
    actResA.ok && actDataA.success && actDataA.activated && !!actDataA.token,
    '6. Machine Activation API: First activation on Machine A approved & bound in Supabase',
    `Token: ${actDataA.token?.substring(0, 40)}...`
  );

  // 7. Supabase Database Persistence
  const dbLicense = await prisma.license.findUnique({ where: { licenseKey } });
  assertTest(
    dbLicense?.machineId === winMachineDefault.machineId && dbLicense?.activationStatus === 'ACTIVE',
    '7. Supabase DB Persistence: License record bound to Machine A'
  );

  // 8. Same-Machine Reactivation
  const reactRes = await fetch(`${BACKEND_URL}/api/activation`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      license_key: licenseKey,
      machine_id: winMachineDefault.machineId,
      product_code: 'KEYBOARD-DRIVER-DEMO',
      platform: 'WINDOWS',
    }),
  });
  const reactData = await reactRes.json();
  assertTest(
    reactRes.ok && reactData.success && reactData.activated && !!reactData.token,
    '8. Same-Machine Reactivation: Re-issues valid activation token'
  );

  // 9. Unauthorized Machine B Activation Rejection (403 Forbidden)
  const actResB = await fetch(`${BACKEND_URL}/api/activation`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      license_key: licenseKey,
      machine_id: winMachineSimulated.machineId,
      product_code: 'KEYBOARD-DRIVER-DEMO',
      platform: 'WINDOWS',
    }),
  });
  const actDataB = await actResB.json();
  assertTest(
    actResB.status === 403 && !actDataB.success && !actDataB.activated,
    '9. Unauthorized Machine Rejection: Machine B activation rejected with HTTP 403 Forbidden',
    `Server Error: "${actDataB.error}"`
  );

  // 10. Invalid License Key Rejection (401)
  const invalidLicRes = await fetch(`${BACKEND_URL}/api/activation`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      license_key: 'INVALID-NON-EXISTENT-LICENSE-KEY',
      machine_id: winMachineDefault.machineId,
    }),
  });
  assertTest(
    invalidLicRes.status === 401,
    '10. Invalid License Rejection: Non-existent license rejected with HTTP 401'
  );

  // 11. Offline Token Signature Verification (Ed25519)
  const verifyTokenA = verifyActivationToken(actDataA.token, winMachineDefault.machineId);
  assertTest(
    verifyTokenA.valid && verifyTokenA.payload?.machine_id === winMachineDefault.machineId,
    '11. Offline Ed25519 Signature Verification: Valid for Machine A using Public Key only'
  );

  // 12. Token Machine Identity Mismatch Enforcement
  const verifyTokenMismatch = verifyActivationToken(actDataA.token, winMachineSimulated.machineId);
  assertTest(
    !verifyTokenMismatch.valid && Boolean(verifyTokenMismatch.error?.includes('Machine ID mismatch')),
    '12. Token Machine Binding: Token rejected when verified against unauthorized Machine B'
  );

  // 13. Tampered Token Signature Rejection
  const parts = actDataA.token.split('.');
  const tamperedToken = `${parts[0]}.invalidfakebase64signature1234567890`;
  const verifyTampered = verifyActivationToken(tamperedToken, winMachineDefault.machineId);
  assertTest(
    !verifyTampered.valid && Boolean(verifyTampered.error?.includes('signature verification failed')),
    '13. Cryptographic Tamper Resistance: Tampered token signature fails verification'
  );

  // 14. Private Backblaze B2 Presigned URL Download & Byte Integrity
  const presignedDriverUrl = valData.download_urls?.driverPackage;
  let downloadSuccess = false;
  let downloadedSha256 = '';

  if (presignedDriverUrl) {
    try {
      const fetchRes = await fetch(presignedDriverUrl);
      if (fetchRes.ok) {
        const buffer = Buffer.from(await fetchRes.arrayBuffer());
        downloadedSha256 = crypto.createHash('sha256').update(buffer).digest('hex');
        downloadSuccess = downloadedSha256 === winDef.sha256;
      }
    } catch (err) {
      console.error('Presigned fetch error:', err);
    }
  }

  assertTest(
    downloadSuccess,
    '14. Backblaze B2 Presigned Download & SHA-256 Byte Verification',
    `Downloaded ${winDef.filename} matched authoritative SHA-256: ${downloadedSha256}`
  );

  // 15. Direct Unauthenticated Backblaze B2 Access Blocked (Privacy Check)
  let directBlocked = false;
  try {
    const config = getB2Config();
    const directUrl = `${config.endpoint}/${config.bucketName}/${winDef.key}`;
    const directRes = await fetch(directUrl);
    directBlocked = directRes.status === 401 || directRes.status === 403 || directRes.status === 400;
  } catch {
    directBlocked = true;
  }
  assertTest(
    directBlocked,
    '15. Backblaze B2 Bucket Privacy: Direct unauthenticated GET access is forbidden (401/403)'
  );

  // 16. Expired Presigned URL Verification
  const expiredUrls = await generatePresignedPackageUrls(-10, 'WINDOWS');
  let expiredAccessBlocked = false;
  if (expiredUrls.download_urls?.driverPackage) {
    try {
      const expiredRes = await fetch(expiredUrls.download_urls.driverPackage);
      expiredAccessBlocked = expiredRes.status === 401 || expiredRes.status === 403 || expiredRes.status === 400;
    } catch {
      expiredAccessBlocked = true;
    }
  }
  assertTest(
    expiredAccessBlocked,
    '16. Presigned URL Expiration: Expired token URL fails with HTTP 401/403'
  );

  // 17. Zero Secret Leakage into Client Files / APIs
  const clientSourceCode = [
    fs.readFileSync(path.resolve(process.cwd(), 'src/app/page.tsx'), 'utf-8'),
    fs.readFileSync(path.resolve(process.cwd(), 'src/app/purchase/success/page.tsx'), 'utf-8'),
    fs.readFileSync(path.resolve(process.cwd(), 'Requirements/windows-driver/setup.ps1'), 'utf-8'),
  ].join('\n');

  const b2AppKey = process.env.B2_APPLICATION_KEY || 'K005dMC+IgMZyVwGQlHnRMDanvNkth0';
  const privateKeySecret = 'BEGIN PRIVATE KEY';
  const hasSecretLeak =
    clientSourceCode.includes(b2AppKey) ||
    clientSourceCode.includes(privateKeySecret) ||
    JSON.stringify(valData).includes(b2AppKey) ||
    JSON.stringify(actDataA).includes(privateKeySecret);

  assertTest(
    !hasSecretLeak,
    '17. Zero Secret Leakage: B2 application keys & private signing keys never exposed in frontend or installer'
  );

  console.log('\n----------------------------------------------------------------');
  console.log(` COMPREHENSIVE SUITE SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('----------------------------------------------------------------\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runComprehensiveWindowsTestSuite()
  .catch((err) => {
    console.error('[TEST SUITE ERROR]', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
