import { memo, useMemo, useCallback, useSyncExternalStore } from 'react';
import { useCalendarHydrationVersion } from '@/components/calendar-hydration-context';
import { getSnapshot, subscribe } from '@/lib/calendar-store';
import { getActivitiesForMonthMultiSessions, getMonthsForSessions, formatDateRange, getDaysUntilStart, formatCountdown, getProgramBadgeConfig, getProgramBadgesConfig, type ProgramGroup, type SessionId } from '@/lib/data';

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

  const shouldShowActivity = useCallback((type: string, activity?: any): boolean => {
    if (type === 'registration' && !showRegistration) return false;
    if (type === 'lecture' && !showLecture) return false;
    if (type === 'examination' && !showExamination) return false;
    if (type === 'break' && !showBreak) return false;
    
    // Filter out Short Semester if toggle is off
    if (
      type === 'lecture' &&
      (activity?.name?.includes('Short Semester') || activity?.name?.includes('Semester Pendek')) &&
      !showSemesterPendek
    ) return false;
    
    // Filter out Intersession Classes if toggle is off
    if (
      type === 'lecture' &&
      (activity?.name?.includes('Intersession Classes') || activity?.name?.includes('Intersesi')) &&
      !showKuliahIntersesi
    ) return false;
    
    // Filter out Others Exams (Khas + English Exit Test) if toggle is off
    if (type === 'examination' && (activity?.name?.includes('Khas') || activity?.name?.includes('English Exit Test') || activity?.name?.includes('EET Lisan')) && !showOthersExams) return false;
    
    // Handle "All" option - show all Group B activities (semua and every programType)
    if (selectedProgram === 'All') {
      return true;
    }
    
    // Filter by program type or programTypes
    if (activity?.programTypes?.length) {
      return activity.programTypes.includes(selectedProgram);
    }
    if (activity?.programType && activity.programType !== selectedProgram) return false;
    
    return true;
  }, [
    showRegistration,
    showLecture,
    showExamination,
    showBreak,
    showSemesterPendek,
    showKuliahIntersesi,
    showOthersExams,
    selectedProgram,
  ]);

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
  
  const months = useMemo(
    () => {
      void calendarDataVersion;
      return getMonthsForSessions(selectedSessions, {
        selectedProgram,
        showRegistration,
        showLecture,
        showExamination,
        showOthersExams,
        showBreak,
        showSemesterPendek,
        showKuliahIntersesi,
        showKKT,
      });
    },
    [
      selectedSessions,
      selectedProgram,
      showRegistration,
      showLecture,
      showExamination,
      showOthersExams,
      showBreak,
      showSemesterPendek,
      showKuliahIntersesi,
      showKKT,
      calendarDataVersion,
    ]
  );

  const activities = useMemo(
    () => {
      void calendarDataVersion;
      return months.flatMap(({ month, year }) =>
        getActivitiesForMonthMultiSessions(year, month, selectedSessions, showKKT)
      );
    },
    [months, selectedSessions, showKKT, calendarDataVersion]
  );

  // Filter activities by program type BEFORE deduplication to ensure correct filtering
  const filteredActivities = useMemo(
    () => activities.filter((a) => shouldShowActivity(a.type, a)),
    [activities, shouldShowActivity]
  );

  // Filter out duplicate activities.
  // For Group B "All" list, merge Diploma/Bachelor Part-Time duplicates into one row.
  const uniqueActivities = useMemo(
    () =>
      Array.from(
        new Map(
          filteredActivities.map((activity) => {
            const dedupeKey = [
              activity.name,
              activity.startDate,
              activity.endDate || '',
              activity.type,
              activity.details || '',
              activity.duration || '',
              activity.regionalStartDate || '',
              activity.regionalEndDate || '',
              activity.semua ? '1' : '0',
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
    [filteredActivities, getNormalizedProgramType]
  );

  // Group activities by month - use UTC to ensure consistency
  const groupedByMonth = useMemo(
    () =>
      uniqueActivities.reduce((acc, activity) => {
        const [year, month, day] = activity.startDate.split('-').map(Number);
        const date = new Date(Date.UTC(year, month - 1, day));
        const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
        const monthKey = `${monthNames[date.getUTCMonth()]} ${date.getUTCFullYear()}`;
        if (!acc[monthKey]) {
          acc[monthKey] = [];
        }
        acc[monthKey].push(activity);
        return acc;
      }, {} as Record<string, typeof uniqueActivities>),
    [uniqueActivities]
  );

  const getActivityColor = (activity: any) => {
    if (activity.type === 'registration') return 'bg-[#d1d5db]';
    if (activity.type === 'lecture') return 'bg-[#8b5cf6]';
    if (activity.type === 'examination') return 'bg-[#dc2626]';
    if (activity.type === 'break') return 'bg-[#10b981]';
    return 'bg-muted';
  };

  const monthNames = useMemo(
    () => ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
    []
  );
  const parseMonthKey = useCallback((key: string) => {
    const [name, yearStr] = key.split(' ');
    const month = monthNames.indexOf(name) + 1;
    const year = parseInt(yearStr ?? '0', 10);
    return { year, month };
  }, [monthNames]);
  const sortedMonths = useMemo(
    () =>
      Object.keys(groupedByMonth).sort((a, b) => {
        const pa = parseMonthKey(a);
        const pb = parseMonthKey(b);
        return pa.year !== pb.year ? pa.year - pb.year : pa.month - pb.month;
      }),
    [groupedByMonth, parseMonthKey]
  );

  // Filter activities based on visibility toggles and states
  const filteredGroupedByMonth = useMemo(
    () =>
      Object.entries(groupedByMonth).reduce((acc, [month, activities]) => {
        acc[month] = activities.filter((a) => shouldShowActivity(a.type, a));
        return acc;
      }, {} as Record<string, typeof uniqueActivities>),
    [groupedByMonth, shouldShowActivity]
  );

  const hasAnyActivities = useMemo(
    () => sortedMonths.some((m) => (filteredGroupedByMonth[m]?.length ?? 0) > 0),
    [sortedMonths, filteredGroupedByMonth]
  );

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
        if (!filteredGroupedByMonth[month] || filteredGroupedByMonth[month].length === 0) {
          return null;
        }
        
        return (
        <div key={month} suppressHydrationWarning className="transition-none">
          <div className="-mx-3 pb-4 pt-3 transition-none" suppressHydrationWarning>
            <h3 className={`font-semibold text-xl leading-7 text-left ${textClass} px-3 transition-none`} suppressHydrationWarning>{month}</h3>
          </div>
          
          <div className="space-y-4 transition-none" suppressHydrationWarning>
            {filteredGroupedByMonth[month] && filteredGroupedByMonth[month].length > 0 ? (
              filteredGroupedByMonth[month].map((activity) => {
                // Use regional dates if KKT filter is on
                const useRegionalDate = showKKT && activity.regionalStartDate;
                const dateStr = useRegionalDate ? activity.regionalStartDate! : activity.startDate;
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
                      {/* Group B with badge: dot + badge(s) in one row above title (container fit content, left align, gap-2 like dot-title) */}
                      {group === 'B' && hasAnyProgramBadge ? (
                        <>
                          <div className={`flex items-center w-fit mb-1 transition-none ${hasThreeOrMoreBadgesOnAllList ? 'flex-nowrap gap-2 max-[375px]:gap-1.5 max-[320px]:gap-1' : 'flex-wrap gap-2'}`} suppressHydrationWarning>
                            <div className={`h-2 w-2 shrink-0 rounded-full ${getActivityColor(activity)} transition-none`} suppressHydrationWarning />
                            {badgeConfigs.length > 0
                              ? badgeConfigs.map((cfg) => (
                                  <div key={cfg.label} className={`inline-block rounded-full font-medium transition-none ${hasThreeOrMoreBadgesOnAllList ? 'py-1 px-3 text-xs leading-4 max-[375px]:py-0.5 max-[375px]:px-2 max-[375px]:text-[10px] max-[320px]:px-1.5 max-[320px]:text-[9px]' : 'py-1 px-3 text-xs'} ${cfg.bgClass} ${cfg.textClass}`} suppressHydrationWarning>
                                    {cfg.label}
                                  </div>
                                ))
                              : singleBadgeConfig && (
                                  <div className={`inline-block rounded-full font-medium transition-none ${hasThreeOrMoreBadgesOnAllList ? 'py-1 px-3 text-xs leading-4 max-[375px]:py-0.5 max-[375px]:px-2 max-[375px]:text-[10px] max-[320px]:px-1.5 max-[320px]:text-[9px]' : 'py-1 px-3 text-xs'} ${singleBadgeConfig.bgClass} ${singleBadgeConfig.textClass}`} suppressHydrationWarning>
                                    {singleBadgeConfig.label}
                                  </div>
                                )}
                          </div>
                          <h3 className={`font-medium ${hasThreeOrMoreBadgesOnAllList ? 'text-base leading-6 max-[375px]:text-sm max-[375px]:leading-5 max-[320px]:text-xs max-[320px]:leading-4' : 'text-base leading-6'} break-words ${textClass} mb-1 transition-none`} suppressHydrationWarning>{activity.name}</h3>
                        </>
                      ) : (
                        <>
                          {/* Group A or no badge: dot and h3 title in same row */}
                          <div className="flex items-start gap-2 mb-1 transition-none" suppressHydrationWarning>
                            <div className={`h-2 w-2 shrink-0 rounded-full mt-2 ${getActivityColor(activity)} transition-none`} suppressHydrationWarning />
                            <h3 className={`font-medium text-base leading-6 break-words ${textClass} transition-none`} suppressHydrationWarning>{activity.name}</h3>
                          </div>
                          {/* Badge row for Group A (if exists) */}
                          {singleBadgeConfig ? (
                            <div className="flex items-center mb-1 transition-none" suppressHydrationWarning>
                              <div className={`inline-block py-1 rounded-full text-xs font-medium px-3 ${singleBadgeConfig.bgClass} ${singleBadgeConfig.textClass} transition-none`} suppressHydrationWarning>
                                {singleBadgeConfig.label}
                              </div>
                            </div>
                          ) : null}
                        </>
                      )}
                      
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
