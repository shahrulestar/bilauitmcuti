"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerTitle,
  drawerBodyClassName,
  drawerContentClassName,
} from "@/components/ui/drawer";
import { StarRating } from "@/components/star-rating";
import { cn } from "@/lib/utils";

const SHARE_TITLE = "Bila UiTM Cuti";
const SHARE_TEXT =
  "Check out the UiTM academic calendar — registration, lectures, exams, and semester breaks.";

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
  hasRated,
  isSubmittingRating,
  canShare,
  showRateFirstHint,
  onRatingChange,
  onFeedback,
  onShare,
}: {
  rating: number;
  hasRated: boolean;
  isSubmittingRating: boolean;
  canShare: boolean;
  showRateFirstHint: boolean;
  onRatingChange: (value: number) => void;
  onFeedback: () => void;
  onShare: () => void;
}) {
  const actionsEnabled = hasRated;

  return (
    <div className="flex flex-col gap-5">
      <div className="space-y-2 text-center md:text-left">
        <h2 className="text-lg font-semibold text-foreground">
          Enjoying Bila UiTM Cuti?
        </h2>
        <p className="text-sm text-muted-foreground">
          Share this calendar with coursemates, or tell us what we can improve.
        </p>
      </div>

      <div className="flex flex-col gap-1">
        <StarRating
          rating={rating}
          disabled={isSubmittingRating}
          onRatingChange={onRatingChange}
          className="items-center text-center"
        />
        {showRateFirstHint && !hasRated ? (
          <p className="text-center text-xs text-destructive" role="alert">
            Please rate your experience first.
          </p>
        ) : null}
      </div>

      <div className="flex flex-col gap-2">
        <Button
          type="button"
          variant="outline"
          aria-disabled={!actionsEnabled}
          className={cn(
            "h-[38px] w-full",
            !actionsEnabled && "pointer-events-auto opacity-50"
          )}
          onClick={onFeedback}
        >
          Send feedback
        </Button>
        <Button
          type="button"
          variant="default"
          aria-disabled={!actionsEnabled || !canShare}
          className={cn(
            "h-[38px] w-full",
            (!actionsEnabled || !canShare) && "pointer-events-auto opacity-50"
          )}
          onClick={onShare}
        >
          Share with friends
        </Button>
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
  const [hasRated, setHasRated] = useState(false);
  const [showRateFirstHint, setShowRateFirstHint] = useState(false);
  const [isSubmittingRating, setIsSubmittingRating] = useState(false);
  const [canShare, setCanShare] = useState(false);

  useEffect(() => {
    if (!open) return;
    setRating(0);
    setHasRated(false);
    setShowRateFirstHint(false);
    setIsSubmittingRating(false);
    if (typeof navigator === "undefined") {
      setCanShare(false);
      return;
    }
    setCanShare(typeof navigator.share === "function");
  }, [open]);

  const handleRatingChange = useCallback(
    async (value: number) => {
      if (isSubmittingRating) return;
      setRating(value);
      setShowRateFirstHint(false);
      setIsSubmittingRating(true);

      try {
        const response = await fetch("/engagement/api", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ rating: value }),
        });

        if (!response.ok) {
          setRating(0);
          return;
        }

        setHasRated(true);
        setShowRateFirstHint(false);
        onRatingComplete();
      } catch {
        setRating(0);
      } finally {
        setIsSubmittingRating(false);
      }
    },
    [isSubmittingRating, onRatingComplete]
  );

  const requireRating = useCallback(() => {
    if (hasRated) return true;
    setShowRateFirstHint(true);
    return false;
  }, [hasRated]);

  const handleShare = useCallback(async () => {
    if (!requireRating()) return;
    if (typeof navigator === "undefined" || typeof navigator.share !== "function") {
      return;
    }

    const url =
      typeof window !== "undefined" ? window.location.origin : "https://bilauitmcuti.com";
    const sharePayload = { title: SHARE_TITLE, text: SHARE_TEXT, url };

    try {
      if (navigator.canShare && !navigator.canShare(sharePayload)) return;
      await navigator.share(sharePayload);
      onShareComplete();
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") return;
    }
  }, [onShareComplete, requireRating]);

  const handleFeedback = useCallback(() => {
    if (!requireRating()) return;
    onFeedbackComplete();
    router.push("/feedback");
  }, [onFeedbackComplete, requireRating, router]);

  if (isMobileSheet) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent
          data-slot="engagement-prompt-drawer"
          className={drawerContentClassName}
        >
          <div className={cn(drawerBodyClassName, "gap-2")}>
            <DrawerTitle className="sr-only">Share &amp; feedback</DrawerTitle>
            <DrawerDescription className="sr-only">
              Share the app or send feedback.
            </DrawerDescription>
            <EngagementPromptBody
              rating={rating}
              hasRated={hasRated}
              isSubmittingRating={isSubmittingRating}
              canShare={canShare}
              showRateFirstHint={showRateFirstHint}
              onRatingChange={handleRatingChange}
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
      <DialogContent className="max-w-md gap-4 border border-border bg-popover p-4 sm:p-6">
        <DialogHeader className="sr-only">
          <DialogTitle>Share &amp; feedback</DialogTitle>
          <DialogDescription>Share the app or send feedback.</DialogDescription>
        </DialogHeader>
        <EngagementPromptBody
          rating={rating}
          hasRated={hasRated}
          isSubmittingRating={isSubmittingRating}
          canShare={canShare}
          showRateFirstHint={showRateFirstHint}
          onRatingChange={handleRatingChange}
          onFeedback={handleFeedback}
          onShare={handleShare}
        />
      </DialogContent>
    </Dialog>
  );
}
