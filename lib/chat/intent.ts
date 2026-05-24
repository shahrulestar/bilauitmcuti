const CALENDAR_STRONG_KEYWORDS = [
  "cuti",
  "semester",
  "peperiksaan",
  "exam",
  "tarikh",
  "date",
  "break",
  "kuliah",
  "lecture",
  "pendaftaran",
  "registration",
  "minggu ulangkaji",
  "revision",
  "gugur taraf",
  "group a",
  "group b",
  "kumpulan",
  "jadual",
  "schedule",
  "hari raya",
  "aidil",
  "short semester",
  "intersession classes",
];

const CALENDAR_AMBIGUOUS_KEYWORDS = [
  "class",
  "classes",
  "lectures",
  "yuran",
  "fee",
  "bila",
  "when",
  "mds",
];

const GENERAL_UITM_INFO_KEYWORDS = [
  "kampus",
  "campus",
  "fakulti",
  "faculty",
  "program",
  "course",
  "courses",
  "subjek",
  "subject",
  "subjects",
  "admission",
  "intake",
  "syarat",
  "requirement",
  "requirements",
  "scholarship",
  "biasiswa",
];

const CALENDAR_INTENT_HINTS = [
  "mula",
  "start",
  "akhir",
  "end",
  "next",
  "upcoming",
  "seterusnya",
  "akan datang",
  "lepas ni",
  "current",
  "sekarang",
  "tarikh",
  "date",
  "jadual",
  "schedule",
  "cuti",
  "semester",
  "exam",
  "peperiksaan",
  "registration",
  "pendaftaran",
];

export function isCalendarQuestion(message: string): boolean {
  const lower = message.toLowerCase();
  if (CALENDAR_STRONG_KEYWORDS.some((kw) => lower.includes(kw))) return true;

  const hasAmbiguousKeyword = CALENDAR_AMBIGUOUS_KEYWORDS.some((kw) =>
    lower.includes(kw)
  );
  if (!hasAmbiguousKeyword) return false;

  const hasGeneralUitmIntent = GENERAL_UITM_INFO_KEYWORDS.some((kw) =>
    lower.includes(kw)
  );
  if (hasGeneralUitmIntent) return false;

  return CALENDAR_INTENT_HINTS.some((kw) => lower.includes(kw));
}

const COMPARE_KEYWORDS = [
  "compare",
  "comparison",
  "difference",
  "different",
  "vs",
  "versus",
  "bezakan",
  "beza",
  "perbandingan",
  "banding",
];

export function isComparisonQuestion(message: string): boolean {
  const lower = message.toLowerCase();
  return COMPARE_KEYWORDS.some((kw) => lower.includes(kw));
}

const TABLE_FORMAT_KEYWORDS = [
  "table",
  "jadual",
  "in table",
  "into table",
  "as table",
  "tabular",
  "format table",
  "write table",
  "list in table",
  "show in table",
  "bentuk jadual",
  "dalam jadual",
  "dalam bentuk jadual",
  "senarai jadual",
];

export function isTableFormatRequested(message: string): boolean {
  const lower = message.toLowerCase();
  return TABLE_FORMAT_KEYWORDS.some((kw) => lower.includes(kw));
}

export const TABLE_OUTPUT_RULE =
  "\n\nTABLE OUTPUT RULE (MANDATORY): The user asked for a table. Put the schedule or comparison inside a [TABLE]...[/TABLE] block only. Format:\n[TABLE]\n| Activity | Date |\n| --- | --- |\n| (event name) | (date or range) |\n[/TABLE]\nRules: First row inside [TABLE] MUST be real column headers (e.g. Activity, Date)—NOT a group title. Put group/program title as ONE plain-text line immediately BEFORE [TABLE]. Use pipe | between columns. Do NOT output raw markdown tables outside [TABLE]. For session comparisons, first column = session id + label.";

export function isSimpleCalendarQuestion(message: string): boolean {
  const lower = message.toLowerCase().trim();
  const simpleHints = [
    "when",
    "bila",
    "tarikh",
    "date",
    "next",
    "seterusnya",
    "mula",
    "start",
    "end",
    "akhir",
    "cuti",
    "break",
    "exam",
    "peperiksaan",
  ];
  const hasSimpleHint = simpleHints.some((kw) => lower.includes(kw));
  return hasSimpleHint && lower.length <= 120;
}
