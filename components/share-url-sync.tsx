"use client";

import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { syncPageShareUrl } from "@/lib/share-url";

/** Sync canonical/og:url with the address bar for native browser share. */
export function ShareUrlSync() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    syncPageShareUrl();

    const handlePopState = () => syncPageShareUrl();
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [pathname, searchParams]);

  return null;
}
