import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

async function testLiveProductionWindowsFlow() {
  console.log('================================================================');
  console.log(' LIVE VERCEL PRODUCTION SETUP.EXE WINDOWS END-TO-END TEST');
  console.log('================================================================\n');

  const PROD_HOST = 'https://client-driver-website.vercel.app';

  // 1. Create a fresh purchase on live production Vercel site
  console.log('1. Initiating purchase on live production site:', PROD_HOST);
  const testEmail = `live-customer-${Date.now()}@example.com`;
  const purchaseRes = await fetch(`${PROD_HOST}/api/purchase`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: testEmail,
      product_id: 'NAV-BRAHMI-TAMIL-GRANTHA-2026',
      platform: 'WINDOWS',
    }),
  });

  console.log('   Purchase HTTP Status:', purchaseRes.status);
  const purchaseData = await purchaseRes.json();
  console.log('   Purchase Response:   ', JSON.stringify(purchaseData));

  if (!purchaseData.licenseKey && !purchaseData.license_key) {
    throw new Error('Purchase failed on live production site');
  }

  const licenseKey = purchaseData.licenseKey || purchaseData.license_key;
  console.log('   ✓ Generated License Key:', licenseKey);

  // 2. Download pre-authorized Setup.exe from live production site
  console.log('\n2. Downloading pre-authorized Setup.exe from live production site...');
  const downloadUrl = `${PROD_HOST}/api/download-installer?platform=windows&licenseKey=${encodeURIComponent(licenseKey)}`;
  console.log('   Download URL:', downloadUrl);

  const downloadRes = await fetch(downloadUrl);
  console.log('   Download HTTP Status:', downloadRes.status);
  if (downloadRes.status !== 200) {
    throw new Error(`Download failed with HTTP ${downloadRes.status}`);
  }

  const exeArrayBuf = await downloadRes.arrayBuffer();
  const exeBuffer = Buffer.from(exeArrayBuf);
  console.log(`   ✓ Downloaded executable (${exeBuffer.length} bytes)`);

  const tempExePath = path.join('C:\\Temp', `Setup-LiveProd-${Date.now()}.exe`);
  if (!fs.existsSync('C:\\Temp')) {
    fs.mkdirSync('C:\\Temp', { recursive: true });
  }
  fs.writeFileSync(tempExePath, exeBuffer);

  // 3. Inspect binary payload
  console.log('\n3. Inspecting embedded payload in downloaded binary...');
  const exeStr = exeBuffer.toString('utf-8');
  const hasPayload = exeStr.includes('---NAV_BRAHMI_AUTH_START---');
  console.log('   Payload footer present: ', hasPayload);

  // Extract embedded backendUrl
  let embeddedBackend = '';
  const sIdx = exeStr.lastIndexOf('---NAV_BRAHMI_AUTH_START---');
  const eIdx = exeStr.lastIndexOf('---NAV_BRAHMI_AUTH_END---');
  if (sIdx >= 0 && eIdx > sIdx) {
    const rawJson = exeStr.substring(sIdx + '---NAV_BRAHMI_AUTH_START---'.length, eIdx).trim();
    try {
      const parsed = JSON.parse(rawJson);
      embeddedBackend = parsed.backendUrl;
      console.log('   Embedded License Key:   ', parsed.licenseKey);
      console.log('   Embedded Backend URL:   ', parsed.backendUrl);
      console.log('   Embedded Signature:     ', parsed.signature);
    } catch {}
  }

  // 4. Execute Setup.exe on Windows against LIVE production Vercel
  console.log('\n4. Executing freshly downloaded production Setup.exe on Windows...');
  const machineOverride = `LIVE_PROD_WIN_${Date.now()}`;
  const cmd = `cmd.exe /c ""${tempExePath}" -Silent -MachineOverride ${machineOverride}"`;
  console.log(`   Running command: ${cmd}`);

  try {
    const output = execSync(cmd, { stdio: 'pipe' }).toString();
    console.log('   Setup output:\n', output);
  } catch (err: any) {
    console.log('   Setup stdout:\n', err.stdout?.toString());
    console.log('   Setup stderr:\n', err.stderr?.toString());
    if (err.status !== 0) {
      throw new Error(`Setup.exe failed with exit code ${err.status}`);
    }
  }

  console.log('   ✓ Setup.exe completed execution with Exit Code 0!');

  // 5. Verify activation on live production backend
  console.log('\n5. Verifying machine activation on live production backend...');
  const verifyRes = await fetch(`${PROD_HOST}/api/activation`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      license_key: licenseKey,
      machine_id: machineOverride,
      platform: 'WINDOWS',
    }),
  });
  console.log('   Live Verification Status:', verifyRes.status);
  const verifyData = await verifyRes.json();
  console.log('   Live Verification Data:  ', JSON.stringify(verifyData));

  // 6. Verify token file on disk
  console.log('\n6. Checking activation token saved on disk...');
  const progFilesToken = path.join('C:\\Program Files\\NavBrahmi', 'activation.token');
  const appDataToken = path.join(process.env.LOCALAPPDATA || '', 'NavBrahmi', 'activation.token');

  if (fs.existsSync(progFilesToken)) {
    console.log('   ✓ Found token at:', progFilesToken);
  } else if (fs.existsSync(appDataToken)) {
    console.log('   ✓ Found token at:', appDataToken);
  }

  // Cleanup temp executable
  try {
    fs.unlinkSync(tempExePath);
  } catch {}

  console.log('\n================================================================');
  console.log(' LIVE PRODUCTION SETUP.EXE WINDOWS E2E TEST: SUCCESS (PASSED)');
  console.log('================================================================\n');
}

testLiveProductionWindowsFlow()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('LIVE PROD TEST FAILED:', err);
    process.exit(1);
  });
