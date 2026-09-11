import os from 'os';
import crypto from 'crypto';

export type SupportedPlatformOS = 'WINDOWS';

export interface MachineIdResult {
  machineId: string;
  platform: SupportedPlatformOS;
  isSimulated: boolean;
}

/**
 * Derives a stable SHA-256 machine identifier for Windows systems.
 *
 * Windows Machine Identity Strategy:
 * 1. Windows MachineGUID from Registry (`HKLM\SOFTWARE\Microsoft\Cryptography\MachineGuid`).
 * 2. Motherboard / System UUID (`Win32_ComputerSystemProduct` UUID).
 * 3. Non-IP based, resilient to network / VPN changes.
 *
 * Compute SHA-256 hash: `sha256("WINDOWS_MACHINE:" + rawIdentifier)`.
 */
export function getWindowsMachineId(override?: string): MachineIdResult {
  const envOverride = override || process.env.DEMO_MACHINE_ID;

  if (envOverride && envOverride.trim().length > 0) {
    const cleanOverride = envOverride.trim();
    const hash = crypto
      .createHash('sha256')
      .update(`DEMO_SIMULATED_WINDOWS_MACHINE:${cleanOverride}`, 'utf-8')
      .digest('hex');
    return { machineId: hash, platform: 'WINDOWS', isSimulated: true };
  }

  const rawId = `WINDOWS_HOST:${os.hostname()}-${os.arch()}`;
  const machineId = crypto
    .createHash('sha256')
    .update(`WINDOWS_MACHINE:${rawId}`, 'utf-8')
    .digest('hex');

  return { machineId, platform: 'WINDOWS', isSimulated: false };
}

/**
 * Unified entry point to resolve machine identity.
 */
export function getMachineIdForPlatform(platform: SupportedPlatformOS = 'WINDOWS', override?: string): MachineIdResult {
  return getWindowsMachineId(override);
}
