/** Group A short — exams, breaks, lectures, quick admin (Asasi). */
const SUGGESTIONS_GROUP_A_SHORT = [
  "When is Ujian Pertengahan Semester?",
  "Bila Cuti Pertengahan Semester?",
  "When is Peperiksaan Akhir?",
  "Bila Minggu Ulangkaji?",
  "When is Cuti Semester?",
  "When is Aidil Fitri break?",
  "When is MDS?",
  "When is Entrance Survey?",
  "When is Gugur Taraf (GT)?",
  "When is SuFO?",
  "Bila tarikh akhir yuran?",
  "When is Lecture 1?",
  "When can I print exam slip?",
  "When does Lecture 3 start?",
  "When is Asasi online registration?",
  "When is the next break on my calendar?",
];

/** Group A long — Asasi intake, registration process, appeals (different topics from short). */
const SUGGESTIONS_GROUP_A_LONG = [
  "When is Persetujuan Menerima Tawaran UiTM Asasi open?",
  "When is Pendaftaran Secara Fizikal Sebagai Pelajar Asasi?",
  "When is Pendaftaran Kursus Pelajar Baharu dan Lama?",
  "When is Proses Serahan Dokumen Pelajar Baharu Asasi?",
  "When does Permohonan Penangguhan Pembayaran Yuran open?",
  "When is Tempoh Pengesahan Kursus Berdaftar semester ini?",
  "When is Permohonan Tambah atau Gugur Kursus Lewat?",
  "When is Permohonan Rayuan Pembatalan Gugur Taraf (RPGT)?",
  "When is Gugur Taraf Bagi Pelajar Tidak Bayar Yuran (GT2)?",
  "When is Gugur Taraf Muktamad on the calendar this semester?",
  "When is Proses Exit Survey for this semester on the calendar?",
  "Bila tarikh akhir muat naik gambar kad pelajar di iStudent?",
  "When is Asasi second intake registration (Rayuan)?",
  "When does Lecture 2 start and end for this semester?",
  "When is Tarikh Akhir Keputusan Penangguhan Yuran?",
  "When is Tarikh Akhir Kemaskini Rekod Pelajar di iStudent?",
];

/** Group A (Foundation/Professional) — 50% short, 50% long. */
export const SUGGESTIONS_GROUP_A = [
  ...SUGGESTIONS_GROUP_A_SHORT,
  ...SUGGESTIONS_GROUP_A_LONG,
];

/** Group B short — EET, short sem, intersession, hostel, e-PJJ (diploma/degree). */
const SUGGESTIONS_GROUP_B_SHORT = [
  "When is EET Speaking?",
  "When is Short Semester?",
  "When is Intersession Classes?",
  "When is PDS?",
  "Bila Minggu Ulangkaji?",
  "When is mid-sem break?",
  "When is Cuti Semester?",
  "When is Gugur Taraf (GT)?",
  "When is MDS?",
  "Bila tarikh akhir yuran?",
  "When can I print exam slip?",
  "When is Lecture 1?",
  "When is hostel registration?",
  "When is diploma intake registration?",
  "When is part-time intake?",
  "When is SuFO?",
];

/** Group B long — programme intake, EET written, kolej, part-time (different topics from short). */
const SUGGESTIONS_GROUP_B_LONG = [
  "When is Penilaian / Peperiksaan Akhir / EET (Bertulis)?",
  "When does Pendaftaran Kursus Pelajar Sarjana Muda open?",
  "When is Pendaftaran Kursus Pelajar Pra-Diploma dan Diploma?",
  "When is Pendaftaran Kursus Pelajar Baharu mod ePJJ / PLK?",
  "When is Permohonan Penangguhan Pembayaran Yuran this semester?",
  "When is Tempoh Validasi Kursus Berdaftar for this semester?",
  "When is Permohonan Daftar atau Gugur Kursus Lewat?",
  "When is Permohonan Rayuan Pembatalan Gugur Taraf (RPGT)?",
  "When is Gugur Taraf Muktamad on the calendar this semester?",
  "When is Peperiksaan Intersesi or Short Semester exam week?",
  "When is Persetujuan Menerima Tawaran UiTM for Bachelor?",
  "When is Pendaftaran Fizikal & Serahan Dokumen Pelajar Baharu?",
  "When is Pendaftaran Kursus English Exit Test (EET699)?",
  "When is Pendaftaran Pelajar Baharu for Master or PhD?",
  "When is Cuti Pertengahan Semester / Krismas on Group B?",
  "When is Pendaftaran Kolej Penginapan for returning students?",
];

/** Group B (Pre-Diploma onwards) — 50% short, 50% long. */
export const SUGGESTIONS_GROUP_B = [
  ...SUGGESTIONS_GROUP_B_SHORT,
  ...SUGGESTIONS_GROUP_B_LONG,
];

export const SUGGESTIONS_GENERAL_NEUTRAL = [
  "How is Group A different from Group B?",
  "Apa beza sesi, semester, dan penggal di UiTM?",
  "How do I read registration, lecture, exam, and break on this calendar?",
  "Are Malaysia public holidays on the UiTM calendar?",
  "How many UiTM campuses are there?",
];

export const SUGGESTIONS_GENERAL_EXTRA_A = [
  "Which programmes use Group A?",
  "What is UiTM Foundation (Asasi) in brief?",
];

export const SUGGESTIONS_GENERAL_EXTRA_B = [
  "Which programmes use Group B?",
  "What is UiTM e-PJJ in brief?",
];

const DISPLAY_COUNT = 5;

function shuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j]!, copy[i]!];
  }
  return copy;
}

function pickFromPool(pool: string[], count: number, exclude: string[]): string[] {
  const available = pool.filter((s) => !exclude.includes(s));
  const source = available.length >= count ? available : pool;
  return shuffle(source).slice(0, count);
}

/** Pick half short + half long suggestions for the carousel. */
function pickBalancedGroupSuggestions(
  shortPool: string[],
  longPool: string[],
  exclude: string[],
  total: number = DISPLAY_COUNT
): string[] {
  const longCount = Math.floor(total / 2);
  const shortCount = total - longCount;
  const pickedShort = pickFromPool(shortPool, shortCount, exclude);
  const pickedLong = pickFromPool(longPool, longCount, [
    ...exclude,
    ...pickedShort,
  ]);
  return shuffle([...pickedShort, ...pickedLong]);
}

export function getRandomSuggestions(group: "A" | "B", exclude: string[]): string[] {
  if (group === "A") {
    const balanced = pickBalancedGroupSuggestions(
      SUGGESTIONS_GROUP_A_SHORT,
      SUGGESTIONS_GROUP_A_LONG,
      exclude
    );
    if (balanced.length >= DISPLAY_COUNT) return balanced;
  } else {
    const balanced = pickBalancedGroupSuggestions(
      SUGGESTIONS_GROUP_B_SHORT,
      SUGGESTIONS_GROUP_B_LONG,
      exclude
    );
    if (balanced.length >= DISPLAY_COUNT) return balanced;
  }

  const groupPool =
    group === "A"
      ? [...SUGGESTIONS_GROUP_A, ...SUGGESTIONS_GENERAL_NEUTRAL, ...SUGGESTIONS_GENERAL_EXTRA_A]
      : [...SUGGESTIONS_GROUP_B, ...SUGGESTIONS_GENERAL_NEUTRAL, ...SUGGESTIONS_GENERAL_EXTRA_B];
  const available = groupPool.filter((s) => !exclude.includes(s));
  const pool = available.length >= DISPLAY_COUNT ? available : groupPool;
  return shuffle(pool).slice(0, DISPLAY_COUNT);
}
