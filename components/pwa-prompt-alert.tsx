'use client';

import { useState, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import {
  Alert,
  AlertAction,
  AlertDescription,
  AlertTitle,
} from '@/components/ui/alert';
import { Button } from '@/components/ui/button';

const PWA_DISMISS_KEY = 'pwa-prompt-dismissed';

function isPwaMode(): boolean {
  if (typeof window === 'undefined') return true;
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
  const isMinimalUI = (window.navigator as { standalone?: boolean }).standalone === true;
  return isStandalone || isMinimalUI;
}

export function PwaPromptAlert() {
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
    if (isPwaMode()) return;

    try {
      const dismissed = localStorage.getItem(PWA_DISMISS_KEY);
      if (dismissed) return;
    } catch {
      return;
    }

    setShow(true);
  }, [mounted, pathname]);

  function handleDismiss() {
    try {
      localStorage.setItem(PWA_DISMISS_KEY, 'true');
    } catch {
      // ignore
    }
    setShow(false);
  }

  function handleLearn() {
    handleDismiss();
    router.push('/pwa');
  }

  if (!show) return null;

  return (
    <div className="fixed bottom-4 left-1/2 z-50 w-full max-w-md -translate-x-1/2 px-4">
      <Alert className="w-full shadow-lg">
        <AlertTitle>Add to Home Screen for faster access.</AlertTitle>
        <AlertDescription>
          Install this web app as a Progressive Web App (PWA) for faster access
          and improved usability.
        </AlertDescription>
        <AlertAction className="flex justify-between gap-2">
          <Button size="sm" variant="ghost" onClick={handleDismiss}>
            Dismiss
          </Button>
          <Button size="sm" variant="default" onClick={handleLearn}>
            Learn
          </Button>
        </AlertAction>
      </Alert>
    </div>
  );
}
