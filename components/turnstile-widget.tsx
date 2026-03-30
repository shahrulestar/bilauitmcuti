"use client";

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
} from "react";

/**
 * Cloudflare Turnstile explicit render (see client-side rendering docs).
 * Invisible widgets are configured in the dashboard; use execution "render" so the
 * challenge runs after render (background), or "execute" + execute() for deferred runs.
 */
declare global {
  interface Window {
    turnstile?: {
      ready?: (callback: () => void) => void;
      render: (
        container: HTMLElement | string,
        params: Record<string, unknown>
      ) => number;
      remove: (widgetId: number) => void;
      reset: (widgetId?: number) => void;
      execute: (containerOrWidgetId: string | HTMLElement | number) => void;
      getResponse?: (widgetId: number) => string;
    };
  }
}

export interface TurnstileWidgetHandle {
  reset: () => void;
  /** Runs challenge when widget uses execution: "execute" (see Cloudflare docs). */
  execute: () => void;
}

export interface TurnstileWidgetProps {
  siteKey: string;
  action?: string;
  onToken: (token: string) => void;
  className?: string;
  /**
   * `render` (default): challenge runs after render — token usually arrives quickly (recommended for forms).
   * `execute`: challenge runs only after `turnstile.execute()` — call `execute()` on ref or rely on post-render execute below.
   */
  execution?: "render" | "execute";
  /** When execution is `execute`, automatically call `turnstile.execute` after mount (typical for invisible widgets). */
  autoExecute?: boolean;
}

const TURNSTILE_SCRIPT_SRC =
  "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

export const TurnstileWidget = forwardRef<
  TurnstileWidgetHandle,
  TurnstileWidgetProps
>(function TurnstileWidget(
  {
    siteKey,
    action,
    onToken,
    className,
    execution = "render",
    autoExecute = true,
  },
  ref
) {
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
      execute: () => {
        if (typeof window === "undefined") return;
        const ts = window.turnstile;
        const id = widgetIdRef.current;
        if (ts && id != null) ts.execute(id);
      },
    }),
    []
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!safeSiteKey) return;

    const existing = document.querySelector(
      'script[data-turnstile-script="explicit"]'
    ) as HTMLScriptElement | null;
    if (!existing) {
      const script = document.createElement("script");
      script.src = TURNSTILE_SCRIPT_SRC;
      script.dataset.turnstileScript = "explicit";
      document.head.appendChild(script);
    }

    let cancelled = false;

    const renderWidget = () => {
      if (cancelled) return;
      const el = containerRef.current;
      if (!el) return;
      const ts = window.turnstile;
      if (!ts || widgetIdRef.current != null) return;

      widgetIdRef.current = ts.render(el, {
        sitekey: safeSiteKey,
        action: action ?? undefined,
        theme: "auto",
        execution,
        callback: (token: string) => onTokenRef.current(token),
        "expired-callback": () => onTokenRef.current(""),
        "error-callback": () => onTokenRef.current(""),
      });

      if (execution === "execute" && autoExecute && widgetIdRef.current != null) {
        ts.execute(widgetIdRef.current);
      }
    };

    const start = Date.now();
    const poll = () => {
      if (cancelled) return;
      const ts = window.turnstile;
      if (!ts) {
        if (Date.now() - start < 8000) setTimeout(poll, 200);
        return;
      }
      if (typeof ts.render !== "function") {
        if (Date.now() - start < 8000) setTimeout(poll, 200);
        return;
      }
      renderWidget();
    };

    poll();

    return () => {
      cancelled = true;
      const ts = window.turnstile;
      if (ts && widgetIdRef.current != null) ts.remove(widgetIdRef.current);
      widgetIdRef.current = null;
    };
  }, [safeSiteKey, action, execution, autoExecute]);

  if (!safeSiteKey) return null;

  return (
    <div
      ref={containerRef}
      className={className}
      data-turnstile-execution={execution}
    />
  );
});
