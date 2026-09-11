'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';

function SuccessContent() {
  const searchParams = useSearchParams();
  const licenseKey = searchParams.get('licenseKey') || 'NAV-XXXX-XXXX-XXXX-XXXX';
  const email = searchParams.get('email') || 'customer@example.com';
  const productName = searchParams.get('productName') || 'Nav Brahmi Driver Suite';

  const [copiedKey, setCopiedKey] = useState(false);
  const [backendUrl, setBackendUrl] = useState('http://localhost:3000');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setBackendUrl(window.location.origin);
    }
  }, []);

  const handleCopyKey = () => {
    navigator.clipboard.writeText(licenseKey);
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 2500);
  };

  return (
    <div className="container">
      <div className="card">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.25rem' }}>
          <span className="badge badge-success" style={{ fontSize: '0.85rem' }}>
            Payment Successful
          </span>
          <span className="badge badge-demo">License Active</span>
        </div>

        <h1 className="card-title" style={{ fontSize: '1.85rem' }}>
          Thank you for your purchase!
        </h1>
        <p className="card-subtitle">
          Your license for <strong>{productName}</strong> is active. Follow the simple steps below to install on Windows 11.
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

        {/* Primary Customer Workflow */}
        <div style={{ background: 'var(--bg-secondary)', border: '2px solid var(--accent)', borderRadius: '0.75rem', padding: '1.75rem', marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
            <div>
              <h3 style={{ fontSize: '1.25rem', color: 'var(--text-primary)', margin: '0 0 0.25rem 0' }}>
                🚀 Windows Setup Bootstrapper (Setup.exe)
              </h3>
              <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', margin: 0 }}>
                Click below to download the official installer. Double-click <code>Setup.exe</code> and approve the Windows UAC prompt.
              </p>
            </div>
            <a
              href={`/api/download-installer?platform=windows&licenseKey=${encodeURIComponent(licenseKey)}`}
              className="btn btn-primary"
              style={{ padding: '0.875rem 1.75rem', fontSize: '1.05rem', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}
            >
              <span>📥</span>
              <span>Download Pre-Authorized Setup.exe</span>
            </a>
          </div>

          <div style={{ marginTop: '1.25rem', paddingTop: '1.25rem', borderTop: '1px solid var(--border)' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem' }}>
              <div>
                <strong>Step 1: Download</strong>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: '0.2rem 0 0 0' }}>
                  Click the button above to download your pre-authorized <code>Setup.exe</code>.
                </p>
              </div>
              <div>
                <strong>Step 2: Double-Click</strong>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: '0.2rem 0 0 0' }}>
                  Open <code>Setup.exe</code>. Your license is automatically identified!
                </p>
              </div>
              <div>
                <strong>Step 3: UAC Prompt</strong>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: '0.2rem 0 0 0' }}>
                  Click <strong>&quot;Yes&quot;</strong> when Windows asks for Administrator permission.
                </p>
              </div>
              <div>
                <strong>Step 4: Install</strong>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: '0.2rem 0 0 0' }}>
                  Click &quot;Install Driver&quot; and installation finishes automatically.
                </p>
              </div>
            </div>
          </div>
        </div>

        <div
          style={{
            marginTop: '1.25rem',
            padding: '1rem 1.25rem',
            background: 'rgba(56, 189, 248, 0.08)',
            borderRadius: '0.5rem',
            border: '1px solid rgba(56, 189, 248, 0.2)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
            <span style={{ fontSize: '1.25rem' }}>💡</span>
            <div>
              <strong style={{ color: 'var(--text-primary)', fontSize: '0.9rem' }}>No Need to Copy or Remember Keys:</strong>
              <p style={{ fontSize: '0.825rem', color: 'var(--text-secondary)', margin: '0.25rem 0 0 0' }}>
                Your downloaded installer is already tied to your license. If you ever lose this page or reinstall later, you can always recover your purchase at any time using our <Link href="/recover" style={{ color: 'var(--accent)', textDecoration: 'underline' }}>License Recovery Tool</Link>.
              </p>
            </div>
          </div>
        </div>

        <div style={{ marginTop: '2rem', padding: '1rem', background: 'var(--bg-secondary)', borderRadius: '0.5rem', border: '1px solid var(--border)' }}>
          <h4 style={{ fontSize: '0.9rem', color: 'var(--text-primary)', marginBottom: '0.25rem' }}>
            🔒 Zero-Knowledge Storage & Machine-Bound Security
          </h4>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
            The driver package is securely stored in private Backblaze B2 object storage. When <code>Setup.exe</code> runs, it derives your Windows hardware ID (Registry MachineGuid + System UUID), validates your license in PostgreSQL, downloads the verified package via expiring presigned URLs, and registers the driver and unicode typography.
          </p>
        </div>

        <div style={{ marginTop: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Link href="/" className="btn btn-secondary">
            ← Back to Store
          </Link>
          <Link href="/recover" style={{ color: 'var(--accent)', fontSize: '0.875rem' }}>
            License Recovery Page &rarr;
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
