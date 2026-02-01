'use client';

import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { CalendarHeader } from '@/components/calendar-header';
import { CalendarControls } from '@/components/calendar-controls';
import { ListView } from '@/components/list-view';
import { GridView } from '@/components/grid-view';
import { getProgramFromRoute } from '@/lib/route-utils';
import { DEFAULT_FILTER_STATES } from '@/lib/data';
import { setFiltersToCookie, type FilterStates } from '@/lib/cookie-utils';
import type { ViewMode } from '@/app/page';

interface SharedCalendarLayoutProps {
  children?: React.ReactNode;
  viewMode: ViewMode;
  programFromRoute: string;
  initialFilters?: FilterStates; // Optional: passed from server component that reads cookies
  initialCurrentDate?: string; // Optional: passed from server component with Malaysia timezone date
}

export function SharedCalendarLayout({ 
  viewMode, 
  programFromRoute,
  initialFilters: initialFiltersFromProps,
  initialCurrentDate
}: SharedCalendarLayoutProps) {
  const pathname = usePathname();
  
  // Determine program from route
  // For homepage (/) or /list, use programFromRoute (which should be "All")
  // For /[program] or /[program]/list, extract the program segment
  let routeSegment: string | null = null;
  if (pathname) {
    const segments = pathname.split('/').filter(Boolean);
    // If first segment is "list", it's /list (All programs)
    // Otherwise, first segment is the program route
    if (segments.length > 0 && segments[0] !== 'list') {
      routeSegment = segments[0];
    }
  }
  
  // Use routeSegment if available, otherwise fall back to programFromRoute
  // programFromRoute is passed from the page component and should be the program slug
  const selectedProgram = getProgramFromRoute(routeSegment || (programFromRoute && programFromRoute !== 'All' ? programFromRoute : null));
  
  // Initialize filter states
  // Priority: 1) Props from server (cookie-based), 2) DOM data attribute (client), 3) Defaults
  const getInitialFilterState = (): FilterStates => {
    // Use DEFAULT_FILTER_STATES from data.ts as single source of truth
    const defaults = DEFAULT_FILTER_STATES;

    // If initialFilters passed from server component (from cookies), use them
    // This ensures SSR and client have the same initial state
    if (initialFiltersFromProps) {
      return initialFiltersFromProps;
    }

    // Only read from DOM on client side
    if (typeof window === 'undefined') {
      return defaults;
    }

    // Try to read from data-filters attribute synchronously
    try {
      const filtersAttr = document.documentElement.getAttribute('data-filters');
      if (filtersAttr) {
        const filters = JSON.parse(filtersAttr);
        return {
          showKKT: JSON.parse(filters.showKKT ?? JSON.stringify(defaults.showKKT)),
          showRegistration: JSON.parse(filters.showRegistration ?? JSON.stringify(defaults.showRegistration)),
          showLecture: JSON.parse(filters.showLecture ?? JSON.stringify(defaults.showLecture)),
          showSemesterPendek: JSON.parse(filters.showSemesterPendek ?? JSON.stringify(defaults.showSemesterPendek)),
          showKuliahIntersesi: JSON.parse(filters.showKuliahIntersesi ?? JSON.stringify(defaults.showKuliahIntersesi)),
          showExamination: JSON.parse(filters.showExamination ?? JSON.stringify(defaults.showExamination)),
          showOthersExams: JSON.parse(filters.showOthersExams ?? JSON.stringify(defaults.showOthersExams)),
          showBreak: JSON.parse(filters.showBreak ?? JSON.stringify(defaults.showBreak)),
          showCountdown: JSON.parse(filters.showCountdown ?? JSON.stringify(defaults.showCountdown)),
        };
      }
    } catch (e) {
      // If parsing fails, fall back to defaults from data.ts
      console.warn('Failed to parse data-filters attribute:', e);
    }

    return defaults;
  };

  const initialFilters = getInitialFilterState();

  // State management for settings
  // Initialize with values from DOM/data attributes to prevent flicker on first render
  // All values are read synchronously before React's first render
  const [showKKT, setShowKKT] = useState(initialFilters.showKKT);
  const [showRegistration, setShowRegistration] = useState(initialFilters.showRegistration);
  const [showLecture, setShowLecture] = useState(initialFilters.showLecture);
  const [showSemesterPendek, setShowSemesterPendek] = useState(initialFilters.showSemesterPendek);
  const [showKuliahIntersesi, setShowKuliahIntersesi] = useState(initialFilters.showKuliahIntersesi);
  const [showExamination, setShowExamination] = useState(initialFilters.showExamination);
  const [showOthersExams, setShowOthersExams] = useState(initialFilters.showOthersExams);
  const [showBreak, setShowBreak] = useState(initialFilters.showBreak);
  const [showCountdown, setShowCountdown] = useState(initialFilters.showCountdown);
  const [isLoaded, setIsLoaded] = useState(false);
  const [currentMonth, setCurrentMonth] = useState('Academic Calendar');
  const [selectedStates, setSelectedStates] = useState<string[]>(initialFilters.showKKT ? ['Kedah', 'Kelantan', 'Terengganu'] : []);


  // Mark as loaded after initial render
  // Since filters are now synced synchronously, we only need to mark as loaded
  useEffect(() => {
    setIsLoaded(true);
  }, []);

  // Save all preferences to localStorage and cookies synchronously to prevent loss during navigation
  useEffect(() => {
    if (!isLoaded) return;
    
    const filterStates: FilterStates = {
      showKKT,
      showRegistration,
      showLecture,
      showSemesterPendek,
      showKuliahIntersesi,
      showExamination,
      showOthersExams,
      showBreak,
      showCountdown,
    };
    
    // Save all settings in one go
    try {
      // Save to localStorage
      localStorage.setItem('showKKT', JSON.stringify(showKKT));
      localStorage.setItem('showRegistration', JSON.stringify(showRegistration));
      localStorage.setItem('showLecture', JSON.stringify(showLecture));
      localStorage.setItem('showSemesterPendek', JSON.stringify(showSemesterPendek));
      localStorage.setItem('showKuliahIntersesi', JSON.stringify(showKuliahIntersesi));
      localStorage.setItem('showExamination', JSON.stringify(showExamination));
      localStorage.setItem('showOthersExams', JSON.stringify(showOthersExams));
      localStorage.setItem('showBreak', JSON.stringify(showBreak));
      localStorage.setItem('showCountdown', JSON.stringify(showCountdown));
      
      // Save to cookie for SSR consistency
      setFiltersToCookie(filterStates);
      
      // Update data-filters attribute immediately for next component mount
      const filters = {
        showKKT: JSON.stringify(showKKT),
        showRegistration: JSON.stringify(showRegistration),
        showLecture: JSON.stringify(showLecture),
        showSemesterPendek: JSON.stringify(showSemesterPendek),
        showKuliahIntersesi: JSON.stringify(showKuliahIntersesi),
        showExamination: JSON.stringify(showExamination),
        showOthersExams: JSON.stringify(showOthersExams),
        showBreak: JSON.stringify(showBreak),
        showCountdown: JSON.stringify(showCountdown),
      };
      document.documentElement.setAttribute('data-filters', JSON.stringify(filters));
    } catch (e) {
      console.warn('Failed to save settings:', e);
    }
    
    // Sync showKKT with selectedStates
    if (showKKT) {
      setSelectedStates(['Kedah', 'Kelantan', 'Terengganu']);
    } else {
      setSelectedStates([]);
    }
  }, [showKKT, showRegistration, showLecture, showSemesterPendek, showKuliahIntersesi, showExamination, showOthersExams, showBreak, showCountdown, isLoaded]);

  // Theme-aware classes
  const bgClass = 'bg-background text-foreground';

  return (
    <div className={`min-h-screen ${bgClass} transition-none`} style={{ transition: 'none' }}>
      <div className="mx-auto max-w-[1000px] px-4 py-8 sm:px-6 lg:px-4 transition-none" style={{ transition: 'none' }}>
        {/* Header */}
        <CalendarHeader />

        {/* Controls */}
        <CalendarControls
          selectedProgram={selectedProgram}
          viewMode={viewMode}
          showKKT={showKKT}
          onShowKKTChange={setShowKKT}
          showRegistration={showRegistration}
          onShowRegistrationChange={setShowRegistration}
          showLecture={showLecture}
          onShowLectureChange={setShowLecture}
          showSemesterPendek={showSemesterPendek}
          onShowSemesterPendekChange={setShowSemesterPendek}
          showKuliahIntersesi={showKuliahIntersesi}
          onShowKuliahIntersesiChange={setShowKuliahIntersesi}
          showExamination={showExamination}
          onShowExaminationChange={setShowExamination}
          showOthersExams={showOthersExams}
          onShowOthersExamsChange={setShowOthersExams}
          showBreak={showBreak}
          onShowBreakChange={setShowBreak}
          showCountdown={showCountdown}
          onShowCountdownChange={setShowCountdown}
          currentMonth={currentMonth}
        />

        {/* Views - Use key to maintain component identity during route transitions */}
        <div className="mt-0 min-h-[400px]">
          {viewMode === 'list' ? (
            <ListView 
              key={`list-${selectedProgram}`}
              selectedProgram={selectedProgram} 
              showKKT={showKKT}
              showRegistration={showRegistration}
              showLecture={showLecture}
              showSemesterPendek={showSemesterPendek}
              showKuliahIntersesi={showKuliahIntersesi}
              showExamination={showExamination}
              showOthersExams={showOthersExams}
              showBreak={showBreak}
              showCountdown={showCountdown}
              onMonthChange={setCurrentMonth}
              selectedStates={selectedStates}
            />
          ) : (
            <GridView 
              key={`grid-${selectedProgram}`}
              selectedProgram={selectedProgram} 
              showKKT={showKKT}
              showRegistration={showRegistration}
              showLecture={showLecture}
              showSemesterPendek={showSemesterPendek}
              showKuliahIntersesi={showKuliahIntersesi}
              showExamination={showExamination}
              showOthersExams={showOthersExams}
              showBreak={showBreak}
              showCountdown={showCountdown}
              onMonthChange={setCurrentMonth}
              selectedStates={selectedStates}
              initialCurrentDate={initialCurrentDate}
            />
          )}
        </div>
      </div>
    </div>
  );
}
