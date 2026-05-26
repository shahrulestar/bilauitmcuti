'use client';

import { useState, useEffect, useMemo } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from '@/components/ui/alert';
import { Button } from '@/components/ui/button';

const PWA_DISMISS_KEY = 'pwa-prompt-dismissed';
const PWA_PROMPT_APPEAR_DELAY_MS = 3000;

function isCalendarRoute(pathname: string): boolean {
  if (pathname === '/' || pathname === '/list') return true;
  if (/^\/[^/]+$/.test(pathname)) return true;
  if (/^\/[^/]+\/list$/.test(pathname)) return true;
  return false;
}

function isPwaMode(): boolean {
  if (typeof window === 'undefined') return true;
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
  const isMinimalUI = (window.navigator as { standalone?: boolean }).standalone === true;
  return isStandalone || isMinimalUI;
}

export function PwaPromptAlert() {
  const pathname = usePathname();
  const router = useRouter();
  const [isMounted, setIsMounted] = useState(false);
  const [isDismissed, setIsDismissed] = useState<boolean | null>(null);
  const [isStandaloneMode, setIsStandaloneMode] = useState(false);
  const [isAppearDelayComplete, setIsAppearDelayComplete] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (!isMounted || typeof window === 'undefined') return;

    try {
      const dismissed = localStorage.getItem(PWA_DISMISS_KEY);
      setIsDismissed(Boolean(dismissed));
    } catch {
      setIsDismissed(true);
    }

    setIsStandaloneMode(isPwaMode());
  }, [isMounted]);

  const shouldShow = useMemo(() => {
    if (!isMounted) return false;
    if (isDismissed !== false) return false;
    if (isStandaloneMode) return false;
    return isCalendarRoute(pathname);
  }, [isMounted, isDismissed, isStandaloneMode, pathname]);

  useEffect(() => {
    if (!shouldShow) {
      setIsAppearDelayComplete(false);
      return;
    }

    const timerId = window.setTimeout(() => {
      setIsAppearDelayComplete(true);
    }, PWA_PROMPT_APPEAR_DELAY_MS);

    return () => {
      window.clearTimeout(timerId);
    };
  }, [shouldShow]);

  function handleDismiss() {
    try {
      localStorage.setItem(PWA_DISMISS_KEY, 'true');
    } catch {
      // ignore
    }
    setIsDismissed(true);
  }

  function handleLearn() {
    handleDismiss();
    router.push('/download');
  }

  if (!shouldShow || !isAppearDelayComplete) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 px-4 pb-[max(env(safe-area-inset-bottom),1rem)]">
      <Alert className="mx-auto w-full max-w-md shadow-lg">
        <AlertTitle>Add to Home Screen for faster access.</AlertTitle>
        <AlertDescription>
          Install this web app as a Progressive Web App (PWA) for faster access
          and improved usability.
        </AlertDescription>
        <div className="mt-3 flex items-center justify-between gap-2">
          <Button size="sm" variant="ghost" onClick={handleDismiss}>
            Dismiss
          </Button>
          <Button size="sm" variant="default" onClick={handleLearn}>
            Learn
          </Button>
        </div>
      </Alert>
    </div>
  );
}
