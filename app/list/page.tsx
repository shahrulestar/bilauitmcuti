import { CalendarWrapper } from '@/components/calendar-wrapper';

export const runtime = 'edge';

// All programs, List view
export default function ListPage() {
  return <CalendarWrapper viewMode="list" programFromRoute="All" />;
}
