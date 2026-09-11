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
        setErrorMessage(data.error || 'Failed to locate licenses for this email.');
        setIsLoading(false);
        return;
      }

      setLicenses(data.licenses || []);
    } catch (err) {
      console.error(err);
      setErrorMessage('A network error occurred while recovering your license.');
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
    <div className="container">
      <div className="card">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.25rem' }}>
          <span className="badge badge-demo">Customer Self-Service</span>
          <span className="badge badge-success">Instant Recovery</span>
        </div>

        <h1 className="card-title" style={{ fontSize: '1.85rem' }}>
          Recover Your Nav Brahmi License
        </h1>
        <p className="card-subtitle">
          Closed the success page or lost your key? Enter your purchase email to retrieve your license key and download your pre-authorized Windows installer.
        </p>

        <div
          style={{
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border)',
            borderRadius: '0.75rem',
            padding: '1.75rem',
            marginBottom: '2rem',
          }}
        >
          <form onSubmit={handleRecover}>
            <div className="input-group" style={{ marginBottom: '1.25rem' }}>
              <label className="input-label" htmlFor="recovery-email">
                Purchase Email Address
              </label>
              <input
                id="recovery-email"
                type="email"
                className="input-field"
                placeholder="customer@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isLoading}
                required
              />
            </div>

            {errorMessage && (
              <div className="alert alert-danger" style={{ marginBottom: '1.25rem' }}>
                {errorMessage}
              </div>
            )}

            <button
              type="submit"
              className="btn btn-primary"
              style={{ width: '100%', padding: '0.875rem', fontSize: '1rem' }}
              disabled={isLoading}
            >
              {isLoading ? 'Searching Registered Licenses...' : '🔍 Find My License & Installer'}
            </button>
          </form>
        </div>

        {licenses.length > 0 && (
          <div style={{ marginTop: '2rem' }}>
            <h2 style={{ fontSize: '1.35rem', marginBottom: '1rem', color: 'var(--text-primary)' }}>
              Found {licenses.length} Active {licenses.length === 1 ? 'License' : 'Licenses'}
            </h2>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              {licenses.map((lic) => (
                <div
                  key={lic.license_id}
                  style={{
                    background: 'var(--bg-secondary)',
                    border: '2px solid var(--accent)',
                    borderRadius: '0.75rem',
                    padding: '1.5rem',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      flexWrap: 'wrap',
                      gap: '0.75rem',
                      marginBottom: '1rem',
                    }}
                  >
                    <div>
                      <h3 style={{ fontSize: '1.2rem', margin: '0 0 0.25rem 0', color: 'var(--text-primary)' }}>
                        {lic.product_name}
                      </h3>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                        Purchased on {new Date(lic.created_at).toLocaleDateString()} &bull; Status:{' '}
                        <span style={{ color: 'var(--success)', fontWeight: 600 }}>ACTIVE</span>
                      </div>
                    </div>

                    <a
                      href={lic.download_url}
                      className="btn btn-primary"
                      style={{
                        padding: '0.75rem 1.5rem',
                        fontSize: '0.95rem',
                        textDecoration: 'none',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                      }}
                    >
                      <span>📥</span>
                      <span>Download Pre-Authorized Setup.exe</span>
                    </a>
                  </div>

                  <div style={{ marginTop: '1rem' }}>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.35rem' }}>
                      License Key (Fallback / Manual Entry)
                    </div>
                    <div className="code-box" style={{ fontSize: '1.05rem', fontWeight: 700 }}>
                      <span>{lic.license_key}</span>
                      <button className="copy-btn" onClick={() => handleCopy(lic.license_key)}>
                        {copiedKey === lic.license_key ? '✓ Copied!' : 'Copy Key'}
                      </button>
                    </div>
                  </div>

                  <div
                    style={{
                      marginTop: '1rem',
                      padding: '0.75rem',
                      background: 'rgba(56, 189, 248, 0.08)',
                      borderRadius: '0.5rem',
                      border: '1px solid rgba(56, 189, 248, 0.2)',
                      fontSize: '0.825rem',
                      color: 'var(--text-secondary)',
                    }}
                  >
                    💡 <strong>Smart Auto-Activation:</strong> The downloaded <code>Setup.exe</code> is linked to this license. You can simply double-click and run it on Windows 11 without typing or remembering your key.
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div style={{ marginTop: '2.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Link href="/" className="btn btn-secondary">
            ← Back to Store
          </Link>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: 0 }}>
            Need to purchase a new license? <Link href="/" style={{ color: 'var(--accent)' }}>View Products</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
