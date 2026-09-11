# Windows Licensed Driver Distribution & Bootstrapper

This directory contains the production-grade Windows 11 bootstrapper (`setup.ps1` and `setup.bat`) and authoritative driver packages for the Nav Brahmi driver suite.

---

## 1. Driver Packages

The Windows delivery pipeline manages two authentic driver packages:

1. **Nav Brahmi — Brahmi Tamil Grantha (2026)**
   - Package: `brahmi-tamil-grantha-driver-package.zip`
   - Content: MSKLC Keyboard Layout Drivers (`setup.exe`, `B-Tam-Gr_amd64.msi`, `B-Tam-Gr_i386.msi`, `B-Tam-Gr_ia64.msi`, architecture DLLs in `amd64/`, `i386/`, `ia64/`, `wow64/`) and `NotoSansGrantha-Regular.ttf` Unicode font.
   - B2 Storage Key: `driver/windows/brahmi-tamil-grantha-driver-package.zip`
   - Authoritative SHA-256: `60e0c8056daf73a780305085419784945e328d66e212c35e5676f12c96cb7e07`

2. **Nav Brahmi — Kharoshthi**
   - Package: `kharoshthi-driver-package.zip`
   - Content: MSKLC Keyboard Layout Drivers (`setup.exe`, `Kharoshi_amd64.msi`, `Kharoshi_i386.msi`, `Kharoshi_ia64.msi`, architecture DLLs in `amd64/`, `i386/`, `ia64/`, `wow64/`) and `NotoSansKharoshthi-Regular.ttf` Unicode font.
   - B2 Storage Key: `driver/windows/kharoshthi-driver-package.zip`
   - Authoritative SHA-256: `2c8a6c0cb689b3c7fae78d39ddd6bd35c57d828e3c06fe9899a4f40cb647fd95`

---

## 2. Windows Bootstrapper Architecture (`setup.ps1`)

The PowerShell bootstrapper executes the complete end-to-end installation lifecycle:

1. **Machine Identity**: Derives stable SHA-256 hardware identity from Windows Registry `MachineGuid` and Motherboard/System UUID (`Win32_ComputerSystemProduct`).
2. **License Validation**: Validates license status against Supabase PostgreSQL backend (`POST /api/validate-license`).
3. **Machine Activation**: Transmits machine ID to backend (`POST /api/activation`) and receives cryptographically signed Ed25519 token.
4. **Package Download**: Requests short-lived (15-min) presigned Backblaze B2 URLs and verifies byte integrity against authoritative SHA-256 checksums.
5. **Driver & Font Installation**:
   - Detects system architecture (`AMD64`/`x86`/`IA64`).
   - Executes architecture-specific MSI installer (`msiexec.exe /i <msi> /qn /norestart`).
   - Registers unicode font files (`.ttf`) to Windows font storage.
6. **Token Persistence**: Saves activation token to `C:\Program Files\NavBrahmi\activation.token` (or LocalAppData fallback).
7. **Cleanup**: Automatically purges all temporary download and extraction directories on exit.
