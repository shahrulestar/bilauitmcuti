"use client";

import { useEffect, useState } from "react";

/** Detects whether the app is running as an installed PWA. */
export function usePwaInstalled(): boolean {
  const [isPWAInstalled, setIsPWAInstalled] = useState(false);

  useEffect(() => {
    const isInStandaloneMode = window.matchMedia("(display-mode: standalone)").matches;
    const isInFullScreenMode = document.fullscreenElement !== null;
    const isInMinimalUIMode = (window.navigator as Navigator & { standalone?: boolean }).standalone === true;

    if (isInStandaloneMode || isInFullScreenMode || isInMinimalUIMode) {
      setIsPWAInstalled(true);
    }
  }, []);

  return isPWAInstalled;
}
