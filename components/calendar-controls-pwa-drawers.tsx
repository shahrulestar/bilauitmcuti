'use client';

import {
  useCallback,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ChevronsUpDown } from 'lucide-react';
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerTitle,
  drawerBodyClassName,
  drawerContentClassName,
} from '@/components/ui/drawer';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
  CALENDAR_DRAWER_COLLAPSIBLE_KEY,
  PROGRAM_DRAWER_COLLAPSIBLE_KEY,
  usePersistedCollapsibleOpen,
} from '@/components/ui/collapsible';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from '@/components/theme-toggle';
import {
  formatSessionLabelWithId,
  getSessionOptionsForGroup,
  type SessionId,
} from '@/lib/data';
import type { ProgramValue } from '@/lib/route-utils';
import { cn } from '@/lib/utils';

const programDrawerGroupPanelClass =
  'overflow-hidden transition-[height] duration-300 ease-in-out motion-reduce:transition-none';

function ProgramDrawerGroupPanel({
  group,
  className,
  children,
}: {
  group: 'A' | 'B';
  className?: string;
  children: ReactNode;
}) {
  const innerRef = useRef<HTMLDivElement>(null);
  const [panelHeight, setPanelHeight] = useState<number | undefined>(undefined);

  const measurePanel = useCallback(() => {
    if (innerRef.current) setPanelHeight(innerRef.current.scrollHeight);
  }, []);

  useLayoutEffect(() => {
    measurePanel();
    const node = innerRef.current;
    if (!node) return;
    const observer = new ResizeObserver(measurePanel);
    observer.observe(node);
    return () => observer.disconnect();
  }, [group, measurePanel]);

  return (
    <div className={cn(programDrawerGroupPanelClass, className)} style={{ height: panelHeight }}>
      <div
        key={group}
        ref={innerRef}
        className="space-y-3 animate-in fade-in-0 slide-in-from-bottom-1 duration-200 ease-out motion-reduce:animate-none"
      >
        {children}
      </div>
    </div>
  );
}

export interface CalendarControlsPwaDrawersProps {
  isProgramDrawerOpen: boolean;
  onProgramDrawerOpenChange: (open: boolean) => void;
  isSettingsDrawerOpen: boolean;
  onSettingsDrawerOpenChange: (open: boolean) => void;
  currentGroup: 'A' | 'B';
  selectedProgram: string;
  selectedSessions: SessionId[];
  groupAOptions: Array<{ label: string; value: string; group: 'A' | 'B' }>;
  groupBOptions: Array<{ label: string; value: string; group: 'A' | 'B' }>;
  groupBProgramForSessions: ProgramValue;
  currentProgramLabel: string;
  onProgramSelect: (program: ProgramValue) => void;
  onSessionToggle: (program: ProgramValue, sessionId: SessionId, group: 'A' | 'B') => void;
  showRegistration: boolean;
  showLecture: boolean;
  showSemesterPendek: boolean;
  showKuliahIntersesi: boolean;
  showExamination: boolean;
  showOthersExams: boolean;
  showBreak: boolean;
  showKKT: boolean;
  hasSemesterPendek: boolean;
  hasKuliahIntersesi: boolean;
  hasOthersExams: boolean;
  hasRegionalDateRange: boolean;
  isPWAInstalled: boolean;
  onFilterToggle: (checked: boolean, handler: (value: boolean) => void) => void;
  onShowRegistrationChange: (value: boolean) => void;
  onShowLectureChange: (value: boolean) => void;
  onShowSemesterPendekChange: (value: boolean) => void;
  onShowKuliahIntersesiChange: (value: boolean) => void;
  onShowExaminationChange: (value: boolean) => void;
  onShowOthersExamsChange: (value: boolean) => void;
  onShowBreakChange: (value: boolean) => void;
  onShowKKTChange: (value: boolean) => void;
}

export function CalendarControlsPwaDrawers({
  isProgramDrawerOpen,
  onProgramDrawerOpenChange,
  isSettingsDrawerOpen,
  onSettingsDrawerOpenChange,
  currentGroup,
  selectedProgram,
  selectedSessions,
  groupAOptions,
  groupBOptions,
  groupBProgramForSessions,
  currentProgramLabel,
  onProgramSelect,
  onSessionToggle,
  showRegistration,
  showLecture,
  showSemesterPendek,
  showKuliahIntersesi,
  showExamination,
  showOthersExams,
  showBreak,
  showKKT,
  hasSemesterPendek,
  hasKuliahIntersesi,
  hasOthersExams,
  hasRegionalDateRange,
  isPWAInstalled,
  onFilterToggle,
  onShowRegistrationChange,
  onShowLectureChange,
  onShowSemesterPendekChange,
  onShowKuliahIntersesiChange,
  onShowExaminationChange,
  onShowOthersExamsChange,
  onShowBreakChange,
  onShowKKTChange,
}: CalendarControlsPwaDrawersProps) {
  const router = useRouter();
  const [isProgramDrawerSectionOpen, setIsProgramDrawerSectionOpen] =
    usePersistedCollapsibleOpen(PROGRAM_DRAWER_COLLAPSIBLE_KEY);
  const [isCalendarDrawerSectionOpen, setIsCalendarDrawerSectionOpen] =
    usePersistedCollapsibleOpen(CALENDAR_DRAWER_COLLAPSIBLE_KEY);

  const programDrawerSummary = useMemo(() => {
    const options = currentGroup === 'A' ? groupAOptions : groupBOptions;
    const option = options.find((p) => p.value === selectedProgram);
    if (option) return option.label;
    if (currentGroup === 'B' && selectedProgram === 'All') return 'All';
    return currentProgramLabel;
  }, [currentGroup, groupAOptions, groupBOptions, selectedProgram, currentProgramLabel]);

  const calendarDrawerSummaryItems = useMemo(() => {
    return selectedSessions
      .filter((sessionId) => sessionId.startsWith(`${currentGroup}-`))
      .map((sessionId) => {
        const session = getSessionOptionsForGroup(currentGroup).find((item) => item.id === sessionId);
        return {
          id: sessionId,
          label: session ? formatSessionLabelWithId(session) : sessionId,
        };
      });
  }, [currentGroup, selectedSessions]);

  const drawerProgramOptions = currentGroup === 'A' ? groupAOptions : groupBOptions;
  const drawerProgramForSessions = useMemo((): ProgramValue => {
    if (currentGroup === 'A') {
      return groupAOptions.some((p) => p.value === selectedProgram)
        ? (selectedProgram as ProgramValue)
        : ('Foundation/Professional' as ProgramValue);
    }
    return groupBProgramForSessions;
  }, [currentGroup, groupAOptions, groupBProgramForSessions, selectedProgram]);

  return (
    <>
      <Drawer open={isProgramDrawerOpen} onOpenChange={onProgramDrawerOpenChange}>
        <DrawerContent className={drawerContentClassName}>
          <div className={cn(drawerBodyClassName, 'gap-3')}>
            <DrawerTitle>Program Selection</DrawerTitle>
            <DrawerDescription className="sr-only">
              Select group, program, and calendar sessions.
            </DrawerDescription>
            <div className="space-y-3">
              <div className="space-y-2">
                <div className="text-xs font-semibold text-muted-foreground">Group</div>
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    type="button"
                    variant={currentGroup === 'A' ? 'default' : 'outline'}
                    className="transition-all duration-200 ease-out motion-reduce:transition-none"
                    onClick={() => onProgramSelect('Foundation/Professional')}
                  >
                    Group A
                  </Button>
                  <Button
                    type="button"
                    variant={currentGroup === 'B' ? 'default' : 'outline'}
                    className="transition-all duration-200 ease-out motion-reduce:transition-none"
                    onClick={() => onProgramSelect('All')}
                  >
                    Group B
                  </Button>
                </div>
              </div>
              <ProgramDrawerGroupPanel group={currentGroup}>
                <Collapsible
                  open={isProgramDrawerSectionOpen}
                  onOpenChange={setIsProgramDrawerSectionOpen}
                >
                  <div className="flex w-full items-center justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-semibold text-muted-foreground">Program</div>
                      {!isProgramDrawerSectionOpen && (
                        <p className="truncate text-sm text-foreground">{programDrawerSummary}</p>
                      )}
                    </div>
                    <CollapsibleTrigger asChild>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 shrink-0"
                        aria-label="Toggle program list"
                      >
                        <ChevronsUpDown className="h-4 w-4" />
                      </Button>
                    </CollapsibleTrigger>
                  </div>
                  <CollapsibleContent className="mt-2 grid grid-cols-1 gap-2">
                    {drawerProgramOptions.map((option) => (
                      <Button
                        key={option.value}
                        type="button"
                        variant={selectedProgram === option.value ? 'default' : 'outline'}
                        className="justify-start"
                        onClick={() => onProgramSelect(option.value as ProgramValue)}
                      >
                        {option.label}
                      </Button>
                    ))}
                  </CollapsibleContent>
                </Collapsible>
                <Collapsible
                  open={isCalendarDrawerSectionOpen}
                  onOpenChange={setIsCalendarDrawerSectionOpen}
                >
                  <div className="flex w-full items-center justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-semibold text-muted-foreground">Calendar</div>
                      {!isCalendarDrawerSectionOpen && calendarDrawerSummaryItems.length > 0 && (
                        <ul className="space-y-0.5 text-sm text-foreground">
                          {calendarDrawerSummaryItems.map((item) => (
                            <li key={item.id}>{item.label}</li>
                          ))}
                        </ul>
                      )}
                    </div>
                    <CollapsibleTrigger asChild>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 shrink-0"
                        aria-label="Toggle calendar list"
                      >
                        <ChevronsUpDown className="h-4 w-4" />
                      </Button>
                    </CollapsibleTrigger>
                  </div>
                  <CollapsibleContent className="mt-2 grid grid-cols-1 gap-2">
                    {getSessionOptionsForGroup(currentGroup).map((sess) => {
                      const isSelected = selectedSessions.includes(sess.id);
                      return (
                        <Button
                          key={sess.id}
                          type="button"
                          variant={isSelected ? 'default' : 'outline'}
                          className="justify-start"
                          onClick={() =>
                            onSessionToggle(drawerProgramForSessions, sess.id, currentGroup)
                          }
                        >
                          {formatSessionLabelWithId(sess)}
                        </Button>
                      );
                    })}
                  </CollapsibleContent>
                </Collapsible>
              </ProgramDrawerGroupPanel>
            </div>
          </div>
        </DrawerContent>
      </Drawer>
      <Drawer open={isSettingsDrawerOpen} onOpenChange={onSettingsDrawerOpenChange}>
        <DrawerContent className={drawerContentClassName}>
          <div className={cn(drawerBodyClassName, 'gap-3')}>
            <DrawerTitle>Settings</DrawerTitle>
            <DrawerDescription className="sr-only">
              Configure activity filter settings.
            </DrawerDescription>
            <div className="space-y-3 transition-none">
              <div className="space-y-2 transition-none">
                <label className="flex items-center justify-between cursor-pointer py-0.5 transition-none">
                  <span className="text-sm font-medium text-foreground">Registration</span>
                  <div
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-none ${showRegistration ? 'bg-primary' : 'bg-muted'}`}
                    style={{ transition: 'none' }}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full transition-none shadow-sm ${showRegistration ? 'bg-background' : 'bg-background dark:bg-foreground'}`}
                      style={{
                        transform: showRegistration ? 'translateX(20px)' : 'translateX(2px)',
                        transition: 'none',
                      }}
                    />
                    <input
                      type="checkbox"
                      checked={showRegistration}
                      onChange={(e) => onFilterToggle(e.target.checked, onShowRegistrationChange)}
                      className="sr-only"
                      aria-label="Toggle registration events"
                    />
                  </div>
                </label>
                <label className="flex items-center justify-between cursor-pointer py-0.5 transition-none">
                  <span className="text-sm font-medium text-foreground">Lecture</span>
                  <div
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-none ${showLecture ? 'bg-primary' : 'bg-muted'}`}
                    style={{ transition: 'none' }}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full transition-none shadow-sm ${showLecture ? 'bg-background' : 'bg-background dark:bg-foreground'}`}
                      style={{
                        transform: showLecture ? 'translateX(20px)' : 'translateX(2px)',
                        transition: 'none',
                      }}
                    />
                    <input
                      type="checkbox"
                      checked={showLecture}
                      onChange={(e) => onFilterToggle(e.target.checked, onShowLectureChange)}
                      className="sr-only"
                      aria-label="Toggle lecture events"
                    />
                  </div>
                </label>
                {hasSemesterPendek && (
                  <label className="flex items-center justify-between cursor-pointer py-0.5 pl-4 transition-none">
                    <span className="text-xs font-medium text-muted-foreground">Short Semester</span>
                    <div
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-none ${showSemesterPendek ? 'bg-primary' : 'bg-muted'}`}
                      style={{ transition: 'none' }}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full transition-none shadow-sm ${showSemesterPendek ? 'bg-background' : 'bg-background dark:bg-foreground'}`}
                        style={{
                          transform: showSemesterPendek ? 'translateX(20px)' : 'translateX(2px)',
                          transition: 'none',
                        }}
                      />
                      <input
                        type="checkbox"
                        checked={showSemesterPendek}
                        onChange={(e) =>
                          onFilterToggle(e.target.checked, onShowSemesterPendekChange)
                        }
                        className="sr-only"
                        aria-label="Toggle Short Semester events"
                      />
                    </div>
                  </label>
                )}
                {hasKuliahIntersesi && (
                  <label className="flex items-center justify-between cursor-pointer py-0.5 pl-4 transition-none">
                    <span className="text-xs font-medium text-muted-foreground">
                      Intersession Classes
                    </span>
                    <div
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-none ${showKuliahIntersesi ? 'bg-primary' : 'bg-muted'}`}
                      style={{ transition: 'none' }}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full transition-none shadow-sm ${showKuliahIntersesi ? 'bg-background' : 'bg-background dark:bg-foreground'}`}
                        style={{
                          transform: showKuliahIntersesi ? 'translateX(20px)' : 'translateX(2px)',
                          transition: 'none',
                        }}
                      />
                      <input
                        type="checkbox"
                        checked={showKuliahIntersesi}
                        onChange={(e) =>
                          onFilterToggle(e.target.checked, onShowKuliahIntersesiChange)
                        }
                        className="sr-only"
                        aria-label="Toggle Intersession Classes events"
                      />
                    </div>
                  </label>
                )}
                <label className="flex items-center justify-between cursor-pointer py-0.5 transition-none">
                  <span className="text-sm font-medium text-foreground">Examination</span>
                  <div
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-none ${showExamination ? 'bg-primary' : 'bg-muted'}`}
                    style={{ transition: 'none' }}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full transition-none shadow-sm ${showExamination ? 'bg-background' : 'bg-background dark:bg-foreground'}`}
                      style={{
                        transform: showExamination ? 'translateX(20px)' : 'translateX(2px)',
                        transition: 'none',
                      }}
                    />
                    <input
                      type="checkbox"
                      checked={showExamination}
                      onChange={(e) => onFilterToggle(e.target.checked, onShowExaminationChange)}
                      className="sr-only"
                      aria-label="Toggle examination events"
                    />
                  </div>
                </label>
                {hasOthersExams && (
                  <label className="flex items-center justify-between cursor-pointer py-0.5 pl-4 transition-none">
                    <span className="text-xs font-medium text-muted-foreground">Others Exams</span>
                    <div
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-none ${showOthersExams ? 'bg-primary' : 'bg-muted'}`}
                      style={{ transition: 'none' }}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full transition-none shadow-sm ${showOthersExams ? 'bg-background' : 'bg-background dark:bg-foreground'}`}
                        style={{
                          transform: showOthersExams ? 'translateX(20px)' : 'translateX(2px)',
                          transition: 'none',
                        }}
                      />
                      <input
                        type="checkbox"
                        checked={showOthersExams}
                        onChange={(e) => onFilterToggle(e.target.checked, onShowOthersExamsChange)}
                        className="sr-only"
                        aria-label="Toggle others exams events"
                      />
                    </div>
                  </label>
                )}
                <label className="flex items-center justify-between cursor-pointer py-0.5 transition-none">
                  <span className="text-sm font-medium text-foreground">Break</span>
                  <div
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-none ${showBreak ? 'bg-primary' : 'bg-muted'}`}
                    style={{ transition: 'none' }}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full transition-none shadow-sm ${showBreak ? 'bg-background' : 'bg-background dark:bg-foreground'}`}
                      style={{
                        transform: showBreak ? 'translateX(20px)' : 'translateX(2px)',
                        transition: 'none',
                      }}
                    />
                    <input
                      type="checkbox"
                      checked={showBreak}
                      onChange={(e) => onFilterToggle(e.target.checked, onShowBreakChange)}
                      className="sr-only"
                      aria-label="Toggle break events"
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
                  <div
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-none ${showKKT ? 'bg-primary' : 'bg-muted'}`}
                    style={{ transition: 'none' }}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full transition-none shadow-sm ${showKKT ? 'bg-background' : 'bg-background dark:bg-foreground'}`}
                      style={{
                        transform: showKKT ? 'translateX(20px)' : 'translateX(2px)',
                        transition: 'none',
                      }}
                    />
                    <input
                      type="checkbox"
                      checked={showKKT}
                      onChange={(e) => onFilterToggle(e.target.checked, onShowKKTChange)}
                      className="sr-only"
                      aria-label="Toggle Kedah, Kelantan, and Terengganu regional holidays"
                    />
                  </div>
                </label>
              )}
              <ThemeToggle />
              <div className="text-left text-xs pt-0.5 space-y-3 text-muted-foreground transition-none">
                <div className="flex flex-col gap-2 w-full transition-none">
                  {!isPWAInstalled && (
                    <Button
                      size="sm"
                      variant="default"
                      onMouseEnter={() => router.prefetch('/pwa')}
                      onClick={() => router.push('/pwa')}
                      className="w-full !h-[38px] justify-center border-border text-center transition-none"
                    >
                      Download as PWA
                    </Button>
                  )}
                  <Link href="/feedback" className="w-full">
                    <Button
                      size="default"
                      variant="outline"
                      className="w-full h-[38px] justify-center border-border bg-background text-black shadow-xs transition-all hover:bg-muted hover:text-foreground dark:border-input dark:bg-input/30 dark:text-foreground dark:hover:bg-input/50"
                    >
                      Send Feedback
                    </Button>
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </DrawerContent>
      </Drawer>
    </>
  );
}
