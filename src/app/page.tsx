'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

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
      'Native MSKLC keyboard layout driver with full Windows 11 & 10 integration (AMD64 / x64 / WOW64) and Noto Sans Grantha unicode typography.',
    features: [
      'Complete Brahmi & Tamil Grantha Unicode mapping',
      'System-wide input method and layout integration',
      'High-definition Noto Sans Grantha font suite included',
      'Architecture-optimized native Windows binaries',
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
      'System-wide input method and layout integration',
      'Noto Sans Kharoshthi typography package included',
      'Architecture-optimized native Windows binaries',
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
      setErrorMsg('Please enter a valid email address.');
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
        setErrorMsg(data.error || 'Purchase could not be completed. Please try again.');
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
      setErrorMsg('A network connection error occurred. Please try again.');
      setIsLoading(false);
    }
  };

  return (
    <div className="container">
      {/* Hero Section */}
      <section className="hero-section">
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.6rem', marginBottom: '1rem' }}>
          <span className="pill-badge pill-brand">Official Microsoft Windows Drivers</span>
          <span className="pill-badge pill-secondary">Windows 11 & 10 Certified</span>
        </div>
        <h1 className="hero-title">
          Native Keyboard Layout Drivers for Classical Indic Scripts
        </h1>
        <p className="hero-subtitle">
          Engineered for scholars, linguists, and publishers. Seamless system-wide Unicode input methods, high-definition typography, and automated 1-click installation.
        </p>

        <div style={{ display: 'flex', justifyContent: 'center', gap: '2rem', marginTop: '1.75rem', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', fontSize: '0.9rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
            <span style={{ color: 'var(--brand-primary)' }}>✓</span> Instant Digital Delivery
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', fontSize: '0.9rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
            <span style={{ color: 'var(--brand-primary)' }}>✓</span> Lifetime Single-Seat License
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', fontSize: '0.9rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
            <span style={{ color: 'var(--brand-primary)' }}>✓</span> Automated Setup.exe Bootstrapper
          </div>
        </div>
      </section>

      {/* Main Purchasing & Editions Grid */}
      <section id="editions" style={{ marginBottom: '4rem' }}>
        <div style={{ marginBottom: '1.5rem' }}>
          <h2 style={{ fontSize: '1.65rem', fontWeight: 800, color: 'var(--text-main)', marginBottom: '0.35rem' }}>
            Choose Your Driver Edition
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
            Select your script edition to obtain your lifetime license and download your pre-authorized Windows installer.
          </p>
        </div>

        <div className="grid-2" style={{ alignItems: 'stretch' }}>
          {/* Left Column: Product Selection */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {PRODUCTS.map((prod) => {
              const isSelected = prod.id === selectedProduct;
              return (
                <div
                  key={prod.id}
                  className={`product-card ${isSelected ? 'selected' : ''}`}
                  onClick={() => setSelectedProduct(prod.id)}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                    <span className={`pill-badge ${isSelected ? 'pill-brand' : 'pill-secondary'}`}>
                      {prod.badge}
                    </span>
                    <span style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--brand-primary)' }}>
                      ₹{prod.price.toFixed(2)}{' '}
                      <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)' }}>INR</span>
                    </span>
                  </div>

                  <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: '0.4rem' }}>
                    {prod.name}
                  </h3>
                  <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '1.25rem', lineHeight: '1.5' }}>
                    {prod.description}
                  </p>

                  <div style={{ marginTop: 'auto', paddingTop: '1rem', borderTop: '1px solid var(--border-color)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem', fontWeight: 700, color: isSelected ? 'var(--brand-primary)' : 'var(--text-muted)' }}>
                      <span>{isSelected ? '● Selected Edition' : '○ Select this Edition'}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Right Column: Checkout & Summary Box */}
          <div className="card card-elevated" style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.25rem' }}>
              <div>
                <span className="pill-badge pill-brand" style={{ marginBottom: '0.5rem' }}>
                  Instant Order
                </span>
                <h3 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-main)' }}>
                  Order Summary
                </h3>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '1.85rem', fontWeight: 800, color: 'var(--brand-primary)' }}>
                  ₹{currentProduct.price.toFixed(2)}
                </div>
                <div style={{ fontSize: '0.775rem', color: 'var(--text-muted)' }}>One-time lifetime payment</div>
              </div>
            </div>

            <div style={{ background: 'var(--bg-surface-elevated)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '1rem', marginBottom: '1.5rem' }}>
              <strong style={{ fontSize: '0.95rem', color: 'var(--text-main)', display: 'block', marginBottom: '0.25rem' }}>
                {currentProduct.name}
              </strong>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: 0 }}>
                Includes native Windows drivers, Noto Sans typography, and lifetime single-seat authorization.
              </p>
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
              <h4 style={{ fontSize: '0.85rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.75rem', fontWeight: 700 }}>
                Package Includes:
              </h4>
              {currentProduct.features.map((feat, idx) => (
                <div className="feature-item" key={idx}>
                  <div className="feature-check">✓</div>
                  <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>{feat}</div>
                </div>
              ))}
            </div>

            {errorMsg && (
              <div className="alert alert-danger">
                <span>⚠️</span>
                <div>{errorMsg}</div>
              </div>
            )}

            <form onSubmit={handlePurchase} style={{ marginTop: 'auto' }}>
              <div className="input-group">
                <label className="input-label" htmlFor="customer-email">
                  Customer Email Address
                </label>
                <input
                  id="customer-email"
                  type="email"
                  className="input-field"
                  placeholder="name@organization.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={isLoading}
                  required
                />
              </div>

              <button
                type="submit"
                className="btn btn-primary"
                style={{ width: '100%', padding: '0.95rem', fontSize: '1.05rem' }}
                disabled={isLoading}
              >
                {isLoading ? (
                  <span>Generating License & Package...</span>
                ) : (
                  <>
                    <span>Get License & Download</span>
                    <span>&rarr;</span>
                  </>
                )}
              </button>
            </form>

            <div style={{ marginTop: '1.25rem', textAlign: 'center' }}>
              <p style={{ fontSize: '0.825rem', color: 'var(--text-muted)', margin: 0 }}>
                Already purchased?{' '}
                <Link href="/recover" style={{ color: 'var(--brand-primary)', fontWeight: 700 }}>
                  Recover your license and installer &rarr;
                </Link>
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Feature Highlights Grid */}
      <section id="features" style={{ marginBottom: '4rem' }}>
        <div style={{ textAlign: 'center', marginBottom: '2.25rem' }}>
          <h2 style={{ fontSize: '1.85rem', fontWeight: 800, color: 'var(--text-main)', marginBottom: '0.5rem' }}>
            Built for Native Windows Performance
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '1rem', maxWidth: '640px', margin: '0 auto' }}>
            Seamlessly integrated with Microsoft Windows architecture without requiring third-party background software.
          </p>
        </div>

        <div className="grid-3">
          <div className="step-card">
            <div style={{ fontSize: '2rem', marginBottom: '0.75rem', color: 'var(--brand-primary)' }}>⚡</div>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: '0.4rem' }}>
              System-Wide Native Integration
            </h3>
            <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
              Integrates directly with the Windows Language Bar. Type natively in Microsoft Word, Excel, Adobe Creative Cloud, browsers, and terminal editors.
            </p>
          </div>

          <div className="step-card">
            <div style={{ fontSize: '2rem', marginBottom: '0.75rem', color: 'var(--brand-primary)' }}>🔤</div>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: '0.4rem' }}>
              High-Definition Typography Included
            </h3>
            <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
              Includes verified Noto Sans Unicode typography packages tailored to Brahmi, Tamil Grantha, and Kharoshthi script standards.
            </p>
          </div>

          <div className="step-card">
            <div style={{ fontSize: '2rem', marginBottom: '0.75rem', color: 'var(--brand-primary)' }}>🛡️</div>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: '0.4rem' }}>
              Automated 1-Click Setup
            </h3>
            <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
              Your downloaded <code>Setup.exe</code> is pre-authorized. Double-click to install without needing to type or copy complex license keys.
            </p>
          </div>
        </div>
      </section>

      {/* Installation Guide Section */}
      <section id="installation" style={{ marginBottom: '4rem' }}>
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.75rem' }}>
            <div>
              <span className="pill-badge pill-brand" style={{ marginBottom: '0.5rem' }}>
                Quick Start Guide
              </span>
              <h2 style={{ fontSize: '1.65rem', fontWeight: 800, color: 'var(--text-main)' }}>
                How Installation Works
              </h2>
            </div>
            <Link href="/recover" className="btn btn-secondary" style={{ fontSize: '0.875rem', padding: '0.6rem 1.1rem' }}>
              License Recovery Tool &rarr;
            </Link>
          </div>

          <div className="grid-4">
            <div className="step-card" style={{ background: 'var(--bg-surface-elevated)' }}>
              <div className="step-number">1</div>
              <strong style={{ fontSize: '0.95rem', color: 'var(--text-main)', display: 'block', marginBottom: '0.25rem' }}>
                Get Your License
              </strong>
              <p style={{ fontSize: '0.825rem', color: 'var(--text-secondary)', margin: 0 }}>
                Select your edition and enter your email address.
              </p>
            </div>

            <div className="step-card" style={{ background: 'var(--bg-surface-elevated)' }}>
              <div className="step-number">2</div>
              <strong style={{ fontSize: '0.95rem', color: 'var(--text-main)', display: 'block', marginBottom: '0.25rem' }}>
                Download Setup.exe
              </strong>
              <p style={{ fontSize: '0.825rem', color: 'var(--text-secondary)', margin: 0 }}>
                Download your pre-authorized Windows installer.
              </p>
            </div>

            <div className="step-card" style={{ background: 'var(--bg-surface-elevated)' }}>
              <div className="step-number">3</div>
              <strong style={{ fontSize: '0.95rem', color: 'var(--text-main)', display: 'block', marginBottom: '0.25rem' }}>
                Double-Click & Run
              </strong>
              <p style={{ fontSize: '0.825rem', color: 'var(--text-secondary)', margin: 0 }}>
                Approve the Windows prompt. License is auto-detected!
              </p>
            </div>

            <div className="step-card" style={{ background: 'var(--bg-surface-elevated)' }}>
              <div className="step-number">4</div>
              <strong style={{ fontSize: '0.95rem', color: 'var(--text-main)', display: 'block', marginBottom: '0.25rem' }}>
                Start Typing
              </strong>
              <p style={{ fontSize: '0.825rem', color: 'var(--text-secondary)', margin: 0 }}>
                Select the layout from Windows Language Bar (Win+Space).
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
