import type { Activity, SessionId } from "@/lib/data";
import { toPromptDate } from "@/lib/chat/dates";
import { sessionLabelForContext } from "@/lib/chat/context";

export interface MatchedActivity {
  activity: Activity;
  sessionId: SessionId;
  score: number;
}

function normalizeForMatch(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function scoreNameInMessage(messageNorm: string, nameNorm: string): number {
  if (nameNorm.length < 4) return 0;
  if (messageNorm.includes(nameNorm)) {
    return nameNorm.length >= 12 ? 100 : 80;
  }
  const words = nameNorm.split(" ").filter((w) => w.length > 2);
  if (words.length < 2) return 0;
  const matched = words.filter((w) => messageNorm.includes(w)).length;
  const ratio = matched / words.length;
  if (ratio >= 0.85 && matched >= 3) return 70;
  if (ratio >= 0.7 && matched >= 2) return 50;
  return 0;
}

/**
 * Find calendar activities whose official name appears in the user message.
 * Used to avoid keyword intent filters and to inject authoritative rows.
 */
export function matchActivitiesInMessage(
  message: string,
  activities: Array<{ activity: Activity; sessionId: SessionId }>,
  maxResults = 8
): MatchedActivity[] {
  const messageNorm = normalizeForMatch(message);
  if (messageNorm.length < 3) return [];

  const scored: MatchedActivity[] = [];
  for (const { activity, sessionId } of activities) {
    const nameNorm = normalizeForMatch(activity.name);
    const score = scoreNameInMessage(messageNorm, nameNorm);
    if (score > 0) {
      scored.push({ activity, sessionId, score });
    }
  }

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, maxResults);
}

export function formatMatchedActivitiesBlock(matches: MatchedActivity[]): string {
  if (matches.length === 0) return "";

  const lines: string[] = [
    "=== MATCHED ACTIVITIES (authoritative — copy these dates exactly) ===",
    "The user's message refers to these official calendar rows. Use ONLY these dates for the named event(s). Do not substitute NEXT BREAK or other events.",
  ];

  for (const { activity, sessionId } of matches) {
    const label = sessionLabelForContext(sessionId);
    let range = toPromptDate(activity.startDate);
    if (activity.endDate) range += ` to ${toPromptDate(activity.endDate)}`;
    lines.push(`- [${label}] ${activity.name}: ${range}`);
    if (activity.details) lines.push(`  Details: ${activity.details}`);
    if (activity.duration) lines.push(`  Duration: ${activity.duration}`);
    if (activity.regionalStartDate) {
      let reg = toPromptDate(activity.regionalStartDate);
      if (activity.regionalEndDate) reg += ` to ${toPromptDate(activity.regionalEndDate)}`;
      lines.push(`  Kedah, Kelantan, and Terengganu: ${reg}`);
    }
  }

  return lines.join("\n");
}

/** Flat list of activities with session ids for matching. */
export function flattenActivitiesWithSession(
  sessionIds: SessionId[],
  getActs: (sid: SessionId) => Activity[]
): Array<{ activity: Activity; sessionId: SessionId }> {
  const out: Array<{ activity: Activity; sessionId: SessionId }> = [];
  for (const sid of sessionIds) {
    for (const activity of getActs(sid)) {
      out.push({ activity, sessionId: sid });
    }
  }
  return out;
}
