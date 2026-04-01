export const runtime = 'edge';

import { PublicHolidayWrapper } from "@/components/public-holiday-wrapper";


export default function PublicHolidayFederalListPage() {
  return <PublicHolidayWrapper viewMode="list" routeKey="federal" />;
}

