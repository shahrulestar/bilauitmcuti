export const runtime = 'edge';

import { CalendarWrapper } from '@/components/calendar-wrapper';
import { notFound } from 'next/navigation';
import { isValidProgramRoute, getProgramDisplayName } from '@/lib/route-utils';
import type { Metadata } from 'next';


interface ProgramPageProps {
  params: Promise<{
    program: string;
  }>;
}

// Generate metadata for program pages
export async function generateMetadata({ params }: ProgramPageProps): Promise<Metadata> {
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
      canonical: `https://bilauitmcuti.com/${program}`,
    },
    openGraph: {
      siteName: 'Bila UiTM Cuti',
      title,
      description,
      type: 'website',
      url: `https://bilauitmcuti.com/${program}`,
      locale: 'ms_MY',
      images: [
        {
          url: 'https://bilauitmcuti.com/all-cover.png',
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
      images: ['https://bilauitmcuti.com/all-cover.png'],
    },
  };
}

function ProgramJsonLd({ program, programName }: { program: string; programName: string }) {
  const title = `${programName} | Bila UiTM Cuti`;
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
              ],
            },
            {
              "@type": "WebPage",
              "name": title,
              "url": `https://bilauitmcuti.com/${program}`,
              "description": `Kalendar akademik UiTM untuk ${programName}. Lihat tarikh pendaftaran, jadual kuliah, tempoh peperiksaan, dan cuti.`,
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
      <ProgramJsonLd program={program} programName={programName} />
      <CalendarWrapper viewMode="grid" programFromRoute={program} />
    </>
  );
}

