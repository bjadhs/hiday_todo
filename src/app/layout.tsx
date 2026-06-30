import type { Metadata, Viewport } from 'next';
import { Providers } from './providers';
import './globals.css';

export const metadata: Metadata = {
  title: 'Hiday',
  description: 'A brutalist todo app',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  // Keep the app fixed at one scale so the kanban/plan panes scroll internally
  // instead of the whole page zooming on mobile.
  maximumScale: 1,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#0a0a0a' },
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang='en' suppressHydrationWarning>
      <body className='antialiased'>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
