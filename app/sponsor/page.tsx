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

export default function SponsorPage() {
  const router = useRouter();
  const [showQr, setShowQr] = useState(false);
  const [qrTurnstileToken, setQrTurnstileToken] = useState("");
  const [showQrChallenge, setShowQrChallenge] = useState(false);
  const [anonymous, setAnonymous] = useState(false);
  const [nickname, setNickname] = useState("");
  const [socialPlatform, setSocialPlatform] = useState<SponsorSocialPlatform | "">("");
  const [socialHandle, setSocialHandle] = useState("");
  const [message, setMessage] = useState("");
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [turnstileToken, setTurnstileToken] = useState("");
  const [website, setWebsite] = useState("");
  const [startedAt, setStartedAt] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const qrTurnstileRef = useRef<TurnstileWidgetHandle>(null);
  const formTurnstileRef = useRef<TurnstileWidgetHandle>(null);

  const turnstileSiteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "";
  const turnstileExecution =
    process.env.NEXT_PUBLIC_TURNSTILE_EXECUTION === "execute" ? "execute" : "render";

  useEffect(() => {
    setStartedAt(Date.now());
  }, []);

  const messageLength = message.length;

  const isFormValid = useMemo(() => {
    const base =
      message.trim().length > 0 &&
      proofFile !== null &&
      turnstileToken.trim().length > 0;
    if (anonymous) return base;
    return (
      base &&
      nickname.trim().length > 0 &&
      socialPlatform !== "" &&
      socialHandle.trim().length > 0
    );
  }, [anonymous, nickname, socialPlatform, socialHandle, message, proofFile, turnstileToken]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!isFormValid || isSubmitting) return;

    setIsSubmitting(true);

    try {
      const formData = new FormData();
      formData.append("anonymous", anonymous ? "true" : "false");
      formData.append("nickname", anonymous ? "" : nickname.trim());
      formData.append("socialPlatform", anonymous ? "" : socialPlatform);
      formData.append("socialHandle", anonymous ? "" : socialHandle.trim());
      formData.append("message", message.trim());
      formData.append("turnstileToken", turnstileToken);
      formData.append("startedAt", String(startedAt));
      formData.append("website", website);
      if (proofFile) formData.append("proof", proofFile);

      const response = await fetch("/sponsor/api", {
        method: "POST",
        body: formData,
      });

      const raw = (await response.json().catch(() => ({}))) as { message?: string; error?: string };
      if (!response.ok) {
        toast.error(raw.error ?? "Unable to submit right now. Please try again.");
        return;
      }

      toast.success(raw.message ?? "Thanks! Your submission was received.");
      setMessage("");
      setNickname("");
      setSocialPlatform("");
      setSocialHandle("");
      setProofFile(null);
      setAnonymous(false);
      setWebsite("");
      setShowQr(false);
      setQrTurnstileToken("");
      setShowQrChallenge(false);
      formTurnstileRef.current?.reset();
      qrTurnstileRef.current?.reset();
      setStartedAt(Date.now());
    } catch {
      toast.error("Network issue detected. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleReset() {
    setShowQr(false);
    setQrTurnstileToken("");
    setShowQrChallenge(false);
    setAnonymous(false);
    setNickname("");
    setSocialPlatform("");
    setSocialHandle("");
    setMessage("");
    setProofFile(null);
    setWebsite("");
    formTurnstileRef.current?.reset();
    qrTurnstileRef.current?.reset();
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
                <CardTitle className="text-2xl font-semibold">Sponsor</CardTitle>
                <CardDescription className="mt-1 text-base text-foreground">
                  Thank you for supporting Bila UiTM Cuti. Use the payment QR below, then submit your details and proof
                  of payment.
                </CardDescription>
              </div>
            </CardHeader>

            <CardContent className="px-3 sm:px-6">
              <p className="mb-4 text-sm text-muted-foreground">
                By sponsoring this project, your name and social media link will be featured as a token of our
                appreciation. Contributions help cover hosting, domain, and development tool costs.
              </p>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full sm:w-auto"
                    onClick={() => {
                      if (showQr) {
                        setShowQr(false);
                        return;
                      }
                      if (!qrTurnstileToken.trim()) {
                        setShowQrChallenge(true);
                        toast.info("Complete the verification challenge to view the payment QR.");
                        return;
                      }
                      setShowQr(true);
                    }}
                  >
                    {showQr ? "Hide payment QR" : "Show payment QR"}
                  </Button>
                  {showQrChallenge && !qrTurnstileToken.trim() ? (
                    <div className="space-y-1">
                      <TurnstileWidget
                        ref={qrTurnstileRef}
                        siteKey={turnstileSiteKey}
                        action="sponsor_qr_view"
                        execution={turnstileExecution}
                        onToken={(token) => {
                          setQrTurnstileToken(token);
                          if (token.trim()) setShowQr(true);
                        }}
                      />
                      <div className="text-xs text-muted-foreground">
                        Verify once to unlock the QR.
                      </div>
                    </div>
                  ) : null}
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

                <div className="space-y-2">
                  <label htmlFor="nickname" className="text-sm font-semibold">
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

                <div className="space-y-2">
                  <label htmlFor="socialPlatform" className="text-sm font-semibold">
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
                    <SelectContent>
                      {SPONSOR_SOCIAL_OPTIONS.map((option) => (
                        <SelectItem key={option} value={option}>
                          {option}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {!anonymous && socialPlatform ? (
                  <div className="space-y-2">
                    <label htmlFor="socialHandle" className="text-sm font-semibold">
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

                <div className="space-y-2">
                  <label htmlFor="message" className="text-sm font-semibold">
                    Message
                  </label>
                  <Textarea
                    id="message"
                    value={message}
                    onChange={(e) => setMessage(e.target.value.slice(0, SPONSOR_MAX_MESSAGE_LENGTH))}
                    maxLength={SPONSOR_MAX_MESSAGE_LENGTH}
                    rows={6}
                    placeholder="Share your message of support"
                    className="resize-none bg-background dark:bg-[#2A2A2A]"
                  />
                  <div className="text-xs text-muted-foreground">
                    {messageLength}/{SPONSOR_MAX_MESSAGE_LENGTH} characters
                  </div>
                </div>

                <div className="space-y-2">
                  <label htmlFor="proof" className="text-sm font-semibold">
                    Proof of payment
                  </label>
                  <input
                    key={`proof-${startedAt}`}
                    id="proof"
                    type="file"
                    accept="image/*,application/pdf"
                    onChange={(e) => setProofFile(e.target.files?.[0] ?? null)}
                    className="block w-full text-sm text-muted-foreground file:mr-3 file:rounded-md file:border file:border-border file:bg-secondary file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-foreground"
                  />
                  <div className="text-xs text-muted-foreground">Image or PDF, max 10 MB.</div>
                </div>

                <div className="space-y-2">
                  <TurnstileWidget
                    ref={formTurnstileRef}
                    siteKey={turnstileSiteKey}
                    action={SPONSOR_TURNSTILE_ACTION}
                    execution={turnstileExecution}
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
