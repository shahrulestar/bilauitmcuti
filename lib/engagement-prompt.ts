export const ENGAGEMENT_STORAGE_KEYS = {
  completed: "engagement-prompt-completed",
  actionCount: "engagement-prompt-action-count",
  threshold: "engagement-prompt-threshold",
  lastShownAt: "engagement-prompt-last-shown-at",
} as const;

export type EngagementActionType =
  | "grid_cell_open"
  | "grid_drawer_nav"
  | "view_mode_change"
  | "filter_toggle"
  | "settings_open"
  | "session_change"
  | "program_change"
  | "chat_send"
  | "chat_mention_open";

const MIN_THRESHOLD = 5;
const MAX_THRESHOLD = 12;

function safeGetItem(key: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSetItem(key: string, value: string): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(key, value);
  } catch {
    // ignore
  }
}

function safeRemoveItem(key: string): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(key);
  } catch {
    // ignore
  }
}

function randomThreshold(): number {
  return MIN_THRESHOLD + Math.floor(Math.random() * (MAX_THRESHOLD - MIN_THRESHOLD + 1));
}

export function isEngagementCompleted(): boolean {
  return safeGetItem(ENGAGEMENT_STORAGE_KEYS.completed) === "1";
}

function ensureThreshold(): number {
  const stored = safeGetItem(ENGAGEMENT_STORAGE_KEYS.threshold);
  if (stored) {
    const parsed = parseInt(stored, 10);
    if (!Number.isNaN(parsed) && parsed > 0) return parsed;
  }
  const next = randomThreshold();
  safeSetItem(ENGAGEMENT_STORAGE_KEYS.threshold, String(next));
  return next;
}

function getActionCount(): number {
  const stored = safeGetItem(ENGAGEMENT_STORAGE_KEYS.actionCount);
  const parsed = stored ? parseInt(stored, 10) : 0;
  return Number.isNaN(parsed) ? 0 : parsed;
}

export interface RecordEngagementResult {
  shouldOpen: boolean;
  count: number;
  threshold: number;
}

export function recordEngagementAction(
  _type?: EngagementActionType
): RecordEngagementResult {
  if (isEngagementCompleted()) {
    const threshold = ensureThreshold();
    return { shouldOpen: false, count: getActionCount(), threshold };
  }

  const threshold = ensureThreshold();
  const nextCount = getActionCount() + 1;
  safeSetItem(ENGAGEMENT_STORAGE_KEYS.actionCount, String(nextCount));

  return {
    shouldOpen: nextCount >= threshold,
    count: nextCount,
    threshold,
  };
}

export function markEngagementCompleted(): void {
  safeSetItem(ENGAGEMENT_STORAGE_KEYS.completed, "1");
  safeSetItem(ENGAGEMENT_STORAGE_KEYS.actionCount, "0");
  safeRemoveItem(ENGAGEMENT_STORAGE_KEYS.threshold);
}

export function resetEngagementCycle(): void {
  safeSetItem(ENGAGEMENT_STORAGE_KEYS.actionCount, "0");
  safeSetItem(ENGAGEMENT_STORAGE_KEYS.threshold, String(randomThreshold()));
}

export function markEngagementShown(): void {
  safeSetItem(ENGAGEMENT_STORAGE_KEYS.lastShownAt, String(Date.now()));
}
