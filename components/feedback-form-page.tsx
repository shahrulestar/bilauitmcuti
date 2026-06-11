"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import { StarRating } from "@/components/star-rating";
import { useTurnstileSiteKey } from "@/hooks/use-turnstile-site-key";

const MAX_MESSAGE_LENGTH = 400;
const FEEDBACK_TURNSTILE_COOKIE = "contact_turnstile_verified";

export function FeedbackFormPage({
  initialTurnstileSiteKey = "",
}: {
  initialTurnstileSiteKey?: string;
}) {
  const router = useRouter();
  const [headerVisible, setHeaderVisible] = useState(true);
  const [who, setWho] = useState("");
  const [category, setCategory] = useState("");
  const [message, setMessage] = useState("");
  const [rating, setRating] = useState(0);
  const [email, setEmail] = useState("");
  const [turnstileToken, setTurnstileToken] = useState("");
  const [turnstileNonce, setTurnstileNonce] = useState(0);
  const [isTurnstileSessionVerified, setIsTurnstileSessionVerified] = useState(false);
  const [website, setWebsite] = useState("");
  const [startedAt, setStartedAt] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [pendingSubmit, setPendingSubmit] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const lastScrollTop = useRef(0);
  const turnstileRef = useRef<TurnstileWidgetHandle>(null);

  const { siteKey: turnstileSiteKey, isReady: isTurnstileConfigReady } =
    useTurnstileSiteKey(initialTurnstileSiteKey);
  const requiresTurnstile = Boolean(turnstileSiteKey) && !isTurnstileSessionVerified;
  const waitForTurnstileConfig =
    process.env.NODE_ENV === "production" && !isTurnstileConfigReady;

  useEffect(() => {
    setStartedAt(Date.now());
  }, []);

  useEffect(() => {
    if (typeof document === "undefined") return;
    const hasVerifiedCookie = document.cookie
      .split(";")
      .some((item) => item.trim().startsWith(`${FEEDBACK_TURNSTILE_COOKIE}=1`));
    if (hasVerifiedCookie) setIsTurnstileSessionVerified(true);
  }, []);

  const messageLength = message.length;
  const isFormValid = useMemo(
    () =>
      who.length > 0 &&
      category.length > 0 &&
      rating >= 1 &&
      rating <= 5 &&
      message.trim().length > 0,
    [who, category, message, rating]
  );

  const submitFeedbackForm = useCallback(async () => {
    if (!isFormValid || isSubmitting) return;
    if (requiresTurnstile && !turnstileToken.trim()) return;
    setIsSubmitting(true);

    try {
      const response = await fetch("/feedback/api", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          who,
          category,
          message: message.trim(),
          startedAt,
          website,
          turnstileToken: requiresTurnstile ? turnstileToken : undefined,
          rating,
          ...(email.trim().length > 0 ? { email: email.trim() } : {}),
        }),
      });

      const raw = (await response.json().catch(() => ({}))) as { message?: string; error?: string };
      if (!response.ok) {
        if (response.status === 403) {
          setIsTurnstileSessionVerified(false);
          setTurnstileToken("");
          setTurnstileNonce((prev) => prev + 1);
        }
        toast.error(raw.error ?? "Unable to submit right now. Please try again.");
        return;
      }

      toast.success(raw.message ?? "Thanks! Your feedback was sent.");
      setIsTurnstileSessionVerified(true);
      setMessage("");
      setCategory("");
      setWho("");
      setRating(0);
      setWebsite("");
      setTurnstileToken("");
      setTurnstileNonce((prev) => prev + 1);
      setStartedAt(Date.now());
    } catch {
      toast.error("Network issue detected. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }, [
    category,
    email,
    isFormValid,
    isSubmitting,
    message,
    rating,
    requiresTurnstile,
    startedAt,
    turnstileToken,
    website,
    who,
  ]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!isFormValid || isSubmitting || waitForTurnstileConfig) return;
    if (requiresTurnstile && !turnstileToken.trim()) {
      setPendingSubmit(true);
      turnstileRef.current?.execute();
      return;
    }
    await submitFeedbackForm();
  }

  useEffect(() => {
    if (!pendingSubmit || !turnstileToken.trim() || isSubmitting) return;
    setPendingSubmit(false);
    void submitFeedbackForm();
  }, [pendingSubmit, requiresTurnstile, turnstileToken, isSubmitting, submitFeedbackForm]);

  function handleReset() {
    setWho("");
    setCategory("");
    setMessage("");
    setEmail("");
    setRating(0);
    setWebsite("");
    setTurnstileToken("");
    setPendingSubmit(false);
    setTurnstileNonce((prev) => prev + 1);
    setStartedAt(Date.now());
  }

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
      <Toaster position="top-center" />
      <div className="chat-top-fade absolute left-0 right-0 top-0 z-[9] pointer-events-none" />

      <div
        className={`chat-header absolute left-0 right-0 top-0 z-10 px-4 transition-transform md:px-0 ${
          headerVisible ? "translate-y-0" : "-translate-y-full"
        }`}
      >
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

      <div
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto px-4 pb-6 pt-24 md:px-0"
      >
        <div className="mx-auto w-full max-w-[600px]">
          <Card className="gap-0 rounded-[10px] shadow-none">
            <CardHeader className="space-y-1 pb-4 px-3 sm:px-6">
              <div>
                <CardTitle className="text-2xl font-semibold">Feedback Form</CardTitle>
                <CardDescription className="mt-1 text-sm text-foreground">
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

            <CardContent className="px-3 sm:px-6">
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label htmlFor="who" className="mb-3 block text-sm font-semibold">
                    Who are you
                  </label>
                  <Select value={who} onValueChange={setWho}>
                    <SelectTrigger id="who" className="h-11 w-full justify-between bg-background shadow-none">
                      <SelectValue placeholder="Select your role" />
                    </SelectTrigger>
                    <SelectContent
                      position="popper"
                      sideOffset={6}
                      align="start"
                      className="w-[var(--radix-select-trigger-width)]"
                    >
                      {CONTACT_WHO_OPTIONS.map((option) => (
                        <SelectItem key={option} value={option}>
                          {option}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label htmlFor="email" className="mb-3 block text-sm font-semibold">
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
                    className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm shadow-none outline-none transition-none focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:border-ring disabled:cursor-not-allowed disabled:opacity-50 dark:bg-[#2A2A2A]"
                  />
                  <div className="mt-2 text-xs text-muted-foreground">
                    Your email will only be used to follow up on your feedback. Leave it empty if you&apos;d prefer
                    not to receive a reply.
                  </div>
                </div>

                <div>
                  <label htmlFor="category" className="mb-3 block text-sm font-semibold">
                    Category
                  </label>
                  <Select value={category} onValueChange={setCategory}>
                    <SelectTrigger id="category" className="h-11 w-full justify-between bg-background shadow-none">
                      <SelectValue placeholder="Select a category" />
                    </SelectTrigger>
                    <SelectContent
                      position="popper"
                      sideOffset={6}
                      align="start"
                      className="w-[var(--radix-select-trigger-width)]"
                    >
                      {CONTACT_CATEGORY_OPTIONS.map((option) => (
                        <SelectItem key={option} value={option}>
                          {option}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="mb-3 block text-sm font-semibold">Rating</label>
                  <StarRating
                    rating={rating}
                    onRatingChange={setRating}
                    disabled={isSubmitting}
                  />
                </div>

                <div>
                  <label htmlFor="message" className="mb-3 block text-sm font-semibold">
                    Feedback
                  </label>
                  <Textarea
                    id="message"
                    value={message}
                    onChange={(event) => setMessage(event.target.value.slice(0, MAX_MESSAGE_LENGTH))}
                    maxLength={MAX_MESSAGE_LENGTH}
                    rows={6}
                    placeholder="Write your feedback..."
                    className="resize-none bg-background text-sm shadow-none placeholder:text-sm dark:bg-[#2A2A2A]"
                  />
                  <div className="mt-2 text-xs text-muted-foreground">
                    {messageLength}/{MAX_MESSAGE_LENGTH} characters
                  </div>
                </div>

                {requiresTurnstile ? (
                  <div className="space-y-2">
                    <TurnstileWidget
                      ref={turnstileRef}
                      key={turnstileNonce}
                      siteKey={turnstileSiteKey}
                      action="contact_form"
                      onToken={setTurnstileToken}
                    />
                  </div>
                ) : null}

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
                    className="w-full sm:w-auto h-[38px]"
                  >
                    Reset
                  </Button>
                  <Button
                    type="submit"
                    disabled={!isFormValid || isSubmitting || waitForTurnstileConfig}
                    className="w-full sm:w-auto h-[38px]"
                  >
                    {isSubmitting ? "Submitting..." : "Submit"}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          <Card className="mt-4 gap-0 rounded-[10px] shadow-none">
            <CardHeader className="space-y-1 pb-4 px-3 sm:px-6">
              <CardTitle className="text-xl font-semibold">Become Our Sponsors</CardTitle>
              <CardDescription className="mt-1 text-sm text-foreground">
                Support the project and help keep the calendar free for everyone.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-0 px-3 sm:px-6">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <Button asChild className="w-full sm:w-auto h-[38px]">
                  <a
                    href="https://shahrulestar.com/sponsor"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Sponsor
                  </a>
                </Button>
                <Button variant="outline" asChild className="w-full sm:w-auto h-[38px]">
                  <a
                    href="https://github.com/sponsors/shahrulestar"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Github Sponsor
                  </a>
                </Button>
              </div>
            </CardContent>
          </Card>

        </div>
      </div>
    </div>
  );
}
