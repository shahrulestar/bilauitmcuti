import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Download - Bila UiTM Cuti',
  description:
    'Install Bila UiTM Cuti as a Progressive Web App or save it as a browser bookmark for quick access to the UiTM academic calendar.',
  robots: { index: false, follow: true },
  alternates: {
    canonical: 'https://bilauitmcuti.com/download',
  },
  openGraph: {
    siteName: 'Bila UiTM Cuti',
    title: 'Download - Bila UiTM Cuti',
    description:
      'Install as a PWA or bookmark bilauitmcuti.com for faster access to the UiTM academic calendar.',
    type: 'website',
    url: 'https://bilauitmcuti.com/download',
    locale: 'ms_MY',
    images: [{ url: 'https://bilauitmcuti.com/all-cover.png', width: 1200, height: 630, alt: 'Bila UiTM Cuti' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Download - Bila UiTM Cuti',
    description:
      'Install as a PWA or bookmark bilauitmcuti.com for faster access to the UiTM academic calendar.',
    images: ['https://bilauitmcuti.com/all-cover.png'],
  },
};

const downloadBreadcrumbJsonLd = JSON.stringify({
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://bilauitmcuti.com' },
    { '@type': 'ListItem', position: 2, name: 'Download', item: 'https://bilauitmcuti.com/download' },
  ],
});

export default function DownloadLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: downloadBreadcrumbJsonLd }} />
      {children}
    </>
  );
}
