import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { DeleteObjectCommand, PutObjectCommand, ListObjectsV2Command } from '@aws-sdk/client-s3';
import { createB2Client, getB2Config } from '../src/lib/b2';

const PACKAGES_TO_UPLOAD = [
  {
    localFile: 'Requirements/windows-driver/brahmi-tamil-grantha-driver-package.zip',
    key: 'driver/windows/brahmi-tamil-grantha-driver-package.zip',
    contentType: 'application/zip',
  },
  {
    localFile: 'Requirements/windows-driver/kharoshthi-driver-package.zip',
    key: 'driver/windows/kharoshthi-driver-package.zip',
    contentType: 'application/zip',
  },
];

const OLD_DEMO_KEYS_TO_DELETE = [
  'demo/driver/windows/kbfiltr-driver-package.zip',
  'demo/driver/demo-package-1.deb',
  'demo/driver/demo-package-2.deb',
  'demo/driver/demo-package-3.deb',
];

async function main() {
  const config = getB2Config();
  const s3 = createB2Client();

  console.log(`Target B2 Bucket: ${config.bucketName}`);

  // 1. Delete Old Demo Objects
  console.log('\n--- 1. Deleting Old Demo Objects from B2 ---');
  for (const oldKey of OLD_DEMO_KEYS_TO_DELETE) {
    console.log(`Deleting ${oldKey}...`);
    try {
      await s3.send(
        new DeleteObjectCommand({
          Bucket: config.bucketName,
          Key: oldKey,
        })
      );
      console.log(`  ✓ Deleted: ${oldKey}`);
    } catch (err: any) {
      console.warn(`  ! Could not delete ${oldKey}: ${err.message}`);
    }
  }

  // 2. Upload Real Packages
  console.log('\n--- 2. Uploading Real Packages to B2 ---');
  for (const pkg of PACKAGES_TO_UPLOAD) {
    const fullPath = path.resolve(process.cwd(), pkg.localFile);
    if (!fs.existsSync(fullPath)) {
      throw new Error(`Package file not found: ${fullPath}`);
    }

    const fileBuffer = fs.readFileSync(fullPath);
    const sha256 = crypto.createHash('sha256').update(fileBuffer).digest('hex');

    console.log(`Uploading ${pkg.localFile} -> Key: ${pkg.key} (${fileBuffer.length} bytes, SHA256: ${sha256})...`);

    await s3.send(
      new PutObjectCommand({
        Bucket: config.bucketName,
        Key: pkg.key,
        Body: fileBuffer,
        ContentType: pkg.contentType,
      })
    );
    console.log(`  ✓ Successfully uploaded: ${pkg.key}`);
  }

  // 3. Verify B2 Contents
  console.log('\n--- 3. Verifying Final B2 Bucket Contents ---');
  const listRes = await s3.send(new ListObjectsV2Command({ Bucket: config.bucketName }));
  if (!listRes.Contents || listRes.Contents.length === 0) {
    console.log('Bucket is empty.');
  } else {
    for (const item of listRes.Contents) {
      console.log(`- Key: ${item.Key} | Size: ${item.Size} bytes | LastModified: ${item.LastModified}`);
    }
  }
}

main().catch((err) => {
  console.error('B2 Sync error:', err);
  process.exit(1);
});
