'use client';

interface CalendarFilterToggleProps {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  nested?: boolean;
  ariaLabel: string;
}

/** Single filter toggle row — shared markup for calendar settings popover. */
export function CalendarFilterToggle({
  label,
  checked,
  onChange,
  nested = false,
  ariaLabel,
}: CalendarFilterToggleProps) {
  return (
    <label className={`flex items-center justify-between cursor-pointer py-0.5 transition-none${nested ? ' pl-4' : ''}`}>
      <span className={`${nested ? 'text-xs font-medium text-muted-foreground' : 'text-sm font-medium text-foreground'}`}>
        {label}
      </span>
      <div
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-none ${checked ? 'bg-primary' : 'bg-muted'}`}
        style={{ transition: 'none' }}
      >
        <span
          className={`inline-block h-4 w-4 transform rounded-full transition-none shadow-sm ${checked ? 'bg-background' : 'bg-background dark:bg-foreground'}`}
          style={{ transform: checked ? 'translateX(20px)' : 'translateX(2px)', transition: 'none' }}
        />
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className="sr-only"
          aria-label={ariaLabel}
        />
      </div>
    </label>
  );
}
