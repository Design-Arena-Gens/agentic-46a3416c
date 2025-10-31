import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'AI Fashion Shopping Assistant',
  description: 'Conversational shopping companion for discovering outfits'
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
