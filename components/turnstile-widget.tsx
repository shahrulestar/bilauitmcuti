"use client";

import Script from "next/script";
import { useEffect, useId, useMemo } from "react";

/**
 * Cloudflare Turnstile invisible auto-render widget.
 * Script is loaded with render=invisible and the container uses data-* callbacks.
 */
declare global {
  interface Window {
    [key: string]: unknown;
  }
}

export interface TurnstileWidgetProps {
  siteKey: string;
  action?: string;
  onToken: (token: string) => void;
  className?: string;
}

const TURNSTILE_SCRIPT_SRC =
  "https://challenges.cloudflare.com/turnstile/v0/api.js?render=invisible";

export function TurnstileWidget({
  siteKey,
  action,
  onToken,
  className,
}: TurnstileWidgetProps) {
  const safeSiteKey = useMemo(() => siteKey?.trim() ?? "", [siteKey]);
  const idBase = useId().replace(/[^a-zA-Z0-9_]/g, "");
  const successCallbackName = `turnstileSuccess_${idBase}`;
  const errorCallbackName = `turnstileError_${idBase}`;
  const expiredCallbackName = `turnstileExpired_${idBase}`;

  useEffect(() => {
    if (typeof window === "undefined") return;
    (window as Record<string, unknown>)[successCallbackName] = (token: string) =>
      onToken(token);
    (window as Record<string, unknown>)[errorCallbackName] = () => onToken("");
    (window as Record<string, unknown>)[expiredCallbackName] = () => onToken("");
    return () => {
      delete (window as Record<string, unknown>)[successCallbackName];
      delete (window as Record<string, unknown>)[errorCallbackName];
      delete (window as Record<string, unknown>)[expiredCallbackName];
    };
  }, [successCallbackName, errorCallbackName, expiredCallbackName, onToken]);

  if (!safeSiteKey) return null;

  return (
    <>
      <Script src={TURNSTILE_SCRIPT_SRC} strategy="afterInteractive" />
      <div
        className={`cf-turnstile ${className ?? ""}`.trim()}
        data-sitekey={safeSiteKey}
        data-action={action ?? undefined}
        data-callback={successCallbackName}
        data-error-callback={errorCallbackName}
        data-expired-callback={expiredCallbackName}
      />
    </>
  );
}
