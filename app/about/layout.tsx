import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'About | Bila UiTM Cuti',
  description: 'Learn about the latest Bila UiTM Cuti web app features for the UiTM academic calendar.',
  alternates: {
    canonical: 'https://bilauitmcuti.com/about',
  },
  openGraph: {
    siteName: 'Bila UiTM Cuti',
    title: 'About | Bila UiTM Cuti',
    description: 'Latest Bila UiTM Cuti web app information and feature overview.',
    type: 'website',
    url: 'https://bilauitmcuti.com/about',
    locale: 'ms_MY',
    images: [
      {
        url: 'https://bilauitmcuti.com/all-cover.png',
        width: 1200,
        height: 630,
        alt: 'About Bila UiTM Cuti',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'About | Bila UiTM Cuti',
    description: 'Latest Bila UiTM Cuti web app information and feature overview.',
    images: ['https://bilauitmcuti.com/all-cover.png'],
  },
};

export default function AboutLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
