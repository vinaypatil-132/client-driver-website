import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Nav Brahmi — Licensed Windows Keyboard Drivers',
  description: 'Secure licensed software delivery and machine-bound installation system for Nav Brahmi Windows 11 drivers.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <header className="header">
          <div className="container header-content">
            <a href="/" className="logo">
              <span>⌨️</span>
              <span>Nav Brahmi Drivers</span>
            </a>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <a href="/recover" style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', textDecoration: 'none' }}>
                🔍 Recover License
              </a>
              <span className="badge badge-demo">Windows 11 Production Suite</span>
            </div>
          </div>
        </header>

        <main style={{ flex: 1 }}>{children}</main>

        <footer className="footer">
          <div className="container" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
            <p style={{ margin: 0 }}>
              Nav Brahmi Licensed Software Delivery &bull; Hardware-Bound Activation &bull; Zero-Account Architecture
            </p>
            <div>
              <a href="/recover" style={{ color: 'var(--accent)', fontSize: '0.875rem' }}>
                Lost License Recovery &rarr;
              </a>
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}
