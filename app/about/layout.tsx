import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'About | Bila UiTM Cuti?',
  description: 'Learn about the latest Bila UiTM Cuti? web app features for the UiTM 2026 academic calendar.',
  alternates: {
    canonical: 'https://cutiuitm.xyz/about',
  },
  openGraph: {
    siteName: 'Bila UiTM Cuti?',
    title: 'About | Bila UiTM Cuti?',
    description: 'Latest Bila UiTM Cuti? web app information and feature overview.',
    type: 'website',
    url: 'https://cutiuitm.xyz/about',
    locale: 'ms_MY',
    images: [
      {
        url: 'https://cutiuitm.xyz/all-cover.png',
        width: 1200,
        height: 630,
        alt: 'About Bila UiTM Cuti?',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'About | Bila UiTM Cuti?',
    description: 'Latest Bila UiTM Cuti? web app information and feature overview.',
    images: ['https://cutiuitm.xyz/all-cover.png'],
  },
};

export default function AboutLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
