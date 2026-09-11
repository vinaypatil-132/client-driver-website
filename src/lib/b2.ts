import { S3Client, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
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

export type SupportedPlatform = 'WINDOWS';

export interface PackageDefinition {
  id: string;
  platform: SupportedPlatform;
  product: string;
  productName: string;
  version: string;
  filename: string;
  key: string;
  sha256: string;
  contentType: string;
  isAvailable: boolean;
}

export const WINDOWS_PACKAGE_DEFINITIONS = {
  brahmiTamilGranthaDriver: {
    id: 'brahmi-tamil-grantha-driver-package',
    platform: 'WINDOWS' as SupportedPlatform,
    product: 'NAV-BRAHMI-TAMIL-GRANTHA-2026',
    productName: 'Nav Brahmi — Brahmi Tamil Grantha (2026)',
    version: '2026.1.0',
    filename: 'brahmi-tamil-grantha-driver-package.zip',
    key: 'driver/windows/brahmi-tamil-grantha-driver-package.zip',
    sha256: '60e0c8056daf73a780305085419784945e328d66e212c35e5676f12c96cb7e07',
    contentType: 'application/zip',
    isAvailable: true,
  },
  kharoshthiDriver: {
    id: 'kharoshthi-driver-package',
    platform: 'WINDOWS' as SupportedPlatform,
    product: 'NAV-BRAHMI-KHAROSHTHI',
    productName: 'Nav Brahmi — Kharoshthi',
    version: '2026.1.0',
    filename: 'kharoshthi-driver-package.zip',
    key: 'driver/windows/kharoshthi-driver-package.zip',
    sha256: '2c8a6c0cb689b3c7fae78d39ddd6bd35c57d828e3c06fe9899a4f40cb647fd95',
    contentType: 'application/zip',
    isAvailable: true,
  },
} as const;

let cachedClockOffsetMs: number | null = null;
let lastClockSyncTime = 0;

async function getB2ServerDate(endpoint: string): Promise<Date> {
  const now = Date.now();
  if (cachedClockOffsetMs !== null && now - lastClockSyncTime < 300000) {
    return new Date(now + cachedClockOffsetMs);
  }

  try {
    const res = await fetch(endpoint, { method: 'HEAD' });
    const dateHeader = res.headers.get('date');
    if (dateHeader) {
      const serverTime = new Date(dateHeader).getTime();
      cachedClockOffsetMs = serverTime - now;
      lastClockSyncTime = now;
      return new Date(serverTime);
    }
  } catch {}

  return new Date();
}

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
    forcePathStyle: true,
  });
}

/**
 * Finds the specific package definition matching a given product identifier (ID, name, or product code).
 */
export function resolvePackageDefinition(productIdentifier?: string): PackageDefinition {
  if (!productIdentifier) {
    return WINDOWS_PACKAGE_DEFINITIONS.brahmiTamilGranthaDriver;
  }

  const normalized = productIdentifier.toLowerCase().trim();

  if (
    normalized.includes('kharoshthi') ||
    normalized.includes('kharoshi') ||
    normalized === 'nav-brahmi-kharoshthi' ||
    normalized === 'kharoshthi-driver-package'
  ) {
    return WINDOWS_PACKAGE_DEFINITIONS.kharoshthiDriver;
  }

  return WINDOWS_PACKAGE_DEFINITIONS.brahmiTamilGranthaDriver;
}

/**
 * Generates short-lived presigned GET URLs for the authorized package based on target platform and product.
 * Default expiration: 15 minutes (900 seconds).
 */
export async function generatePresignedPackageUrls(
  expiresInSeconds = 900,
  platform: string = 'WINDOWS',
  productIdentifier?: string
) {
  const config = getB2Config();
  const client = createB2Client();

  const pkgDef = resolvePackageDefinition(productIdentifier);

  if (!pkgDef.isAvailable || pkgDef.sha256.startsWith('PENDING')) {
    return {
      platform: 'WINDOWS',
      product: pkgDef.product,
      product_name: pkgDef.productName,
      package_status: 'UNAVAILABLE',
      message: `Package for ${pkgDef.productName} is currently unavailable.`,
      download_urls: {},
      checksums: {},
      packages: {},
    };
  }

  const signingDate = await getB2ServerDate(config.endpoint);

  const presignedUrl = await getSignedUrl(
    client,
    new GetObjectCommand({
      Bucket: config.bucketName,
      Key: pkgDef.key,
    }),
    { expiresIn: expiresInSeconds, signingDate }
  );

  return {
    platform: 'WINDOWS',
    product: pkgDef.product,
    product_name: pkgDef.productName,
    package_status: 'READY',
    download_urls: {
      driverPackage: presignedUrl,
    },
    checksums: {
      driverPackage: pkgDef.sha256,
    },
    packages: {
      [pkgDef.id]: {
        url: presignedUrl,
        sha256: pkgDef.sha256,
        filename: pkgDef.filename,
        product: pkgDef.product,
        product_name: pkgDef.productName,
      },
    },
  };
}

/**
 * Uploads a package buffer to the private B2 bucket under its designated key.
 */
export async function uploadPackageToB2(
  key: string,
  body: Buffer,
  contentType = 'application/zip'
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
