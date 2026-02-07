import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Chat - Bila UiTM Cuti?",
  description:
    "Ask AI about your UiTM academic calendar. Get instant answers about lecture dates, exam schedules, breaks, and registration periods for all programs.",
  openGraph: {
    title: "Chat - Bila UiTM Cuti?",
    description:
      "Ask AI about your UiTM academic calendar. Get instant answers about lecture dates, exam schedules, breaks, and registration periods.",
    url: "https://cutiuitm.xyz/chat",
  },
  twitter: {
    card: "summary_large_image",
    title: "Chat - Bila UiTM Cuti?",
    description:
      "Ask AI about your UiTM academic calendar. Get instant answers about lecture dates, exam schedules, breaks, and registration periods.",
  },
};

export default function ChatLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
