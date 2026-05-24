export const runtime = 'edge';

import { CalendarWrapper } from '@/components/calendar-wrapper';
import { buildCalendarPageMetadata } from '@/lib/calendar-seo-metadata';
import type { Metadata } from 'next';

interface ListPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export async function generateMetadata({ searchParams }: ListPageProps): Promise<Metadata> {
  const sp = await searchParams;
  return buildCalendarPageMetadata({
    pathname: '/list',
    viewMode: 'list',
    searchParams: sp,
  });
}

// All programs, List view
export default function ListPage() {
  return <CalendarWrapper viewMode="list" programFromRoute="All" />;
}
