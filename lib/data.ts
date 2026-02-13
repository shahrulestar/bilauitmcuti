export type ActivityType = 'registration' | 'lecture' | 'examination' | 'break' | 'other';

// Default filter states - single source of truth
export const DEFAULT_FILTER_STATES = {
  showKKT: false,
  showRegistration: true,
  showLecture: true,
  showSemesterPendek: false,
  showKuliahIntersesi: false,
  showExamination: true,
  showOthersExams: false,
  showBreak: true,
  showCountdown: true,
} as const;

export interface Activity {
  name: string;
  details?: string;
  startDate: string; // YYYY-MM-DD format
  endDate?: string; // YYYY-MM-DD format
  regionalStartDate?: string; // KKT regional variant start date
  regionalEndDate?: string; // KKT regional variant end date
  duration?: string; // e.g., "1 Minggu", "8 Minggu"
  type: ActivityType;
  programs?: string[]; // Applicable programs
  group?: 'A' | 'B'; // Group A (Foundation/Professional) or Group B (Pre-Diploma onwards)
  programType?: 'PreDiploma' | 'Diploma' | 'DiplomaPartTime' | 'Bachelor' | 'BachelorPartTime' | 'Master' | 'PhD'; // For Group B subdivision
  semua?: boolean; // True if applies to all Group B students (Semua Pelajar)
  states?: string[]; // Applicable states only (used for Kedah, Kelantan, Terengganu)
}

// Calendar data - single source of truth from calendar.json
import calendarData from "./calendar.json";

export const activitiesGroupA = calendarData.activitiesGroupA as Activity[];
export const activitiesGroupB = calendarData.activitiesGroupB as Activity[];
export const allActivities = [...activitiesGroupA, ...activitiesGroupB];
export const programOptions = calendarData.programOptions as {
  label: string;
  value: string;
  group: "A" | "B";
}[];

// Program badge config for list view - single source of truth for label and colors
export interface ProgramBadgeConfig {
  label: string;
  bgClass: string;
  textClass: string;
}

type ProgramTypeForBadge = NonNullable<Activity['programType']>;

const programBadgeConfigMap: Record<ProgramTypeForBadge, ProgramBadgeConfig> = {
  PreDiploma: {
    label: 'Pre-Diploma',
    bgClass: 'bg-[#0891B2]/10 dark:bg-[#22D3EE]/10',
    textClass: 'text-[#0891B2] dark:text-[#22D3EE]',
  },
  Diploma: {
    label: 'Diploma',
    bgClass: 'bg-[#0891B2]/10 dark:bg-[#22D3EE]/10',
    textClass: 'text-[#0891B2] dark:text-[#22D3EE]',
  },
  DiplomaPartTime: {
    label: 'Part-Time',
    bgClass: 'bg-[#65A30D]/10 dark:bg-[#A3E635]/10',
    textClass: 'text-[#65A30D] dark:text-[#A3E635]',
  },
  Bachelor: {
    label: 'Bachelor',
    bgClass: 'bg-[#DB2777]/10 dark:bg-[#F472B6]/10',
    textClass: 'text-[#DB2777] dark:text-[#F472B6]',
  },
  BachelorPartTime: {
    label: 'Part-Time',
    bgClass: 'bg-[#65A30D]/10 dark:bg-[#A3E635]/10',
    textClass: 'text-[#65A30D] dark:text-[#A3E635]',
  },
  Master: {
    label: 'Master',
    bgClass: 'bg-[#475569]/10 dark:bg-[#CBD5E1]/10',
    textClass: 'text-[#475569] dark:text-[#CBD5E1]',
  },
  PhD: {
    label: 'PhD',
    bgClass: 'bg-[#475569]/10 dark:bg-[#CBD5E1]/10',
    textClass: 'text-[#475569] dark:text-[#CBD5E1]',
  },
};

const allStudentsBadgeConfig: ProgramBadgeConfig = {
  label: 'All Students',
  bgClass: 'bg-[#EA580C]/10 dark:bg-[#FB923C]/10',
  textClass: 'text-[#EA580C] dark:text-[#FB923C]',
};

export function getProgramBadgeConfig(activity: Activity): ProgramBadgeConfig | null {
  if (activity.semua) return allStudentsBadgeConfig;
  if (activity.programType && activity.programType in programBadgeConfigMap) {
    return programBadgeConfigMap[activity.programType];
  }
  return null;
}

export type ProgramGroup = 'A' | 'B';

// Get all activities for a specific month
export function getActivitiesForMonth(year: number, month: number, group: ProgramGroup): Activity[] {
  return allActivities.filter(activity => {
    if (activity.group !== group) return false;
    
    const startDate = new Date(activity.startDate);
    const endDate = activity.endDate ? new Date(activity.endDate) : startDate;
    
    // Check if activity overlaps with the given month
    const monthStart = new Date(year, month - 1, 1);
    const monthEnd = new Date(year, month, 0);
    
    return startDate <= monthEnd && endDate >= monthStart;
  });
}

// Get activity for a specific date
export function getActivityForDate(dateStr: string, group: ProgramGroup, showKKT: boolean = false): Activity | undefined {
  return allActivities.find(activity => {
    if (activity.group !== group) return false;
    
    // Use regional dates if KKT filter is on and regional dates exist
    const startDate = showKKT && activity.regionalStartDate ? new Date(activity.regionalStartDate) : new Date(activity.startDate);
    const endDate = showKKT && activity.regionalEndDate ? new Date(activity.regionalEndDate) : (activity.endDate ? new Date(activity.endDate) : startDate);
    
    const targetDate = new Date(dateStr);
    return targetDate >= startDate && targetDate <= endDate;
  });
}

// Format date range in English
export function formatDateRange(startDate: string, endDate?: string): string {
  // Parse dates as UTC to ensure consistency between server and client
  const [startYear, startMonth, startDay] = startDate.split('-').map(Number);
  const start = new Date(Date.UTC(startYear, startMonth - 1, startDay));
  
  let end: Date;
  if (endDate) {
    const [endYear, endMonth, endDay] = endDate.split('-').map(Number);
    end = new Date(Date.UTC(endYear, endMonth - 1, endDay));
  } else {
    end = start;
  }
  
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  
  if (!endDate || startDate === endDate) {
    return `${start.getUTCDate()} ${monthNames[start.getUTCMonth()]}`;
  }
  
  if (start.getUTCMonth() === end.getUTCMonth() && start.getUTCFullYear() === end.getUTCFullYear()) {
    return `${start.getUTCDate()} - ${end.getUTCDate()} ${monthNames[end.getUTCMonth()]}`;
  }
  
  if (start.getUTCFullYear() === end.getUTCFullYear()) {
    return `${start.getUTCDate()} ${monthNames[start.getUTCMonth()]} - ${end.getUTCDate()} ${monthNames[end.getUTCMonth()]}`;
  }
  
  return `${start.getUTCDate()} ${monthNames[start.getUTCMonth()]} ${start.getUTCFullYear()} - ${end.getUTCDate()} ${monthNames[end.getUTCMonth()]} ${end.getUTCFullYear()}`;
}

/** Days from today to activity start (UTC-normalized). Returns null if start is today or in the past. */
export function getDaysUntilStart(activity: Activity, todayStr: string, showKKT?: boolean): number | null {
  const startStr = showKKT && activity.regionalStartDate ? activity.regionalStartDate : activity.startDate;
  const [startYear, startMonth, startDay] = startStr.split('-').map(Number);
  const [todayYear, todayMonth, todayDay] = todayStr.split('-').map(Number);
  const start = new Date(Date.UTC(startYear, startMonth - 1, startDay));
  const today = new Date(Date.UTC(todayYear, todayMonth - 1, todayDay));
  const diffMs = start.getTime() - today.getTime();
  const days = Math.floor(diffMs / 86400000);
  return days > 0 ? days : null;
}

export function formatCountdown(days: number): string {
  return days === 1 ? 'In 1 day' : `In ${days} days`;
}

// Get months that should be displayed for a group based on available activities
export interface GetMonthsOptions {
  selectedProgram: string;
  showRegistration?: boolean;
  showLecture?: boolean;
  showExamination?: boolean;
  showOthersExams?: boolean;
  showBreak?: boolean;
  showSemesterPendek?: boolean;
  showKuliahIntersesi?: boolean;
  showKKT?: boolean;
}

export function getMonthsForGroup(
  group: ProgramGroup,
  options: GetMonthsOptions
): Array<{ month: number; year: number }> {
  const {
    selectedProgram,
    showRegistration = true,
    showLecture = true,
    showExamination = true,
    showOthersExams = true,
    showBreak = true,
    showSemesterPendek = true,
    showKuliahIntersesi = true,
    showKKT = false,
  } = options;

  // Helper function to check if activity should be shown (same logic as shouldShowActivity in grid-view)
  const shouldShowActivity = (activity: Activity): boolean => {
    if (activity.type === 'registration' && !showRegistration) return false;
    if (activity.type === 'lecture' && !showLecture) return false;
    if (activity.type === 'examination' && !showExamination) return false;
    if (activity.type === 'break' && !showBreak) return false;
    
    // Filter out Semester Pendek if toggle is off
    if (activity.type === 'lecture' && activity.name.includes('Semester Pendek') && !showSemesterPendek) return false;
    
    // Filter out Kuliah Intersesi if toggle is off
    if (activity.type === 'lecture' && activity.name.includes('Intersesi') && !showKuliahIntersesi) return false;
    
    // Filter out Others Exams (Peperiksaan/Penilaian Khas/Intersesi/Semester Pendek + English Exit Test) if toggle is off
    if (activity.type === 'examination' && (activity.name.includes('Khas') || activity.name.includes('English Exit Test') || activity.name.includes('EET Lisan')) && !showOthersExams) return false;
    
    // Handle "All" option - show all Group B activities (semua and every programType)
    if (selectedProgram === 'All') {
      return true;
    }
    
    // Filter by program type - check if activity has programType and if it matches selectedProgram
    if (activity.programType) {
      if (activity.programType !== selectedProgram) return false;
    }
    
    return true;
  };

  // Collect all relevant dates from activities
  const relevantDates: Date[] = [];

  for (const activity of allActivities) {
    if (activity.group !== group) continue;
    if (!shouldShowActivity(activity)) continue;

    // Use regional dates if KKT filter is on and regional dates exist
    let startDate: Date;
    let endDate: Date;

    if (showKKT && activity.regionalStartDate) {
      startDate = new Date(activity.regionalStartDate);
      endDate = activity.regionalEndDate ? new Date(activity.regionalEndDate) : startDate;
    } else {
      startDate = new Date(activity.startDate);
      endDate = activity.endDate ? new Date(activity.endDate) : startDate;
    }

    relevantDates.push(startDate);
    relevantDates.push(endDate);
  }

  if (relevantDates.length === 0) {
    // Return default months if no activities found
    if (group === 'A') {
      return [
        { month: 12, year: 2025 },
        { month: 1, year: 2026 },
        { month: 2, year: 2026 },
        { month: 3, year: 2026 },
        { month: 4, year: 2026 },
        { month: 5, year: 2026 },
      ];
    } else {
      return [
        { month: 3, year: 2026 },
        { month: 4, year: 2026 },
        { month: 5, year: 2026 },
        { month: 6, year: 2026 },
        { month: 7, year: 2026 },
        { month: 8, year: 2026 },
      ];
    }
  }

  // Find min and max dates
  const minDate = new Date(Math.min(...relevantDates.map(d => d.getTime())));
  const maxDate = new Date(Math.max(...relevantDates.map(d => d.getTime())));

  // Generate array of months from min to max
  const months: Array<{ month: number; year: number }> = [];
  const currentDate = new Date(minDate.getFullYear(), minDate.getMonth(), 1);
  const endMonth = new Date(maxDate.getFullYear(), maxDate.getMonth(), 1);

  while (currentDate <= endMonth) {
    months.push({
      month: currentDate.getMonth() + 1, // JavaScript months are 0-indexed
      year: currentDate.getFullYear(),
    });
    
    // Move to next month
    currentDate.setMonth(currentDate.getMonth() + 1);
  }

  return months;
}
