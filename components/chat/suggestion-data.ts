/** Group A (Foundation/Professional) — calendar academic prompts only. */
export const SUGGESTIONS_GROUP_A = [
  "What is the next break or holiday on my Group A calendar?",
  "What is the next registration, lecture, or exam date (Group A)?",
  "When does course registration open for new intake students (Group A)?",
  "When does course registration open for returning students (Group A)?",
  "When is course validation and the late add/drop period (Group A)?",
  "What are the GT, GT2, RPGT, and semester fee payment dates (Group A)?",
  "When does Lecture Week 1 start and when does the last lecture week end (Group A)?",
  "How many lecture weeks are in this Group A session?",
  "Show all lecture week dates for Group A in a table",
  "When is revision week (Minggu Ulangkaji) and how many days is it (Group A)?",
  "When do mid-semester break and semester break start and end (Group A)?",
  "How many days until semester break starts (Group A)?",
  "Is there a festive recess or Hari Raya break on the Group A calendar?",
  "When are mid-semester and final examinations (Group A)?",
  "From which date can I print my examination slip (Group A)?",
  "List all examination periods and slip dates for Group A in a table",
  "When is gugur taraf (deregistration) on the Group A calendar?",
  "Do Kedah, Kelantan, and Terengganu have different lecture or break dates (Group A)?",
  "Compare default vs Kedah, Kelantan, and Terengganu exam dates in a table (Group A)",
  "When is Minggu Destini Siswa (MDS) on the Group A calendar?",
  "When are SuFO briefing or submission dates on the Group A calendar?",
  "Summarize registration, lectures, exams, and breaks for Group A in a table",
  "Bila cuti pertengahan semester dan cuti semester (Kumpulan A)?",
  "Bilakah tarikh pendaftaran kursus pelajar baharu dan pelajar sedia ada (Kumpulan A)?",
  "Bilakah tarikh sahkan kursus dan tambah/gugur lewat (Kumpulan A)?",
  "Bilakah tarikh GT, GT2, RPGT, dan bayaran yuran semester (Kumpulan A)?",
  "Bilakah Minggu Kuliah 1 mula dan minggu kuliah terakhir tamat (Kumpulan A)?",
  "Bilakah minggu ulangkaji dan peperiksaan pertengahan serta akhir (Kumpulan A)?",
  "Paparkan jadual kuliah dan cuti Kumpulan A dalam jadual",
  "Apakah tarikh akademik penting seterusnya pada kalendar Kumpulan A?",
];

/** Group B (Pre-Diploma onwards) — calendar academic prompts only. */
export const SUGGESTIONS_GROUP_B = [
  "What is the next break or important academic date on my Group B calendar?",
  "When does course registration open for Pre-Diploma, Diploma, and Bachelor (Group B)?",
  "When does e-PJJ or PLK new-intake registration open (Group B)?",
  "When is course validation and the late add/drop period (Group B)?",
  "What are the GT, GT2, RPGT, and semester fee payment dates (Group B)?",
  "When do Lecture Weeks 1–3 run (Group B)?",
  "When does Short Semester (Semester Pendek) start and end (Group B)?",
  "When are Intersession Classes scheduled (Group B)?",
  "How many lecture weeks are in this Group B session?",
  "Show lecture weeks, Short Semester, and Intersession dates in a table (Group B)",
  "When do mid-semester break and semester break start and end (Group B)?",
  "When is revision week (Minggu Ulangkaji) for this Group B session?",
  "When are mid-semester and final examinations (Group B)?",
  "When is EET Speaking and the final English Exit Test assessment (Group B)?",
  "From which date can I print my examination slip (Group B)?",
  "List all examination periods and slip dates for Group B in a table",
  "When is gugur taraf (deregistration) on the Group B calendar?",
  "Do Kedah, Kelantan, and Terengganu have different break or exam dates (Group B)?",
  "Compare default vs Kedah, Kelantan, and Terengganu dates in a table (Group B)",
  "When is Minggu Destini Siswa (MDS) on the Group B calendar?",
  "When are SuFO briefing or submission dates on the Group B calendar?",
  "Compare registration, lectures, exams, and breaks in a table (Group B)",
  "Do part-time Diploma or Bachelor programmes have different dates (Group B)?",
  "Bila pendaftaran kursus Pra-Diploma, Diploma, dan Ijazah (Kumpulan B)?",
  "Bilakah pendaftaran e-PJJ atau PLK untuk pelajar baharu (Kumpulan B)?",
  "Bilakah Minggu Kuliah 1–3, Semester Pendek, dan Kuliah Intersesi (Kumpulan B)?",
  "Bilakah minggu ulangkaji dan peperiksaan pertengahan serta akhir (Kumpulan B)?",
  "Bila Peperiksaan English Exit Test (EET) Lisan dan penilaian akhir (Kumpulan B)?",
  "Paparkan garis masa pendaftaran hingga peperiksaan Kumpulan B dalam jadual",
  "Apakah tarikh akademik penting seterusnya pada kalendar Kumpulan B?",
];

export const SUGGESTIONS_GENERAL_NEUTRAL = [
  "How is the Group A calendar different from the Group B calendar?",
  "Apa beza sesi, semester, dan penggal di UiTM?",
  "How do I read registration, lecture, exam, and break on this calendar?",
  "Are Malaysia public holidays shown in the UiTM academic calendar?",
  "How many UiTM campuses are there and where is the main campus?",
];

export const SUGGESTIONS_GENERAL_EXTRA_A = [
  "Which programmes and intake cycle use Group A (Foundation/Professional)?",
  "What is UiTM Foundation (Asasi) in brief?",
];

export const SUGGESTIONS_GENERAL_EXTRA_B = [
  "Which programmes use the Group B calendar (Mar–Aug cycle)?",
  "What is UiTM e-PJJ in brief?",
];

export function getRandomSuggestions(group: "A" | "B", exclude: string[]): string[] {
  const groupPool =
    group === "A"
      ? [...SUGGESTIONS_GROUP_A, ...SUGGESTIONS_GENERAL_NEUTRAL, ...SUGGESTIONS_GENERAL_EXTRA_A]
      : [...SUGGESTIONS_GROUP_B, ...SUGGESTIONS_GENERAL_NEUTRAL, ...SUGGESTIONS_GENERAL_EXTRA_B];
  const available = groupPool.filter((s) => !exclude.includes(s));
  const pool = available.length >= 5 ? available : groupPool;
  const shuffled = [...pool].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, 5);
}
