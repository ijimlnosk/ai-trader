import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { Providers } from './providers';
import './globals.css';

export const metadata: Metadata = {
  title: 'AI Trader', robots: { index: false, follow: false },
  appleWebApp: { capable: true, title: 'AI Trader', statusBarStyle: 'default' },
};
export const viewport: Viewport = {
  width: 'device-width', initialScale: 1, viewportFit: 'cover',
  themeColor: [{ media: '(prefers-color-scheme: light)', color: '#f4f5f7' }, { media: '(prefers-color-scheme: dark)', color: '#101214' }],
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ko">
      <body><Providers>{children}</Providers></body>
    </html>
  );
}
