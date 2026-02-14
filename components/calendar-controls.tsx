'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { List, Settings, Calendar, ChevronDown, ChevronUp, MessageCircle } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from '@/components/theme-toggle';
import { programOptions, allActivities } from '@/lib/data';
import { getRoutePath } from '@/lib/route-utils';
import type { ViewMode } from '@/app/page';
import type { ProgramValue } from '@/lib/route-utils';

interface CalendarControlsProps {
  selectedProgram: string;
  viewMode: ViewMode;
  /** When true, use fixed positioning so controls appear at top from first paint (scroll restore) */
  forceFixed?: boolean;
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
  viewMode,
  forceFixed = false,
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
  const [selectOpen, setSelectOpen] = useState(false);
  const [isPWAInstalled, setIsPWAInstalled] = useState(false);
  const [currentFooterText, setCurrentFooterText] = useState(0);

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
  }, [router, viewMode]);

  // Handle program change - navigate instantly and preserve settings
  const handleProgramChange = useCallback((programValue: ProgramValue) => {
    const newPath = getRoutePath(programValue, viewMode);
    setSelectOpen(false);
    // Navigate without transition for instant feedback
    router.replace(newPath, { scroll: false });
  }, [router, viewMode]);

  // Handle view mode change - navigate instantly and preserve settings
  const handleViewModeChange = useCallback((newViewMode: ViewMode) => {
    const programValue = selectedProgram as ProgramValue;
    const newPath = getRoutePath(programValue, newViewMode);
    // Navigate without transition for instant feedback
    router.replace(newPath, { scroll: false });
  }, [router, selectedProgram]);

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
  const groupAOptions = useMemo(() => programOptions.filter(p => p.group === 'A'), []);
  const groupBOptions = useMemo(() => programOptions.filter(p => p.group === 'B'), []);
  
  // Memoize current program label
  const currentProgramLabel = useMemo(() => 
    programOptions.find(p => p.value === selectedProgram)?.label || 'Foundation/Prof',
    [selectedProgram]
  );
  
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

  // Memoize activity type checks to avoid repeated array iterations
  const activityChecks = useMemo(() => ({
    hasSemesterPendek: allActivities.some(
      a => a.group === currentGroup && a.type === 'lecture' && a.name.includes('Semester Pendek')
    ),
    hasKuliahIntersesi: allActivities.some(
      a => a.group === currentGroup && a.type === 'lecture' && a.name.includes('Intersesi')
    ),
    hasOthersExams: allActivities.some(
      a => a.group === currentGroup && a.type === 'examination' && a.name.includes('Khas')
    )
  }), [currentGroup]);
  
  const { hasSemesterPendek, hasKuliahIntersesi, hasOthersExams } = activityChecks;

  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 0) {
        setIsOpen(false);
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Footer crossfade animation
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentFooterText((prev) => (prev + 1) % 3);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  const positionClass = forceFixed
    ? 'fixed top-0 left-1/2 -translate-x-1/2 z-[60] w-full max-w-[1000px]'
    : 'sticky top-0 z-40';

  return (
      <div 
        className={`${positionClass} ${bgClass} -mx-4 sm:-mx-6 lg:-mx-4 px-4 sm:px-6 lg:px-4 transition-none isolate [contain:paint]`} 
        suppressHydrationWarning
        style={{ transition: 'none' }}
      >
        <div 
          className={`flex flex-row items-center justify-between gap-4 pt-8 w-full px-0 min-h-14 pb-1 ${bgClass} transition-none`} 
          suppressHydrationWarning
          style={{ transition: 'none' }}
        >
        {/* Program selector - Left */}
        <div className="px-0">
          <Select value={selectedProgram} onValueChange={handleProgramChange} open={selectOpen} onOpenChange={setSelectOpen}>
            <SelectTrigger className={`w-fit max-w-[180px] sm:max-w-[200px] !h-[38px] !py-1 border bg-secondary dark:bg-[#2A2A2A] border-border ${textClass} truncate flex items-center justify-center [&>svg]:hidden rounded-lg transition-none`} suppressHydrationWarning>
              <span className="truncate text-left font-medium text-sm min-w-0 flex-1">
                {currentProgramLabel}
              </span>
              <div className="flex-shrink-0 ml-2">
                {selectOpen ? (
                  <ChevronUp className="h-6 w-6 transition-none" strokeWidth={2} />
                ) : (
                  <ChevronDown className="h-6 w-6 transition-none" strokeWidth={2} />
                )}
              </div>
            </SelectTrigger>
            <SelectContent className="min-w-[250px] pt-4 pb-4 pl-3 pr-3 bg-popover dark:bg-[#2A2A2A] border border-border transition-none" suppressHydrationWarning>
              {/* Group A */}
              <div className="w-full">
                <div className="text-xs font-semibold text-muted-foreground mb-2">GROUP A</div>
                <div className="space-y-0">
                  {groupAOptions.map((option) => (
                    <div key={option.value} className="w-full py-0.5 cursor-pointer hover:bg-accent dark:hover:bg-[#262626] rounded-md transition-none" onClick={() => {
                      handleProgramChange(option.value as ProgramValue);
                    }}>
                      <SelectItem value={option.value} className="w-full mb-0">
                        <div className={`font-medium text-sm ${textClass} truncate`}>{option.label}</div>
                      </SelectItem>
                    </div>
                  ))}
                </div>
              </div>
              
              <div className="my-3 h-px bg-border" />
              
              {/* Group B */}
              <div className="w-full">
                <div className="text-xs font-semibold text-muted-foreground mb-2">GROUP B</div>
                <div className="space-y-0">
                  {groupBOptions.map((option) => (
                    <div key={option.value} className="w-full py-0.5 cursor-pointer hover:bg-accent dark:hover:bg-[#262626] rounded-md transition-none" onClick={() => {
                      handleProgramChange(option.value as ProgramValue);
                    }}>
                      <SelectItem value={option.value} className="w-full mb-0">
                        <div className={`font-medium text-sm ${textClass} truncate`}>{option.label}</div>
                      </SelectItem>
                    </div>
                  ))}
                </div>
              </div>
            </SelectContent>
          </Select>
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
                className="h-auto w-[300px] pt-4 pb-4 pl-4 z-50 border border-border bg-popover dark:bg-[#2A2A2A] pr-4 transition-none"
                side="bottom"
                align="end"
                sideOffset={4}
                alignOffset={-5}
              >
                <div className="space-y-3 transition-none">
                  {/* Activity Type Toggles */}
                  <div className="space-y-2 transition-none">
                    <label className="flex items-center justify-between cursor-pointer py-0.5 transition-none">
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-2 rounded-full bg-[#d1d5db]" />
                        <span className="text-sm font-medium text-foreground">Registration</span>
                      </div>
                      <div className={`relative inline-flex h-6 w-11 items-center rounded-full transition-none ${showRegistration ? 'bg-muted-foreground' : 'bg-muted'}`}
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
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-2 rounded-full bg-[#8b5cf6]" />
                        <span className="text-sm font-medium text-foreground">Lecture</span>
                      </div>
                      <div className={`relative inline-flex h-6 w-11 items-center rounded-full transition-none ${showLecture ? 'bg-muted-foreground' : 'bg-muted'}`}
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
                        <span className="text-xs font-medium text-muted-foreground">Semester Pendek</span>
                      </div>
                      <div className={`relative inline-flex h-6 w-11 items-center rounded-full transition-none ${showSemesterPendek ? 'bg-muted-foreground' : 'bg-muted'}`}
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
                          aria-label="Toggle Semester Pendek events"
                        />
                      </div>
                    </label>
                    )}

                    {hasKuliahIntersesi && (
                    <label className="flex items-center justify-between cursor-pointer py-0.5 pl-4 transition-none">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium text-muted-foreground">Kuliah Intersesi</span>
                      </div>
                      <div className={`relative inline-flex h-6 w-11 items-center rounded-full transition-none ${showKuliahIntersesi ? 'bg-muted-foreground' : 'bg-muted'}`}
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
                          aria-label="Toggle Kuliah Intersesi events"
                        />
                      </div>
                    </label>
                    )}

                    <label className="flex items-center justify-between cursor-pointer py-0.5 transition-none">
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-2 rounded-full bg-[#dc2626]" />
                        <span className="text-sm font-medium text-foreground">Examination</span>
                      </div>
                      <div className={`relative inline-flex h-6 w-11 items-center rounded-full transition-none ${showExamination ? 'bg-muted-foreground' : 'bg-muted'}`}
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
                      <div className={`relative inline-flex h-6 w-11 items-center rounded-full transition-none ${showOthersExams ? 'bg-muted-foreground' : 'bg-muted'}`}
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
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-2 rounded-full bg-[#10b981]" />
                        <span className="text-sm font-medium text-foreground">Break</span>
                      </div>
                      <div className={`relative inline-flex h-6 w-11 items-center rounded-full transition-none ${showBreak ? 'bg-muted-foreground' : 'bg-muted'}`}
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
                        <span className="text-sm font-medium text-foreground">Show countdown</span>
                      </div>
                      <div className={`relative inline-flex h-6 w-11 items-center rounded-full transition-none ${showCountdown ? 'bg-muted-foreground' : 'bg-muted'}`}
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
                    <div className={`relative inline-flex h-6 w-11 items-center rounded-full transition-none ${showKKT ? 'bg-muted-foreground' : 'bg-muted'}`}
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

                  {/* Theme Toggle */}
                  <ThemeToggle />

                  {/* Made By and Source + Share/PWA */}
                  <div className="text-left text-xs pt-0.5 space-y-3 text-muted-foreground transition-none">
                    {/* Buttons Container */}
                    <div className="flex flex-col gap-2 w-full transition-none">
                      {/* Submit Feedback Button */}
                      <a 
                        href="https://forms.gle/qw13g7PJJgzRD3zk8"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-full"
                      >
                        <Button
                          size="sm"
                          variant="secondary"
                          className="w-full justify-center text-center bg-secondary text-secondary-foreground hover:opacity-90 active:opacity-95 transition-opacity"
                        >
                          Feedback
                        </Button>
                      </a>

                      {/* Download PWA Button - Only show if not already installed */}
                      {!isPWAInstalled && (
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => {
                            window.location.href = '/pwa';
                          }}
                          className="w-full justify-center text-center bg-secondary text-secondary-foreground hover:opacity-90 active:opacity-95 transition-opacity"
                        >
                          Download as PWA
                        </Button>
                      )}
                    </div>

                    <div className="pt-2 transition-none relative h-5">
                      <div 
                        className="absolute inset-0 transition-opacity duration-500"
                        style={{
                          opacity: currentFooterText === 0 ? 1 : 0,
                          pointerEvents: currentFooterText === 0 ? 'auto' : 'none',
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
                          opacity: currentFooterText === 1 ? 1 : 0,
                          pointerEvents: currentFooterText === 1 ? 'auto' : 'none',
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
                          opacity: currentFooterText === 2 ? 1 : 0,
                          pointerEvents: currentFooterText === 2 ? 'auto' : 'none',
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
      <div className="calendar-controls-fade pointer-events-none" />
    </div>
  );
}
