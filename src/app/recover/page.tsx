'use client';

import React, { useState } from 'react';
import Link from 'next/link';

interface RecoveredLicense {
  license_id: string;
  license_key: string;
  product_name: string;
  product_id: string;
  activation_status: string;
  created_at: string;
  download_url: string;
}

export default function LicenseRecoveryPage() {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [licenses, setLicenses] = useState<RecoveredLicense[]>([]);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const handleRecover = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setLicenses([]);

    const trimmed = email.trim();
    if (!trimmed) {
      setErrorMessage('Please enter your purchase email address.');
      return;
    }

    setIsLoading(true);

    try {
      const res = await fetch('/api/license/recover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: trimmed }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setErrorMessage(data.error || 'No active licenses were found for this email address.');
        setIsLoading(false);
        return;
      }

      setLicenses(data.licenses || []);
    } catch (err) {
      console.error(err);
      setErrorMessage('A network connection error occurred while recovering your license.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = (key: string) => {
    navigator.clipboard.writeText(key);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2500);
  };

  return (
    <div className="container" style={{ maxWidth: '860px' }}>
      <div className="card card-elevated">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '1.25rem' }}>
          <span className="pill-badge pill-brand">Customer Support</span>
          <span className="pill-badge pill-secondary">Self-Service Recovery</span>
        </div>

        <h1 style={{ fontSize: '2.25rem', fontWeight: 800, color: 'var(--text-main)', marginBottom: '0.5rem', letterSpacing: '-0.02em' }}>
          License & Installer Recovery
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '1.05rem', marginBottom: '2rem' }}>
          Retrieve your registered Nav Brahmi licenses and download pre-authorized Windows installers at any time using your purchase email address.
        </p>

        {/* Email Lookup Card */}
        <div
          style={{
            background: 'var(--bg-surface-elevated)',
            border: '1px solid var(--border-color)',
            borderRadius: '10px',
            padding: '1.75rem',
            marginBottom: '2rem',
          }}
        >
          <form onSubmit={handleRecover}>
            <div className="input-group">
              <label className="input-label" htmlFor="recovery-email">
                Purchase Email Address
              </label>
              <input
                id="recovery-email"
                type="email"
                className="input-field"
                placeholder="name@organization.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isLoading}
                required
              />
            </div>

            {errorMessage && (
              <div className="alert alert-danger" style={{ marginBottom: '1.25rem' }}>
                <span>⚠️</span>
                <div>{errorMessage}</div>
              </div>
            )}

            <button
              type="submit"
              className="btn btn-primary"
              style={{ width: '100%', padding: '0.95rem', fontSize: '1rem' }}
              disabled={isLoading}
            >
              {isLoading ? 'Searching Registered Licenses...' : '🔍 Locate My License & Installer'}
            </button>
          </form>
        </div>

        {/* Recovered Licenses Results */}
        {licenses.length > 0 && (
          <div style={{ marginTop: '2.5rem' }}>
            <h2 style={{ fontSize: '1.35rem', fontWeight: 800, marginBottom: '1.25rem', color: 'var(--text-main)' }}>
              Found {licenses.length} Active {licenses.length === 1 ? 'License' : 'Licenses'}
            </h2>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              {licenses.map((lic) => (
                <div
                  key={lic.license_id}
                  style={{
                    background: '#FFFFFF',
                    border: '1.5px solid var(--border-color)',
                    borderRadius: '10px',
                    padding: '1.75rem',
                    boxShadow: 'var(--shadow-sm)',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      flexWrap: 'wrap',
                      gap: '1rem',
                      marginBottom: '1.25rem',
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem' }}>
                        <h3 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0, color: 'var(--text-main)' }}>
                          {lic.product_name}
                        </h3>
                        <span className="pill-badge pill-success" style={{ fontSize: '0.75rem' }}>
                          Active
                        </span>
                      </div>
                      <div style={{ fontSize: '0.825rem', color: 'var(--text-muted)' }}>
                        Registered on {new Date(lic.created_at).toLocaleDateString()}
                      </div>
                    </div>

                    <a
                      href={lic.download_url}
                      className="btn btn-primary"
                      style={{
                        padding: '0.75rem 1.4rem',
                        fontSize: '0.95rem',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                      }}
                    >
                      <span>📥</span>
                      <span>Download Setup.exe</span>
                    </a>
                  </div>

                  <div style={{ marginTop: '1rem' }}>
                    <div style={{ fontSize: '0.775rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.35rem', fontWeight: 700 }}>
                      License Key (Fallback / Manual Entry)
                    </div>
                    <div className="license-display-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem', margin: 0 }}>
                      <span className="license-key-text" style={{ fontSize: '1.05rem' }}>{lic.license_key}</span>
                      <button className="copy-btn" onClick={() => handleCopy(lic.license_key)}>
                        {copiedKey === lic.license_key ? '✓ Copied!' : '📋 Copy Key'}
                      </button>
                    </div>
                  </div>

                  <div
                    style={{
                      marginTop: '1.25rem',
                      padding: '0.85rem 1rem',
                      background: 'var(--brand-subtle)',
                      borderRadius: '8px',
                      border: '1px solid var(--brand-border)',
                      fontSize: '0.825rem',
                      color: 'var(--text-secondary)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                    }}
                  >
                    <span>💡</span>
                    <span><strong>Pre-Authorized Installer:</strong> Double-click the downloaded <code>Setup.exe</code> on your Windows PC to install without typing your key.</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Footer Navigation */}
        <div style={{ marginTop: '2.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', paddingTop: '1.25rem', borderTop: '1px solid var(--border-color)' }}>
          <Link href="/" className="btn btn-secondary">
            &larr; Back to Store
          </Link>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: 0 }}>
            Need a new driver edition?{' '}
            <Link href="/#editions" style={{ color: 'var(--brand-primary)', fontWeight: 700 }}>
              View Editions &rarr;
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
