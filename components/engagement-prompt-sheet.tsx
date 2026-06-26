"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ResponsiveOverlayShell } from "@/components/ui/responsive-overlay-shell";
import {
  drawerOutlineButtonClassName,
  drawerPrimaryButtonClassName,
} from "@/components/ui/drawer";
import { Textarea } from "@/components/ui/textarea";
import { StarRating } from "@/components/star-rating";
import { shareOrCopyLink } from "@/lib/web-share";
import { getPageShareUrl } from "@/lib/share-url";
import { cn } from "@/lib/utils";
import {
  isEngagementRatingLimitReached,
  MAX_ENGAGEMENT_RATING_ATTEMPTS,
  recordEngagementRatingAttempt,
} from "@/lib/engagement-prompt";
import { trackZarazEvent, ZARAZ_EVENTS } from "@/lib/zaraz";

const SHARE_TITLE = "Bila UiTM Cuti";
const SHARE_TEXT =
  "Check out the UiTM academic calendar — registration, lectures, exams, and semester breaks.";
const MAX_FEEDBACK_REASON_LENGTH = 400;
const LOW_RATING_FEEDBACK_PLACEHOLDER =
  "We’d love to hear your thoughts!";
const HIGH_RATING_AUTO_CLOSE_MS = 2000;

interface EngagementPromptSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isMobileSheet: boolean;
  onShareComplete: () => void;
  onFeedbackComplete: () => void;
  onRatingComplete: () => void;
}

function EngagementPromptBody({
  rating,
  ratingDisabled,
  centerRating,
  requiresFeedback,
  feedbackReason,
  isSubmittingFeedback,
  compactFeedbackInput,
  onRatingChange,
  onFeedbackReasonChange,
  onSubmitLowRatingFeedback,
  onFeedback,
  onShare,
}: {
  rating: number;
  ratingDisabled: boolean;
  centerRating?: boolean;
  requiresFeedback: boolean;
  feedbackReason: string;
  isSubmittingFeedback: boolean;
  compactFeedbackInput?: boolean;
  onRatingChange: (value: number) => void;
  onFeedbackReasonChange: (value: string) => void;
  onSubmitLowRatingFeedback: () => void;
  onFeedback: () => void;
  onShare: () => void;
}) {
  return (
    <div className="flex w-full flex-col gap-5">
      <p className="text-sm text-muted-foreground">
        How has your experience been so far? Share this calendar with your coursemates, or let us
        know how we can make it better.
      </p>

      <div className="flex flex-col gap-2">
        <StarRating
          rating={rating}
          onRatingChange={onRatingChange}
          disabled={ratingDisabled}
          centered={centerRating}
          className={
            centerRating
              ? undefined
              : "items-center text-center md:items-start md:text-left"
          }
        />

        <div className="grid">
          <div
            className={cn(
              "col-start-1 row-start-1 grid transition-[grid-template-rows,opacity] duration-200 ease-out",
              requiresFeedback
                ? "z-10 grid-rows-[1fr] opacity-100"
                : "pointer-events-none z-0 grid-rows-[0fr] opacity-0"
            )}
          >
            <div className="min-h-0 overflow-hidden">
              <div className="flex flex-col gap-2">
                <Textarea
                  id="feedback-reason"
                  value={feedbackReason}
                  onChange={(event) =>
                    onFeedbackReasonChange(
                      event.target.value.slice(0, MAX_FEEDBACK_REASON_LENGTH)
                    )
                  }
                  maxLength={MAX_FEEDBACK_REASON_LENGTH}
                  rows={compactFeedbackInput ? 3 : 6}
                  placeholder={LOW_RATING_FEEDBACK_PLACEHOLDER}
                  disabled={isSubmittingFeedback}
                  className="resize-none bg-background text-sm shadow-none placeholder:text-sm focus-visible:ring-inset dark:bg-[#2A2A2A]"
                  data-vaul-no-drag=""
                />
                <Button
                  type="button"
                  size="sm"
                  variant="default"
                  className={drawerPrimaryButtonClassName}
                  disabled={isSubmittingFeedback}
                  onClick={onSubmitLowRatingFeedback}
                >
                  {isSubmittingFeedback ? "Sending…" : "Send feedback"}
                </Button>
              </div>
            </div>
          </div>

          <div
            className={cn(
              "col-start-1 row-start-1 grid transition-[grid-template-rows,opacity] duration-200 ease-out",
              requiresFeedback
                ? "pointer-events-none z-0 grid-rows-[0fr] opacity-0"
                : "z-10 grid-rows-[1fr] opacity-100"
            )}
          >
            <div className="min-h-0 overflow-hidden">
              <div className="flex flex-col gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className={drawerOutlineButtonClassName}
                  onClick={onFeedback}
                >
                  Send feedback
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="default"
                  className={drawerPrimaryButtonClassName}
                  onClick={onShare}
                >
                  Share with friends
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function EngagementPromptSheet({
  open,
  onOpenChange,
  isMobileSheet,
  onShareComplete,
  onFeedbackComplete,
  onRatingComplete,
}: EngagementPromptSheetProps) {
  const router = useRouter();
  const [rating, setRating] = useState(0);
  const [feedbackReason, setFeedbackReason] = useState("");
  const [requiresFeedback, setRequiresFeedback] = useState(false);
  const [isSubmittingFeedback, setIsSubmittingFeedback] = useState(false);
  const [ratingDisabled, setRatingDisabled] = useState(() =>
    isEngagementRatingLimitReached()
  );
  const latestSubmittedRatingRef = useRef(0);
  const highRatingCloseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );

  const clearHighRatingCloseTimer = useCallback(() => {
    if (highRatingCloseTimerRef.current) {
      clearTimeout(highRatingCloseTimerRef.current);
      highRatingCloseTimerRef.current = null;
    }
  }, []);

  const scheduleHighRatingClose = useCallback(() => {
    clearHighRatingCloseTimer();
    highRatingCloseTimerRef.current = setTimeout(() => {
      highRatingCloseTimerRef.current = null;
      if (document.activeElement instanceof HTMLElement) {
        document.activeElement.blur();
      }
      onOpenChange(false);
    }, HIGH_RATING_AUTO_CLOSE_MS);
  }, [clearHighRatingCloseTimer, onOpenChange]);

  useEffect(() => {
    if (!open) {
      clearHighRatingCloseTimer();
      return;
    }
    setRating(0);
    setFeedbackReason("");
    setRequiresFeedback(false);
    setIsSubmittingFeedback(false);
    latestSubmittedRatingRef.current = 0;
    setRatingDisabled(isEngagementRatingLimitReached());
  }, [open, clearHighRatingCloseTimer]);

  useEffect(() => () => clearHighRatingCloseTimer(), [clearHighRatingCloseTimer]);

  const submitHighRating = useCallback(
    async (value: number) => {
      try {
        const response = await fetch("/engagement/api", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ rating: value }),
        });

        if (latestSubmittedRatingRef.current !== value) return;

        if (!response.ok) {
          toast.error(
            "Could not save your rating. You can still share or send feedback."
          );
          return;
        }

        onRatingComplete();
        trackZarazEvent(ZARAZ_EVENTS.engagementRating, { rating: value });
      } catch {
        if (latestSubmittedRatingRef.current === value) {
          toast.error(
            "Could not save your rating. You can still share or send feedback."
          );
        }
      }
    },
    [onRatingComplete]
  );

  const handleRatingChange = useCallback(
    (value: number) => {
      if (ratingDisabled || isEngagementRatingLimitReached()) {
        setRatingDisabled(true);
        return;
      }

      setRating(value);

      if (value <= 3) {
        clearHighRatingCloseTimer();
        setRequiresFeedback(true);
        return;
      }

      setRequiresFeedback(false);
      setFeedbackReason("");
      scheduleHighRatingClose();

      const attempts = recordEngagementRatingAttempt();
      if (attempts >= MAX_ENGAGEMENT_RATING_ATTEMPTS) {
        setRatingDisabled(true);
      }

      latestSubmittedRatingRef.current = value;
      void submitHighRating(value);
    },
    [ratingDisabled, submitHighRating, clearHighRatingCloseTimer, scheduleHighRatingClose]
  );

  const handleSubmitLowRatingFeedback = useCallback(async () => {
    if (rating < 1 || rating > 3 || !requiresFeedback || isSubmittingFeedback) {
      return;
    }

    const reason = feedbackReason.trim();
    if (reason.length === 0) return;

    if (ratingDisabled || isEngagementRatingLimitReached()) {
      setRatingDisabled(true);
      return;
    }

    setIsSubmittingFeedback(true);
    latestSubmittedRatingRef.current = rating;

    try {
      const response = await fetch("/engagement/api", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rating, reason }),
      });

      if (latestSubmittedRatingRef.current !== rating) return;

      if (!response.ok) {
        toast.error(
          "Could not save your rating. You can still share or send feedback."
        );
        return;
      }

      const attempts = recordEngagementRatingAttempt();
      if (attempts >= MAX_ENGAGEMENT_RATING_ATTEMPTS) {
        setRatingDisabled(true);
      }

      clearHighRatingCloseTimer();
      onRatingComplete();
      trackZarazEvent(ZARAZ_EVENTS.engagementRating, { rating });
      setRequiresFeedback(false);
      if (document.activeElement instanceof HTMLElement) {
        document.activeElement.blur();
      }
      onOpenChange(false);
    } catch {
      if (latestSubmittedRatingRef.current === rating) {
        toast.error(
          "Could not save your rating. You can still share or send feedback."
        );
      }
    } finally {
      setIsSubmittingFeedback(false);
    }
  }, [
    feedbackReason,
    isSubmittingFeedback,
    onRatingComplete,
    rating,
    onOpenChange,
    ratingDisabled,
    requiresFeedback,
    clearHighRatingCloseTimer,
  ]);

  const handleShare = useCallback(async () => {
    clearHighRatingCloseTimer();
    const url = getPageShareUrl();
    const result = await shareOrCopyLink({
      title: SHARE_TITLE,
      text: SHARE_TEXT,
      url,
    });

    if (result === "shared" || result === "copied") {
      trackZarazEvent(ZARAZ_EVENTS.engagementShare, { method: result });
      if (result === "copied") {
        toast.success("Link copied! Paste it to share with friends.");
      }
      onShareComplete();
      return;
    }
    if (result === "aborted") return;

    toast.error("Could not copy the link. Please try again.");
  }, [clearHighRatingCloseTimer, onShareComplete]);

  const handleFeedback = useCallback(() => {
    clearHighRatingCloseTimer();
    trackZarazEvent(ZARAZ_EVENTS.engagementFeedbackClick);
    onFeedbackComplete();
    router.push("/feedback");
  }, [clearHighRatingCloseTimer, onFeedbackComplete, router]);

  return (
    <ResponsiveOverlayShell
      open={open}
      onOpenChange={onOpenChange}
      isMobile={isMobileSheet}
      title="Enjoying Bila UiTM Cuti?"
    >
      <EngagementPromptBody
        rating={rating}
        ratingDisabled={ratingDisabled}
        centerRating={!isMobileSheet}
        requiresFeedback={requiresFeedback}
        feedbackReason={feedbackReason}
        isSubmittingFeedback={isSubmittingFeedback}
        compactFeedbackInput={isMobileSheet}
        onRatingChange={handleRatingChange}
        onFeedbackReasonChange={setFeedbackReason}
        onSubmitLowRatingFeedback={handleSubmitLowRatingFeedback}
        onFeedback={handleFeedback}
        onShare={handleShare}
      />
    </ResponsiveOverlayShell>
  );
}
