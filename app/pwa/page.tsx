'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft, Monitor, Smartphone, TabletSmartphone, Sparkles, CalendarDays, LayoutGrid, List, Moon, Sun, MessageCircle, MapPin } from 'lucide-react';

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
      <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
        {/* Back */}
        <button
          onClick={() => router.push('/')}
          className="mb-8 flex items-center justify-center w-9 h-9 rounded-full bg-secondary hover:bg-secondary/80 dark:bg-[#2A2A2A] dark:hover:bg-[#333] transition-colors"
          aria-label="Back to home"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>

        {/* Hero */}
        <div className="mb-10">
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            Install <span className="text-[#8b5cf6]">Bila UiTM Cuti?</span>
          </h1>
          <p className="mt-2 text-muted-foreground">
            Add this web app to your home screen for a faster, app-like experience.
          </p>
        </div>

        {/* Reinstall guide for old app icons */}
        <section id="reinstall" className="mb-8 rounded-lg border border-amber-500/30 bg-amber-500/10 p-4">
          <h2 className="text-base font-semibold text-foreground">How to reinstall Bila UiTM Cuti?</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            If you are using an older home screen version, delete that app icon first, then reinstall from your browser.
          </p>
          <ol className="mt-3 space-y-2 text-sm text-muted-foreground">
            <li className="flex gap-3">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium">1</span>
              Delete/remove the old app icon from your home screen.
            </li>
            <li className="flex gap-3">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium">2</span>
              Open <strong className="font-semibold text-foreground">cutiuitm.xyz</strong> in your browser (Safari / Chrome / Edge).
            </li>
            <li className="flex gap-3">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium">3</span>
              Install again using <strong className="font-semibold text-foreground">Add to Home Screen</strong> or <strong className="font-semibold text-foreground">Install app</strong>.
            </li>
          </ol>
        </section>

        {/* Already installed banner */}
        {isInstalled && (
          <div className="mb-8 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-700 dark:text-emerald-400">
            You&apos;re already using Bila UiTM Cuti? as an installed app.
          </div>
        )}

        {/* Installation Instructions */}
        <div className="space-y-8">
          {/* iOS */}
          <section>
            <div className="mb-4 flex items-center gap-2">
              <Smartphone className="h-5 w-5 text-muted-foreground" />
              <h2 className="text-lg font-semibold">iPhone &amp; iPad</h2>
            </div>
            <ol className="space-y-2 text-sm text-muted-foreground">
              <li className="flex gap-3">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium">1</span>
                Open <strong className="font-semibold text-foreground">Safari</strong> and go to <strong className="font-semibold text-foreground">cutiuitm.xyz</strong>
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
          <section>
            <div className="mb-4 flex items-center gap-2">
              <TabletSmartphone className="h-5 w-5 text-muted-foreground" />
              <h2 className="text-lg font-semibold">Android</h2>
            </div>
            <ol className="space-y-2 text-sm text-muted-foreground">
              <li className="flex gap-3">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium">1</span>
                Open <strong className="font-semibold text-foreground">Chrome</strong> and go to <strong className="font-semibold text-foreground">cutiuitm.xyz</strong>
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
          <section>
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

          {/* Divider */}
          <hr className="border-border" />

          {/* Features */}
          <section>
            <h2 className="mb-4 text-lg font-semibold">What you get</h2>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <FeatureItem icon={<CalendarDays className="h-4 w-4" />} label="Academic calendar 2026" />
              <FeatureItem icon={<LayoutGrid className="h-4 w-4" />} label="Grid & list views" />
              <FeatureItem icon={<Sparkles className="h-4 w-4" />} label="Group A & B schedules" />
              <FeatureItem icon={<MapPin className="h-4 w-4" />} label="Kedah, Kelantan & Terengganu" />
              <FeatureItem icon={<MessageCircle className="h-4 w-4" />} label="AI chat assistant" />
              <FeatureItem icon={<ThemeIcon />} label="Dark & light themes" />
              <FeatureItem icon={<List className="h-4 w-4" />} label="Fast & responsive design" />
              <FeatureItem icon={<Smartphone className="h-4 w-4" />} label="Installable as native app" />
            </div>
          </section>

          {/* Divider */}
          <hr className="border-border" />

          {/* Disclaimer */}
          <section className="pb-8">
            <h2 className="mb-3 text-lg font-semibold">Disclaimer</h2>
            <p className="text-sm leading-relaxed text-muted-foreground">
              This app is <strong className="font-semibold text-foreground">not affiliated with UiTM</strong> (Universiti Teknologi MARA). It is created for educational and informational purposes only. Calendar data is sourced from publicly available HEA UiTM academic calendar information. Please verify important dates directly with official UiTM sources.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}

function FeatureItem({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="flex items-center gap-3 rounded-lg border bg-card p-3 text-sm">
      <span className="text-muted-foreground">{icon}</span>
      <span>{label}</span>
    </div>
  );
}

function ThemeIcon() {
  return (
    <>
      <Sun className="h-4 w-4 dark:hidden" />
      <Moon className="hidden h-4 w-4 dark:block" />
    </>
  );
}
