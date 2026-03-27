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

function isPwaMode(): boolean {
  if (typeof window === 'undefined') return false;
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
  const isMinimalUI = (window.navigator as { standalone?: boolean }).standalone === true;
  return isStandalone || isMinimalUI;
}

function isMobileOs(): boolean {
  if (typeof window === 'undefined') return false;

  const userAgent = window.navigator.userAgent.toLowerCase();
  const isAndroid = userAgent.includes('android');
  const isIOS =
    /iphone|ipad|ipod/.test(userAgent) ||
    (window.navigator.platform === 'MacIntel' && window.navigator.maxTouchPoints > 1);

  return isAndroid || isIOS;
}

function isDesktopBrowser(): boolean {
  if (typeof window === 'undefined') return true;

  const navigatorWithUaData = window.navigator as Navigator & {
    userAgentData?: { mobile?: boolean };
  };
  const isMobileByUaData = navigatorWithUaData.userAgentData?.mobile;
  if (typeof isMobileByUaData === 'boolean') return !isMobileByUaData;

  const userAgent = window.navigator.userAgent.toLowerCase();
  const hasMobileUa = /android|iphone|ipad|ipod|mobile/.test(userAgent);
  const hasTouch = window.navigator.maxTouchPoints > 1 || window.matchMedia('(pointer: coarse)').matches;
  return !hasMobileUa && !hasTouch;
}

function isLikelyOldPwaContext(): boolean {
  if (typeof window === 'undefined') return false;

  const hostname = window.location.hostname.toLowerCase();
  if (hostname === 'bilauitmcuti.com' || hostname === 'www.bilauitmcuti.com') return false;
  if (hostname === 'www.cutiuitm.xyz' || hostname === 'cutiuitm.xyz') return true;

  const referrer = document.referrer.toLowerCase();
  if (referrer.includes('://www.cutiuitm.xyz') || referrer.includes('://cutiuitm.xyz')) return true;

  const source = new URLSearchParams(window.location.search).get('from')?.toLowerCase();
  if (source?.includes('cutiuitm.xyz')) return true;
  if (source?.includes('www')) return true;

  return false;
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
    if (isDesktopBrowser()) return;
    if (!isPwaMode()) return;
    if (!isMobileOs()) return;
    if (!isLikelyOldPwaContext()) return;
    setShow(true);
  }, [mounted, pathname]);

  function handleOpenGuide() {
    setShow(false);
    router.push('/pwa');
  }

  if (!show) return null;

  return (
    <div className="fixed bottom-8 left-1/2 z-50 w-full max-w-md -translate-x-1/2 px-4">
      <Alert className="w-full shadow-lg">
        <AlertTitle>Please reinstall the app</AlertTitle>
        <AlertDescription>
          You opened this PWA from an older `cutiuitm.xyz` domain. Delete the old version from your home screen,
          then reinstall from your browser to get the latest updates.
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
