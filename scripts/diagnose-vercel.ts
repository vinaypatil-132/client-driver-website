import { prisma } from '../src/lib/prisma';

async function diagnose() {
  const host = 'https://client-driver-website.vercel.app';
  console.log('Testing against host:', host);

  // 1. Test download-installer
  try {
    const res = await fetch(`${host}/api/download-installer?platform=windows`);
    console.log('1. /api/download-installer status:', res.status);
  } catch (err: any) {
    console.log('1. /api/download-installer err:', err.message);
  }

  // 2. Test purchase endpoint
  let newKey = '';
  try {
    const res = await fetch(`${host}/api/purchase`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: `diag-${Date.now()}@example.com`,
        product_id: 'NAV-BRAHMI-TAMIL-GRANTHA-2026',
        platform: 'WINDOWS',
      }),
    });
    console.log('2. /api/purchase status:', res.status);
    const data = await res.json();
    console.log('   /api/purchase data:', JSON.stringify(data));
    if (data.license_key) {
      newKey = data.license_key;
    }
  } catch (err: any) {
    console.log('2. /api/purchase err:', err.message);
  }

  // 3. Test validate-license with newKey (or existing DEMO key)
  const testKey = newKey || 'DEMO-TEST-7AE0842E5D710267';
  console.log('Using testKey:', testKey);
  try {
    const res = await fetch(`${host}/api/validate-license`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        license_key: testKey,
        platform: 'WINDOWS',
      }),
    });
    console.log('3. /api/validate-license status:', res.status);
    const text = await res.text();
    console.log('   /api/validate-license response:', text);
  } catch (err: any) {
    console.log('3. /api/validate-license err:', err.message);
  }

  // 4. Test license/validate route alias
  try {
    const res = await fetch(`${host}/api/license/validate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        license_key: testKey,
        platform: 'WINDOWS',
      }),
    });
    console.log('4. /api/license/validate status:', res.status);
    const text = await res.text();
    console.log('   /api/license/validate response:', text);
  } catch (err: any) {
    console.log('4. /api/license/validate err:', err.message);
  }

  // 5. Test activation endpoint
  try {
    const res = await fetch(`${host}/api/activation`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        license_key: testKey,
        machine_id: 'TEST_DIAG_MACHINE_1',
        machine_name: 'DIAG_PC',
        platform: 'WINDOWS',
      }),
    });
    console.log('5. /api/activation status:', res.status);
    const text = await res.text();
    console.log('   /api/activation response:', text);
  } catch (err: any) {
    console.log('5. /api/activation err:', err.message);
  }
}

diagnose().catch(console.error);
