import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Changelog | Bila UiTM Cuti?',
  description: 'List of updates and improvements for Bila UiTM Cuti?',
  openGraph: {
    siteName: 'Bila UiTM Cuti?',
    title: 'Changelog | Bila UiTM Cuti?',
    description: 'List of updates and improvements for Bila UiTM Cuti?',
    type: 'website',
    url: 'https://cutiuitm.xyz/changelog',
    locale: 'ms_MY',
    images: [{ url: '/all.png', width: 1200, height: 630, alt: 'Bila UiTM Cuti?' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Changelog | Bila UiTM Cuti?',
    description: 'List of updates and improvements for Bila UiTM Cuti?',
  },
};

export default function ChangelogLayout({ children }: { children: React.ReactNode }) {
  return children;
}
