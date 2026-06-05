import type { Metadata } from 'next';
import './globals.css';
import { Playfair_Display, DM_Mono } from 'next/font/google';
import { cn } from '@/lib/utils';
import { CartProvider } from '@/components/CartDrawer';
import ChatWidget from '@/components/ChatWidget';

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
  title: {
    default : 'Linezheets — Digital Linesheets & B2B Wholesale Platform for Fashion Brands',
    template: '%s · Linezheets',
  },
  description:
    'Linezheets replaces PDF linesheets with a live, buyer-ready digital catalog. Share collections, manage orders, and grow your wholesale network — all in one platform.',
  keywords: [
    'linesheets', 'linesheet', 'line sheet', 'digital linesheet',
    'B2B wholesale fashion', 'fashion wholesale platform', 'wholesale buyer portal',
    'brand to buyer platform', 'digital lookbook', 'fashion sales tool',
    'wholesale order management', 'fashion B2B marketplace', 'luxury wholesale',
  ],
  authors     : [{ name: 'Linezheets' }],
  creator     : 'Linezheets',
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'https://linezheets.com'),
  alternates  : { canonical: '/' },
  openGraph: {
    type       : 'website',
    locale     : 'en_US',
    url        : '/',
    siteName   : 'Linezheets',
    title      : 'Linezheets — Digital Linesheets & B2B Wholesale Platform',
    description: 'Replace static PDF linesheets with a live digital catalog. Connect brands with wholesale buyers — smarter, faster, further.',
    images     : [{ url: '/og-image.png', width: 1200, height: 630, alt: 'Linezheets — B2B Wholesale Platform' }],
  },
  twitter: {
    card       : 'summary_large_image',
    title      : 'Linezheets — Digital Linesheets & B2B Wholesale',
    description: 'Replace PDF linesheets with a live buyer-ready digital catalog. AI-powered B2B wholesale for fashion brands.',
    images     : ['/og-image.png'],
  },
  robots: {
    index : true,
    follow: true,
    googleBot: { index: true, follow: true, 'max-image-preview': 'large' },
  },
};

const jsonLd = {
  '@context'   : 'https://schema.org',
  '@type'      : 'SoftwareApplication',
  name         : 'Linezheets',
  applicationCategory: 'BusinessApplication',
  operatingSystem    : 'Web',
  description  : 'Digital linesheet and B2B wholesale platform for fashion brands and buyers. Replace PDF linesheets with live digital catalogs, manage orders, and grow your wholesale network.',
  url          : process.env.NEXT_PUBLIC_SITE_URL ?? 'https://linezheets.com',
  offers: { '@type': 'Offer', category: 'B2B Wholesale Fashion Platform' },
  keywords     : 'linesheets, line sheet, digital linesheet, B2B wholesale fashion, fashion wholesale platform',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={cn(playfair.variable, dmMono.variable)}>
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body className="bg-white text-black antialiased"><CartProvider>{children}</CartProvider><ChatWidget /></body>
    </html>
  );
}
