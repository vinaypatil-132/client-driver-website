'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';

interface ProductOption {
  id: string;
  name: string;
  tagline: string;
  badge: string;
  description: string;
  features: string[];
  price: number;
}

const PRODUCTS: ProductOption[] = [
  {
    id: 'brahmi-tamil-grantha',
    name: 'Nav Brahmi — Brahmi Tamil Grantha (2026)',
    tagline: 'Authentic Brahmi, Tamil, and Grantha Windows Keyboard Driver',
    badge: 'Flagship Edition',
    description:
      'Native MSKLC keyboard layout driver with full Windows 11 integration (AMD64/x86/WOW64) and Noto Sans Grantha unicode fonts.',
    features: [
      'Complete Brahmi & Tamil Grantha Unicode mapping',
      'Architecture-optimized drivers (x64 / x86 / WOW64)',
      'Noto Sans Grantha Unicode typography included',
      'System-wide input method and layout integration',
    ],
    price: 39.0,
  },
  {
    id: 'kharoshthi',
    name: 'Nav Brahmi — Kharoshthi',
    tagline: 'Ancient Kharoshthi Script Keyboard Layout Driver',
    badge: 'Ancient Script Series',
    description:
      'Native MSKLC keyboard layout driver for historical and scholarly Kharoshthi script input with Noto Sans Kharoshthi fonts.',
    features: [
      'Scholarly Kharoshthi script Unicode keyboard layout',
      'Architecture-optimized drivers (x64 / x86 / WOW64)',
      'Noto Sans Kharoshthi typography included',
      'System-wide input method and layout integration',
    ],
    price: 39.0,
  },
];

export default function HomePage() {
  const router = useRouter();
  const [selectedProduct, setSelectedProduct] = useState<string>('brahmi-tamil-grantha');
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const currentProduct = PRODUCTS.find((p) => p.id === selectedProduct) || PRODUCTS[0];

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
        body: JSON.stringify({
          email: trimmedEmail,
          productName: currentProduct.name,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setErrorMsg(data.error || 'Purchase failed. Please try again.');
        setIsLoading(false);
        return;
      }

      const params = new URLSearchParams({
        licenseKey: data.licenseKey,
        email: data.email,
        productName: data.product.name,
      });

      router.push(`/purchase/success?${params.toString()}`);
    } catch (err) {
      console.error(err);
      setErrorMsg('Network error. Failed to process purchase.');
      setIsLoading(false);
    }
  };

  return (
    <div className="container">
      <div className="card">
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            flexWrap: 'wrap',
            gap: '1rem',
            marginBottom: '1.5rem',
          }}
        >
          <div>
            <span className="badge badge-demo" style={{ marginBottom: '0.75rem' }}>
              Windows 11 Licensed Drivers
            </span>
            <h1 className="card-title" style={{ fontSize: '2.1rem' }}>
              Nav Brahmi Driver Suite
            </h1>
            <p className="card-subtitle" style={{ fontSize: '1.05rem', maxWidth: '650px' }}>
              Secure licensed software distribution with machine-bound hardware activation (MachineGuid + System UUID) and private Backblaze B2 delivery.
            </p>
          </div>
          <div
            style={{
              background: 'var(--bg-secondary)',
              padding: '1rem 1.5rem',
              borderRadius: '0.75rem',
              border: '1px solid var(--border)',
              textAlign: 'right',
            }}
          >
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              Selected Product Price
            </div>
            <div style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--accent)' }}>
              ${currentProduct.price.toFixed(2)}
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--success)' }}>Simulated Purchase</div>
          </div>
        </div>

        {/* Product Selection Cards */}
        <div style={{ marginBottom: '2rem' }}>
          <label className="input-label" style={{ marginBottom: '0.75rem', display: 'block' }}>
            Select Driver Product Edition:
          </label>
          <div className="grid-2" style={{ gap: '1rem' }}>
            {PRODUCTS.map((prod) => {
              const isSelected = prod.id === selectedProduct;
              return (
                <div
                  key={prod.id}
                  onClick={() => setSelectedProduct(prod.id)}
                  style={{
                    cursor: 'pointer',
                    padding: '1.25rem',
                    borderRadius: '0.75rem',
                    border: isSelected ? '2px solid var(--accent)' : '1px solid var(--border)',
                    background: isSelected ? 'var(--bg-secondary)' : 'transparent',
                    transition: 'all 0.2s ease',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                    <span className="badge badge-demo" style={{ fontSize: '0.75rem' }}>{prod.badge}</span>
                    <span style={{ fontWeight: 700, color: 'var(--accent)' }}>${prod.price.toFixed(2)}</span>
                  </div>
                  <h4 style={{ fontSize: '1.05rem', margin: '0.25rem 0', color: 'var(--text-primary)' }}>
                    {prod.name}
                  </h4>
                  <p style={{ fontSize: '0.825rem', color: 'var(--text-secondary)', marginBottom: '0.75rem' }}>
                    {prod.tagline}
                  </p>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem', color: isSelected ? 'var(--accent)' : 'var(--text-muted)' }}>
                    <span>{isSelected ? '● Selected' : '○ Click to select'}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="grid-2" style={{ marginTop: '1.5rem' }}>
          <div>
            <h3 style={{ fontSize: '1.1rem', marginBottom: '1rem', color: 'var(--text-primary)' }}>
              Included Features ({currentProduct.name}):
            </h3>
            {currentProduct.features.map((feat, idx) => (
              <div className="feature-item" key={idx}>
                <span className="feature-icon">✓</span>
                <div>
                  <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', margin: 0 }}>
                    {feat}
                  </p>
                </div>
              </div>
            ))}
            <div className="feature-item">
              <span className="feature-icon">✓</span>
              <div>
                <strong>Machine-Bound Hardware Activation</strong>
                <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                  Ed25519 token locked to Windows Registry MachineGuid and System Hardware UUID.
                </p>
              </div>
            </div>
            <div className="feature-item">
              <span className="feature-icon">✓</span>
              <div>
                <strong>Private Backblaze B2 Delivery</strong>
                <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                  Short-lived presigned URLs with SHA-256 cryptographic verification.
                </p>
              </div>
            </div>
          </div>

          <div
            style={{
              background: 'var(--bg-secondary)',
              padding: '1.75rem',
              borderRadius: '0.75rem',
              border: '1px solid var(--border)',
            }}
          >
            <h3 style={{ fontSize: '1.2rem', marginBottom: '0.5rem', color: 'var(--text-primary)' }}>
              Simulate Purchase
            </h3>
            <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '1.25rem' }}>
              Enter your email to generate a machine-bound license for <strong>{currentProduct.name}</strong>.
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
                {isLoading ? 'Processing License Generation...' : `Get License ($${currentProduct.price.toFixed(2)})`}
              </button>
            </form>

            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '1rem', textAlign: 'center' }}>
              🔒 Zero-account delivery: License is bound directly to your email and hardware.
            </p>
          </div>
        </div>
      </div>

      <div className="card">
        <h3 className="card-title" style={{ fontSize: '1.2rem' }}>
          Hardware-Bound Delivery & Installation Flow
        </h3>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: '1rem',
            marginTop: '1rem',
          }}
        >
          <div style={{ background: 'var(--bg-secondary)', padding: '1rem', borderRadius: '0.5rem', border: '1px solid var(--border)' }}>
            <div style={{ color: 'var(--accent)', fontWeight: 700, marginBottom: '0.25rem' }}>1. Purchase & Key</div>
            <p style={{ fontSize: '0.825rem', color: 'var(--text-secondary)' }}>
              License key generated and stored in Supabase PostgreSQL without credentials.
            </p>
          </div>
          <div style={{ background: 'var(--bg-secondary)', padding: '1rem', borderRadius: '0.5rem', border: '1px solid var(--border)' }}>
            <div style={{ color: 'var(--accent)', fontWeight: 700, marginBottom: '0.25rem' }}>2. Machine Identity</div>
            <p style={{ fontSize: '0.825rem', color: 'var(--text-secondary)' }}>
              Bootstrapper generates hardware hash from MachineGuid and System UUID.
            </p>
          </div>
          <div style={{ background: 'var(--bg-secondary)', padding: '1rem', borderRadius: '0.5rem', border: '1px solid var(--border)' }}>
            <div style={{ color: 'var(--accent)', fontWeight: 700, marginBottom: '0.25rem' }}>3. Presigned Fetch</div>
            <p style={{ fontSize: '0.825rem', color: 'var(--text-secondary)' }}>
              Backend verifies active license and issues short-lived Backblaze B2 presigned download URL.
            </p>
          </div>
          <div style={{ background: 'var(--bg-secondary)', padding: '1rem', borderRadius: '0.5rem', border: '1px solid var(--border)' }}>
            <div style={{ color: 'var(--accent)', fontWeight: 700, marginBottom: '0.25rem' }}>4. Verification & Install</div>
            <p style={{ fontSize: '0.825rem', color: 'var(--text-secondary)' }}>
              SHA-256 hash verified, driver MSI & fonts installed, temporary files cleaned up.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
