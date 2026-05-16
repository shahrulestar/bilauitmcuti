'use client';

import { useSyncExternalStore } from 'react';

const STANDALONE_QUERY = '(display-mode: standalone)';

function getSnapshot(): boolean {
  if (typeof window === 'undefined') return false;
  const matchesStandalone = window.matchMedia(STANDALONE_QUERY).matches;
  const iosStandalone = (window.navigator as { standalone?: boolean }).standalone === true;
  return matchesStandalone || iosStandalone;
}

function getServerSnapshot(): boolean {
  return false;
}

function subscribe(onChange: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  const mql = window.matchMedia(STANDALONE_QUERY);
  mql.addEventListener('change', onChange);
  return () => mql.removeEventListener('change', onChange);
}

export function useIsStandaloneDisplayMode(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
