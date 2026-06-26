"use client";

import { useEffect, useState } from "react";
import {
  CHAT_GREETING_FALLBACK,
  pickRandomChatGreeting,
} from "@/lib/chat/greetings";

export function useChatGreeting(): string {
  const [greeting, setGreeting] = useState<string>(CHAT_GREETING_FALLBACK);

  useEffect(() => {
    setGreeting(pickRandomChatGreeting());
  }, []);

  return greeting;
}
