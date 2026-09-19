import crypto from 'crypto';

/**
 * Validates standard email address format.
 */
export function isValidEmail(email: string): boolean {
  if (!email || typeof email !== 'string') return false;
  const trimmed = email.trim();
  const emailRegex =
    /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;
  return emailRegex.test(trimmed) && trimmed.length <= 254;
}

/**
 * Generates a cryptographically secure, unpredictable, and distinct license key.
 * Format: NAV-XXXX-XXXX-XXXX-XXXX
 */
export function generateSecureLicenseKey(): string {
  const chunk1 = crypto.randomBytes(2).toString('hex').toUpperCase();
  const chunk2 = crypto.randomBytes(2).toString('hex').toUpperCase();
  const chunk3 = crypto.randomBytes(2).toString('hex').toUpperCase();
  const chunk4 = crypto.randomBytes(2).toString('hex').toUpperCase();

  return `NAV-${chunk1}-${chunk2}-${chunk3}-${chunk4}`;
}

const TOKEN_SECRET =
  process.env.LICENSE_TOKEN_SECRET ||
  process.env.LICENSE_SIGNING_PRIVATE_KEY ||
  'navbrahmi-default-secure-purchase-token-signing-secret-2026';

export interface PurchaseAuthPayload {
  license_id: string;
  license_key: string;
  email: string;
  issued_at: number;
  expires_at: number;
}

/**
 * Creates a short-lived cryptographically signed purchase authorization token
 * that allows Setup.exe to auto-identify the license without manual user copy/pasting.
 */
export function createPurchaseAuthToken(
  licenseKey: string,
  licenseId: string,
  email: string,
  expiresInHours = 72
): string {
  const now = Math.floor(Date.now() / 1000);
  const payload: PurchaseAuthPayload = {
    license_id: licenseId,
    license_key: licenseKey,
    email: email.toLowerCase(),
    issued_at: now,
    expires_at: now + expiresInHours * 3600,
  };

  const payloadBase64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto
    .createHmac('sha256', TOKEN_SECRET)
    .update(payloadBase64)
    .digest('base64url');

  return `${payloadBase64}.${signature}`;
}

/**
 * Verifies a purchase authorization token and extracts the license details.
 */
export function verifyPurchaseAuthToken(token: string): {
  valid: boolean;
  payload?: PurchaseAuthPayload;
  error?: string;
} {
  try {
    if (!token || typeof token !== 'string') {
      return { valid: false, error: 'Token is empty or invalid.' };
    }

    const parts = token.trim().split('.');
    if (parts.length !== 2) {
      return { valid: false, error: 'Malformed token structure.' };
    }

    const [payloadBase64, providedSig] = parts;
    const expectedSig = crypto
      .createHmac('sha256', TOKEN_SECRET)
      .update(payloadBase64)
      .digest('base64url');

    const expectedBuffer = Buffer.from(expectedSig);
    const providedBuffer = Buffer.from(providedSig);

    if (
      expectedBuffer.length !== providedBuffer.length ||
      !crypto.timingSafeEqual(expectedBuffer, providedBuffer)
    ) {
      return { valid: false, error: 'Invalid token signature.' };
    }

    const payloadJson = Buffer.from(payloadBase64, 'base64url').toString('utf-8');
    const payload: PurchaseAuthPayload = JSON.parse(payloadJson);

    const now = Math.floor(Date.now() / 1000);
    if (payload.expires_at && now > payload.expires_at) {
      return { valid: false, error: 'Purchase authorization token has expired.' };
    }

    return { valid: true, payload };
  } catch (err: any) {
    return { valid: false, error: `Failed to verify token: ${err.message}` };
  }
}

/**
 * Creates an HMAC-SHA256 signature for the installer payload embedded in Setup.exe.
 * Protects backendUrl, licenseKey, token, and generatedAt against client-side tampering.
 */
export function createInstallerPayloadSignature(
  backendUrl: string,
  licenseKey: string = '',
  token: string = '',
  generatedAt: number | string = ''
): string {
  const secret =
    process.env.LICENSE_TOKEN_SECRET ||
    process.env.LICENSE_SIGNING_PRIVATE_KEY ||
    'navbrahmi-default-secure-purchase-token-signing-secret-2026';
  const dataToSign = `${backendUrl}|${licenseKey}|${token}|${generatedAt}`;
  return crypto.createHmac('sha256', secret).update(dataToSign).digest('hex');
}

/**
 * Verifies the HMAC-SHA256 signature of an embedded installer payload.
 */
export function verifyInstallerPayloadSignature(
  backendUrl: string,
  licenseKey: string = '',
  token: string = '',
  generatedAt: number | string = '',
  signature: string = ''
): boolean {
  if (!signature || typeof signature !== 'string') return false;
  try {
    const expected = createInstallerPayloadSignature(backendUrl, licenseKey, token, generatedAt);
    const bufExpected = Buffer.from(expected, 'hex');
    const bufProvided = Buffer.from(signature, 'hex');
    if (bufExpected.length !== bufProvided.length) return false;
    return crypto.timingSafeEqual(bufExpected, bufProvided);
  } catch {
    return false;
  }
}

/**
 * Resolves the canonical backend URL for Setup.exe downloads.
 * For local development, allows localhost origins.
 * For production, strictly enforces configured canonical URL.
 */
export function getInstallerBackendUrl(
  hostHeader?: string | null,
  nextUrlHost?: string | null
): string {
  const host = (hostHeader || nextUrlHost || '').toLowerCase();

  // Allow local development origins
  if (
    host.startsWith('localhost:') ||
    host === 'localhost' ||
    host.startsWith('127.0.0.1:') ||
    host === '127.0.0.1'
  ) {
    return `http://${host}`;
  }

  // Production configured APP URL
  if (process.env.NEXT_PUBLIC_APP_URL) {
    const configuredUrl = process.env.NEXT_PUBLIC_APP_URL.trim().replace(/\/+$/, '');
    if (!configuredUrl.includes('localhost') && !configuredUrl.includes('127.0.0.1')) {
      return configuredUrl;
    }
  }

  // Controlled Vercel production deployment fallback
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL.trim().replace(/\/+$/, '')}`;
  }

  // Canonical production fallback
  return 'https://client-driver-website.vercel.app';
}

