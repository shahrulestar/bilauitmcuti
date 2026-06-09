"use client";

import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

interface StarRatingProps {
  rating: number;
  onRatingChange: (value: number) => void;
  disabled?: boolean;
  centered?: boolean;
  className?: string;
}

export function StarRating({
  rating,
  onRatingChange,
  disabled = false,
  centered = false,
  className,
}: StarRatingProps) {
  return (
    <div
      className={cn(
        "flex flex-col gap-2",
        centered && "items-center",
        className
      )}
    >
      <div
        className={cn("flex items-center gap-1", centered && "justify-center")}
        role="group"
        aria-label="Experience rating"
        data-vaul-no-drag=""
      >
        {[1, 2, 3, 4, 5].map((value) => (
          <button
            key={value}
            type="button"
            disabled={disabled}
            data-vaul-no-drag=""
            aria-label={`${value} star${value === 1 ? "" : "s"}`}
            aria-pressed={rating >= value ? "true" : "false"}
            onClick={() => onRatingChange(value)}
            className="touch-manipulation rounded-md p-1 transition-colors hover:bg-muted outline-none focus:outline-none focus-visible:outline-none disabled:opacity-50"
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
