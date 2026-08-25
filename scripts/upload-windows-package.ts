import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { HeadObjectCommand } from '@aws-sdk/client-s3';
import {
  createB2Client,
  getB2Config,
  WINDOWS_PACKAGE_DEFINITIONS,
  uploadPackageToB2,
} from '../src/lib/b2';

try {
  process.loadEnvFile?.('.env');
} catch {}

async function main() {
  console.log('====================================================');
  console.log(' Backblaze B2 Windows Driver Package Uploader');
  console.log('====================================================');

  const targetDir = path.resolve(process.cwd(), 'Requirements/windows-driver');
  const expectedFilename = WINDOWS_PACKAGE_DEFINITIONS.kbfiltrDriver.filename; // kbfiltr-driver-package.zip
  const targetFilePath = path.join(targetDir, expectedFilename);

  // Check if real built Windows driver package exists
  if (!fs.existsSync(targetFilePath)) {
    console.error('\n❌ [ERROR] Built Windows driver package not found!');
    console.error(`Expected file location: ${targetFilePath}`);
    console.error('\n----------------------------------------------------');
    console.error(' REMAINING WINDOWS BUILD STEPS REQUIRED FIRST:');
    console.error('----------------------------------------------------');
    console.error(' 1. Boot Windows 11.');
    console.error(' 2. Open Microsoft kbfiltr solution (Requirements/windows-kbfiltr/).');
    console.error(' 3. Build x64 Release configuration in Visual Studio 2022 + WDK.');
    console.error(' 4. Copy generated package files (.inf, .sys, .cat) or zip bundle into:');
    console.error('    Requirements/windows-driver/kbfiltr-driver-package.zip');
    console.error(' 5. Re-run this script: npm run upload:windows-package');
    console.error('----------------------------------------------------\n');
    console.error('NO files were uploaded to Backblaze B2.\n');
    process.exit(1);
  }

  const fileBuffer = fs.readFileSync(targetFilePath);
  const calculatedHash = crypto.createHash('sha256').update(fileBuffer).digest('hex');

  const config = getB2Config();
  console.log(`\n[CONFIG] Endpoint: ${config.endpoint}`);
  console.log(`[CONFIG] Region:   ${config.region}`);
  console.log(`[CONFIG] Bucket:   ${config.bucketName}`);
  console.log(`[CONFIG] Key ID:   ${config.keyId.substring(0, 8)}...`);

  console.log(`\n--- Processing ${expectedFilename} ---`);
  console.log(`[LOCAL] Path:       ${targetFilePath}`);
  console.log(`[LOCAL] Size:       ${fileBuffer.length} bytes`);
  console.log(`[LOCAL] SHA-256:    ${calculatedHash}`);

  const targetKey = WINDOWS_PACKAGE_DEFINITIONS.kbfiltrDriver.key;
  console.log(`[UPLOAD] Uploading to B2 target key: "${targetKey}"...`);

  await uploadPackageToB2(
    targetKey,
    fileBuffer,
    WINDOWS_PACKAGE_DEFINITIONS.kbfiltrDriver.contentType
  );
  console.log(`[UPLOAD] Upload completed.`);

  // Verify object presence in B2 via HeadObject
  console.log(`[VERIFY] Verifying object existence in Backblaze B2...`);
  const client = createB2Client();
  const headResult = await client.send(
    new HeadObjectCommand({
      Bucket: config.bucketName,
      Key: targetKey,
    })
  );

  console.log(`[VERIFY] Success! Object size in B2: ${headResult.ContentLength} bytes`);

  console.log('\n====================================================');
  console.log(' Windows Driver Package Uploaded & Verified in B2!');
  console.log(' Update src/lib/b2.ts with:');
  console.log(`   sha256: '${calculatedHash}'`);
  console.log(`   isAvailable: true`);
  console.log('====================================================\n');
}

main().catch((err) => {
  console.error('[WINDOWS UPLOAD ERROR]', err);
  process.exit(1);
});
