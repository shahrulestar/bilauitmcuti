"use client";

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ArrowUp, Bot, User } from "lucide-react";
import { programOptions } from "@/lib/data";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const MAX_MESSAGE_LENGTH = 500;

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
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const groupAOptions = useMemo(() => programOptions.filter(p => p.group === 'A'), []);
  const groupBOptions = useMemo(() => programOptions.filter(p => p.group === 'B'), []);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: trimmed,
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    try {
      const res = await fetch("/chat/api", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: trimmed, program }),
      });

      const data = await res.json();

      let content: string;
      if (!res.ok) {
        content =
          data.error || "Something went wrong. Please try again.";
      } else {
        content =
          data.reply || "Sorry, I could not get a response.";
      }

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content,
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

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="flex flex-col h-dvh bg-background text-foreground">
      {/* Header */}
      <header className="flex items-center gap-3 px-4 md:px-0 py-3 mx-auto max-w-[600px] w-full">
        <button
          onClick={() => router.push("/")}
          className="flex items-center justify-center w-9 h-9 rounded-full bg-secondary hover:bg-secondary/80 dark:bg-[#2A2A2A] dark:hover:bg-[#333] transition-colors"
          aria-label="Back to home"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
      </header>

      {/* Chat messages area */}
      <div className="flex-1 overflow-y-auto px-4 md:px-0 py-6">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-4 text-center mx-auto max-w-[600px]">
            <div className="flex items-center justify-center w-14 h-14 rounded-full bg-secondary dark:bg-[#2A2A2A]">
              <Bot className="w-7 h-7 text-muted-foreground" />
            </div>
            <div>
              <h2 className="text-lg font-semibold mb-1">Bila UiTM Cuti?</h2>
              <p className="text-sm text-muted-foreground max-w-xs">
                Ask me anything about your UiTM academic calendar! Select your program below and start asking.
              </p>
            </div>
            <div className="flex flex-wrap gap-2 mt-2 max-w-sm justify-center">
              {[
                "When is the next break?",
                "Bila peperiksaan akhir?",
                "When does lecture start?",
              ].map((suggestion) => (
                <button
                  key={suggestion}
                  onClick={() => {
                    setInput(suggestion);
                    textareaRef.current?.focus();
                  }}
                  className="text-xs px-3 py-1.5 rounded-full border border-border bg-secondary/50 hover:bg-secondary dark:bg-[#2A2A2A] dark:hover:bg-[#333] text-foreground transition-colors"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="mx-auto max-w-[600px] space-y-6">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex gap-3 ${
                  msg.role === "user" ? "justify-end" : "justify-start"
                }`}
              >
                {msg.role === "assistant" && (
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-secondary dark:bg-[#2A2A2A] flex items-center justify-center mt-0.5">
                    <Bot className="w-4 h-4 text-muted-foreground" />
                  </div>
                )}
                <div
                  className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap ${
                    msg.role === "user"
                      ? "bg-primary text-primary-foreground rounded-br-md"
                      : "bg-secondary dark:bg-[#2A2A2A] text-foreground rounded-bl-md"
                  }`}
                >
                  {msg.content}
                </div>
                {msg.role === "user" && (
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary flex items-center justify-center mt-0.5">
                    <User className="w-4 h-4 text-primary-foreground" />
                  </div>
                )}
              </div>
            ))}

            {isLoading && (
              <div className="flex gap-3 justify-start">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-secondary dark:bg-[#2A2A2A] flex items-center justify-center mt-0.5">
                  <Bot className="w-4 h-4 text-muted-foreground" />
                </div>
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
      <div className="bg-background px-4 md:px-0 py-3">
        <div className="mx-auto max-w-[600px]">
          <form
            onSubmit={handleSubmit}
            className="relative rounded-2xl border border-border bg-secondary dark:bg-[#2A2A2A] overflow-hidden"
          >
            {/* Textarea */}
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value.slice(0, MAX_MESSAGE_LENGTH))}
              onKeyDown={handleKeyDown}
              placeholder="Ask anything about your schedule"
              maxLength={MAX_MESSAGE_LENGTH}
              disabled={isLoading}
              className="chat-textarea w-full h-[130px] resize-none bg-transparent px-4 pt-4 pb-14 text-sm placeholder:text-muted-foreground focus:outline-none disabled:opacity-50 overflow-hidden"
            />

            {/* Bottom bar inside the textarea box */}
            <div className="absolute bottom-0 left-0 right-0 flex items-center justify-between px-3 py-2.5">
              {/* Program dropdown */}
              <Select value={program} onValueChange={setProgram}>
                <SelectTrigger className="w-auto h-8 text-xs border-none bg-transparent shadow-none px-2 gap-1 hover:bg-background/50 dark:hover:bg-[#333] rounded-lg">
                  <SelectValue placeholder="Program" />
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
                {/* Character counter */}
                {input.length > 0 && (
                  <span className={`text-[10px] tabular-nums ${input.length >= MAX_MESSAGE_LENGTH ? "text-red-500" : "text-muted-foreground"}`}>
                    {input.length}/{MAX_MESSAGE_LENGTH}
                  </span>
                )}

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
