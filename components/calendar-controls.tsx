'use client';

import { useState, useEffect, useCallback, useMemo, useRef, useSyncExternalStore } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { List, Settings, Calendar, ChevronDown, ChevronUp, MessageCircle } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuPortal,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from '@/components/theme-toggle';
import {
  formatGroupASessionTriggerLabel,
  formatSessionLabelWithId,
  getProgramOptions,
  getActivitiesForSession,
  getSessionOptionsForGroup,
} from '@/lib/data';
import { useCalendarHydrationVersion } from '@/components/calendar-hydration-context';
import { getSnapshot, subscribe } from '@/lib/calendar-store';
import type { SessionId } from '@/lib/data';
import { getLabelForProgramValue, getRoutePath } from '@/lib/route-utils';
import type { ViewMode } from '@/app/page';
import type { ProgramValue } from '@/lib/route-utils';
import { sessionSubmenuItemClass } from '@/lib/session-submenu-item-class';
import { SessionSubmenuItemLabel } from '@/components/session-submenu-item-label';

interface CalendarControlsProps {
  selectedProgram: string;
  selectedSessions: SessionId[];
  onProgramSessionChange?: (program: ProgramValue, sessionIds: SessionId[]) => void;
  viewMode: ViewMode;
  isHomepage?: boolean;
  /** When true, use fixed positioning so controls appear at top from first paint (scroll restore) */
  forceFixed?: boolean;
  /** When provided, view mode switch uses client state instead of router navigation (no appear effect) */
  onViewModeChange?: (mode: ViewMode) => void;
  showKKT: boolean;
  onShowKKTChange: (show: boolean) => void;
  showRegistration: boolean;
  onShowRegistrationChange: (show: boolean) => void;
  showLecture: boolean;
  onShowLectureChange: (show: boolean) => void;
  showExamination: boolean;
  onShowExaminationChange: (show: boolean) => void;
  showOthersExams: boolean;
  onShowOthersExamsChange: (show: boolean) => void;
  showBreak: boolean;
  onShowBreakChange: (show: boolean) => void;
  showCountdown: boolean;
  onShowCountdownChange: (show: boolean) => void;
  showSemesterPendek: boolean;
  onShowSemesterPendekChange: (show: boolean) => void;
  showKuliahIntersesi: boolean;
  onShowKuliahIntersesiChange: (show: boolean) => void;
  currentMonth?: string;
}

export function CalendarControls({
  selectedProgram,
  selectedSessions,
  onProgramSessionChange,
  viewMode,
  isHomepage = false,
  forceFixed = false,
  onViewModeChange,
  showKKT,
  onShowKKTChange,
  showRegistration,
  onShowRegistrationChange,
  showLecture,
  onShowLectureChange,
  showExamination,
  onShowExaminationChange,
  showOthersExams,
  onShowOthersExamsChange,
  showBreak,
  onShowBreakChange,
  showCountdown,
  onShowCountdownChange,
  showSemesterPendek,
  onShowSemesterPendekChange,
  showKuliahIntersesi,
  onShowKuliahIntersesiChange,
  currentMonth = 'Academic Calendar',
}: CalendarControlsProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [activeSubmenu, setActiveSubmenu] = useState<string | null>(null);
  const keepDropdownOpenRef = useRef(false);
  const overlayOpenScrollYRef = useRef(0);
  const [isPWAInstalled, setIsPWAInstalled] = useState(false);
  const [currentFooterText, setCurrentFooterText] = useState(0);

  const hydrationServerVersion = useCalendarHydrationVersion();
  const calendarDataVersion = useSyncExternalStore(
    subscribe,
    () => getSnapshot().version,
    () => hydrationServerVersion
  );
  const programOptions = useMemo(() => {
    void calendarDataVersion;
    return getProgramOptions();
  }, [calendarDataVersion]);

  // Optimized prefetch strategy - delay prefetch until user interaction
  useEffect(() => {
    // Delay prefetch to not block initial render
    const timeoutId = setTimeout(() => {
      // Only prefetch adjacent routes for faster switching
      programOptions.slice(0, 3).forEach((option) => {
        const currentPath = getRoutePath(option.value as ProgramValue, viewMode);
        router.prefetch(currentPath);
      });
    }, 1000); // Delay 1 second after mount
    
    return () => clearTimeout(timeoutId);
  }, [router, viewMode, programOptions]);

  // Toggle session in multi-select; keep at least one selected
  const handleSessionToggle = useCallback((programValue: ProgramValue, sessionId: SessionId, group: 'A' | 'B') => {
    const inGroup = selectedSessions.filter((id) => id.startsWith(`${group}-`));
    const isSelected = inGroup.includes(sessionId);
    let next: SessionId[];
    if (isSelected && inGroup.length > 1) {
      next = inGroup.filter((id) => id !== sessionId);
    } else if (!isSelected) {
      next = [...inGroup, sessionId];
    } else {
      next = inGroup;
    }
    if (onProgramSessionChange) {
      onProgramSessionChange(programValue, next);
    } else {
      const newPath = getRoutePath(programValue, viewMode);
      router.replace(newPath, { scroll: false });
    }
  }, [onProgramSessionChange, selectedSessions, router, viewMode]);

  // Switch program only (parent resolves sessions from sessionsByProgram)
  const handleProgramSelect = useCallback((program: ProgramValue) => {
    if (onProgramSessionChange) {
      onProgramSessionChange(program, []);
    } else {
      const newPath = getRoutePath(program, viewMode);
      router.replace(newPath, { scroll: false });
    }
  }, [onProgramSessionChange, router, viewMode]);

  // Handle view mode change - use callback if provided (client state, no appear effect), else router
  const handleViewModeChange = useCallback(
    (newViewMode: ViewMode) => {
      if (onViewModeChange) {
        onViewModeChange(newViewMode);
      } else {
        const programValue = selectedProgram as ProgramValue;
        const newPath = getRoutePath(programValue, newViewMode);
        router.replace(newPath, { scroll: false });
      }
    },
    [onViewModeChange, router, selectedProgram]
  );

  // Check if app is installed as PWA
  useEffect(() => {
    const isInStandaloneMode = window.matchMedia('(display-mode: standalone)').matches;
    const isInFullScreenMode = document.fullscreenElement !== null;
    const isInMinimalUIMode = (window.navigator as any).standalone === true;
    
    if (isInStandaloneMode || isInFullScreenMode || isInMinimalUIMode) {
      setIsPWAInstalled(true);
    }
  }, []);

  // Memoize filtered program options to avoid recalculation
  const groupAOptions = useMemo(() => programOptions.filter(p => p.group === 'A'), [programOptions]);
  const groupBOptions = useMemo(() => programOptions.filter(p => p.group === 'B'), [programOptions]);
  const groupBProgramForSessions = groupBOptions.some((p) => p.value === selectedProgram)
    ? (selectedProgram as ProgramValue)
    : ('All' as ProgramValue);
  const groupBSessionLabel = useMemo(() => {
    const isGroupASelected = groupAOptions.some((option) => option.value === selectedProgram);
    if (isGroupASelected) return '';
    const labels = selectedSessions
      .filter((sessionId) => sessionId.startsWith('B-'))
      .map((sessionId) => {
        const session = getSessionOptionsForGroup('B').find((item) => item.id === sessionId);
        return session ? formatSessionLabelWithId(session) : sessionId;
      });
    if (labels.length === 0) return 'Select sessions';
    if (labels.length === 1) return labels[0];
    return `${labels.length} Selected`;
  }, [groupAOptions, selectedProgram, selectedSessions]);

  // Memoize current program and session labels
  const currentProgramLabel = useMemo(() => {
    if (selectedProgram === 'All') return 'All';
    const fromApi = programOptions.find((p) => p.value === selectedProgram)?.label;
    if (fromApi) return fromApi;
    return getLabelForProgramValue(selectedProgram as ProgramValue);
  }, [selectedProgram, programOptions]);
  
  // Theme-aware classes
  const bgClass = 'bg-background';
  const textClass = 'text-foreground';
  const iconInactiveClass = 'text-muted-foreground [&_svg]:text-muted-foreground';
  const iconActiveClass = 'text-foreground [&_svg]:text-foreground';
  const iconBaseClass = 'nav-icon-btn bg-transparent hover:!bg-transparent dark:hover:!bg-transparent transition-none !h-[38px] !w-[38px] !min-h-[38px] !max-h-[38px] !p-0 flex items-center justify-center hover:!h-[38px] hover:!min-h-[38px] hover:!max-h-[38px] hover:!p-0 active:!h-[38px] active:!min-h-[38px] active:!max-h-[38px] active:!p-0 [&:hover]:!h-[38px] [&:hover]:!bg-transparent [&:active]:!h-[38px]';

  // Memoize current group determination
  const currentGroup = useMemo(() => 
    groupAOptions.some(p => p.value === selectedProgram) ? 'A' : 'B',
    [groupAOptions, selectedProgram]
  );

  // Memoize activity type checks from all selected sessions
  const sessionActivities = useMemo(() => {
    void calendarDataVersion;
    return selectedSessions.flatMap((sid) => getActivitiesForSession(sid));
  }, [selectedSessions, calendarDataVersion]);
  const activityChecks = useMemo(() => ({
    hasSemesterPendek: sessionActivities.some(
      a => a.type === 'lecture' && (a.name.includes('Short Semester') || a.name.includes('Semester Pendek'))
    ),
    hasKuliahIntersesi: sessionActivities.some(
      a => a.type === 'lecture' && (a.name.includes('Intersession Classes') || a.name.includes('Intersesi'))
    ),
    hasOthersExams: sessionActivities.some(
      a => a.type === 'examination' && a.name.includes('Khas')
    ),
    hasRegionalDateRange: sessionActivities.some(
      a => Boolean(a.regionalStartDate || a.regionalEndDate)
    ),
  }), [sessionActivities]);
  
  const { hasSemesterPendek, hasKuliahIntersesi, hasOthersExams, hasRegionalDateRange } = activityChecks;

  useEffect(() => {
    if (!hasRegionalDateRange && showKKT) onShowKKTChange(false);
  }, [hasRegionalDateRange, showKKT, onShowKKTChange]);

  useEffect(() => {
    if (!isOpen && !dropdownOpen) return;
    overlayOpenScrollYRef.current = window.scrollY;
  }, [isOpen, dropdownOpen]);

  useEffect(() => {
    const handleScroll = () => {
      if (!isOpen && !dropdownOpen) return;
      const hasMeaningfulScroll = Math.abs(window.scrollY - overlayOpenScrollYRef.current) > 8;
      if (!hasMeaningfulScroll) return;

      if (isOpen) setIsOpen(false);
      if (dropdownOpen) {
        setDropdownOpen(false);
        setActiveSubmenu(null);
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [isOpen, dropdownOpen]);

  // Footer crossfade animation
  useEffect(() => {
    if (!isOpen) return;

    // Restart footer rotation when the Settings popover opens.
    setCurrentFooterText(0);

    const interval = setInterval(() => {
      setCurrentFooterText((prev) => (prev + 1) % 4);
    }, 3000);
    return () => clearInterval(interval);
  }, [isOpen]);

  const positionClass = forceFixed
    ? 'fixed top-0 left-1/2 -translate-x-1/2 z-[60] w-full max-w-[1000px]'
    : 'sticky top-0 z-40';
  const stabilityClass = forceFixed ? 'calendar-controls-fixed' : 'calendar-controls-sticky';

  return (
      <div 
        className={`${positionClass} ${bgClass} -mx-4 sm:-mx-6 lg:-mx-4 px-4 sm:px-6 lg:px-4 transition-none overflow-visible ${stabilityClass}`} 
        suppressHydrationWarning
      >
        <div 
          className={`flex flex-row items-center justify-between gap-4 pt-8 w-full px-0 min-h-14 pb-1 ${bgClass} transition-none`} 
          suppressHydrationWarning
          style={{ transition: 'none' }}
        >
        {/* Program + Session selector - Left */}
        <div className="px-0">
          <DropdownMenu
            open={dropdownOpen}
            onOpenChange={(open) => {
              if (!open && keepDropdownOpenRef.current) {
                keepDropdownOpenRef.current = false;
                setDropdownOpen(true);
                return;
              }
              setDropdownOpen(open);
              if (!open) setActiveSubmenu(null);
            }}
          >
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                className={`w-fit max-w-[180px] sm:max-w-[260px] md:max-w-[300px] min-w-0 overflow-hidden !h-[38px] !py-1 border bg-secondary dark:bg-[#2A2A2A] hover:!bg-secondary dark:hover:!bg-[#2A2A2A] active:!bg-secondary dark:active:!bg-[#2A2A2A] border-border focus:outline-none focus:ring-0 focus-visible:outline-none focus-visible:ring-0 ${isHomepage ? '!border !border-border dark:!border-zinc-600 !shadow-none' : ''} ${textClass} flex items-center justify-between gap-2 rounded-lg transition-none`}
                suppressHydrationWarning
              >
                <span className="block min-w-0 flex-1 truncate text-left font-medium text-sm">
                  {currentProgramLabel}
                </span>
                {dropdownOpen ? (
                  <ChevronUp className="h-6 w-6 flex-shrink-0" strokeWidth={2} />
                ) : (
                  <ChevronDown className="h-6 w-6 flex-shrink-0" strokeWidth={2} />
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="min-w-[260px] overflow-visible pt-4 pb-4 pl-3 pr-3 bg-popover dark:bg-[#2A2A2A]" align="start">
              <div className="-mx-1 px-1">
                {/* Group A */}
                <div className="mb-2">
                  <div className="text-xs font-semibold text-muted-foreground mb-2 px-2">GROUP A</div>
                  {groupAOptions.map((option) => {
                    const groupASessionSummary = formatGroupASessionTriggerLabel(
                      option.value,
                      selectedProgram,
                      selectedSessions
                    );
                    return (
                    <DropdownMenuSub
                      key={option.value}
                      open={activeSubmenu === option.value}
                      onOpenChange={(open) => setActiveSubmenu(open ? option.value : null)}
                    >
                      <DropdownMenuSubTrigger
                        className={`cursor-pointer items-start rounded-md ${option.value === selectedProgram ? 'bg-muted' : ''}`}
                        onSelect={(event) => {
                          keepDropdownOpenRef.current = true;
                          event.preventDefault();
                        }}
                      >
                        <div className="flex min-w-0 flex-1 flex-col gap-1 text-left pr-1">
                          <span
                            className={`font-medium text-sm ${
                              option.value === selectedProgram ? 'text-primary' : textClass
                            }`}
                          >
                            {option.label}
                          </span>
                          {groupASessionSummary ? (
                            <span className="min-w-0 text-xs text-muted-foreground text-balance leading-snug">
                              {groupASessionSummary}
                            </span>
                          ) : null}
                        </div>
                      </DropdownMenuSubTrigger>
                      <DropdownMenuPortal>
                        <DropdownMenuSubContent
                          collisionPadding={{ top: 8, right: 28, bottom: 8, left: 8 }}
                          className="min-w-[200px] bg-popover dark:bg-[#2A2A2A]"
                        >
                          {getSessionOptionsForGroup('A').map((sess) => {
                            const isSelected = selectedSessions.includes(sess.id);
                            return (
                              <DropdownMenuItem
                                key={sess.id}
                                className={sessionSubmenuItemClass(isSelected)}
                                onSelect={(event) => {
                                  keepDropdownOpenRef.current = true;
                                  event.preventDefault();
                                }}
                                onClick={() => handleSessionToggle(option.value as ProgramValue, sess.id, 'A')}
                              >
                                <span
                                  className={`pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 flex size-3.5 shrink-0 items-center justify-center rounded-full border ${isSelected ? 'border-primary bg-primary' : 'border-muted-foreground'}`}
                                  aria-hidden
                                />
                                <SessionSubmenuItemLabel session={sess} />
                              </DropdownMenuItem>
                            );
                          })}
                        </DropdownMenuSubContent>
                      </DropdownMenuPortal>
                    </DropdownMenuSub>
                    );
                  })}
                </div>
              </div>
              <div className="my-2 h-px bg-border -mx-3 w-[calc(100%+1.5rem)]" />
              <div className="-mx-1 px-1">
                {/* Group B: Session list, separator, program list */}
                <div>
                  <div className="text-xs font-semibold text-muted-foreground mb-2 px-2">GROUP B</div>
                  <DropdownMenuSub
                    open={activeSubmenu === 'group-b-sessions'}
                    onOpenChange={(open) => setActiveSubmenu(open ? 'group-b-sessions' : null)}
                  >
                    <DropdownMenuSubTrigger
                      className="cursor-pointer items-start"
                      onSelect={(event) => {
                        keepDropdownOpenRef.current = true;
                        event.preventDefault();
                      }}
                    >
                      <div className="flex min-w-0 flex-1 flex-col gap-1 text-left pr-1">
                        <span className="font-medium text-sm">Sessions</span>
                        <span className="min-w-0 text-xs text-muted-foreground text-balance leading-snug">
                          {groupBSessionLabel}
                        </span>
                      </div>
                    </DropdownMenuSubTrigger>
                    <DropdownMenuPortal>
                      <DropdownMenuSubContent
                        collisionPadding={{ top: 8, right: 28, bottom: 8, left: 8 }}
                        className="min-w-[220px] bg-popover dark:bg-[#2A2A2A]"
                      >
                        {getSessionOptionsForGroup('B').map((sess) => {
                          const isSelected = selectedSessions.includes(sess.id);
                          return (
                            <DropdownMenuItem
                              key={sess.id}
                              className={sessionSubmenuItemClass(isSelected)}
                              onSelect={(event) => {
                                keepDropdownOpenRef.current = true;
                                event.preventDefault();
                              }}
                              onClick={() => handleSessionToggle(groupBProgramForSessions, sess.id, 'B')}
                            >
                              <span
                                className={`pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 flex size-3.5 shrink-0 items-center justify-center rounded-full border ${isSelected ? 'border-primary bg-primary' : 'border-muted-foreground'}`}
                                aria-hidden
                              />
                              <SessionSubmenuItemLabel session={sess} />
                            </DropdownMenuItem>
                          );
                        })}
                      </DropdownMenuSubContent>
                    </DropdownMenuPortal>
                  </DropdownMenuSub>
                  <div className="my-2 h-px bg-border -mx-3 w-[calc(100%+1.5rem)]" />
                  {/* Program list - direct click */}
                  {groupBOptions.map((option) => (
                    <DropdownMenuItem
                      key={option.value}
                      className={`cursor-pointer font-medium text-sm data-[highlighted]:bg-muted ${option.value === selectedProgram ? 'bg-muted text-primary data-[highlighted]:text-primary' : 'bg-transparent data-[highlighted]:text-foreground'}`}
                      onClick={() => {
                        setActiveSubmenu(null);
                        setDropdownOpen(false);
                        handleProgramSelect(option.value as ProgramValue);
                      }}
                    >
                      {option.label}
                    </DropdownMenuItem>
                  ))}
                </div>
              </div>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        {/* View controls and Settings combined - Right */}
        <div className="px-0 flex items-center justify-center">
          <div 
            className={`flex items-center justify-center gap-0 rounded-lg p-1 w-fit border border-border bg-secondary dark:bg-[#2A2A2A] transition-none h-[38px]`}
            suppressHydrationWarning
            style={{ transition: 'none' }}
          >
            <Button
              variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
              size="icon"
              onClick={() => handleViewModeChange('grid')}
              className={`${iconBaseClass} ${viewMode === 'grid' ? iconActiveClass : iconInactiveClass}`}
              title="Grid View"
              suppressHydrationWarning
            >
              <Calendar className="h-6 w-6" strokeWidth={2} />
            </Button>
            <Button
              variant={viewMode === 'list' ? 'secondary' : 'ghost'}
              size="icon"
              onClick={() => handleViewModeChange('list')}
              className={`${iconBaseClass} ${viewMode === 'list' ? iconActiveClass : iconInactiveClass}`}
              title="List View"
              suppressHydrationWarning
            >
              <List className="h-6 w-6" strokeWidth={2} />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onMouseEnter={() => router.prefetch('/chat')}
              onClick={() => router.push('/chat')}
              className={`${iconBaseClass} ${iconInactiveClass}`}
              title="Chat"
              suppressHydrationWarning
            >
              <MessageCircle className="h-6 w-6" strokeWidth={2} />
            </Button>
            <div 
              className="mx-1 w-px bg-border transition-none h-full flex items-center" 
              suppressHydrationWarning
            />
            <Popover open={isOpen} onOpenChange={setIsOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className={`${iconBaseClass} ${iconInactiveClass}`}
                  title="Settings"
                  suppressHydrationWarning
                >
                  <Settings className="h-6 w-6" strokeWidth={2} />
                </Button>
              </PopoverTrigger>
              <PopoverContent 
                className="h-auto w-[260px] sm:w-[300px] gap-2 pt-4 pb-4 pl-3 pr-3 z-50 bg-popover dark:bg-[#2A2A2A] transition-none"
                side="bottom"
                align="end"
                sideOffset={4}
                alignOffset={-5}
              >
                <div className="space-y-2 transition-none">
                  {/* Activity Type Toggles */}
                  <div className="space-y-1 transition-none">
                    <label className="flex items-center justify-between cursor-pointer py-0.5 transition-none">
                      <span className="text-sm font-medium text-foreground">Registration</span>
                      <div className={`relative inline-flex h-6 w-11 items-center rounded-full transition-none ${showRegistration ? 'bg-primary' : 'bg-muted'}`}
                        style={{ transition: 'none' }}
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full transition-none shadow-sm ${showRegistration ? 'bg-background' : 'bg-background dark:bg-foreground'}`}
                          style={{ transform: showRegistration ? 'translateX(20px)' : 'translateX(2px)', transition: 'none' }}
                        />
                        <input
                          type="checkbox"
                          checked={showRegistration}
                          onChange={(e) => onShowRegistrationChange(e.target.checked)}
                          className="sr-only"
                          aria-label="Toggle registration events"
                        />
                      </div>
                    </label>

                    <label className="flex items-center justify-between cursor-pointer py-0.5 transition-none">
                      <span className="text-sm font-medium text-foreground">Lecture</span>
                      <div className={`relative inline-flex h-6 w-11 items-center rounded-full transition-none ${showLecture ? 'bg-primary' : 'bg-muted'}`}
                        style={{ transition: 'none' }}
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full transition-none shadow-sm ${showLecture ? 'bg-background' : 'bg-background dark:bg-foreground'}`}
                          style={{ transform: showLecture ? 'translateX(20px)' : 'translateX(2px)', transition: 'none' }}
                        />
                        <input
                          type="checkbox"
                          checked={showLecture}
                          onChange={(e) => onShowLectureChange(e.target.checked)}
                          className="sr-only"
                          aria-label="Toggle lecture events"
                        />
                      </div>
                    </label>

                    {hasSemesterPendek && (
                    <label className="flex items-center justify-between cursor-pointer py-0.5 pl-4 transition-none">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium text-muted-foreground">Short Semester</span>
                      </div>
                      <div className={`relative inline-flex h-6 w-11 items-center rounded-full transition-none ${showSemesterPendek ? 'bg-primary' : 'bg-muted'}`}
                        style={{ transition: 'none' }}
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full transition-none shadow-sm ${showSemesterPendek ? 'bg-background' : 'bg-background dark:bg-foreground'}`}
                          style={{ transform: showSemesterPendek ? 'translateX(20px)' : 'translateX(2px)', transition: 'none' }}
                        />
                        <input
                          type="checkbox"
                          checked={showSemesterPendek}
                          onChange={(e) => onShowSemesterPendekChange(e.target.checked)}
                          className="sr-only"
                          aria-label="Toggle Short Semester events"
                        />
                      </div>
                    </label>
                    )}

                    {hasKuliahIntersesi && (
                    <label className="flex items-center justify-between cursor-pointer py-0.5 pl-4 transition-none">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium text-muted-foreground">Intersession Classes</span>
                      </div>
                      <div className={`relative inline-flex h-6 w-11 items-center rounded-full transition-none ${showKuliahIntersesi ? 'bg-primary' : 'bg-muted'}`}
                        style={{ transition: 'none' }}
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full transition-none shadow-sm ${showKuliahIntersesi ? 'bg-background' : 'bg-background dark:bg-foreground'}`}
                          style={{ transform: showKuliahIntersesi ? 'translateX(20px)' : 'translateX(2px)', transition: 'none' }}
                        />
                        <input
                          type="checkbox"
                          checked={showKuliahIntersesi}
                          onChange={(e) => onShowKuliahIntersesiChange(e.target.checked)}
                          className="sr-only"
                          aria-label="Toggle Intersession Classes events"
                        />
                      </div>
                    </label>
                    )}

                    <label className="flex items-center justify-between cursor-pointer py-0.5 transition-none">
                      <span className="text-sm font-medium text-foreground">Examination</span>
                      <div className={`relative inline-flex h-6 w-11 items-center rounded-full transition-none ${showExamination ? 'bg-primary' : 'bg-muted'}`}
                        style={{ transition: 'none' }}
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full transition-none shadow-sm ${showExamination ? 'bg-background' : 'bg-background dark:bg-foreground'}`}
                          style={{ transform: showExamination ? 'translateX(20px)' : 'translateX(2px)', transition: 'none' }}
                        />
                        <input
                          type="checkbox"
                          checked={showExamination}
                          onChange={(e) => onShowExaminationChange(e.target.checked)}
                          className="sr-only"
                          aria-label="Toggle examination events"
                        />
                      </div>
                    </label>

                    {hasOthersExams && (
                    <label className="flex items-center justify-between cursor-pointer py-0.5 pl-4 transition-none">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium text-muted-foreground">Others Exams</span>
                      </div>
                      <div className={`relative inline-flex h-6 w-11 items-center rounded-full transition-none ${showOthersExams ? 'bg-primary' : 'bg-muted'}`}
                        style={{ transition: 'none' }}
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full transition-none shadow-sm ${showOthersExams ? 'bg-background' : 'bg-background dark:bg-foreground'}`}
                          style={{ transform: showOthersExams ? 'translateX(20px)' : 'translateX(2px)', transition: 'none' }}
                        />
                        <input
                          type="checkbox"
                          checked={showOthersExams}
                          onChange={(e) => onShowOthersExamsChange(e.target.checked)}
                          className="sr-only"
                          aria-label="Toggle others exams events"
                        />
                      </div>
                    </label>
                    )}

                    <label className="flex items-center justify-between cursor-pointer py-0.5 transition-none">
                      <span className="text-sm font-medium text-foreground">Break</span>
                      <div className={`relative inline-flex h-6 w-11 items-center rounded-full transition-none ${showBreak ? 'bg-primary' : 'bg-muted'}`}
                        style={{ transition: 'none' }}
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full transition-none shadow-sm ${showBreak ? 'bg-background' : 'bg-background dark:bg-foreground'}`}
                          style={{ transform: showBreak ? 'translateX(20px)' : 'translateX(2px)', transition: 'none' }}
                        />
                        <input
                          type="checkbox"
                          checked={showBreak}
                          onChange={(e) => onShowBreakChange(e.target.checked)}
                          className="sr-only"
                          aria-label="Toggle break events"
                        />
                      </div>
                    </label>

                    <label className="flex items-center justify-between cursor-pointer py-0.5 transition-none">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-foreground">Show Countdown</span>
                      </div>
                      <div className={`relative inline-flex h-6 w-11 items-center rounded-full transition-none ${showCountdown ? 'bg-primary' : 'bg-muted'}`}
                        style={{ transition: 'none' }}
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full transition-none shadow-sm ${showCountdown ? 'bg-background' : 'bg-background dark:bg-foreground'}`}
                          style={{ transform: showCountdown ? 'translateX(20px)' : 'translateX(2px)', transition: 'none' }}
                        />
                        <input
                          type="checkbox"
                          checked={showCountdown}
                          onChange={(e) => onShowCountdownChange(e.target.checked)}
                          className="sr-only"
                          aria-label="Toggle countdown for lecture, examination, and break events"
                        />
                      </div>
                    </label>
                  </div>

                  {hasRegionalDateRange && (
                  <label className="flex items-center justify-between cursor-pointer py-0.5 transition-none">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-foreground">Show</span>
                      <div className="flex gap-1 pointer-events-none select-none">
                        <Avatar className="h-5 w-5">
                          <AvatarImage src="/flags/kedah.png" alt="Kedah" draggable={false} />
                          <AvatarFallback>KD</AvatarFallback>
                        </Avatar>
                        <Avatar className="h-5 w-5">
                          <AvatarImage src="/flags/kelantan.png" alt="Kelantan" draggable={false} />
                          <AvatarFallback>KT</AvatarFallback>
                        </Avatar>
                        <Avatar className="h-5 w-5">
                          <AvatarImage src="/flags/terengganu.png" alt="Terengganu" draggable={false} />
                          <AvatarFallback>TG</AvatarFallback>
                        </Avatar>
                      </div>
                    </div>
                    <div className={`relative inline-flex h-6 w-11 items-center rounded-full transition-none ${showKKT ? 'bg-primary' : 'bg-muted'}`}
                      style={{ transition: 'none' }}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full transition-none shadow-sm ${showKKT ? 'bg-background' : 'bg-background dark:bg-foreground'}`}
                        style={{ transform: showKKT ? 'translateX(20px)' : 'translateX(2px)', transition: 'none' }}
                      />
                      <input
                        type="checkbox"
                        checked={showKKT}
                        onChange={(e) => onShowKKTChange(e.target.checked)}
                        className="sr-only"
                        aria-label="Toggle Kedah, Kelantan, and Terengganu regional holidays"
                      />
                    </div>
                  </label>
                  )}

                  {/* Theme Toggle */}
                  <ThemeToggle />

                  {/* Made By and Source + Share/PWA */}
                  <div className="text-left text-xs pt-0.5 space-y-3 text-muted-foreground transition-none">
                    {/* Buttons Container */}
                    <div className="flex flex-col gap-2 w-full transition-none">
                      {/* Download PWA Button - Primary, only show if not already installed */}
                      {!isPWAInstalled && (
                        <Button
                          size="sm"
                          variant="default"
                          onMouseEnter={() => router.prefetch('/pwa')}
                          onClick={() => router.push('/pwa')}
                          className="w-full !h-[38px] justify-center text-center transition-none"
                        >
                          Download as PWA
                        </Button>
                      )}

                      {/* Submit Feedback Button - Secondary */}
                      <Link href="/contact" className="w-full">
                        <Button
                          size="sm"
                          variant="secondary"
                          className="w-full !h-[38px] justify-center text-center transition-none"
                        >
                          Send Feedback
                        </Button>
                      </Link>
                    </div>

                    <div className="pt-2 transition-none relative h-5">
                      <div 
                        className="absolute inset-0 transition-opacity duration-500"
                        style={{
                          opacity: currentFooterText === 0 ? 1 : 0,
                          pointerEvents: currentFooterText === 0 ? 'auto' : 'none',
                        }}
                      >
                        Domain sponsored by{' '}
                        <a
                          href="https://www.threads.com/@arezmie"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-medium hover:underline relative z-10"
                          style={{color: '#2563eb'}}
                        >
                          @arezmie
                        </a>
                      </div>
                      <div 
                        className="absolute inset-0 transition-opacity duration-500"
                        style={{
                          opacity: currentFooterText === 1 ? 1 : 0,
                          pointerEvents: currentFooterText === 1 ? 'auto' : 'none',
                        }}
                      >
                        Built by{' '}
                        <a
                          href="https://www.threads.com/@shahrulestar"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-medium hover:underline relative z-10"
                          style={{color: '#2563eb'}}
                        >
                          @shahrulestar
                        </a>
                      </div>
                      <div 
                        className="absolute inset-0 transition-opacity duration-500"
                        style={{
                          opacity: currentFooterText === 2 ? 1 : 0,
                          pointerEvents: currentFooterText === 2 ? 'auto' : 'none',
                        }}
                      >
                        Source from{' '}
                        <a
                          href="https://hea.uitm.edu.my/index.php/calendars/academic-calendar"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-medium hover:underline relative z-10"
                          style={{color: '#2563eb'}}
                        >
                          HEA UiTM
                        </a>
                      </div>
                      <div 
                        className="absolute inset-0 transition-opacity duration-500"
                        style={{
                          opacity: currentFooterText === 3 ? 1 : 0,
                          pointerEvents: currentFooterText === 3 ? 'auto' : 'none',
                        }}
                      >
                        Inspired by{' '}
                        <a
                          href="https://bilacuti.my"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-medium hover:underline relative z-10"
                          style={{color: '#2563eb'}}
                        >
                          bilacuti.my
                        </a>
                      </div>
                    </div>
                  </div>
                </div>
              </PopoverContent>
            </Popover>
          </div>
        </div>
      </div>
      <div className="calendar-controls-fade" />
    </div>
  );
}
