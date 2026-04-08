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
import {
  TurnstileWidget,
  type TurnstileWidgetHandle,
} from "@/components/turnstile-widget";
import {
  SPONSOR_MAX_MESSAGE_LENGTH,
  SPONSOR_SOCIAL_OPTIONS,
  SPONSOR_TURNSTILE_ACTION,
} from "@/lib/sponsor";
import type { SponsorSocialPlatform } from "@/lib/sponsor";

const QR_IMAGE_SRC = "/sponsor-qr.png";
const SPONSOR_TURNSTILE_COOKIE = "sponsor_turnstile_verified";

export default function SponsorPage() {
  const router = useRouter();
  const [headerVisible, setHeaderVisible] = useState(true);
  const [showQr, setShowQr] = useState(false);
  const [anonymous, setAnonymous] = useState(false);
  const [nickname, setNickname] = useState("");
  const [socialPlatform, setSocialPlatform] = useState<SponsorSocialPlatform | "">("");
  const [socialHandle, setSocialHandle] = useState("");
  const [message, setMessage] = useState("");
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [turnstileToken, setTurnstileToken] = useState("");
  const [formTurnstileNonce, setFormTurnstileNonce] = useState(0);
  const [isTurnstileSessionVerified, setIsTurnstileSessionVerified] = useState(false);
  const [website, setWebsite] = useState("");
  const [startedAt, setStartedAt] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [pendingSubmit, setPendingSubmit] = useState(false);
  const [pendingShowQr, setPendingShowQr] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const lastScrollTop = useRef(0);
  const formTurnstileRef = useRef<TurnstileWidgetHandle>(null);

  const isProduction = process.env.NODE_ENV === "production";
  const turnstileSiteKey = isProduction ? (process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "") : "";
  const requiresTurnstile = Boolean(turnstileSiteKey) && !isTurnstileSessionVerified;

  useEffect(() => {
    setStartedAt(Date.now());
  }, []);

  useEffect(() => {
    if (typeof document === "undefined") return;
    const hasVerifiedCookie = document.cookie
      .split(";")
      .some((item) => item.trim().startsWith(`${SPONSOR_TURNSTILE_COOKIE}=1`));
    if (hasVerifiedCookie) setIsTurnstileSessionVerified(true);
  }, []);

  const messageLength = message.length;

  const isFormValid = useMemo(() => {
    const base =
      message.trim().length > 0 &&
      proofFile !== null;
    if (anonymous) return base;
    return (
      base &&
      nickname.trim().length > 0 &&
      socialPlatform !== "" &&
      socialHandle.trim().length > 0
    );
  }, [anonymous, nickname, socialPlatform, socialHandle, message, proofFile]);

  const submitSponsorForm = useCallback(async () => {
    if (!isFormValid || isSubmitting) return;
    if (requiresTurnstile && !turnstileToken.trim()) return;
    setIsSubmitting(true);

    try {
      const formData = new FormData();
      formData.append("anonymous", anonymous ? "true" : "false");
      formData.append("nickname", anonymous ? "" : nickname.trim());
      formData.append("socialPlatform", anonymous ? "" : socialPlatform);
      formData.append("socialHandle", anonymous ? "" : socialHandle.trim());
      formData.append("message", message.trim());
      if (requiresTurnstile) formData.append("turnstileToken", turnstileToken);
      formData.append("startedAt", String(startedAt));
      formData.append("website", website);
      if (proofFile) formData.append("proof", proofFile);

      const response = await fetch("/sponsor/api", {
        method: "POST",
        body: formData,
      });

      const raw = (await response.json().catch(() => ({}))) as { message?: string; error?: string };
      if (!response.ok) {
        if (response.status === 403) {
          setIsTurnstileSessionVerified(false);
          setTurnstileToken("");
          setFormTurnstileNonce((prev) => prev + 1);
        }
        toast.error(raw.error ?? "Unable to submit right now. Please try again.");
        return;
      }

      toast.success(raw.message ?? "Thanks! Your submission was received.");
      setIsTurnstileSessionVerified(true);
      setMessage("");
      setNickname("");
      setSocialPlatform("");
      setSocialHandle("");
      setProofFile(null);
      setAnonymous(false);
      setWebsite("");
      setShowQr(false);
      setPendingShowQr(false);
      setTurnstileToken("");
      setFormTurnstileNonce((prev) => prev + 1);
      setStartedAt(Date.now());
    } catch {
      toast.error("Network issue detected. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }, [
    anonymous,
    isFormValid,
    isSubmitting,
    message,
    nickname,
    proofFile,
    socialHandle,
    socialPlatform,
    startedAt,
    requiresTurnstile,
    turnstileToken,
    website,
  ]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!isFormValid || isSubmitting) return;
    if (requiresTurnstile && !turnstileToken.trim()) {
      setPendingSubmit(true);
      formTurnstileRef.current?.execute();
      return;
    }
    await submitSponsorForm();
  }

  useEffect(() => {
    if (!pendingSubmit || !turnstileToken.trim() || isSubmitting) return;
    setPendingSubmit(false);
    void submitSponsorForm();
  }, [pendingSubmit, requiresTurnstile, turnstileToken, isSubmitting, submitSponsorForm]);

  useEffect(() => {
    if (!pendingShowQr || !turnstileToken.trim()) return;
    setPendingShowQr(false);
    setShowQr(true);
  }, [pendingShowQr, turnstileToken]);

  function handleReset() {
    setShowQr(false);
    setAnonymous(false);
    setNickname("");
    setSocialPlatform("");
    setSocialHandle("");
    setMessage("");
    setProofFile(null);
    setWebsite("");
    setTurnstileToken("");
    setPendingSubmit(false);
    setPendingShowQr(false);
    setFormTurnstileNonce((prev) => prev + 1);
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
                <CardTitle className="text-2xl font-semibold">Sponsor</CardTitle>
                <CardDescription className="mt-1 text-sm text-foreground">
                  Thank you for supporting Bila UiTM Cuti. Use the payment QR below, then submit your details and proof
                  of payment.
                </CardDescription>
              </div>
            </CardHeader>

            <CardContent className="px-3 sm:px-6">
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full sm:w-auto h-[38px]"
                    onClick={() => {
                      if (showQr) {
                        setShowQr(false);
                        return;
                      }
                      if (requiresTurnstile && !turnstileToken.trim()) {
                        setPendingShowQr(true);
                        formTurnstileRef.current?.execute();
                        return;
                      }
                      setShowQr(true);
                    }}
                  >
                    {showQr ? "Hide payment QR" : "Show QR Payment"}
                  </Button>
                  {showQr ? (
                    <div className="pt-1">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={QR_IMAGE_SRC}
                        alt="Payment QR code"
                        className="mx-auto w-full max-w-[520px] object-contain"
                      />
                    </div>
                  ) : null}
                </div>

                <div className="flex items-center gap-2">
                  <input
                    id="anonymous"
                    type="checkbox"
                    checked={anonymous}
                    onChange={(e) => {
                      const checked = e.target.checked;
                      setAnonymous(checked);
                      if (checked) {
                        setNickname("");
                        setSocialPlatform("");
                        setSocialHandle("");
                      }
                    }}
                    className="size-4 rounded border-border"
                  />
                  <label htmlFor="anonymous" className="text-sm font-semibold">
                    Submit as anonymous
                  </label>
                </div>

                <div>
                  <label htmlFor="nickname" className="mb-3 block text-sm font-semibold">
                    Nickname
                  </label>
                  <input
                    id="nickname"
                    type="text"
                    value={nickname}
                    onChange={(e) => setNickname(e.target.value)}
                    disabled={anonymous}
                    autoComplete="nickname"
                    placeholder="How we should refer to you"
                    className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none transition-none focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:border-ring disabled:cursor-not-allowed disabled:opacity-50 dark:bg-[#2A2A2A]"
                  />
                </div>

                <div>
                  <label htmlFor="socialPlatform" className="mb-3 block text-sm font-semibold">
                    Social media
                  </label>
                  <Select
                    disabled={anonymous}
                    value={anonymous ? undefined : socialPlatform || undefined}
                    onValueChange={(v) => setSocialPlatform(v as SponsorSocialPlatform)}
                  >
                    <SelectTrigger
                      id="socialPlatform"
                      className="h-11 w-full justify-between bg-background disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <SelectValue placeholder={anonymous ? "Not applicable" : "Select platform"} />
                    </SelectTrigger>
                    <SelectContent
                      position="popper"
                      sideOffset={6}
                      align="start"
                      className="w-[var(--radix-select-trigger-width)]"
                    >
                      {SPONSOR_SOCIAL_OPTIONS.map((option) => (
                        <SelectItem key={option} value={option}>
                          {option}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {!anonymous && socialPlatform ? (
                  <div>
                    <label htmlFor="socialHandle" className="mb-3 block text-sm font-semibold">
                      URL or username
                    </label>
                    <input
                      id="socialHandle"
                      type="text"
                      value={socialHandle}
                      onChange={(e) => setSocialHandle(e.target.value)}
                      placeholder={
                        socialPlatform === "Website"
                          ? "https://..."
                          : "@username or profile link"
                      }
                      className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none transition-none focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:border-ring dark:bg-[#2A2A2A]"
                    />
                  </div>
                ) : null}

                <div>
                  <label htmlFor="message" className="mb-3 block text-sm font-semibold">
                    Message
                  </label>
                  <Textarea
                    id="message"
                    value={message}
                    onChange={(e) => setMessage(e.target.value.slice(0, SPONSOR_MAX_MESSAGE_LENGTH))}
                    maxLength={SPONSOR_MAX_MESSAGE_LENGTH}
                    rows={6}
                    placeholder="Share your message of support"
                    className="resize-none bg-background text-sm placeholder:text-sm dark:bg-[#2A2A2A]"
                  />
                  <div className="mt-2 text-xs text-muted-foreground">
                    {messageLength}/{SPONSOR_MAX_MESSAGE_LENGTH} characters
                  </div>
                </div>

                <div>
                  <label htmlFor="proof" className="mb-3 block text-sm font-semibold">
                    Proof of payment
                  </label>
                  <input
                    key={`proof-${startedAt}`}
                    id="proof"
                    type="file"
                    accept="image/*,application/pdf"
                    onChange={(e) => setProofFile(e.target.files?.[0] ?? null)}
                    className="block w-full text-sm text-muted-foreground file:mr-3 file:h-[38px] file:rounded-md file:border file:border-border file:bg-secondary file:px-3 file:text-sm file:font-medium file:text-foreground"
                  />
                  <div className="mt-2 text-xs text-muted-foreground">Image or PDF, max 10 MB.</div>
                </div>

                {requiresTurnstile ? (
                  <div className="space-y-2">
                    <TurnstileWidget
                      ref={formTurnstileRef}
                      key={formTurnstileNonce}
                      siteKey={turnstileSiteKey}
                      action={SPONSOR_TURNSTILE_ACTION}
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
                  <Button type="submit" disabled={!isFormValid || isSubmitting} className="w-full sm:w-auto h-[38px]">
                    {isSubmitting ? "Submitting..." : "Submit"}
                  </Button>
                </div>
              </form>
              <p className="mt-4 text-sm text-muted-foreground">
                By sponsoring this project, your name and social media link will be featured as a token of our
                appreciation. Contributions help cover hosting, domain, and development tool costs.
              </p>
            </CardContent>
          </Card>

          <section className="pt-6 text-center">
            <h2 className="text-xl font-semibold">Our Sponsors</h2>
            <h3 className="mt-2 text-lg font-medium">
              <a
                href="https://www.threads.com/@arezmie"
                target="_blank"
                rel="noopener noreferrer"
                className="underline-offset-4 hover:underline"
              >
                @arezmie
              </a>
            </h3>
          </section>
        </div>
      </div>
    </div>
  );
}
