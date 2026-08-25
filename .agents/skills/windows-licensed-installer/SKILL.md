---
name: windows-licensed-installer
description: Guide and rules for developing, testing, and maintaining the Windows licensed software installation, machine-bound activation, Supabase PostgreSQL, and Backblaze B2 delivery pipeline.
---

# Windows Licensed Software Installation & Delivery

This skill defines the architectural rules, security boundaries, and development workflows for the Windows licensed driver and software distribution system.

---

## 1. Core Architecture & Stack

- **Target Platform**: **Windows only**. All active development, testing, and validation are performed on Windows 11.
- **Web App & Backend**: Next.js 14 (App Router) + TypeScript.
- **Database & ORM**: **Supabase PostgreSQL** via **Prisma ORM**.
- **Object Storage**: **Private Backblaze B2** S3-compatible storage.
- **Licensing Engine**: Server-side cryptographically secure key generation and email purchase tracking (Zero-Account architecture; no usernames/passwords).
- **Activation & Machine Binding**: Asymmetric cryptographic token signing (Ed25519) binding licenses to Windows hardware/OS identity (`MachineGuid` + `System UUID`).
- **Windows Bootstrapper**: Native PowerShell bootstrapper (`Requirements/windows-driver/setup.ps1`) and CMD launcher (`setup.bat`).
- **Driver Layer**: Official Microsoft Keyboard Filter Driver (`kbfiltr`) source in `Requirements/windows-kbfiltr/` used as a harmless demonstration driver.

---

## 2. End-to-End Windows Lifecycle Flow

```
1. Customer Purchase (Storefront)
   └─ Enter email → POST /api/purchase (Server creates license record in Supabase PostgreSQL)
   
2. License Issued & Installer Obtained
   └─ Storefront presents license key & provides Windows bootstrapper (GET /api/download-installer?platform=windows)

3. License Validation (Bootstrapper)
   └─ setup.ps1 calls POST /api/validate-license (Validates license status in Supabase PostgreSQL)

4. Machine Identity & Activation (Bootstrapper)
   └─ setup.ps1 derives Windows machine ID (HKLM MachineGuid + Win32_ComputerSystemProduct UUID)
   └─ setup.ps1 calls POST /api/activation
   └─ Backend signs Ed25519 token using server-side private key & stores binding in Supabase

5. Temporary Authorized Package Download (Bootstrapper)
   └─ Backend issues short-lived (15-min) presigned Backblaze B2 download URLs & authoritative SHA-256 hashes
   └─ setup.ps1 downloads package archive over HTTPS to a secure temporary directory

6. Cryptographic Integrity Verification (Bootstrapper)
   └─ setup.ps1 calculates local SHA-256 hash and verifies against authoritative server checksum

7. Windows Driver Package Installation (Bootstrapper)
   └─ setup.ps1 extracts verified package and installs driver using pnputil.exe (/add-driver <inf> /install)

8. Local Token Persistence & Offline Enforcement
   └─ setup.ps1 saves signed activation token to Program Files (or application directory)
   └─ Client software verifies Ed25519 token offline using ONLY the embedded public verification key

9. Automated Temporary File Cleanup
   └─ setup.ps1 deletes all temporary download files and directories on exit/interruption
```

---

## 3. Strict Security & Architectural Guidelines

### Private Object Storage (Backblaze B2)
- **Zero Public Exposure**: Backblaze B2 buckets MUST remain strictly private. Never generate permanent public URLs for driver packages.
- **Server-Side Credentials**: B2 application keys and credentials (`B2_KEY_ID`, `B2_APPLICATION_KEY`) must strictly reside on the server-side environment. NEVER expose B2 credentials in frontend code, client binaries, API responses, or installer scripts.
- **Presigned Delivery**: Driver packages must only be delivered via short-lived expiring presigned URLs (e.g. 15 minutes) generated dynamically after validating an active license.

### Asymmetric Cryptographic Signing (Ed25519)
- **Key Isolation**: The server-side private signing key (`LICENSE_SIGNING_PRIVATE_KEY`) MUST NEVER be transmitted, bundled into client code, included in the installer, or embedded in drivers.
- **Public Key Verification**: Client-side software and offline validation utilities must use **ONLY** the public verification key (`DEMO_PUBLIC_KEY_PEM`) to verify token authenticity.
- **Tamper Resistance**: Any tampering with the activation payload or signature must immediately invalidate the token.

### Machine-Bound Identity
- **Stable Hardware/OS Binding**: Windows machine identity is derived from `HKLM\SOFTWARE\Microsoft\Cryptography\MachineGuid` combined with `Win32_ComputerSystemProduct` UUID.
- **No IP Reliance**: Never use IP addresses, network interfaces, or MAC addresses as primary machine identity bindings (as they change across networks and VPNs).

### Driver & Binary Integrity
- **No Fabricated Binaries**: Never create dummy or fabricated `.sys` kernel driver binaries manually on Linux or without Microsoft WDK compilation tools.
- **Protected Client Drivers**: Do not modify any real client driver (such as Nav Brahmi) unless explicitly requested and approved.
- **Controlled Package Uploads**: Never upload Windows driver packages to Backblaze B2 automatically. Uploads must only happen via `scripts/upload-windows-package.ts` after the real driver package has been built with Visual Studio 2022 + WDK and verified on Windows 11.
- **Demonstration Driver**: Microsoft `kbfiltr` is solely a harmless baseline demonstration driver for testing the installation and licensing architecture.

---

## 4. Development & Testing Rules

1. **Windows-Only Workflow**: All development, scripts, and tests are maintained and executed on Windows. Do not re-introduce Ubuntu-specific assumptions or dependencies (`dpkg`, `/etc/machine-id`, `/opt/`).
2. **Preserve Existing Functionality**: Maintain the working Next.js frontend, Supabase database, Backblaze B2 presigning, Ed25519 signing, and PowerShell bootstrapper workflows.
3. **No User Accounts**: Maintain the zero-account architecture (no user logins, passwords, or session cookies). Email is directly linked to the license.
4. **Test After Meaningful Changes**:
   - Run `npm run test:windows-prep` to verify Windows machine identity, licensing APIs, database binding, and bootstrapper delivery.
   - Run `setup.ps1` to test end-to-end bootstrapper installation flow against the local or remote server.
5. **Minimal & Reversible Changes**: Keep changes modular and focused. Never delete files unless verified completely unused.
