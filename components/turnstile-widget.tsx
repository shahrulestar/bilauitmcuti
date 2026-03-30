"use client";

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
} from "react";

declare global {
  interface Window {
    turnstile?: {
      render: (container: HTMLElement, params: Record<string, unknown>) => number;
      remove: (widgetId: number) => void;
      reset: (widgetId?: number) => void;
    };
  }
}

export interface TurnstileWidgetHandle {
  reset: () => void;
}

export interface TurnstileWidgetProps {
  siteKey: string;
  action?: string;
  onToken: (token: string) => void;
  className?: string;
}

const TURNSTILE_SCRIPT_SRC =
  "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

export const TurnstileWidget = forwardRef<
  TurnstileWidgetHandle,
  TurnstileWidgetProps
>(function TurnstileWidget({ siteKey, action, onToken, className }, ref) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const widgetIdRef = useRef<number | null>(null);
  const onTokenRef = useRef(onToken);

  const safeSiteKey = useMemo(() => siteKey?.trim() ?? "", [siteKey]);

  useEffect(() => {
    onTokenRef.current = onToken;
  }, [onToken]);

  useImperativeHandle(
    ref,
    () => ({
      reset: () => {
        if (typeof window === "undefined") return;
        const ts = window.turnstile;
        const id = widgetIdRef.current;
        onTokenRef.current("");
        if (ts && id != null) ts.reset(id);
      },
    }),
    []
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!safeSiteKey) return;

    // Load Turnstile script once (explicit rendering).
    const existing = document.querySelector(
      'script[data-turnstile-script="explicit"]'
    ) as HTMLScriptElement | null;
    if (!existing) {
      const script = document.createElement("script");
      script.src = TURNSTILE_SCRIPT_SRC;
      script.async = true;
      script.defer = true;
      script.dataset.turnstileScript = "explicit";
      document.head.appendChild(script);
    }

    let cancelled = false;
    const start = Date.now();

    const poll = () => {
      if (cancelled) return;
      const el = containerRef.current;
      if (!el) return;
      const ts = window.turnstile;
      if (ts && !widgetIdRef.current) {
        widgetIdRef.current = ts.render(el, {
          sitekey: safeSiteKey,
          action: action ?? undefined,
          callback: (token: string) => onTokenRef.current(token),
          "expired-callback": () => onTokenRef.current(""),
          "error-callback": () => onTokenRef.current(""),
        });
        return;
      }
      if (Date.now() - start < 8000) {
        setTimeout(poll, 200);
      }
    };

    poll();

    return () => {
      cancelled = true;
      const ts = window.turnstile;
      if (ts && widgetIdRef.current != null) ts.remove(widgetIdRef.current);
      widgetIdRef.current = null;
    };
  }, [safeSiteKey, action]);

  if (!safeSiteKey) return null;

  return <div ref={containerRef} className={className} aria-hidden={false} />;
});

