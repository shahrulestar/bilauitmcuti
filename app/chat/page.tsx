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
import {
  areSessionListsEqual,
  getGroupFromProgram,
  getSessionMemoryKey,
  normalizeSessionsForGroup,
} from "@/lib/session-memory";
import { cn } from "@/lib/utils";
import { trackZarazEvent, ZARAZ_EVENTS } from "@/lib/zaraz";
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
  responsiveDialogContentClassName,
} from "@/components/ui/dialog";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerTitle,
  drawerBodyClassName,
  responsiveDrawerContentClassName,
  responsiveDrawerDescriptionClassName,
  responsiveDialogDescriptionClassName,
  responsiveDialogTitleClassName,
  responsiveDrawerBodyClassName,
} from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import {
  TurnstileWidget,
  type TurnstileWidgetHandle,
} from "@/components/turnstile-widget";
import { useTurnstileSiteKeyFromContext } from "@/components/turnstile-site-key-provider";
import { useEngagementPrompt } from "@/components/engagement-prompt-provider";
import { FormattedMessage } from "@/components/chat/formatted-message";
import { SuggestionCarousel } from "@/components/chat/suggestion-carousel";
import { useChatGreeting } from "@/components/chat/use-chat-greeting";
import { getRandomSuggestions } from "@/components/chat/suggestion-data";
import { useDesktopViewport } from "@/lib/use-mobile-viewport";
import {
  CHAT_TURNSTILE_COOKIE,
  FETCH_TIMEOUT_MS,
  RETRY_DELAYS_MS,
  escapeRegExp,
  formatTime24,
  getActiveMentionMatch,
  getChatErrorMessage,
  getRandomLoadingPhrase,
  consumeChatStream,
  LOADING_INDICATOR_DELAY_MS,
  MAX_CHAT_MESSAGE_LENGTH,
  parseChatResponse,
  prepareHistory,
  type ChatMessageItem,
  type MentionMatch,
} from "@/components/chat/chat-utils";
import {
  getInitialChatSessions,
  mergeSessionMapsFromHomepage,
  resolveSessionsForProgram,
  type ProgramSessionMap,
} from "@/lib/chat/session-state";

type Message = ChatMessageItem;

interface MentionItem {
  id: SessionId;
  label: string;
  text: string;
}

export default function ChatPage() {
  const hydrationServerVersion = useCalendarHydrationVersion();
  useSyncExternalStore(
    subscribe,
    () => getSnapshot().version,
    () => hydrationServerVersion
  );

  const router = useRouter();
  const { recordEngagementAction } = useEngagementPrompt();
  const chatGreeting = useChatGreeting();
  const isDesktopViewport = useDesktopViewport();
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
  const [feedbackSent, setFeedbackSent] = useState<Record<string, boolean>>({});
  const [feedbackError, setFeedbackError] = useState<string | null>(null);
  const currentGroup = getGroupFromProgram(selectedProgram);
  const suggestionGroup = useMemo((): "A" | "B" => {
    const opt = getProgramOptions().find((p) => p.value === selectedProgram);
    return opt?.group ?? getGroupFromProgram(selectedProgram);
  }, [selectedProgram, calendarDataVersion]);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [isMentionOpen, setIsMentionOpen] = useState(false);
  const [mentionQuery, setMentionQuery] = useState("");
  const [activeMentionIndex, setActiveMentionIndex] = useState(0);
  const [mentionMatch, setMentionMatch] = useState<MentionMatch | null>(null);
  const [isMobileMentionPicker, setIsMobileMentionPicker] = useState(false);

  const { siteKey: turnstileSiteKey, isReady: isTurnstileConfigReady } =
    useTurnstileSiteKeyFromContext();
  const requiresTurnstile = Boolean(turnstileSiteKey) && !isTurnstileSessionVerified;
  const waitForTurnstileConfig =
    process.env.NODE_ENV === "production" && !isTurnstileConfigReady;
  /** Hide widget as soon as Turnstile returns a token; keeps "Verifying..." off-screen during fetch. */
  const showTurnstileChallenge = requiresTurnstile && !turnstileToken.trim();

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

  // Randomize suggestions on mount and when program/group changes (pool follows programOptions.group)
  useLayoutEffect(() => {
    setSuggestions(getRandomSuggestions(suggestionGroup, []));
  }, [suggestionGroup]);
  const [loadingPhrase, setLoadingPhrase] = useState("");
  const [showThinkingIndicator, setShowThinkingIndicator] = useState(false);
  const thinkingDelayRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearThinkingDelay = useCallback(() => {
    if (thinkingDelayRef.current) {
      clearTimeout(thinkingDelayRef.current);
      thinkingDelayRef.current = null;
    }
  }, []);

  const startThinkingDelay = useCallback(() => {
    clearThinkingDelay();
    setShowThinkingIndicator(false);
    thinkingDelayRef.current = setTimeout(() => {
      setShowThinkingIndicator(true);
    }, LOADING_INDICATOR_DELAY_MS);
  }, [clearThinkingDelay]);

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
      recordEngagementAction("session_change");
    },
    [sessionsByProgram, recordEngagementAction]
  );

  const handleProgramSelect = useCallback((program: ProgramValue) => {
    const dateStr =
      typeof window !== "undefined" ? new Date().toISOString().slice(0, 10) : "2026-03-15";
    setSelectedProgram(program);
    const resolved = resolveSessionsForProgram(program, [], sessionsByProgram, dateStr);
    setSelectedSessions(resolved);
    recordEngagementAction("program_change");
  }, [sessionsByProgram, recordEngagementAction]);

  const currentProgramLabel = useMemo(() => {
    const opt = programOptions.find((p) => p.value === selectedProgram);
    return opt?.label ?? "All";
  }, [selectedProgram, programOptions]);
  const [disclaimerIndex, setDisclaimerIndex] = useState(0);
  const [disclaimerFade, setDisclaimerFade] = useState<"in" | "out">("in");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const hasScrolledRef = useRef(false);
  const wasStreamingRef = useRef(false);
  const streamingAssistantMessageRef = useRef<HTMLDivElement>(null);
  const scrollAssistantMessageToTopRef = useRef<() => void>(() => {});
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

  const assistantScrollTargetId = useMemo(() => {
    const streaming = messages.find(
      (m) => m.role === "assistant" && m.isComplete === false
    );
    if (streaming) return streaming.id;
    const last = messages[messages.length - 1];
    if (last?.role === "assistant") return last.id;
    return null;
  }, [messages]);

  const showThinkingUi = useMemo(
    () =>
      isLoading &&
      showThinkingIndicator &&
      !messages.some((m) => m.role === "assistant" && m.isComplete === false),
    [isLoading, showThinkingIndicator, messages]
  );

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

  // Rotate loading phrases while the delayed thinking indicator is visible
  useEffect(() => {
    if (!showThinkingIndicator) {
      setLoadingPhrase("");
      return;
    }
    setLoadingPhrase(getRandomLoadingPhrase());
    const interval = setInterval(() => {
      setLoadingPhrase((prev) => getRandomLoadingPhrase(prev));
    }, 3000);
    return () => clearInterval(interval);
  }, [showThinkingIndicator]);

  useEffect(() => () => clearThinkingDelay(), [clearThinkingDelay]);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  const scrollAssistantMessageToTop = useCallback(() => {
    if (hasScrolledRef.current) return;
    streamingAssistantMessageRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
    hasScrolledRef.current = true;
  }, []);

  useEffect(() => {
    scrollAssistantMessageToTopRef.current = scrollAssistantMessageToTop;
  }, [scrollAssistantMessageToTop]);

  useLayoutEffect(() => {
    const isStreaming = messages.some(
      (m) => m.role === "assistant" && m.isComplete === false
    );

    if (wasStreamingRef.current && !isStreaming) {
      hasScrolledRef.current = false;
    }
    wasStreamingRef.current = isStreaming;

    if (messages.length === 0) {
      hasScrolledRef.current = false;
      return;
    }

    const last = messages[messages.length - 1];

    if (last.role === "user") {
      hasScrolledRef.current = false;
      scrollToBottom();
      return;
    }

    if (isStreaming || last.role === "assistant") {
      scrollAssistantMessageToTop();
    }
  }, [messages, scrollToBottom, scrollAssistantMessageToTop]);

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
    const trimmed = text.trim();
    if (!trimmed || isLoading || waitForTurnstileConfig) return;
    if (trimmed.length > MAX_CHAT_MESSAGE_LENGTH) return;
    if (requiresTurnstile && !turnstileToken.trim()) {
      turnstileRef.current?.execute();
      return;
    }

    const now = Date.now();
    const userMessage: Message = {
      id: now.toString(),
      role: "user",
      content: trimmed,
      timestamp: now,
    };

    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    setInput("");
    setIsLoading(true);
    startThinkingDelay();
    recordEngagementAction("chat_send");
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

      const trimmedToken = turnstileToken.trim();
      const body = JSON.stringify({
        message: trimmed,
        program: selectedProgram,
        selectedSessions,
        history,
        stream: true,
        turnstileToken: trimmedToken ? trimmedToken : undefined,
      });
      let content: string | null = null;
      let correlationId: string | undefined;
      let maxAttempts = 3;
      let chatRequestSucceeded = false;
      let usedStreamPlaceholder = false;
      const assistantId = (now + 1).toString();
      const isRetryableStatus = (s: number) =>
        s === 429 || s === 500 || s === 502 || s === 503 || s === 504;

      for (let attempt = 0; attempt < maxAttempts; attempt++) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
        try {
          const res = await fetch("/chat/api", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body,
            signal: controller.signal,
            credentials: "include",
          });
          clearTimeout(timeoutId);

          const responseType = res.headers.get("content-type") ?? "";

          if (responseType.includes("text/event-stream")) {
            if (!res.ok) {
              content = getChatErrorMessage(res, "Something went wrong. Please try again.");
              break;
            }

            usedStreamPlaceholder = true;

            await consumeChatStream(res, {
              onToken: () => {
                scrollAssistantMessageToTopRef.current();
              },
              onDone: (payload) => {
                content = payload.reply;
                chatRequestSucceeded = true;
                clearThinkingDelay();
                setShowThinkingIndicator(false);
                const doneAt = Date.now();
                const replyText = payload.reply ?? "";

                setMessages((prev) => {
                  const hasMsg = prev.some((m) => m.id === assistantId);
                  if (!hasMsg) {
                    return [
                      ...prev,
                      {
                        id: assistantId,
                        role: "assistant",
                        content: replyText,
                        correlationId: payload.correlationId,
                        userPrompt: trimmed,
                        isComplete: true,
                        timestamp: doneAt,
                      },
                    ];
                  }
                  return prev.map((m) =>
                    m.id === assistantId
                      ? {
                          ...m,
                          content: replyText,
                          correlationId: payload.correlationId,
                          userPrompt: trimmed,
                          isComplete: true,
                          timestamp: doneAt,
                        }
                      : m
                  );
                });
                setIsTurnstileSessionVerified(true);
                setTurnstileToken("");
                turnstileRef.current?.reset();
              },
              onError: (payload) => {
                content = payload.error;
                if (payload.status === 503 && maxAttempts === 3) {
                  maxAttempts = 4;
                }
              },
            });
            break;
          }

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
            clearThinkingDelay();
            setShowThinkingIndicator(false);
            content = data.reply || "Sorry, I could not get a response.";
            correlationId = data.correlationId;
            chatRequestSucceeded = true;
            setIsTurnstileSessionVerified(true);
            setTurnstileToken("");
            turnstileRef.current?.reset();
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

      if (didAttemptFetch && !chatRequestSucceeded && trimmedToken) {
        setTurnstileToken("");
        setTurnstileNonce((n) => n + 1);
      }

      if (!chatRequestSucceeded) {
        const assistantNow = Date.now();
        const errorContent = content || "Something went wrong. Please try again.";
        setMessages((prev) => {
          const hasPlaceholder = prev.some((m) => m.id === assistantId);
          if (hasPlaceholder) {
            return prev.map((m) =>
              m.id === assistantId
                ? {
                    ...m,
                    content: errorContent,
                    timestamp: assistantNow,
                    isComplete: true,
                  }
                : m
            );
          }
          return [
            ...prev,
            {
              id: assistantId,
              role: "assistant",
              content: errorContent,
              timestamp: assistantNow,
              isComplete: true,
            },
          ];
        });
      } else if (!usedStreamPlaceholder) {
        const assistantNow = Date.now();
        const assistantMessage: Message = {
          id: assistantId,
          role: "assistant",
          content: content || "Sorry, I could not get a response.",
          timestamp: assistantNow,
          userPrompt: trimmed,
          correlationId,
          isComplete: true,
        };
        setMessages((prev) => {
          if (prev.some((m) => m.id === assistantId)) return prev;
          return [...prev, assistantMessage];
        });
      }

      if (chatRequestSucceeded) {
        trackZarazEvent(ZARAZ_EVENTS.chatMessageSent, {
          program: selectedProgram,
          sessionCount: selectedSessions.length,
        });
      }
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
      clearThinkingDelay();
      setShowThinkingIndicator(false);
      setIsLoading(false);
    }
  }, [
    clearThinkingDelay,
    isLoading,
    isTurnstileSessionVerified,
    messages,
    recordEngagementAction,
    requiresTurnstile,
    selectedProgram,
    selectedSessions,
    startThinkingDelay,
    turnstileToken,
    waitForTurnstileConfig,
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
    recordEngagementAction("chat_mention_open");
  }, [recordEngagementAction]);

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

  const handleReaction = async (msgId: string, type: "up" | "down") => {
    const nextReaction = reactions[msgId] === type ? null : type;
    setReactions((prev) => ({
      ...prev,
      [msgId]: nextReaction,
    }));

    if (!nextReaction || feedbackSent[msgId]) return;

    const assistantMsg = messages.find((m) => m.id === msgId);
    if (!assistantMsg || assistantMsg.role !== "assistant" || !assistantMsg.content.trim()) {
      setFeedbackError("Feedback is not available for this message yet.");
      return;
    }

    const msgIndex = messages.findIndex((m) => m.id === msgId);
    const userMsg =
      msgIndex > 0 && messages[msgIndex - 1]?.role === "user"
        ? messages[msgIndex - 1]
        : null;
    const userMessage =
      assistantMsg.userPrompt ?? userMsg?.content ?? "";

    try {
      const res = await fetch("/chat/feedback/api", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          rating: nextReaction,
          correlationId: assistantMsg.correlationId ?? undefined,
          userMessage,
          assistantMessage: assistantMsg.content,
          program: selectedProgram,
          selectedSessions,
        }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setFeedbackError(data.error ?? "Could not send feedback. Please try again.");
        return;
      }
      setFeedbackSent((prev) => ({ ...prev, [msgId]: true }));
      setFeedbackError(null);
      trackZarazEvent(ZARAZ_EVENTS.chatFeedback, { rating: nextReaction });
    } catch {
      setFeedbackError("Could not send feedback. Please try again.");
    }
  };

  const handleDelete = useCallback((msgId: string) => {
    setMessages((prev) => {
      const idx = prev.findIndex((m) => m.id === msgId);
      if (idx === -1) return prev;
      const target = prev[idx];
      const next = prev[idx + 1];
      const removePairedAssistant =
        target.role === "user" && next?.role === "assistant";
      const removeCount = removePairedAssistant ? 2 : 1;
      return [...prev.slice(0, idx), ...prev.slice(idx + removeCount)];
    });
  }, []);

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

  const isEmptyChat = messages.length === 0;

  const chatInputPlaceholder = useMemo(() => {
    if (!isEmptyChat) return "Write a message...";
    if (isDesktopViewport) {
      return "Ask about calendars or holidays. Select your programme, or type @ to mention one.";
    }
    return "How can I help you today?";
  }, [isEmptyChat, isDesktopViewport]);

  return (
    <div className="relative flex flex-col h-dvh bg-background text-foreground" data-nosnippet>
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

      {/* Chat area + composer */}
      <div
        className={cn(
          "flex min-h-0 flex-1 flex-col",
          isEmptyChat && "lg:justify-center lg:gap-16"
        )}
      >
      {/* Chat messages area */}
      <div
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className={cn(
          "px-4 md:px-0",
          isEmptyChat
            ? "flex flex-1 flex-col items-center justify-center pt-0 pb-6 lg:flex-none lg:overflow-visible lg:pb-0"
            : "flex-1 overflow-y-auto pt-0 pb-6"
        )}
      >
        {isEmptyChat ? (
          <div className="flex h-full flex-col items-center justify-center gap-4 px-4 text-center mx-auto max-w-[600px] lg:h-auto">
            <div className="flex w-full max-w-md flex-col items-center gap-2 text-center">
              <h1
                className="text-2xl sm:text-3xl font-semibold tracking-tight text-foreground text-balance"
                suppressHydrationWarning
              >
                {chatGreeting}
              </h1>
              <p className="text-sm text-muted-foreground max-w-sm mx-auto text-balance lg:hidden">
                Ask about academic calendars or public holidays. Select your programme, or type @ to mention a calendar.
              </p>
            </div>
            {showTurnstileChallenge ? (
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
            {showTurnstileChallenge ? (
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
            {messages.map((msg) => {
              if (
                msg.role === "assistant" &&
                msg.isComplete === false &&
                !msg.content.trim()
              ) {
                return null;
              }
              const assistantFinished =
                msg.role === "assistant" &&
                msg.isComplete !== false &&
                msg.content.trim().length > 0;

              return (
              <div
                key={msg.id}
                ref={
                  msg.id === assistantScrollTargetId
                    ? streamingAssistantMessageRef
                    : undefined
                }
                className="space-y-1"
              >
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
                    <div className="w-full px-1 py-1 text-sm leading-relaxed text-foreground">
                      <FormattedMessage content={msg.content} />
                    </div>
                  )}
                </div>
                {assistantFinished && (
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
            );
            })}

            {showThinkingUi && (
              <div className="flex flex-col items-start gap-1">
                <div className="px-1 py-1">
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

      {/* Input area - bottom on mobile / active chat; centered below greeting on desktop empty */}
      <div
        className={cn(
          "chat-input-area relative px-4 md:px-0 pt-1 lg:pt-0.5 pb-6",
          isEmptyChat && "chat-input-area-centered lg:pt-0 lg:pb-10"
        )}
      >
        <div className="mx-auto flex max-w-[600px] flex-col">
          {/* Suggestion chips - swipeable carousel with edge fades */}
          {feedbackError && (
            <p className="text-xs text-destructive mb-2 px-1" role="status">
              {feedbackError}
            </p>
          )}
          {messages.length === 0 && (
            <SuggestionCarousel
              className="mb-2 lg:order-2 lg:mb-0 lg:mt-2"
              suggestions={suggestions}
              disabled={
                waitForTurnstileConfig ||
                (requiresTurnstile && !turnstileToken.trim()) ||
                isLoading
              }
              onSelect={(suggestion) => sendMessage(suggestion)}
            />
          )}
          <form
            onSubmit={handleSubmit}
            className={cn(
              "relative rounded-[10px] border border-border bg-secondary dark:bg-[#2A2A2A] overflow-visible",
              isEmptyChat && "lg:order-1"
            )}
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
                const nextValue = e.target.value.slice(0, MAX_CHAT_MESSAGE_LENGTH);
                setInput(nextValue);
                updateMentionState(nextValue, e.target.selectionStart);
              }}
              maxLength={MAX_CHAT_MESSAGE_LENGTH}
              onClick={(e) => updateMentionState(e.currentTarget.value, e.currentTarget.selectionStart)}
              onKeyUp={(e) => updateMentionState(e.currentTarget.value, e.currentTarget.selectionStart)}
              onKeyDown={handleKeyDown}
              placeholder={chatInputPlaceholder}
              disabled={isLoading}
              rows={1}
              className="chat-input relative z-10 w-full resize-none bg-transparent px-4 pt-3 pb-1 text-sm leading-relaxed placeholder:text-muted-foreground focus:outline-none disabled:opacity-50"
            />
            {isMobileMentionPicker ? (
              <Drawer open={isMentionOpen} onOpenChange={setIsMentionOpen}>
                <DrawerContent className={responsiveDrawerContentClassName}>
                  <div className={cn(drawerBodyClassName, responsiveDrawerBodyClassName)}>
                    <DrawerTitle>Mention Session Calendar</DrawerTitle>
                    <DrawerDescription className={responsiveDrawerDescriptionClassName}>
                      Select a session to insert into your message.
                    </DrawerDescription>
                    <div className="w-full space-y-2 text-left">
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
                        <div className="py-2 text-xs text-muted-foreground">No sessions found</div>
                      )}
                    </div>
                  </div>
                </DrawerContent>
              </Drawer>
            ) : (
              <Dialog open={isMentionOpen} onOpenChange={setIsMentionOpen}>
                <DialogContent className={responsiveDialogContentClassName} showCloseButton={false}>
                  <DialogHeader className="gap-3 text-center md:text-left">
                    <DialogTitle className={responsiveDialogTitleClassName}>
                      Mention Session Calendar
                    </DialogTitle>
                    <DialogDescription className={responsiveDialogDescriptionClassName}>
                      Select a session to insert into your message.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="max-h-[80vh] overflow-auto space-y-2">
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
                    waitForTurnstileConfig ||
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
            className={cn(
              "block text-center text-xs text-muted-foreground mt-2",
              isEmptyChat && "lg:hidden",
              disclaimerFade === "in" ? "disclaimer-fade-in" : "disclaimer-fade-out"
            )}
          >
            {disclaimerTexts[disclaimerIndex]}
          </span>
        </div>
      </div>
      </div>
    </div>
  );
}
