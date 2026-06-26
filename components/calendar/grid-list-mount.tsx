'use client';

import { ListView } from '@/components/list-view';
import { GridView } from '@/components/grid-view';
import {
  useCalendarCommittedProgram,
  useCalendarCommittedSessions,
} from '@/components/calendar-data-gate';
import type { ViewMode } from '@/app/page';

export interface CalendarGridListMountProps {
  bothViewsMounted: boolean;
  activeViewMode: ViewMode;
  showKKT: boolean;
  showRegistration: boolean;
  showLecture: boolean;
  showSemesterPendek: boolean;
  showKuliahIntersesi: boolean;
  showExamination: boolean;
  showOthersExams: boolean;
  showBreak: boolean;
  showCountdown: boolean;
  onMonthChange: (month: string) => void;
  selectedStates: string[];
  initialCurrentDate?: string;
}

/** Grid/list use committed program + sessions so they stay in sync with the store (see CalendarDataGate). */
export function CalendarGridListMount({
  bothViewsMounted,
  activeViewMode,
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
  selectedStates,
  initialCurrentDate,
}: CalendarGridListMountProps) {
  const calendarDataProgram = useCalendarCommittedProgram();
  const calendarDataSessions = useCalendarCommittedSessions();

  const sharedViewProps = {
    selectedProgram: calendarDataProgram,
    selectedSessions: calendarDataSessions,
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
    selectedStates,
    initialCurrentDate,
  };

  return (
    <>
      {bothViewsMounted ? (
        <>
          <div style={{ display: activeViewMode === 'list' ? 'block' : 'none' }}>
            <ListView {...sharedViewProps} />
          </div>
          <div style={{ display: activeViewMode === 'grid' ? 'block' : 'none' }}>
            <GridView {...sharedViewProps} />
          </div>
        </>
      ) : activeViewMode === 'list' ? (
        <ListView {...sharedViewProps} />
      ) : (
        <GridView {...sharedViewProps} />
      )}
    </>
  );
}
