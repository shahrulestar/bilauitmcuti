import { memo, useMemo, useState, useEffect } from 'react';
import { getActivitiesForMonth, formatDateRange, getDaysUntilStart, formatCountdown, type ProgramGroup } from '@/lib/data';

interface ListViewProps {
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
}: ListViewProps) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  const todayStr = useMemo(() => getMalaysiaTodayStr(), []);

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

  const shouldShowActivity = (type: string, activity?: any): boolean => {
    if (type === 'registration' && !showRegistration) return false;
    if (type === 'lecture' && !showLecture) return false;
    if (type === 'examination' && !showExamination) return false;
    if (type === 'break' && !showBreak) return false;
    
    // Filter out Semester Pendek if toggle is off
    if (type === 'lecture' && activity?.name?.includes('Semester Pendek') && !showSemesterPendek) return false;
    
    // Filter out Kuliah Intersesi if toggle is off
    if (type === 'lecture' && activity?.name?.includes('Intersesi') && !showKuliahIntersesi) return false;
    
    // Filter out Others Exams (Peperiksaan/Penilaian Khas/Intersesi/Semester Pendek + English Exit Test) if toggle is off
    if (type === 'examination' && (activity?.name?.includes('Khas') || activity?.name?.includes('English Exit Test') || activity?.name?.includes('EET Lisan')) && !showOthersExams) return false;
    
    // Handle "All" option - show all Group B activities (semua and every programType)
    if (selectedProgram === 'All') {
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

  // Filter activities by program type BEFORE deduplication to ensure correct filtering
  const filteredActivities = activities.filter(a => shouldShowActivity(a.type, a));

  // Filter out duplicate activities - use name, startDate, and programType as key to distinguish between different program types
  const uniqueActivities = Array.from(
    new Map(filteredActivities.map(a => [`${a.name}|${a.startDate}|${a.programType || ''}|${a.endDate || ''}`, a])).values()
  ).sort((a, b) => {
    // Sort by start date first
    const dateCompare = new Date(a.startDate).getTime() - new Date(b.startDate).getTime();
    if (dateCompare !== 0) return dateCompare;
    // Then by name
    return a.name.localeCompare(b.name);
  });

  // Group activities by month - use UTC to ensure consistency
  const groupedByMonth = uniqueActivities.reduce((acc, activity) => {
    const [year, month, day] = activity.startDate.split('-').map(Number);
    const date = new Date(Date.UTC(year, month - 1, day));
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    const monthKey = `${monthNames[date.getUTCMonth()]} ${date.getUTCFullYear()}`;
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
        bgClass: 'bg-[#EA580C]/10 dark:bg-[#FB923C]/10',
        textClass: 'text-[#EA580C] dark:text-[#FB923C]',
      };
    }
    
    switch (activity.programType) {
      case 'PreDiploma':
      case 'Diploma':
        // Pre-Diploma/Diploma (Full-time) - Cyan
        return {
          label: 'Pre-Diploma/Diploma',
          bgClass: 'bg-[#0891B2]/10 dark:bg-[#22D3EE]/10',
          textClass: 'text-[#0891B2] dark:text-[#22D3EE]',
        };
      case 'DiplomaPartTime':
      case 'BachelorPartTime':
        // Diploma/Bachelor (Part-time) - Lime
        return {
          label: 'Part-Time',
          bgClass: 'bg-[#65A30D]/10 dark:bg-[#A3E635]/10',
          textClass: 'text-[#65A30D] dark:text-[#A3E635]',
        };
      case 'Bachelor':
        // Bachelor (Full-time) - Rose Pink
        return {
          label: 'Bachelor',
          bgClass: 'bg-[#DB2777]/10 dark:bg-[#F472B6]/10',
          textClass: 'text-[#DB2777] dark:text-[#F472B6]',
        };
      case 'Master':
      case 'PhD':
        // Master/Doctorate - Cool Slate
        return {
          label: activity.programType === 'Master' ? 'Master' : 'PhD',
          bgClass: 'bg-[#475569]/10 dark:bg-[#CBD5E1]/10',
          textClass: 'text-[#475569] dark:text-[#CBD5E1]',
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

  const bgClass = 'bg-background';
  const textClass = 'text-foreground';
  const mutedClass = 'text-muted-foreground';
  const borderClass = 'border-border';

  return (
    <div className={`space-y-8 ${bgClass} transition-none`} suppressHydrationWarning>
      {sortedMonths.map((month) => {
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
                      {mounted && showCountdown && ['lecture', 'examination', 'break'].includes(activity.type) && todayStr && (() => {
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
                      {/* Group B with badge: dot + badge in one row above title (container fit content, left align, gap-2 like dot-title) */}
                      {group === 'B' && getProgramBadgeColor(activity) ? (
                        <>
                          <div className="flex items-center gap-2 w-fit mb-1 transition-none" suppressHydrationWarning>
                            <div className={`h-2 w-2 shrink-0 rounded-full ${getActivityColor(activity)} transition-none`} suppressHydrationWarning />
                            <div className={`inline-block py-1 rounded-full text-xs font-medium px-3 ${getProgramBadgeColor(activity)?.bgClass} ${getProgramBadgeColor(activity)?.textClass} transition-none`} suppressHydrationWarning>
                              {getProgramBadgeColor(activity)?.label}
                            </div>
                          </div>
                          <h3 className={`font-medium text-base leading-6 break-words ${textClass} mb-1 transition-none`} suppressHydrationWarning>{activity.name}</h3>
                        </>
                      ) : (
                        <>
                          {/* Group A or no badge: dot and h3 title in same row */}
                          <div className="flex items-start gap-2 mb-1 transition-none" suppressHydrationWarning>
                            <div className={`h-2 w-2 shrink-0 rounded-full mt-2 ${getActivityColor(activity)} transition-none`} suppressHydrationWarning />
                            <h3 className={`font-medium text-base leading-6 break-words ${textClass} transition-none`} suppressHydrationWarning>{activity.name}</h3>
                          </div>
                          {/* Badge row for Group A (if exists) */}
                          {getProgramBadgeColor(activity) ? (
                            <div className="flex items-center mb-1 transition-none" suppressHydrationWarning>
                              <div className={`inline-block py-1 rounded-full text-xs font-medium px-3 ${getProgramBadgeColor(activity)?.bgClass} ${getProgramBadgeColor(activity)?.textClass} transition-none`} suppressHydrationWarning>
                                {getProgramBadgeColor(activity)?.label}
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
      })      }
    </div>
  );
});
