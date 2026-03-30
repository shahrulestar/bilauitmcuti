import type { Metadata } from 'next';

const listCoverImage = '/list-cover.png';

export const metadata: Metadata = {
  metadataBase: new URL('https://bilauitmcuti.com'),
  title: 'Bila UiTM Cuti',
  description: 'Interactive UiTM academic calendar. View registration dates, lecture schedules, examination periods, and breaks. Includes regional schedule variations for Kedah, Kelantan, and Terengganu. Supports dark/light themes and offline access.',
  alternates: {
    canonical: 'https://bilauitmcuti.com/list',
  },
  openGraph: {
    siteName: 'Bila UiTM Cuti?',
    title: 'Bila UiTM Cuti',
    description: 'Interactive calendar showing UiTM academic schedules, registration dates, lecture periods, and examination dates.',
    type: 'website',
    url: 'https://bilauitmcuti.com/list',
    locale: 'ms_MY',
    images: [
      {
        url: listCoverImage,
        width: 1200,
        height: 630,
        alt: 'Bila UiTM Cuti? - Academic Calendar',
        type: 'image/png',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Bila UiTM Cuti',
    description: 'Interactive UiTM academic calendar with support for all program groups and regional variations.',
    images: [
      {
        url: listCoverImage,
        alt: 'Bila UiTM Cuti? - Academic Calendar',
      },
    ],
  },
};

const listBreadcrumbJsonLd = JSON.stringify({
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  "itemListElement": [
    { "@type": "ListItem", "position": 1, "name": "Home", "item": "https://bilauitmcuti.com" },
    { "@type": "ListItem", "position": 2, "name": "List View", "item": "https://bilauitmcuti.com/list" },
  ],
});

export default function ListLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: listBreadcrumbJsonLd }} />
      {children}
    </>
  );
}
