# Windows Keyboard Filter Driver Package Requirements & Handoff Guide

This directory (`Requirements/windows-driver/`) holds the Windows installer bootstrapper and serves as the destination for built Windows driver binaries (`.inf`, `.sys`, `.cat`) once generated on Windows 11.

---

## Key Architecture & Security Principles

1. **Microsoft Sample Source**:
   - The source code in `Requirements/windows-kbfiltr/` is the official Microsoft Keyboard Filter Driver (`kbfiltr`) sample from the Windows Driver Samples repository.
   - It serves as the baseline demonstration driver for Windows key filtering/interception.

2. **No Invented or Fabricated Binaries**:
   - Windows kernel driver binaries (`.sys`, `.inf`, `.cat`) MUST NOT be fabricated or manually edited on Linux.
   - Drivers must be compiled using official Microsoft tools (Visual Studio 2022 + Windows Driver Kit) on an actual Windows 11 host.

3. **Separation of Preparation and Upload**:
   - The repository is prepared to support Windows package licensing, machine activation, presigned URL generation, and driver installation (`setup.ps1`).
   - Backblaze B2 upload occurs **ONLY AFTER** the real driver package is compiled and verified on Windows 11. No dummy Windows binaries have been uploaded to B2.

---

## Final Windows Package Destination

When the driver is built on Windows 11, copy the output package files or zip archive to:

```
Requirements/windows-driver/kbfiltr-driver-package.zip
```

Expected package contents inside the archive:
- `kbfiltr.inf` — Windows Driver Setup Information File
- `kbfiltr.sys` — Windows Kernel Driver Binary
- `kbfiltr.cat` — Signed Windows Catalog File

---

## Step-by-Step Windows 11 Build & Handoff Procedure

Follow these steps on a Windows 11 machine to complete the driver build:

1. **Boot Windows 11**:
   - Boot into Windows 11 x64 environment (virtual machine or physical host).

2. **Install Development Tools**:
   - Install **Visual Studio 2022** (Select *"Desktop development with C++"* workload).
   - Install the **Windows Driver Kit (WDK)** for Windows 11.
   - Ensure the WDK Visual Studio extension is enabled.

3. **Open the Microsoft kbfiltr Solution**:
   - Open solution file at: `Requirements/windows-kbfiltr/Windows-driver-samples/input/kbfiltr/sys/kbfiltr.vcxproj` (or solution file `kbfiltr.sln`).

4. **Build the Driver Package**:
   - Set Build Configuration to **Release** and Platform to **x64**.
   - Build Solution (`Ctrl + Shift + B`).

5. **Locate Generated Output Package**:
   - Locate the output folder (e.g., `x64/Release/kbfiltr/` or `x64/Release/Package/`).
   - Confirm the presence of `kbfiltr.inf`, `kbfiltr.sys`, and `kbfiltr.cat`.

6. **Place Output Files into Repository**:
   - Zip the package contents into `kbfiltr-driver-package.zip`.
   - Copy `kbfiltr-driver-package.zip` into `Requirements/windows-driver/`.

7. **Upload Package to Backblaze B2**:
   - Execute the upload script from the root repository directory:
     ```bash
     npm run upload:windows-package
     ```
   - The script will compute the SHA-256 hash, upload the package to private B2 storage under `demo/driver/windows/kbfiltr-driver-package.zip`, verify its presence, and output the hash.

8. **Update Server Package Metadata**:
   - Update `src/lib/b2.ts`:
     ```typescript
     export const WINDOWS_PACKAGE_DEFINITIONS = {
       kbfiltrDriver: {
         ...
         sha256: '<COMPUTED_SHA256_HASH>',
         isAvailable: true,
       }
     };
     ```

9. **Test Windows Installation Bootstrapper**:
   - Execute `Requirements/windows-driver/setup.bat` on Windows 11 to perform end-to-end testing of license validation, activation, download, SHA-256 checksum verification, and `Pnputil` installation.

---

## Windows Installer Usage

To test the Windows installer script directly on Windows:

```powershell
.\setup.ps1 -LicenseKey "DEMO-XXXX-XXXX-XXXX-XXXX" -BackendUrl "http://localhost:3000"
```
Or via cmd launcher:
```cmd
setup.bat -LicenseKey "DEMO-XXXX-XXXX-XXXX-XXXX" -BackendUrl "http://localhost:3000"
```
