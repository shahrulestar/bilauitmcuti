export function sanitizeMessage(message: string): string {
  return message
    .replace(/ignore\s+(all\s+)?previous\s+instructions/gi, "")
    .replace(/ignore\s+(all\s+)?above\s+instructions/gi, "")
    .replace(/disregard\s+(all\s+)?previous/gi, "")
    .replace(/you\s+are\s+now\s+/gi, "")
    .replace(/new\s+instructions?\s*:/gi, "")
    .replace(/system\s*:/gi, "")
    .replace(/\[INST\]/gi, "")
    .replace(/<\|im_start\|>/gi, "")
    .replace(/<\|im_end\|>/gi, "")
    .trim();
}

const PLANNING_LINE =
  /^(User Question|Language|Context|Selected Session|Today'?s Date|Header|Content|Format|Answer format|Peperiksaan\/Penilaian):/i;

/** Pull user-visible answer when Gemma/reasoning models leak planning text. */
export function extractFinalAnswerFromPlanning(raw: string): string | null {
  const answerMatch = /\b(?:Answer|Jawapan):\s*([\s\S]+?)(?=\n(?:Language|Header|Context|User Question|\- No )|$)/i.exec(
    raw
  );
  if (answerMatch?.[1]) {
    const tail = answerMatch[1]
      .trim()
      .replace(/\n{3,}/g, "\n\n")
      .replace(/^(Yes|No)\.?\s*$/gim, "")
      .trim();
    if (tail.length >= 8) return tail;
  }

  const groupBlock = /Group [AB][^\n]*:\s*\n+([^\n]+(?:\n(?!Language:|Header:|Context:|User Question:)[^\n]+)*)/i.exec(
    raw
  );
  if (groupBlock?.[1]) {
    const body = groupBlock[1].trim();
    if (body.length >= 8 && !PLANNING_LINE.test(body.split("\n")[0] ?? "")) {
      return body;
    }
  }

  return null;
}

export function cleanAiReply(rawReply: string): string {
  const fromPlanning = extractFinalAnswerFromPlanning(rawReply);
  const source = fromPlanning ?? rawReply;

  const internalFields = [
    "type",
    "startDate",
    "endDate",
    "programType",
    "programTypes",
    "group",
    "details",
    "duration",
    "allStudents",
    "regionalStartDate",
    "regionalEndDate",
  ].join("|");

  const withoutPlanningLines = source
    .split("\n")
    .filter((line) => {
      const t = line.trim();
      if (!t) return true;
      if (PLANNING_LINE.test(t)) return false;
      if (/^(Yes|No)\.?\s*$/i.test(t)) return false;
      if (/^- No "/i.test(t)) return false;
      return true;
    })
    .join("\n");

  const cleaned = withoutPlanningLines
    .replace(/\((?:PAST|NOW|UPCOMING)\)\s*/gi, "")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/^[\s]*\*\s/gm, "- ")
    .replace(/#{1,6}\s?/g, "")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/~~/g, "")
    .replace(new RegExp(`\\|\\s*(?:${internalFields})\\s*:\\s*[^|\\n]+`, "gi"), "")
    .replace(new RegExp(`["'](?:${internalFields})["']\\s*:\\s*["'][^"']+["']`, "gi"), "")
    .replace(/[ \t]*[,;][ \t]*(?=\n|$)/g, "")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return cleaned;
}
