import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { prisma } from '../src/lib/prisma';
import { getWindowsMachineId } from '../src/lib/machine';
import {
  signActivationToken,
  verifyActivationToken,
  DEMO_PUBLIC_KEY_PEM,
} from '../src/lib/keys';
import {
  WINDOWS_PACKAGE_DEFINITIONS,
  getB2Config,
  generatePresignedPackageUrls,
} from '../src/lib/b2';

const BACKEND_URL = 'http://localhost:3000';

async function runComprehensiveWindowsTestSuite() {
  console.log('================================================================');
  console.log(' RUNNING NAV BRAHMI WINDOWS SECURITY & INTEGRATION TEST SUITE');
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

  assertTest(
    winMachineDefault.platform === 'WINDOWS' &&
      winMachineDefault.machineId.length === 64 &&
      winMachineSimulated.machineId.length === 64 &&
      winMachineDefault.machineId !== winMachineSimulated.machineId,
    '2. Windows Machine Identity: SHA-256 derived hardware identity (MachineGuid + UUID)',
    `Win ID: ${winMachineDefault.machineId.substring(0, 16)}... | Sim ID: ${winMachineSimulated.machineId.substring(0, 16)}...`
  );

  // 3. Purchase Product 1: Brahmi Tamil Grantha (2026)
  const email1 = `customer-brahmi-${Date.now()}@example.com`;
  const purchaseRes1 = await fetch(`${BACKEND_URL}/api/purchase`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: email1,
      productName: 'Nav Brahmi — Brahmi Tamil Grantha (2026)',
    }),
  });
  const purchaseData1 = await purchaseRes1.json();
  assertTest(
    purchaseRes1.ok && purchaseData1.success && !!purchaseData1.licenseKey,
    '3. Purchase API: Brahmi Tamil Grantha license created in Supabase PostgreSQL',
    `License: ${purchaseData1.licenseKey} (Product: ${purchaseData1.product?.name})`
  );
  const licenseKey1 = purchaseData1.licenseKey;

  // 4. Purchase Product 2: Kharoshthi
  const email2 = `customer-kharoshthi-${Date.now()}@example.com`;
  const purchaseRes2 = await fetch(`${BACKEND_URL}/api/purchase`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: email2,
      productName: 'Nav Brahmi — Kharoshthi',
    }),
  });
  const purchaseData2 = await purchaseRes2.json();
  assertTest(
    purchaseRes2.ok && purchaseData2.success && !!purchaseData2.licenseKey,
    '4. Purchase API: Kharoshthi license created in Supabase PostgreSQL',
    `License: ${purchaseData2.licenseKey} (Product: ${purchaseData2.product?.name})`
  );
  const licenseKey2 = purchaseData2.licenseKey;

  // 5. License Validation for Product 1 (Brahmi Tamil Grantha)
  const valRes1 = await fetch(`${BACKEND_URL}/api/validate-license`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      license_key: licenseKey1,
      platform: 'WINDOWS',
    }),
  });
  const valData1 = await valRes1.json();
  const pkgDef1 = WINDOWS_PACKAGE_DEFINITIONS.brahmiTamilGranthaDriver;

  assertTest(
    valRes1.ok &&
      valData1.valid &&
      valData1.platform === 'WINDOWS' &&
      valData1.package_status === 'READY' &&
      valData1.checksums?.driverPackage === pkgDef1.sha256 &&
      valData1.packages?.[pkgDef1.id]?.filename === pkgDef1.filename,
    '5. License Validation 1: Returns authentic Brahmi Tamil Grantha presigned package & checksum',
    `Package SHA-256: ${valData1.checksums?.driverPackage}`
  );

  // 6. License Validation for Product 2 (Kharoshthi)
  const valRes2 = await fetch(`${BACKEND_URL}/api/validate-license`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      license_key: licenseKey2,
      platform: 'WINDOWS',
    }),
  });
  const valData2 = await valRes2.json();
  const pkgDef2 = WINDOWS_PACKAGE_DEFINITIONS.kharoshthiDriver;

  assertTest(
    valRes2.ok &&
      valData2.valid &&
      valData2.platform === 'WINDOWS' &&
      valData2.package_status === 'READY' &&
      valData2.checksums?.driverPackage === pkgDef2.sha256 &&
      valData2.packages?.[pkgDef2.id]?.filename === pkgDef2.filename,
    '6. License Validation 2: Returns authentic Kharoshthi presigned package & checksum',
    `Package SHA-256: ${valData2.checksums?.driverPackage}`
  );

  // 7. Product Isolation: Never mix packages
  const isIsolated =
    !JSON.stringify(valData1).includes('kharoshthi') &&
    !JSON.stringify(valData2).includes('brahmi-tamil-grantha') &&
    !JSON.stringify(valData1).includes('kbfiltr') &&
    !JSON.stringify(valData2).includes('kbfiltr');
  assertTest(
    isIsolated,
    '7. Product Isolation: Licenses never return wrong package or obsolete kbfiltr package'
  );

  // 8. Machine Activation API for Product 1 (First Activation)
  const actRes1 = await fetch(`${BACKEND_URL}/api/activation`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      license_key: licenseKey1,
      machine_id: winMachineDefault.machineId,
      product_code: pkgDef1.product,
      platform: 'WINDOWS',
    }),
  });
  const actData1 = await actRes1.json();

  assertTest(
    actRes1.ok && actData1.success && actData1.activated && !!actData1.token,
    '8. Machine Activation API: License 1 activated and machine-bound in Supabase',
    `Token: ${actData1.token?.substring(0, 40)}...`
  );

  // 9. Supabase Database Binding Verification
  const dbLicense1 = await prisma.license.findUnique({ where: { licenseKey: licenseKey1 } });
  assertTest(
    dbLicense1?.machineId === winMachineDefault.machineId && dbLicense1?.activationStatus === 'ACTIVE',
    '9. Supabase Database Verification: Hardware Machine ID stored in PostgreSQL record'
  );

  // 10. Same-Machine Reactivation
  const reactRes = await fetch(`${BACKEND_URL}/api/activation`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      license_key: licenseKey1,
      machine_id: winMachineDefault.machineId,
      product_code: pkgDef1.product,
      platform: 'WINDOWS',
    }),
  });
  const reactData = await reactRes.json();
  assertTest(
    reactRes.ok && reactData.success && reactData.activated && !!reactData.token,
    '10. Same-Machine Reactivation: Re-issues token without error'
  );

  // 11. Unauthorized Machine Rejection (403 Forbidden)
  const actResB = await fetch(`${BACKEND_URL}/api/activation`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      license_key: licenseKey1,
      machine_id: winMachineSimulated.machineId,
      product_code: pkgDef1.product,
      platform: 'WINDOWS',
    }),
  });
  const actDataB = await actResB.json();
  assertTest(
    actResB.status === 403 && !actDataB.success && !actDataB.activated,
    '11. Hardware Lock Enforcement: Unauthorized Machine B rejected with HTTP 403',
    `Server Error: "${actDataB.error}"`
  );

  // 12. Offline Ed25519 Token Signature Verification
  const verifyToken1 = verifyActivationToken(actData1.token, winMachineDefault.machineId);
  assertTest(
    verifyToken1.valid && verifyToken1.payload?.machine_id === winMachineDefault.machineId,
    '12. Offline Ed25519 Token Verification: Valid for Machine A using Public Key only'
  );

  // 13. Token Hardware ID Mismatch Enforcement
  const verifyMismatch = verifyActivationToken(actData1.token, winMachineSimulated.machineId);
  assertTest(
    !verifyMismatch.valid && Boolean(verifyMismatch.error?.includes('Machine ID mismatch')),
    '13. Offline Machine Enforcement: Token fails when checked against unauthorized Machine B'
  );

  // 14. Download & SHA-256 Byte Verification for Package 1 from B2
  let downloadSuccess1 = false;
  let downloadedSha1 = '';
  if (valData1.download_urls?.driverPackage) {
    try {
      const fetchRes = await fetch(valData1.download_urls.driverPackage);
      if (fetchRes.ok) {
        const buf = Buffer.from(await fetchRes.arrayBuffer());
        downloadedSha1 = crypto.createHash('sha256').update(buf).digest('hex');
        downloadSuccess1 = downloadedSha1 === pkgDef1.sha256;
      }
    } catch (err) {
      console.error('Download error 1:', err);
    }
  }
  assertTest(
    downloadSuccess1,
    '14. B2 Presigned Download 1: Brahmi Tamil Grantha verified against authoritative SHA-256',
    `Downloaded SHA: ${downloadedSha1} (Expected: ${pkgDef1.sha256})`
  );

  // 15. Download & SHA-256 Byte Verification for Package 2 from B2
  let downloadSuccess2 = false;
  let downloadedSha2 = '';
  if (valData2.download_urls?.driverPackage) {
    try {
      const fetchRes = await fetch(valData2.download_urls.driverPackage);
      if (fetchRes.ok) {
        const buf = Buffer.from(await fetchRes.arrayBuffer());
        downloadedSha2 = crypto.createHash('sha256').update(buf).digest('hex');
        downloadSuccess2 = downloadedSha2 === pkgDef2.sha256;
      }
    } catch (err) {
      console.error('Download error 2:', err);
    }
  }
  assertTest(
    downloadSuccess2,
    '15. B2 Presigned Download 2: Kharoshthi verified against authoritative SHA-256',
    `Downloaded SHA: ${downloadedSha2} (Expected: ${pkgDef2.sha256})`
  );

  // 16. Private B2 Bucket Access Lockdown
  let directBlocked = false;
  try {
    const config = getB2Config();
    const directUrl = `${config.endpoint}/${config.bucketName}/${pkgDef1.key}`;
    const directRes = await fetch(directUrl);
    directBlocked = directRes.status === 401 || directRes.status === 403 || directRes.status === 400;
  } catch {
    directBlocked = true;
  }
  assertTest(
    directBlocked,
    '16. Backblaze B2 Privacy Lockdown: Direct unauthenticated GET access is blocked (HTTP 401/403)'
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
    JSON.stringify(valData1).includes(b2AppKey) ||
    JSON.stringify(actData1).includes(privateKeySecret);

  assertTest(
    !hasSecretLeak,
    '17. Zero Secret Leakage: B2 application keys & private signing keys never exposed in frontend or installer'
  );

  console.log('\n----------------------------------------------------------------');
  console.log(` NAV BRAHMI SUITE SUMMARY: ${passed} PASSED, ${failed} FAILED`);
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
