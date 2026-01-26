'use client';

import React, { memo } from "react"

import { useState, useEffect } from 'react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { getActivitiesForMonth, getActivityForDate, getMonthsForGroup, type ProgramGroup, type Activity, type ActivityType } from '@/lib/data';
import type { Theme } from '@/app/page';
import { allActivities } from '@/lib/data';

interface GridViewProps {
  selectedProgram: string;
  showKKT: boolean;
  theme: Theme;
  showRegistration: boolean;
  showLecture: boolean;
  showSemesterPendek: boolean;
  showKuliahIntersesi: boolean;
  showExamination: boolean;
  showOthersExams: boolean;
  showBreak: boolean;
  onMonthChange?: (month: string) => void;
  selectedStates?: string[];
}

function MiniCalendar({ month, year, selectedProgram, showKKT, onDateClick, selectedDate, theme, showRegistration, showLecture, showSemesterPendek, showKuliahIntersesi, showExamination, showOthersExams, showBreak, selectedStates = [] }: { month: number; year: number; selectedProgram: string; showKKT: boolean; onDateClick: (date: string) => void; selectedDate: string | null; theme: Theme; showRegistration: boolean; showLecture: boolean; showSemesterPendek: boolean; showKuliahIntersesi: boolean; showExamination: boolean; showOthersExams: boolean; showBreak: boolean; selectedStates?: string[] }) {
  const [tooltipOpen, setTooltipOpen] = useState<string | null>(null);
  const [isMounted, setIsMounted] = useState(false);

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

  const [currentDateStr, setCurrentDateStr] = useState<string | null>(getInitialCurrentDate);

  // Only render Tooltip after mount to prevent hydration mismatch
  useEffect(() => {
    setIsMounted(true);
  }, []);
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

  const shouldShowActivity = (activity: Activity | undefined): boolean => {
    if (!activity) return false;
    if (activity.type === 'registration' && !showRegistration) return false;
    if (activity.type === 'lecture' && !showLecture) return false;
    if (activity.type === 'examination' && !showExamination) return false;
    if (activity.type === 'break' && !showBreak) return false;
    
    // Filter out Semester Pendek if toggle is off
    if (activity.type === 'lecture' && activity.name.includes('Semester Pendek') && !showSemesterPendek) return false;
    
    // Filter out Kuliah Intersesi if toggle is off
    if (activity.type === 'lecture' && activity.name.includes('Intersesi') && !showKuliahIntersesi) return false;
    
    // Filter out Others Exams (Peperiksaan/Penilaian Khas/Intersesi/Semester Pendek) if toggle is off
    if (activity.type === 'examination' && activity.name.includes('Khas') && !showOthersExams) return false;
    
    // Handle "All" option - show activities with semua flag or no specific programType
    if (selectedProgram === 'All') {
      // Show activities that apply to all students or have no specific program type
      if (activity.semua) return true;
      // Don't show activities with specific programTypes when "All" is selected
      if (activity.programType) return false;
      return true;
    }
    
    // Filter by program type - check if activity has programType and if it matches selectedProgram
    if (activity.programType) {
      if (activity.programType !== selectedProgram) return false;
    }
    
    // Always show all activities (toggle filtering is handled by type filters above)
    return true;
  };

  const group = getProgramGroup(selectedProgram);
  
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
    if (!day) return '';
    
    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    
    // Find the highest priority activity for this date
    let highestPriorityActivity: Activity | null = null;
    const priorityMap: { [key in ActivityType]: number } = {
      lecture: 3,
      examination: 2,
      break: 2,
      registration: 1,
      other: 0,
    };
    
    for (const activity of allActivities) {
      if (activity.group !== group) continue;
      
      // Check against both standard and regional dates based on filter
      let matchesDate = false;
      const startDate = new Date(activity.startDate);
      const endDate = activity.endDate ? new Date(activity.endDate) : startDate;
      const targetDate = new Date(dateStr);
      
      // If regional dates exist and KKT is enabled, use only regional dates
      if (showKKT && activity.regionalStartDate) {
        const regionalStart = new Date(activity.regionalStartDate);
        const regionalEnd = activity.regionalEndDate ? new Date(activity.regionalEndDate) : regionalStart;
        if (targetDate >= regionalStart && targetDate <= regionalEnd) {
          matchesDate = true;
        }
      } else {
        // Use standard dates when regional dates are not available or KKT is disabled
        if (targetDate >= startDate && targetDate <= endDate) {
          matchesDate = true;
        }
      }
      
      if (matchesDate && shouldShowActivity(activity)) {
        if (!highestPriorityActivity || priorityMap[activity.type] > priorityMap[highestPriorityActivity.type]) {
          highestPriorityActivity = activity;
        }
      }
    }
    
    if (highestPriorityActivity) {
      if (highestPriorityActivity.type === 'lecture') return theme === 'dark' ? 'bg-purple-900/50' : 'bg-purple-100';
      if (highestPriorityActivity.type === 'examination') return theme === 'dark' ? 'bg-red-900/50' : 'bg-red-100';
      if (highestPriorityActivity.type === 'break') return theme === 'dark' ? 'bg-green-900/50' : 'bg-green-100';
    }
    
    return 'bg-transparent';
  };

  const getRingColor = (day: number | null) => {
    if (!day) return '';
    
    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const targetDate = new Date(dateStr);
    
    // Check both standard and regional dates
    for (const activity of allActivities) {
      if (activity.group !== group) continue;
      if (!shouldShowActivity(activity)) continue;
      
      const startDate = new Date(activity.startDate);
      const endDate = activity.endDate ? new Date(activity.endDate) : startDate;
      
      let matches = false;
      
      // If regional dates exist and KKT is enabled, use only regional dates
      if (showKKT && activity.regionalStartDate) {
        const regionalStart = new Date(activity.regionalStartDate);
        const regionalEnd = activity.regionalEndDate ? new Date(activity.regionalEndDate) : regionalStart;
        matches = targetDate >= regionalStart && targetDate <= regionalEnd;
      } else {
        // Use standard dates when regional dates are not available or KKT is disabled
        matches = targetDate >= startDate && targetDate <= endDate;
      }
      
      if (matches) {
        if (activity.type === 'registration') return 'ring-[#d1d5db]';
        if (activity.type === 'lecture') return 'ring-[#8b5cf6]';
        if (activity.type === 'examination') return 'ring-[#dc2626]';
        if (activity.type === 'break') return 'ring-[#10b981]';
      }
    }
    
    return '';
  };

  // Check if current date is within the calendar range for this group
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

  // Get current date outline color (same logic as getRingColor but for current date)
  // Using border instead of ring to avoid conflict with focus ring removal
  const getCurrentDateBorderColor = (day: number | null): string => {
    if (!day || !currentDateStr) return '';
    
    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    
    // Only show outline if it's the current date
    if (dateStr !== currentDateStr) return '';
    
    // Check if current date is in range
    if (!isCurrentDateInRange()) return '';
    
    const targetDate = new Date(dateStr);
    
    // Find the highest priority activity for this date (same priority logic as getDayColor)
    let highestPriorityActivity: Activity | null = null;
    const priorityMap: { [key in ActivityType]: number } = {
      lecture: 3,
      examination: 2,
      break: 2,
      registration: 1,
      other: 0,
    };
    
    for (const activity of allActivities) {
      if (activity.group !== group) continue;
      if (!shouldShowActivity(activity)) continue;
      
      const startDate = new Date(activity.startDate);
      const endDate = activity.endDate ? new Date(activity.endDate) : startDate;
      
      let matches = false;
      
      // If regional dates exist and KKT is enabled, use only regional dates
      if (showKKT && activity.regionalStartDate) {
        const regionalStart = new Date(activity.regionalStartDate);
        const regionalEnd = activity.regionalEndDate ? new Date(activity.regionalEndDate) : regionalStart;
        matches = targetDate >= regionalStart && targetDate <= regionalEnd;
      } else {
        // Use standard dates when regional dates are not available or KKT is disabled
        matches = targetDate >= startDate && targetDate <= endDate;
      }
      
      if (matches) {
        if (!highestPriorityActivity || priorityMap[activity.type] > priorityMap[highestPriorityActivity.type]) {
          highestPriorityActivity = activity;
        }
      }
    }
    
    // Return border color based on highest priority activity (1px border)
    if (highestPriorityActivity) {
      if (highestPriorityActivity.type === 'registration') return 'border border-[#d1d5db]';
      if (highestPriorityActivity.type === 'lecture') return 'border border-[#8b5cf6]';
      if (highestPriorityActivity.type === 'examination') return 'border border-[#dc2626]';
      if (highestPriorityActivity.type === 'break') return 'border border-[#10b981]';
    }
    
    // If no activity, use subtle grey for both light and dark theme
    return theme === 'dark' ? 'border border-gray-600/50' : 'border border-gray-400/50';
  };

  // Check if date is current date
  const isCurrentDate = (day: number | null): boolean => {
    if (!day || !currentDateStr) return false;
    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return dateStr === currentDateStr;
  };

  // Priority order for activity types - higher priority shows first
  const getActivityPriority = (activity: Activity, allDayActivities?: Activity[]): number => {
    const { type, name } = activity;
    
    // Examination - highest priority
    if (type === 'examination') return 0;
    
    // Break/Cuti - second priority
    if (type === 'break') return 1;
    
    // Lecture subtypes - third tier with internal priorities
    if (type === 'lecture') {
      // Kuliah 1, 2, 3, etc. - highest lecture priority
      if (/^Kuliah\s+\d+$/.test(name)) return 2;
      
      // Special case: Semester Pendek with specific combinations
      if (name.includes('Semester Pendek') && allDayActivities) {
        // Check if Semester Pendek is combined with Kuliah Intersesi or Cuti Semester
        const hasSemesterPendek = allDayActivities.some(a => a.name.includes('Semester Pendek'));
        const hasKuliahIntersesi = allDayActivities.some(a => a.name.includes('Intersesi'));
        const hasCutiSemester = allDayActivities.some(a => a.name.includes('Cuti Semester'));
        
        // If Semester Pendek is with Intersesi or Cuti Semester, treat as break priority
        if (hasSemesterPendek && (hasKuliahIntersesi || hasCutiSemester)) {
          return 1; // Break priority
        }
      }
      
      // Kuliah Semester Pendek - lower lecture priority
      if (name.includes('Semester Pendek')) return 3;
      // Kuliah Intersesi - lowest lecture priority
      if (name.includes('Intersesi')) return 4;
      // Other lecture types
      return 5;
    }
    
    // Registration - fourth priority
    if (type === 'registration') return 6;
    
    // Other - lowest priority
    return 7;
  };

  // Get activities sorted by priority for a given date (max 3)
  const getPriorityActivitiesForDay = (day: number | null): Activity[] => {
    if (!day) return [];
    
    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    
    // Get all activities for this date
    const activitiesForDay: Activity[] = [];
    for (const activity of allActivities) {
      if (activity.group !== group) continue;
      
      // Check against both standard and regional dates
      let matchesDate = false;
      const startDate = new Date(activity.startDate);
      const endDate = activity.endDate ? new Date(activity.endDate) : startDate;
      const targetDate = new Date(dateStr);
      
      // If regional dates exist and KKT is enabled, use only regional dates
      if (showKKT && activity.regionalStartDate) {
        const regionalStart = new Date(activity.regionalStartDate);
        const regionalEnd = activity.regionalEndDate ? new Date(activity.regionalEndDate) : regionalStart;
        if (targetDate >= regionalStart && targetDate <= regionalEnd) {
          matchesDate = true;
        }
      } else {
        // Use standard dates when regional dates are not available or KKT is disabled
        if (targetDate >= startDate && targetDate <= endDate) {
          matchesDate = true;
        }
      }
      
      const shouldShow = shouldShowActivity(activity);
      if (matchesDate && shouldShow) {
        activitiesForDay.push(activity);
      }
    }
    
    // Sort by priority using combination-aware logic
    activitiesForDay.sort((a, b) => getActivityPriority(a, activitiesForDay) - getActivityPriority(b, activitiesForDay));
    const result = activitiesForDay.slice(0, 3);
    
    return result;
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
      <div className="flex gap-1 justify-center mt-1" suppressHydrationWarning>
        {uniqueActivities.map((activity) => {
          let dotColor = 'bg-gray-400';
          if (activity.type === 'registration') dotColor = 'bg-[#d1d5db]';
          if (activity.type === 'lecture') dotColor = 'bg-[#8b5cf6]';
          if (activity.type === 'examination') dotColor = 'bg-[#dc2626]';
          if (activity.type === 'break') dotColor = 'bg-[#10b981]';
          
          return (
            <div
              key={activity.name + activity.startDate}
              className={`h-1.5 w-1.5 rounded-full ${dotColor}`}
              suppressHydrationWarning
            />
          );
        })}
      </div>
    );
  };

  const weekDays = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];
  const textClass = theme === 'dark' ? 'text-white' : 'text-[#1a1a1a]';
  const mutedClass = theme === 'dark' ? 'text-muted-foreground' : 'text-gray-600';
  
  const getTooltip = (day: number | null) => {
    if (!day) return '';
    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const activity = getActivityForDate(dateStr, group);
    return activity && shouldShowActivity(activity) ? activity.name : '';
  };

  return (
    <div className="group relative w-full h-full" suppressHydrationWarning>
      {/* Month header - same styling as list view */}
      <div className="w-full pb-4 pt-3 px-0">
        <h3 className={`w-full font-semibold text-xl leading-7 text-left ${textClass} px-0`} suppressHydrationWarning>{monthNames[month - 1]} {year}</h3>
      </div>
      
      {/* Week day headers */}
      <div className="w-full mb-1 grid grid-cols-7 gap-0.5" suppressHydrationWarning>
        {weekDays.map((day) => (
          <div key={day} className={`text-center text-xs font-semibold ${mutedClass}`} suppressHydrationWarning>
            {day}
          </div>
        ))}
      </div>
      
      {/* Calendar grid */}
      <div className="w-full grid grid-cols-7 gap-1">
        {dayCells.map((day, index) => {
          const dateStr = day ? `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}` : null;
          const tooltip = getTooltip(day);
          const isSelected = selectedDate === dateStr;
          
          if (!day) {
            return (
              <div
                key={index}
                className={`flex flex-col h-12 items-center justify-center text-xs font-medium ${textClass}`}
                suppressHydrationWarning
              />
            );
          }

          const dayColor = getDayColor(day);
          const ringColor = getRingColor(day);
          const borderColor = getCurrentDateBorderColor(day);
          
          // Get inline background color for events only (no weekend colors)
          const getInlineEventBg = () => {
            if (!isMounted) return undefined;
            
            // Event backgrounds only - no color for weekends or non-events
            if (dayColor.includes('purple')) {
              return theme === 'dark' ? 'rgba(88, 28, 135, 0.5)' : 'rgba(243, 232, 255, 1)';
            }
            if (dayColor.includes('red')) {
              return theme === 'dark' ? 'rgba(127, 29, 29, 0.5)' : 'rgba(254, 226, 226, 1)';
            }
            if (dayColor.includes('green')) {
              return theme === 'dark' ? 'rgba(20, 83, 45, 0.5)' : 'rgba(220, 252, 231, 1)';
            }
            
            // No background color for weekends or non-events
            return undefined;
          };
          
          const calendarCell = (
            <div
              onClick={() => {
                if (dateStr) {
                  // Toggle tooltip on mobile, select date
                  if (tooltipOpen === dateStr) {
                    onDateClick(dateStr);
                    setTooltipOpen(null);
                  } else {
                    setTooltipOpen(dateStr);
                  }
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
              className={`calendar-date-cell flex flex-col h-12 items-center justify-center rounded-lg text-sm font-semibold cursor-pointer transition touch-manipulation select-none outline-none focus:outline-none focus-visible:outline-none focus:ring-0 focus-visible:ring-0 focus:shadow-none focus-visible:shadow-none [&:focus]:ring-0 [&:focus-visible]:ring-0 [&:focus]:shadow-none [&:focus-visible]:shadow-none [&:focus]:outline-none [&:focus-visible]:outline-none ${isSelected ? `ring-2 ${ringColor}` : ''} ${isCurrentDate(day) && isCurrentDateInRange() ? borderColor : 'border border-transparent'} ${textClass}`}
              tabIndex={-1}
              suppressHydrationWarning
              style={{
                backgroundColor: getInlineEventBg()
              }}
            >
              <div suppressHydrationWarning>{day}</div>
              {isMounted ? (
                <div suppressHydrationWarning>{getIndicatorDots(day)}</div>
              ) : (
                <div suppressHydrationWarning></div>
              )}
            </div>
          );

          return (
            <div key={index} suppressHydrationWarning>
              {isMounted ? (
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
                const group = getProgramGroup(selectedProgram);
                const dayActivities: Activity[] = [];
                for (const activity of allActivities) {
                  if (activity.group !== group) continue;
                  
                  // Check against both standard and regional dates
                  let matchesDate = false;
                  const startDate = new Date(activity.startDate);
                  const endDate = activity.endDate ? new Date(activity.endDate) : startDate;
                  const targetDate = new Date(dateStr);
                  
                  if (targetDate >= startDate && targetDate <= endDate) {
                    matchesDate = true;
                  }
                  
                  if (showKKT && activity.regionalStartDate) {
                    const regionalStart = new Date(activity.regionalStartDate);
                    const regionalEnd = activity.regionalEndDate ? new Date(activity.regionalEndDate) : regionalStart;
                    if (targetDate >= regionalStart && targetDate <= regionalEnd) {
                      matchesDate = true;
                    }
                  }
                  
                  if (matchesDate && shouldShowActivity(activity)) {
                    dayActivities.push(activity);
                  }
                }
                
                if (dayActivities.length === 0) return null;
                
                return (
                  <TooltipContent 
                    side="top" 
                    className={`max-w-xs px-3 py-2 mx-2 rounded-lg shadow-lg border [&[data-side="top"]]:before:content-none ${theme === 'dark' ? 'bg-[#2a2a2a] border-[#4a4a4a] text-white' : 'bg-gray-100 border-gray-300 text-[#1a1a1a]'}`}
                    sideOffset={8}
                    style={{ pointerEvents: 'auto' } as React.CSSProperties & { '--radix-tooltip-content-transform-origin'?: string }}
                  >
                    <div className="space-y-2">
                      {dayActivities.map((activity, idx) => {
                        const dotColor = 
                          activity.type === 'registration' ? 'bg-[#d1d5db]' :
                          activity.type === 'lecture' ? 'bg-[#8b5cf6]' :
                          activity.type === 'examination' ? 'bg-[#dc2626]' :
                          activity.type === 'break' ? 'bg-[#10b981]' : 'bg-gray-400';
                        
                        return (
                          <div key={idx} className="flex items-start gap-2">
                            <div className={`h-2 w-2 rounded-full mt-1 flex-shrink-0 ${dotColor}`} />
                            <p className="text-xs leading-relaxed">{activity.name}</p>
                          </div>
                        );
                      })}
                    </div>
                  </TooltipContent>
                );
              })()}
                </Tooltip>
              ) : (
                calendarCell
              )}
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
  theme,
  showRegistration,
  showLecture,
  showSemesterPendek,
  showKuliahIntersesi,
  showExamination,
  showOthersExams,
  showBreak,
  onMonthChange,
  selectedStates = [],
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
      <div className="space-y-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 auto-rows-max">
          {months.map(({ month, year }) => (
            <MiniCalendar
              key={`${year}-${month}`}
              month={month}
              year={year}
              selectedProgram={selectedProgram}
              showKKT={showKKT}
              onDateClick={setSelectedDate}
              selectedDate={selectedDate}
              theme={theme}
              showRegistration={showRegistration}
              showLecture={showLecture}
              showSemesterPendek={showSemesterPendek}
              showKuliahIntersesi={showKuliahIntersesi}
              showExamination={showExamination}
              showOthersExams={showOthersExams}
              showBreak={showBreak}
              selectedStates={selectedStates}
            />
          ))}
        </div>
      </div>
    </TooltipProvider>
  );
});
