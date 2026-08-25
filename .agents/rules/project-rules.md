# Windows Licensed Installer Project Rules

These rules apply to all agent interactions and code modifications within this workspace.

---

## 1. Environment & Platform Scope
- **Windows Only**: All development, testing, and validation are strictly performed on Windows. Do not design or structure workflows around switching back to Ubuntu or Linux.
- **Native Windows Tooling**: Use Windows-compatible command line workflows (PowerShell, CMD, native Node.js binaries) and avoid Linux-only shell assumptions.

## 2. Database & Data Architecture
- **Supabase PostgreSQL**: Supabase PostgreSQL is the active database for licensing and machine binding.
- **Prisma ORM**: All database interactions, schema changes, and seed scripts must go through Prisma.
- **Zero-Account Design**: Never add a user-account/login/registration or session authentication layer. The system architecture links customer purchases directly from email to a cryptographically generated license key.

## 3. Storage & Cryptographic Security
- **Strictly Private B2 Storage**: Backblaze B2 object storage is strictly private. Never generate permanent public package URLs.
- **Presign on Demand**: Driver packages must only be distributed via short-lived expiring presigned URLs after validating an active license.
- **Zero Secret Leakage**: Never expose Backblaze B2 credentials (`B2_KEY_ID`, `B2_APPLICATION_KEY`) or server-side private signing keys (`LICENSE_SIGNING_PRIVATE_KEY`) in frontend client code, installer scripts, API responses, or driver files.
- **Client Offline Verification**: Client verification must rely solely on the public verification key (`DEMO_PUBLIC_KEY_PEM`).
- **Machine Identity**: Windows machine identity must be derived from stable hardware/OS indicators (`HKLM MachineGuid` and `Win32_ComputerSystemProduct UUID`), never from IP or network addresses.

## 4. Driver & Package Safety
- **No Client Driver Modification**: Do not modify real client drivers (e.g., Nav Brahmi) unless explicitly instructed and approved.
- **Baseline Demonstration Driver**: Microsoft `kbfiltr` source code in `Requirements/windows-kbfiltr/` is the baseline demo driver for verifying the installation architecture.
- **No Fabricated Binaries**: Never create fake kernel driver binaries (`.sys`). Real binaries must be compiled with Visual Studio 2022 + WDK on Windows 11.
- **No Automatic B2 Package Uploads**: Never upload Windows packages to B2 automatically. Uploads must only be triggered manually via `scripts/upload-windows-package.ts` after verified builds.

## 5. Development Discipline & Validation
- **Preserve Existing Working Code**: Keep all existing working Next.js routes, Supabase models, B2 presigning, Ed25519 signing, and PowerShell installation logic intact.
- **Minimal, Reversible Changes**: Favor small, focused, and well-tested changes over large refactorings.
- **Never Delete Based on Assumptions**: Do not delete files or folders unless verified completely obsolete and unused.
- **Test After Changes**: Always execute `npm run test:windows-prep` and verify the Next.js dev server/build after making meaningful updates.
