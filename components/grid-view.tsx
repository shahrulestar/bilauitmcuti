'use client';

import React, { memo } from "react"
import { ChevronDown, ChevronUp } from 'lucide-react';

import { useState, useEffect, useMemo } from 'react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { getActivitiesForDateMultiSessions, getMonthsForSessions, getDaysUntilStart, formatCountdown, getProgramBadgeConfig, getProgramBadgesConfig, type Activity, type ActivityType, type SessionId } from '@/lib/data';

interface TooltipActivityListProps {
  dateKey: string;
  activities: Activity[];
  selectedProgram: string;
  showCountdown: boolean;
  currentDateStr: string | null;
  showKKT: boolean;
}

function TooltipActivityList({
  dateKey,
  activities,
  selectedProgram,
  showCountdown,
  currentDateStr,
  showKKT,
}: TooltipActivityListProps) {
  const PAGE_SIZE = 8;
  const [startIndex, setStartIndex] = useState(0);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mediaQuery = window.matchMedia('(max-width: 640px)');
    const sync = () => setIsMobile(mediaQuery.matches);
    sync();
    mediaQuery.addEventListener('change', sync);
    return () => mediaQuery.removeEventListener('change', sync);
  }, []);

  useEffect(() => {
    setStartIndex(0);
  }, [dateKey, activities.length]);

  const shouldPaginate = isMobile && activities.length > PAGE_SIZE;
  const hasPrev = startIndex > 0;
  const hasNext = startIndex + PAGE_SIZE < activities.length;
  const visible = shouldPaginate
    ? activities.slice(startIndex, startIndex + PAGE_SIZE)
    : activities;

  return (
    <div className="w-full py-2">
      {shouldPaginate && hasPrev ? (
        <div className="pb-1">
          <button
            type="button"
            onClick={() => setStartIndex((prev) => Math.max(0, prev - 1))}
            className="flex h-6 w-full items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-accent-foreground"
            aria-label="Show previous events"
          >
            <ChevronUp className="h-4 w-4" />
          </button>
        </div>
      ) : null}

      <div className="space-y-2">
        {visible.map((activity, idx) => {
          const dotColor =
            activity.type === 'registration' ? 'bg-[#d1d5db]' :
            activity.type === 'lecture' ? 'bg-[#8b5cf6]' :
            activity.type === 'examination' ? 'bg-[#dc2626]' :
            activity.type === 'break' ? 'bg-[#10b981]' : 'bg-gray-400';
          const countdownTypes: ActivityType[] = ['lecture', 'examination', 'break'];
          const days = showCountdown && countdownTypes.includes(activity.type) && currentDateStr
            ? getDaysUntilStart(activity, currentDateStr, showKKT)
            : null;
          const badgeConfigs = selectedProgram === 'All'
            ? getProgramBadgesConfig(activity, selectedProgram).length > 0
              ? getProgramBadgesConfig(activity, selectedProgram)
              : getProgramBadgeConfig(activity) ? [getProgramBadgeConfig(activity)!] : []
            : getProgramBadgesConfig(activity, selectedProgram).length > 0
              ? getProgramBadgesConfig(activity, selectedProgram)
              : getProgramBadgeConfig(activity) ? [getProgramBadgeConfig(activity)!] : [];
          // Tooltip should show clean "name" (from calendar.json) + optional countdown only.
          // We intentionally do NOT concatenate `details` into the name.
          const label = activity.name;
          const displayName = days != null ? `${label} (${formatCountdown(days)})` : label;

          return (
            <div key={`${activity.name}|${activity.startDate}|${idx}`} className="grid grid-cols-[auto_minmax(0,1fr)] items-start gap-2 transition-none">
              <div className={`h-2 w-2 rounded-full mt-1 flex-shrink-0 ${dotColor} transition-none`} />
              <div className="min-w-0">
                {badgeConfigs.length > 0 ? (
                  <div className="mb-1 flex flex-wrap gap-1">
                    {badgeConfigs.map((cfg) => (
                      <div key={cfg.label} className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-medium ${cfg.bgClass} ${cfg.textClass}`}>
                        {cfg.label}
                      </div>
                    ))}
                  </div>
                ) : null}
                <p className="text-xs leading-relaxed whitespace-normal text-wrap break-words [overflow-wrap:anywhere] line-clamp-3 transition-none">{displayName}</p>
              </div>
            </div>
          );
        })}
      </div>

      {shouldPaginate && hasNext ? (
        <div className="pt-1">
          <button
            type="button"
            onClick={() => setStartIndex((prev) => Math.min(activities.length - PAGE_SIZE, prev + 1))}
            className="flex h-6 w-full items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-accent-foreground"
            aria-label="Show next events"
          >
            <ChevronDown className="h-4 w-4" />
          </button>
        </div>
      ) : null}
    </div>
  );
}

interface GridViewProps {
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
  initialCurrentDate?: string;
}

function MiniCalendar({ month, year, selectedProgram, selectedSessions, showKKT, onDateClick, selectedDate, showRegistration, showLecture, showSemesterPendek, showKuliahIntersesi, showExamination, showOthersExams, showBreak, showCountdown, selectedStates = [], initialCurrentDate, tooltipOpenKey, hoveredDateStr, setTooltipOpenKey, setHoveredDateStr }: { month: number; year: number; selectedProgram: string; selectedSessions: SessionId[]; showKKT: boolean; onDateClick: (date: string) => void; selectedDate: string | null; showRegistration: boolean; showLecture: boolean; showSemesterPendek: boolean; showKuliahIntersesi: boolean; showExamination: boolean; showOthersExams: boolean; showBreak: boolean; showCountdown: boolean; selectedStates?: string[]; initialCurrentDate?: string; tooltipOpenKey: string | null; hoveredDateStr: string | null; setTooltipOpenKey: React.Dispatch<React.SetStateAction<string | null>>; setHoveredDateStr: React.Dispatch<React.SetStateAction<string | null>> }) {
  const [hasHoverCapability, setHasHoverCapability] = useState(false);
  const [hasTouchInput, setHasTouchInput] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const hoverMq = window.matchMedia('(hover: hover) and (pointer: fine)');
    const touchMq = window.matchMedia('(hover: none), (pointer: coarse)');
    const syncCapability = () => {
      const touchCapable = touchMq.matches || (navigator.maxTouchPoints ?? 0) > 0;
      setHasTouchInput(touchCapable);
      setHasHoverCapability(hoverMq.matches);
    };

    syncCapability();
    hoverMq.addEventListener('change', syncCapability);
    touchMq.addEventListener('change', syncCapability);
    return () => {
      hoverMq.removeEventListener('change', syncCapability);
      touchMq.removeEventListener('change', syncCapability);
    };
  }, []);

  const isDesktopHoverMode = hasHoverCapability && !hasTouchInput;

  useEffect(() => {
    if (isDesktopHoverMode) return;
    setHoveredDateStr(null);
    setTooltipOpenKey(null);
  }, [isDesktopHoverMode, setHoveredDateStr, setTooltipOpenKey]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!tooltipOpenKey || isDesktopHoverMode) return;

    const closeTooltip = () => setTooltipOpenKey(null);
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target) return;
      if (target.closest('[data-mini-calendar-trigger]')) return;
      if (target.closest('[data-mini-calendar-tooltip]')) return;
      closeTooltip();
    };

    window.addEventListener('scroll', closeTooltip, true);
    window.addEventListener('pointerdown', handlePointerDown);
    return () => {
      window.removeEventListener('scroll', closeTooltip, true);
      window.removeEventListener('pointerdown', handlePointerDown);
    };
  }, [tooltipOpenKey, isDesktopHoverMode, setTooltipOpenKey]);

  // Initialize currentDateStr synchronously on client to prevent hydration mismatch
  // This ensures the same value is used on first render (client-side)
  const getInitialCurrentDate = (): string | null => {
    if (typeof window === 'undefined') return null;
    
    try {
      const now = new Date();
      // Convert to Malaysia time (UTC+8)
      const malaysiaTime = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Kuala_Lumpur' }));
      const year = malaysiaTime.getFullYear();
      const month = String(malaysiaTime.getMonth() + 1).padStart(2, '0');
      const day = String(malaysiaTime.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    } catch {
      return null;
    }
  };

  const [currentDateStr, setCurrentDateStr] = useState<string | null>(() => initialCurrentDate ?? getInitialCurrentDate());

  const isKKTStates = selectedStates.some(state => ['Kedah', 'Kelantan', 'Terengganu'].includes(state));
  
  // Update current date every minute to catch date changes
  useEffect(() => {
    const getMalaysiaDate = () => {
      const now = new Date();
      // Convert to Malaysia time (UTC+8)
      const malaysiaTime = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Kuala_Lumpur' }));
      const year = malaysiaTime.getFullYear();
      const month = String(malaysiaTime.getMonth() + 1).padStart(2, '0');
      const day = String(malaysiaTime.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };
    
    // Set current date immediately on mount (after hydration)
    setCurrentDateStr(getMalaysiaDate());
    
    // Update every minute to catch date changes
    const interval = setInterval(() => {
      setCurrentDateStr(getMalaysiaDate());
    }, 60000); // Update every minute
    
    return () => clearInterval(interval);
  }, []);
  
  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const filterOptions = useMemo(
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

  const monthsForRange = useMemo(
    () =>
      getMonthsForSessions(selectedSessions, {
        selectedProgram,
        showRegistration,
        showLecture,
        showExamination,
        showOthersExams,
        showBreak,
        showSemesterPendek,
        showKuliahIntersesi,
        showKKT,
      }),
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
    ]
  );

  const getActivityPriority = (activity: Activity, allDayActivities?: Activity[]): number => {
    const { type, name } = activity;
    if (type === 'examination') return 0;
    if (type === 'break') return 1;
    if (type === 'lecture') {
      if (/^(Lecture|Kuliah)\s+\d+$/.test(name)) return 2;
      if ((name.includes('Short Semester') || name.includes('Semester Pendek')) && allDayActivities) {
        const hasSemesterPendek = allDayActivities.some(a => a.name.includes('Short Semester') || a.name.includes('Semester Pendek'));
        const hasLectureIntersesi = allDayActivities.some(a => a.name.includes('Intersession Classes') || a.name.includes('Intersesi'));
        const hasCutiSemester = allDayActivities.some(a => a.name.includes('Cuti Semester'));
        if (hasSemesterPendek && (hasLectureIntersesi || hasCutiSemester)) return 1;
      }
      if (name.includes('Short Semester') || name.includes('Semester Pendek')) return 3;
      if (name.includes('Intersession Classes') || name.includes('Intersesi')) return 4;
      return 5;
    }
    if (type === 'registration') return 6;
    return 7;
  };

  const daysInMonth = new Date(year, month, 0).getDate();
  const firstDayOfMonth = new Date(year, month - 1, 1).getDay();
  
  // Always use Monday-Sunday layout (7 columns, Sunday = 6, Monday = 0)
  // Convert Sunday (0) to position 6 for Monday-start layout
  const adjustedFirstDay = firstDayOfMonth === 0 ? 6 : firstDayOfMonth - 1;
  
  const dayCells = [];
  
  // Add empty cells for days before month starts
  for (let i = 0; i < adjustedFirstDay; i++) {
    dayCells.push(null);
  }
  
  // Add day cells
  for (let day = 1; day <= daysInMonth; day++) {
    dayCells.push(day);
  }

  const dayActivitiesMap = useMemo(() => {
    const map = new Map<number, Activity[]>();
    if (selectedSessions.length === 0) return map;
    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const activities = getActivitiesForDateMultiSessions(dateStr, selectedSessions, showKKT, filterOptions);
      activities.sort((a, b) => getActivityPriority(a, activities) - getActivityPriority(b, activities));
      map.set(day, activities);
    }
    return map;
  }, [daysInMonth, filterOptions, month, selectedSessions, showKKT, year]);

  // Single source for day activities - used by tooltip, colors, dots, ring/border
  const getDayActivities = (day: number | null): Activity[] => {
    if (!day) return [];
    return dayActivitiesMap.get(day) ?? [];
  };
  
  // Helper function to check if date is weekend based on selected states
  const isWeekend = (day: number | null) => {
    if (!day) return false;
    const date = new Date(year, month - 1, day);
    const dayOfWeek = date.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
    
    // If Kedah, Kelantan, or Terengganu states are selected, weekend is Friday (5) and Saturday (6)
    if (selectedStates.some(state => ['Kedah', 'Kelantan', 'Terengganu'].includes(state))) {
      return dayOfWeek === 5 || dayOfWeek === 6; // Friday or Saturday
    }
    
    // Default: Saturday (6) and Sunday (0)
    return dayOfWeek === 0 || dayOfWeek === 6;
  };
  
  const getDayColor = (day: number | null) => {
    const activities = getDayActivities(day);
    const highest = activities[0];
    if (!highest) return '';
    if (highest.type === 'lecture') return 'bg-purple-100 dark:bg-purple-900/30';
    if (highest.type === 'examination') return 'bg-red-100 dark:bg-red-900/30';
    if (highest.type === 'break') return 'bg-green-100 dark:bg-green-900/30';
    if (highest.type === 'registration') return 'bg-gray-100 dark:bg-gray-800/30';
    return '';
  };

  const getRingColor = (day: number | null) => {
    const activities = getDayActivities(day);
    const highest = activities[0];
    if (!highest) return '';
    if (highest.type === 'registration') return 'ring-[#d1d5db]';
    if (highest.type === 'lecture') return 'ring-[#8b5cf6]';
    if (highest.type === 'examination') return 'ring-[#dc2626]';
    if (highest.type === 'break') return 'ring-[#10b981]';
    return '';
  };

  const getDayHighlightColor = (day: number | null): string => {
    const activities = getDayActivities(day);
    const highest = activities[0];
    if (!highest) return 'bg-gray-100 dark:bg-gray-900/80';
    if (highest.type === 'lecture') return 'bg-purple-200 dark:bg-purple-900/80';
    if (highest.type === 'examination') return 'bg-red-200 dark:bg-red-900/80';
    if (highest.type === 'break') return 'bg-green-200 dark:bg-green-900/80';
    if (highest.type === 'registration') return 'bg-gray-200 dark:bg-gray-900/80';
    return 'bg-gray-100 dark:bg-gray-900/80';
  };

  // Check if current date is within the calendar range for this group
  // No window check: server and client must agree when initialCurrentDate is set so SSR HTML has the border
  const isCurrentDateInRange = useMemo((): boolean => {
    if (!currentDateStr || monthsForRange.length === 0) return false;
    const firstMonth = monthsForRange[0];
    const lastMonth = monthsForRange[monthsForRange.length - 1];
    const minDate = new Date(firstMonth.year, firstMonth.month - 1, 1);
    const maxDate = new Date(lastMonth.year, lastMonth.month, 0);
    const currentDate = new Date(currentDateStr);
    return currentDate >= minDate && currentDate <= maxDate;
  }, [currentDateStr, monthsForRange]);

  const getCurrentDateBorderColor = (day: number | null): string => {
    if (!day || !currentDateStr) return '';
    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    if (dateStr !== currentDateStr) return '';
    if (!isCurrentDateInRange) return '';
    const activities = getDayActivities(day);
    const highest = activities[0];
    if (!highest) return 'border border-gray-400/50';
    if (highest.type === 'registration') return 'border border-[#d1d5db]';
    if (highest.type === 'lecture') return 'border border-[#8b5cf6]';
    if (highest.type === 'examination') return 'border border-[#dc2626]';
    if (highest.type === 'break') return 'border border-[#10b981]';
    return 'border border-gray-400/50';
  };

  // Check if date is current date
  // No window check: server and client must agree when initialCurrentDate is set so SSR HTML has the border
  const isCurrentDate = (day: number | null): boolean => {
    if (!day || !currentDateStr) return false;
    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return dateStr === currentDateStr;
  };

  const getPriorityActivitiesForDay = (day: number | null): Activity[] => {
    return getDayActivities(day).slice(0, 3);
  };

  const getIndicatorDots = (day: number | null) => {
    if (!day) return null;
    
    const priorityActivities = getPriorityActivitiesForDay(day);
    
    if (priorityActivities.length === 0) return null;
    
    // Show dots for up to 3 highest priority activities, grouped by type
    const activityTypeMap = new Map<ActivityType, Activity>();
    
    for (const activity of priorityActivities) {
      // Only add one activity per type (the first/highest priority one)
      if (!activityTypeMap.has(activity.type)) {
        activityTypeMap.set(activity.type, activity);
      }
    }
    
    const uniqueActivities = Array.from(activityTypeMap.values());
    
    return (
      <div className="flex gap-1 justify-center mt-1 transition-none" style={{ transition: 'none' }}>
        {uniqueActivities.map((activity) => {
          let dotColor = 'bg-gray-400';
          if (activity.type === 'registration') dotColor = 'bg-[#d1d5db]';
          if (activity.type === 'lecture') dotColor = 'bg-[#8b5cf6]';
          if (activity.type === 'examination') dotColor = 'bg-[#dc2626]';
          if (activity.type === 'break') dotColor = 'bg-[#10b981]';
          
          return (
            <div
              key={activity.name + activity.startDate}
              className={`h-1.5 w-1.5 rounded-full ${dotColor} transition-none`}
              style={{ transition: 'none' }}
            />
          );
        })}
      </div>
    );
  };

  const weekDays = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];
  // Theme-aware classes
  const textClass = 'text-foreground';
  const mutedClass = 'text-muted-foreground';
  
  const getTooltip = (day: number | null) => {
    const activities = getDayActivities(day);
    const activity = activities[0];
    if (!activity) return '';
    const label = activity.name;
    const countdownTypes: ActivityType[] = ['lecture', 'examination', 'break'];
    if (showCountdown && countdownTypes.includes(activity.type) && currentDateStr) {
      const days = getDaysUntilStart(activity, currentDateStr, showKKT);
      if (days != null) return `${label} (${formatCountdown(days)})`;
    }
    return label;
  };

  return (
    <div className="group relative w-full h-full transition-none" suppressHydrationWarning style={{ transition: 'none' }}>
      {/* Month header - same styling as list view */}
      <div className="w-full pb-4 pt-3 px-0 transition-none" suppressHydrationWarning style={{ transition: 'none' }}>
        <h3 className={`w-full font-semibold text-xl leading-7 text-left ${textClass} px-0 transition-none`} suppressHydrationWarning style={{ transition: 'none' }}>{monthNames[month - 1]} {year}</h3>
      </div>
      
      {/* Week day headers */}
      <div className="w-full mb-1 grid grid-cols-7 gap-0.5 transition-none" suppressHydrationWarning style={{ transition: 'none' }}>
        {weekDays.map((day) => (
          <div key={day} className={`text-center text-xs font-semibold ${mutedClass} transition-none`} suppressHydrationWarning style={{ transition: 'none' }}>
            {day}
          </div>
        ))}
      </div>
      
      {/* Calendar grid */}
      <div className="w-full grid grid-cols-7 gap-1 transition-none" style={{ transition: 'none' }}>
        {dayCells.map((day, index) => {
          const dateStr = day ? `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}` : null;
          const tooltip = getTooltip(day);
          const isSelected = selectedDate === dateStr;
          const isHighlighted = (hoveredDateStr === dateStr || tooltipOpenKey === dateStr);
          
          if (!day) {
            return (
              <div
                key={index}
                className={`flex flex-col h-12 items-center justify-center text-xs font-medium ${textClass} transition-none`}
                style={{ transition: 'none' }}
                suppressHydrationWarning
              />
            );
          }

          // Always calculate colors - use CSS classes instead of inline styles to prevent hydration mismatch
          // Server and client will render the same HTML with CSS classes
          const dayColor = getDayColor(day);
          const ringColor = getRingColor(day);
          const borderColor = getCurrentDateBorderColor(day);
          const highlightColor = getDayHighlightColor(day);

          const calendarCell = (
            <div
              data-mini-calendar-trigger={dateStr ?? undefined}
              onClick={() => {
                if (!dateStr) return;
                if (!isDesktopHoverMode) {
                  setTooltipOpenKey((prev) => (prev === dateStr ? null : dateStr));
                  onDateClick(dateStr);
                  return;
                }
                onDateClick(dateStr);
              }}
              onMouseEnter={() => {
                if (isDesktopHoverMode && dateStr) {
                  setHoveredDateStr(dateStr);
                  setTooltipOpenKey(dateStr);
                }
              }}
              onMouseLeave={() => {
                if (isDesktopHoverMode) {
                  setHoveredDateStr(null);
                  setTooltipOpenKey(null);
                }
              }}
              onMouseDown={(e) => {
                // Keep desktop focus suppression without affecting touch click synthesis on iOS.
                if (isDesktopHoverMode) e.preventDefault();
              }}
              onFocus={(e) => {
                // Keep focus suppression on hover devices only.
                if (isDesktopHoverMode) e.currentTarget.blur();
              }}
              className={`calendar-date-cell flex flex-col h-12 items-center justify-center rounded-lg text-sm font-semibold cursor-pointer transition-none touch-manipulation select-none outline-none focus:outline-none focus-visible:outline-none focus:ring-0 focus-visible:ring-0 focus:shadow-none focus-visible:shadow-none [&:focus]:ring-0 [&:focus-visible]:ring-0 [&:focus]:shadow-none [&:focus-visible]:shadow-none [&:focus]:outline-none [&:focus-visible]:outline-none ${dayColor} ${isHighlighted ? highlightColor : ''} ${isSelected ? `ring-2 ${ringColor}` : ''} ${isCurrentDate(day) && isCurrentDateInRange ? borderColor : 'border border-transparent'} ${textClass}`}
              tabIndex={-1}
              suppressHydrationWarning
            >
              <div suppressHydrationWarning>{day}</div>
              <div suppressHydrationWarning>{getIndicatorDots(day)}</div>
            </div>
          );

          return (
            <div key={index} suppressHydrationWarning>
              <Tooltip
                open={tooltipOpenKey === dateStr}
                onOpenChange={(open) => {
                  if (!isDesktopHoverMode) return;
                  setTooltipOpenKey(open ? dateStr : null);
                }}
                delayDuration={0}
              >
                <TooltipTrigger asChild>
                  {calendarCell}
                </TooltipTrigger>
                {dateStr && (() => {
                  const dayActivities = getDayActivities(day!);
                  const seenKey = new Set<string>();
                  const uniqueDayActivities = dayActivities.filter((a) => {
                    const key = [
                      a.name,
                      a.startDate,
                      a.endDate ?? '',
                      a.type,
                      a.programType ?? '',
                      a.semua ? '1' : '0',
                    ].join('|');
                    if (seenKey.has(key)) return false;
                    seenKey.add(key);
                    return true;
                  });
                  if (uniqueDayActivities.length === 0) return null;

                  return (
                    <TooltipContent suppressHydrationWarning
                      data-mini-calendar-tooltip={dateStr}
                      side="top"
                      className="w-auto max-w-[300px] sm:max-w-[330px] px-3 py-2 mx-2 rounded-lg shadow-lg border border-border bg-popover text-popover-foreground [&[data-side='top']]:before:content-none transition-none"
                      sideOffset={8}
                      collisionPadding={12}
                      style={{ pointerEvents: 'auto' } as React.CSSProperties & { '--radix-tooltip-content-transform-origin'?: string }}
                    >
                      <TooltipActivityList
                        dateKey={dateStr}
                        activities={uniqueDayActivities}
                        selectedProgram={selectedProgram}
                        showCountdown={showCountdown}
                        currentDateStr={currentDateStr}
                        showKKT={showKKT}
                      />
                    </TooltipContent>
                  );
                })()}
              </Tooltip>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export const GridView = memo(function GridView({ 
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
}: GridViewProps) {
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [tooltipOpenKey, setTooltipOpenKey] = useState<string | null>(null);
  const [hoveredDateStr, setHoveredDateStr] = useState<string | null>(null);

  const months = useMemo(
    () =>
      getMonthsForSessions(selectedSessions, {
        selectedProgram,
        showRegistration,
        showLecture,
        showExamination,
        showOthersExams,
        showBreak,
        showSemesterPendek,
        showKuliahIntersesi,
        showKKT,
      }),
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
    ]
  );

  return (
    <TooltipProvider>
      <div className="space-y-8 transition-none" style={{ transition: 'none' }}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 auto-rows-max transition-none" style={{ transition: 'none' }}>
          {months.map(({ month, year }) => (
            <MiniCalendar
              key={`${year}-${month}`}
              month={month}
              year={year}
              selectedProgram={selectedProgram}
              selectedSessions={selectedSessions}
              showKKT={showKKT}
              onDateClick={setSelectedDate}
              selectedDate={selectedDate}
              showRegistration={showRegistration}
              showLecture={showLecture}
              showSemesterPendek={showSemesterPendek}
              showKuliahIntersesi={showKuliahIntersesi}
              showExamination={showExamination}
              showOthersExams={showOthersExams}
              showBreak={showBreak}
              showCountdown={showCountdown}
              selectedStates={selectedStates}
              initialCurrentDate={initialCurrentDate}
              tooltipOpenKey={tooltipOpenKey}
              hoveredDateStr={hoveredDateStr}
              setTooltipOpenKey={setTooltipOpenKey}
              setHoveredDateStr={setHoveredDateStr}
            />
          ))}
        </div>
      </div>
    </TooltipProvider>
  );
});
