import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Install PWA | Bila UiTM Cuti?',
  description: 'Install Bila UiTM Cuti? as an app for offline access to the UiTM academic calendar.',
  openGraph: {
    siteName: 'Bila UiTM Cuti?',
    title: 'Install PWA | Bila UiTM Cuti?',
    description: 'Install Bila UiTM Cuti? as an app for offline access.',
    type: 'website',
    url: 'https://cutiuitm.xyz/pwa',
    locale: 'ms_MY',
    images: [{ url: '/all.png', width: 1200, height: 630, alt: 'Bila UiTM Cuti?' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Install PWA | Bila UiTM Cuti?',
    description: 'Install Bila UiTM Cuti? as an app for offline access.',
  },
};

export default function PWALayout({ children }: { children: React.ReactNode }) {
  return children;
}
