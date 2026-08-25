'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function HomePage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handlePurchase = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setErrorMsg('Please enter your email address.');
      return;
    }

    setIsLoading(true);

    try {
      const res = await fetch('/api/purchase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: trimmedEmail }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setErrorMsg(data.error || 'Purchase failed. Please try again.');
        setIsLoading(false);
        return;
      }

      // Redirect to installation page with purchase details
      const params = new URLSearchParams({
        licenseKey: data.licenseKey,
        email: data.email,
        productName: data.product.name,
      });

      router.push(`/purchase/success?${params.toString()}`);
    } catch (err) {
      console.error(err);
      setErrorMsg('Network error. Failed to process demo purchase.');
      setIsLoading(false);
    }
  };

  return (
    <div className="container">
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem', marginBottom: '1rem' }}>
          <div>
            <span className="badge badge-demo" style={{ marginBottom: '0.75rem' }}>Windows 11 Driver & Software</span>
            <h1 className="card-title" style={{ fontSize: '2rem' }}>
              Indian Language Keyboard Driver — DEMO
            </h1>
            <p className="card-subtitle" style={{ fontSize: '1.05rem', maxWidth: '650px' }}>
              Demonstration of a secure licensed software distribution pipeline for Windows 11. Simulates purchasing a machine-bound driver package and receiving an authenticated installer.
            </p>
          </div>
          <div style={{ background: 'var(--bg-secondary)', padding: '1rem 1.5rem', borderRadius: '0.75rem', border: '1px solid var(--border)', textAlign: 'right' }}>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Demo Price</div>
            <div style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--accent)' }}>$29.00</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--success)' }}>Simulated Payment</div>
          </div>
        </div>

        <div className="grid-2" style={{ marginTop: '2rem' }}>
          <div>
            <h3 style={{ fontSize: '1.1rem', marginBottom: '1rem', color: 'var(--text-primary)' }}>
              Package Capabilities Included:
            </h3>
            <div className="feature-item">
              <span className="feature-icon">✓</span>
              <div>
                <strong>Machine-Bound Windows Driver Delivery</strong>
                <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                  Delivers authentic Windows driver package (kbfiltr) stored securely in private Backblaze B2 object storage.
                </p>
              </div>
            </div>
            <div className="feature-item">
              <span className="feature-icon">✓</span>
              <div>
                <strong>Zero-Account Architecture</strong>
                <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                  No username, password, or registration required. Customer email is linked directly to the license key.
                </p>
              </div>
            </div>
            <div className="feature-item">
              <span className="feature-icon">✓</span>
              <div>
                <strong>Cryptographic Integrity & Hardware Binding</strong>
                <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                  Bootstrapper verifies authoritative SHA-256 checksums and validates Ed25519 token bound to machine hardware.
                </p>
              </div>
            </div>
          </div>

          <div style={{ background: 'var(--bg-secondary)', padding: '1.75rem', borderRadius: '0.75rem', border: '1px solid var(--border)' }}>
            <h3 style={{ fontSize: '1.2rem', marginBottom: '0.5rem', color: 'var(--text-primary)' }}>
              Simulate Purchase
            </h3>
            <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '1.25rem' }}>
              Enter your email to simulate the purchase. A unique cryptographically secure license key will be generated.
            </p>

            {errorMsg && <div className="alert alert-danger">{errorMsg}</div>}

            <form onSubmit={handlePurchase}>
              <div className="input-group">
                <label className="input-label" htmlFor="email-input">
                  Customer Email Address
                </label>
                <input
                  id="email-input"
                  type="email"
                  className="input-field"
                  placeholder="customer@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={isLoading}
                  required
                />
              </div>

              <button
                type="submit"
                className="btn btn-primary"
                style={{ width: '100%', padding: '0.875rem' }}
                disabled={isLoading}
              >
                {isLoading ? 'Processing Mock Payment...' : 'Buy Demo ($29.00)'}
              </button>
            </form>

            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '1rem', textAlign: 'center' }}>
              ℹ️ No real credit card or payment gateway is invoked. This is a demonstration purchase.
            </p>
          </div>
        </div>
      </div>

      <div className="card">
        <h3 className="card-title" style={{ fontSize: '1.2rem' }}>
          Customer Purchase & Installation Lifecycle
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', marginTop: '1rem' }}>
          <div style={{ background: 'var(--bg-secondary)', padding: '1rem', borderRadius: '0.5rem', border: '1px solid var(--border)' }}>
            <div style={{ color: 'var(--accent)', fontWeight: 700, marginBottom: '0.25rem' }}>1. Purchase</div>
            <p style={{ fontSize: '0.825rem', color: 'var(--text-secondary)' }}>
              Customer inputs email and completes mock payment without requiring an account.
            </p>
          </div>
          <div style={{ background: 'var(--bg-secondary)', padding: '1rem', borderRadius: '0.5rem', border: '1px solid var(--border)' }}>
            <div style={{ color: 'var(--accent)', fontWeight: 700, marginBottom: '0.25rem' }}>2. License Issued</div>
            <p style={{ fontSize: '0.825rem', color: 'var(--text-secondary)' }}>
              Backend generates cryptographically secure license key and grants installer access.
            </p>
          </div>
          <div style={{ background: 'var(--bg-secondary)', padding: '1rem', borderRadius: '0.5rem', border: '1px solid var(--border)' }}>
            <div style={{ color: 'var(--accent)', fontWeight: 700, marginBottom: '0.25rem' }}>3. Presigned Fetch</div>
            <p style={{ fontSize: '0.825rem', color: 'var(--text-secondary)' }}>
              Installer validates license and receives short-lived authenticated download URLs.
            </p>
          </div>
          <div style={{ background: 'var(--bg-secondary)', padding: '1rem', borderRadius: '0.5rem', border: '1px solid var(--border)' }}>
            <div style={{ color: 'var(--accent)', fontWeight: 700, marginBottom: '0.25rem' }}>4. Verification & Install</div>
            <p style={{ fontSize: '0.825rem', color: 'var(--text-secondary)' }}>
              Installer matches SHA-256 hashes, installs packages, and removes temporary files.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
