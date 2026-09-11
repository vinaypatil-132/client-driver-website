# Nav Brahmi — Windows Licensed Software & Driver Distribution System

A secure, zero-account licensed software delivery and machine-bound installation system for **Microsoft Windows 11**.

---

## Key Architecture & Features

- **Driver Packages**: Authentic Nav Brahmi MSKLC keyboard layout drivers and unicode typography for Windows 11 (`Brahmi Tamil Grantha (2026)` and `Kharoshthi`).
- **Zero-Account Architecture**: Customers purchase software using only their email. No usernames or passwords required.
- **Machine-Bound Activation**: Licenses are cryptographically bound to hardware identity (Registry `MachineGuid` + System UUID).
- **Asymmetric Token Signing**: Server signs Ed25519 tokens using a private key; client software verifies tokens offline using only the public key.
- **Private Object Storage**: Packages are stored securely in Backblaze B2 and delivered strictly via short-lived presigned URLs (15-minute expiration).
- **Cryptographic Integrity**: The installer verifies downloaded packages against authoritative server-side SHA-256 checksums before installation.
- **Automated Cleanup**: Temporary download and extraction files are automatically purged upon installation completion.

---

## Directory Structure

```
├── Requirements/
│   └── windows-driver/                     # Windows 11 bootstrapper & driver packages
│       ├── brahmi-tamil-grantha-driver-package.zip
│       ├── kharoshthi-driver-package.zip
│       ├── setup.ps1                       # PowerShell bootstrapper installer
│       ├── setup.bat                       # CMD launcher
│       └── README.md
├── prisma/
│   ├── schema.prisma                       # Supabase PostgreSQL schema
│   └── seed.ts                             # Product seed script
├── scripts/
│   ├── package-drivers.ts                  # Package builder & SHA-256 calculator
│   ├── sync-b2-packages.ts                 # Backblaze B2 synchronization utility
│   ├── upload-windows-package.ts           # Upload utility for Backblaze B2
│   └── test-windows-prep.ts                # Comprehensive Windows integration test suite
└── src/
    ├── app/                                # Next.js App Router (UI & API routes)
    └── lib/                                # Core utilities (B2, Prisma, Keys, Machine ID)
```

---

## Quick Start & Verification

### 1. Database Seeding
```bash
npm run prisma:seed
```

### 2. Comprehensive Test Suite
```bash
npm run test:windows-prep
```
