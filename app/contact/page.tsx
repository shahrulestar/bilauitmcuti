"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Toaster } from "@/components/ui/sonner";
import { CONTACT_CATEGORY_OPTIONS, CONTACT_WHO_OPTIONS } from "@/lib/contact";
import {
  TurnstileWidget,
  type TurnstileWidgetHandle,
} from "@/components/turnstile-widget";

const MAX_MESSAGE_LENGTH = 400;

export default function ContactPage() {
  const router = useRouter();
  const [who, setWho] = useState("");
  const [category, setCategory] = useState("");
  const [message, setMessage] = useState("");
  const [email, setEmail] = useState("");
  const [turnstileToken, setTurnstileToken] = useState("");
  const [website, setWebsite] = useState("");
  const [startedAt, setStartedAt] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const turnstileRef = useRef<TurnstileWidgetHandle>(null);

  const turnstileSiteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "";

  useEffect(() => {
    setStartedAt(Date.now());
  }, []);

  const messageLength = message.length;
  const isFormValid = useMemo(
    () =>
      who.length > 0 &&
      category.length > 0 &&
      message.trim().length > 0 &&
      turnstileToken.trim().length > 0,
    [who, category, message, turnstileToken]
  );

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!isFormValid || isSubmitting) return;

    setIsSubmitting(true);

    try {
      const response = await fetch("/contact/api", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          who,
          category,
          message: message.trim(),
          startedAt,
          website,
          turnstileToken,
          ...(email.trim().length > 0 ? { email: email.trim() } : {}),
        }),
      });

      const raw = (await response.json().catch(() => ({}))) as { message?: string; error?: string };
      if (!response.ok) {
        toast.error(raw.error ?? "Unable to submit right now. Please try again.");
        return;
      }

      toast.success(raw.message ?? "Thanks! Your message was sent.");
      setMessage("");
      setCategory("");
      setWho("");
      setWebsite("");
      turnstileRef.current?.reset();
      setStartedAt(Date.now());
    } catch {
      toast.error("Network issue detected. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleReset() {
    setWho("");
    setCategory("");
    setMessage("");
    setEmail("");
    setWebsite("");
    turnstileRef.current?.reset();
    setStartedAt(Date.now());
  }

  return (
    <div className="relative flex h-dvh flex-col bg-background text-foreground">
      <Toaster position="top-center" />
      <div className="chat-top-fade absolute left-0 right-0 top-0 z-[9] pointer-events-none" />

      <div className="chat-header absolute left-0 right-0 top-0 z-10 px-4 md:px-0">
        <header className="mx-auto flex w-full max-w-[600px] items-center gap-3 pt-8 pb-3">
          <button
            onClick={() => router.push("/")}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-secondary transition-colors hover:bg-secondary/80 dark:bg-[#2A2A2A] dark:hover:bg-[#333]"
            aria-label="Back to home"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
        </header>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-6 pt-24 md:px-0">
        <div className="mx-auto w-full max-w-[600px]">
          <Card className="gap-0 rounded-[10px] shadow-none">
            <CardHeader className="space-y-1 pb-4 px-3 sm:px-6">
              <div>
                <CardTitle className="text-2xl font-semibold">Contact Form</CardTitle>
                <CardDescription className="mt-1 text-base text-foreground">
                  We&apos;d love to hear what you think. Help us improve by sharing your feedback, or send an email to{" "}
                  <a
                    href="mailto:hello@bilauitmcuti.com"
                    className="text-primary underline-offset-4 hover:underline"
                  >
                    hello@bilauitmcuti.com
                  </a>
                </CardDescription>
              </div>
            </CardHeader>

            <CardContent className="pt-4 px-3 sm:px-6">
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <label htmlFor="who" className="text-sm font-semibold">
                    Who are you
                  </label>
                  <Select value={who} onValueChange={setWho}>
                    <SelectTrigger id="who" className="h-11 w-full justify-between bg-background">
                      <SelectValue placeholder="Select your role" />
                    </SelectTrigger>
                    <SelectContent>
                      {CONTACT_WHO_OPTIONS.map((option) => (
                        <SelectItem key={option} value={option}>
                          {option}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <label htmlFor="email" className="text-sm font-semibold">
                    Email address{" "}
                    <span className="font-normal text-muted-foreground">(optional)</span>
                  </label>
                  <input
                    id="email"
                    type="email"
                    inputMode="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    autoComplete="email"
                    className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none transition-none focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:border-ring disabled:cursor-not-allowed disabled:opacity-50 dark:bg-[#2A2A2A]"
                  />
                  <div className="text-xs text-muted-foreground">
                    Your email will only be used to follow up on your feedback. Leave it empty if you&apos;d prefer
                    not to receive a reply.
                  </div>
                </div>

                <div className="space-y-2">
                  <label htmlFor="category" className="text-sm font-semibold">
                    Category
                  </label>
                  <Select value={category} onValueChange={setCategory}>
                    <SelectTrigger id="category" className="h-11 w-full justify-between bg-background">
                      <SelectValue placeholder="Select a category" />
                    </SelectTrigger>
                    <SelectContent>
                      {CONTACT_CATEGORY_OPTIONS.map((option) => (
                        <SelectItem key={option} value={option}>
                          {option}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <label htmlFor="message" className="text-sm font-semibold">
                    Message
                  </label>
                  <Textarea
                    id="message"
                    value={message}
                    onChange={(event) => setMessage(event.target.value.slice(0, MAX_MESSAGE_LENGTH))}
                    maxLength={MAX_MESSAGE_LENGTH}
                    rows={6}
                    placeholder="Write your feedback or contact message..."
                    className="resize-none bg-background dark:bg-[#2A2A2A]"
                  />
                  <div className="text-xs text-muted-foreground">
                    {messageLength}/{MAX_MESSAGE_LENGTH} characters
                  </div>
                </div>

                <div className="space-y-2">
                  <TurnstileWidget
                    ref={turnstileRef}
                    siteKey={turnstileSiteKey}
                    action="contact_form"
                    onToken={setTurnstileToken}
                  />
                </div>

                <div className="hidden" aria-hidden>
                  <label htmlFor="website">Website</label>
                  <input
                    id="website"
                    name="website"
                    value={website}
                    onChange={(event) => setWebsite(event.target.value)}
                    autoComplete="off"
                    tabIndex={-1}
                  />
                </div>

                <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleReset}
                    disabled={isSubmitting}
                    className="w-full sm:w-auto"
                  >
                    Reset
                  </Button>
                  <Button type="submit" disabled={!isFormValid || isSubmitting} className="w-full sm:w-auto">
                    {isSubmitting ? "Submitting..." : "Submit"}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          <Card className="mt-4 gap-0 rounded-[10px] shadow-none">
            <CardHeader className="space-y-1 pb-4 px-3 sm:px-6">
              <CardTitle className="text-xl font-semibold">Become Our Sponsors</CardTitle>
              <CardDescription className="mt-1 text-base text-foreground">
                Support the project and help keep the calendar free for everyone.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-0 px-3 sm:px-6">
              <Button type="button" className="w-full sm:w-auto" onClick={() => router.push("/sponsor")}>
                Sponsor
              </Button>
            </CardContent>
          </Card>

        </div>
      </div>
    </div>
  );
}
