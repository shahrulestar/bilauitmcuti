'use client';

import { useState, useEffect, useLayoutEffect, useCallback } from 'react';
import { usePathname } from 'next/navigation';
import { CalendarHeader } from '@/components/calendar-header';
import { CalendarControls } from '@/components/calendar-controls';
import { ListView } from '@/components/list-view';
import { GridView } from '@/components/grid-view';
import { getProgramFromRoute } from '@/lib/route-utils';
import type { ViewMode, Theme } from '@/app/page';

interface SharedCalendarLayoutProps {
  children?: React.ReactNode;
  viewMode: ViewMode;
  programFromRoute: string;
}

export function SharedCalendarLayout({ 
  viewMode, 
  programFromRoute 
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
  
  // Initialize filter states synchronously from DOM data attribute (set by layout.tsx script)
  // This MUST run synchronously during component initialization, before first render
  // The blocking script in layout.tsx sets data-filters attribute before React hydration
  const getInitialFilterState = () => {
    if (typeof window === 'undefined') {
      // Server-side: return defaults (will be overridden on client)
      return {
        showKKT: false,
        showRegistration: false,
        showLecture: true,
        showSemesterPendek: false,
        showKuliahIntersesi: false,
        showExamination: true,
        showOthersExams: false,
        showBreak: true,
      };
    }
    
    // Client-side: Read from data attribute set by blocking script in layout.tsx
    // This attribute is set BEFORE React hydration, ensuring correct values on first render
    try {
      const filtersAttr = document.documentElement.getAttribute('data-filters');
      if (filtersAttr) {
        const filters = JSON.parse(filtersAttr);
        // Parse each filter value (they're stored as JSON strings)
        return {
          showKKT: JSON.parse(filters.showKKT),
          showRegistration: JSON.parse(filters.showRegistration),
          showLecture: JSON.parse(filters.showLecture),
          showSemesterPendek: JSON.parse(filters.showSemesterPendek),
          showKuliahIntersesi: JSON.parse(filters.showKuliahIntersesi),
          showExamination: JSON.parse(filters.showExamination),
          showOthersExams: JSON.parse(filters.showOthersExams),
          showBreak: JSON.parse(filters.showBreak),
        };
      }
    } catch (e) {
      // If data attribute parsing fails, fall through to localStorage fallback
    }
    
    // Fallback to localStorage (shouldn't be needed if script runs correctly)
    try {
      return {
        showKKT: JSON.parse(localStorage.getItem('showKKT') || 'false'),
        showRegistration: JSON.parse(localStorage.getItem('showRegistration') || 'false'),
        showLecture: JSON.parse(localStorage.getItem('showLecture') || 'true'),
        showSemesterPendek: JSON.parse(localStorage.getItem('showSemesterPendek') || 'false'),
        showKuliahIntersesi: JSON.parse(localStorage.getItem('showKuliahIntersesi') || 'false'),
        showExamination: JSON.parse(localStorage.getItem('showExamination') || 'true'),
        showOthersExams: JSON.parse(localStorage.getItem('showOthersExams') || 'false'),
        showBreak: JSON.parse(localStorage.getItem('showBreak') || 'true'),
      };
    } catch {
      // Final fallback: return defaults
      return {
        showKKT: false,
        showRegistration: false,
        showLecture: true,
        showSemesterPendek: false,
        showKuliahIntersesi: false,
        showExamination: true,
        showOthersExams: false,
        showBreak: true,
      };
    }
  };

  const initialFilters = getInitialFilterState();

  // Get initial theme synchronously from DOM (set by layout.tsx script before React hydration)
  // CRITICAL: Server and client MUST use the same logic to prevent hydration mismatch
  // Server always returns 'dark' (default), client reads from DOM class set by blocking script
  const getInitialTheme = (): Theme => {
    if (typeof window === 'undefined') {
      // Server-side: Always return 'dark' as default to match blocking script default
      // The blocking script will set the correct theme class before hydration
      return 'dark';
    }
    
    // Client-side: Read from DOM class FIRST (set by blocking script before React hydration)
    // This ensures server and client render with the same theme on first render
    const htmlElement = document.documentElement;
    const hasLight = htmlElement.classList.contains('light');
    
    if (hasLight) {
      return 'light';
    }
    
    // Default to dark (matches server default and blocking script default)
    return 'dark';
  };

  const initialTheme = getInitialTheme();

  // State management for settings
  // Initialize with values from DOM/data attributes to prevent flicker on first render
  // All values are read synchronously before React's first render
  const [showKKT, setShowKKT] = useState(initialFilters.showKKT);
  const [theme, setTheme] = useState<Theme>(initialTheme);
  const [showRegistration, setShowRegistration] = useState(initialFilters.showRegistration);
  const [showLecture, setShowLecture] = useState(initialFilters.showLecture);
  const [showSemesterPendek, setShowSemesterPendek] = useState(initialFilters.showSemesterPendek);
  const [showKuliahIntersesi, setShowKuliahIntersesi] = useState(initialFilters.showKuliahIntersesi);
  const [showExamination, setShowExamination] = useState(initialFilters.showExamination);
  const [showOthersExams, setShowOthersExams] = useState(initialFilters.showOthersExams);
  const [showBreak, setShowBreak] = useState(initialFilters.showBreak);
  const [isLoaded, setIsLoaded] = useState(false);
  const [currentMonth, setCurrentMonth] = useState('Academic Calendar');
  const [selectedStates, setSelectedStates] = useState<string[]>(initialFilters.showKKT ? ['Kedah', 'Kelantan', 'Terengganu'] : []);

  // Verify theme sync on mount - ensure DOM and state match localStorage
  // This ONLY runs once on mount to sync any discrepancies
  useLayoutEffect(() => {
    if (typeof window === 'undefined') return;
    
    try {
      const savedTheme = localStorage.getItem('theme') as Theme | null;
      const htmlElement = document.documentElement;
      
      if (savedTheme && (savedTheme === 'light' || savedTheme === 'dark')) {
        // Ensure DOM matches localStorage
        const currentDomTheme = htmlElement.classList.contains('light') ? 'light' : 'dark';
        
        if (currentDomTheme !== savedTheme) {
          // Sync DOM with localStorage
          htmlElement.classList.remove('dark', 'light');
          htmlElement.classList.add(savedTheme);
          
          if (savedTheme === 'light') {
            htmlElement.style.backgroundColor = '#ffffff';
            htmlElement.style.color = '#1a1a1a';
          } else {
            htmlElement.style.backgroundColor = '#1a1a1a';
            htmlElement.style.color = '#ffffff';
          }
        }
      } else {
        // Default to dark
        if (!htmlElement.classList.contains('dark')) {
          htmlElement.classList.remove('light');
          htmlElement.classList.add('dark');
          htmlElement.style.backgroundColor = '#1a1a1a';
          htmlElement.style.color = '#ffffff';
        }
      }
    } catch (e) {
      // Fallback to dark on error
      const htmlElement = document.documentElement;
      if (!htmlElement.classList.contains('dark')) {
        htmlElement.classList.remove('light');
        htmlElement.classList.add('dark');
        htmlElement.style.backgroundColor = '#1a1a1a';
        htmlElement.style.color = '#ffffff';
      }
    }
  }, []);

  // Mark as loaded after initial render (filters already initialized synchronously)
  useEffect(() => {
    setIsLoaded(true);
  }, []);

  // Save all preferences to localStorage synchronously to prevent loss during navigation
  useEffect(() => {
    if (!isLoaded) return;
    
    // Save all settings in one go
    try {
      localStorage.setItem('showKKT', JSON.stringify(showKKT));
      localStorage.setItem('showRegistration', JSON.stringify(showRegistration));
      localStorage.setItem('showLecture', JSON.stringify(showLecture));
      localStorage.setItem('showSemesterPendek', JSON.stringify(showSemesterPendek));
      localStorage.setItem('showKuliahIntersesi', JSON.stringify(showKuliahIntersesi));
      localStorage.setItem('showExamination', JSON.stringify(showExamination));
      localStorage.setItem('showOthersExams', JSON.stringify(showOthersExams));
      localStorage.setItem('showBreak', JSON.stringify(showBreak));
      
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
  }, [showKKT, showRegistration, showLecture, showSemesterPendek, showKuliahIntersesi, showExamination, showOthersExams, showBreak, isLoaded]);

  // Save theme separately for instant application
  useEffect(() => {
    if (!isLoaded) return;
    
    try {
      localStorage.setItem('theme', theme);
      
      // Apply theme to DOM immediately
      const htmlEl = document.documentElement;
      htmlEl.classList.remove('dark', 'light');
      htmlEl.classList.add(theme);
      
      // Update inline styles
      if (theme === 'light') {
        htmlEl.style.backgroundColor = '#ffffff';
        htmlEl.style.color = '#1a1a1a';
      } else {
        htmlEl.style.backgroundColor = '#1a1a1a';
        htmlEl.style.color = '#ffffff';
      }
      
      // Update browser tab/window chrome color dynamically
      const metaThemeColor = document.querySelector('meta[name="theme-color"]');
      if (metaThemeColor) {
        metaThemeColor.setAttribute('content', theme === 'dark' ? '#1a1a1a' : '#ffffff');
      }
    } catch (e) {
      console.warn('Failed to save theme:', e);
    }
  }, [theme, isLoaded]);

  const bgClass = theme === 'dark' ? 'bg-[#1a1a1a] text-white' : 'bg-white text-[#1a1a1a]';

  // Optimized theme change handler - instant update without transition delay
  const handleThemeChange = useCallback((newTheme: Theme) => {
    setTheme(newTheme);
  }, []);

  return (
    <div 
      className={`min-h-screen ${bgClass}`} 
      suppressHydrationWarning
      style={{
        // Inline style to prevent flash during hydration
        backgroundColor: theme === 'dark' ? '#1a1a1a' : '#ffffff',
        color: theme === 'dark' ? '#ffffff' : '#1a1a1a',
      }}
    >
      <div className="mx-auto max-w-[1000px] px-4 py-8 sm:px-6 lg:px-4">
        {/* Header */}
        <CalendarHeader theme={theme} />

        {/* Controls */}
        <CalendarControls
          selectedProgram={selectedProgram}
          viewMode={viewMode}
          showKKT={showKKT}
          onShowKKTChange={setShowKKT}
          theme={theme}
          onThemeChange={handleThemeChange}
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
          currentMonth={currentMonth}
        />

        {/* Views - Use key to maintain component identity during route transitions */}
        <div className="mt-0 min-h-[400px]">
          {viewMode === 'list' ? (
            <ListView 
              key={`list-${selectedProgram}`}
              selectedProgram={selectedProgram} 
              showKKT={showKKT}
              theme={theme}
              showRegistration={showRegistration}
              showLecture={showLecture}
              showSemesterPendek={showSemesterPendek}
              showKuliahIntersesi={showKuliahIntersesi}
              showExamination={showExamination}
              showOthersExams={showOthersExams}
              showBreak={showBreak}
              onMonthChange={setCurrentMonth}
              selectedStates={selectedStates}
            />
          ) : (
            <GridView 
              key={`grid-${selectedProgram}`}
              selectedProgram={selectedProgram} 
              showKKT={showKKT}
              theme={theme}
              showRegistration={showRegistration}
              showLecture={showLecture}
              showSemesterPendek={showSemesterPendek}
              showKuliahIntersesi={showKuliahIntersesi}
              showExamination={showExamination}
              showOthersExams={showOthersExams}
              onMonthChange={setCurrentMonth}
              showBreak={showBreak}
              selectedStates={selectedStates}
            />
          )}
        </div>
      </div>
    </div>
  );
}
