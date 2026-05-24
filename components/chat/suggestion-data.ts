/** Short prompts — quick tap, fast AI / quick-reference path. */
const SUGGESTIONS_GROUP_A_SHORT = [
  "When is the next break? (Group A)",
  "Bila cuti seterusnya? (Kumpulan A)",
  "When is the next exam? (Group A)",
  "Bila peperiksaan seterusnya? (Kumpulan A)",
  "How many days until semester break? (Group A)",
  "When is revision week? (Group A)",
  "When is mid-semester break? (Group A)",
  "When is Lecture Week 1? (Group A)",
  "Bila Minggu Kuliah 1? (Kumpulan A)",
  "When can I print my exam slip? (Group A)",
  "When is gugur taraf? (Group A)",
  "When is MDS? (Group A)",
  "Is Hari Raya break on the calendar? (Group A)",
  "What's on my calendar now? (Group A)",
  "Apa tarikh seterusnya? (Kumpulan A)",
];

/** Longer prompts — detail, tables, comparisons, regional dates. */
const SUGGESTIONS_GROUP_A_LONG = [
  "What is the next break or holiday on my Group A calendar?",
  "When does course registration open for new and returning students (Group A)?",
  "When is course validation and the late add/drop period (Group A)?",
  "What are the GT, GT2, RPGT, and semester fee payment dates (Group A)?",
  "When does Lecture Week 1 start and when does the last lecture week end (Group A)?",
  "Show all lecture week dates for Group A in a table",
  "When is revision week (Minggu Ulangkaji) and how many days is it (Group A)?",
  "When do mid-semester break and semester break start and end (Group A)?",
  "List all examination periods and slip dates for Group A in a table",
  "Do Kedah, Kelantan, and Terengganu have different lecture or break dates (Group A)?",
  "Compare default vs Kedah, Kelantan, and Terengganu exam dates in a table (Group A)",
  "When are SuFO briefing or submission dates on the Group A calendar?",
  "Summarize registration, lectures, exams, and breaks for Group A in a table",
  "Bilakah tarikh pendaftaran kursus pelajar baharu dan pelajar sedia ada (Kumpulan A)?",
  "Paparkan jadual kuliah dan cuti Kumpulan A dalam jadual",
];

/** Group A (Foundation/Professional) — 50% short, 50% long. */
export const SUGGESTIONS_GROUP_A = [
  ...SUGGESTIONS_GROUP_A_SHORT,
  ...SUGGESTIONS_GROUP_A_LONG,
];

const SUGGESTIONS_GROUP_B_SHORT = [
  "When is the next break? (Group B)",
  "Bila cuti seterusnya? (Kumpulan B)",
  "When is the next exam? (Group B)",
  "Bila peperiksaan seterusnya? (Kumpulan B)",
  "How many days until semester break? (Group B)",
  "When is revision week? (Group B)",
  "When is Short Semester? (Group B)",
  "When are Intersession Classes? (Group B)",
  "When is Lecture Week 1? (Group B)",
  "Bila Minggu Kuliah 1? (Kumpulan B)",
  "When can I print my exam slip? (Group B)",
  "When is gugur taraf? (Group B)",
  "When is MDS? (Group B)",
  "When is EET Speaking? (Group B)",
  "Apa tarikh seterusnya? (Kumpulan B)",
];

const SUGGESTIONS_GROUP_B_LONG = [
  "What is the next break or important academic date on my Group B calendar?",
  "When does course registration open for Pre-Diploma, Diploma, and Bachelor (Group B)?",
  "When does e-PJJ or PLK new-intake registration open (Group B)?",
  "When is course validation and the late add/drop period (Group B)?",
  "What are the GT, GT2, RPGT, and semester fee payment dates (Group B)?",
  "Show lecture weeks, Short Semester, and Intersession dates in a table (Group B)",
  "When do mid-semester break and semester break start and end (Group B)?",
  "List all examination periods and slip dates for Group B in a table",
  "Do Kedah, Kelantan, and Terengganu have different break or exam dates (Group B)?",
  "Compare default vs Kedah, Kelantan, and Terengganu dates in a table (Group B)",
  "When is EET Speaking and the final English Exit Test assessment (Group B)?",
  "Compare registration, lectures, exams, and breaks in a table (Group B)",
  "Do part-time Diploma or Bachelor programmes have different dates (Group B)?",
  "Bilakah Minggu Kuliah 1–3, Semester Pendek, dan Kuliah Intersesi (Kumpulan B)?",
  "Paparkan garis masa pendaftaran hingga peperiksaan Kumpulan B dalam jadual",
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
