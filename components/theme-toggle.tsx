'use client';

import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';
import { Kbd } from '@/components/ui/kbd';
import { SettingsSwitchRow } from '@/components/ui/settings-switch-row';

type Theme = 'light' | 'dark';

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  const handleThemeChange = (checked: boolean) => {
    const newTheme: Theme = checked ? 'dark' : 'light';
    setTheme(newTheme);
  };

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted || !theme) return;
    const updateThemeColor = () => {
      const metaThemeColor = document.querySelector('meta[name="theme-color"]');
      if (metaThemeColor) {
        const currentValue = metaThemeColor.getAttribute('content');
        const newValue = theme === 'dark' ? '#1a1a1a' : '#ffffff';
        if (currentValue !== newValue) {
          metaThemeColor.setAttribute('content', newValue);
        }
      }
    };
    requestAnimationFrame(updateThemeColor);
  }, [theme, mounted]);

  if (!mounted) {
    return (
      <SettingsSwitchRow
        label="Theme"
        checked={false}
        ariaLabel="Toggle theme"
        interactive={false}
        kbd={<Kbd className="hidden md:inline-flex">D</Kbd>}
      />
    );
  }

  const isDark = theme === 'dark';
  const isValidTheme = theme === 'light' || theme === 'dark';

  return (
    <SettingsSwitchRow
      label="Theme"
      checked={isDark && isValidTheme}
      onChange={handleThemeChange}
      ariaLabel="Toggle theme"
      kbd={<Kbd className="hidden md:inline-flex">D</Kbd>}
    />
  );
}
