import { memo, useMemo, useCallback, useSyncExternalStore } from 'react';
import { useCalendarHydrationVersion } from '@/components/calendar-hydration-context';
import { getSnapshot, subscribe } from '@/lib/calendar-store';
import { cn } from '@/lib/utils';
import {
  getActivitiesForList,
  getActivityListDisplayAnchorDate,
  groupActivitiesByListStartMonth,
  parseListMonthKey,
  formatDateRange,
  getDaysUntilStart,
  formatCountdown,
  getProgramBadgeConfig,
  getProgramBadgesConfig,
  type Activity,
  type ActivityFilterOptions,
  type ProgramGroup,
  type SessionId,
} from '@/lib/data';

interface ListViewProps {
  selectedProgram: string;
  selectedSessions: SessionId[];
  showKKT: boolean;
  showRegistration: boolean;
  showLecture: boolean;
  showSemesterPendek: boolean;
  showKuliahIntersesi: boolean;
  showExamination: boolean;
  showOthersExams: boolean;
  showBreak: boolean;
  showCountdown: boolean;
  onMonthChange?: (month: string) => void;
  selectedStates?: string[];
  /** Malaysia YYYY-MM-DD from RSC; keeps countdown row identical on SSR and first client paint */
  initialCurrentDate?: string;
}

function getMalaysiaTodayStr(): string {
  if (typeof window === 'undefined') return '';
  try {
    const now = new Date();
    const malaysiaTime = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Kuala_Lumpur' }));
    const y = malaysiaTime.getFullYear();
    const m = String(malaysiaTime.getMonth() + 1).padStart(2, '0');
    const d = String(malaysiaTime.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  } catch {
    return '';
  }
}

export const ListView = memo(function ListView({ 
  selectedProgram, 
  selectedSessions,
  showKKT,
  showRegistration,
  showLecture,
  showSemesterPendek,
  showKuliahIntersesi,
  showExamination,
  showOthersExams,
  showBreak,
  showCountdown,
  onMonthChange,
  selectedStates = [],
  initialCurrentDate,
}: ListViewProps) {
  const hydrationServerVersion = useCalendarHydrationVersion();
  const calendarDataVersion = useSyncExternalStore(
    subscribe,
    () => getSnapshot().version,
    () => hydrationServerVersion
  );
  const todayStr = useMemo(() => {
    if (initialCurrentDate) return initialCurrentDate;
    return getMalaysiaTodayStr();
  }, [initialCurrentDate]);

  // Helper function untuk format date - always calculates correctly
  const formatDateSafe = (dateStr: string) => {
    const [year, monthNum, day] = dateStr.split('-').map(Number);
    const startDate = new Date(Date.UTC(year, monthNum - 1, day));
    return {
      dayName: startDate.toLocaleString('en-US', { weekday: 'short', timeZone: 'UTC' }),
      dayNum: String(startDate.getUTCDate()),
      monthShort: startDate.toLocaleString('en-US', { month: 'short', timeZone: 'UTC' })
    };
  };
  
  const getProgramGroup = (program: string): ProgramGroup => {
    if (program === 'Foundation/Professional' || program === 'Foundation' || program === 'Professional') return 'A';
    return 'B';
  };

  const listFilterOptions = useMemo<ActivityFilterOptions>(
    () => ({
      selectedProgram,
      showRegistration,
      showLecture,
      showSemesterPendek,
      showKuliahIntersesi,
      showExamination,
      showOthersExams,
      showBreak,
    }),
    [
      selectedProgram,
      showRegistration,
      showLecture,
      showSemesterPendek,
      showKuliahIntersesi,
      showExamination,
      showOthersExams,
      showBreak,
    ]
  );

  const group = useMemo(() => getProgramGroup(selectedProgram), [selectedProgram]);
  const shouldMergePartTimeForAllList = useMemo(
    () => group === 'B' && selectedProgram === 'All',
    [group, selectedProgram]
  );

  const getNormalizedProgramType = useCallback((programType?: string): string => {
    if (!programType) return '';
    if (!shouldMergePartTimeForAllList) return programType;
    if (programType === 'DiplomaPartTime' || programType === 'BachelorPartTime') return 'PartTime';
    return programType;
  }, [shouldMergePartTimeForAllList]);
  
  const listActivities = useMemo(() => {
    void calendarDataVersion;
    return getActivitiesForList(selectedSessions, listFilterOptions);
  }, [selectedSessions, listFilterOptions, calendarDataVersion]);

  // One list row per activity (multi-session merge; Part-Time merge on Group B "All").
  const uniqueActivities = useMemo(
    () =>
      Array.from(
        new Map(
          listActivities.map((activity) => {
            const dedupeKey = [
              activity.name,
              activity.startDate,
              activity.endDate || '',
              activity.type,
              activity.details || '',
              activity.duration || '',
              activity.regionalStartDate || '',
              activity.regionalEndDate || '',
              activity.allStudents ? '1' : '0',
              activity.programTypes?.length ? activity.programTypes.join(',') : getNormalizedProgramType(activity.programType),
            ].join('|');

            return [dedupeKey, activity] as const;
          })
        ).values()
      ).sort((a, b) => {
        const dateCompare = new Date(a.startDate).getTime() - new Date(b.startDate).getTime();
        if (dateCompare !== 0) return dateCompare;
        return a.name.localeCompare(b.name);
      }),
    [listActivities, getNormalizedProgramType]
  );

  const groupedByMonth = useMemo(
    () => groupActivitiesByListStartMonth(uniqueActivities),
    [uniqueActivities]
  );

  const getActivityColor = (activity: Activity) => {
    if (activity.type === 'registration') return 'bg-[#d1d5db]';
    if (activity.type === 'lecture') return 'bg-[#8b5cf6]';
    if (activity.type === 'examination') return 'bg-[#dc2626]';
    if (activity.type === 'break') return 'bg-[#10b981]';
    return 'bg-muted';
  };

  const sortedMonths = useMemo(
    () =>
      Object.keys(groupedByMonth).sort((a, b) => {
        const pa = parseListMonthKey(a);
        const pb = parseListMonthKey(b);
        return pa.year !== pb.year ? pa.year - pb.year : pa.month - pb.month;
      }),
    [groupedByMonth]
  );

  const hasAnyActivities = uniqueActivities.length > 0;

  const bgClass = 'bg-background';
  const textClass = 'text-foreground';
  const mutedClass = 'text-muted-foreground';
  const borderClass = 'border-border';

  return (
    <div className={`space-y-8 ${bgClass} transition-none`} suppressHydrationWarning>
      {!hasAnyActivities ? (
        <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
          <p className={`text-lg font-medium ${textClass} mb-2`}>No activities match your filters</p>
          <p className={`text-sm ${mutedClass} max-w-md`}>
            Try adjusting the filter toggles above to see registration, lectures, exams, or breaks.
          </p>
        </div>
      ) : sortedMonths.map((month) => {
        // Hide months with no activities
        if (!groupedByMonth[month] || groupedByMonth[month].length === 0) {
          return null;
        }
        
        return (
        <div key={month} suppressHydrationWarning className="transition-none">
          <div className="-mx-3 pb-4 pt-3 transition-none" suppressHydrationWarning>
            <h3 className={`font-semibold text-xl leading-7 text-left ${textClass} px-3 transition-none`} suppressHydrationWarning>{month}</h3>
          </div>
          
          <div className="space-y-4 transition-none" suppressHydrationWarning>
            {groupedByMonth[month] && groupedByMonth[month].length > 0 ? (
              groupedByMonth[month].map((activity) => {
                const dateStr = getActivityListDisplayAnchorDate(activity, showKKT);
                const badgeConfigs = getProgramBadgesConfig(activity, selectedProgram);
                const singleBadgeConfig = getProgramBadgeConfig(activity);
                const hasAnyProgramBadge = singleBadgeConfig || badgeConfigs.length > 0;
                const hasThreeOrMoreBadgesOnAllList = selectedProgram === 'All' && badgeConfigs.length >= 3;
                
                // Format date using SSR-safe helper function
                const formattedDate = formatDateSafe(dateStr);
                
                // Check if this activity has KKT-specific dates
                const hasKKTVariant = activity.regionalStartDate || activity.regionalEndDate;

                return (
                  <div key={`${activity.name}|${activity.startDate}|${activity.programType ?? ''}|${activity.endDate ?? ''}`} className="flex gap-4 p-3 rounded-lg px-0 transition-none" suppressHydrationWarning>
                    {/* Date column */}
                    <div className={`flex w-20 flex-col items-start text-xs ${mutedClass} transition-none`} suppressHydrationWarning>
                      <div className="transition-none" suppressHydrationWarning>
                        {formattedDate.dayName}
                      </div>
                      <div className={`text-sm font-medium ${textClass} transition-none`} suppressHydrationWarning>
                        {formattedDate.monthShort 
                          ? `${formattedDate.dayNum} ${formattedDate.monthShort}` 
                          : formattedDate.dayNum}
                      </div>
                      {showCountdown && ['lecture', 'examination', 'break'].includes(activity.type) && todayStr && (() => {
                        const days = getDaysUntilStart(activity, todayStr, showKKT);
                        return days != null ? (
                          <div className={`text-xs ${mutedClass} mt-0.5 transition-none`} suppressHydrationWarning>
                            {formatCountdown(days)}
                          </div>
                        ) : null;
                      })()}
                    </div>
                    
                    {/* Activity info */}
                    <div className="flex flex-1 flex-col transition-none" suppressHydrationWarning>
                      {hasAnyProgramBadge ? (
                        <div
                          className={cn(
                            'mb-1 flex w-fit flex-wrap gap-2 pl-4 transition-none',
                            hasThreeOrMoreBadgesOnAllList && 'flex-nowrap max-[375px]:gap-1.5 max-[320px]:gap-1',
                          )}
                          suppressHydrationWarning
                        >
                          {badgeConfigs.length > 0
                            ? badgeConfigs.map((cfg) => (
                                <div
                                  key={cfg.label}
                                  className={cn(
                                    'inline-block rounded-full font-medium transition-none',
                                    hasThreeOrMoreBadgesOnAllList
                                      ? 'py-1 px-3 text-xs leading-4 max-[375px]:py-0.5 max-[375px]:px-2 max-[375px]:text-[10px] max-[320px]:px-1.5 max-[320px]:text-[9px]'
                                      : 'py-1 px-3 text-xs',
                                    cfg.bgClass,
                                    cfg.textClass,
                                  )}
                                  suppressHydrationWarning
                                >
                                  {cfg.label}
                                </div>
                              ))
                            : singleBadgeConfig && (
                                <div
                                  className={cn(
                                    'inline-block rounded-full font-medium transition-none',
                                    hasThreeOrMoreBadgesOnAllList
                                      ? 'py-1 px-3 text-xs leading-4 max-[375px]:py-0.5 max-[375px]:px-2 max-[375px]:text-[10px] max-[320px]:px-1.5 max-[320px]:text-[9px]'
                                      : 'py-1 px-3 text-xs',
                                    singleBadgeConfig.bgClass,
                                    singleBadgeConfig.textClass,
                                  )}
                                  suppressHydrationWarning
                                >
                                  {singleBadgeConfig.label}
                                </div>
                              )}
                        </div>
                      ) : null}
                      <div className="mb-1 flex items-start gap-2 transition-none" suppressHydrationWarning>
                        <div className="flex h-[1lh] shrink-0 items-center text-base leading-6" suppressHydrationWarning>
                          <div
                            className={cn('h-2 w-2 shrink-0 rounded-full transition-none', getActivityColor(activity))}
                            aria-hidden
                            suppressHydrationWarning
                          />
                        </div>
                        <h3
                          className={cn(
                            'min-w-0 flex-1 font-medium break-words transition-none',
                            hasThreeOrMoreBadgesOnAllList
                              ? 'text-base leading-6 max-[375px]:text-sm max-[375px]:leading-5 max-[320px]:text-xs max-[320px]:leading-4'
                              : 'text-base leading-6',
                            textClass,
                          )}
                          suppressHydrationWarning
                        >
                          {activity.name}
                        </h3>
                      </div>
                      
                      {/* Date and other details */}
                      <div className="w-full transition-none" suppressHydrationWarning>
                        <p className={`text-sm leading-5 break-words ${mutedClass} transition-none`} suppressHydrationWarning>
                          {showKKT && activity.regionalStartDate
                            ? formatDateRange(activity.regionalStartDate, activity.regionalEndDate)
                            : formatDateRange(activity.startDate, activity.endDate)}
                        </p>
                        {activity.duration ? (
                          <p className={`mt-1 text-sm font-normal leading-4 break-words ${mutedClass}`} suppressHydrationWarning>
                            Duration: {activity.duration}
                          </p>
                        ) : null}
                        {activity.details ? (
                          <p className={`mt-1 text-sm font-normal leading-4 break-words ${mutedClass}`} suppressHydrationWarning>
                            {activity.details}
                          </p>
                        ) : null}
                        {hasKKTVariant && showKKT ? (
                          <p className="mt-1 text-xs leading-4 text-blue-500 italic" suppressHydrationWarning>
                            *Kedah, Kelantan & Terengganu
                          </p>
                        ) : null}
                      </div>
                    </div>
                  </div>
                );
              })
            ) : null}
          </div>
        </div>
        );
      })}
    </div>
  );
});
