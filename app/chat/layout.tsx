import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Chat | Bila UiTM Cuti",
  description:
    "Ask AI about your UiTM academic calendar. Get instant answers about lecture dates, exam schedules, breaks, and registration periods for all programs.",
  openGraph: {
    siteName: "Bila UiTM Cuti?",
    title: "Chat | Bila UiTM Cuti",
    description:
      "Ask AI about your UiTM academic calendar. Get instant answers about lecture dates, exam schedules, breaks, and registration periods.",
    url: "https://bilauitmcuti.com/chat",
    type: "website",
    locale: "ms_MY",
    images: [
      {
        url: "https://bilauitmcuti.com/chat-cover.png",
        width: 1200,
        height: 630,
        alt: "Chat | Bila UiTM Cuti",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Chat | Bila UiTM Cuti",
    description:
      "Ask AI about your UiTM academic calendar. Get instant answers about lecture dates, exam schedules, breaks, and registration periods.",
    images: ["https://bilauitmcuti.com/chat-cover.png"],
  },
};

export default function ChatLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
