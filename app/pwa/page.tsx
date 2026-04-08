'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft, Monitor, Smartphone, TabletSmartphone, Sparkles } from 'lucide-react';

export default function PWAPage() {
  const router = useRouter();
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
    const isMinimalUI = (window.navigator as { standalone?: boolean }).standalone === true;

    if (isStandalone || isMinimalUI) {
      setIsInstalled(true);
    }
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto w-full max-w-[1000px] px-4 py-8 sm:px-6 lg:px-4">
        {/* Back */}
        <button
          onClick={() => router.push('/')}
          className="mb-8 flex h-9 w-9 items-center justify-center rounded-full bg-secondary transition-colors hover:bg-secondary/80 dark:bg-[#2A2A2A] dark:hover:bg-[#333]"
          aria-label="Back to home"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>

        {/* Hero */}
        <div className="relative mb-8 overflow-hidden rounded-2xl border border-border/70 bg-gradient-to-b from-secondary/70 to-background p-6 sm:p-8">
          <div className="pointer-events-none absolute -right-16 -top-20 h-52 w-52 rounded-full bg-violet-500/10 blur-3xl" />
          <div className="pointer-events-none absolute -left-16 bottom-0 h-40 w-40 rounded-full bg-blue-500/10 blur-3xl" />
          <div className="relative">
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-border/70 bg-background/80 px-3 py-1 text-xs text-muted-foreground">
              <Sparkles className="h-3.5 w-3.5" />
              Progressive Web App Guide
            </div>
            <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
              Install <span className="text-[#8b5cf6]">Bila UiTM Cuti</span>
            </h1>
            <p className="mt-3 max-w-2xl text-muted-foreground">
              Add this app to your home screen for a faster, native-like experience with the latest calendar, chat, and contact updates.
            </p>
          </div>
        </div>

        {/* Already installed banner */}
        {isInstalled && (
          <div className="mb-8 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-700 dark:text-emerald-400">
            You&apos;re already using Bila UiTM Cuti as an installed app.
          </div>
        )}

        {/* Installation Instructions */}
        <div className="space-y-6">
          {/* iOS */}
          <section className="rounded-xl border border-border bg-card p-5 sm:p-6">
            <div className="mb-4 flex items-center gap-2">
              <Smartphone className="h-5 w-5 text-muted-foreground" />
              <h2 className="text-lg font-semibold">iPhone &amp; iPad</h2>
            </div>
            <ol className="space-y-2 text-sm text-muted-foreground">
              <li className="flex gap-3">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium">1</span>
                Open <strong className="font-semibold text-foreground">Safari</strong> and go to <strong className="font-semibold text-foreground">bilauitmcuti.com</strong>
              </li>
              <li className="flex gap-3">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium">2</span>
                Tap the <strong className="font-semibold text-foreground">Share</strong> button (arrow pointing up)
              </li>
              <li className="flex gap-3">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium">3</span>
                Select <strong className="font-semibold text-foreground">&ldquo;Add to Home Screen&rdquo;</strong>
              </li>
              <li className="flex gap-3">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium">4</span>
                Tap <strong className="font-semibold text-foreground">Add</strong> to confirm
              </li>
            </ol>
          </section>

          {/* Android */}
          <section className="rounded-xl border border-border bg-card p-5 sm:p-6">
            <div className="mb-4 flex items-center gap-2">
              <TabletSmartphone className="h-5 w-5 text-muted-foreground" />
              <h2 className="text-lg font-semibold">Android</h2>
            </div>
            <ol className="space-y-2 text-sm text-muted-foreground">
              <li className="flex gap-3">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium">1</span>
                Open <strong className="font-semibold text-foreground">Chrome</strong> and go to <strong className="font-semibold text-foreground">bilauitmcuti.com</strong>
              </li>
              <li className="flex gap-3">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium">2</span>
                Tap the <strong className="font-semibold text-foreground">menu</strong> (three dots)
              </li>
              <li className="flex gap-3">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium">3</span>
                Select <strong className="font-semibold text-foreground">&ldquo;Install app&rdquo;</strong> or <strong className="font-semibold text-foreground">&ldquo;Add to Home Screen&rdquo;</strong>
              </li>
              <li className="flex gap-3">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium">4</span>
                Confirm the installation
              </li>
            </ol>
          </section>

          {/* Desktop */}
          <section className="rounded-xl border border-border bg-card p-5 sm:p-6">
            <div className="mb-4 flex items-center gap-2">
              <Monitor className="h-5 w-5 text-muted-foreground" />
              <h2 className="text-lg font-semibold">Desktop &amp; Laptop</h2>
            </div>
            <div className="space-y-2 text-sm text-muted-foreground">
              <p>
                <strong className="font-semibold text-foreground">Chrome / Edge:</strong> Click the install icon in the address bar, or go to the browser menu and select &ldquo;Install app&rdquo;.
              </p>
              <p>
                <strong className="font-semibold text-foreground">Safari (macOS):</strong> Share &rarr; Add to Dock.
              </p>
            </div>
          </section>

        </div>
      </div>
    </div>
  );
}
