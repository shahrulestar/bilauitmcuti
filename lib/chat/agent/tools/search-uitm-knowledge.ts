import uitmInfoData from "@/lib/uitm-info.json";
import { truncateToolOutput } from "@/lib/chat/agent/types";

interface SearchSection {
  id: string;
  title: string;
  body: string;
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2);
}

function buildSections(): SearchSection[] {
  const data = uitmInfoData as Record<string, unknown>;
  const sections: SearchSection[] = [];

  const push = (id: string, title: string, body: string) => {
    const trimmed = body.trim();
    if (trimmed) sections.push({ id, title, body: trimmed });
  };

  const about = data.about as Record<string, unknown> | undefined;
  if (about) {
    push(
      "about",
      "About UiTM",
      [
        String(about.name ?? ""),
        String(about.description ?? ""),
        `Vision: ${about.vision ?? ""}`,
        `Mission: ${about.mission ?? ""}`,
        `Students: ${about.students ?? ""}`,
        `Programmes: ${about.programmes ?? ""}`,
      ].join("\n")
    );
  }

  const history = data.history as Array<{ year?: number | string; event?: string; note?: string }> | undefined;
  if (history?.length) {
    push(
      "history",
      "History",
      history
        .map((h) => (h.note ? `- ${h.note}` : h.year && h.event ? `- ${h.year}: ${h.event}` : ""))
        .filter(Boolean)
        .join("\n")
    );
  }

  const campuses = data.campuses as Record<string, unknown> | undefined;
  if (campuses) {
    const lines = [
      `Main: ${campuses.main ?? ""}`,
      `Network: ${campuses.network ?? ""}`,
    ];
    const byState = campuses.byState as Record<string, string> | undefined;
    if (byState) {
      for (const [state, info] of Object.entries(byState)) {
        lines.push(`- ${state}: ${info}`);
      }
    }
    push("campuses", "Campuses", lines.join("\n"));
  }

  const faculties = data.faculties as Record<string, string[]> | undefined;
  if (faculties) {
    const lines: string[] = [];
    for (const [key, items] of Object.entries(faculties)) {
      if (!Array.isArray(items)) continue;
      lines.push(`${key}:`);
      items.forEach((f) => lines.push(`- ${f}`));
    }
    push("faculties", "Faculties", lines.join("\n"));
  }

  const programmes = data.programmes as { levels?: Array<{ name: string; duration?: string; note?: string; details?: string }> } | undefined;
  if (programmes?.levels?.length) {
    push(
      "programmes",
      "Programmes",
      programmes.levels
        .map((p) => {
          let line = `- ${p.name}`;
          if (p.duration) line += ` (${p.duration})`;
          if (p.note) line += ` — ${p.note}`;
          if (p.details) line += ` — ${p.details}`;
          return line;
        })
        .join("\n")
    );
  }

  const admission = data.admission as Record<string, unknown> | undefined;
  if (admission) {
    const channels = admission.channels as string[] | undefined;
    push(
      "admission",
      "Admission",
      [
        channels?.length ? `Channels:\n${channels.map((c) => `- ${c}`).join("\n")}` : "",
        admission.note ? String(admission.note) : "",
      ]
        .filter(Boolean)
        .join("\n")
    );
  }

  const contact = data.contact as Record<string, string> | undefined;
  if (contact) {
    push("contact", "Contact", Object.entries(contact).map(([k, v]) => `${k}: ${v}`).join("\n"));
  }

  const portals = data.portals as Record<string, string> | undefined;
  if (portals) {
    push("portals", "Portals", Object.entries(portals).map(([k, v]) => `${k}: ${v}`).join("\n"));
  }

  return sections;
}

const SECTIONS = buildSections();

export function searchUitmKnowledge(query: string, maxSections = 3): string {
  const qTokens = new Set(tokenize(query));
  if (qTokens.size === 0) {
    return truncateToolOutput(
      SECTIONS.slice(0, 2)
        .map((s) => `=== ${s.title} ===\n${s.body}`)
        .join("\n\n")
    );
  }

  const scored = SECTIONS.map((section) => {
    const textTokens = tokenize(`${section.title} ${section.body}`);
    let score = 0;
    for (const t of textTokens) {
      if (qTokens.has(t)) score += 1;
    }
    return { section, score };
  })
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score);

  const picked =
    scored.length > 0 ? scored.slice(0, maxSections) : [{ section: SECTIONS[0]!, score: 0 }];

  const block = picked
    .map(({ section }) => `=== ${section.title} ===\n${section.body}`)
    .join("\n\n");

  return truncateToolOutput(block || "(no UiTM knowledge matched — say you do not have that detail)");
}
