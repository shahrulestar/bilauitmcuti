'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import {
  Alert,
  AlertAction,
  AlertDescription,
  AlertTitle,
} from '@/components/ui/alert';
import { Button } from '@/components/ui/button';

const PWA_REINSTALL_REMINDER_KEY = 'pwa-reinstall-reminder-opened-v1';

function isPwaMode(): boolean {
  if (typeof window === 'undefined') return false;
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
  const isMinimalUI = (window.navigator as { standalone?: boolean }).standalone === true;
  return isStandalone || isMinimalUI;
}

export function PwaReinstallAlert() {
  const pathname = usePathname();
  const router = useRouter();
  const [show, setShow] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted || typeof window === 'undefined') return;
    if (pathname !== '/') return;
    if (!isPwaMode()) return;

    try {
      const alreadyOpened = localStorage.getItem(PWA_REINSTALL_REMINDER_KEY);
      if (alreadyOpened) return;
      localStorage.setItem(PWA_REINSTALL_REMINDER_KEY, 'true');
      setShow(true);
    } catch {
      // ignore storage errors and avoid noisy UX
    }
  }, [mounted, pathname]);

  function handleOpenGuide() {
    setShow(false);
    router.push('/pwa#reinstall');
  }

  if (!show) return null;

  return (
    <div className="fixed bottom-4 left-1/2 z-50 w-full max-w-md -translate-x-1/2 px-4">
      <Alert className="w-full shadow-lg">
        <AlertTitle>Using an old home screen app?</AlertTitle>
        <AlertDescription>
          Delete the old app from your home screen, then reinstall from your browser to get the latest version.
        </AlertDescription>
        <AlertAction className="flex justify-end">
          <Button size="sm" variant="default" onClick={handleOpenGuide}>
            How to Reinstall
          </Button>
        </AlertAction>
      </Alert>
    </div>
  );
}
