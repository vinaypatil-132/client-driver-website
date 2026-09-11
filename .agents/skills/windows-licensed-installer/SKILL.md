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
- **Driver Layer**: Authentic Nav Brahmi MSKLC Keyboard Layout Drivers (`Brahmi Tamil Grantha (2026)` and `Kharoshthi`) with unicode font assets.

---

## 2. End-to-End Windows Lifecycle Flow

```
1. Customer Purchase (Storefront)
   └─ Enter email & select product → POST /api/purchase (Server creates license record in Supabase PostgreSQL)
   
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

7. Windows Driver Package & Font Installation (Bootstrapper)
   └─ setup.ps1 extracts verified package, installs driver MSI for host architecture, and registers unicode fonts

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
- **No IP Reliance**: Never use IP addresses, network interfaces, or MAC addresses as primary machine identity bindings.

### Driver & Binary Integrity
- **Confidentiality**: Real client driver files and binaries are confidential client assets. Do not expose or modify unnecessarily.
- **No Fabricated Binaries**: Never create dummy or fabricated binaries manually.
- **Controlled Package Uploads**: Uploads occur via `scripts/sync-b2-packages.ts` or `scripts/upload-windows-package.ts` with authoritative SHA-256 validation.
