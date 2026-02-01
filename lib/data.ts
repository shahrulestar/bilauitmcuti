export type ActivityType = 'registration' | 'lecture' | 'examination' | 'break' | 'other';

// Default filter states - single source of truth
export const DEFAULT_FILTER_STATES = {
  showKKT: false,
  showRegistration: true,
  showLecture: true,
  showSemesterPendek: false,
  showKuliahIntersesi: false,
  showExamination: true,
  showOthersExams: false,
  showBreak: true,
  showCountdown: true,
} as const;

export interface Activity {
  name: string;
  details?: string;
  startDate: string; // YYYY-MM-DD format
  endDate?: string; // YYYY-MM-DD format
  regionalStartDate?: string; // KKT regional variant start date
  regionalEndDate?: string; // KKT regional variant end date
  duration?: string; // e.g., "1 Minggu", "8 Minggu"
  type: ActivityType;
  programs?: string[]; // Applicable programs
  group?: 'A' | 'B'; // Group A (Foundation/Professional) or Group B (Pre-Diploma onwards)
  programType?: 'PreDiploma' | 'Diploma' | 'DiplomaPartTime' | 'Bachelor' | 'BachelorPartTime' | 'Master' | 'PhD'; // For Group B subdivision
  semua?: boolean; // True if applies to all Group B students (Semua Pelajar)
  states?: string[]; // Applicable states only (used for Kedah, Kelantan, Terengganu)
}

// Group A: Foundation/Professional Program - Semester December 2025 – May 2026 (20262)
export const activitiesGroupA: Activity[] = [
  // LECTURES
  {
    name: 'Lecture 1',
    startDate: '2025-12-22',
    endDate: '2025-12-28',
    duration: '1 Minggu',
    details: 'Secara Online [Krismas: 25 Disember]',
    type: 'lecture',
    group: 'A',
  },
  {
    name: 'Proses Entrance Survey',
    startDate: '2025-12-22',
    endDate: '2026-01-18',
    duration: '4 Minggu',
    type: 'other',
    group: 'A',
  },
  {
    name: 'Lecture 2',
    startDate: '2025-12-29',
    endDate: '2026-02-08',
    duration: '6 Minggu',
    type: 'lecture',
    group: 'A',
  },
  {
    name: 'Ujian Pertengahan Semester',
    startDate: '2026-02-09',
    endDate: '2026-02-15',
    duration: '1 Minggu',
    type: 'examination',
    group: 'A',
  },
  {
    name: 'Cuti Pertengahan Semester',
    startDate: '2026-02-16',
    endDate: '2026-02-22',
    duration: '1 Minggu',
    type: 'break',
    group: 'A',
  },
  {
    name: 'Lecture 3',
    startDate: '2026-02-23',
    endDate: '2026-03-19',
    duration: '4 Minggu',
    type: 'lecture',
    group: 'A',
  },
  {
    name: 'Cuti Khas Perayaan',
    startDate: '2026-03-20',
    endDate: '2026-03-29',
    duration: '1 Minggu',
    details: 'Aidil Fitri: 20 & 21 Mac',
    type: 'break',
    group: 'A',
  },
  {
    name: 'Lecture 4',
    startDate: '2026-03-30',
    endDate: '2026-04-19',
    duration: '3 Minggu',
    type: 'lecture',
    group: 'A',
  },
  {
    name: 'Proses Exit Survey',
    startDate: '2026-04-06',
    endDate: '2026-04-19',
    duration: '2 Minggu',
    type: 'other',
    group: 'A',
  },
  {
    name: 'Student Feedback Online (SuFO)',
    startDate: '2026-04-06',
    endDate: '2026-05-10',
    duration: '5 Minggu',
    type: 'other',
    group: 'A',
  },
  {
    name: 'Minggu Ulangkaji',
    startDate: '2026-04-20',
    endDate: '2026-04-26',
    duration: '1 Minggu',
    type: 'other',
    group: 'A',
  },
  {
    name: 'Penilaian / Peperiksaan Akhir',
    startDate: '2026-04-27',
    endDate: '2026-05-10',
    duration: '2 Minggu',
    type: 'examination',
    group: 'A',
  },
  {
    name: 'Cuti Semester',
    startDate: '2026-05-11',
    endDate: '2026-06-07',
    duration: '4 Minggu',
    type: 'break',
    group: 'A',
  },
  
  // REGISTRATION ACTIVITIES
  {
    name: 'Pendaftaran Kursus Pelajar Baharu dan Lama',
    startDate: '2025-12-15',
    endDate: '2026-01-18',
    type: 'registration',
    group: 'A',
  },
  {
    name: 'Permohonan Tambah/Gugur Kursus Lewat/Di Luar Tempoh',
    startDate: '2025-12-29',
    endDate: '2026-01-18',
    type: 'registration',
    group: 'A',
  },
  {
    name: 'Tempoh Pengesahan Kursus Berdaftar Semester Semasa',
    startDate: '2025-12-29',
    endDate: '2026-01-18',
    type: 'registration',
    group: 'A',
  },
  {
    name: 'Tempoh Permohonan Penangguhan Pembayaran Yuran',
    startDate: '2025-12-16',
    endDate: '2026-01-23',
    type: 'registration',
    group: 'A',
  },
  {
    name: 'Tarikh Akhir Keputusan Permohonan Penangguhan Yuran',
    startDate: '2026-01-26',
    type: 'registration',
    group: 'A',
  },
];

// Group B: Pre-Diploma, Diploma, Bachelor's Degree, Master's & Doctorate Programs - Semester March – August 2026 (20262)
export const activitiesGroupB: Activity[] = [
  // LECTURES - Apply to all Group B programs
  {
    name: 'Lecture 1',
    startDate: '2026-03-30',
    endDate: '2026-05-24',
    duration: '8 Minggu',
    regionalStartDate: '2026-03-29',
    regionalEndDate: '2026-05-23',
    type: 'lecture',
    group: 'B',
    semua: true,
  },
  {
    name: 'Proses Entrance Survey',
    startDate: '2026-03-30',
    endDate: '2026-05-03',
    duration: '5 Minggu',
    type: 'other',
    group: 'B',
    semua: true,
  },
  {
    name: 'Cuti Pertengahan Semester / Cuti Perayaan',
    startDate: '2026-05-25',
    endDate: '2026-06-02',
    duration: '1 Minggu',
    details: 'Hari Raya Aidil Adha - 27 Mei, Hari Perayaan Tadau Kaamatan - 30 & 31 Mei, Hari Gawai - 1 & 2 Jun',
    type: 'break',
    group: 'B',
    semua: true,
  },
  {
    name: 'Lecture 2',
    startDate: '2026-06-03',
    endDate: '2026-07-12',
    duration: '6 Minggu',
    regionalStartDate: '2026-06-03',
    regionalEndDate: '2026-07-11',
    type: 'lecture',
    group: 'B',
    semua: true,
  },
  {
    name: 'Proses Exit Survey',
    startDate: '2026-06-29',
    endDate: '2026-08-02',
    duration: '5 Minggu',
    type: 'other',
    group: 'B',
    semua: true,
  },
  {
    name: 'Student Feedback Online (SuFO)',
    startDate: '2026-06-29',
    endDate: '2026-08-02',
    duration: '5 Minggu',
    type: 'other',
    group: 'B',
    semua: true,
  },
  {
    name: 'English Exit Test (EET Lisan)',
    startDate: '2026-07-13',
    endDate: '2026-07-19',
    duration: '1 Minggu',
    type: 'examination',
    group: 'B',
    semua: true,
  },
  {
    name: 'Cuti Ulangkaji',
    startDate: '2026-07-13',
    endDate: '2026-07-19',
    duration: '1 Minggu',
    type: 'break',
    group: 'B',
    semua: true,
  },
  {
    name: 'Penilaian / Peperiksaan Akhir / EET (Bertulis)',
    startDate: '2026-07-20',
    endDate: '2026-08-09',
    duration: '3 Minggu',
    type: 'examination',
    group: 'B',
    semua: true,
  },
  {
    name: 'Semester Pendek (202633)',
    startDate: '2026-08-03',
    endDate: '2026-09-20',
    duration: '7 Minggu',
    type: 'lecture',
    group: 'B',
    semua: true,
  },
  {
    name: 'Lecture Intersesi (20263)',
    startDate: '2026-08-17',
    endDate: '2026-09-20',
    duration: '5 Minggu',
    type: 'lecture',
    group: 'B',
    semua: true,
  },
  {
    name: 'Peperiksaan/Penilaian Khas/Intersesi/Semester Pendek',
    startDate: '2026-09-21',
    endDate: '2026-09-27',
    duration: '1 Minggu',
    type: 'examination',
    group: 'B',
    semua: true,
  },
  {
    name: 'Cuti Semester',
    startDate: '2026-08-10',
    endDate: '2026-10-04',
    duration: '8 Minggu',
    type: 'break',
    group: 'B',
    semua: true,
  },

  // SEMUA PELAJAR - Common registrations and administrative activities
  {
    name: 'Pendaftaran Kursus',
    startDate: '2026-03-23',
    endDate: '2026-04-26',
    type: 'registration',
    group: 'B',
    semua: true,
  },
  {
    name: 'Tempoh Permohonan Penangguhan Pembayaran Yuran via Online Fee Deferment',
    startDate: '2026-03-24',
    endDate: '2026-04-26',
    type: 'registration',
    group: 'B',
    semua: true,
  },
  {
    name: 'Tarikh Akhir Keputusan Permohonan Penangguhan Pembayaran Yuran',
    startDate: '2026-04-27',
    type: 'registration',
    group: 'B',
    semua: true,
  },
  {
    name: 'Tempoh Validasi Kursus Berdaftar Semester Semasa',
    startDate: '2026-04-27',
    endDate: '2026-05-03',
    type: 'registration',
    group: 'B',
    semua: true,
  },
  {
    name: 'Permohonan Daftar / Gugur Kursus Lewat / Luar Tempoh',
    startDate: '2026-05-04',
    endDate: '2026-05-10',
    type: 'registration',
    group: 'B',
    semua: true,
  },
  {
    name: 'Tarikh Akhir Pembayaran Yuran',
    startDate: '2026-05-16',
    type: 'registration',
    group: 'B',
    semua: true,
  },
  {
    name: 'Gugur Taraf (GT)',
    startDate: '2026-05-22',
    type: 'registration',
    group: 'B',
    semua: true,
  },
  {
    name: 'Permohonan Rayuan Pembatalan Gugur Taraf (RPGT)',
    startDate: '2026-05-22',
    endDate: '2026-05-29',
    type: 'registration',
    group: 'B',
    semua: true,
  },
  {
    name: 'Keputusan Rayuan Pembatalan Gugur Taraf (RPGT)',
    startDate: '2026-05-23',
    endDate: '2026-06-01',
    type: 'registration',
    group: 'B',
    semua: true,
  },
  {
    name: 'Pelajar Mula Cetak Slip Menduduki Peperiksaan',
    startDate: '2026-06-08',
    type: 'examination',
    group: 'B',
    semua: true,
  },
  {
    name: 'Tarikh Akhir Pembayaran Yuran / Permohonan Penangguhan Bayaran Yuran Bagi Pelajar Yang Diluluskan RPGT',
    startDate: '2026-06-12',
    type: 'registration',
    group: 'B',
    semua: true,
  },
  {
    name: 'Gugur Taraf Bagi Pelajar Yang Masih Tidak Mendaftar Kursus dan Tiada Pembayaran Yuran (GT2)',
    startDate: '2026-06-19',
    type: 'registration',
    group: 'B',
    semua: true,
  },
  {
    name: 'Tarikh Akhir Pembayaran Yuran Bagi Pelajar Yang Diluluskan Penangguhan Pembayaran Yuran',
    startDate: '2026-06-26',
    type: 'registration',
    group: 'B',
    semua: true,
  },
  {
    name: 'Gugur Taraf Muktamad',
    startDate: '2026-07-01',
    type: 'registration',
    group: 'B',
    semua: true,
  },

  // PRE-DIPLOMA REGISTRATIONS
  {
    name: 'Persetujuan Menerima Tawaran UiTM Secara Online',
    startDate: '2026-02-10',
    endDate: '2026-03-22',
    type: 'registration',
    group: 'B',
    programType: 'PreDiploma',
  },
  {
    name: 'Pendaftaran Online Sebagai Pelajar Sepenuh Masa',
    startDate: '2026-02-10',
    endDate: '2026-03-22',
    type: 'registration',
    group: 'B',
    programType: 'PreDiploma',
  },
  {
    name: 'Pendaftaran Fizikal & Serahan Dokumen Pelajar Baharu',
    startDate: '2026-03-28',
    endDate: '2026-03-29',
    type: 'registration',
    group: 'B',
    programType: 'PreDiploma',
  },
  {
    name: 'Program Minggu Destini Siswa (MDS)',
    startDate: '2026-03-24',
    endDate: '2026-03-27',
    details: 'Secara Dalam Talian',
    type: 'other',
    group: 'B',
    programType: 'PreDiploma',
  },
  {
    name: 'Program Minggu Edu 5.0@UiTM',
    startDate: '2026-03-24',
    endDate: '2026-03-27',
    details: 'Secara Dalam Talian',
    type: 'other',
    group: 'B',
    programType: 'PreDiploma',
  },
  {
    name: 'Pendaftaran Kolej Penginapan',
    startDate: '2026-03-28',
    endDate: '2026-03-29',
    type: 'registration',
    group: 'B',
    programType: 'PreDiploma',
  },
  {
    name: 'Pendaftaran Kursus English Exit Test (EET699) Bagi Yang Layak Sahaja',
    startDate: '2026-03-24',
    endDate: '2026-04-26',
    type: 'registration',
    group: 'B',
    programType: 'PreDiploma',
  },

  // DIPLOMA (FULL-TIME) REGISTRATIONS
  {
    name: 'Persetujuan Menerima Tawaran UiTM Secara Online',
    startDate: '2026-01-12',
    endDate: '2026-03-22',
    type: 'registration',
    group: 'B',
    programType: 'Diploma',
  },
  {
    name: 'Pendaftaran Online Sebagai Pelajar Sepenuh Masa',
    startDate: '2026-01-12',
    endDate: '2026-03-22',
    type: 'registration',
    group: 'B',
    programType: 'Diploma',
  },
  {
    name: 'Pendaftaran Fizikal & Serahan Dokumen Pelajar Baharu',
    startDate: '2026-03-28',
    endDate: '2026-03-29',
    type: 'registration',
    group: 'B',
    programType: 'Diploma',
  },
  {
    name: 'Program Minggu Destini Siswa (MDS)',
    startDate: '2026-03-24',
    endDate: '2026-03-27',
    details: 'Secara Dalam Talian',
    type: 'other',
    group: 'B',
    programType: 'Diploma',
  },
  {
    name: 'Program Minggu Edu 5.0@UiTM',
    startDate: '2026-03-24',
    endDate: '2026-03-27',
    details: 'Secara Dalam Talian',
    type: 'other',
    group: 'B',
    programType: 'Diploma',
  },
  {
    name: 'Pendaftaran Kolej Penginapan',
    startDate: '2026-03-28',
    endDate: '2026-03-29',
    type: 'registration',
    group: 'B',
    programType: 'Diploma',
  },
  {
    name: 'Pendaftaran Kursus English Exit Test (EET699) Bagi Yang Layak Sahaja',
    startDate: '2026-03-24',
    endDate: '2026-04-26',
    type: 'registration',
    group: 'B',
    programType: 'Diploma',
  },

  // DIPLOMA (PART-TIME) REGISTRATIONS
  {
    name: 'Pendaftaran Pelajar Baharu',
    startDate: '2026-03-07',
    type: 'registration',
    group: 'B',
    programType: 'DiplomaPartTime',
  },
  {
    name: 'Proses Serahan Dokumen Pelajar Baharu',
    startDate: '2026-03-07',
    type: 'registration',
    group: 'B',
    programType: 'DiplomaPartTime',
  },
  {
    name: 'Pendaftaran Pelajar Baharu e-PJJ dan PLK Serta Taklimat Program Pelajar Baharu e-PJJ dan PLK',
    startDate: '2026-03-07',
    type: 'registration',
    group: 'B',
    programType: 'DiplomaPartTime',
  },

  // BACHELOR (FULL-TIME) REGISTRATIONS
  {
    name: 'Persetujuan Menerima Tawaran UiTM',
    startDate: '2026-03-03',
    endDate: '2026-03-15',
    details: 'Lepasan STPM / STAM / Matrikulasi / Asasi / Diploma IPT Lain / Diploma UiTM',
    type: 'registration',
    group: 'B',
    programType: 'Bachelor',
  },
  {
    name: 'Persetujuan Menerima Tawaran UiTM (Penerapan)',
    startDate: '2026-03-16',
    endDate: '2026-03-23',
    details: 'Lepasan Penerapan Diploma Tahun Akhir UiTM',
    type: 'registration',
    group: 'B',
    programType: 'Bachelor',
  },
  {
    name: 'Pendaftaran Online Sebagai Pelajar Baharu Sepenuh Masa',
    startDate: '2026-03-03',
    endDate: '2026-03-15',
    details: 'Lepasan STPM / STAM / Matrikulasi / Asasi / Diploma IPT Lain / Diploma UiTM',
    type: 'registration',
    group: 'B',
    programType: 'Bachelor',
  },
  {
    name: 'Pendaftaran Online Sebagai Pelajar Baharu Sepenuh Masa Graduan Diploma Artikulasi',
    startDate: '2026-03-16',
    endDate: '2026-03-23',
    details: 'Lepasan Penerapan Diploma Tahun Akhir UiTM',
    type: 'registration',
    group: 'B',
    programType: 'Bachelor',
  },
  {
    name: 'Pendaftaran Fizikal & Serahan Dokumen Pelajar Baharu',
    startDate: '2026-03-28',
    endDate: '2026-03-29',
    details: 'Lepasan STPM / STAM / Matrikulasi / Asasi / Diploma IPT Lain / Diploma UiTM',
    type: 'registration',
    group: 'B',
    programType: 'Bachelor',
  },
  {
    name: 'Program Minggu Destini Siswa (MDS)',
    startDate: '2026-03-24',
    endDate: '2026-03-27',
    details: 'Secara Dalam Talian',
    type: 'other',
    group: 'B',
    programType: 'Bachelor',
  },
  {
    name: 'Program Minggu Edu 5.0@UiTM',
    startDate: '2026-03-24',
    endDate: '2026-03-27',
    details: 'Secara Dalam Talian',
    type: 'other',
    group: 'B',
    programType: 'Bachelor',
  },
  {
    name: 'Program Pemantapan Destini Siswa (PDS)',
    startDate: '2026-04-04',
    type: 'other',
    group: 'B',
    programType: 'Bachelor',
  },
  {
    name: 'Pendaftaran Kolej Penginapan',
    startDate: '2026-03-28',
    endDate: '2026-03-29',
    type: 'registration',
    group: 'B',
    programType: 'Bachelor',
  },
  {
    name: 'Tawaran Kedua Pendaftaran Online',
    startDate: '2026-04-05',
    endDate: '2026-04-10',
    type: 'registration',
    group: 'B',
    programType: 'Bachelor',
  },
  {
    name: 'Tawaran Kedua Pendaftaran Fizikal',
    startDate: '2026-04-09',
    endDate: '2026-04-10',
    type: 'registration',
    group: 'B',
    programType: 'Bachelor',
  },

  // BACHELOR (PART-TIME) REGISTRATIONS
  {
    name: 'Pendaftaran Pelajar Baharu',
    startDate: '2026-03-07',
    type: 'registration',
    group: 'B',
    programType: 'BachelorPartTime',
  },
  {
    name: 'Proses Serahan Dokumen Pelajar Baharu',
    startDate: '2026-03-07',
    type: 'registration',
    group: 'B',
    programType: 'BachelorPartTime',
  },
  {
    name: 'Pendaftaran Pelajar Baharu e-PJJ dan PLK Serta Taklimat Program Pelajar Baharu e-PJJ dan PLK',
    startDate: '2026-03-07',
    type: 'registration',
    group: 'B',
    programType: 'BachelorPartTime',
  },

  // MASTER REGISTRATIONS
  {
    name: 'Pendaftaran Pelajar Baharu (Sarjana Pascasiswazah)',
    startDate: '2026-03-09',
    endDate: '2026-03-29',
    type: 'registration',
    group: 'B',
    programType: 'Master',
  },
  {
    name: 'Pendaftaran Pelajar Baharu Tawaran Kedua',
    startDate: '2026-03-09',
    endDate: '2026-03-29',
    type: 'registration',
    group: 'B',
    programType: 'Master',
  },

  // PhD REGISTRATIONS
  {
    name: 'Pendaftaran Pelajar Baharu (PhD)',
    startDate: '2026-03-09',
    endDate: '2026-03-29',
    type: 'registration',
    group: 'B',
    programType: 'PhD',
  },
  {
    name: 'Pendaftaran Pelajar Baharu Tawaran Kedua (PhD)',
    startDate: '2026-03-09',
    endDate: '2026-03-29',
    type: 'registration',
    group: 'B',
    programType: 'PhD',
  },
];

export const allActivities = [...activitiesGroupA, ...activitiesGroupB];

export const programOptions = [
  { label: 'Foundation/Professional', value: 'Foundation/Professional', group: 'A' as const },
  { label: 'All', value: 'All', group: 'B' as const },
  { label: 'Pre-Diploma', value: 'PreDiploma', group: 'B' as const },
  { label: 'Diploma', value: 'Diploma', group: 'B' as const },
  { label: 'Diploma (Part-Time)', value: 'DiplomaPartTime', group: 'B' as const },
  { label: 'Bachelor', value: 'Bachelor', group: 'B' as const },
  { label: 'Bachelor (Part-Time)', value: 'BachelorPartTime', group: 'B' as const },
  { label: 'Master', value: 'Master', group: 'B' as const },
  { label: 'PhD', value: 'PhD', group: 'B' as const },
];

export type ProgramGroup = 'A' | 'B';

// Get all activities for a specific month
export function getActivitiesForMonth(year: number, month: number, group: ProgramGroup): Activity[] {
  return allActivities.filter(activity => {
    if (activity.group !== group) return false;
    
    const startDate = new Date(activity.startDate);
    const endDate = activity.endDate ? new Date(activity.endDate) : startDate;
    
    // Check if activity overlaps with the given month
    const monthStart = new Date(year, month - 1, 1);
    const monthEnd = new Date(year, month, 0);
    
    return startDate <= monthEnd && endDate >= monthStart;
  });
}

// Get activity for a specific date
export function getActivityForDate(dateStr: string, group: ProgramGroup, showKKT: boolean = false): Activity | undefined {
  return allActivities.find(activity => {
    if (activity.group !== group) return false;
    
    // Use regional dates if KKT filter is on and regional dates exist
    const startDate = showKKT && activity.regionalStartDate ? new Date(activity.regionalStartDate) : new Date(activity.startDate);
    const endDate = showKKT && activity.regionalEndDate ? new Date(activity.regionalEndDate) : (activity.endDate ? new Date(activity.endDate) : startDate);
    
    const targetDate = new Date(dateStr);
    return targetDate >= startDate && targetDate <= endDate;
  });
}

// Format date range in English
export function formatDateRange(startDate: string, endDate?: string): string {
  // Parse dates as UTC to ensure consistency between server and client
  const [startYear, startMonth, startDay] = startDate.split('-').map(Number);
  const start = new Date(Date.UTC(startYear, startMonth - 1, startDay));
  
  let end: Date;
  if (endDate) {
    const [endYear, endMonth, endDay] = endDate.split('-').map(Number);
    end = new Date(Date.UTC(endYear, endMonth - 1, endDay));
  } else {
    end = start;
  }
  
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  
  if (!endDate || startDate === endDate) {
    return `${start.getUTCDate()} ${monthNames[start.getUTCMonth()]}`;
  }
  
  if (start.getUTCMonth() === end.getUTCMonth() && start.getUTCFullYear() === end.getUTCFullYear()) {
    return `${start.getUTCDate()} - ${end.getUTCDate()} ${monthNames[end.getUTCMonth()]}`;
  }
  
  if (start.getUTCFullYear() === end.getUTCFullYear()) {
    return `${start.getUTCDate()} ${monthNames[start.getUTCMonth()]} - ${end.getUTCDate()} ${monthNames[end.getUTCMonth()]}`;
  }
  
  return `${start.getUTCDate()} ${monthNames[start.getUTCMonth()]} ${start.getUTCFullYear()} - ${end.getUTCDate()} ${monthNames[end.getUTCMonth()]} ${end.getUTCFullYear()}`;
}

/** Days from today to activity start (UTC-normalized). Returns null if start is today or in the past. */
export function getDaysUntilStart(activity: Activity, todayStr: string, showKKT?: boolean): number | null {
  const startStr = showKKT && activity.regionalStartDate ? activity.regionalStartDate : activity.startDate;
  const [startYear, startMonth, startDay] = startStr.split('-').map(Number);
  const [todayYear, todayMonth, todayDay] = todayStr.split('-').map(Number);
  const start = new Date(Date.UTC(startYear, startMonth - 1, startDay));
  const today = new Date(Date.UTC(todayYear, todayMonth - 1, todayDay));
  const diffMs = start.getTime() - today.getTime();
  const days = Math.floor(diffMs / 86400000);
  return days > 0 ? days : null;
}

export function formatCountdown(days: number): string {
  return days === 1 ? 'In 1 day' : `In ${days} days`;
}

// Get months that should be displayed for a group based on available activities
export interface GetMonthsOptions {
  selectedProgram: string;
  showRegistration?: boolean;
  showLecture?: boolean;
  showExamination?: boolean;
  showOthersExams?: boolean;
  showBreak?: boolean;
  showSemesterPendek?: boolean;
  showKuliahIntersesi?: boolean;
  showKKT?: boolean;
}

export function getMonthsForGroup(
  group: ProgramGroup,
  options: GetMonthsOptions
): Array<{ month: number; year: number }> {
  const {
    selectedProgram,
    showRegistration = true,
    showLecture = true,
    showExamination = true,
    showOthersExams = true,
    showBreak = true,
    showSemesterPendek = true,
    showKuliahIntersesi = true,
    showKKT = false,
  } = options;

  // Helper function to check if activity should be shown (same logic as shouldShowActivity in grid-view)
  const shouldShowActivity = (activity: Activity): boolean => {
    if (activity.type === 'registration' && !showRegistration) return false;
    if (activity.type === 'lecture' && !showLecture) return false;
    if (activity.type === 'examination' && !showExamination) return false;
    if (activity.type === 'break' && !showBreak) return false;
    
    // Filter out Semester Pendek if toggle is off
    if (activity.type === 'lecture' && activity.name.includes('Semester Pendek') && !showSemesterPendek) return false;
    
    // Filter out Kuliah Intersesi if toggle is off
    if (activity.type === 'lecture' && activity.name.includes('Intersesi') && !showKuliahIntersesi) return false;
    
    // Filter out Others Exams (Peperiksaan/Penilaian Khas/Intersesi/Semester Pendek + English Exit Test) if toggle is off
    if (activity.type === 'examination' && (activity.name.includes('Khas') || activity.name.includes('English Exit Test') || activity.name.includes('EET Lisan')) && !showOthersExams) return false;
    
    // Handle "All" option - show activities with semua flag or no specific programType
    if (selectedProgram === 'All') {
      // Show activities that apply to all students or have no specific program type
      if (activity.semua) return true;
      // Don't show activities with specific programTypes when "All" is selected
      if (activity.programType) return false;
      return true;
    }
    
    // Filter by program type - check if activity has programType and if it matches selectedProgram
    if (activity.programType) {
      if (activity.programType !== selectedProgram) return false;
    }
    
    return true;
  };

  // Collect all relevant dates from activities
  const relevantDates: Date[] = [];

  for (const activity of allActivities) {
    if (activity.group !== group) continue;
    if (!shouldShowActivity(activity)) continue;

    // Use regional dates if KKT filter is on and regional dates exist
    let startDate: Date;
    let endDate: Date;

    if (showKKT && activity.regionalStartDate) {
      startDate = new Date(activity.regionalStartDate);
      endDate = activity.regionalEndDate ? new Date(activity.regionalEndDate) : startDate;
    } else {
      startDate = new Date(activity.startDate);
      endDate = activity.endDate ? new Date(activity.endDate) : startDate;
    }

    relevantDates.push(startDate);
    relevantDates.push(endDate);
  }

  if (relevantDates.length === 0) {
    // Return default months if no activities found
    if (group === 'A') {
      return [
        { month: 12, year: 2025 },
        { month: 1, year: 2026 },
        { month: 2, year: 2026 },
        { month: 3, year: 2026 },
        { month: 4, year: 2026 },
        { month: 5, year: 2026 },
      ];
    } else {
      return [
        { month: 3, year: 2026 },
        { month: 4, year: 2026 },
        { month: 5, year: 2026 },
        { month: 6, year: 2026 },
        { month: 7, year: 2026 },
        { month: 8, year: 2026 },
      ];
    }
  }

  // Find min and max dates
  const minDate = new Date(Math.min(...relevantDates.map(d => d.getTime())));
  const maxDate = new Date(Math.max(...relevantDates.map(d => d.getTime())));

  // Generate array of months from min to max
  const months: Array<{ month: number; year: number }> = [];
  const currentDate = new Date(minDate.getFullYear(), minDate.getMonth(), 1);
  const endMonth = new Date(maxDate.getFullYear(), maxDate.getMonth(), 1);

  while (currentDate <= endMonth) {
    months.push({
      month: currentDate.getMonth() + 1, // JavaScript months are 0-indexed
      year: currentDate.getFullYear(),
    });
    
    // Move to next month
    currentDate.setMonth(currentDate.getMonth() + 1);
  }

  return months;
}
