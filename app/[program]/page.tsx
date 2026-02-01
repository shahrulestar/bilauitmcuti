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
  const title = `${programName} | Bila UiTM Cuti?`;
  const description = `Kalendar akademik UiTM 2026 untuk ${programName}. Lihat tarikh pendaftaran, jadual kuliah, tempoh peperiksaan, dan cuti.`;
  
  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: 'website',
      url: `https://cutiuitm.xyz/${program}`,
      locale: 'ms_MY',
      images: [
        {
          url: '/og-image-2.png',
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
    },
  };
}

// Program-specific Grid views
export default async function ProgramPage({ params }: ProgramPageProps) {
  const { program } = await params;
  
  // Validate route
  if (!isValidProgramRoute(program)) {
    notFound();
  }
  
  return <CalendarWrapper viewMode="grid" programFromRoute={program} />;
}
