import { DEFAULT_FILTER_STATES, defaultSession } from './data';
import type { ProgramValue } from './route-utils';

export interface FilterStates {
  showKKT: boolean;
  showRegistration: boolean;
  showLecture: boolean;
  showSemesterPendek: boolean;
  showKuliahIntersesi: boolean;
  showExamination: boolean;
  showOthersExams: boolean;
  showBreak: boolean;
  showCountdown: boolean;
  sessionId?: string;
  sessionIds?: string[];
  sessionIdsByProgram?: Partial<Record<ProgramValue, string[]>>;
}

const COOKIE_NAME = 'calendar-filters';
const COOKIE_MAX_AGE = 365 * 24 * 60 * 60; // 1 year

/**
 * Parse filter states from cookie value (decoded cookie value, not full cookie string)
 */
export function parseFiltersFromCookie(cookieValue: string | null | undefined): FilterStates {
  if (!cookieValue) {
    return { ...DEFAULT_FILTER_STATES };
  }

  try {
    const decoded = decodeURIComponent(cookieValue);
    const parsed = JSON.parse(decoded);
    const sessionIds = Array.isArray(parsed.sessionIds) && parsed.sessionIds.length > 0
      ? parsed.sessionIds
      : parsed.sessionId
        ? [parsed.sessionId]
        : [defaultSession];
    const sessionIdsByProgram =
      parsed.sessionIdsByProgram && typeof parsed.sessionIdsByProgram === 'object'
        ? Object.fromEntries(
            Object.entries(parsed.sessionIdsByProgram)
              .filter(([, value]) => Array.isArray(value) && value.length > 0)
              .map(([key, value]) => [key, value as string[]])
          ) as Partial<Record<ProgramValue, string[]>>
        : undefined;
    return {
      showKKT: parsed.showKKT ?? DEFAULT_FILTER_STATES.showKKT,
      showRegistration: parsed.showRegistration ?? DEFAULT_FILTER_STATES.showRegistration,
      showLecture: parsed.showLecture ?? DEFAULT_FILTER_STATES.showLecture,
      showSemesterPendek: parsed.showSemesterPendek ?? DEFAULT_FILTER_STATES.showSemesterPendek,
      showKuliahIntersesi: parsed.showKuliahIntersesi ?? DEFAULT_FILTER_STATES.showKuliahIntersesi,
      showExamination: parsed.showExamination ?? DEFAULT_FILTER_STATES.showExamination,
      showOthersExams: parsed.showOthersExams ?? DEFAULT_FILTER_STATES.showOthersExams,
      showBreak: parsed.showBreak ?? DEFAULT_FILTER_STATES.showBreak,
      showCountdown: parsed.showCountdown ?? DEFAULT_FILTER_STATES.showCountdown,
      sessionId: sessionIds[0],
      sessionIds,
      sessionIdsByProgram,
    };
  } catch {
    return { ...DEFAULT_FILTER_STATES, sessionId: defaultSession, sessionIds: [defaultSession] };
  }
}

/**
 * Set filter states to cookie (client-side only)
 */
export function setFiltersToCookie(filters: FilterStates): void {
  if (typeof window === 'undefined') return;

  try {
    const cookieValue = encodeURIComponent(JSON.stringify(filters));
    const expires = new Date();
    expires.setTime(expires.getTime() + COOKIE_MAX_AGE * 1000);
    const securePart =
      process.env.NODE_ENV === "production" ? "; Secure" : "";
    document.cookie = `${COOKIE_NAME}=${cookieValue}; expires=${expires.toUTCString()}; path=/; SameSite=Lax${securePart}`;
  } catch (e) {
    if (process.env.NODE_ENV === "development") {
      console.warn("Failed to set filters cookie:", e);
    }
  }
}

/**
 * Get filter states from cookie (client-side only)
 */
export function getFiltersFromCookie(): FilterStates {
  if (typeof window === 'undefined') {
    return DEFAULT_FILTER_STATES;
  }

  return parseFiltersFromCookie(document.cookie);
}
