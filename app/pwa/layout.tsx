import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Install App | Bila UiTM Cuti',
  description: 'Add Bila UiTM Cuti to your home screen for faster access to the UiTM academic calendar.',
  robots: { index: false, follow: true },
  alternates: {
    canonical: 'https://bilauitmcuti.com/pwa',
  },
  openGraph: {
    siteName: 'Bila UiTM Cuti',
    title: 'Install App | Bila UiTM Cuti',
    description: 'Add Bila UiTM Cuti to your home screen for a faster, app-like experience.',
    type: 'website',
    url: 'https://bilauitmcuti.com/pwa',
    locale: 'ms_MY',
    images: [{ url: 'https://bilauitmcuti.com/all-cover.png', width: 1200, height: 630, alt: 'Bila UiTM Cuti' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Install App | Bila UiTM Cuti',
    description: 'Add Bila UiTM Cuti to your home screen for a faster, app-like experience.',
    images: ['https://bilauitmcuti.com/all-cover.png'],
  },
};

const pwaBreadcrumbJsonLd = JSON.stringify({
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  "itemListElement": [
    { "@type": "ListItem", "position": 1, "name": "Home", "item": "https://bilauitmcuti.com" },
    { "@type": "ListItem", "position": 2, "name": "Install App", "item": "https://bilauitmcuti.com/pwa" },
  ],
});

export default function PWALayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: pwaBreadcrumbJsonLd }} />
      {children}
    </>
  );
}
