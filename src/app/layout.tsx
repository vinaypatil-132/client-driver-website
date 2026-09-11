import type { Metadata } from 'next';
import Link from 'next/link';
import './globals.css';

export const metadata: Metadata = {
  title: 'Nav Brahmi — Official Windows Keyboard Drivers & Typography',
  description: 'Native Unicode keyboard layout drivers and typography for Brahmi, Tamil Grantha, and Kharoshthi on Microsoft Windows 11 and Windows 10.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </head>
      <body>
        <header className="site-header">
          <div className="container header-inner">
            <Link href="/" className="brand-logo">
              <div className="brand-icon">⌨️</div>
              <div>
                <span>Nav Brahmi</span>
                <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'rgba(255, 255, 255, 0.75)', marginLeft: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Drivers
                </span>
              </div>
            </Link>

            <nav className="nav-links">
              <Link href="/#editions" className="nav-link">
                Editions & Pricing
              </Link>
              <Link href="/#features" className="nav-link">
                Features
              </Link>
              <Link href="/#installation" className="nav-link">
                Installation
              </Link>
              <Link href="/recover" className="nav-recovery-btn">
                <span>🔍</span> Recover License
              </Link>
            </nav>
          </div>
        </header>

        <main className="main-content">{children}</main>

        <footer className="site-footer">
          <div className="container">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '2.5rem', marginBottom: '2.5rem' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.85rem' }}>
                  <div className="brand-icon" style={{ width: '32px', height: '32px', fontSize: '1rem' }}>⌨️</div>
                  <strong style={{ fontSize: '1.15rem', color: '#FFFFFF' }}>Nav Brahmi Driver Suite</strong>
                </div>
                <p style={{ fontSize: '0.875rem', color: 'rgba(255, 255, 255, 0.75)', lineHeight: '1.6' }}>
                  Native keyboard layout drivers and authentic Unicode typography for classical and historical Indic scripts on Microsoft Windows.
                </p>
              </div>

              <div>
                <h4 style={{ fontSize: '0.9rem', color: '#FFFFFF', marginBottom: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Supported Environments
                </h4>
                <ul style={{ listStyle: 'none', fontSize: '0.875rem', color: 'rgba(255, 255, 255, 0.75)', display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
                  <li>✓ Microsoft Windows 11 (x64 / AMD64)</li>
                  <li>✓ Microsoft Windows 10 (64-bit / 32-bit)</li>
                  <li>✓ Microsoft Office, Adobe Creative Cloud, & Browsers</li>
                  <li>✓ Native Language Bar & Input Method Integration</li>
                </ul>
              </div>

              <div>
                <h4 style={{ fontSize: '0.9rem', color: '#FFFFFF', marginBottom: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Customer Support
                </h4>
                <ul style={{ listStyle: 'none', fontSize: '0.875rem', color: 'rgba(255, 255, 255, 0.75)', display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
                  <li>
                    <Link href="/recover" style={{ color: '#FFFFFF', textDecoration: 'underline' }}>
                      → License & Installer Recovery Tool
                    </Link>
                  </li>
                  <li>
                    <Link href="/#installation" style={{ color: 'rgba(255, 255, 255, 0.85)' }}>
                      → Windows Installation Guide
                    </Link>
                  </li>
                  <li>
                    <span>🔒 Lifetime Single-Seat License</span>
                  </li>
                </ul>
              </div>
            </div>

            <div className="footer-bottom">
              <div>
                &copy; {new Date().getFullYear()} Nav Brahmi Driver Suite. All rights reserved.
              </div>
              <div style={{ display: 'flex', gap: '1.5rem' }}>
                <Link href="/recover" style={{ color: 'rgba(255, 255, 255, 0.75)', fontSize: '0.85rem' }}>
                  License Recovery
                </Link>
                <Link href="/#editions" style={{ color: 'rgba(255, 255, 255, 0.75)', fontSize: '0.85rem' }}>
                  Editions
                </Link>
              </div>
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}
