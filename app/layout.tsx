import type { Metadata } from 'next';
import './globals.css';
import { Playfair_Display, DM_Mono } from 'next/font/google';
import { cn } from '@/lib/utils';
import { CartProvider } from '@/components/CartDrawer';

const playfair = Playfair_Display({
  subsets : ['latin'],
  weight  : ['400', '500', '600', '700'],
  style   : ['normal', 'italic'],
  variable: '--font-serif',
  display : 'swap',
});

const dmMono = DM_Mono({
  subsets : ['latin'],
  weight  : ['300', '400', '500'],
  style   : ['normal', 'italic'],
  variable: '--font-mono',
  display : 'swap',
});

export const metadata: Metadata = {
  title      : 'MXLLA Agency — Private Showroom',
  description: 'VIP wholesale showroom for authorised retailers.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={cn(playfair.variable, dmMono.variable)}>
      <body className="bg-white text-black antialiased"><CartProvider>{children}</CartProvider></body>
    </html>
  );
}
