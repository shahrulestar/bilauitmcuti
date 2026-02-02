import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'List View | Bila UiTM Cuti?',
  description: 'UiTM academic calendar 2026 – list view. View registration, lectures, examinations, and breaks.',
  openGraph: {
    siteName: 'Bila UiTM Cuti?',
    title: 'List View | Bila UiTM Cuti?',
    description: 'UiTM academic calendar 2026 – list view.',
    type: 'website',
    url: 'https://cutiuitm.xyz/list',
    locale: 'ms_MY',
    images: [{ url: '/all-list.png', width: 1200, height: 630, alt: 'Bila UiTM Cuti?' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'List View | Bila UiTM Cuti?',
    description: 'UiTM academic calendar 2026 – list view.',
  },
};

export default function ListLayout({ children }: { children: React.ReactNode }) {
  return children;
}
