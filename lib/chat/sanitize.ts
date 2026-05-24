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

export function cleanAiReply(rawReply: string): string {
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

  const cleaned = rawReply
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
