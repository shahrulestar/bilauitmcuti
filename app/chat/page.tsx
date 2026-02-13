"use client";

import { useState, useRef, useEffect, useLayoutEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronDown, ChevronUp, ArrowUp, ThumbsUp, ThumbsDown, Copy, Check, RefreshCw, Trash2, Pencil } from "lucide-react";
import { programOptions } from "@/lib/data";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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

/**
 * Parse a [TABLE]...[/TABLE] block into headers and rows.
 * Each row is pipe-delimited. The first row is the header.
 * A separator row (e.g. ---|---|---) is skipped if present.
 */
function parseTable(block: string): { headers: string[]; rows: string[][] } | null {
  const lines = block.split("\n").map((l) => l.trim()).filter(Boolean);
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
        // Fallback: render as plain text if parsing fails
        const lines = part.split("\n");
        elements.push(...renderTextSection(lines, `tf-${pIdx}`));
      }
    } else {
      // Render as normal formatted text
      const trimmedPart = part.trim();
      if (trimmedPart) {
        const lines = part.split("\n");
        elements.push(...renderTextSection(lines, `s-${pIdx}`));
      }
    }

    isTable = !isTable;
  }

  return <>{elements}</>;
}

const SUGGESTION_POOL = [
  // Calendar questions (English)
  "When is the next break?",
  "When does lecture start?",
  "When is mid-semester test?",
  "When is Hari Raya break?",
  "When is revision week?",
  "When is final exam?",
  "When is add/drop period?",
  "When is semester break?",
  "What is Group A schedule?",
  // Calendar questions (Malay)
  "Bila peperiksaan akhir?",
  "Bila cuti semester bermula?",
  "Bila pendaftaran kursus dibuka?",
  "Bila tarikh bayar yuran?",
  "Bila cuti pertengahan semester?",
  "Bila kuliah bermula Group B?",
  // UiTM general questions
  "List all UiTM campuses",
  "What courses does UiTM offer?",
  "Apa itu program Asasi UiTM?",
  "How many faculties in UiTM?",
  "What is MDS programme?",
  "Apa syarat masuk Diploma?",
  "Tell me about UiTM Shah Alam",
  "Apa itu e-PJJ UiTM?",
  "What programs are in Group A?",
  "Senarai fakulti UiTM",
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

function getRandomLoadingPhrase(exclude?: string): string {
  const available = LOADING_PHRASES.filter((p) => p !== exclude);
  return available[Math.floor(Math.random() * available.length)];
}

function getRandomSuggestions(exclude: string[]): string[] {
  const available = SUGGESTION_POOL.filter((s) => !exclude.includes(s));
  const pool = available.length >= 5 ? available : SUGGESTION_POOL;
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

function formatTime24(timestamp: number): string {
  const d = new Date(timestamp);
  return d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false });
}

export default function ChatPage() {
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [program, setProgram] = useState("All");
  const [isLoading, setIsLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [headerVisible, setHeaderVisible] = useState(true);
  const [selectOpen, setSelectOpen] = useState(false);
  const [reactions, setReactions] = useState<Record<string, "up" | "down" | null>>({});
  const [suggestions, setSuggestions] = useState<string[]>(SUGGESTION_POOL.slice(0, 5));

  // Randomize suggestions once on mount (client-only) to avoid hydration mismatch
  useLayoutEffect(() => {
    setSuggestions(getRandomSuggestions([]));
  }, []);
  const [loadingPhrase, setLoadingPhrase] = useState("");
  const [disclaimerIndex, setDisclaimerIndex] = useState(0);
  const [disclaimerFade, setDisclaimerFade] = useState<"in" | "out">("in");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const lastScrollTop = useRef(0);
  const groupAOptions = useMemo(() => programOptions.filter(p => p.group === 'A'), []);
  const groupBOptions = useMemo(() => programOptions.filter(p => p.group === 'B'), []);
  const [emblaRef] = useEmblaCarousel({ dragFree: true, containScroll: "trimSnaps", align: "center" });

  const lastAssistantId = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === "assistant") return messages[i].id;
    }
    return null;
  }, [messages]);

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

  // Auto-resize textarea to fit content up to max height
  const adjustTextareaHeight = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 130)}px`;
  }, []);

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
    // Show header when scrolling up or near top
    if (currentScrollTop <= 10 || currentScrollTop < lastScrollTop.current) {
      setHeaderVisible(true);
    } else if (currentScrollTop > lastScrollTop.current) {
      setHeaderVisible(false);
    }
    lastScrollTop.current = currentScrollTop;
  }, []);

  const sendMessage = async (text: string) => {
    if (!text.trim() || isLoading) return;

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

    try {
      const history = prepareHistory(messages);

      const body = JSON.stringify({ message: text.trim(), program, history });
      let content: string | null = null;

      // Retry up to 2 times for recoverable errors (503 model loading, network issues)
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          const res = await fetch("/chat/api", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body,
          });

          const data = await res.json();

          if (!res.ok) {
            // Retry on 503 (model loading / busy)
            if (res.status === 503 && attempt < 1) {
              await new Promise((r) => setTimeout(r, 2000));
              continue;
            }
            content = data.error || "Something went wrong. Please try again.";
          } else {
            content = data.reply || "Sorry, I could not get a response.";
          }
          break;
        } catch {
          if (attempt < 1) {
            await new Promise((r) => setTimeout(r, 2000));
            continue;
          }
          throw new Error("Network error");
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
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    await sendMessage(input);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleCopy = async (msgId: string, content: string) => {
    try {
      await navigator.clipboard.writeText(content);
      setCopiedId(msgId);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      // Fallback: ignore if clipboard API fails
    }
  };

  const handleRegenerate = async (assistantMsgId: string) => {
    if (isLoading) return;
    // Find the user message right before this assistant message
    const msgIndex = messages.findIndex((m) => m.id === assistantMsgId);
    if (msgIndex <= 0) return;
    const userMsg = messages[msgIndex - 1];
    if (userMsg.role !== "user") return;

    // Remove the assistant message we're regenerating
    const newMessages = messages.filter((m) => m.id !== assistantMsgId);
    setMessages(newMessages);
    setIsLoading(true);

    try {
      const history = prepareHistory(newMessages.slice(0, -1));

      const res = await fetch("/chat/api", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: userMsg.content, program, history }),
      });

      const data = await res.json();
      let content: string;
      if (!res.ok) {
        content = data.error || "Something went wrong. Please try again.";
      } else {
        content = data.reply || "Sorry, I could not get a response.";
      }

      const regenNow = Date.now();
      const newAssistantMessage: Message = {
        id: regenNow.toString(),
        role: "assistant",
        content,
        timestamp: regenNow,
      };
      setMessages((prev) => [...prev, newAssistantMessage]);
    } catch {
      const regenErrorNow = Date.now();
      const errorMessage: Message = {
        id: regenErrorNow.toString(),
        role: "assistant",
        content: "Something went wrong. Please try again.",
        timestamp: regenErrorNow,
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
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
        <header className="flex items-center gap-3 py-3 mx-auto max-w-[600px] w-full">
          <button
            onClick={() => {
              if (window.history.length > 1) {
                router.back();
              } else {
                router.push("/");
              }
            }}
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
              <h2 className="text-lg font-semibold mb-1">Bila UiTM Cuti?</h2>
              <p className="text-sm text-muted-foreground max-w-xs">
                Ask about the UiTM academic calendar. Select your program and start.
              </p>
            </div>
          </div>
        ) : (
          <div className="mx-auto max-w-[600px] space-y-6 pt-14">
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
                      onClick={() => handleRegenerate(msg.id)}
                      disabled={isLoading || msg.id !== lastAssistantId}
                      className="flex items-center justify-center w-7 h-7 rounded-md hover:bg-secondary dark:hover:bg-[#2A2A2A] text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed transition-colors active:scale-90 transition-transform duration-150"
                      aria-label="Regenerate answer"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
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
                      onClick={() => sendMessage(suggestion)}
                      className="embla__slide flex-none text-xs px-3 py-1.5 rounded-full border border-border bg-secondary/50 hover:bg-secondary dark:bg-[#2A2A2A] dark:hover:bg-[#333] text-foreground transition-colors whitespace-nowrap"
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
            className="rounded-2xl border border-border bg-secondary dark:bg-[#2A2A2A] overflow-hidden"
          >
            {/* Auto-growing text input */}
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask anything about your schedule"
              disabled={isLoading}
              rows={1}
              className="chat-input w-full resize-none bg-transparent px-4 pt-3 pb-1 text-sm leading-relaxed placeholder:text-muted-foreground focus:outline-none disabled:opacity-50"
            />

            {/* Bottom bar */}
            <div className="flex items-center justify-between px-3 py-2">
              {/* Program dropdown */}
              <Select value={program} onValueChange={setProgram} open={selectOpen} onOpenChange={setSelectOpen}>
                <SelectTrigger className="w-auto h-8 text-xs border-none bg-transparent shadow-none px-2 gap-1 hover:bg-background/50 dark:hover:bg-[#333] rounded-lg [&>svg]:hidden">
                  <SelectValue placeholder="Program" />
                  <div className="flex-shrink-0">
                    {selectOpen ? (
                      <ChevronUp className="size-4 opacity-50 transition-none" />
                    ) : (
                      <ChevronDown className="size-4 opacity-50 transition-none" />
                    )}
                  </div>
                </SelectTrigger>
                <SelectContent className="min-w-[250px] pt-4 pb-4 pl-3 pr-3 bg-popover dark:bg-[#2A2A2A] border border-border transition-none">
                  {/* Group A */}
                  <div className="w-full">
                    <div className="text-xs font-semibold text-muted-foreground mb-2">GROUP A</div>
                    <div className="space-y-0">
                      {groupAOptions.map((opt) => (
                        <div key={opt.value} className="w-full py-0.5 cursor-pointer hover:bg-accent dark:hover:bg-[#262626] rounded-md transition-none">
                          <SelectItem value={opt.value} className="w-full mb-0">
                            <div className="font-medium text-sm truncate">{opt.label}</div>
                          </SelectItem>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="my-3 h-px bg-border" />

                  {/* Group B */}
                  <div className="w-full">
                    <div className="text-xs font-semibold text-muted-foreground mb-2">GROUP B</div>
                    <div className="space-y-0">
                      {groupBOptions.map((opt) => (
                        <div key={opt.value} className="w-full py-0.5 cursor-pointer hover:bg-accent dark:hover:bg-[#262626] rounded-md transition-none">
                          <SelectItem value={opt.value} className="w-full mb-0">
                            <div className="font-medium text-sm truncate">{opt.label}</div>
                          </SelectItem>
                        </div>
                      ))}
                    </div>
                  </div>
                </SelectContent>
              </Select>

              <div className="flex items-center gap-2">
                {/* Send button */}
                <button
                  type="submit"
                  disabled={!input.trim() || isLoading}
                  className="flex items-center justify-center w-8 h-8 rounded-full bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  aria-label="Send message"
                >
                  <ArrowUp className="w-4 h-4" />
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
