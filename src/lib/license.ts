import crypto from 'crypto';

/**
 * Validates standard email address format.
 */
export function isValidEmail(email: string): boolean {
  if (!email || typeof email !== 'string') return false;
  const trimmed = email.trim();
  // Standard RFC-compliant email regex pattern
  const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;
  return emailRegex.test(trimmed) && trimmed.length <= 254;
}

/**
 * Generates a cryptographically secure, unpredictable, and distinct license key.
 * Format: DEMO-XXXX-XXXX-XXXX-XXXX (where each chunk is 4 cryptographically secure random hex characters)
 */
export function generateSecureLicenseKey(): string {
  const chunk1 = crypto.randomBytes(2).toString('hex').toUpperCase();
  const chunk2 = crypto.randomBytes(2).toString('hex').toUpperCase();
  const chunk3 = crypto.randomBytes(2).toString('hex').toUpperCase();
  const chunk4 = crypto.randomBytes(2).toString('hex').toUpperCase();

  return `DEMO-${chunk1}-${chunk2}-${chunk3}-${chunk4}`;
}
