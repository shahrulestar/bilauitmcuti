"use client";

import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  markEngagementCompleted,
  markEngagementShown,
  recordEngagementAction as recordEngagementActionLib,
  resetEngagementCycle,
  type EngagementActionType,
} from "@/lib/engagement-prompt";

const PWA_PROGRAM_DRAWER_OPEN_KEY = "pwa-program-drawer-open";

interface EngagementPromptContextValue {
  open: boolean;
  setOpen: (open: boolean) => void;
  recordEngagementAction: (type: EngagementActionType) => void;
  closeAfterShare: () => void;
  closeAfterFeedback: () => void;
  completeRating: () => void;
  dismissPrompt: () => void;
}

const EngagementPromptContext = createContext<EngagementPromptContextValue | null>(
  null
);

function isBlockingOverlayOpen(): boolean {
  if (typeof document === "undefined") return false;
  return document.querySelectorAll('[data-vaul-drawer][data-state="open"]').length > 0;
}

function isProgramDrawerOpen(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return sessionStorage.getItem(PWA_PROGRAM_DRAWER_OPEN_KEY) === "1";
  } catch {
    return false;
  }
}

export function EngagementPromptProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const ratedThisSessionRef = useRef(false);
  const pendingOpenTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearPendingOpen = useCallback(() => {
    if (pendingOpenTimerRef.current) {
      clearTimeout(pendingOpenTimerRef.current);
      pendingOpenTimerRef.current = null;
    }
  }, []);

  const tryOpenPrompt = useCallback(() => {
    const attemptOpen = () => {
      if (isBlockingOverlayOpen() || isProgramDrawerOpen()) {
        pendingOpenTimerRef.current = setTimeout(attemptOpen, 500);
        return;
      }
      pendingOpenTimerRef.current = null;
      markEngagementShown();
      setOpen(true);
    };

    clearPendingOpen();
    pendingOpenTimerRef.current = setTimeout(attemptOpen, 300);
  }, [clearPendingOpen]);

  const recordEngagementAction = useCallback(
    (type: EngagementActionType) => {
      const result = recordEngagementActionLib(type);
      if (result.shouldOpen) {
        tryOpenPrompt();
      }
    },
    [tryOpenPrompt]
  );

  const closeWithoutPersisting = useCallback(() => {
    resetEngagementCycle();
    clearPendingOpen();
    setOpen(false);
  }, [clearPendingOpen]);

  const closeAfterShare = useCallback(() => {
    closeWithoutPersisting();
  }, [closeWithoutPersisting]);

  const closeAfterFeedback = useCallback(() => {
    closeWithoutPersisting();
  }, [closeWithoutPersisting]);

  const completeRating = useCallback(() => {
    ratedThisSessionRef.current = true;
    markEngagementCompleted();
    clearPendingOpen();
  }, [clearPendingOpen]);

  const dismissPrompt = useCallback(() => {
    if (!ratedThisSessionRef.current) {
      resetEngagementCycle();
    }
    ratedThisSessionRef.current = false;
    clearPendingOpen();
    setOpen(false);
  }, [clearPendingOpen]);

  const handleOpenChange = useCallback(
    (next: boolean) => {
      if (next) {
        setOpen(true);
        return;
      }
      dismissPrompt();
    },
    [dismissPrompt]
  );

  return (
    <EngagementPromptContext.Provider
      value={{
        open,
        setOpen: handleOpenChange,
        recordEngagementAction,
        closeAfterShare,
        closeAfterFeedback,
        completeRating,
        dismissPrompt,
      }}
    >
      {children}
    </EngagementPromptContext.Provider>
  );
}

export function useEngagementPrompt(): EngagementPromptContextValue {
  const ctx = useContext(EngagementPromptContext);
  if (!ctx) {
    throw new Error("useEngagementPrompt must be used within EngagementPromptProvider");
  }
  return ctx;
}
