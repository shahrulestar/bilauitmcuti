export const runtime = 'edge';

// Export types for use in other components
export type ViewMode = 'list' | 'grid';


import { CalendarWrapper } from '@/components/calendar-wrapper';
import Link from 'next/link';

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
            <Link href="/pre-diploma">Pre-Diploma</Link>
          </li>
          <li>
            <Link href="/diploma">Diploma</Link>
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

