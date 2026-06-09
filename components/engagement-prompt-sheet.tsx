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
  Drawer,
  DrawerContent,
  DrawerTitle,
  drawerBodyClassName,
  responsiveDrawerContentClassName,
  responsiveDialogTitleClassName,
  responsiveDrawerBodyClassName,
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
const MIN_FEEDBACK_REASON_LENGTH = 10;
const MAX_FEEDBACK_REASON_LENGTH = 400;

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
  onRatingChange: (value: number) => void;
  onFeedbackReasonChange: (value: string) => void;
  onSubmitLowRatingFeedback: () => void;
  onFeedback: () => void;
  onShare: () => void;
}) {
  const trimmedReasonLength = feedbackReason.trim().length;
  const canSubmitLowRating =
    trimmedReasonLength >= MIN_FEEDBACK_REASON_LENGTH && !isSubmittingFeedback;

  return (
    <div className="flex w-full flex-col gap-5">
      <p className="text-sm text-muted-foreground">
        How has your experience been so far? Share this calendar with your coursemates, or let us
        know how we can make it better.
      </p>

      <div className="flex flex-col gap-1">
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
      </div>

      <div
        className={cn(
          "grid transition-[grid-template-rows] duration-200 ease-out",
          requiresFeedback ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
        )}
      >
        <div className="overflow-hidden">
          <div className="flex flex-col gap-2 pt-1">
            <Textarea
              id="feedback-reason"
              value={feedbackReason}
              onChange={(event) =>
                onFeedbackReasonChange(
                  event.target.value.slice(0, MAX_FEEDBACK_REASON_LENGTH)
                )
              }
              maxLength={MAX_FEEDBACK_REASON_LENGTH}
              rows={6}
              placeholder="Write your feedback..."
              disabled={isSubmittingFeedback}
              className="resize-none bg-background text-sm shadow-none placeholder:text-sm dark:bg-[#2A2A2A]"
              data-vaul-no-drag=""
            />
            <Button
              type="button"
              variant="default"
              className="h-[38px] w-full"
              disabled={!canSubmitLowRating}
              onClick={onSubmitLowRatingFeedback}
            >
              {isSubmittingFeedback ? "Sending…" : "Send feedback"}
            </Button>
          </div>
        </div>
      </div>

      {!requiresFeedback ? (
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
      ) : null}
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
    if (reason.length < MIN_FEEDBACK_REASON_LENGTH) {
      toast.error(`Please enter at least ${MIN_FEEDBACK_REASON_LENGTH} characters.`);
      return;
    }

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
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent className={responsiveDrawerContentClassName}>
          <div className={cn(drawerBodyClassName, responsiveDrawerBodyClassName)}>
            <DrawerTitle>Enjoying Bila UiTM Cuti?</DrawerTitle>
            <EngagementPromptBody
              rating={rating}
              ratingDisabled={ratingDisabled}
              requiresFeedback={requiresFeedback}
              feedbackReason={feedbackReason}
              isSubmittingFeedback={isSubmittingFeedback}
              onRatingChange={handleRatingChange}
              onFeedbackReasonChange={setFeedbackReason}
              onSubmitLowRatingFeedback={handleSubmitLowRatingFeedback}
              onFeedback={handleFeedback}
              onShare={handleShare}
            />
          </div>
        </DrawerContent>
      </Drawer>
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
