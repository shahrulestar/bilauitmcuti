import type { Metadata } from "next";
import { ChatCalendarBootstrap } from "@/components/chat-calendar-bootstrap";
import { PageSeoBlock } from "@/components/page-seo-block";
import { TurnstileSiteKeyProvider } from "@/hooks/use-turnstile-site-key";
import {
  CHAT_SEO_DESCRIPTION,
  CHAT_SEO_TITLE,
  SITE_ORIGIN,
} from "@/lib/page-seo";
import { getTurnstileSiteKey } from "@/lib/turnstile-config";

const CHAT_CANONICAL = `${SITE_ORIGIN}/chat`;

export const metadata: Metadata = {
  title: CHAT_SEO_TITLE,
  description: CHAT_SEO_DESCRIPTION,
  robots: { index: true, follow: true },
  alternates: {
    canonical: CHAT_CANONICAL,
  },
  openGraph: {
    siteName: "Bila UiTM Cuti",
    title: CHAT_SEO_TITLE,
    description: CHAT_SEO_DESCRIPTION,
    url: CHAT_CANONICAL,
    type: "website",
    locale: "ms_MY",
    images: [
      {
        url: "https://bilauitmcuti.com/chat-cover.png",
        width: 1200,
        height: 630,
        alt: CHAT_SEO_TITLE,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: CHAT_SEO_TITLE,
    description: CHAT_SEO_DESCRIPTION,
    images: ["https://bilauitmcuti.com/chat-cover.png"],
  },
};

export default function ChatLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <TurnstileSiteKeyProvider initialSiteKey={getTurnstileSiteKey()}>
      <PageSeoBlock
        heading={CHAT_SEO_TITLE}
        description={CHAT_SEO_DESCRIPTION}
        url={CHAT_CANONICAL}
        breadcrumbs={[
          { name: "Home", item: SITE_ORIGIN },
          { name: "Chat", item: CHAT_CANONICAL },
        ]}
      />
      <ChatCalendarBootstrap />
      {children}
    </TurnstileSiteKeyProvider>
  );
}
