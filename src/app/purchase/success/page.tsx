'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';

function SuccessContent() {
  const searchParams = useSearchParams();
  const licenseKey = searchParams.get('licenseKey') || 'DEMO-XXXX-XXXX-XXXX-XXXX';
  const email = searchParams.get('email') || 'customer@example.com';
  const productName = searchParams.get('productName') || 'Indian Language Keyboard Driver — DEMO';

  const [copiedKey, setCopiedKey] = useState(false);
  const [copiedCommand, setCopiedCommand] = useState(false);
  const [backendUrl, setBackendUrl] = useState('http://localhost:3000');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setBackendUrl(window.location.origin);
    }
  }, []);

  const terminalCommand = `powershell -ExecutionPolicy Bypass -Command "iwr -Uri '${backendUrl}/api/download-installer?platform=windows' -OutFile 'setup.ps1'; .\\setup.ps1 -LicenseKey '${licenseKey}' -BackendUrl '${backendUrl}'"`;

  const handleCopyKey = () => {
    navigator.clipboard.writeText(licenseKey);
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 2500);
  };

  const handleCopyCommand = () => {
    navigator.clipboard.writeText(terminalCommand);
    setCopiedCommand(true);
    setTimeout(() => setCopiedCommand(false), 2500);
  };

  return (
    <div className="container">
      <div className="card">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.25rem' }}>
          <span className="badge badge-success" style={{ fontSize: '0.85rem' }}>
            Payment Simulated Successfully
          </span>
          <span className="badge badge-demo">License Issued</span>
        </div>

        <h1 className="card-title" style={{ fontSize: '1.85rem' }}>
          Thank you for your purchase!
        </h1>
        <p className="card-subtitle">
          Your purchase of <strong>{productName}</strong> is complete. Follow the instructions below to install your software on Windows 11.
        </p>

        <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: '0.75rem', padding: '1.5rem', marginBottom: '2rem' }}>
          <div className="grid-2" style={{ gap: '1rem' }}>
            <div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Customer Email</div>
              <div style={{ fontSize: '1.05rem', fontWeight: 600, color: 'var(--text-primary)', marginTop: '0.2rem' }}>{email}</div>
            </div>
            <div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>License Status</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.2rem' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: 'var(--success)' }}></span>
                <span style={{ fontSize: '1.05rem', fontWeight: 600, color: 'var(--success)' }}>ACTIVE</span>
              </div>
            </div>
          </div>

          <div style={{ marginTop: '1.25rem' }}>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Your License Key</div>
            <div className="code-box" style={{ fontSize: '1.1rem', fontWeight: 700, letterSpacing: '0.05em' }}>
              <span>{licenseKey}</span>
              <button className="copy-btn" onClick={handleCopyKey}>
                {copiedKey ? '✓ Copied!' : 'Copy Key'}
              </button>
            </div>
          </div>
        </div>

        <h2 style={{ fontSize: '1.35rem', marginBottom: '1rem', color: 'var(--text-primary)' }}>
          Installation Instructions (Microsoft Windows 11)
        </h2>

        <div className="steps-list">
          <div className="step-item">
            <h3 style={{ fontSize: '1.05rem', marginBottom: '0.35rem' }}>Option A: One-Line PowerShell Installation (Recommended)</h3>
            <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
              Open PowerShell as Administrator and run the following command. It downloads the bootstrapper, validates your license, binds the machine hardware ID, downloads the verified driver package from private Backblaze B2, and installs the driver:
            </p>
            <div className="code-box">
              <code>{terminalCommand}</code>
              <button className="copy-btn" onClick={handleCopyCommand}>
                {copiedCommand ? '✓ Copied!' : 'Copy Command'}
              </button>
            </div>
          </div>

          <div className="step-item">
            <h3 style={{ fontSize: '1.05rem', marginBottom: '0.35rem' }}>Option B: Manual Bootstrapper Download</h3>
            <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '0.75rem' }}>
              Alternatively, download the PowerShell bootstrapper script directly and run it manually with your license key:
            </p>
            <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
              <a href="/api/download-installer?platform=windows" className="btn btn-secondary">
                📥 Download setup.ps1
              </a>
            </div>
            <div className="code-box" style={{ marginTop: '0.75rem' }}>
              <code>
                powershell -ExecutionPolicy Bypass -File .\setup.ps1 -LicenseKey &quot;{licenseKey}&quot; -BackendUrl &quot;{backendUrl}&quot;
              </code>
            </div>
          </div>
        </div>

        <div style={{ marginTop: '2rem', padding: '1rem', background: 'var(--bg-secondary)', borderRadius: '0.5rem', border: '1px solid var(--border)' }}>
          <h4 style={{ fontSize: '0.9rem', color: 'var(--text-primary)', marginBottom: '0.25rem' }}>
            🔒 Zero-Knowledge Storage & Hardware-Bound Security
          </h4>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
            The driver package is securely stored in private Backblaze B2 object storage. When <code>setup.ps1</code> runs, the backend validates your license in PostgreSQL, activates your machine ID (Registry MachineGuid + System UUID), and issues temporary expiring presigned URLs with verified SHA-256 hashes.
          </p>
        </div>

        <div style={{ marginTop: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Link href="/" className="btn btn-secondary">
            ← Back to Store
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function PurchaseSuccessPage() {
  return (
    <Suspense
      fallback={
        <div className="container" style={{ textAlign: 'center', padding: '4rem 1rem' }}>
          <p style={{ color: 'var(--text-secondary)' }}>Loading purchase details...</p>
        </div>
      }
    >
      <SuccessContent />
    </Suspense>
  );
}
