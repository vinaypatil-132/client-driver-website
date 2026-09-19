import { generatePresignedPackageUrls, getB2Config } from '../src/lib/b2';

async function main() {
  console.log('================================================================');
  console.log(' TESTING BACKBLAZE B2 CREDENTIAL VALIDATION & PRESIGNED DOWNLOAD');
  console.log('================================================================\n');

  const origKeyId = process.env.B2_KEY_ID;
  const origAppKey = process.env.B2_APPLICATION_KEY;

  // 1. Test malformed 24-character Key ID rejection
  console.log('1. Testing malformed B2_KEY_ID rejection (24-char typo)...');
  process.env.B2_KEY_ID = '005c4c500ccb8b0000000004';
  let malformedCaught = false;
  try {
    getB2Config();
  } catch (err: any) {
    malformedCaught = true;
    console.log('   ✓ Malformed key properly rejected with error:', err.message);
  }
  if (!malformedCaught) {
    throw new Error('FAILED: Malformed B2_KEY_ID was not rejected!');
  }

  // 2. Test missing Key ID rejection
  console.log('\n2. Testing missing B2_KEY_ID rejection...');
  delete process.env.B2_KEY_ID;
  let missingKeyCaught = false;
  try {
    getB2Config();
  } catch (err: any) {
    missingKeyCaught = true;
    console.log('   ✓ Missing key properly rejected with error:', err.message);
  }
  if (!missingKeyCaught) {
    throw new Error('FAILED: Missing B2_KEY_ID was not rejected!');
  }

  // 3. Test missing Application Key rejection
  console.log('\n3. Testing missing B2_APPLICATION_KEY rejection...');
  process.env.B2_KEY_ID = origKeyId;
  delete process.env.B2_APPLICATION_KEY;
  let missingAppKeyCaught = false;
  try {
    getB2Config();
  } catch (err: any) {
    missingAppKeyCaught = true;
    console.log('   ✓ Missing application key properly rejected with error:', err.message);
  }
  if (!missingAppKeyCaught) {
    throw new Error('FAILED: Missing B2_APPLICATION_KEY was not rejected!');
  }

  // Restore original environment credentials
  process.env.B2_KEY_ID = origKeyId;
  process.env.B2_APPLICATION_KEY = origAppKey;

  // 4. Test presigned URL generation and B2 HTTP download with configured environment credentials
  console.log('\n4. Testing generatePresignedPackageUrls with configured environment credentials...');
  const result = await generatePresignedPackageUrls(900, 'WINDOWS', 'Nav Brahmi — Brahmi Tamil Grantha (2026)');
  console.log('   Package Status:', result.package_status);
  const url = result.download_urls.driverPackage;
  if (!url) {
    throw new Error('Presigned URL was not generated.');
  }

  const res = await fetch(url);
  console.log('   B2 Fetch Status:        ', res.status);
  console.log('   B2 Content-Length:      ', res.headers.get('content-length'));
  console.log('   B2 Content-Type:        ', res.headers.get('content-type'));

  if (res.status === 200) {
    console.log('\n✅ [PASS] Backblaze B2 package downloaded with HTTP 200 OK using configured environment credentials.');
  } else {
    console.error('\n❌ [FAIL] Backblaze B2 returned status', res.status);
    process.exit(1);
  }

  console.log('\n================================================================');
  console.log(' ALL B2 CREDENTIAL & DOWNLOAD TESTS PASSED');
  console.log('================================================================\n');

  process.exit(0);
}

main().catch(err => {
  console.error('Test error:', err);
  process.exit(1);
});
