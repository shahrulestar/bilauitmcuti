import { memo, useState, useEffect } from 'react';
import { getActivitiesForMonth, formatDateRange, type ProgramGroup } from '@/lib/data';
import type { Theme } from '@/app/page';

interface ListViewProps {
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

export const ListView = memo(function ListView({ 
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
}: ListViewProps) {
  const [isMounted, setIsMounted] = useState(false);
  
  useEffect(() => {
    setIsMounted(true);
  }, []);
  
  const getProgramGroup = (program: string): ProgramGroup => {
    if (program === 'Foundation/Professional' || program === 'Foundation' || program === 'Professional') return 'A';
    return 'B';
  };

  const shouldShowActivity = (type: string, activity?: any): boolean => {
    if (type === 'registration' && !showRegistration) return false;
    if (type === 'lecture' && !showLecture) return false;
    if (type === 'examination' && !showExamination) return false;
    if (type === 'break' && !showBreak) return false;
    
    // Filter out Semester Pendek if toggle is off
    if (type === 'lecture' && activity?.name?.includes('Semester Pendek') && !showSemesterPendek) return false;
    
    // Filter out Kuliah Intersesi if toggle is off
    if (type === 'lecture' && activity?.name?.includes('Intersesi') && !showKuliahIntersesi) return false;
    
    // Filter out Others Exams (Peperiksaan/Penilaian Khas/Intersesi/Semester Pendek) if toggle is off
    if (type === 'examination' && activity?.name?.includes('Khas') && !showOthersExams) return false;
    
    // Handle "All" option - show activities with semua flag or no specific programType
    if (selectedProgram === 'All') {
      // Show activities that apply to all students or have no specific program type
      if (activity?.semua) return true;
      // Don't show activities with specific programTypes when "All" is selected
      if (activity?.programType) return false;
      return true;
    }
    
    // Filter by program type
    if (activity?.programType && activity.programType !== selectedProgram) return false;
    
    return true;
  };

  const group = getProgramGroup(selectedProgram);
  
  // Group A: Dec 2025 - May 2026
  // Group B: Mar 2026 - Sep 2026
  const activities = group === 'A'
    ? getActivitiesForMonth(2025, 12, group)
        .concat(getActivitiesForMonth(2026, 1, group))
        .concat(getActivitiesForMonth(2026, 2, group))
        .concat(getActivitiesForMonth(2026, 3, group))
        .concat(getActivitiesForMonth(2026, 4, group))
        .concat(getActivitiesForMonth(2026, 5, group))
    : getActivitiesForMonth(2026, 3, group)
        .concat(getActivitiesForMonth(2026, 4, group))
        .concat(getActivitiesForMonth(2026, 5, group))
        .concat(getActivitiesForMonth(2026, 6, group))
        .concat(getActivitiesForMonth(2026, 7, group))
        .concat(getActivitiesForMonth(2026, 8, group))
        .concat(getActivitiesForMonth(2026, 9, group));

  // Filter out duplicate activities and sort by start date
  const uniqueActivities = Array.from(
    new Map(activities.map(a => [a.name + a.startDate, a])).values()
  ).sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());

  // Group activities by month
  const groupedByMonth = uniqueActivities.reduce((acc, activity) => {
    const date = new Date(activity.startDate);
    const monthKey = date.toLocaleString('en-US', { month: 'long', year: 'numeric' });
    if (!acc[monthKey]) {
      acc[monthKey] = [];
    }
    acc[monthKey].push(activity);
    return acc;
  }, {} as Record<string, typeof uniqueActivities>);

  const getActivityColor = (activity: any) => {
    if (activity.type === 'registration') return 'bg-[#d1d5db]';
    if (activity.type === 'lecture') return 'bg-[#8b5cf6]';
    if (activity.type === 'examination') return 'bg-[#dc2626]';
    if (activity.type === 'break') return 'bg-[#10b981]';
    return 'bg-muted';
  };

  const getProgramBadgeColor = (activity: any) => {
    if (activity.semua) {
      // All Students - Deep Orange
      return {
        label: 'All Students',
        lightBg: 'bg-[#EA580C]/10',
        darkBg: 'bg-[#FB923C]/10',
        lightText: 'text-[#EA580C]',
        darkText: 'text-[#FB923C]',
      };
    }
    
    switch (activity.programType) {
      case 'PreDiploma':
      case 'Diploma':
        // Pre-Diploma/Diploma (Full-time) - Cyan
        return {
          label: 'Pre-Diploma/Diploma',
          lightBg: 'bg-[#0891B2]/10',
          darkBg: 'bg-[#22D3EE]/10',
          lightText: 'text-[#0891B2]',
          darkText: 'text-[#22D3EE]',
        };
      case 'DiplomaPartTime':
      case 'BachelorPartTime':
        // Diploma/Bachelor (Part-time) - Lime
        return {
          label: 'Part-Time',
          lightBg: 'bg-[#65A30D]/10',
          darkBg: 'bg-[#A3E635]/10',
          lightText: 'text-[#65A30D]',
          darkText: 'text-[#A3E635]',
        };
      case 'Bachelor':
        // Bachelor (Full-time) - Rose Pink
        return {
          label: 'Bachelor',
          lightBg: 'bg-[#DB2777]/10',
          darkBg: 'bg-[#F472B6]/10',
          lightText: 'text-[#DB2777]',
          darkText: 'text-[#F472B6]',
        };
      case 'Master':
      case 'PhD':
        // Master/Doctorate - Cool Slate
        return {
          label: activity.programType === 'Master' ? 'Master' : 'PhD',
          lightBg: 'bg-[#475569]/10',
          darkBg: 'bg-[#CBD5E1]/10',
          lightText: 'text-[#475569]',
          darkText: 'text-[#CBD5E1]',
        };
      default:
        return null;
    }
  };

  const monthOrder = ['December 2025', 'January 2026', 'February 2026', 'March 2026', 'April 2026', 'May 2026', 'June 2026', 'July 2026', 'August 2026', 'September 2026', 'October 2026', 'November 2026'];
  const sortedMonths = Object.keys(groupedByMonth).sort((a, b) => monthOrder.indexOf(a) - monthOrder.indexOf(b));

  // Filter activities based on visibility toggles and states
  const filteredGroupedByMonth = Object.entries(groupedByMonth).reduce((acc, [month, activities]) => {
    acc[month] = activities.filter(a => shouldShowActivity(a.type, a));
    return acc;
  }, {} as Record<string, typeof uniqueActivities>);

  const bgClass = theme === 'dark' ? 'bg-[#1a1a1a]' : 'bg-white';
  const textClass = theme === 'dark' ? 'text-white' : 'text-[#1a1a1a]';
  const mutedClass = theme === 'dark' ? 'text-muted-foreground' : 'text-gray-600';
  const borderClass = theme === 'dark' ? 'border-secondary' : 'border-gray-300';

  return (
    <div className={`space-y-8 ${bgClass}`} suppressHydrationWarning>
      {sortedMonths.map((month) => {
        // Hide months with no activities
        if (!filteredGroupedByMonth[month] || filteredGroupedByMonth[month].length === 0) {
          return null;
        }
        
        return (
        <div key={month}>
          <div className="-mx-3 pb-4 pt-3">
            <h3 className={`font-semibold text-xl leading-7 text-left ${textClass} px-3`}>{month}</h3>
          </div>
          
          <div className="space-y-4">
            {filteredGroupedByMonth[month] && filteredGroupedByMonth[month].length > 0 ? (
              filteredGroupedByMonth[month].map((activity) => {
                // Use regional dates if KKT filter is on
                const useRegionalDate = showKKT && activity.regionalStartDate;
                const dateStr = useRegionalDate ? activity.regionalStartDate! : activity.startDate;
                
                // Parse date on client-only to avoid hydration mismatch
                let dayName = '';
                let dayNum = '';
                let monthShort = '';
                
                if (isMounted) {
                  const [year, monthNum, day] = dateStr.split('-').map(Number);
                  const startDate = new Date(Date.UTC(year, monthNum - 1, day));
                  dayName = startDate.toLocaleString('en-US', { weekday: 'short', timeZone: 'UTC' });
                  dayNum = String(startDate.getUTCDate());
                  monthShort = startDate.toLocaleString('en-US', { month: 'short', timeZone: 'UTC' });
                }
                
                // Check if this activity has KKT-specific dates
                const hasKKTVariant = activity.regionalStartDate || activity.regionalEndDate;

                return (
                  <div key={activity.name + activity.startDate} className="flex gap-4 p-3 rounded-lg px-0">
                    {/* Date column */}
                    <div className={`flex w-20 flex-col items-start text-xs ${mutedClass}`} suppressHydrationWarning>
                      <div suppressHydrationWarning>{isMounted ? dayName : '\u00A0'}</div>
                      <div className={`text-sm font-medium ${textClass}`} suppressHydrationWarning>{isMounted ? `${dayNum} ${monthShort}` : '\u00A0'}</div>
                    </div>
                    
                    {/* Activity info */}
                    <div className="flex flex-1 flex-col">
                      {/* Dot and Badge row */}
                      {getProgramBadgeColor(activity) && (
                        <div className="flex items-center gap-2 mb-2">
                          <div className={`h-2 w-2 shrink-0 rounded-full ${getActivityColor(activity)}`} />
                          <div className={`inline-block py-1 rounded-full text-xs font-medium px-3 ${theme === 'dark' ? getProgramBadgeColor(activity)?.darkBg : getProgramBadgeColor(activity)?.lightBg} ${theme === 'dark' ? getProgramBadgeColor(activity)?.darkText : getProgramBadgeColor(activity)?.lightText}`}>
                            {getProgramBadgeColor(activity)?.label}
                          </div>
                        </div>
                      )}
                      {/* Dot only (no badge) */}
                      {!getProgramBadgeColor(activity) && (
                        <div className="flex items-center gap-2 mb-2">
                          <div className={`h-2 w-2 shrink-0 rounded-full ${getActivityColor(activity)}`} />
                        </div>
                      )}
                      <div className="w-full">
                        <h3 className={`font-medium text-base leading-6 break-words ${textClass}`}>{activity.name}</h3>
                        <p className={`mt-1 text-sm leading-5 break-words ${mutedClass}`}>
                          {showKKT && activity.regionalStartDate
                            ? formatDateRange(activity.regionalStartDate, activity.regionalEndDate)
                            : formatDateRange(activity.startDate, activity.endDate)}
                        </p>
                        {activity.duration && (
                          <p className={`mt-1 text-xs leading-4 break-words ${mutedClass}`}>
                            Duration: {activity.duration}
                          </p>
                        )}
                        {activity.details && (
                          <p className={`mt-1 text-xs leading-4 break-words ${mutedClass}`}>
                            {activity.details}
                          </p>
                        )}
                        {hasKKTVariant && showKKT && (
                          <p className="mt-1 text-xs leading-4 text-blue-500 italic">
                            *Kedah, Kelantan & Terengganu
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            ) : null}
          </div>
        </div>
        );
      })      }
    </div>
  );
});
