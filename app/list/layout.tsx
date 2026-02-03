import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Bila UiTM Cuti? - Academic Calendar 2026',
  description: 'Interactive UiTM academic calendar for 2026. View registration dates, lecture schedules, examination periods, and breaks. Includes regional schedule variations for Kedah, Kelantan, and Terengganu. Supports dark/light themes and offline access.',
  openGraph: {
    siteName: 'Bila UiTM Cuti?',
    title: 'Bila UiTM Cuti? - Academic Calendar 2026',
    description: 'Interactive calendar showing UiTM academic schedules, registration dates, lecture periods, and examination dates for 2026.',
    type: 'website',
    url: 'https://cutiuitm.xyz/list',
    locale: 'ms_MY',
    images: [
      {
        url: '/all.png',
        width: 1200,
        height: 630,
        alt: 'Bila UiTM Cuti? - Academic Calendar 2026',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Bila UiTM Cuti? - Academic Calendar 2026',
    description: 'Interactive UiTM academic calendar with support for all program groups and regional variations.',
  },
};

export default function ListLayout({ children }: { children: React.ReactNode }) {
  return children;
}
