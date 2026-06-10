"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  responsiveDialogContentClassName,
} from "@/components/ui/dialog";
import {
  KeyboardAwareDrawer,
  DrawerContent,
  DrawerTitle,
  drawerBodyClassName,
  drawerBodyFlexClassName,
  drawerScrollRegionClassName,
  responsiveDialogTitleClassName,
  responsiveDrawerBodyClassName,
  responsiveKeyboardDrawerContentClassName,
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
                  variant="default"
                  className="h-[38px] w-full"
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
                  className="h-[38px] w-full"
                  onClick={onFeedback}
                >
                  Send feedback
                </Button>
                <Button
                  type="button"
                  variant="default"
                  className="h-[38px] w-full"
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

  useEffect(() => {
    if (!open) return;
    setRating(0);
    setFeedbackReason("");
    setRequiresFeedback(false);
    setIsSubmittingFeedback(false);
    latestSubmittedRatingRef.current = 0;
    setRatingDisabled(isEngagementRatingLimitReached());
  }, [open]);

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
        setRequiresFeedback(true);
        return;
      }

      setRequiresFeedback(false);
      setFeedbackReason("");

      const attempts = recordEngagementRatingAttempt();
      if (attempts >= MAX_ENGAGEMENT_RATING_ATTEMPTS) {
        setRatingDisabled(true);
      }

      latestSubmittedRatingRef.current = value;
      void submitHighRating(value);
    },
    [ratingDisabled, submitHighRating]
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
  ]);

  const handleShare = useCallback(async () => {
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
  }, [onShareComplete]);

  const handleFeedback = useCallback(() => {
    trackZarazEvent(ZARAZ_EVENTS.engagementFeedbackClick);
    onFeedbackComplete();
    router.push("/feedback");
  }, [onFeedbackComplete, router]);

  if (isMobileSheet) {
    return (
      <KeyboardAwareDrawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent keyboardAware className={responsiveKeyboardDrawerContentClassName}>
          <div
            className={cn(
              drawerBodyClassName,
              drawerBodyFlexClassName,
              responsiveDrawerBodyClassName,
              "min-h-0 gap-0"
            )}
          >
            <div data-vaul-no-drag="" className="w-full shrink-0">
              <DrawerTitle>Enjoying Bila UiTM Cuti?</DrawerTitle>
            </div>
            <div
              data-vaul-no-drag=""
              className={cn(drawerScrollRegionClassName, "w-full min-w-0")}
            >
              <EngagementPromptBody
                rating={rating}
                ratingDisabled={ratingDisabled}
                requiresFeedback={requiresFeedback}
                feedbackReason={feedbackReason}
                isSubmittingFeedback={isSubmittingFeedback}
                compactFeedbackInput
                onRatingChange={handleRatingChange}
                onFeedbackReasonChange={setFeedbackReason}
                onSubmitLowRatingFeedback={handleSubmitLowRatingFeedback}
                onFeedback={handleFeedback}
                onShare={handleShare}
              />
            </div>
          </div>
        </DrawerContent>
      </KeyboardAwareDrawer>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={responsiveDialogContentClassName}
        showCloseButton={false}
      >
        <DialogHeader className="gap-3 text-center md:text-left">
          <DialogTitle className={responsiveDialogTitleClassName}>
            Enjoying Bila UiTM Cuti?
          </DialogTitle>
        </DialogHeader>
        <EngagementPromptBody
          rating={rating}
          ratingDisabled={ratingDisabled}
          centerRating
          requiresFeedback={requiresFeedback}
          feedbackReason={feedbackReason}
          isSubmittingFeedback={isSubmittingFeedback}
          onRatingChange={handleRatingChange}
          onFeedbackReasonChange={setFeedbackReason}
          onSubmitLowRatingFeedback={handleSubmitLowRatingFeedback}
          onFeedback={handleFeedback}
          onShare={handleShare}
        />
      </DialogContent>
    </Dialog>
  );
}
