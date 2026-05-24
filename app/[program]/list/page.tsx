export const runtime = 'edge';

import { CalendarWrapper } from '@/components/calendar-wrapper';
import { notFound } from 'next/navigation';
import { isValidProgramRoute, getProgramDisplayName } from '@/lib/route-utils';
import { getProgramPageTitle, getProgramSeoDescription, getProgramListCanonicalUrl } from '@/lib/program-seo';
import { buildCalendarPageMetadata } from '@/lib/calendar-seo-metadata';
import type { Metadata } from 'next';


interface ProgramListPageProps {
  params: Promise<{
    program: string;
  }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

// Generate metadata for program list pages
export async function generateMetadata({ params, searchParams }: ProgramListPageProps): Promise<Metadata> {
  const { program } = await params;
  
  if (!isValidProgramRoute(program)) {
    return {};
  }

  const sp = await searchParams;
  return buildCalendarPageMetadata({
    pathname: `/${program}/list`,
    viewMode: 'list',
    programSlug: program,
    searchParams: sp,
  });
}

function ProgramListJsonLd({ program }: { program: string }) {
  const programName = getProgramDisplayName(program);
  const title = getProgramPageTitle(program);
  const description = getProgramSeoDescription(program);
  const canonical = getProgramListCanonicalUrl(program);
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify({
          "@context": "https://schema.org",
          "@graph": [
            {
              "@type": "BreadcrumbList",
              "itemListElement": [
                { "@type": "ListItem", "position": 1, "name": "Home", "item": "https://bilauitmcuti.com" },
                { "@type": "ListItem", "position": 2, "name": programName, "item": canonical },
              ],
            },
            {
              "@type": "WebPage",
              "name": title,
              "url": canonical,
              "description": description,
              "isPartOf": { "@type": "WebSite", "name": "Bila UiTM Cuti", "url": "https://bilauitmcuti.com" },
            },
          ],
        }),
      }}
    />
  );
}

export default async function ProgramListPage({ params }: ProgramListPageProps) {
  const { program } = await params;
  
  if (!isValidProgramRoute(program)) {
    notFound();
  }

  return (
    <>
      <ProgramListJsonLd program={program} />
      <CalendarWrapper viewMode="list" programFromRoute={program} />
    </>
  );
}

