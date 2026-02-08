"use client";

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronDown, ChevronUp, ArrowUp, ThumbsUp, ThumbsDown, Copy, Check, RefreshCw } from "lucide-react";
import { programOptions } from "@/lib/data";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import useEmblaCarousel from "embla-carousel-react";


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

function getRandomSuggestions(exclude: string[]): string[] {
  const available = SUGGESTION_POOL.filter((s) => !exclude.includes(s));
  const pool = available.length >= 3 ? available : SUGGESTION_POOL;
  const shuffled = [...pool].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, 3);
}

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
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
  const [suggestions, setSuggestions] = useState<string[]>(SUGGESTION_POOL.slice(0, 3));
  const [suggestionAnim, setSuggestionAnim] = useState<"enter" | "exit">("enter");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const lastScrollTop = useRef(0);
  const groupAOptions = useMemo(() => programOptions.filter(p => p.group === 'A'), []);
  const groupBOptions = useMemo(() => programOptions.filter(p => p.group === 'B'), []);
  const [emblaRef] = useEmblaCarousel({ dragFree: true, containScroll: "trimSnaps", align: "center" });

  // Rotate suggestions every 5 seconds with crossfade
  useEffect(() => {
    if (messages.length > 0) return;
    let timeoutId: ReturnType<typeof setTimeout>;
    const interval = setInterval(() => {
      setSuggestionAnim("exit");
      timeoutId = setTimeout(() => {
        setSuggestions((prev) => getRandomSuggestions(prev));
        setSuggestionAnim("enter");
      }, 400);
    }, 5000);
    return () => {
      clearInterval(interval);
      clearTimeout(timeoutId);
    };
  }, [messages.length]);

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

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: text.trim(),
    };

    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    setInput("");
    setIsLoading(true);

    try {
      const history = messages.map((msg) => ({
        role: msg.role,
        content: msg.content,
      }));

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

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: content || "Something went wrong. Please try again.",
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch {
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: "Something went wrong. Please try again.",
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
      const history = newMessages.slice(0, -1).map((msg) => ({
        role: msg.role,
        content: msg.content,
      }));

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

      const newAssistantMessage: Message = {
        id: Date.now().toString(),
        role: "assistant",
        content,
      };
      setMessages((prev) => [...prev, newAssistantMessage]);
    } catch {
      const errorMessage: Message = {
        id: Date.now().toString(),
        role: "assistant",
        content: "Something went wrong. Please try again.",
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

  return (
    <div className="relative flex flex-col h-dvh bg-background text-foreground">
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
            <div className={`mt-2 w-full max-w-sm mx-auto hidden md:block ${suggestionAnim === "enter" ? "suggestions-enter" : "suggestions-exit"}`}>
              <div className="flex flex-col sm:flex-row gap-2 items-center justify-center">
                {suggestions.slice(0, 2).map((suggestion) => (
                  <button
                    key={suggestion}
                    onClick={() => sendMessage(suggestion)}
                    className="w-fit text-xs px-3 py-1.5 rounded-full border border-border bg-secondary/50 hover:bg-secondary dark:bg-[#2A2A2A] dark:hover:bg-[#333] text-foreground transition-colors whitespace-nowrap"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
              {suggestions[2] && (
                <div className="flex justify-center mt-2">
                  <button
                    onClick={() => sendMessage(suggestions[2])}
                    className="w-fit text-xs px-3 py-1.5 rounded-full border border-border bg-secondary/50 hover:bg-secondary dark:bg-[#2A2A2A] dark:hover:bg-[#333] text-foreground transition-colors whitespace-nowrap"
                  >
                    {suggestions[2]}
                  </button>
                </div>
              )}
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
                  <div
                    className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap ${
                      msg.role === "user"
                        ? "bg-primary text-primary-foreground rounded-br-md"
                        : "bg-secondary dark:bg-[#2A2A2A] text-foreground rounded-bl-md"
                    }`}
                  >
                    {msg.content}
                  </div>
                </div>
                {msg.role === "assistant" && (
                  <div className="flex gap-1">
                    <button
                      onClick={() => handleCopy(msg.id, msg.content)}
                      className="flex items-center justify-center w-7 h-7 rounded-md hover:bg-secondary dark:hover:bg-[#2A2A2A] text-muted-foreground hover:text-foreground transition-colors"
                      aria-label="Copy answer"
                    >
                      {copiedId === msg.id ? (
                        <Check className="w-3.5 h-3.5 text-green-500" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>
                    <button
                      onClick={() => handleRegenerate(msg.id)}
                      disabled={isLoading}
                      className="flex items-center justify-center w-7 h-7 rounded-md hover:bg-secondary dark:hover:bg-[#2A2A2A] text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                      aria-label="Regenerate answer"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleReaction(msg.id, "up")}
                      className={`flex items-center justify-center w-7 h-7 rounded-md hover:bg-secondary dark:hover:bg-[#2A2A2A] transition-colors ${reactions[msg.id] === "up" ? "text-foreground" : "text-muted-foreground hover:text-foreground"}`}
                      aria-label="Thumbs up"
                    >
                      <ThumbsUp className={`w-3.5 h-3.5 ${reactions[msg.id] === "up" ? "fill-current" : ""}`} />
                    </button>
                    <button
                      onClick={() => handleReaction(msg.id, "down")}
                      className={`flex items-center justify-center w-7 h-7 rounded-md hover:bg-secondary dark:hover:bg-[#2A2A2A] transition-colors ${reactions[msg.id] === "down" ? "text-foreground" : "text-muted-foreground hover:text-foreground"}`}
                      aria-label="Thumbs down"
                    >
                      <ThumbsDown className={`w-3.5 h-3.5 ${reactions[msg.id] === "down" ? "fill-current" : ""}`} />
                    </button>
                  </div>
                )}
              </div>
            ))}

            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-secondary dark:bg-[#2A2A2A] rounded-2xl rounded-bl-md px-4 py-3">
                  <div className="flex gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-muted-foreground/40 animate-bounce [animation-delay:0ms]" />
                    <span className="w-2 h-2 rounded-full bg-muted-foreground/40 animate-bounce [animation-delay:150ms]" />
                    <span className="w-2 h-2 rounded-full bg-muted-foreground/40 animate-bounce [animation-delay:300ms]" />
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Input area - prompt form like ChatGPT with dropdown inside textarea */}
      <div className="chat-input-area relative px-4 md:px-0 pt-1 lg:pt-0.5 pb-3">
        <div className="mx-auto max-w-[600px]">
          {/* Mobile/tablet suggestion chips - swipeable row */}
          {messages.length === 0 && (
            <div className="md:hidden mb-2">
              <div
                className={`suggestions-swipe overflow-hidden ${suggestionAnim === "enter" ? "suggestions-enter" : "suggestions-exit"}`}
                ref={emblaRef}
              >
                <div className="embla__container flex gap-2 px-1">
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
          <span className="block text-center text-xs text-muted-foreground mt-2">
            AI can make mistakes. Check important info.
          </span>
        </div>
      </div>
    </div>
  );
}
