export const runtime = 'edge';

import { PublicHolidayWrapper } from "@/components/public-holiday-wrapper";


export default function PublicHolidayFederalPage() {
  return <PublicHolidayWrapper viewMode="grid" routeKey="federal" />;
}

