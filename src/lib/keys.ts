import crypto from 'crypto';

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

/**
 * Public Verification Key (Safe to embed in client/demo-app)
 * Used ONLY for verifying Ed25519 signatures on activation tokens.
 */
export const DEMO_PUBLIC_KEY_PEM = `-----BEGIN PUBLIC KEY-----
MCowBQYDK2VwAyEA4ejtbihOeOFhUOCaySjbhGXrMIcbW9tdVXPTRprxyzg=
-----END PUBLIC KEY-----`;

/**
 * Server-Side Private Signing Key (NEVER exposed to client/browser/API)
 * Used by the backend to sign activation tokens.
 */
const DEFAULT_DEMO_PRIVATE_KEY_PEM = `-----BEGIN PRIVATE KEY-----
MC4CAQAwBQYDK2VwBCIEIAcHjAA/EH4N7Xlpq45+nXJFIwwjWE0cfn2oMFrPLum5
-----END PRIVATE KEY-----`;

export function getSigningPrivateKey(): string {
  return process.env.LICENSE_SIGNING_PRIVATE_KEY || DEFAULT_DEMO_PRIVATE_KEY_PEM;
}

export interface ActivationTokenPayload {
  license_id: string;
  license_key: string;
  product_code: string;
  machine_id: string;
  status: string;
  issued_at: number; // Unix timestamp (seconds)
  expires_at?: number; // Unix timestamp (seconds)
}

/**
 * Signs an activation token using the server-side Ed25519 private key.
 * Output format: <base64url_payload>.<base64url_signature>
 */
export function signActivationToken(payload: ActivationTokenPayload): string {
  const privateKey = getSigningPrivateKey();
  const jsonStr = JSON.stringify(payload);
  const payloadB64 = Buffer.from(jsonStr, 'utf-8').toString('base64url');

  const signature = crypto.sign(null, Buffer.from(payloadB64, 'utf-8'), privateKey);
  const signatureB64 = signature.toString('base64url');

  return `${payloadB64}.${signatureB64}`;
}

/**
 * Verifies an activation token using ONLY the public verification key.
 */
export function verifyActivationToken(
  token: string,
  expectedMachineId?: string
): { valid: boolean; payload?: ActivationTokenPayload; error?: string } {
  if (!token || typeof token !== 'string') {
    return { valid: false, error: 'Activation token is missing or invalid.' };
  }

  const parts = token.trim().split('.');
  if (parts.length !== 2) {
    return { valid: false, error: 'Malformed token structure. Expected <payload>.<signature>' };
  }

  const [payloadB64, signatureB64] = parts;

  try {
    const signature = Buffer.from(signatureB64, 'base64url');
    const isValidSignature = crypto.verify(
      null,
      Buffer.from(payloadB64, 'utf-8'),
      DEMO_PUBLIC_KEY_PEM,
      signature
    );

    if (!isValidSignature) {
      return { valid: false, error: 'Cryptographic signature verification failed.' };
    }

    const payloadJson = Buffer.from(payloadB64, 'base64url').toString('utf-8');
    const payload: ActivationTokenPayload = JSON.parse(payloadJson);

    // Verify token status
    if (payload.status !== 'ACTIVE') {
      return { valid: false, error: `Token status is not active (status: ${payload.status}).`, payload };
    }

    // Verify expiration if present
    const nowSec = Math.floor(Date.now() / 1000);
    if (payload.expires_at && payload.expires_at < nowSec) {
      return { valid: false, error: 'Activation token has expired.', payload };
    }

    // Verify machine binding if expectedMachineId provided
    if (expectedMachineId && payload.machine_id !== expectedMachineId) {
      return {
        valid: false,
        error: `Machine ID mismatch. Token is bound to "${payload.machine_id}", but current machine is "${expectedMachineId}".`,
        payload,
      };
    }

    return { valid: true, payload };
  } catch (err: any) {
    return { valid: false, error: `Token decode or validation error: ${err?.message || err}` };
  }
}
