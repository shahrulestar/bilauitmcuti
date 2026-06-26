'use client';

import type { ReactNode } from 'react';

interface SettingsSwitchRowProps {
  label: ReactNode;
  checked: boolean;
  onChange?: (checked: boolean) => void;
  ariaLabel: string;
  nested?: boolean;
  kbd?: ReactNode;
  /** When false, renders a static pill without an input (SSR placeholder). */
  interactive?: boolean;
}

/** Pill toggle row shared by theme and calendar filter settings. */
export function SettingsSwitchRow({
  label,
  checked,
  onChange,
  ariaLabel,
  nested = false,
  kbd,
  interactive = true,
}: SettingsSwitchRowProps) {
  return (
    <label
      className={`flex items-center justify-between cursor-pointer py-0.5 transition-none${nested ? ' pl-4' : ''}`}
    >
      <div className="flex items-center gap-2">
        {typeof label === 'string' ? (
          <span
            className={
              nested
                ? 'text-xs font-medium text-muted-foreground'
                : 'text-sm font-medium text-foreground'
            }
          >
            {label}
          </span>
        ) : (
          label
        )}
        {kbd}
      </div>
      <div
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-none ${checked ? 'bg-primary' : 'bg-muted'}`}
        style={{ transition: 'none' }}
      >
        <span
          className={`inline-block h-4 w-4 transform rounded-full transition-none shadow-sm ${checked ? 'bg-background' : 'bg-background dark:bg-foreground'}`}
          style={{
            transform: checked ? 'translateX(20px)' : 'translateX(2px)',
            transition: 'none',
          }}
        />
        {interactive ? (
          <input
            type="checkbox"
            checked={checked}
            onChange={(e) => onChange?.(e.target.checked)}
            className="sr-only"
            aria-label={ariaLabel}
          />
        ) : null}
      </div>
    </label>
  );
}
