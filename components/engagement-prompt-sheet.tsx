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
import { StarRating } from "@/components/star-rating";
import { shareOrCopyLink } from "@/lib/web-share";
import { getPageShareUrl } from "@/lib/share-url";
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
  onRatingChange,
  onFeedback,
  onShare,
}: {
  rating: number;
  onRatingChange: (value: number) => void;
  onFeedback: () => void;
  onShare: () => void;
}) {
  return (
    <div className="flex w-full flex-col gap-5">
      <p className="text-sm text-muted-foreground">
        Share this calendar with coursemates, or tell us what we can improve.
      </p>

      <div className="flex flex-col gap-1">
        <StarRating
          rating={rating}
          onRatingChange={onRatingChange}
          className="items-center text-center md:items-start md:text-left"
        />
      </div>

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
  const latestSubmittedRatingRef = useRef(0);

  useEffect(() => {
    if (!open) return;
    setRating(0);
    latestSubmittedRatingRef.current = 0;
  }, [open]);

  const handleRatingChange = useCallback(
    (value: number) => {
      setRating(value);
      latestSubmittedRatingRef.current = value;

      void (async () => {
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
        } catch {
          if (latestSubmittedRatingRef.current === value) {
            toast.error(
              "Could not save your rating. You can still share or send feedback."
            );
          }
        }
      })();
    },
    [onRatingComplete]
  );

  const handleShare = useCallback(async () => {
    const url = getPageShareUrl();
    const result = await shareOrCopyLink({
      title: SHARE_TITLE,
      text: SHARE_TEXT,
      url,
    });

    if (result === "shared" || result === "copied") {
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
          onRatingChange={handleRatingChange}
          onFeedback={handleFeedback}
          onShare={handleShare}
        />
      </DialogContent>
    </Dialog>
  );
}
