'use client';

import React, { memo } from "react"

import { useState, useEffect } from 'react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { getActivitiesForDate, getMonthsForGroup, getDaysUntilStart, formatCountdown, type ProgramGroup, type Activity, type ActivityType } from '@/lib/data';

interface GridViewProps {
  selectedProgram: string;
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

function MiniCalendar({ month, year, selectedProgram, showKKT, onDateClick, selectedDate, showRegistration, showLecture, showSemesterPendek, showKuliahIntersesi, showExamination, showOthersExams, showBreak, showCountdown, selectedStates = [], initialCurrentDate }: { month: number; year: number; selectedProgram: string; showKKT: boolean; onDateClick: (date: string) => void; selectedDate: string | null; showRegistration: boolean; showLecture: boolean; showSemesterPendek: boolean; showKuliahIntersesi: boolean; showExamination: boolean; showOthersExams: boolean; showBreak: boolean; showCountdown: boolean; selectedStates?: string[]; initialCurrentDate?: string }) {
  const [tooltipOpen, setTooltipOpen] = useState<string | null>(null);
  const [hoveredDateStr, setHoveredDateStr] = useState<string | null>(null);
  const [hasHoverCapability, setHasHoverCapability] = useState(false);

  useEffect(() => {
    const mq = typeof window !== 'undefined' ? window.matchMedia('(hover: hover)') : null;
    if (!mq) return;
    setHasHoverCapability(mq.matches);
    const handler = () => setHasHoverCapability(mq.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

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

  const getProgramGroup = (program: string): ProgramGroup => {
    if (program === 'Foundation/Professional' || program === 'Foundation' || program === 'Professional') return 'A';
    return 'B';
  };

  const group = getProgramGroup(selectedProgram);

  const filterOptions = {
    selectedProgram,
    showRegistration,
    showLecture,
    showSemesterPendek,
    showKuliahIntersesi,
    showExamination,
    showOthersExams,
    showBreak,
  };

  const getActivityPriority = (activity: Activity, allDayActivities?: Activity[]): number => {
    const { type, name } = activity;
    if (type === 'examination') return 0;
    if (type === 'break') return 1;
    if (type === 'lecture') {
      if (/^Lecture\s+\d+$/.test(name)) return 2;
      if (name.includes('Semester Pendek') && allDayActivities) {
        const hasSemesterPendek = allDayActivities.some(a => a.name.includes('Semester Pendek'));
        const hasLectureIntersesi = allDayActivities.some(a => a.name.includes('Intersesi'));
        const hasCutiSemester = allDayActivities.some(a => a.name.includes('Cuti Semester'));
        if (hasSemesterPendek && (hasLectureIntersesi || hasCutiSemester)) return 1;
      }
      if (name.includes('Semester Pendek')) return 3;
      if (name.includes('Intersesi')) return 4;
      return 5;
    }
    if (type === 'registration') return 6;
    return 7;
  };

  // Single source for day activities - used by tooltip, colors, dots, ring/border
  const getDayActivities = (day: number | null): Activity[] => {
    if (!day) return [];
    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const activities = getActivitiesForDate(dateStr, group, showKKT, filterOptions);
    activities.sort((a, b) => getActivityPriority(a, activities) - getActivityPriority(b, activities));
    return activities;
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
  const isCurrentDateInRange = (): boolean => {
    if (!currentDateStr) return false;
    
    // Get all months for this group to determine the range
    const months = getMonthsForGroup(group, {
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
    
    if (months.length === 0) return false;
    
    // Get min and max dates from months
    const firstMonth = months[0];
    const lastMonth = months[months.length - 1];
    const minDate = new Date(firstMonth.year, firstMonth.month - 1, 1);
    const maxDate = new Date(lastMonth.year, lastMonth.month, 0); // Last day of last month
    
    const currentDate = new Date(currentDateStr);
    return currentDate >= minDate && currentDate <= maxDate;
  };

  const getCurrentDateBorderColor = (day: number | null): string => {
    if (!day || !currentDateStr) return '';
    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    if (dateStr !== currentDateStr) return '';
    if (!isCurrentDateInRange()) return '';
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
    const countdownTypes: ActivityType[] = ['lecture', 'examination', 'break'];
    if (showCountdown && countdownTypes.includes(activity.type) && currentDateStr) {
      const days = getDaysUntilStart(activity, currentDateStr, showKKT);
      if (days != null) return `${activity.name} (${formatCountdown(days)})`;
    }
    return activity.name;
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
          const isHighlighted = (hoveredDateStr === dateStr || tooltipOpen === dateStr);
          
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
              onClick={() => {
                if (dateStr) {
                  // Toggle tooltip on mobile/tablet (touch); on desktop with hover, click still closes or triggers onDateClick
                  if (tooltipOpen === dateStr) {
                    onDateClick(dateStr);
                    setTooltipOpen(null);
                  } else {
                    setTooltipOpen(dateStr);
                  }
                }
              }}
              onMouseEnter={() => {
                if (hasHoverCapability && dateStr) {
                  setHoveredDateStr(dateStr);
                  setTooltipOpen(dateStr);
                }
              }}
              onMouseLeave={() => {
                if (hasHoverCapability) {
                  setHoveredDateStr(null);
                  setTooltipOpen(null);
                }
              }}
              onPointerDown={(e) => {
                // Prevent focus on pointer events (works for both mouse and touch)
                // This is the key to remove focus outline on both desktop and mobile
                e.preventDefault();
              }}
              onFocus={(e) => {
                // Immediately blur if element somehow gets focus
                e.currentTarget.blur();
              }}
              className={`calendar-date-cell flex flex-col h-12 items-center justify-center rounded-lg text-sm font-semibold cursor-pointer transition-none touch-manipulation select-none outline-none focus:outline-none focus-visible:outline-none focus:ring-0 focus-visible:ring-0 focus:shadow-none focus-visible:shadow-none [&:focus]:ring-0 [&:focus-visible]:ring-0 [&:focus]:shadow-none [&:focus-visible]:shadow-none [&:focus]:outline-none [&:focus-visible]:outline-none ${dayColor} ${isHighlighted ? highlightColor : ''} ${isSelected ? `ring-2 ${ringColor}` : ''} ${isCurrentDate(day) && isCurrentDateInRange() ? borderColor : 'border border-transparent'} ${textClass}`}
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
                open={tooltipOpen === dateStr} 
                onOpenChange={(open) => {
                  if (open) {
                    setTooltipOpen(dateStr);
                  } else {
                    setTooltipOpen(null);
                  }
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
                  const key = `${a.name}|${a.startDate}|${a.endDate ?? ''}`;
                  if (seenKey.has(key)) return false;
                  seenKey.add(key);
                  return true;
                });
                if (uniqueDayActivities.length === 0) return null;
                
                return (
                  <TooltipContent suppressHydrationWarning 
                    side="top" 
                    className="w-auto max-w-[300px] sm:max-w-[330px] px-3 py-2 mx-2 rounded-lg shadow-lg border border-border bg-popover text-popover-foreground [&[data-side='top']]:before:content-none transition-none"
                    sideOffset={8}
                    style={{ pointerEvents: 'auto' } as React.CSSProperties & { '--radix-tooltip-content-transform-origin'?: string }}
                  >
                    <div className="w-full space-y-2">
                      {uniqueDayActivities.map((activity, idx) => {
                        const dotColor = 
                          activity.type === 'registration' ? 'bg-[#d1d5db]' :
                          activity.type === 'lecture' ? 'bg-[#8b5cf6]' :
                          activity.type === 'examination' ? 'bg-[#dc2626]' :
                          activity.type === 'break' ? 'bg-[#10b981]' : 'bg-gray-400';
                        const countdownTypes: ActivityType[] = ['lecture', 'examination', 'break'];
                        const days = showCountdown && countdownTypes.includes(activity.type) && currentDateStr
                          ? getDaysUntilStart(activity, currentDateStr, showKKT)
                          : null;
                        const displayName = days != null ? `${activity.name} (${formatCountdown(days)})` : activity.name;
                        return (
                          <div key={idx} className="grid grid-cols-[auto_minmax(0,1fr)] items-start gap-2 transition-none" style={{ transition: 'none' }}>
                            <div className={`h-2 w-2 rounded-full mt-1 flex-shrink-0 ${dotColor} transition-none`} style={{ transition: 'none' }} />
                            <p className="min-w-0 text-xs leading-relaxed whitespace-normal text-wrap break-words [overflow-wrap:anywhere] line-clamp-3 transition-none">{displayName}</p>
                          </div>
                        );
                      })}
                    </div>
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

  const getProgramGroup = (program: string): ProgramGroup => {
    if (program === 'Foundation/Professional' || program === 'Foundation' || program === 'Professional') return 'A';
    return 'B';
  };

  const group = getProgramGroup(selectedProgram);
  
  // Calculate months dynamically based on available activities
  const months = getMonthsForGroup(group, {
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
            />
          ))}
        </div>
      </div>
    </TooltipProvider>
  );
});
