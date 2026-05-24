import type { Metadata } from "next";
import {
  buildCalendarAbsoluteUrl,
  parseSessionIdsFromSearchParams,
} from "@/lib/session-query";
import {
  getProgramCanonicalUrl,
  getProgramListCanonicalUrl,
  getProgramPageTitle,
  getProgramSeoDescription,
} from "@/lib/program-seo";
import { isValidProgramRoute } from "@/lib/route-utils";

const SITE_ORIGIN = "https://bilauitmcuti.com";
const GRID_COVER = `${SITE_ORIGIN}/all-cover.png`;
const LIST_COVER = `${SITE_ORIGIN}/list-cover.png`;

type SearchParamsInput =
  | URLSearchParams
  | Record<string, string | string[] | undefined>
  | undefined;

function toURLSearchParams(input: SearchParamsInput): URLSearchParams {
  if (!input) return new URLSearchParams();
  if (input instanceof URLSearchParams) return input;
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(input)) {
    if (value === undefined) continue;
    if (Array.isArray(value)) {
      for (const item of value) params.append(key, item);
    } else {
      params.set(key, value);
    }
  }
  return params;
}

export interface CalendarSeoOptions {
  pathname: string;
  viewMode: "grid" | "list";
  programSlug?: string;
  searchParams?: SearchParamsInput;
}

export function buildCalendarPageMetadata(options: CalendarSeoOptions): Metadata {
  const { pathname, viewMode, programSlug } = options;
  const params = toURLSearchParams(options.searchParams);
  const sessionIds = parseSessionIdsFromSearchParams(params);
  const ogUrl = buildCalendarAbsoluteUrl(pathname, sessionIds);
  const isList = viewMode === "list";
  const coverImage = isList ? LIST_COVER : GRID_COVER;

  let title: string;
  let description: string;
  let canonical: string;

  if (programSlug && isValidProgramRoute(programSlug)) {
    title = getProgramPageTitle(programSlug);
    description = getProgramSeoDescription(programSlug);
    canonical = isList
      ? getProgramListCanonicalUrl(programSlug)
      : getProgramCanonicalUrl(programSlug);
  } else if (isList) {
    title = "Bila UiTM Cuti - Kalendar Akademik";
    description =
      "Interactive UiTM academic calendar. View registration dates, lecture schedules, examination periods, and breaks.";
    canonical = `${SITE_ORIGIN}/list`;
  } else {
    title = "Bila UiTM Cuti - Kalendar Akademik";
    description =
      "Kalendar akademik UiTM interaktif. Lihat jadual pendaftaran, kuliah, peperiksaan, dan cuti semester.";
    canonical = SITE_ORIGIN;
  }

  const metadata: Metadata = {
    title,
    description,
    alternates: { canonical },
    openGraph: {
      siteName: "Bila UiTM Cuti",
      title,
      description,
      type: "website",
      url: ogUrl,
      locale: "ms_MY",
      images: [
        {
          url: coverImage,
          width: 1200,
          height: 630,
          alt: title,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [coverImage],
    },
  };

  if (isList) {
    metadata.robots = { index: false, follow: true };
  }

  return metadata;
}
