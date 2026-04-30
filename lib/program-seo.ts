import { getProgramDisplayName } from '@/lib/route-utils'

const siteBase = 'https://bilauitmcuti.com'

/** Distinct meta descriptions for main program grid routes (sitelink snippets). */
const PROGRAM_DESCRIPTION_BY_SLUG: Partial<Record<string, string>> = {
  'foundation-professional':
    'Kalendar akademik UiTM untuk pelajar Foundation dan Professional. Semak tarikh pendaftaran, minggu orientasi, jadual kuliah, peperiksaan, dan cuti semester.',
  diploma:
    'Kalendar akademik UiTM Diploma penuh masa. Jadual pendaftaran, kuliah, peperiksaan akhir semester, dan tempoh cuti mengikut sesi akademik.',
  bachelor:
    'Kalendar akademik UiTM Sarjana Muda (Bachelor). Tarikh pendaftaran, minggu aktiviti kampus, kuliah, peperiksaan, dan cuti antara semester.',
  master:
    'Kalendar akademik UiTM Sarjana (Master). Ikuti tarikh pendaftaran, sesi kuliah, peperiksaan, dan cuti untuk pelajar siswazah.',
  phd:
    'Kalendar akademik UiTM Doktor Falsafah (PhD). Rujuk pendaftaran, jadual akademik, penilaian, dan cuti mengikut kalendar UiTM.',
  'pre-diploma':
    'Kalendar akademik UiTM Pra-Diploma. Lihat tarikh pendaftaran, kuliah, peperiksaan, dan cuti semester.',
  'diploma-part-time':
    'Kalendar akademik UiTM Diploma Separuh Masa. Jadual sesi, peperiksaan, dan cuti untuk program separuh masa.',
  'bachelor-part-time':
    'Kalendar akademik UiTM Sarjana Muda Separuh Masa. Tarikh penting pendaftaran, kuliah, peperiksaan, dan cuti.',
}

export function getProgramSeoDescription(programSlug: string): string {
  const custom = PROGRAM_DESCRIPTION_BY_SLUG[programSlug]
  if (custom) return custom
  const name = getProgramDisplayName(programSlug)
  return `Kalendar akademik UiTM untuk ${name}. Lihat tarikh pendaftaran, jadual kuliah, tempoh peperiksaan, dan cuti.`
}

export function getProgramPageTitle(programSlug: string): string {
  return `${getProgramDisplayName(programSlug)} | Bila UiTM Cuti`
}

export function getProgramCanonicalUrl(programSlug: string): string {
  return `${siteBase}/${programSlug}`
}
