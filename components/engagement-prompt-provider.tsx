"use client";

import dynamic from "next/dynamic";
import { useEffect, useState, type ReactNode } from "react";
import {
  EngagementPromptProvider,
  useEngagementPrompt,
} from "@/components/engagement-prompt-context";

const EngagementPromptSheet = dynamic(
  () =>
    import("@/components/engagement-prompt-sheet").then(
      (m) => m.EngagementPromptSheet
    ),
  { ssr: false }
);

function EngagementPromptHost() {
  const { open, setOpen, closeAfterShare, closeAfterFeedback, completeRating } =
    useEngagementPrompt();
  const [isMobileSheet, setIsMobileSheet] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const media = window.matchMedia("(max-width: 768px)");
    const sync = () => setIsMobileSheet(media.matches);
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);

  if (!open) return null;

  return (
    <EngagementPromptSheet
      open={open}
      onOpenChange={setOpen}
      isMobileSheet={isMobileSheet}
      onShareComplete={closeAfterShare}
      onFeedbackComplete={closeAfterFeedback}
      onRatingComplete={completeRating}
    />
  );
}

export function EngagementPromptRoot({ children }: { children: ReactNode }) {
  return (
    <EngagementPromptProvider>
      {children}
      <EngagementPromptHost />
    </EngagementPromptProvider>
  );
}

export { useEngagementPrompt } from "@/components/engagement-prompt-context";
