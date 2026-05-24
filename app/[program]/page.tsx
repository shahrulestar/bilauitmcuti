export const runtime = 'edge';

import { CalendarWrapper } from '@/components/calendar-wrapper';
import { notFound } from 'next/navigation';
import { isValidProgramRoute, getProgramDisplayName } from '@/lib/route-utils';
import { getProgramCanonicalUrl, getProgramPageTitle, getProgramSeoDescription } from '@/lib/program-seo';
import { buildCalendarPageMetadata } from '@/lib/calendar-seo-metadata';
import type { Metadata } from 'next';


interface ProgramPageProps {
  params: Promise<{
    program: string;
  }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

// Generate metadata for program pages
export async function generateMetadata({ params, searchParams }: ProgramPageProps): Promise<Metadata> {
  const { program } = await params;
  
  if (!isValidProgramRoute(program)) {
    return {};
  }

  const sp = await searchParams;
  return buildCalendarPageMetadata({
    pathname: `/${program}`,
    viewMode: 'grid',
    programSlug: program,
    searchParams: sp,
  });
}

function ProgramJsonLd({ program }: { program: string }) {
  const title = getProgramPageTitle(program);
  const description = getProgramSeoDescription(program);
  const canonical = getProgramCanonicalUrl(program);
  const programName = getProgramDisplayName(program);
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

export default async function ProgramPage({ params }: ProgramPageProps) {
  const { program } = await params;
  
  if (!isValidProgramRoute(program)) {
    notFound();
  }

  const programName = getProgramDisplayName(program);
  
  return (
    <>
      <ProgramJsonLd program={program} />
      <CalendarWrapper viewMode="grid" programFromRoute={program} />
    </>
  );
}

