import { detectUserLanguage, type UserLanguageMode } from "@/lib/chat-language";

export type QuickReferenceIntent =
  | "current"
  | "next_break"
  | "next_exam"
  | "semester_break";

const CURRENT_HINTS = [
  "current",
  "sekarang",
  "now",
  "berlaku",
  "happening",
  "ongoing",
  "sedang",
];

const NEXT_BREAK_HINTS = [
  "next break",
  "upcoming break",
  "cuti seterusnya",
  "cuti depan",
  "rehat seterusnya",
  "bila cuti",
  "when is the break",
  "when break",
  "next cuti",
];

const SEMESTER_BREAK_HINTS = ["cuti semester", "semester break"];

const NEXT_EXAM_HINTS = [
  "next exam",
  "upcoming exam",
  "peperiksaan seterusnya",
  "peperiksaan depan",
  "bila peperiksaan",
  "when is the exam",
  "when exam",
  "next peperiksaan",
  "ujian seterusnya",
];

export function detectQuickReferenceIntent(message: string): QuickReferenceIntent | null {
  const lower = message.toLowerCase().trim();
  if (!lower) return null;

  if (SEMESTER_BREAK_HINTS.some((h) => lower.includes(h))) return "semester_break";
  if (NEXT_EXAM_HINTS.some((h) => lower.includes(h))) return "next_exam";
  if (NEXT_BREAK_HINTS.some((h) => lower.includes(h))) return "next_break";
  if (CURRENT_HINTS.some((h) => lower.includes(h))) return "current";

  if (
    (lower.includes("cuti") || lower.includes("break")) &&
    (lower.includes("next") || lower.includes("seterusnya") || lower.includes("bila") || lower.includes("when"))
  ) {
    return "next_break";
  }
  if (
    (lower.includes("peperiksaan") || lower.includes("exam") || lower.includes("ujian")) &&
    (lower.includes("next") || lower.includes("seterusnya") || lower.includes("bila") || lower.includes("when"))
  ) {
    return "next_exam";
  }

  return null;
}

function linePrefixForIntent(intent: QuickReferenceIntent): string {
  switch (intent) {
    case "current":
      return "CURRENTLY HAPPENING:";
    case "next_break":
      return "NEXT BREAK:";
    case "next_exam":
      return "NEXT EXAM:";
    case "semester_break":
      return "SEMESTER BREAK:";
  }
}

function extractLineValue(block: string, prefix: string): string | null {
  for (const line of block.split("\n")) {
    const trimmed = line.trim();
    if (trimmed.startsWith(prefix)) {
      return trimmed.slice(prefix.length).trim();
    }
  }
  return null;
}

function groupHeader(
  language: UserLanguageMode,
  primaryGroup: "A" | "B",
  programLabel: string
): string {
  if (language === "malay") {
    return `Kumpulan ${primaryGroup} (${programLabel}):`;
  }
  return `Group ${primaryGroup} (${programLabel}):`;
}

function formatAnswerBody(
  intent: QuickReferenceIntent,
  value: string,
  language: UserLanguageMode
): string {
  const noneEn = "No matching schedule item found in the selected session calendar.";
  const noneMs = "Tiada item jadual yang sepadan dalam kalendar sesi yang dipilih.";

  if (!value || value.toLowerCase().includes("no active event")) {
    if (intent === "current") {
      if (language === "malay") return "Tiada acara aktif pada masa ini.";
      return "No event is active right now.";
    }
    return language === "malay" ? noneMs : noneEn;
  }

  if (intent === "current") {
    if (language === "malay") return `Sedang berlangsung: ${value}`;
    return `Currently: ${value}`;
  }

  if (intent === "next_break") {
    if (language === "malay") return `Cuti seterusnya: ${value}`;
    return `Next break: ${value}`;
  }

  if (intent === "next_exam") {
    if (language === "malay") return `Peperiksaan seterusnya: ${value}`;
    return `Next exam: ${value}`;
  }

  if (language === "malay") return `Cuti semester: ${value}`;
  return `Semester break: ${value}`;
}

function buildBlockReply(
  block: string,
  intent: QuickReferenceIntent,
  primaryGroup: "A" | "B",
  programLabel: string,
  language: UserLanguageMode
): string | null {
  const prefix = linePrefixForIntent(intent);
  let value = extractLineValue(block, prefix);

  if (intent === "next_break" && !value) {
    value = extractLineValue(block, linePrefixForIntent("semester_break"));
  }

  if (!value && intent !== "current") return null;

  const header = groupHeader(language, primaryGroup, programLabel);
  const body = formatAnswerBody(intent, value ?? "", language);
  return `${header}\n\n${body}`;
}

export interface QuickReferenceFastPathParams {
  message: string;
  quickReference: string;
  programLabel: string;
  primaryGroup: "A" | "B";
}

/**
 * Deterministic reply from pre-computed quick reference (no LLM).
 * Returns null when the question is not eligible or data is missing.
 */
export function tryBuildQuickReferenceReply(
  params: QuickReferenceFastPathParams
): string | null {
  const intent = detectQuickReferenceIntent(params.message);
  if (!intent) return null;

  const language = detectUserLanguage(params.message);
  const blocks = params.quickReference.split(/\n\n(?=\[)/);

  if (blocks.length > 1 && blocks[0]?.includes("[")) {
    const parts: string[] = [];
    for (const block of blocks) {
      const reply = buildBlockReply(
        block,
        intent,
        params.primaryGroup,
        params.programLabel,
        language
      );
      if (reply) parts.push(reply);
    }
    return parts.length > 0 ? parts.join("\n\n") : null;
  }

  return buildBlockReply(
    params.quickReference,
    intent,
    params.primaryGroup,
    params.programLabel,
    language
  );
}
