"use client";

import { useEffect } from "react";
import { syncPageShareUrl } from "@/lib/share-url";

/** Sync canonical/og:url with the address bar for native browser share. */
export function ShareUrlSync() {
  useEffect(() => {
    syncPageShareUrl();

    const handlePopState = () => syncPageShareUrl();
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  return null;
}
