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
  console.log(' Backblaze B2 Nav Brahmi Driver Package Uploader');
  console.log('====================================================');

  const targetDir = path.resolve(process.cwd(), 'Requirements/windows-driver');
  const packages = [
    WINDOWS_PACKAGE_DEFINITIONS.brahmiTamilGranthaDriver,
    WINDOWS_PACKAGE_DEFINITIONS.kharoshthiDriver,
  ];

  const config = getB2Config();
  console.log(`\n[CONFIG] Endpoint: ${config.endpoint}`);
  console.log(`[CONFIG] Region:   ${config.region}`);
  console.log(`[CONFIG] Bucket:   ${config.bucketName}`);
  console.log(`[CONFIG] Key ID:   ${config.keyId.substring(0, 8)}...\n`);

  const client = createB2Client();

  for (const pkg of packages) {
    const targetFilePath = path.join(targetDir, pkg.filename);

    if (!fs.existsSync(targetFilePath)) {
      console.error(`\n❌ [ERROR] Package file not found: ${targetFilePath}`);
      console.error(`Run 'npx tsx scripts/package-drivers.ts' first.`);
      process.exit(1);
    }

    const fileBuffer = fs.readFileSync(targetFilePath);
    const calculatedHash = crypto.createHash('sha256').update(fileBuffer).digest('hex');

    console.log(`--- Processing ${pkg.productName} (${pkg.filename}) ---`);
    console.log(`[LOCAL] Path:       ${targetFilePath}`);
    console.log(`[LOCAL] Size:       ${fileBuffer.length} bytes`);
    console.log(`[LOCAL] SHA-256:    ${calculatedHash}`);

    console.log(`[UPLOAD] Uploading to B2 target key: "${pkg.key}"...`);

    await uploadPackageToB2(pkg.key, fileBuffer, pkg.contentType);
    console.log(`[UPLOAD] Upload completed.`);

    // Verify object presence in B2 via HeadObject
    console.log(`[VERIFY] Verifying object existence in Backblaze B2...`);
    const headResult = await client.send(
      new HeadObjectCommand({
        Bucket: config.bucketName,
        Key: pkg.key,
      })
    );

    console.log(`[VERIFY] Success! Object size in B2: ${headResult.ContentLength} bytes\n`);
  }

  console.log('====================================================');
  console.log(' All Nav Brahmi Packages Uploaded & Verified in B2!');
  console.log('====================================================\n');
}

main().catch((err) => {
  console.error('[WINDOWS UPLOAD ERROR]', err);
  process.exit(1);
});
