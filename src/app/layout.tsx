import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Licensed Software Installation System — DEMO',
  description: 'Demonstration of a secure licensed software delivery and installation system for Ubuntu Linux.',
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
              <span>Linux Driver Demo</span>
            </a>
            <span className="badge badge-demo">Demo Mode</span>
          </div>
        </header>

        <main style={{ flex: 1 }}>{children}</main>

        <footer className="footer">
          <div className="container">
            <p>
              Licensed Software Installation Demo &bull; Harmless packages &bull; No login required
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}
