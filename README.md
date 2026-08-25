# Licensed Software Installation System — Multi-Platform Demo

A secure, zero-account licensed software delivery and machine-bound installation system for **Ubuntu Linux** and **Microsoft Windows 11**.

---

## Current System Architecture

```
Website (Next.js 14 / TypeScript)
  ↓
Supabase PostgreSQL (Database via Prisma ORM)
  ↓
License Server (Ed25519 Token Signing & Machine Binding)
  ↓
Private Backblaze B2 Object Storage (Presigned URL Delivery)
  ↓
Platform Installers / Bootstrappers
  ├── Ubuntu Linux Installer (`setup.sh`)
  └── Windows 11 Bootstrapper (`setup.ps1` / `setup.bat`)
  ↓
License Validation → Machine Activation → Package Download (SHA-256 Verified) → Driver / App Installation
```

### Database Architecture
- **Primary Database**: **Supabase PostgreSQL** (`postgresql://...supabase.com:5432/postgres`).
- **Connection Pipeline**: **Next.js → Prisma → Supabase PostgreSQL**.
- **Local Dev Fallback**: `docker-compose.yml` (Docker PostgreSQL 16) remains available as an optional local environment config, but the live application connects to Supabase PostgreSQL.

---

## Implementation & Testing Status

### CURRENTLY TESTED & VERIFIED (Ubuntu Environment)
- ✅ **Supabase Database Connection**: Prisma ORM connects to Supabase PostgreSQL, runs migrations, and manages seeds.
- ✅ **Licensing Engine**: Cryptographically secure license key generation and email purchase tracking.
- ✅ **Machine Binding (Ubuntu)**: Stable machine identity derived from system `/etc/machine-id` (SHA-256 hashed).
- ✅ **Cryptographic Tokens**: Ed25519 asymmetric signature generation (server private key) and verification (client public key).
- ✅ **Copy Prevention Simulation**: Unauthorized second machine activation rejected (HTTP 403); copied binary + token refused on unauthorized hardware.
- ✅ **Backblaze B2 Integration**: Short-lived presigned URLs generated for private package objects.
- ✅ **Package Integrity**: Authoritative server-side SHA-256 checksum verification before installation.
- ✅ **Linux Installer Flow**: Complete execution of `setup.sh` installing dummy `.deb` packages and running `demo-app`.
- ✅ **Windows Architecture Preparation**: Multi-platform API structure (`/api/validate-license`, `/api/activation`), Windows machine identity abstraction (`getWindowsMachineId`), PowerShell bootstrapper (`setup.ps1`), and package upload script (`upload-windows-package.ts`).

### NOT YET TESTED (Requires Windows 11 Host)
- ⏳ **Actual Windows Driver Installation**: Execution of `pnputil.exe` with compiled `.inf` / `.sys` / `.cat` package.
- ⏳ **Actual Windows Machine Identity**: Native execution on physical/VM Windows 11 host reading `HKLM\SOFTWARE\Microsoft\Cryptography\MachineGuid` + `Win32_ComputerSystemProduct UUID`.
- ⏳ **Windows Driver Signing & Deployment**: Driver signature verification against Windows WHQL / Test Signature policy.
- ⏳ **Final Windows Package in B2**: Uploading the real compiled `kbfiltr-driver-package.zip` to Backblaze B2 (NO fabricated Windows binaries uploaded).

---

## Remaining Windows 11 Build & Handoff Guide

Follow these exact steps when booting into Windows 11:

1. **Boot Windows 11**: Boot into a Windows 11 x64 environment (VM or physical hardware).
2. **Install Visual Studio 2022**: Select workload *"Desktop development with C++"*.
3. **Install Windows Driver Kit (WDK)**: Download and install the WDK matching the Windows 11 SDK version.
4. **Open Microsoft kbfiltr Solution**: Open `Requirements/windows-kbfiltr/Windows-driver-samples/input/kbfiltr/sys/kbfiltr.vcxproj` (or solution `kbfiltr.sln`).
5. **Build Release x64 Configuration**: Set configuration to **Release**, platform to **x64**, and compile solution (`Ctrl + Shift + B`).
6. **Locate Generated Output Package**: Locate the output directory containing `kbfiltr.inf`, `kbfiltr.sys`, and `kbfiltr.cat`.
7. **Copy Package to Repository**:
   - Zip the package contents into `kbfiltr-driver-package.zip`.
   - Copy `kbfiltr-driver-package.zip` into:
     ```
     Requirements/windows-driver/kbfiltr-driver-package.zip
     ```
8. **Upload to Backblaze B2**: Run the controlled server-side upload command:
   ```bash
   npm run upload:windows-package
   ```
   *This script verifies local presence, computes the SHA-256 hash, uploads to private B2 storage, and outputs the updated `b2.ts` configuration snippet.*
9. **Run End-to-End Windows Test**: Execute `setup.bat` on Windows 11:
   ```cmd
   Requirements\windows-driver\setup.bat -LicenseKey "<LICENSE_KEY>" -BackendUrl "http://localhost:3000"
   ```

---

## Project Structure

```
├── prisma/
│   ├── schema.prisma                 # Prisma schema for Supabase PostgreSQL
│   ├── seed.ts                       # Idempotent seed script for demo product
│   └── migrations/                   # Migration history
├── scripts/
│   ├── upload-packages.ts            # Upload Linux .deb packages to Backblaze B2
│   ├── upload-windows-package.ts    # Upload built Windows driver package to Backblaze B2
│   ├── test-e2e.ts                   # Ubuntu system & database verification suite
│   ├── test-activation-e2e.ts        # Machine-bound activation & copy simulation suite
│   └── test-windows-prep.ts          # Windows preparation architecture test suite
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── purchase/route.ts            # POST /api/purchase
│   │   │   ├── validate-license/route.ts    # POST /api/validate-license (Platform-aware)
│   │   │   ├── activation/route.ts          # POST /api/activation (Machine binding & signing)
│   │   │   ├── license/validate/route.ts    # POST /api/license/validate (Alias)
│   │   │   └── download-installer/route.ts  # GET /api/download-installer?platform=windows|linux
│   │   ├── purchase/
│   │   │   └── success/page.tsx             # License key & download instructions
│   │   ├── page.tsx                         # Demo purchase landing page
│   │   └── globals.css                      # Styling
│   └── lib/
│       ├── b2.ts                     # Multi-platform B2 S3 client & presigned URL generator
│       ├── keys.ts                   # Server-side Ed25519 signing & client public key verification
│       ├── machine.ts                # Clean machine ID abstraction (Ubuntu & Windows strategies)
│       ├── license.ts                # Secure key generator & email validator
│       └── prisma.ts                 # Prisma client singleton for Supabase
├── Requirements/
│   ├── windows-kbfiltr/              # Microsoft Keyboard Filter sample source
│   ├── windows-driver/               # Windows bootstrapper & driver package destination
│   │   ├── setup.ps1                 # Windows PowerShell bootstrapper
│   │   ├── setup.bat                 # Windows CMD launcher
│   │   └── README.md                 # Windows driver requirements & handoff guide
│   ├── demo-app                      # Harmless Linux executable demo client
│   ├── demo-package-1/2/3.deb       # Harmless dummy Debian packages
│   ├── setup.sh                      # Hardened Linux shell installer
│   └── README.md                     # Artifact reference documentation
├── docker-compose.yml                # Optional local PostgreSQL development container
├── .env.example                      # Environment variable template
├── package.json
└── tsconfig.json
```

---

## Quick Start & Verification on Ubuntu

### 1. Database Connection & Seed (Supabase PostgreSQL)
```bash
npx prisma generate
npm run prisma:seed
```

### 2. Run Test Suites
```bash
# Run general system & Supabase database test:
npm run test:e2e

# Run machine-bound activation & copy protection test:
npm run test:activation

# Run Windows installation preparation test:
npm run test:windows-prep
```

### 3. Start Next.js Development Server
```bash
npm run dev
```
