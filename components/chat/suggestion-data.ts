/** Group A — questions 1–15 (registration, fees, appeals). */
const SUGGESTIONS_GROUP_A_SHORT = [
  "Bila boleh buat persetujuan menerima tawaran UiTM Asasi?",
  "Bila tarikh pendaftaran online sebagai pelajar Asasi UiTM?",
  "Bila pendaftaran secara fizikal pelajar baharu Group A?",
  "Bila proses serahan dokumen pelajar baharu Asasi?",
  "Bila tarikh akhir muat naik gambar kad pelajar di iStudent?",
  "Bila tarikh akhir pengemaskinian rekod pelajar di iStudent Portal?",
  "Bila Program Minggu Destini Siswa (MDS) untuk Group A?",
  "Bila boleh daftar kursus untuk pelajar baharu dan lama Group A?",
  "Bila tempoh permohonan penangguhan pembayaran yuran Group A?",
  "Bila tarikh akhir keputusan permohonan penangguhan pembayaran yuran?",
  "Bila tempoh validasi kursus berdaftar semester semasa Group A?",
  "Bila boleh mohon daftar atau gugur kursus lewat atau luar tempoh?",
  "Bila tarikh akhir pembayaran yuran Group A?",
  "Bila Gugur Taraf (GT) akan berlaku untuk Group A?",
  "Bila boleh hantar Permohonan Rayuan Pembatalan Gugur Taraf (RPGT)?",
];

/** Group A — questions 16–30 (appeals, exams, breaks). */
const SUGGESTIONS_GROUP_A_LONG = [
  "Bila keputusan RPGT akan dikeluarkan?",
  "Bila tarikh akhir bayar yuran bagi pelajar yang lulus RPGT?",
  "Bila Gugur Taraf kedua (GT2) untuk pelajar yang masih tidak bayar yuran?",
  "Bila Gugur Taraf Muktamad untuk Group A?",
  "Bila pelajar Group A boleh mula cetak slip menduduki peperiksaan?",
  "Bila kuliah bermula untuk Group A semester ini?",
  "Bila Proses Entrance Survey untuk Group A?",
  "Bila Ujian Pertengahan Semester Group A?",
  "Bila Cuti Pertengahan Semester Group A?",
  "Bila Cuti Khas Perayaan Aidil Fitri untuk Group A?",
  "Bila Minggu Ulangkaji untuk Group A?",
  "Bila Penilaian atau Peperiksaan Akhir Group A?",
  "Bila Proses Exit Survey Group A?",
  "Bila Student Feedback Online (SuFO) Group A?",
  "Bila Cuti Semester Group A bermula?",
];

export const SUGGESTIONS_GROUP_A = [
  ...SUGGESTIONS_GROUP_A_SHORT,
  ...SUGGESTIONS_GROUP_A_LONG,
];

/** Group B — questions 1–15 (registration, fees, appeals). */
const SUGGESTIONS_GROUP_B_SHORT = [
  "Bila boleh buat persetujuan menerima tawaran UiTM secara online untuk Group B?",
  "Bila pendaftaran online sebagai pelajar sepenuh masa Group B?",
  "Bila pendaftaran fizikal dan serahan dokumen pelajar baharu Group B?",
  "Bila Program Minggu Destini Siswa (MDS) dan Program Minggu Edu 5.0@UiTM Group B?",
  "Bila Program Pemantapan Destini Siswa (PDS) untuk Group B?",
  "Bila pendaftaran kolej penginapan pelajar baharu Group B?",
  "Bila pendaftaran pelajar baharu tawaran kedua Group B?",
  "Bila pendaftaran kursus pelajar baharu mod ePJJ atau PLK?",
  "Bila tarikh akhir muat naik gambar kad pelajar di iStudent Portal Group B?",
  "Bila tarikh akhir kemaskini rekod pelajar di iStudent Portal Group B?",
  "Bila tempoh permohonan penangguhan pembayaran yuran via Online Fee Deferment?",
  "Bila tarikh akhir keputusan permohonan penangguhan pembayaran yuran Group B?",
  "Bila tempoh validasi kursus berdaftar semester semasa Group B?",
  "Bila boleh mohon daftar atau gugur kursus lewat atau luar tempoh Group B?",
  "Bila tarikh akhir pembayaran yuran Group B?",
];

/** Group B — questions 16–30 (appeals, exams, breaks). */
const SUGGESTIONS_GROUP_B_LONG = [
  "Bila Gugur Taraf (GT) berlaku untuk Group B?",
  "Bila boleh hantar Permohonan Rayuan Pembatalan Gugur Taraf (RPGT) Group B?",
  "Bila keputusan rayuan pembatalan Gugur Taraf (RPGT) Group B dikeluarkan?",
  "Bila Gugur Taraf kedua (GT2) untuk pelajar yang masih tidak daftar kursus dan tiada pembayaran yuran?",
  "Bila tarikh akhir bayar yuran bagi pelajar yang diluluskan penangguhan yuran Group B?",
  "Bila Gugur Taraf Muktamad untuk Group B?",
  "Bila pelajar Group B boleh mula cetak slip menduduki peperiksaan?",
  "Bila kuliah bermula untuk Group B semester ini?",
  "Bila Proses Entrance Survey untuk Group B?",
  "Bila Cuti Pertengahan Semester atau Cuti Perayaan Group B?",
  "Bila Minggu Ulangkaji untuk Group B?",
  "Bila English Exit Test (EET Speaking) Group B?",
  "Bila Penilaian atau Peperiksaan Akhir atau EET Bertulis Group B?",
  "Bila Short Semester untuk Group B?",
  "Bila Cuti Semester Group B bermula?",
];

export const SUGGESTIONS_GROUP_B = [
  ...SUGGESTIONS_GROUP_B_SHORT,
  ...SUGGESTIONS_GROUP_B_LONG,
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
    const pool = SUGGESTIONS_GROUP_A.filter((s) => !exclude.includes(s));
    return shuffle(pool.length >= DISPLAY_COUNT ? pool : SUGGESTIONS_GROUP_A).slice(
      0,
      DISPLAY_COUNT
    );
  }

  const balanced = pickBalancedGroupSuggestions(
    SUGGESTIONS_GROUP_B_SHORT,
    SUGGESTIONS_GROUP_B_LONG,
    exclude
  );
  if (balanced.length >= DISPLAY_COUNT) return balanced;
  const pool = SUGGESTIONS_GROUP_B.filter((s) => !exclude.includes(s));
  return shuffle(pool.length >= DISPLAY_COUNT ? pool : SUGGESTIONS_GROUP_B).slice(
    0,
    DISPLAY_COUNT
  );
}
