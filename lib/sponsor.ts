export const SPONSOR_SOCIAL_OPTIONS = [
  "Facebook",
  "Instagram",
  "Threads",
  "X",
  "Tiktok",
  "Website",
  "Others",
] as const;

export type SponsorSocialPlatform = (typeof SPONSOR_SOCIAL_OPTIONS)[number];

export const SPONSOR_MAX_MESSAGE_LENGTH = 2000;
/** Proof-of-payment upload cap (bytes). Document in README. */
export const SPONSOR_MAX_FILE_BYTES = 10 * 1024 * 1024;

export const SPONSOR_TURNSTILE_ACTION = "sponsor_form";
