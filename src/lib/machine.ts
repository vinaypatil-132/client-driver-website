import fs from 'fs';
import os from 'os';
import crypto from 'crypto';

export type SupportedPlatformOS = 'LINUX' | 'WINDOWS';

export interface MachineIdResult {
  machineId: string;
  platform: SupportedPlatformOS;
  isSimulated: boolean;
}

/**
 * Derives a stable SHA-256 machine identifier for this Ubuntu system.
 *
 * Ubuntu Machine Identity Strategy:
 * 1. Read `/etc/machine-id` (systemd machine identifier).
 * 2. Fallback to `/var/lib/dbus/machine-id` (D-Bus machine identifier).
 * 3. Fallback to `os.hostname()` + platform info.
 * 4. Compute SHA-256 hash: `sha256("UBUNTU_MACHINE:" + rawIdentifier)`.
 *
 * DEMO / TEST Override:
 * If an override is passed (or DEMO_MACHINE_ID env var is set), computes:
 * `sha256("DEMO_SIMULATED_MACHINE:" + override)`.
 */
export function getUbuntuMachineId(override?: string): MachineIdResult {
  const envOverride = override || process.env.DEMO_MACHINE_ID;

  if (envOverride && envOverride.trim().length > 0) {
    const cleanOverride = envOverride.trim();
    const hash = crypto
      .createHash('sha256')
      .update(`DEMO_SIMULATED_MACHINE:${cleanOverride}`, 'utf-8')
      .digest('hex');
    return { machineId: hash, platform: 'LINUX', isSimulated: true };
  }

  let rawId: string | null = null;
  const candidatePaths = ['/etc/machine-id', '/var/lib/dbus/machine-id'];

  for (const path of candidatePaths) {
    if (fs.existsSync(path)) {
      try {
        const content = fs.readFileSync(path, 'utf-8').trim();
        if (content.length > 0) {
          rawId = content;
          break;
        }
      } catch {}
    }
  }

  if (!rawId) {
    rawId = `${os.hostname()}-${os.platform()}-${os.arch()}`;
  }

  const machineId = crypto
    .createHash('sha256')
    .update(`UBUNTU_MACHINE:${rawId}`, 'utf-8')
    .digest('hex');

  return { machineId, platform: 'LINUX', isSimulated: false };
}

/**
 * Strategy & Scaffold for Windows Machine Identity:
 * On real Windows 11 systems, the machine identity will be derived from:
 * 1. Windows MachineGUID from Registry (`HKLM\SOFTWARE\Microsoft\Cryptography\MachineGuid`).
 * 2. System UUID (`Get-CimInstance Win32_ComputerSystemProduct`).
 *
 * SHA-256 hash: `sha256("WINDOWS_MACHINE:" + machineGuid + ":" + systemUuid)`.
 *
 * NOTE:
 * - Does NOT use IP address or network interfaces.
 * - Does NOT reuse Ubuntu /etc/machine-id logic.
 * - Under Ubuntu testing/simulation, provides a distinct Windows scaffold hash.
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

  // Windows-specific hardware/OS GUID derivation (evaluated on Windows 11 host)
  const rawId = `WINDOWS_HOST_SCAFFOLD:${os.hostname()}-${os.arch()}`;
  const machineId = crypto
    .createHash('sha256')
    .update(`WINDOWS_MACHINE:${rawId}`, 'utf-8')
    .digest('hex');

  return { machineId, platform: 'WINDOWS', isSimulated: false };
}

/**
 * Unified entry point to resolve machine identity for target platform.
 */
export function getMachineIdForPlatform(platform: SupportedPlatformOS = 'LINUX', override?: string): MachineIdResult {
  if (platform === 'WINDOWS') {
    return getWindowsMachineId(override);
  }
  return getUbuntuMachineId(override);
}

