# Licensed Software Installation & Delivery

This directory contains the Windows driver distribution assets, bootstrapper installer scripts, and package metadata for the Nav Brahmi driver pipeline.

---

## Directory Structure

```
Requirements/
└── windows-driver/                                 # Windows 11 bootstrapper & driver packages
    ├── brahmi-tamil-grantha-driver-package.zip     # Authentic Brahmi Tamil Grantha package
    ├── kharoshthi-driver-package.zip               # Authentic Kharoshthi package
    ├── setup.ps1                                   # Production-grade PowerShell bootstrapper
    ├── setup.bat                                   # Batch wrapper launcher
    └── README.md                                   # Windows installation & architecture guide
```

---

## Supported Driver Packages

| Package | Edition | Content | Storage Key |
|---|---|---|---|
| `brahmi-tamil-grantha-driver-package.zip` | Brahmi Tamil Grantha (2026) | MSKLC Drivers (x64/x86/IA64/WOW64) + Noto Sans Grantha Font | `driver/windows/brahmi-tamil-grantha-driver-package.zip` |
| `kharoshthi-driver-package.zip` | Kharoshthi | MSKLC Drivers (x64/x86/IA64/WOW64) + Noto Sans Kharoshthi Font | `driver/windows/kharoshthi-driver-package.zip` |
