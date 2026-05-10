import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Splash — Mobile Car Wash',
  description: 'Run your mobile detailing business from your phone.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full">
      <body className="h-full font-sans">{children}</body>
    </html>
  );
}
