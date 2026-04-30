export const runtime = 'edge';
import type { Metadata } from 'next';

// Export types for use in other components
export type ViewMode = 'list' | 'grid';


import { CalendarWrapper } from '@/components/calendar-wrapper';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Bila UiTM Cuti - Kalendar Akademik',
};

// Homepage: All programs, Grid view (default)
export default function Page() {
  return (
    <>
      <nav aria-label="Program shortcuts" className="sr-only">
        <ul>
          <li>
            <Link href="/foundation-professional">Foundation/Professional</Link>
          </li>
          <li>
            <Link href="/diploma">Diploma</Link>
          </li>
          <li>
            <Link href="/bachelor">Bachelor</Link>
          </li>
          <li>
            <Link href="/master">Master</Link>
          </li>
          <li>
            <Link href="/phd">PhD</Link>
          </li>
        </ul>
      </nav>
      <CalendarWrapper viewMode="grid" programFromRoute="All" />
    </>
  );
}

