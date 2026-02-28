import { Skeleton } from "@/components/ui/skeleton";
import type { ViewMode } from "@/app/page";

function HeaderSkeleton() {
  return (
    <div className="flex flex-col justify-center items-start gap-[2px] transition-none">
      <Skeleton className="mb-2 h-[30px] w-[52px] rounded-full bg-secondary/50 dark:bg-[#2A2A2A]" />
      <Skeleton className="mb-2 h-12 w-[290px] sm:w-[410px]" />
      <div className="flex flex-wrap gap-2 justify-start text-sm transition-none">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="flex items-center gap-2">
            <Skeleton className="h-2 w-2 rounded-full" />
            <Skeleton className="h-4 w-20 sm:w-24" />
          </div>
        ))}
      </div>
    </div>
  );
}

function ControlsSkeleton() {
  return (
    <div
      className="sticky top-0 z-40 bg-background -mx-4 sm:-mx-6 lg:-mx-4 px-4 sm:px-6 lg:px-4 transition-none isolate overflow-visible"
    >
      <div
        className="flex flex-row items-center justify-between gap-4 pt-8 w-full px-0 min-h-14 pb-1 bg-background transition-none"
      >
        <div className="px-0">
          <Skeleton className="w-[77px] sm:w-[86px] !h-[38px] rounded-lg bg-secondary dark:bg-[#2A2A2A]" />
        </div>

        <div className="px-0 flex items-center justify-center">
          <div
            className="flex items-center justify-center gap-0 rounded-lg p-1 w-fit bg-secondary dark:bg-[#2A2A2A] transition-none h-[38px]"
          >
            <Skeleton className="h-[38px] w-[38px] rounded-md bg-transparent" />
            <Skeleton className="h-[38px] w-[38px] rounded-md bg-transparent" />
            <Skeleton className="h-[38px] w-[38px] rounded-md bg-transparent" />
            <Skeleton className="h-[38px] w-[38px] rounded-md bg-transparent" />
          </div>
        </div>
      </div>
      <div className="calendar-controls-fade" />
    </div>
  );
}

function GridContentSkeleton() {
  return (
    <div className="mt-0 min-h-[400px] transition-none">
      <div className="space-y-8 transition-none">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 auto-rows-max transition-none">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="group relative w-full h-full transition-none">
              <div className="w-full pb-4 pt-3 px-0 transition-none">
                <Skeleton className="h-8 w-40" />
              </div>
              <div className="w-full mb-1 grid grid-cols-7 gap-0.5 transition-none">
                {Array.from({ length: 7 }).map((_, day) => (
                  <Skeleton key={day} className="h-4 w-full" />
                ))}
              </div>
              <div className="w-full grid grid-cols-7 gap-1 transition-none">
                {Array.from({ length: 35 }).map((_, dayCell) => (
                  <Skeleton key={dayCell} className="h-12 w-full rounded-lg" />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ListContentSkeleton() {
  return (
    <div className="mt-0 min-h-[400px] transition-none">
      <div className="space-y-8 bg-background transition-none">
        {Array.from({ length: 3 }).map((_, monthIndex) => (
          <div key={monthIndex} className="transition-none">
            <div className="-mx-3 pb-4 pt-3 transition-none">
              <Skeleton className="h-8 w-44" />
            </div>
            <div className="space-y-4 transition-none">
              {Array.from({ length: 4 }).map((_, itemIndex) => (
                <div key={itemIndex} className="flex gap-4 p-3 rounded-lg px-0 transition-none">
                  <div className="flex w-20 flex-col items-start text-xs transition-none">
                    <Skeleton className="h-3 w-10 mb-1" />
                    <Skeleton className="h-4 w-14" />
                  </div>
                  <div className="flex flex-1 flex-col transition-none">
                    <div className="flex items-center gap-2 w-fit mb-1 transition-none">
                      <Skeleton className="h-2 w-2 rounded-full" />
                      <Skeleton className="h-6 w-24 rounded-full" />
                    </div>
                    <Skeleton className="h-6 w-[75%] mb-2" />
                    <Skeleton className="h-4 w-28 mb-1" />
                    <Skeleton className="h-4 w-[65%]" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

interface CalendarPageSkeletonProps {
  viewMode?: ViewMode;
}

export function CalendarPageSkeleton({ viewMode = "grid" }: CalendarPageSkeletonProps) {
  return (
    <div className="min-h-screen bg-background text-foreground transition-none relative">
      <div className="mx-auto max-w-[1000px] px-4 py-8 sm:px-6 lg:px-4 transition-none">
        <HeaderSkeleton />
        <ControlsSkeleton />
        {viewMode === "list" ? <ListContentSkeleton /> : <GridContentSkeleton />}
      </div>
    </div>
  );
}
