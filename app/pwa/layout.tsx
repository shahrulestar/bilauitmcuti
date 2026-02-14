import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Install App | Bila UiTM Cuti?',
  description: 'Add Bila UiTM Cuti? to your home screen for faster access to the UiTM academic calendar.',
  openGraph: {
    siteName: 'Bila UiTM Cuti?',
    title: 'Install App | Bila UiTM Cuti?',
    description: 'Add Bila UiTM Cuti? to your home screen for a faster, app-like experience.',
    type: 'website',
    url: 'https://cutiuitm.xyz/pwa',
    locale: 'ms_MY',
    images: [{ url: '/all.png', width: 1200, height: 630, alt: 'Bila UiTM Cuti?' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Install App | Bila UiTM Cuti?',
    description: 'Add Bila UiTM Cuti? to your home screen for a faster, app-like experience.',
  },
};

export default function PWALayout({ children }: { children: React.ReactNode }) {
  return children;
}
