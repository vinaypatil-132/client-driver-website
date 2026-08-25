# Licensed Software Installer Demo Artifacts & Architecture

This directory contains demonstration installer artifacts for a licensed software installation system on Ubuntu/Debian Linux and Windows 11 with machine-bound activation enforcement.

---

## Directory Structure

```
Requirements/
├── windows-kbfiltr/            # Microsoft Keyboard Filter Driver (kbfiltr) sample source repository
├── windows-driver/             # Windows bootstrapper & destination for built driver package
│   ├── setup.ps1               # Windows PowerShell bootstrapper (Licensing -> Activation -> Download -> Install)
│   ├── setup.bat               # Windows Command Prompt batch wrapper for setup.ps1
│   └── README.md               # Windows driver build & handoff instructions
├── demo-app                    # Harmless Linux executable demo application
├── demo-package-1.deb         # Dummy Debian package 1
├── demo-package-2.deb         # Dummy Debian package 2
├── demo-package-3.deb         # Dummy Debian package 3
├── setup.sh                    # Hardened Linux shell installer with machine activation
└── README.md                   # Package and installer reference documentation
```

> **DISCLAIMER: DEMO PACKAGES & APPLICATION ONLY**  
> Linux packages (`demo-package-1/2/3.deb`) and `demo-app` are **harmless demonstration artifacts**.  
> Microsoft `kbfiltr` source code in `windows-kbfiltr/` is the official Microsoft sample.  
> No dummy Windows binaries have been fabricated. Real Windows driver binaries will be generated on Windows 11 using Visual Studio 2022 + WDK.

---

## Artifact & Platform Overview

| File / Folder | Target Platform | Description |
| :--- | :--- | :--- |
| `setup.sh` | Ubuntu Linux | Hardened shell script installer. Handles license validation, machine ID derivation (`/etc/machine-id`), activation token receipt, B2 presigned package download, SHA-256 verification, and `dpkg -i` installation. |
| `demo-app` | Ubuntu Linux | Harmless executable demo application. Validates signed activation tokens locally using only the public verification key. Rejects execution if unactivated or bound to another machine. |
| `demo-package-1/2/3.deb` | Ubuntu Linux | Dummy Debian packages. Install harmless text files under `/opt/keyboard-driver-demo/`. |
| `windows-driver/setup.ps1` | Windows 11 | Windows PowerShell bootstrapper. Handles license validation, Windows machine identity derivation (`MachineGuid` + `System UUID`), activation token receipt, presigned URL download, SHA-256 verification, and `Pnputil` driver installation. |
| `windows-driver/setup.bat` | Windows 11 | Command Prompt launcher script for `setup.ps1`. |
| `windows-kbfiltr/` | Windows 11 | Official Microsoft Keyboard Filter Driver sample repository for Visual Studio 2022 + WDK build. |

---

## Windows 11 Build & Handoff Guide

To build the real Windows driver package and complete the end-to-end flow:

1. Boot Windows 11 (x64).
2. Install Visual Studio 2022 (*Desktop development with C++*) + Windows Driver Kit (WDK).
3. Open solution `Requirements/windows-kbfiltr/Windows-driver-samples/input/kbfiltr/sys/kbfiltr.vcxproj`.
4. Build solution in **Release x64** configuration.
5. Copy generated package output (`kbfiltr.inf`, `kbfiltr.sys`, `kbfiltr.cat`) into `Requirements/windows-driver/kbfiltr-driver-package.zip`.
6. Run `npm run upload:windows-package` to upload to Backblaze B2 and update server checksums.
7. Execute `.\Requirements\windows-driver\setup.ps1` on Windows 11 for complete testing.

---

## How `demo-app` Works (Ubuntu)

1. **Local Offline Token Verification**: Verifies the Ed25519 cryptographic signature of the activation token using **ONLY** the embedded public key (`DEMO_PUBLIC_KEY_PEM`). Contains **ZERO** private signing keys.
2. **Machine Identity Check**: Reads the local Ubuntu machine identity (derived from `/etc/machine-id`) and ensures it matches the `machine_id` signed inside the token.
3. **Activation Enforcement**:
   - **Valid Token + Matching Machine ID**: Prints `"Demo software activated successfully"` and exits with code `0`.
   - **No Token / Tampered Signature / Machine Mismatch**: Prints an activation failure message and exits with code `1`.

---

## How `setup.sh` Works (Ubuntu)

1. **System & OS Verification**: Ensures the installer is running on a Linux system.
2. **Protocol & Security Checks**: Requires HTTPS for all remote backend endpoints and download URLs (permits plain HTTP only for `localhost` and `127.0.0.1` during local development).
3. **License Validation**: Authenticates `license_key` against `POST /api/license/validate`.
4. **Machine Activation**: Derives the Ubuntu machine ID and calls `POST /api/activation`.
   - If this is the **first activation**, the backend binds the license to this machine and issues a signed activation token.
   - If the license is already bound to this machine (**reinstall**), the backend re-issues the signed token.
   - If the license is bound to a **different machine**, the backend rejects activation with `HTTP 403 Forbidden`, and `setup.sh` aborts installation.
5. **Private Package Download**: Downloads the 3 packages from short-lived presigned Backblaze B2 URLs.
6. **SHA-256 Checksum Verification**: Calculates the SHA-256 hash of each downloaded `.deb` file and compares it against the backend-provided checksum before executing installation.
7. **Package Installation**: Installs the verified packages via `dpkg -i` (using `sudo` if unprivileged).
8. **Saves Activation Token**: Writes `activation.token` to `/opt/keyboard-driver-demo/activation.token`.
9. **Executes `demo-app`**: Runs `demo-app` to verify active execution.
10. **Automated Cleanup**: Cleans up all temporary downloaded files and working directories on exit or interruption.


---

## Running `setup.sh`

### Real Machine A (Authorized Machine)
```bash
./setup.sh --license "YOUR_LICENSE_KEY" --backend "http://localhost:3000"
```

### Simulated Machine B (Testing Second Computer on Same Machine)
```bash
./setup.sh --license "YOUR_LICENSE_KEY" --backend "http://localhost:3000" --machine-id "SIMULATED_MACHINE_B_DEVICE"
```

---

## Rebuilding the `.deb` Files

```bash
BUILD_ROOT=$(mktemp -d /tmp/deb_rebuild_XXXXXX)

for i in 1 2 3; do
  PKG_DIR="$BUILD_ROOT/demo-package-$i"
  mkdir -p "$PKG_DIR/DEBIAN"
  mkdir -p "$PKG_DIR/opt/keyboard-driver-demo"
  
  cat <<EOF > "$PKG_DIR/DEBIAN/control"
Package: demo-package-$i
Version: 1.0.0
Section: utils
Priority: optional
Architecture: all
Maintainer: Demo Maintainer <demo@example.com>
Description: Demo dummy package $i for licensed software installer testing.
 Harmless demonstration package. Installs /opt/keyboard-driver-demo/demo-package-$i.txt.
EOF

  cat <<EOF > "$PKG_DIR/opt/keyboard-driver-demo/demo-package-$i.txt"
Keyboard Driver Demo - Component $i
Package: demo-package-$i
Version: 1.0.0
Description: Harmless dummy package created for license verification and installer testing.
Installed at: /opt/keyboard-driver-demo/demo-package-$i.txt
EOF

  dpkg-deb --build "$PKG_DIR" "./demo-package-$i.deb"
done

rm -rf "$BUILD_ROOT"
```
