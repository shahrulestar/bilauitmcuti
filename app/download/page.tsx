'use client';

import { Suspense, useState, useEffect, useCallback, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

const pwaBenefits = [
  'Open the app from your home screen in one tap.',
  'Keep the UiTM academic calendar close at hand.',
  'Use the in-app chat assistant without installing from an app store.',
];

const bookmarkBenefits = [
  'Open bilauitmcuti.com from your browser bookmarks in one click.',
  'Keep the UiTM academic calendar easy to find on any device.',
  'No install required — works in Safari, Chrome, Edge, Firefox, and more.',
];

const iosInstallSteps: React.ReactNode[] = [
  <>
    Open <strong className="font-semibold text-foreground">Safari</strong> and visit{' '}
    <strong className="font-semibold text-foreground">bilauitmcuti.com</strong>
  </>,
  <>
    Tap the <strong className="font-semibold text-foreground">Share</strong> button (square with arrow up)
  </>,
  <>
    Choose <strong className="font-semibold text-foreground">&ldquo;Add to Home Screen&rdquo;</strong>
  </>,
  <>
    Tap <strong className="font-semibold text-foreground">Add</strong> to finish
  </>,
];

const androidInstallSteps: React.ReactNode[] = [
  <>
    Open <strong className="font-semibold text-foreground">Chrome</strong> and visit{' '}
    <strong className="font-semibold text-foreground">bilauitmcuti.com</strong>
  </>,
  <>
    Tap the <strong className="font-semibold text-foreground">menu</strong> (three dots)
  </>,
  <>
    Select <strong className="font-semibold text-foreground">&ldquo;Install app&rdquo;</strong> or{' '}
    <strong className="font-semibold text-foreground">&ldquo;Add to Home Screen&rdquo;</strong>
  </>,
  <>Confirm when prompted</>,
];

const iosBookmarkSteps: React.ReactNode[] = [
  <>
    Open <strong className="font-semibold text-foreground">Safari</strong> and visit{' '}
    <strong className="font-semibold text-foreground">bilauitmcuti.com</strong>
  </>,
  <>
    Tap the <strong className="font-semibold text-foreground">Share</strong> button (square with arrow up)
  </>,
  <>
    Tap <strong className="font-semibold text-foreground">&ldquo;Add Bookmark&rdquo;</strong>
  </>,
  <>
    Choose a folder (e.g. <strong className="font-semibold text-foreground">Favorites</strong>) and tap{' '}
    <strong className="font-semibold text-foreground">Save</strong>
  </>,
];

const androidBookmarkSteps: React.ReactNode[] = [
  <>
    Open <strong className="font-semibold text-foreground">Chrome</strong> and visit{' '}
    <strong className="font-semibold text-foreground">bilauitmcuti.com</strong>
  </>,
  <>
    Tap the <strong className="font-semibold text-foreground">star</strong> icon in the address bar
  </>,
  <>Rename the bookmark if you like, then confirm</>,
  <>
    Tap <strong className="font-semibold text-foreground">Save</strong> or{' '}
    <strong className="font-semibold text-foreground">Done</strong>
  </>,
];

function NumberedInstallList({ steps }: { steps: React.ReactNode[] }) {
  return (
    <ol className="flex flex-col gap-3">
      {steps.map((body, index) => (
        <li key={index} className="flex gap-3">
          <span
            className="flex size-7 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium text-muted-foreground"
            aria-hidden
          >
            {index + 1}
          </span>
          <span className="min-w-0 pt-0.5 text-sm leading-relaxed text-foreground">{body}</span>
        </li>
      ))}
    </ol>
  );
}

function PwaTabContent({ isInstalled }: { isInstalled: boolean }) {
  return (
    <>
      <Card className="gap-0 rounded-[10px] shadow-none">
        <CardHeader className="space-y-1 px-3 pb-4 sm:px-6">
          <div>
            <CardTitle asChild className="text-2xl font-semibold">
              <h2>Install Bila UiTM Cuti</h2>
            </CardTitle>
            <CardDescription className="mt-1 text-sm text-foreground">
              Progressive Web App — add this site to your home screen for quick access to the calendar and chat. No app
              store install is required.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="px-3 sm:px-6">
          <p className="mb-3 text-sm font-semibold">Why install</p>
          <ul className="list-inside list-disc text-sm text-foreground">
            {pwaBenefits.map((line) => (
              <li key={line} className="mt-2 first:mt-0">
                {line}
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      {isInstalled ? (
        <Card className="mt-4 gap-0 rounded-[10px] shadow-none" role="status">
          <CardHeader className="space-y-1 px-3 pb-4 sm:px-6">
            <CardTitle className="text-xl font-semibold">Installed app</CardTitle>
            <CardDescription className="mt-1 text-sm text-foreground">
              You are running Bila UiTM Cuti in standalone mode. You can return here from the main site if you need
              these steps on another device.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : null}

      <Card className="mt-4 gap-0 rounded-[10px] shadow-none">
        <CardHeader className="space-y-1 px-3 pb-4 sm:px-6">
          <CardTitle className="text-xl font-semibold">iPhone & iPad</CardTitle>
          <CardDescription className="mt-1 text-sm text-foreground">Safari</CardDescription>
        </CardHeader>
        <CardContent className="px-3 pt-0 sm:px-6">
          <NumberedInstallList steps={iosInstallSteps} />
        </CardContent>
      </Card>

      <Card className="mt-4 gap-0 rounded-[10px] shadow-none">
        <CardHeader className="space-y-1 px-3 pb-4 sm:px-6">
          <CardTitle className="text-xl font-semibold">Android</CardTitle>
          <CardDescription className="mt-1 text-sm text-foreground">Chrome (recommended)</CardDescription>
        </CardHeader>
        <CardContent className="px-3 pt-0 sm:px-6">
          <NumberedInstallList steps={androidInstallSteps} />
        </CardContent>
      </Card>

      <Card className="mt-4 gap-0 rounded-[10px] shadow-none">
        <CardHeader className="space-y-1 px-3 pb-4 sm:px-6">
          <CardTitle className="text-xl font-semibold">Desktop & laptop</CardTitle>
          <CardDescription className="mt-1 text-sm text-foreground">
            Chrome, Edge, or Safari — use{' '}
            <span className="font-medium">bilauitmcuti.com</span> in a supported browser.
          </CardDescription>
        </CardHeader>
        <CardContent className="px-3 pt-0 sm:px-6">
          <ul className="flex flex-col gap-4 text-sm leading-relaxed text-foreground">
            <li>
              <strong className="font-semibold">Chrome / Edge:</strong> Use the install icon in the address bar, or open
              the menu and choose &ldquo;Install app&rdquo; / &ldquo;Install Bila UiTM Cuti&rdquo;.
            </li>
            <li>
              <strong className="font-semibold">Safari (macOS):</strong> File or Share menu → &ldquo;Add to Dock&rdquo;
              (wording may vary by macOS version).
            </li>
          </ul>
        </CardContent>
      </Card>
    </>
  );
}

function BookmarkTabContent() {
  return (
    <>
      <Card className="gap-0 rounded-[10px] shadow-none">
        <CardHeader className="space-y-1 px-3 pb-4 sm:px-6">
          <div>
            <CardTitle asChild className="text-2xl font-semibold">
              <h2>Bookmark Bila UiTM Cuti</h2>
            </CardTitle>
            <CardDescription className="mt-1 text-sm text-foreground">
              Save this site in your browser bookmarks or favorites so you can return to the calendar and chat without
              searching again.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="px-3 sm:px-6">
          <p className="mb-3 text-sm font-semibold">Why bookmark</p>
          <ul className="list-inside list-disc text-sm text-foreground">
            {bookmarkBenefits.map((line) => (
              <li key={line} className="mt-2 first:mt-0">
                {line}
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <Card className="mt-4 gap-0 rounded-[10px] shadow-none">
        <CardHeader className="space-y-1 px-3 pb-4 sm:px-6">
          <CardTitle className="text-xl font-semibold">iPhone & iPad</CardTitle>
          <CardDescription className="mt-1 text-sm text-foreground">Safari</CardDescription>
        </CardHeader>
        <CardContent className="px-3 pt-0 sm:px-6">
          <NumberedInstallList steps={iosBookmarkSteps} />
        </CardContent>
      </Card>

      <Card className="mt-4 gap-0 rounded-[10px] shadow-none">
        <CardHeader className="space-y-1 px-3 pb-4 sm:px-6">
          <CardTitle className="text-xl font-semibold">Android</CardTitle>
          <CardDescription className="mt-1 text-sm text-foreground">Chrome (recommended)</CardDescription>
        </CardHeader>
        <CardContent className="px-3 pt-0 sm:px-6">
          <NumberedInstallList steps={androidBookmarkSteps} />
        </CardContent>
      </Card>

      <Card className="mt-4 gap-0 rounded-[10px] shadow-none">
        <CardHeader className="space-y-1 px-3 pb-4 sm:px-6">
          <CardTitle className="text-xl font-semibold">Desktop & laptop</CardTitle>
          <CardDescription className="mt-1 text-sm text-foreground">
            Chrome, Edge, Safari, or Firefox — visit{' '}
            <span className="font-medium">bilauitmcuti.com</span> in your browser first.
          </CardDescription>
        </CardHeader>
        <CardContent className="px-3 pt-0 sm:px-6">
          <ul className="flex flex-col gap-4 text-sm leading-relaxed text-foreground">
            <li>
              <strong className="font-semibold">Chrome / Edge / Firefox:</strong> Press{' '}
              <kbd className="rounded border bg-muted px-1.5 py-0.5 font-mono text-xs">Ctrl+D</kbd> (Windows) or{' '}
              <kbd className="rounded border bg-muted px-1.5 py-0.5 font-mono text-xs">⌘D</kbd> (Mac), or click the{' '}
              <strong className="font-semibold">star</strong> in the address bar, then save.
            </li>
            <li>
              <strong className="font-semibold">Safari (macOS):</strong> Bookmarks menu → &ldquo;Add Bookmark&rdquo;, or
              press <kbd className="rounded border bg-muted px-1.5 py-0.5 font-mono text-xs">⌘D</kbd>.
            </li>
            <li>
              <strong className="font-semibold">Tip:</strong> Add the bookmark to your bookmarks bar or Favorites for
              one-click access.
            </li>
          </ul>
        </CardContent>
      </Card>
    </>
  );
}

export default function DownloadPage() {
  return (
    <Suspense fallback={null}>
      <DownloadPageContent />
    </Suspense>
  );
}

function DownloadPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [headerVisible, setHeaderVisible] = useState(true);
  const [isInstalled, setIsInstalled] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const lastScrollTop = useRef(0);

  const initialTab = searchParams.get('tab') === 'bookmark' ? 'bookmark' : 'pwa';

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
    const isMinimalUI = (window.navigator as { standalone?: boolean }).standalone === true;

    if (isStandalone || isMinimalUI) {
      setIsInstalled(true);
    }
  }, []);

  const handleScroll = useCallback(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const currentScrollTop = el.scrollTop;
    if (currentScrollTop <= 10 || currentScrollTop < lastScrollTop.current) {
      setHeaderVisible(true);
    } else if (currentScrollTop > lastScrollTop.current) {
      setHeaderVisible(false);
    }
    lastScrollTop.current = currentScrollTop;
  }, []);

  return (
    <div className="relative flex h-dvh flex-col bg-background text-foreground">
      <div className="chat-top-fade pointer-events-none absolute top-0 right-0 left-0 z-[9]" />

      <div
        className={`chat-header absolute top-0 right-0 left-0 z-10 px-4 transition-transform md:px-0 ${
          headerVisible ? 'translate-y-0' : '-translate-y-full'
        }`}
      >
        <header className="mx-auto flex w-full max-w-[600px] items-center gap-3 pt-8 pb-3">
          <button
            type="button"
            onClick={() => router.push('/')}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-secondary transition-colors hover:bg-secondary/80 dark:bg-[#2A2A2A] dark:hover:bg-[#333]"
            aria-label="Back to home"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
        </header>
      </div>

      <div
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto px-4 pt-24 pb-6 md:px-0"
      >
        <div className="mx-auto w-full max-w-[600px]">
          <h1 className="sr-only">Download Bila UiTM Cuti</h1>

          <Tabs defaultValue={initialTab} className="flex flex-col gap-4">
            <TabsList className="grid h-10 w-full grid-cols-2">
              <TabsTrigger value="pwa">Download PWA</TabsTrigger>
              <TabsTrigger value="bookmark">Bookmark</TabsTrigger>
            </TabsList>

            <TabsContent value="pwa" className="mt-0">
              <PwaTabContent isInstalled={isInstalled} />
            </TabsContent>

            <TabsContent value="bookmark" className="mt-0">
              <BookmarkTabContent />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
