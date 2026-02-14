'use client';

import { useTheme } from 'next-themes';
import { Sun, Moon } from 'lucide-react';
import { useEffect, useState } from 'react';

type Theme = 'light' | 'dark';

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  // Validate and set theme safely
  const handleThemeChange = (checked: boolean) => {
    const newTheme: Theme = checked ? 'dark' : 'light';
    setTheme(newTheme);
  };

  // Prevent hydration mismatch
  useEffect(() => {
    setMounted(true);
  }, []);

  // Update theme-color meta tag when theme changes - prevent duplicate updates
  useEffect(() => {
    if (!mounted || !theme) return;
    const updateThemeColor = () => {
      const metaThemeColor = document.querySelector('meta[name="theme-color"]');
      if (metaThemeColor) {
        const currentValue = metaThemeColor.getAttribute('content');
        const newValue = theme === 'dark' ? '#1a1a1a' : '#ffffff';
        // Only update if value has changed to prevent unnecessary DOM updates
        if (currentValue !== newValue) {
          metaThemeColor.setAttribute('content', newValue);
        }
      }
    };
    // Use requestAnimationFrame to ensure DOM is ready
    requestAnimationFrame(updateThemeColor);
  }, [theme, mounted]);

  // Don't render until mounted to prevent hydration mismatch
  if (!mounted) {
    return (
      <label className="flex items-center justify-between cursor-pointer py-0.5">
        <div className="flex items-center gap-2">
          <Sun className="h-4 w-4 opacity-50 text-foreground" />
          <span className="text-sm font-medium text-foreground">Theme</span>
        </div>
        <div className="relative inline-flex h-6 w-11 items-center rounded-full transition-none bg-muted"
          style={{ transition: 'none' }}
        >
          <span
            className="inline-block h-4 w-4 transform rounded-full transition-none shadow-sm bg-background dark:bg-foreground"
            style={{ transform: 'translateX(2px)', transition: 'none' }}
          />
        </div>
      </label>
    );
  }

  // Validate theme value - ensure type safety
  const isDark = theme === 'dark';
  const isValidTheme = theme === 'light' || theme === 'dark';

  return (
    <label className="flex items-center justify-between cursor-pointer py-0.5">
      <div className="flex items-center gap-2">
        {isDark ? (
          <Moon className="h-4 w-4 text-foreground" />
        ) : (
          <Sun className="h-4 w-4 text-foreground" />
        )}
        <span className="text-sm font-medium text-foreground">Theme</span>
      </div>
      <div
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-none ${isDark ? 'bg-muted-foreground' : 'bg-muted'}`}
        style={{ transition: 'none' }}
      >
        <span
          className={`inline-block h-4 w-4 transform rounded-full transition-none shadow-sm ${isDark ? 'bg-background' : 'bg-background dark:bg-foreground'}`}
          style={{ transform: isDark ? 'translateX(20px)' : 'translateX(2px)', transition: 'none' }}
        />
        <input
          type="checkbox"
          checked={isDark && isValidTheme}
          onChange={(e) => handleThemeChange(e.target.checked)}
          className="sr-only"
          aria-label="Toggle theme"
        />
      </div>
    </label>
  );
}
