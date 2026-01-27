import React from "react"
import type { Metadata, Viewport } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import { ThemeProvider } from '@/components/theme-provider'
import './globals.css'

const geist = Geist({ subsets: ["latin"] });
const geistMono = Geist_Mono({ subsets: ["latin"] });

export const metadata: Metadata = {
  metadataBase: new URL('https://cutiuitm.xyz'),
  title: 'Bila UiTM Cuti? - Academic Calendar 2026',
  description: 'Interactive UiTM academic calendar for 2026. View registration dates, lecture schedules, examination periods, and breaks. Includes regional schedule variations for Kedah, Kelantan, and Terengganu. Supports dark/light themes and offline access.',
  keywords: ['UiTM', 'academic calendar', '2026', 'registration', 'examination', 'lectures', 'holidays', 'Malaysia', 'Universiti Teknologi MARA', 'student app'],
  generator: 'v0.app',
  manifest: '/manifest.json',
  authors: [
    {
      name: 'Alumni UiTM',
      url: 'https://github.com',
    },
  ],
  creator: 'Alumni UiTM',
  openGraph: {
    title: 'Bila UiTM Cuti? - Academic Calendar 2026',
    description: 'Interactive calendar showing UiTM academic schedules, registration dates, lecture periods, and examination dates for 2026.',
    type: 'website',
    url: 'https://cutiuitm.xyz',
    locale: 'ms_MY',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'Bila UiTM Cuti? - Academic Calendar 2026',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Bila UiTM Cuti? - Academic Calendar 2026',
    description: 'Interactive UiTM academic calendar with support for all program groups and regional variations.',
  },
  icons: {
    icon: [
      { url: '/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
      { url: '/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
      { url: '/favicon.ico' },
    ],
    apple: '/apple-touch-icon.png',
    other: [
      {
        rel: 'icon',
        url: '/favicon-16x16.png',
        sizes: '16x16',
      },
      {
        rel: 'icon',
        url: '/favicon-32x32.png',
        sizes: '32x32',
      },
    ],
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  minimumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#1a1a1a' }
  ],
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta name="theme-color" content="#ffffff" media="(prefers-color-scheme: light)" />
        <meta name="theme-color" content="#1a1a1a" media="(prefers-color-scheme: dark)" />
        <link rel="manifest" href="/manifest.json" />
        <link rel="canonical" href="https://cutiuitm.xyz" />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                // Sync theme from localStorage before React hydration to prevent flash
                try {
                  let theme = 'light';
                  try {
                    theme = localStorage.getItem('theme') || 'light';
                  } catch (storageError) {
                    // If localStorage access fails, use default
                    console.warn('localStorage access failed, using default theme:', storageError);
                  }
                  
                  // Validate theme value - only accept 'light' or 'dark'
                  const validTheme = (theme === 'dark' || theme === 'light') ? theme : 'light';
                  
                  // Apply theme class - always remove both classes first to ensure clean state
                  document.documentElement.classList.remove('dark', 'light');
                  document.documentElement.classList.add(validTheme);
                  
                  // Update theme-color meta tag
                  try {
                    const metaThemeColor = document.querySelector('meta[name="theme-color"]');
                    if (metaThemeColor) {
                      metaThemeColor.setAttribute('content', validTheme === 'dark' ? '#1a1a1a' : '#ffffff');
                    }
                  } catch (metaError) {
                    console.warn('Failed to update theme-color meta tag:', metaError);
                  }
                } catch (e) {
                  // Comprehensive fallback - ensure light theme is always applied
                  console.warn('Theme sync failed, applying fallback:', e);
                  try {
                    document.documentElement.classList.remove('dark');
                    document.documentElement.classList.add('light');
                    const metaThemeColor = document.querySelector('meta[name="theme-color"]');
                    if (metaThemeColor) {
                      metaThemeColor.setAttribute('content', '#ffffff');
                    }
                  } catch (fallbackError) {
                    // Last resort - just add light class
                    document.documentElement.classList.add('light');
                  }
                }
                
                // Store filter states in data attributes for synchronous access
                // This prevents flicker when filters are applied - MUST run before React hydration
                // Default values from data.ts (single source of truth) - inlined to avoid import in script
                const DEFAULT_FILTER_STATES = {
                  showKKT: false,
                  showRegistration: false,
                  showLecture: true,
                  showSemesterPendek: false,
                  showKuliahIntersesi: false,
                  showExamination: true,
                  showOthersExams: false,
                  showBreak: true,
                };
                
                try {
                  // Properly check if localStorage keys exist using ?? (null coalescing)
                  // Only use defaults when localStorage key is null (doesn't exist)
                  const filters = {
                    showRegistration: localStorage.getItem('showRegistration') ?? JSON.stringify(DEFAULT_FILTER_STATES.showRegistration),
                    showLecture: localStorage.getItem('showLecture') ?? JSON.stringify(DEFAULT_FILTER_STATES.showLecture),
                    showSemesterPendek: localStorage.getItem('showSemesterPendek') ?? JSON.stringify(DEFAULT_FILTER_STATES.showSemesterPendek),
                    showKuliahIntersesi: localStorage.getItem('showKuliahIntersesi') ?? JSON.stringify(DEFAULT_FILTER_STATES.showKuliahIntersesi),
                    showExamination: localStorage.getItem('showExamination') ?? JSON.stringify(DEFAULT_FILTER_STATES.showExamination),
                    showOthersExams: localStorage.getItem('showOthersExams') ?? JSON.stringify(DEFAULT_FILTER_STATES.showOthersExams),
                    showBreak: localStorage.getItem('showBreak') ?? JSON.stringify(DEFAULT_FILTER_STATES.showBreak),
                    showKKT: localStorage.getItem('showKKT') ?? JSON.stringify(DEFAULT_FILTER_STATES.showKKT),
                  };
                  // Store as data attribute for synchronous access during component initialization
                  document.documentElement.setAttribute('data-filters', JSON.stringify(filters));
                } catch (e) {
                  // Fallback: set default values if localStorage fails
                  const defaultFilters = {
                    showRegistration: JSON.stringify(DEFAULT_FILTER_STATES.showRegistration),
                    showLecture: JSON.stringify(DEFAULT_FILTER_STATES.showLecture),
                    showSemesterPendek: JSON.stringify(DEFAULT_FILTER_STATES.showSemesterPendek),
                    showKuliahIntersesi: JSON.stringify(DEFAULT_FILTER_STATES.showKuliahIntersesi),
                    showExamination: JSON.stringify(DEFAULT_FILTER_STATES.showExamination),
                    showOthersExams: JSON.stringify(DEFAULT_FILTER_STATES.showOthersExams),
                    showBreak: JSON.stringify(DEFAULT_FILTER_STATES.showBreak),
                    showKKT: JSON.stringify(DEFAULT_FILTER_STATES.showKKT),
                  };
                  document.documentElement.setAttribute('data-filters', JSON.stringify(defaultFilters));
                }
              })();
            `,
          }}
        />
      </head>
      <body className={`${geist.className} antialiased`} suppressHydrationWarning>
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem={false}
          storageKey="theme"
          disableTransitionOnChange={false}
        >
          {children}
        </ThemeProvider>
        <Analytics />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                if ('serviceWorker' in navigator) {
                  window.addEventListener('load', function() {
                    navigator.serviceWorker.register('/sw.js').catch(function(err) {
                      console.log('SW registration failed:', err);
                    });
                  });
                }
              })();
            `,
          }}
        />
      </body>
    </html>
  )
}
