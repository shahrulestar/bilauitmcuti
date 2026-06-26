import Link from "next/link";
import { SITE_ORIGIN } from "@/lib/page-seo";

const INTERNSHIP_URL = `${SITE_ORIGIN}/internship`;

export function CalendarInternshipFooter() {
  return (
    <footer
      className="mt-8 border-t border-border pt-6 standalone:hidden"
      aria-label="Internship promotion"
    >
      <p
        className="flex flex-wrap items-center justify-center gap-x-1 text-balance text-center text-sm font-medium text-foreground sm:flex-nowrap"
      >
        <span>
          Discover internship opportunities from multiple sources across Malaysia
          on Find My Internship.
        </span>
        <Link
          href={INTERNSHIP_URL}
          className="shrink-0 text-primary underline underline-offset-2 hover:underline"
        >
          Try it now
        </Link>
      </p>
    </footer>
  );
}
