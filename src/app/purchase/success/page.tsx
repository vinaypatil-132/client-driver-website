'use client';

import React, { useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';

function SuccessContent() {
  const searchParams = useSearchParams();
  const licenseKey = searchParams.get('licenseKey') || 'NAV-XXXX-XXXX-XXXX-XXXX';
  const email = searchParams.get('email') || 'customer@organization.com';
  const productName = searchParams.get('productName') || 'Nav Brahmi Driver Suite';

  const [copiedKey, setCopiedKey] = useState(false);

  const handleCopyKey = () => {
    navigator.clipboard.writeText(licenseKey);
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 2500);
  };

  const downloadUrl = `/api/download-installer?platform=windows&licenseKey=${encodeURIComponent(licenseKey)}`;

  return (
    <div className="container" style={{ maxWidth: '860px' }}>
      <div className="card card-elevated" style={{ marginBottom: '2rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '1.25rem' }}>
          <span className="pill-badge pill-success">✓ Order Confirmed</span>
          <span className="pill-badge pill-brand">Lifetime License Active</span>
        </div>

        <h1 style={{ fontSize: '2.25rem', fontWeight: 800, color: 'var(--text-main)', marginBottom: '0.5rem', letterSpacing: '-0.02em' }}>
          Thank You for Your Order!
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '1.05rem', marginBottom: '1.75rem' }}>
          Your license for <strong>{productName}</strong> is registered and ready for installation on Microsoft Windows.
        </p>

        {/* License & Order Details Grid */}
        <div style={{ background: 'var(--bg-surface-elevated)', border: '1px solid var(--border-color)', borderRadius: '10px', padding: '1.5rem', marginBottom: '2rem' }}>
          <div className="grid-2" style={{ gap: '1.25rem', marginBottom: '1.25rem' }}>
            <div>
              <div style={{ fontSize: '0.775rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.2rem', fontWeight: 700 }}>
                Customer Account
              </div>
              <div style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-main)' }}>
                {email}
              </div>
            </div>
            <div>
              <div style={{ fontSize: '0.775rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.2rem', fontWeight: 700 }}>
                Product Edition
              </div>
              <div style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-main)' }}>
                {productName}
              </div>
            </div>
          </div>

          <div>
            <div style={{ fontSize: '0.775rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.35rem', fontWeight: 700 }}>
              Your License Key (Optional / Fallback)
            </div>
            <div className="license-display-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem', margin: 0 }}>
              <span className="license-key-text">{licenseKey}</span>
              <button className="copy-btn" onClick={handleCopyKey}>
                {copiedKey ? '✓ Copied to Clipboard' : '📋 Copy License Key'}
              </button>
            </div>
          </div>
        </div>

        {/* Primary Download Installer Action */}
        <div style={{ background: 'var(--brand-subtle)', border: '2px solid var(--brand-primary)', borderRadius: '12px', padding: '2.25rem', marginBottom: '2.25rem', textAlign: 'center' }}>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--brand-primary)', marginBottom: '0.4rem' }}>
            Download Official Windows Installer
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', maxWidth: '580px', margin: '0 auto 1.5rem auto' }}>
            Your download includes the pre-authorized <code>Setup.exe</code> package with automated license identification and typography suite.
          </p>

          <a
            href={downloadUrl}
            className="btn btn-primary"
            style={{ padding: '1rem 2.25rem', fontSize: '1.1rem', display: 'inline-flex', alignItems: 'center', gap: '0.75rem' }}
          >
            <span style={{ fontSize: '1.25rem' }}>📥</span>
            <span>Download Pre-Authorized Setup.exe</span>
          </a>

          <div style={{ fontSize: '0.825rem', color: 'var(--text-muted)', marginTop: '0.9rem', fontWeight: 500 }}>
            Compatible with Windows 11 & Windows 10 (64-bit / 32-bit) &bull; Standalone Executable
          </div>
        </div>

        {/* 4-Step Installation Guide */}
        <div style={{ marginBottom: '2.25rem' }}>
          <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-main)', marginBottom: '1.25rem' }}>
            Quick Installation Instructions
          </h3>

          <div className="grid-4">
            <div className="step-card" style={{ background: 'var(--bg-surface-elevated)' }}>
              <div className="step-number">1</div>
              <strong style={{ fontSize: '0.9rem', color: 'var(--text-main)', display: 'block', marginBottom: '0.2rem' }}>
                Download Setup.exe
              </strong>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: 0 }}>
                Click the button above to download your installer.
              </p>
            </div>

            <div className="step-card" style={{ background: 'var(--bg-surface-elevated)' }}>
              <div className="step-number">2</div>
              <strong style={{ fontSize: '0.9rem', color: 'var(--text-main)', display: 'block', marginBottom: '0.2rem' }}>
                Double-Click to Run
              </strong>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: 0 }}>
                Launch <code>Setup.exe</code> from your Downloads folder.
              </p>
            </div>

            <div className="step-card" style={{ background: 'var(--bg-surface-elevated)' }}>
              <div className="step-number">3</div>
              <strong style={{ fontSize: '0.9rem', color: 'var(--text-main)', display: 'block', marginBottom: '0.2rem' }}>
                Approve Permission
              </strong>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: 0 }}>
                Click <strong>&quot;Yes&quot;</strong> on the Windows UAC elevation prompt.
              </p>
            </div>

            <div className="step-card" style={{ background: 'var(--bg-surface-elevated)' }}>
              <div className="step-number">4</div>
              <strong style={{ fontSize: '0.9rem', color: 'var(--text-main)', display: 'block', marginBottom: '0.2rem' }}>
                Install & Type
              </strong>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: 0 }}>
                Click &quot;Install Driver&quot; and your keyboard is registered.
              </p>
            </div>
          </div>
        </div>

        {/* Smart Auto-Activation Note */}
        <div
          style={{
            background: 'var(--bg-surface-elevated)',
            border: '1px solid var(--border-color)',
            borderRadius: '10px',
            padding: '1.25rem',
            marginBottom: '2rem',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '0.85rem',
          }}
        >
          <span style={{ fontSize: '1.25rem', flexShrink: 0 }}>💡</span>
          <div>
            <strong style={{ color: 'var(--text-main)', fontSize: '0.925rem', display: 'block', marginBottom: '0.2rem' }}>
              No Need to Remember or Copy Keys
            </strong>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: 0, lineHeight: '1.5' }}>
              Your downloaded installer is already tied to your license. If you ever switch computers or close this page, you can retrieve your installer at any time from our{' '}
              <Link href="/recover" style={{ color: 'var(--brand-primary)', fontWeight: 700 }}>
                License Recovery Portal
              </Link>
              .
            </p>
          </div>
        </div>

        {/* Navigation Actions */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', paddingTop: '1.25rem', borderTop: '1px solid var(--border-color)' }}>
          <Link href="/" className="btn btn-secondary">
            &larr; Back to Store
          </Link>
          <Link href="/recover" style={{ color: 'var(--brand-primary)', fontSize: '0.9rem', fontWeight: 700 }}>
            License Recovery Tool &rarr;
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
          <p style={{ color: 'var(--text-secondary)' }}>Loading purchase confirmation...</p>
        </div>
      }
    >
      <SuccessContent />
    </Suspense>
  );
}
