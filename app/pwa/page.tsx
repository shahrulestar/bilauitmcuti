'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

const benefits = [
  'Open the app from your home screen in one tap.',
  'Keep the UiTM academic calendar close at hand.',
  'Use the in-app chat assistant without installing from an app store.',
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

function NumberedInstallList({ steps }: { steps: React.ReactNode[] }) {
  return (
    <ol className="space-y-3">
      {steps.map((body, index) => (
        <li key={index} className="flex gap-3">
          <span
            className="flex size-7 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium text-muted-foreground"
            aria-hidden
          >
            {index + 1}
          </span>
          <span className="min-w-0 pt-0.5 text-sm leading-relaxed text-muted-foreground">{body}</span>
        </li>
      ))}
    </ol>
  );
}

interface PlatformCardProps {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}

function PlatformCard({ title, subtitle, children }: PlatformCardProps) {
  return (
    <Card size="sm" className="h-full">
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
        <CardDescription>{subtitle}</CardDescription>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

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
      <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
        <button
          type="button"
          onClick={() => router.push('/')}
          className="mb-6 flex h-9 w-9 items-center justify-center rounded-full bg-secondary transition-colors hover:bg-secondary/80 dark:bg-[#2A2A2A] dark:hover:bg-[#333]"
          aria-label="Back to home"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>

        <Card>
          <CardHeader>
            <CardTitle asChild className="text-2xl sm:text-3xl">
              <h1>Install Bila UiTM Cuti</h1>
            </CardTitle>
            <CardDescription className="text-base text-pretty">
              Progressive Web App — add this site to your home screen for quick access to the calendar and chat. No app
              store install is required.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="list-inside list-disc space-y-2 text-sm text-muted-foreground">
              {benefits.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </CardContent>
        </Card>

        {isInstalled ? (
          <Alert className="mt-8" role="status">
            <AlertTitle>Installed app</AlertTitle>
            <AlertDescription>
              You are running Bila UiTM Cuti in standalone mode. You can return here from the main site if you need these
              steps on another device.
            </AlertDescription>
          </Alert>
        ) : null}

        <div className="mt-10 space-y-6">
          <div className="space-y-2">
            <h2 className="text-lg font-semibold tracking-tight sm:text-xl">Install on your device</h2>
            <p className="max-w-2xl text-sm text-muted-foreground sm:text-base">
              Choose your platform. Use <span className="font-medium text-foreground">bilauitmcuti.com</span> in a
              supported browser.
            </p>
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            <PlatformCard title="iPhone & iPad" subtitle="Safari">
              <NumberedInstallList steps={iosInstallSteps} />
            </PlatformCard>

            <PlatformCard title="Android" subtitle="Chrome (recommended)">
              <NumberedInstallList steps={androidInstallSteps} />
            </PlatformCard>

            <PlatformCard title="Desktop & laptop" subtitle="Chrome, Edge, or Safari">
              <ul className="space-y-4 text-sm leading-relaxed text-muted-foreground">
                <li>
                  <strong className="font-semibold text-foreground">Chrome / Edge:</strong> Use the install icon in the
                  address bar, or open the menu and choose &ldquo;Install app&rdquo; / &ldquo;Install Bila UiTM
                  Cuti&rdquo;.
                </li>
                <li>
                  <strong className="font-semibold text-foreground">Safari (macOS):</strong> File or Share menu →{' '}
                  <span className="text-foreground">&ldquo;Add to Dock&rdquo;</span> (wording may vary by macOS version).
                </li>
              </ul>
            </PlatformCard>
          </div>
        </div>
      </div>
    </div>
  );
}
