'use client';

import { useState, useEffect, useLayoutEffect, useCallback } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { CalendarHeader } from '@/components/calendar-header';
import { CalendarControls } from '@/components/calendar-controls';
import { PwaPromptAlert } from '@/components/pwa-prompt-alert';
import { ListView } from '@/components/list-view';
import { GridView } from '@/components/grid-view';
import { getProgramFromRoute, getRoutePath } from '@/lib/route-utils';
import type { ProgramValue } from '@/lib/route-utils';
import { DEFAULT_FILTER_STATES, getGroupFromSession, getSessionForCurrentDate } from '@/lib/data';
import type { SessionId } from '@/lib/data';
import { setFiltersToCookie, type FilterStates } from '@/lib/cookie-utils';
import type { ViewMode } from '@/app/page';

type ProgramSessionMap = Partial<Record<ProgramValue, SessionId[]>>;

function getGroupFromProgram(program: ProgramValue): 'A' | 'B' {
  return program === 'Foundation/Professional' ? 'A' : 'B';
}

function getSessionMemoryKey(program: ProgramValue): ProgramValue {
  return getGroupFromProgram(program) === 'B' ? 'All' : program;
}

function normalizeSessionsForGroup(sessionIds: SessionId[], group: 'A' | 'B'): SessionId[] {
  const unique = Array.from(new Set(sessionIds));
  return unique.filter((id) => getGroupFromSession(id) === group);
}

function areSessionListsEqual(left: SessionId[], right: SessionId[]): boolean {
  if (left.length !== right.length) return false;
  return left.every((id, index) => right[index] === id);
}

interface SharedCalendarLayoutProps {
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
  const router = useRouter();
  
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
  const routeSelectedProgram = getProgramFromRoute(
    routeSegment || (programFromRoute && programFromRoute !== 'All' ? programFromRoute : null)
  );
  // Optimistic program state makes dropdown label update immediately on user click,
  // instead of waiting for router pathname update.
  const [selectedProgram, setSelectedProgram] = useState(routeSelectedProgram);
  const programGroup = getGroupFromProgram(selectedProgram);

  // Keep optimistic state aligned with actual route state.
  useEffect(() => {
    setSelectedProgram(routeSelectedProgram);
  }, [routeSelectedProgram]);

  // Disable browser's automatic scroll restoration so back-navigation
  // doesn't fight with our own scroll-to-top, preventing sticky header jump
  useEffect(() => {
    if ('scrollRestoration' in history) {
      history.scrollRestoration = 'manual';
    }
  }, []);

  // Scroll to top when mounting or returning from chat/PWA (consistent with grid/list view switch)
  useLayoutEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  // Handle bfcache restore (mobile Safari/PWA) - scroll to top when page resurrected from cache
  useEffect(() => {
    const handlePageShow = (e: PageTransitionEvent) => {
      if (e.persisted) {
        requestAnimationFrame(() => window.scrollTo(0, 0));
      }
    };
    window.addEventListener('pageshow', handlePageShow);
    return () => window.removeEventListener('pageshow', handlePageShow);
  }, [pathname]);

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

  const getInitialProgramSessions = (): ProgramSessionMap => {
    const rawMap = initialFiltersFromProps?.sessionIdsByProgram;
    const nextMap: ProgramSessionMap = {};
    if (rawMap && typeof rawMap === 'object') {
      for (const [key, value] of Object.entries(rawMap)) {
        if (!Array.isArray(value) || value.length === 0) continue;
        const program = key as ProgramValue;
        const group = getGroupFromProgram(program);
        const normalized = normalizeSessionsForGroup(value as SessionId[], group);
        if (normalized.length > 0) nextMap[getSessionMemoryKey(program)] = normalized;
      }
    }

    // Client-side fallback: restore per-program sessions from localStorage if available.
    if (typeof window !== 'undefined' && Object.keys(nextMap).length === 0) {
      try {
        const rawLocal = localStorage.getItem('sessionIdsByProgram');
        if (rawLocal) {
          const parsed = JSON.parse(rawLocal) as Partial<Record<ProgramValue, SessionId[]>>;
          if (parsed && typeof parsed === 'object') {
            for (const [key, value] of Object.entries(parsed)) {
              if (!Array.isArray(value) || value.length === 0) continue;
              const program = key as ProgramValue;
              const group = getGroupFromProgram(program);
              const normalized = normalizeSessionsForGroup(value as SessionId[], group);
              if (normalized.length > 0) nextMap[getSessionMemoryKey(program)] = normalized;
            }
          }
        }
      } catch {
        // Ignore invalid localStorage payload and continue with cookie/default values.
      }
    }

    // Backward compatibility for existing single session/sessionIds cookie format.
    const fromIds = initialFiltersFromProps?.sessionIds;
    const fromSingle = initialFiltersFromProps?.sessionId;
    const candidates = Array.isArray(fromIds) && fromIds.length > 0
      ? fromIds
      : fromSingle
        ? [fromSingle]
        : [];
    const fallbackForRoute = normalizeSessionsForGroup(candidates as SessionId[], programGroup);
    const routeSessionKey = getSessionMemoryKey(routeSelectedProgram);
    if (fallbackForRoute.length > 0 && !nextMap[routeSessionKey]) {
      nextMap[routeSessionKey] = fallbackForRoute;
    }

    return nextMap;
  };

  const getInitialSessions = (): SessionId[] => {
    const initialMap = getInitialProgramSessions();
    const fromProgram = initialMap[getSessionMemoryKey(routeSelectedProgram)];
    if (fromProgram && fromProgram.length > 0) return fromProgram;

    const fromIds = initialFiltersFromProps?.sessionIds;
    const fromSingle = initialFiltersFromProps?.sessionId;
    const candidates = Array.isArray(fromIds) && fromIds.length > 0
      ? fromIds
      : fromSingle
        ? [fromSingle]
        : null;
    const inGroup = candidates?.filter((id) => getGroupFromSession(id) === programGroup) ?? [];
    if (inGroup.length > 0) return inGroup;
    const dateStr = initialCurrentDate ?? (typeof window !== 'undefined' ? new Date().toISOString().slice(0, 10) : '2026-03-15');
    return [getSessionForCurrentDate(programGroup, dateStr)];
  };

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
  const [sessionsByProgram, setSessionsByProgram] = useState<ProgramSessionMap>(getInitialProgramSessions);
  const [selectedSessions, setSelectedSessions] = useState<SessionId[]>(getInitialSessions);

  // Keep selectedSessions synchronized with selectedProgram using per-program memory.
  useEffect(() => {
    const dateStr = initialCurrentDate ?? new Date().toISOString().slice(0, 10);
    setSelectedSessions((prev) => {
      const targetGroup = getGroupFromProgram(selectedProgram);
      const sessionMemoryKey = getSessionMemoryKey(selectedProgram);
      const fromProgram = normalizeSessionsForGroup(sessionsByProgram[sessionMemoryKey] ?? [], targetGroup);
      if (fromProgram.length > 0) return areSessionListsEqual(prev, fromProgram) ? prev : fromProgram;

      const fallback = [getSessionForCurrentDate(targetGroup, dateStr)];
      return areSessionListsEqual(prev, fallback) ? prev : fallback;
    });
  }, [selectedProgram, sessionsByProgram, initialCurrentDate]);

  // Keep both views mounted - toggle via display to prevent appear effect on view switch
  const [activeViewMode, setActiveViewMode] = useState(viewMode);
  useEffect(() => {
    setActiveViewMode(viewMode);
  }, [viewMode]);

  const handleViewModeChange = useCallback(
    (newMode: ViewMode) => {
      window.scrollTo(0, 0);
      setActiveViewMode(newMode);
      const newPath = getRoutePath(selectedProgram as ProgramValue, newMode);
      window.history.replaceState(null, '', newPath);
    },
    [selectedProgram]
  );

  const handleProgramSessionChange = useCallback(
    (program: ProgramValue, sessionIds: SessionId[]) => {
      setSelectedProgram(program);
      const targetGroup = getGroupFromProgram(program);
      const sessionMemoryKey = getSessionMemoryKey(program);
      const inGroup = normalizeSessionsForGroup(sessionIds, targetGroup);
      const fromProgram = normalizeSessionsForGroup(sessionsByProgram[sessionMemoryKey] ?? [], targetGroup);
      const resolvedSessions =
        inGroup.length > 0
          ? inGroup
          : fromProgram.length > 0
            ? fromProgram
            : [getSessionForCurrentDate(targetGroup, initialCurrentDate ?? new Date().toISOString().slice(0, 10))];
      const nextSessionsByProgram: ProgramSessionMap = {
        ...sessionsByProgram,
        [sessionMemoryKey]: resolvedSessions,
      };

      // Persist selected session(s) before route navigation to avoid remount fallback to default session.
      setFiltersToCookie({
        showKKT,
        showRegistration,
        showLecture,
        showSemesterPendek,
        showKuliahIntersesi,
        showExamination,
        showOthersExams,
        showBreak,
        showCountdown,
        sessionId: resolvedSessions[0],
        sessionIds: resolvedSessions,
        sessionIdsByProgram: nextSessionsByProgram,
      });
      setSessionsByProgram(nextSessionsByProgram);

      setSelectedSessions(resolvedSessions);
      const newPath = getRoutePath(program, activeViewMode);
      if (newPath !== pathname) {
        router.replace(newPath, { scroll: false });
        window.scrollTo(0, 0);
      }
    },
    [
      activeViewMode,
      pathname,
      router,
      initialCurrentDate,
      showKKT,
      showRegistration,
      showLecture,
      showSemesterPendek,
      showKuliahIntersesi,
      showExamination,
      showOthersExams,
      showBreak,
      showCountdown,
      sessionsByProgram,
    ]
  );

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
      sessionId: selectedSessions[0],
      sessionIds: selectedSessions,
      sessionIdsByProgram: sessionsByProgram,
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
      localStorage.setItem('selectedProgram', selectedProgram);
      localStorage.setItem('sessionIdsByProgram', JSON.stringify(sessionsByProgram));
      
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
  }, [showKKT, showRegistration, showLecture, showSemesterPendek, showKuliahIntersesi, showExamination, showOthersExams, showBreak, showCountdown, selectedSessions, sessionsByProgram, isLoaded]);

  // Theme-aware classes
  const bgClass = 'bg-background text-foreground';

  return (
    <div className={`min-h-screen ${bgClass} transition-none relative`} style={{ transition: 'none' }}>
      <div className="mx-auto max-w-[1000px] px-4 py-8 sm:px-6 lg:px-4 transition-none" style={{ transition: 'none' }}>
        <CalendarHeader />
        <PwaPromptAlert />

        <CalendarControls
          selectedProgram={selectedProgram}
          selectedSessions={selectedSessions}
          onProgramSessionChange={handleProgramSessionChange}
          viewMode={activeViewMode}
          onViewModeChange={handleViewModeChange}
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

        {/* Both views always mounted - toggle via display to prevent appear effect on view switch */}
        <div className="mt-0 min-h-[400px] transition-none" style={{ transition: 'none' }}>
          <div style={{ display: activeViewMode === 'list' ? 'block' : 'none' }}>
            <ListView
              selectedProgram={selectedProgram}
              selectedSessions={selectedSessions}
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
          </div>
          <div style={{ display: activeViewMode === 'grid' ? 'block' : 'none' }}>
            <GridView
              selectedProgram={selectedProgram}
              selectedSessions={selectedSessions}
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
          </div>
        </div>
      </div>
    </div>
  );
}
