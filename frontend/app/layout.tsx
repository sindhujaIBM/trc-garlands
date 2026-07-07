import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'TRC Garlands — Handcrafted Flower Garlands, Calgary',
  description:
    'Custom artisan flower garlands for weddings, poojas, temples, and celebrations. Handcrafted in Calgary by Muni.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-jasmine text-gray-900 antialiased">
        {children}
      </body>
    </html>
  );
}
