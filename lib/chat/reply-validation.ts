import { toDateFormat } from "@/lib/chat/dates";
import type { Activity } from "@/lib/data";

/** Collect DD-MM-YYYY strings present in calendar activities for soft reply checks. */
export function collectAllowedDateTokens(activities: Activity[]): Set<string> {
  const allowed = new Set<string>();
  for (const a of activities) {
    if (a.startDate) allowed.add(toDateFormat(a.startDate));
    if (a.endDate) allowed.add(toDateFormat(a.endDate));
    if (a.regionalStartDate) allowed.add(toDateFormat(a.regionalStartDate));
    if (a.regionalEndDate) allowed.add(toDateFormat(a.regionalEndDate));
  }
  return allowed;
}

const DATE_IN_REPLY_RE = /\b(\d{2}-\d{2}-\d{4})\b/g;

/**
 * True when the reply cites at least one DD-MM-YYYY not found in the activity set.
 * Skips validation when there are no dates in the reply or no allowed tokens loaded.
 */
export function replyHasUnknownCalendarDates(
  reply: string,
  allowedDates: Set<string>
): boolean {
  if (allowedDates.size === 0) return false;
  const matches = reply.match(DATE_IN_REPLY_RE);
  if (!matches?.length) return false;
  return matches.some((d) => !allowedDates.has(d));
}

export const DATE_VALIDATION_RETRY_NUDGE =
  "\n\nCRITICAL: Your previous answer included dates not present in the calendar context. Reply again using ONLY dates from the GROUP calendar sections and QUICK REFERENCE. Do not invent dates.";
