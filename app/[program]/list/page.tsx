export const runtime = 'edge';

import { CalendarWrapper } from '@/components/calendar-wrapper';
import { notFound } from 'next/navigation';
import { isValidProgramRoute, getProgramDisplayName } from '@/lib/route-utils';
import type { Metadata } from 'next';


interface ProgramListPageProps {
  params: Promise<{
    program: string;
  }>;
}

// Generate metadata for program list pages
export async function generateMetadata({ params }: ProgramListPageProps): Promise<Metadata> {
  const { program } = await params;
  
  if (!isValidProgramRoute(program)) {
    return {};
  }
  
  const programName = getProgramDisplayName(program);
  const title = `${programName} | Bila UiTM Cuti`;
  const description = `Kalendar akademik UiTM untuk ${programName}. Lihat tarikh pendaftaran, jadual kuliah, tempoh peperiksaan, dan cuti.`;
  
  return {
    title,
    description,
    alternates: {
      canonical: `https://bilauitmcuti.com/${program}/list`,
    },
    openGraph: {
      siteName: 'Bila UiTM Cuti',
      title,
      description,
      type: 'website',
      url: `https://bilauitmcuti.com/${program}/list`,
      locale: 'ms_MY',
      images: [
        {
          url: 'https://bilauitmcuti.com/list-cover.png',
          width: 1200,
          height: 630,
          alt: title,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: ['https://bilauitmcuti.com/list-cover.png'],
    },
  };
}

function ProgramListJsonLd({ program, programName }: { program: string; programName: string }) {
  const title = `${programName} - List View | Bila UiTM Cuti`;
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
                { "@type": "ListItem", "position": 2, "name": programName, "item": `https://bilauitmcuti.com/${program}` },
                { "@type": "ListItem", "position": 3, "name": "List View", "item": `https://bilauitmcuti.com/${program}/list` },
              ],
            },
            {
              "@type": "WebPage",
              "name": title,
              "url": `https://bilauitmcuti.com/${program}/list`,
              "description": `Senarai aktiviti akademik UiTM untuk ${programName}. Pendaftaran, kuliah, peperiksaan, dan cuti dalam paparan senarai.`,
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

  const programName = getProgramDisplayName(program);
  
  return (
    <>
      <ProgramListJsonLd program={program} programName={programName} />
      <CalendarWrapper viewMode="list" programFromRoute={program} />
    </>
  );
}

