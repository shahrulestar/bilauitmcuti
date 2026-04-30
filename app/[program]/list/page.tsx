export const runtime = 'edge';

import { CalendarWrapper } from '@/components/calendar-wrapper';
import { notFound } from 'next/navigation';
import { isValidProgramRoute, getProgramDisplayName } from '@/lib/route-utils';
import { getProgramCanonicalUrl, getProgramPageTitle, getProgramSeoDescription } from '@/lib/program-seo';
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
  
  const title = getProgramPageTitle(program);
  const description = getProgramSeoDescription(program);
  const canonical = getProgramCanonicalUrl(program);

  return {
    title,
    description,
    robots: { index: false, follow: true },
    alternates: {
      canonical,
    },
    openGraph: {
      siteName: 'Bila UiTM Cuti',
      title,
      description,
      type: 'website',
      url: canonical,
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

function ProgramListJsonLd({ program }: { program: string }) {
  const programName = getProgramDisplayName(program);
  const title = getProgramPageTitle(program);
  const description = getProgramSeoDescription(program);
  const canonical = getProgramCanonicalUrl(program);
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

