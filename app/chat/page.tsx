"use client";

import { useState, useRef, useEffect, useLayoutEffect, useCallback, useMemo, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronDown, ChevronUp, Send, ThumbsUp, ThumbsDown, Copy, Check, Trash2, Pencil } from "lucide-react";
import { useCalendarHydrationVersion } from "@/components/calendar-hydration-context";
import { getSnapshot, subscribe } from "@/lib/calendar-store";
import {
  formatGroupASessionTriggerLabel,
  formatSessionLabelWithId,
  getProgramOptions,
  getSessionOptionsForGroup,
  getSessionForCurrentDate,
  getGroupFromSession,
} from "@/lib/data";
import type { SessionId } from "@/lib/data";
import { getFiltersFromCookie, type FilterStates } from "@/lib/cookie-utils";
import { getRoutePath, isProgramValue, type ProgramValue } from "@/lib/route-utils";
import { sessionSubmenuItemClass } from "@/lib/session-submenu-item-class";
import { SessionSubmenuItemLabel } from "@/components/session-submenu-item-label";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuPortal,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/table";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import useEmblaCarousel from "embla-carousel-react";
import {
  TurnstileWidget,
  type TurnstileWidgetHandle,
} from "@/components/turnstile-widget";

function getChatErrorMessage(res: Response, fallback: string): string {
  if (res.status === 429) return "Too many requests. Please wait a moment before trying again.";
  if (res.status === 403) return "Access was blocked. Please refresh and try again.";
  if (res.status === 504) return "Request timed out. Please try again.";
  if (res.status >= 500) return "Server is temporarily unavailable. Please try again in a moment.";
  return fallback;
}

async function parseChatResponse(res: Response): Promise<{ error?: string; reply?: string }> {
  const text = await res.text();
  try {
    return JSON.parse(text) as { error?: string; reply?: string };
  } catch {
    return { error: getChatErrorMessage(res, "Something went wrong. Please try again.") };
  }
}

/**
 * Parse a [TABLE]...[/TABLE] block into headers and rows.
 * Each row is pipe-delimited. The first row is the header.
 * A separator row (e.g. ---|---|---) is skipped if present.
 */
function parseTable(block: string): { headers: string[]; rows: string[][] } | null {
  const lines = block
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length < 2) return null;

  const parseRow = (line: string) =>
    line.split("|").map((cell) => cell.trim()).filter((c) => c.length > 0);

  const headers = parseRow(lines[0]);
  if (headers.length === 0) return null;

  const rows: string[][] = [];
  for (let j = 1; j < lines.length; j++) {
    // Skip markdown-style separator rows (---|---|---)
    if (/^[\s|:-]+$/.test(lines[j])) continue;
    const row = parseRow(lines[j]);
    if (row.length > 0) rows.push(row);
  }

  return rows.length > 0 ? { headers, rows } : null;
}

function isPipeTableRow(line: string): boolean {
  const t = line.trim();
  if (!t.includes("|")) return false;
  const cells = t.split("|").map((c) => c.trim()).filter((c) => c.length > 0);
  return cells.length >= 2;
}

/** GFM / markdown table separator row e.g. | --- | --- | or |:---|:---| */
function isMarkdownTableSeparator(line: string): boolean {
  const cells = line
    .trim()
    .split("|")
    .map((c) => c.trim())
    .filter((c) => c.length > 0);
  return cells.length >= 2 && cells.every((c) => /^:?-{3,}:?$/.test(c));
}

/** First row of a pipe table: not a separator-only row */
function isMarkdownTableHeaderRow(line: string): boolean {
  if (!isPipeTableRow(line)) return false;
  const cells = line
    .trim()
    .split("|")
    .map((c) => c.trim())
    .filter((c) => c.length > 0);
  const allDash = cells.every((c) => /^:?-{3,}:?$/.test(c));
  return !allDash;
}

/**
 * Finds GitHub-style markdown tables embedded in plain text (models often emit these
 * instead of [TABLE]...[/TABLE]). Returns ordered text + table segments.
 */
function splitEmbeddedMarkdownTables(part: string): { type: "text" | "table"; body: string }[] {
  const rawLines = part.split(/\r?\n/);
  const segments: { type: "text" | "table"; body: string }[] = [];
  const textBuf: string[] = [];
  let i = 0;

  function flushText() {
    if (textBuf.length === 0) return;
    const body = textBuf.join("\n");
    textBuf.length = 0;
    if (body.trim()) segments.push({ type: "text", body });
  }

  while (i < rawLines.length) {
    const line = rawLines[i]?.replace(/\r$/, "") ?? "";
    const line2 = rawLines[i + 1]?.replace(/\r$/, "");
    const line3 = rawLines[i + 2]?.replace(/\r$/, "");

    if (
      line2 !== undefined &&
      line3 !== undefined &&
      isMarkdownTableHeaderRow(line) &&
      isMarkdownTableSeparator(line2) &&
      isPipeTableRow(line3) &&
      !isMarkdownTableSeparator(line3)
    ) {
      flushText();
      const tableLines: string[] = [line, line2];
      i += 2;
      while (i < rawLines.length) {
        const L = rawLines[i]?.replace(/\r$/, "") ?? "";
        if (!L.trim()) break;
        if (isPipeTableRow(L)) {
          tableLines.push(L);
          i++;
        } else break;
      }
      segments.push({ type: "table", body: tableLines.join("\n") });
      continue;
    }

    textBuf.push(line);
    i++;
  }
  flushText();
  return segments;
}

function renderSegmentsWithMarkdownTables(
  part: string,
  keyPrefix: string
): React.ReactNode[] {
  const elements: React.ReactNode[] = [];
  const segments = splitEmbeddedMarkdownTables(part);
  segments.forEach((seg, segIdx) => {
    if (seg.type === "table") {
      const tableData = parseTable(seg.body);
      if (tableData) {
        elements.push(
          <DataTable key={`${keyPrefix}-md-${segIdx}`} headers={tableData.headers} rows={tableData.rows} />
        );
      } else {
        elements.push(
          ...renderTextSection(seg.body.split(/\r?\n/), `${keyPrefix}-md-fail-${segIdx}`)
        );
      }
    } else {
      elements.push(...renderTextSection(seg.body.split(/\r?\n/), `${keyPrefix}-tx-${segIdx}`));
    }
  });
  return elements;
}

/**
 * Renders a data table using shadcn Table components.
 */
function DataTable({ headers, rows }: { headers: string[]; rows: string[][] }) {
  return (
    <div className="mt-2 rounded-lg border border-border overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/50">
            {headers.map((h, idx) => (
              <TableHead key={idx} className="text-xs font-semibold">
                {h}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row, rIdx) => (
            <TableRow key={rIdx}>
              {headers.map((_, cIdx) => (
                <TableCell key={cIdx} className="text-xs">
                  {row[cIdx] ?? ""}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

/**
 * Renders a single section of text (no [TABLE] blocks) into formatted elements.
 * Handles bullet lists, numbered lists with nested sub-details, and plain text paragraphs.
 */
function renderTextSection(lines: string[], keyPrefix: string): React.ReactNode[] {
  const elements: React.ReactNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const trimmed = lines[i].trim();

    // Skip empty lines
    if (!trimmed) {
      i++;
      continue;
    }

    // Collect consecutive bullet lines (- item)
    if (/^-\s/.test(trimmed)) {
      const bullets: string[] = [];
      while (i < lines.length && /^-\s/.test(lines[i].trim())) {
        bullets.push(lines[i].trim().replace(/^-\s+/, ""));
        i++;
      }
      elements.push(
        <ul key={`${keyPrefix}-ul-${i}`} className="mt-1 space-y-0.5">
          {bullets.map((b, idx) => (
            <li key={idx} className="flex gap-2">
              <span className="text-muted-foreground shrink-0">-</span>
              <span>{b}</span>
            </li>
          ))}
        </ul>
      );
      continue;
    }

    // Collect numbered list with optional sub-details
    if (/^\d+[.)]\s/.test(trimmed)) {
      const items: { num: string; text: string; details: { text: string; isDash: boolean }[] }[] = [];
      while (i < lines.length) {
        const cur = lines[i].trim();
        if (!cur) { i++; continue; }
        const match = cur.match(/^(\d+)[.)]\s+(.*)/);
        if (match) {
          items.push({ num: match[1], text: match[2], details: [] });
          i++;
          while (i < lines.length) {
            const sub = lines[i].trim();
            if (!sub) { i++; continue; }
            if (/^\d+[.)]\s/.test(sub)) break;
            if (/^-\s/.test(sub)) {
              items[items.length - 1].details.push({ text: sub.replace(/^-\s+/, ""), isDash: true });
            } else {
              items[items.length - 1].details.push({ text: sub, isDash: false });
            }
            i++;
          }
        } else {
          break;
        }
      }
      elements.push(
        <ol key={`${keyPrefix}-ol-${i}`} className="mt-1 space-y-1">
          {items.map((item, idx) => (
            <li key={idx}>
              <div className="flex gap-2">
                <span className="text-muted-foreground shrink-0 tabular-nums min-w-[1.2em] text-right">{item.num}.</span>
                <span>{item.text}</span>
              </div>
              {item.details.length > 0 && (
                <div className="ml-[calc(1.2em+0.5rem)] mt-0.5 space-y-0.5">
                  {item.details.map((d, dIdx) => (
                    <div key={dIdx} className={d.isDash ? "flex gap-2 text-muted-foreground" : ""}>
                      {d.isDash && <span className="text-muted-foreground shrink-0">-</span>}
                      <span>{d.text}</span>
                    </div>
                  ))}
                </div>
              )}
            </li>
          ))}
        </ol>
      );
      continue;
    }

    // Regular text line
    elements.push(
      <p key={`${keyPrefix}-p-${i}`} className={elements.length > 0 ? "mt-1" : ""}>
        {trimmed}
      </p>
    );
    i++;
  }

  return elements;
}

/**
 * Renders assistant message content with formatted bullet points, numbered lists, and data tables.
 * Splits plain text into visual blocks: headings, bullets, numbered items, tables, and paragraphs.
 *
 * Tables are denoted by [TABLE]...[/TABLE] blocks with pipe-delimited rows.
 */
function FormattedMessage({ content }: { content: string }) {
  // Split content by [TABLE]...[/TABLE] blocks
  const parts = content.split(/\[TABLE\]|\[\/TABLE\]/i);
  const elements: React.ReactNode[] = [];

  // Determine which parts are table blocks vs text.
  // After splitting by [TABLE] and [/TABLE], the pattern is:
  // text, tableContent, text, tableContent, ...
  // The first part is always text, then alternates.
  let isTable = false;
  for (let pIdx = 0; pIdx < parts.length; pIdx++) {
    const part = parts[pIdx];

    if (isTable) {
      // Try to parse as a table
      const tableData = parseTable(part);
      if (tableData) {
        elements.push(<DataTable key={`table-${pIdx}`} headers={tableData.headers} rows={tableData.rows} />);
      } else {
        // Fallback: may still be a markdown pipe table, or plain text
        elements.push(...renderSegmentsWithMarkdownTables(part, `tf-${pIdx}`));
      }
    } else {
      const trimmedPart = part.trim();
      if (trimmedPart) {
        elements.push(...renderSegmentsWithMarkdownTables(part, `s-${pIdx}`));
      }
    }

    isTable = !isTable;
  }

  return <>{elements}</>;
}

const SUGGESTIONS_GROUP_A = [
  "When is course registration for new and returning students (Group A)?",
  "When is registered course validation / confirmation (Group A)?",
  "When is late add/drop outside normal period (Group A)?",
  "When is the fee payment deadline (Group A)?",
  "When are GT and GT2 (Group A)?",
  "When is RPGT and when are results out (Group A)?",
  "When does Lecture 1 start and end (Group A)?",
  "When are Lectures 2–5 (Group A)?",
  "How many lecture weeks in this session (Group A)?",
  "Show the full lecture timeline (Group A).",
  "When is mid-semester break (Group A)?",
  "When is Aidil Fitri special break (Group A)?",
  "When is revision week (Group A)?",
  "When is semester break (Group A)?",
  "When is midterm exam (Group A)?",
  "When is final exam (Group A)?",
  "When can students print the exam slip (Group A)?",
  "List all exam-related dates (Group A).",
  "What is MDS and when is it (Group A)?",
  "What is SuFO and when must it be done (Group A)?",
];

const SUGGESTIONS_GROUP_B = [
  "When is ePJJ/PLK new student registration (Group B)?",
  "When is bachelor's course registration (Group B)?",
  "When is Pre-Diploma/Diploma registration (Group B)?",
  "When is registered course validation (Group B)?",
  "When is late add/drop outside normal period (Group B)?",
  "When are fee deadline, GT, RPGT, and GT2 (Group B)?",
  "When does Lecture 1 start and end (Group B)?",
  "When are Lectures 2 and 3 (Group B)?",
  "When is Short Semester (Group B)?",
  "When are Intersession Classes (Group B)?",
  "When is mid-semester break / festive break (Group B)?",
  "When is revision week (Group B)?",
  "When is semester break (Group B)?",
  "Do break dates differ for Kedah, Kelantan, and Terengganu (Group B)?",
  "When is EET Speaking (Group B)?",
  "When are final assessment / written EET (Group B)?",
  "When can students print the exam slip (Group B)?",
  "List all exam-related dates (Group B).",
  "What is MDS and when is it (Group B)?",
  "What is SuFO and when must it be done (Group B)?",
];

const SUGGESTIONS_GENERAL = [
  "List all UiTM campuses",
  "What courses does UiTM offer?",
  "Apa itu program Asasi UiTM?",
  "How many faculties in UiTM?",
  "What is MDS programme?",
  "Apa syarat masuk Diploma?",
  "Tell me about UiTM Shah Alam",
  "Apa itu e-PJJ UiTM?",
  "Senarai fakulti UiTM",
  "When does Semester 1 start for Group B?",
  "When is Hari Raya break?",
  "Bila pendaftaran kursus dibuka?",
  "What programs are in Group A?",
  "What programs are in Group B?",
];

const LOADING_PHRASES = [
  "Searching calendar data...",
  "Checking your schedule...",
  "Looking up dates...",
  "Analyzing academic calendar...",
  "Finding the answer...",
  "Menyemak jadual akademik...",
  "Mencari maklumat...",
  "Menyusun jawapan...",
  "Reviewing semester info...",
  "Scanning timetable...",
];

const FETCH_TIMEOUT_MS = 60_000;
const RETRY_DELAYS_MS = [400, 800, 1600];
const CHAT_TURNSTILE_COOKIE = "chat_turnstile_verified";

function getRandomLoadingPhrase(exclude?: string): string {
  const available = LOADING_PHRASES.filter((p) => p !== exclude);
  return available[Math.floor(Math.random() * available.length)];
}

function getProgramGroup(program: string): "A" | "B" {
  if (program === "Foundation/Professional") return "A";
  return "B";
}

function getSessionMemoryKey(program: ProgramValue): ProgramValue {
  return getProgramGroup(program) === "B" ? ("All" as ProgramValue) : program;
}

type ProgramSessionMap = Partial<Record<ProgramValue, SessionId[]>>;

function normalizeSessionsForGroup(sessionIds: SessionId[], group: "A" | "B"): SessionId[] {
  const unique = Array.from(new Set(sessionIds));
  return unique.filter((id) => getGroupFromSession(id) === group);
}

function areSessionListsEqual(left: SessionId[], right: SessionId[]): boolean {
  if (left.length !== right.length) return false;
  return left.every((id, index) => right[index] === id);
}

function resolveSessionsForProgram(
  program: ProgramValue,
  sessionCandidates: SessionId[],
  sessionsByProgram: ProgramSessionMap,
  dateStr: string
): SessionId[] {
  const group = getProgramGroup(program);
  const sessionMemoryKey = getSessionMemoryKey(program);
  const fromCandidates = normalizeSessionsForGroup(sessionCandidates, group);
  if (fromCandidates.length > 0) return fromCandidates;

  const fromProgramMemory = normalizeSessionsForGroup(sessionsByProgram[sessionMemoryKey] ?? [], group);
  if (fromProgramMemory.length > 0) return fromProgramMemory;

  return [getSessionForCurrentDate(group, dateStr)];
}

function normalizeEntriesFromSessionMap(
  raw: Partial<Record<ProgramValue, SessionId[]>> | null | undefined
): ProgramSessionMap {
  const normalized: ProgramSessionMap = {};
  if (!raw || typeof raw !== "object") return normalized;
  for (const [programKey, sessionIds] of Object.entries(raw)) {
    if (!Array.isArray(sessionIds) || sessionIds.length === 0) continue;
    const program = programKey as ProgramValue;
    const group = getProgramGroup(program);
    const inGroup = normalizeSessionsForGroup(sessionIds, group);
    if (inGroup.length > 0) normalized[getSessionMemoryKey(program)] = inGroup;
  }
  return normalized;
}

/** Prefer `calendar-filters` cookie (homepage / SSR), then localStorage. */
function mergeSessionMapsFromHomepage(
  fromLocal: Partial<Record<ProgramValue, SessionId[]>> | null,
  filters: FilterStates
): ProgramSessionMap {
  const localNorm = normalizeEntriesFromSessionMap(fromLocal);
  const cookieNorm = normalizeEntriesFromSessionMap(filters.sessionIdsByProgram ?? null);
  const merged: ProgramSessionMap = { ...localNorm, ...cookieNorm };

  if (filters.sessionIds && filters.sessionIds.length > 0) {
    const prog =
      filters.selectedProgram && isProgramValue(filters.selectedProgram)
        ? filters.selectedProgram
        : "All";
    const memKey = getSessionMemoryKey(prog);
    const group = getProgramGroup(prog);
    const ids = normalizeSessionsForGroup(filters.sessionIds as SessionId[], group);
    if (ids.length > 0 && (!merged[memKey] || merged[memKey]!.length === 0)) {
      merged[memKey] = ids;
    }
  }

  return merged;
}

function getRandomSuggestions(group: "A" | "B", exclude: string[]): string[] {
  const groupPool = group === "A" ? SUGGESTIONS_GROUP_A : SUGGESTIONS_GROUP_B;
  const combined = [...groupPool, ...SUGGESTIONS_GENERAL];
  const available = combined.filter((s) => !exclude.includes(s));
  const pool = available.length >= 5 ? available : combined;
  const shuffled = [...pool].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, 5);
}

const MAX_HISTORY_CONTENT_LENGTH = 2000;
const MAX_HISTORY_ITEMS = 4;

function prepareHistory(messages: Message[]): { role: "user" | "assistant"; content: string }[] {
  return messages
    .slice(-MAX_HISTORY_ITEMS)
    .map((msg) => ({
      role: msg.role,
      content: msg.content.slice(0, MAX_HISTORY_CONTENT_LENGTH),
    }));
}

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp?: number;
}

interface MentionMatch {
  start: number;
  end: number;
  query: string;
}

interface MentionItem {
  id: SessionId;
  label: string;
  text: string;
}

function formatTime24(timestamp: number): string {
  const d = new Date(timestamp);
  return d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false });
}

function getInitialChatSessions(program: string): SessionId[] {
  const group: "A" | "B" = program === "Foundation/Professional" ? "A" : "B";
  const dateStr =
    typeof window !== "undefined" ? new Date().toISOString().slice(0, 10) : "2026-03-15";
  return [getSessionForCurrentDate(group, dateStr)];
}

function getActiveMentionMatch(value: string, caretIndex: number): MentionMatch | null {
  if (caretIndex < 0) return null;
  const prefix = value.slice(0, caretIndex);
  const atIndex = prefix.lastIndexOf("@");
  if (atIndex < 0) return null;
  const charBefore = atIndex > 0 ? prefix[atIndex - 1] : "";
  const isBoundary = atIndex === 0 || /\s/.test(charBefore);
  if (!isBoundary) return null;
  const query = prefix.slice(atIndex + 1);
  if (/\s/.test(query)) return null;
  return { start: atIndex, end: caretIndex, query };
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export default function ChatPage() {
  const hydrationServerVersion = useCalendarHydrationVersion();
  useSyncExternalStore(
    subscribe,
    () => getSnapshot().version,
    () => hydrationServerVersion
  );

  const router = useRouter();
  const programOptions = getProgramOptions();
  const calendarDataVersion = getSnapshot().version;
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [turnstileToken, setTurnstileToken] = useState("");
  const [turnstileNonce, setTurnstileNonce] = useState(0);
  const [isTurnstileSessionVerified, setIsTurnstileSessionVerified] = useState(false);
  const [selectedProgram, setSelectedProgram] = useState<ProgramValue>("All");
  const [selectedSessions, setSelectedSessions] = useState<SessionId[]>(() =>
    getInitialChatSessions("All")
  );
  const [sessionsByProgram, setSessionsByProgram] = useState<ProgramSessionMap>(() => ({
    All: getInitialChatSessions("All"),
  }));
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [activeSubmenu, setActiveSubmenu] = useState<string | null>(null);
  const keepDropdownOpenRef = useRef(false);
  const [isLoading, setIsLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [headerVisible, setHeaderVisible] = useState(true);
  const [reactions, setReactions] = useState<Record<string, "up" | "down" | null>>({});
  const currentGroup = getProgramGroup(selectedProgram);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [isMentionOpen, setIsMentionOpen] = useState(false);
  const [mentionQuery, setMentionQuery] = useState("");
  const [activeMentionIndex, setActiveMentionIndex] = useState(0);
  const [mentionMatch, setMentionMatch] = useState<MentionMatch | null>(null);
  const [isMobileMentionPicker, setIsMobileMentionPicker] = useState(false);

  const isProduction = process.env.NODE_ENV === "production";
  const turnstileSiteKey = isProduction ? (process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "") : "";
  const requiresTurnstile = Boolean(turnstileSiteKey) && !isTurnstileSessionVerified;

  useEffect(() => {
    if (typeof document === "undefined") return;
    const hasVerifiedCookie = document.cookie
      .split(";")
      .some((item) => item.trim().startsWith(`${CHAT_TURNSTILE_COOKIE}=1`));
    if (hasVerifiedCookie) setIsTurnstileSessionVerified(true);
  }, []);

  const hydrateChatFromHomepageSources = useCallback(() => {
    if (typeof window === "undefined") return;
    try {
      const filters = getFiltersFromCookie();
      const raw =
        localStorage.getItem("sessionIdsByProgram") ??
        localStorage.getItem("chatSessionIdsByProgram");
      const parsed = raw
        ? (JSON.parse(raw) as Partial<Record<ProgramValue, SessionId[]>>)
        : null;

      const merged = mergeSessionMapsFromHomepage(parsed, filters);
      const dateStr = new Date().toISOString().slice(0, 10);
      const mergedMap: ProgramSessionMap = {
        All: getInitialChatSessions("All"),
        ...merged,
      };

      const storedProgram = localStorage.getItem("selectedProgram");
      const nextProgram: ProgramValue =
        filters.selectedProgram && isProgramValue(filters.selectedProgram)
          ? filters.selectedProgram
          : storedProgram && isProgramValue(storedProgram)
            ? storedProgram
            : "All";

      const resolvedSessions = resolveSessionsForProgram(
        nextProgram,
        [],
        mergedMap,
        dateStr
      );
      setSessionsByProgram(mergedMap);
      setSelectedProgram(nextProgram);
      setSelectedSessions(resolvedSessions);
    } catch {
      // Ignore parse errors and continue with defaults.
    }
  }, []);

  useEffect(() => {
    hydrateChatFromHomepageSources();
  }, [hydrateChatFromHomepageSources, calendarDataVersion]);

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible") hydrateChatFromHomepageSources();
    };
    const onStorage = (e: StorageEvent) => {
      if (e.key === "sessionIdsByProgram" || e.key === "selectedProgram") {
        hydrateChatFromHomepageSources();
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("storage", onStorage);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("storage", onStorage);
    };
  }, [hydrateChatFromHomepageSources]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      localStorage.setItem("sessionIdsByProgram", JSON.stringify(sessionsByProgram));
      localStorage.setItem("chatSessionIdsByProgram", JSON.stringify(sessionsByProgram));
    } catch {
      // Ignore storage errors (private mode / quota).
    }
  }, [sessionsByProgram]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      localStorage.setItem("selectedProgram", selectedProgram);
    } catch {
      // Ignore storage errors (private mode / quota).
    }
  }, [selectedProgram]);

  useEffect(() => {
    router.prefetch(getRoutePath(selectedProgram, "grid"));
    router.prefetch(getRoutePath(selectedProgram, "list"));
  }, [router, selectedProgram]);

  // Sync selectedSessions when program changes using per-program memory.
  useEffect(() => {
    const dateStr =
      typeof window !== "undefined" ? new Date().toISOString().slice(0, 10) : "2026-03-15";
    setSelectedSessions((prev) => {
      const resolved = resolveSessionsForProgram(
        selectedProgram,
        [],
        sessionsByProgram,
        dateStr
      );
      return areSessionListsEqual(prev, resolved) ? prev : resolved;
    });
  }, [selectedProgram, sessionsByProgram]);

  // Randomize suggestions on mount and when program/group changes
  useLayoutEffect(() => {
    setSuggestions(getRandomSuggestions(currentGroup, []));
  }, [currentGroup]);
  const [loadingPhrase, setLoadingPhrase] = useState("");

  const handleSessionToggle = useCallback(
    (programValue: ProgramValue, sessionId: SessionId, group: "A" | "B") => {
      const dateStr =
        typeof window !== "undefined" ? new Date().toISOString().slice(0, 10) : "2026-03-15";
      setSelectedProgram(programValue);
      setSelectedSessions((prev) => {
        const baseSessions = resolveSessionsForProgram(
          programValue,
          [],
          sessionsByProgram,
          dateStr
        );
        const inGroup = baseSessions.filter((id) => id.startsWith(`${group}-`));
        const isSelected = inGroup.includes(sessionId);
        if (isSelected && inGroup.length > 1) {
          const next = inGroup.filter((id) => id !== sessionId);
          const sessionMemoryKey = getSessionMemoryKey(programValue);
          setSessionsByProgram((prevMap) => ({ ...prevMap, [sessionMemoryKey]: next }));
          return next;
        }
        if (!isSelected) {
          const next = [...inGroup, sessionId];
          const sessionMemoryKey = getSessionMemoryKey(programValue);
          setSessionsByProgram((prevMap) => ({ ...prevMap, [sessionMemoryKey]: next }));
          return next;
        }
        const sessionMemoryKey = getSessionMemoryKey(programValue);
        setSessionsByProgram((prevMap) => ({ ...prevMap, [sessionMemoryKey]: inGroup }));
        return inGroup;
      });
    },
    [sessionsByProgram]
  );

  const handleProgramSelect = useCallback((program: ProgramValue) => {
    const dateStr =
      typeof window !== "undefined" ? new Date().toISOString().slice(0, 10) : "2026-03-15";
    setSelectedProgram(program);
    const resolved = resolveSessionsForProgram(program, [], sessionsByProgram, dateStr);
    setSelectedSessions(resolved);
  }, [sessionsByProgram]);

  const currentProgramLabel = useMemo(() => {
    const opt = programOptions.find((p) => p.value === selectedProgram);
    return opt?.label ?? "All";
  }, [selectedProgram, programOptions]);
  const [disclaimerIndex, setDisclaimerIndex] = useState(0);
  const [disclaimerFade, setDisclaimerFade] = useState<"in" | "out">("in");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const turnstileRef = useRef<TurnstileWidgetHandle>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const lastScrollTop = useRef(0);
  const groupAOptions = useMemo(() => programOptions.filter(p => p.group === 'A'), [programOptions]);
  const groupBOptions = useMemo(() => programOptions.filter(p => p.group === 'B'), [programOptions]);
  const groupBProgramForSessions = groupBOptions.some((p) => p.value === selectedProgram)
    ? selectedProgram
    : ("All" as ProgramValue);
  const groupBSessionLabel = useMemo(() => {
    void calendarDataVersion;
    if (currentGroup === "A") return "";
    const labels = selectedSessions
      .filter((sessionId) => sessionId.startsWith("B-"))
      .map((sessionId) => {
        const session = getSessionOptionsForGroup("B").find((item) => item.id === sessionId);
        return session ? formatSessionLabelWithId(session) : sessionId;
      });
    if (labels.length === 0) return "Select sessions";
    if (labels.length === 1) return labels[0];
    return `${labels.length} Selected`;
  }, [currentGroup, selectedSessions, calendarDataVersion]);
  const [emblaRef] = useEmblaCarousel({ dragFree: true, containScroll: "trimSnaps", align: "center" });
  const allMentionTexts = useMemo(() => {
    const groupA = getSessionOptionsForGroup("A").map((session) => formatSessionLabelWithId(session));
    const groupB = getSessionOptionsForGroup("B").map((session) => formatSessionLabelWithId(session));
    return [...groupA, ...groupB].sort((left, right) => right.length - left.length);
  }, [calendarDataVersion]);

  const mentionHighlightPattern = useMemo(() => {
    if (allMentionTexts.length === 0) return null;
    const escaped = allMentionTexts.map((item) => escapeRegExp(item));
    return new RegExp(`(${escaped.join("|")})`, "g");
  }, [allMentionTexts]);
  const mentionItems = useMemo<MentionItem[]>(() => {
    const sessions = getSessionOptionsForGroup(currentGroup);
    const normalizedQuery = mentionQuery.trim().toLowerCase();
    const mapped = sessions.map((session) => ({
      id: session.id,
      label: session.label,
      text: formatSessionLabelWithId(session),
    }));
    if (!normalizedQuery) return mapped;
    return mapped.filter((item) => {
      const haystack = `${item.label} ${item.id} ${item.text}`.toLowerCase();
      return haystack.includes(normalizedQuery);
    });
  }, [currentGroup, mentionQuery, calendarDataVersion]);

  // Auto-resize textarea to fit content up to max height
  const adjustTextareaHeight = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 130)}px`;
  }, []);

  const handleMentionSelect = useCallback((item: MentionItem) => {
    const textarea = textareaRef.current;
    if (!textarea || !mentionMatch) return;
    const nextValue = `${input.slice(0, mentionMatch.start)}${item.text} ${input.slice(mentionMatch.end)}`;
    const nextCaret = mentionMatch.start + item.text.length + 1;
    setInput(nextValue);
    setIsMentionOpen(false);
    setMentionMatch(null);
    setMentionQuery("");
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(nextCaret, nextCaret);
      adjustTextareaHeight();
    }, 0);
  }, [input, mentionMatch, adjustTextareaHeight]);

  const lastUserMsgId = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === "user") return messages[i].id;
    }
    return null;
  }, [messages]);

  const disclaimerTexts = useMemo(() => [
    "AI can make mistakes. Check important info.",
    "Free-tier AI model with daily rate limits.",
  ], []);

  // Rotate disclaimer text every 8 seconds with fade animation
  useEffect(() => {
    const interval = setInterval(() => {
      setDisclaimerFade("out");
      setTimeout(() => {
        setDisclaimerIndex((prev) => (prev + 1) % disclaimerTexts.length);
        setDisclaimerFade("in");
      }, 600);
    }, 8000);
    return () => clearInterval(interval);
  }, [disclaimerTexts.length]);

  // Rotate loading phrases while waiting for AI response
  useEffect(() => {
    if (!isLoading) {
      setLoadingPhrase("");
      return;
    }
    setLoadingPhrase(getRandomLoadingPhrase());
    const interval = setInterval(() => {
      setLoadingPhrase((prev) => getRandomLoadingPhrase(prev));
    }, 3000);
    return () => clearInterval(interval);
  }, [isLoading]);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  useEffect(() => {
    adjustTextareaHeight();
  }, [input, adjustTextareaHeight]);

  const handleScroll = useCallback(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const currentScrollTop = el.scrollTop;
    if (dropdownOpen) {
      setDropdownOpen(false);
      setActiveSubmenu(null);
    }
    // Show header when scrolling up or near top
    if (currentScrollTop <= 10 || currentScrollTop < lastScrollTop.current) {
      setHeaderVisible(true);
    } else if (currentScrollTop > lastScrollTop.current) {
      setHeaderVisible(false);
    }
    lastScrollTop.current = currentScrollTop;
  }, [dropdownOpen]);

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || isLoading) return;
    if (requiresTurnstile && !turnstileToken.trim()) {
      turnstileRef.current?.execute();
      return;
    }
    if (requiresTurnstile) setIsTurnstileSessionVerified(true);

    const now = Date.now();
    const userMessage: Message = {
      id: now.toString(),
      role: "user",
      content: text.trim(),
      timestamp: now,
    };

    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    setInput("");
    setIsLoading(true);
    let didAttemptFetch = false;

    try {
      if (typeof navigator !== "undefined" && !navigator.onLine) {
        const offlineNow = Date.now();
        setMessages((prev) => [
          ...prev,
          {
            id: (offlineNow + 1).toString(),
            role: "assistant",
            content:
              "Tiada sambungan internet. Semak rangkaian anda dan cuba lagi. / No internet connection. Check your network and try again.",
            timestamp: offlineNow,
          },
        ]);
        return;
      }

      didAttemptFetch = true;
      const history = prepareHistory(messages);

      const body = JSON.stringify({
        message: text.trim(),
        program: selectedProgram,
        selectedSessions,
        history,
        turnstileToken: requiresTurnstile ? turnstileToken : undefined,
      });
      let content: string | null = null;
      let maxAttempts = 2;
      const isRetryableStatus = (s: number) =>
        s === 500 || s === 502 || s === 503 || s === 504;

      for (let attempt = 0; attempt < maxAttempts; attempt++) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
        try {
          const res = await fetch("/chat/api", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body,
            signal: controller.signal,
          });
          clearTimeout(timeoutId);

          const data = await parseChatResponse(res);

          if (!res.ok) {
            content = data.error || getChatErrorMessage(res, "Something went wrong. Please try again.");
            if (res.status === 503 && maxAttempts === 3) {
              maxAttempts = 4;
            }
            if (isRetryableStatus(res.status) && attempt < maxAttempts - 1) {
              await new Promise((r) =>
                setTimeout(
                  r,
                  RETRY_DELAYS_MS[Math.min(attempt, RETRY_DELAYS_MS.length - 1)]
                )
              );
              continue;
            }
          } else {
            content = data.reply || "Sorry, I could not get a response.";
            setIsTurnstileSessionVerified(true);
          }
          break;
        } catch (err) {
          clearTimeout(timeoutId);
          const isAbort = err instanceof Error && err.name === "AbortError";
          content = isAbort
            ? "Request timed out. Please try again."
            : "Something went wrong. Please try again.";
          if (attempt < maxAttempts - 1) {
            await new Promise((r) => setTimeout(r, RETRY_DELAYS_MS[attempt]));
            continue;
          }
          break;
        }
      }

      const assistantNow = Date.now();
      const assistantMessage: Message = {
        id: (assistantNow + 1).toString(),
        role: "assistant",
        content: content || "Something went wrong. Please try again.",
        timestamp: assistantNow,
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch {
      const errorNow = Date.now();
      const errorMessage: Message = {
        id: (errorNow + 1).toString(),
        role: "assistant",
        content: "Something went wrong. Please try again.",
        timestamp: errorNow,
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  }, [
    isLoading,
    isTurnstileSessionVerified,
    messages,
    requiresTurnstile,
    selectedProgram,
    selectedSessions,
    turnstileToken,
  ]);

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    await sendMessage(input);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (isMentionOpen) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        if (mentionItems.length === 0) return;
        setActiveMentionIndex((prev) => (prev + 1) % mentionItems.length);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        if (mentionItems.length === 0) return;
        setActiveMentionIndex((prev) => (prev - 1 + mentionItems.length) % mentionItems.length);
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        setIsMentionOpen(false);
        return;
      }
      if ((e.key === "Enter" || e.key === "Tab") && mentionItems.length > 0) {
        e.preventDefault();
        const target = mentionItems[activeMentionIndex] ?? mentionItems[0];
        if (!target) return;
        handleMentionSelect(target);
        return;
      }
    }
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const updateMentionState = useCallback((value: string, caretIndex: number | null) => {
    if (caretIndex == null) {
      setIsMentionOpen(false);
      setMentionMatch(null);
      setMentionQuery("");
      return;
    }
    const match = getActiveMentionMatch(value, caretIndex);
    if (!match) {
      setIsMentionOpen(false);
      setMentionMatch(null);
      setMentionQuery("");
      return;
    }
    setMentionMatch(match);
    setMentionQuery(match.query);
    setActiveMentionIndex(0);
    setIsMentionOpen(true);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const media = window.matchMedia("(max-width: 768px)");
    const sync = () => setIsMobileMentionPicker(media.matches);
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);
  const mentionHighlightParts = useMemo(() => {
    if (!mentionHighlightPattern || !input) return [{ text: input, isMention: false }];
    const parts: { text: string; isMention: boolean }[] = [];
    let lastIndex = 0;
    input.replace(mentionHighlightPattern, (match, _group, offset) => {
      if (offset > lastIndex) parts.push({ text: input.slice(lastIndex, offset), isMention: false });
      parts.push({ text: match, isMention: true });
      lastIndex = offset + match.length;
      return match;
    });
    if (lastIndex < input.length) parts.push({ text: input.slice(lastIndex), isMention: false });
    return parts;
  }, [input, mentionHighlightPattern]);

  useEffect(() => {
    if (!isMentionOpen) return;
    if (mentionItems.length === 0) {
      setActiveMentionIndex(0);
      return;
    }
    if (activeMentionIndex <= mentionItems.length - 1) return;
    setActiveMentionIndex(0);
  }, [isMentionOpen, mentionItems, activeMentionIndex]);

  const handleCopy = async (msgId: string, content: string) => {
    try {
      await navigator.clipboard.writeText(content);
      setCopiedId(msgId);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      // Fallback: ignore if clipboard API fails
    }
  };

  const handleReaction = (msgId: string, type: "up" | "down") => {
    setReactions((prev) => ({
      ...prev,
      [msgId]: prev[msgId] === type ? null : type,
    }));
  };

  const handleDelete = useCallback((msgId: string) => {
    const msgIndex = messages.findIndex((m) => m.id === msgId);
    if (msgIndex === -1) return;
    setMessages(messages.slice(0, msgIndex));
  }, [messages]);

  const handleEdit = useCallback((msgId: string) => {
    const msgIndex = messages.findIndex((m) => m.id === msgId);
    if (msgIndex === -1) return;
    const msg = messages[msgIndex];
    setInput(msg.content);
    setMessages(messages.slice(0, msgIndex));
    setTimeout(() => {
      textareaRef.current?.focus();
      scrollToBottom();
    }, 100);
  }, [messages, scrollToBottom]);

  return (
    <div className="relative flex flex-col h-dvh bg-background text-foreground">
      {/* Top fade - always visible, independent of header scroll */}
      <div className="chat-top-fade absolute top-0 left-0 right-0 z-[9] pointer-events-none" />

      {/* Header - overlays on top of chat area */}
      <div className={`chat-header absolute top-0 left-0 right-0 z-10 px-4 md:px-0 ${headerVisible ? "translate-y-0" : "-translate-y-full"}`}>
        <header className="flex items-center gap-3 pt-8 pb-3 mx-auto max-w-[600px] w-full">
          <button
            onClick={() => router.push(getRoutePath(selectedProgram, "grid"))}
            className="flex items-center justify-center w-9 h-9 rounded-full bg-secondary hover:bg-secondary/80 dark:bg-[#2A2A2A] dark:hover:bg-[#333] transition-colors"
            aria-label="Back to home"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
        </header>
      </div>

      {/* Chat messages area */}
      <div ref={scrollContainerRef} onScroll={handleScroll} className="flex-1 overflow-y-auto px-4 md:px-0 pt-0 pb-6">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-4 text-center mx-auto max-w-[600px]">
            <div>
              <h2 className="text-2xl font-semibold mb-1">Bila UiTM Cuti?</h2>
              <p className="text-sm text-muted-foreground max-w-xs">
                Ask about the UiTM academic calendar. Select your program and start.
              </p>
              <p className="text-sm text-muted-foreground max-w-xs">
                Use @ to mention a calendar session.
              </p>
            </div>
            {requiresTurnstile ? (
              <div className="w-full max-w-[320px] px-3">
                <TurnstileWidget
                  ref={turnstileRef}
                  key={turnstileNonce}
                  siteKey={turnstileSiteKey}
                  action="chat_message"
                  onToken={setTurnstileToken}
                />
              </div>
            ) : null}
          </div>
        ) : (
          <div className="mx-auto max-w-[600px] space-y-6 pt-14">
            {requiresTurnstile ? (
              <div className="w-full max-w-[320px]">
                <TurnstileWidget
                  ref={turnstileRef}
                  key={turnstileNonce}
                  siteKey={turnstileSiteKey}
                  action="chat_message"
                  onToken={setTurnstileToken}
                />
              </div>
            ) : null}
            {messages.map((msg) => (
              <div key={msg.id} className="space-y-1">
                <div
                  className={`flex ${
                    msg.role === "user" ? "justify-end" : "justify-start"
                  }`}
                >
                  {msg.role === "user" ? (
                    <ContextMenu>
                      <ContextMenuTrigger asChild>
                        <div
                          className="max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed bg-primary text-primary-foreground rounded-br-md whitespace-pre-wrap cursor-context-menu select-none"
                        >
                          <div>{msg.content}</div>
                          <div className="text-right text-xs opacity-80 mt-1">
                            {formatTime24((msg.timestamp ?? parseInt(msg.id, 10)) || Date.now())}
                          </div>
                        </div>
                      </ContextMenuTrigger>
                      <ContextMenuContent className="w-fit max-w-[200px]">
                        {msg.id === lastUserMsgId && (
                          <ContextMenuItem onClick={() => handleEdit(msg.id)}>
                            <Pencil className="w-3.5 h-3.5 mr-2" />
                            Edit
                          </ContextMenuItem>
                        )}
                        <ContextMenuItem onClick={() => handleCopy(msg.id, msg.content)}>
                          <Copy className="w-3.5 h-3.5 mr-2" />
                          Copy
                        </ContextMenuItem>
                        <ContextMenuItem onClick={() => handleDelete(msg.id)}>
                          <Trash2 className="w-3.5 h-3.5 mr-2" />
                          Delete
                        </ContextMenuItem>
                      </ContextMenuContent>
                    </ContextMenu>
                  ) : (
                    <div
                      className="max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed bg-secondary dark:bg-[#2A2A2A] text-foreground rounded-bl-md"
                    >
                      <FormattedMessage content={msg.content} />
                      <div className="text-right text-xs text-muted-foreground mt-1">
                        {formatTime24((msg.timestamp ?? parseInt(msg.id, 10)) || Date.now())}
                      </div>
                    </div>
                  )}
                </div>
                {msg.role === "assistant" && (
                  <div className="flex gap-1">
                    <button
                      onClick={() => handleCopy(msg.id, msg.content)}
                      className="flex items-center justify-center w-7 h-7 rounded-md hover:bg-secondary dark:hover:bg-[#2A2A2A] text-muted-foreground hover:text-foreground transition-colors"
                      aria-label="Copy answer"
                    >
                      {copiedId === msg.id ? (
                        <Check className="w-3.5 h-3.5 text-blue-500" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>
                    <button
                      onClick={() => handleReaction(msg.id, "up")}
                      className={`flex items-center justify-center w-7 h-7 rounded-md hover:bg-secondary dark:hover:bg-[#2A2A2A] transition-colors active:scale-90 transition-transform duration-150 ${reactions[msg.id] === "up" ? "text-foreground" : "text-muted-foreground hover:text-foreground"}`}
                      aria-label="Thumbs up"
                    >
                      <ThumbsUp className={`w-3.5 h-3.5 ${reactions[msg.id] === "up" ? "fill-current" : ""}`} />
                    </button>
                    <button
                      onClick={() => handleReaction(msg.id, "down")}
                      className={`flex items-center justify-center w-7 h-7 rounded-md hover:bg-secondary dark:hover:bg-[#2A2A2A] transition-colors active:scale-90 transition-transform duration-150 ${reactions[msg.id] === "down" ? "text-foreground" : "text-muted-foreground hover:text-foreground"}`}
                      aria-label="Thumbs down"
                    >
                      <ThumbsDown className={`w-3.5 h-3.5 ${reactions[msg.id] === "down" ? "fill-current" : ""}`} />
                    </button>
                  </div>
                )}
              </div>
            ))}

            {isLoading && (
              <div className="flex flex-col items-start gap-1">
                <div className="bg-secondary dark:bg-[#2A2A2A] rounded-2xl rounded-bl-md px-4 py-3">
                  <div className="flex gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-muted-foreground/40 animate-bounce [animation-delay:0ms]" />
                    <span className="w-2 h-2 rounded-full bg-muted-foreground/40 animate-bounce [animation-delay:150ms]" />
                    <span className="w-2 h-2 rounded-full bg-muted-foreground/40 animate-bounce [animation-delay:300ms]" />
                  </div>
                </div>
                {loadingPhrase && (
                  <span className="text-xs text-muted-foreground pl-1 animate-pulse">
                    {loadingPhrase}
                  </span>
                )}
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Input area - prompt form like ChatGPT with dropdown inside textarea */}
      <div className="chat-input-area relative px-4 md:px-0 pt-1 lg:pt-0.5 pb-6">
        <div className="mx-auto max-w-[600px]">
          {/* Suggestion chips - swipeable carousel with edge fades */}
          {messages.length === 0 && (
            <div className="suggestions-carousel relative -mx-4 md:mx-0 mb-2">
              <div className="suggestions-fade-left" />
              <div className="suggestions-fade-right" />
              <div
                className="suggestions-swipe overflow-hidden"
                ref={emblaRef}
              >
                <div className="embla__container flex gap-2 px-6">
                  {suggestions.map((suggestion) => (
                    <button
                      key={suggestion}
                      type="button"
                      disabled={
                        (requiresTurnstile && !turnstileToken.trim()) || isLoading
                      }
                      onClick={() => sendMessage(suggestion)}
                      className="embla__slide flex-none text-xs px-3 py-1.5 rounded-full border border-border bg-secondary/50 hover:bg-secondary dark:bg-[#2A2A2A] dark:hover:bg-[#333] text-foreground transition-colors whitespace-nowrap disabled:opacity-40 disabled:pointer-events-none disabled:cursor-not-allowed"
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
          <form
            onSubmit={handleSubmit}
            className="relative rounded-[10px] border border-border bg-secondary dark:bg-[#2A2A2A] overflow-visible"
          >
            <div
              aria-hidden
              className="pointer-events-none absolute inset-x-0 top-0 z-0 whitespace-pre-wrap break-words px-4 pt-3 pb-1 text-sm leading-relaxed"
            >
              {mentionHighlightParts.map((part, index) =>
                part.isMention ? (
                  <span key={`mention-${index}`} className="text-transparent">
                    {part.text}
                  </span>
                ) : (
                  <span key={`plain-${index}`} className="text-transparent">
                    {part.text}
                  </span>
                )
              )}
            </div>
            {/* Auto-growing text input */}
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => {
                const nextValue = e.target.value;
                setInput(nextValue);
                updateMentionState(nextValue, e.target.selectionStart);
              }}
              onClick={(e) => updateMentionState(e.currentTarget.value, e.currentTarget.selectionStart)}
              onKeyUp={(e) => updateMentionState(e.currentTarget.value, e.currentTarget.selectionStart)}
              onKeyDown={handleKeyDown}
              placeholder="Ask anything about your schedule"
              disabled={isLoading}
              rows={1}
              className="chat-input relative z-10 w-full resize-none bg-transparent px-4 pt-3 pb-1 text-sm leading-relaxed placeholder:text-muted-foreground focus:outline-none disabled:opacity-50"
            />
            {isMobileMentionPicker ? (
              <Drawer open={isMentionOpen} onOpenChange={setIsMentionOpen}>
                <DrawerContent className="border border-zinc-300 bg-muted pb-[calc(env(safe-area-inset-bottom)+0.75rem)] ring-0 dark:border-zinc-700">
                  <DrawerHeader>
                    <DrawerTitle>Mention Session Calendar</DrawerTitle>
                    <DrawerDescription>Select a session to insert into your message.</DrawerDescription>
                  </DrawerHeader>
                  <div className="max-h-[55vh] overflow-auto space-y-2 px-2 pb-3">
                    {mentionItems.length > 0 ? (
                      mentionItems.map((item, index) => (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => handleMentionSelect(item)}
                          className={`flex w-full flex-col items-start rounded-md border border-border px-2 py-2 text-left text-sm text-secondary-foreground transition-colors focus-visible:outline-none focus-visible:ring-0 ${
                            index === activeMentionIndex ? "bg-secondary/80" : "bg-secondary md:hover:bg-secondary/80"
                          }`}
                        >
                          <span className="font-medium">{item.label}</span>
                          <span className="text-xs text-muted-foreground">{item.id}</span>
                        </button>
                      ))
                    ) : (
                      <div className="px-2 py-2 text-xs text-muted-foreground">No sessions found</div>
                    )}
                  </div>
                </DrawerContent>
              </Drawer>
            ) : (
              <Dialog open={isMentionOpen} onOpenChange={setIsMentionOpen}>
                <DialogContent className="max-w-md gap-3 border border-zinc-300 bg-muted p-3 ring-0 dark:border-zinc-700" showCloseButton={false}>
                  <DialogHeader>
                    <DialogTitle>Mention Session Calendar</DialogTitle>
                    <DialogDescription>Select a session to insert into your message.</DialogDescription>
                  </DialogHeader>
                  <div className="max-h-[320px] overflow-auto space-y-2">
                    {mentionItems.length > 0 ? (
                      mentionItems.map((item, index) => (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => handleMentionSelect(item)}
                          className={`flex w-full flex-col items-start rounded-md border border-border px-2 py-2 text-left text-sm text-secondary-foreground transition-colors focus-visible:outline-none focus-visible:ring-0 ${
                            index === activeMentionIndex ? "bg-secondary/80" : "bg-secondary md:hover:bg-secondary/80"
                          }`}
                        >
                          <span className="font-medium">{item.label}</span>
                          <span className="text-xs text-muted-foreground">{item.id}</span>
                        </button>
                      ))
                    ) : (
                      <div className="px-2 py-2 text-xs text-muted-foreground">No sessions found</div>
                    )}
                  </div>
                </DialogContent>
              </Dialog>
            )}

            {/* Bottom bar */}
            <div className="flex items-center justify-between px-3 py-2">
              {/* Program + Session dropdown (same structure as homepage) */}
              <DropdownMenu
                open={dropdownOpen}
                onOpenChange={(open) => {
                  if (!open && keepDropdownOpenRef.current) {
                    keepDropdownOpenRef.current = false;
                    setDropdownOpen(true);
                    return;
                  }
                  setDropdownOpen(open);
                  if (!open) setActiveSubmenu(null);
                }}
              >
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 min-w-0 max-w-[180px] sm:max-w-[260px] md:max-w-[300px] overflow-hidden text-xs border-none bg-transparent shadow-none px-2 gap-1 hover:!bg-transparent dark:hover:!bg-transparent rounded-lg font-medium"
                  >
                    <span className="block min-w-0 flex-1 truncate text-left">{currentProgramLabel}</span>
                    {dropdownOpen ? (
                      <ChevronUp className="size-4 opacity-50 flex-shrink-0" />
                    ) : (
                      <ChevronDown className="size-4 opacity-50 flex-shrink-0" />
                    )}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  className="min-w-[260px] overflow-visible pt-4 pb-4 pl-3 pr-3 bg-popover dark:bg-[#2A2A2A]"
                  align="start"
                >
                  <div className="-mx-1 px-1">
                    <div className="mb-2">
                      <div className="text-xs font-semibold text-muted-foreground mb-2 px-2">GROUP A</div>
                      {groupAOptions.map((opt) => {
                        const groupASessionSummary = formatGroupASessionTriggerLabel(
                          opt.value,
                          selectedProgram,
                          selectedSessions
                        );
                        return (
                        <DropdownMenuSub
                          key={opt.value}
                          open={activeSubmenu === opt.value}
                          onOpenChange={(open) => setActiveSubmenu(open ? opt.value : null)}
                        >
                          <DropdownMenuSubTrigger
                            className="relative w-full max-w-full min-w-0 cursor-pointer items-center justify-between gap-0 rounded-md px-2 py-1.5"
                            onSelect={(event) => {
                              keepDropdownOpenRef.current = true;
                              event.preventDefault();
                            }}
                          >
                            <div className="flex min-w-0 flex-1 flex-col gap-0.5 text-left">
                              <span
                                className={`min-w-0 truncate font-medium text-sm ${
                                  opt.value === selectedProgram ? "text-primary" : "text-foreground"
                                }`}
                              >
                                {opt.label}
                              </span>
                              {groupASessionSummary ? (
                                <span className="min-w-0 truncate text-xs text-muted-foreground leading-snug whitespace-nowrap">
                                  {groupASessionSummary}
                                </span>
                              ) : null}
                            </div>
                          </DropdownMenuSubTrigger>
                          <DropdownMenuPortal>
                            <DropdownMenuSubContent
                              collisionPadding={{ top: 8, right: 28, bottom: 8, left: 8 }}
                              className="min-w-[200px] bg-popover dark:bg-[#2A2A2A]"
                            >
                              {getSessionOptionsForGroup("A").map((sess) => {
                                const isSelected = selectedSessions.includes(sess.id);
                                return (
                                  <DropdownMenuItem
                                    key={sess.id}
                                    className={sessionSubmenuItemClass(isSelected)}
                                    onSelect={(event) => {
                                      keepDropdownOpenRef.current = true;
                                      event.preventDefault();
                                    }}
                                    onClick={() =>
                                      handleSessionToggle(opt.value as ProgramValue, sess.id, "A")
                                    }
                                  >
                                    <span
                                      className={`pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 flex size-3.5 shrink-0 items-center justify-center rounded-full border ${isSelected ? "border-primary bg-primary" : "border-muted-foreground"}`}
                                      aria-hidden
                                    />
                                    <SessionSubmenuItemLabel session={sess} />
                                  </DropdownMenuItem>
                                );
                              })}
                            </DropdownMenuSubContent>
                          </DropdownMenuPortal>
                        </DropdownMenuSub>
                        );
                      })}
                    </div>
                  </div>
                  <div className="my-2 h-px bg-border -mx-3 w-[calc(100%+1.5rem)]" />
                  <div className="-mx-1 px-1">
                    <div>
                      <div className="text-xs font-semibold text-muted-foreground mb-2 px-2">GROUP B</div>
                      <DropdownMenuSub
                        open={activeSubmenu === "group-b-sessions"}
                        onOpenChange={(open) => setActiveSubmenu(open ? "group-b-sessions" : null)}
                      >
                        <DropdownMenuSubTrigger
                          className="cursor-pointer items-start"
                          onSelect={(event) => {
                            keepDropdownOpenRef.current = true;
                            event.preventDefault();
                          }}
                        >
                          <div className="flex min-w-0 flex-1 flex-col gap-1 text-left pr-1">
                            <span className="font-medium text-sm">Sessions</span>
                            <span className="min-w-0 text-xs text-muted-foreground text-balance leading-snug">
                              {groupBSessionLabel}
                            </span>
                          </div>
                        </DropdownMenuSubTrigger>
                        <DropdownMenuPortal>
                          <DropdownMenuSubContent
                            collisionPadding={{ top: 8, right: 28, bottom: 8, left: 8 }}
                            className="min-w-[220px] bg-popover dark:bg-[#2A2A2A]"
                          >
                            {getSessionOptionsForGroup("B").map((sess) => {
                              const isSelected = selectedSessions.includes(sess.id);
                              return (
                                <DropdownMenuItem
                                  key={sess.id}
                                  className={sessionSubmenuItemClass(isSelected)}
                                  onSelect={(event) => {
                                    keepDropdownOpenRef.current = true;
                                    event.preventDefault();
                                  }}
                                  onClick={() =>
                                    handleSessionToggle(groupBProgramForSessions, sess.id, "B")
                                  }
                                >
                                  <span
                                    className={`pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 flex size-3.5 shrink-0 items-center justify-center rounded-full border ${isSelected ? "border-primary bg-primary" : "border-muted-foreground"}`}
                                    aria-hidden
                                  />
                                  <SessionSubmenuItemLabel session={sess} />
                                </DropdownMenuItem>
                              );
                            })}
                          </DropdownMenuSubContent>
                        </DropdownMenuPortal>
                      </DropdownMenuSub>
                      {/* Program list - direct click */}
                      {groupBOptions.map((opt, index) => (
                        <DropdownMenuItem
                          key={opt.value}
                          className={`relative cursor-pointer pr-8 font-medium bg-transparent data-[highlighted]:bg-transparent ${index === 0 ? "mt-2" : ""} ${opt.value === selectedProgram ? "text-primary data-[highlighted]:text-primary" : "text-foreground data-[highlighted]:text-foreground"}`}
                          onClick={() => {
                            setActiveSubmenu(null);
                            setDropdownOpen(false);
                            handleProgramSelect(opt.value as ProgramValue);
                          }}
                        >
                          {opt.label}
                          {opt.value === selectedProgram ? (
                            <span
                              className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 flex size-3.5 shrink-0 items-center justify-center rounded-full border border-primary bg-primary"
                              aria-hidden
                            />
                          ) : null}
                        </DropdownMenuItem>
                      ))}
                    </div>
                  </div>
                </DropdownMenuContent>
              </DropdownMenu>

              <div className="flex items-center gap-2">
                {/* Send button */}
                <button
                  type="submit"
                  disabled={
                    !input.trim() ||
                    isLoading ||
                    (requiresTurnstile && !turnstileToken.trim())
                  }
                  className="flex items-center justify-center w-8 h-8 rounded-full bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  aria-label="Send message"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </div>
          </form>
          <span
            key={disclaimerIndex}
            className={`block text-center text-xs text-muted-foreground mt-2 ${disclaimerFade === "in" ? "disclaimer-fade-in" : "disclaimer-fade-out"}`}
          >
            {disclaimerTexts[disclaimerIndex]}
          </span>
        </div>
      </div>
    </div>
  );
}
