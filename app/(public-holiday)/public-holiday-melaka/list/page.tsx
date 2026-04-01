export const runtime = 'edge';

import { PublicHolidayWrapper } from '@/components/public-holiday-wrapper';


export default function PublicHolidayStateListPage() {
  return <PublicHolidayWrapper viewMode='list' routeKey='melaka' />;
}


