"use client";

import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

interface StarRatingProps {
  rating: number;
  onRatingChange: (value: number) => void;
  disabled?: boolean;
  label?: string;
  className?: string;
}

export function StarRating({
  rating,
  onRatingChange,
  disabled = false,
  label = "How has your experience been so far?",
  className,
}: StarRatingProps) {
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <p className="text-xs text-muted-foreground">{label}</p>
      <div
        className="flex items-center gap-1"
        role="group"
        aria-label="Experience rating"
      >
        {[1, 2, 3, 4, 5].map((value) => (
          <button
            key={value}
            type="button"
            disabled={disabled}
            aria-label={`${value} star${value === 1 ? "" : "s"}`}
            aria-pressed={rating >= value ? "true" : "false"}
            onClick={() => onRatingChange(value)}
            className="rounded-md p-1 transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 disabled:opacity-50"
          >
            <Star
              className={cn(
                "size-7",
                rating >= value
                  ? "fill-amber-400 text-amber-400"
                  : "fill-transparent text-muted-foreground"
              )}
              strokeWidth={1.5}
            />
          </button>
        ))}
      </div>
    </div>
  );
}
