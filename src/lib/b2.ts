import { S3Client, GetObjectCommand, PutObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

import fs from 'fs';
import path from 'path';

function loadEnvFileFallback() {
  try {
    if (typeof process.loadEnvFile === 'function') {
      process.loadEnvFile();
      return;
    }
  } catch {}
  try {
    const envPath = path.resolve(process.cwd(), '.env');
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, 'utf-8');
      for (const line of content.split(/\r?\n/)) {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
          const eqIdx = trimmed.indexOf('=');
          const key = trimmed.slice(0, eqIdx).trim();
          let val = trimmed.slice(eqIdx + 1).trim();
          if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
            val = val.slice(1, -1);
          }
          if (!process.env[key]) {
            process.env[key] = val;
          }
        }
      }
    }
  } catch {}
}

loadEnvFileFallback();

export type SupportedPlatform = 'LINUX' | 'WINDOWS';

export interface PackageDefinition {
  id: string;
  platform: SupportedPlatform;
  product: string;
  version: string;
  filename: string;
  key: string;
  sha256: string;
  contentType: string;
  isAvailable: boolean;
}

export const LINUX_PACKAGE_DEFINITIONS = {
  package1: {
    id: 'demo-package-1',
    platform: 'LINUX' as SupportedPlatform,
    product: 'KEYBOARD-DRIVER-DEMO',
    version: '1.0.0',
    filename: 'demo-package-1.deb',
    key: 'demo/driver/demo-package-1.deb',
    sha256: '97502242d2ee1ee004f91832dcb530e6fc090a166e33972268cd5c90e6e4c123',
    contentType: 'application/vnd.debian.binary-package',
    isAvailable: true,
  },
  package2: {
    id: 'demo-package-2',
    platform: 'LINUX' as SupportedPlatform,
    product: 'KEYBOARD-DRIVER-DEMO',
    version: '1.0.0',
    filename: 'demo-package-2.deb',
    key: 'demo/driver/demo-package-2.deb',
    sha256: 'c305e367e867f1d1613a52bc4ca0e2ea9e64cd9f4779bd2849f9eeb969b5f440',
    contentType: 'application/vnd.debian.binary-package',
    isAvailable: true,
  },
  package3: {
    id: 'demo-package-3',
    platform: 'LINUX' as SupportedPlatform,
    product: 'KEYBOARD-DRIVER-DEMO',
    version: '1.0.0',
    filename: 'demo-package-3.deb',
    key: 'demo/driver/demo-package-3.deb',
    sha256: '26356da90eaf9a949c199f7d87a2b4b80587069c834f870e7f3c8babfc3824d6',
    contentType: 'application/vnd.debian.binary-package',
    isAvailable: true,
  },
} as const;

export const WINDOWS_PACKAGE_DEFINITIONS = {
  kbfiltrDriver: {
    id: 'kbfiltr-driver-package',
    platform: 'WINDOWS' as SupportedPlatform,
    product: 'KEYBOARD-DRIVER-DEMO',
    version: '1.0.0',
    filename: 'kbfiltr-driver-package.zip',
    key: 'demo/driver/windows/kbfiltr-driver-package.zip',
    sha256: 'e7a1dbfee2bd6a941a5551ae18a0a96d22d23b75082d26adfdf9cda4f52d8583',
    contentType: 'application/zip',
    isAvailable: true,
  },
} as const;

// Backward-compatibility export matching existing code
export const PACKAGE_DEFINITIONS = LINUX_PACKAGE_DEFINITIONS;

export function getB2Config() {
  const endpoint = process.env.B2_ENDPOINT || 'https://s3.us-east-005.backblazeb2.com';
  const region = process.env.B2_REGION || 'us-east-005';
  const bucketName = process.env.B2_BUCKET_NAME || 'keyboard-driver-demo';
  const keyId = process.env.B2_KEY_ID;
  const applicationKey = process.env.B2_APPLICATION_KEY;

  if (!keyId || !applicationKey) {
    throw new Error('Backblaze B2 credentials (B2_KEY_ID, B2_APPLICATION_KEY) are not configured.');
  }

  return {
    endpoint: endpoint.startsWith('http') ? endpoint : `https://${endpoint}`,
    region,
    bucketName,
    keyId,
    applicationKey,
  };
}

export function createB2Client() {
  const config = getB2Config();

  return new S3Client({
    endpoint: config.endpoint,
    region: config.region,
    credentials: {
      accessKeyId: config.keyId,
      secretAccessKey: config.applicationKey,
    },
    // Force path-style addressing for S3-compatible Backblaze B2 endpoints
    forcePathStyle: true,
  });
}

/**
 * Generates short-lived presigned GET URLs for packages based on target platform.
 * Default expiration: 15 minutes (900 seconds).
 */
export async function generatePresignedPackageUrls(expiresInSeconds = 900, platform: SupportedPlatform = 'LINUX') {
  const config = getB2Config();
  const client = createB2Client();

  if (platform === 'WINDOWS') {
    const winDef = WINDOWS_PACKAGE_DEFINITIONS.kbfiltrDriver;
    if (!winDef.isAvailable || winDef.sha256.startsWith('PENDING')) {
      return {
        platform: 'WINDOWS',
        package_status: 'PENDING_WINDOWS_BUILD',
        message: 'Windows driver package is not yet built or uploaded to Backblaze B2.',
        download_urls: {},
        checksums: {},
        packages: {},
      };
    }

    const presignedUrl = await getSignedUrl(
      client,
      new GetObjectCommand({
        Bucket: config.bucketName,
        Key: winDef.key,
      }),
      { expiresIn: expiresInSeconds }
    );

    return {
      platform: 'WINDOWS',
      package_status: 'READY',
      download_urls: {
        driverPackage: presignedUrl,
      },
      checksums: {
        driverPackage: winDef.sha256,
      },
      packages: {
        'kbfiltr-driver-package': {
          url: presignedUrl,
          sha256: winDef.sha256,
          filename: winDef.filename,
        },
      },
    };
  }

  // LINUX (Default)
  const [url1, url2, url3] = await Promise.all([
    getSignedUrl(
      client,
      new GetObjectCommand({
        Bucket: config.bucketName,
        Key: LINUX_PACKAGE_DEFINITIONS.package1.key,
      }),
      { expiresIn: expiresInSeconds }
    ),
    getSignedUrl(
      client,
      new GetObjectCommand({
        Bucket: config.bucketName,
        Key: LINUX_PACKAGE_DEFINITIONS.package2.key,
      }),
      { expiresIn: expiresInSeconds }
    ),
    getSignedUrl(
      client,
      new GetObjectCommand({
        Bucket: config.bucketName,
        Key: LINUX_PACKAGE_DEFINITIONS.package3.key,
      }),
      { expiresIn: expiresInSeconds }
    ),
  ]);

  return {
    platform: 'LINUX',
    package_status: 'READY',
    download_urls: {
      package1: url1,
      package2: url2,
      package3: url3,
    },
    checksums: {
      package1: LINUX_PACKAGE_DEFINITIONS.package1.sha256,
      package2: LINUX_PACKAGE_DEFINITIONS.package2.sha256,
      package3: LINUX_PACKAGE_DEFINITIONS.package3.sha256,
    },
    packages: {
      'demo-package-1': {
        url: url1,
        sha256: LINUX_PACKAGE_DEFINITIONS.package1.sha256,
      },
      'demo-package-2': {
        url: url2,
        sha256: LINUX_PACKAGE_DEFINITIONS.package2.sha256,
      },
      'demo-package-3': {
        url: url3,
        sha256: LINUX_PACKAGE_DEFINITIONS.package3.sha256,
      },
    },
  };
}

/**
 * Uploads a Debian package buffer to the private B2 bucket under its designated key.
 */
export async function uploadPackageToB2(
  key: string,
  body: Buffer,
  contentType = 'application/vnd.debian.binary-package'
) {
  const config = getB2Config();
  const client = createB2Client();

  const command = new PutObjectCommand({
    Bucket: config.bucketName,
    Key: key,
    Body: body,
    ContentType: contentType,
  });

  return await client.send(command);
}
