"use client";

import type React from "react";
import {
  isMarkdownTableSeparator,
  isPipeTableRow,
  isTableCaptionRow,
  parsePipeTableBlock,
} from "@/lib/format-ai-table";
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/table";

function parseTable(block: string): { headers: string[]; rows: string[][] } | null {
  return parsePipeTableBlock(block);
}

/**
 * Finds GitHub-style markdown tables embedded in plain text (models often emit these
 * instead of [TABLE]...[/TABLE]). Returns ordered text + table segments.
 */
function splitEmbeddedMarkdownTables(part: string): { type: "text" | "table"; body: string }[] {
  const rawLines = part.split(/\r?\n/);
  const segments: { type: "text" | "table"; body: string }[] = [];
  const textBuf: string[] = [];
  let i = 0;

  function flushText() {
    if (textBuf.length === 0) return;
    const body = textBuf.join("\n");
    textBuf.length = 0;
    if (body.trim()) segments.push({ type: "text", body });
  }

  while (i < rawLines.length) {
    const line = rawLines[i]?.replace(/\r$/, "") ?? "";
    const line2 = rawLines[i + 1]?.replace(/\r$/, "");
    const line3 = rawLines[i + 2]?.replace(/\r$/, "");

    const hasSeparatorTable =
      line2 !== undefined &&
      line3 !== undefined &&
      isMarkdownTableSeparator(line2) &&
      isPipeTableRow(line3) &&
      !isMarkdownTableSeparator(line3);

    if (hasSeparatorTable) {
      flushText();
      if (line.trim() && (isTableCaptionRow(line) || !isPipeTableRow(line))) {
        const caption = line.includes("|")
          ? line
              .replace(/^\|+|\|+$/g, "")
              .split("|")
              .map((c) => c.trim())
              .filter(Boolean)[0] ?? line.trim()
          : line.trim();
        if (caption) textBuf.push(caption);
        flushText();
      } else if (
        line.trim() &&
        isPipeTableRow(line) &&
        !isTableCaptionRow(line) &&
        !isMarkdownTableSeparator(line)
      ) {
        const tableLines: string[] = [line, line2];
        i += 2;
        while (i < rawLines.length) {
          const L = rawLines[i]?.replace(/\r$/, "") ?? "";
          if (!L.trim()) break;
          if (isPipeTableRow(L)) {
            tableLines.push(L);
            i++;
          } else break;
        }
        segments.push({ type: "table", body: tableLines.join("\n") });
        continue;
      }

      const tableLines: string[] = [line2];
      i += 2;
      while (i < rawLines.length) {
        const L = rawLines[i]?.replace(/\r$/, "") ?? "";
        if (!L.trim()) break;
        if (isPipeTableRow(L)) {
          tableLines.push(L);
          i++;
        } else break;
      }
      segments.push({ type: "table", body: tableLines.join("\n") });
      continue;
    }

    textBuf.push(line);
    i++;
  }
  flushText();
  return segments;
}

function renderSegmentsWithMarkdownTables(
  part: string,
  keyPrefix: string
): React.ReactNode[] {
  const elements: React.ReactNode[] = [];
  const segments = splitEmbeddedMarkdownTables(part);
  segments.forEach((seg, segIdx) => {
    if (seg.type === "table") {
      const tableData = parseTable(seg.body);
      if (tableData) {
        elements.push(
          <DataTable key={`${keyPrefix}-md-${segIdx}`} headers={tableData.headers} rows={tableData.rows} />
        );
      } else {
        elements.push(
          ...renderTextSection(seg.body.split(/\r?\n/), `${keyPrefix}-md-fail-${segIdx}`)
        );
      }
    } else {
      elements.push(...renderTextSection(seg.body.split(/\r?\n/), `${keyPrefix}-tx-${segIdx}`));
    }
  });
  return elements;
}

/**
 * Renders a data table using shadcn Table components.
 */
function DataTable({ headers, rows }: { headers: string[]; rows: string[][] }) {
  return (
    <div className="mt-2 rounded-lg border border-border overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/50">
            {headers.map((h, idx) => (
              <TableHead key={idx} className="text-xs font-semibold">
                {h}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row, rIdx) => (
            <TableRow key={rIdx}>
              {headers.map((_, cIdx) => (
                <TableCell key={cIdx} className="text-xs">
                  {row[cIdx] ?? ""}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

/**
 * Renders a single section of text (no [TABLE] blocks) into formatted elements.
 * Handles bullet lists, numbered lists with nested sub-details, and plain text paragraphs.
 */
function renderTextSection(lines: string[], keyPrefix: string): React.ReactNode[] {
  const elements: React.ReactNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const trimmed = lines[i].trim();

    // Skip empty lines
    if (!trimmed) {
      i++;
      continue;
    }

    // Collect consecutive bullet lines (- item)
    if (/^-\s/.test(trimmed)) {
      const bullets: string[] = [];
      while (i < lines.length && /^-\s/.test(lines[i].trim())) {
        bullets.push(lines[i].trim().replace(/^-\s+/, ""));
        i++;
      }
      elements.push(
        <ul key={`${keyPrefix}-ul-${i}`} className="mt-1 space-y-0.5">
          {bullets.map((b, idx) => (
            <li key={idx} className="flex gap-2">
              <span className="text-muted-foreground shrink-0">-</span>
              <span>{b}</span>
            </li>
          ))}
        </ul>
      );
      continue;
    }

    // Collect numbered list with optional sub-details
    if (/^\d+[.)]\s/.test(trimmed)) {
      const items: { num: string; text: string; details: { text: string; isDash: boolean }[] }[] = [];
      while (i < lines.length) {
        const cur = lines[i].trim();
        if (!cur) { i++; continue; }
        const match = cur.match(/^(\d+)[.)]\s+(.*)/);
        if (match) {
          items.push({ num: match[1], text: match[2], details: [] });
          i++;
          while (i < lines.length) {
            const sub = lines[i].trim();
            if (!sub) { i++; continue; }
            if (/^\d+[.)]\s/.test(sub)) break;
            if (/^-\s/.test(sub)) {
              items[items.length - 1].details.push({ text: sub.replace(/^-\s+/, ""), isDash: true });
            } else {
              items[items.length - 1].details.push({ text: sub, isDash: false });
            }
            i++;
          }
        } else {
          break;
        }
      }
      elements.push(
        <ol key={`${keyPrefix}-ol-${i}`} className="mt-1 space-y-1">
          {items.map((item, idx) => (
            <li key={idx}>
              <div className="flex gap-2">
                <span className="text-muted-foreground shrink-0 tabular-nums min-w-[1.2em] text-right">{item.num}.</span>
                <span>{item.text}</span>
              </div>
              {item.details.length > 0 && (
                <div className="ml-[calc(1.2em+0.5rem)] mt-0.5 space-y-0.5">
                  {item.details.map((d, dIdx) => (
                    <div key={dIdx} className={d.isDash ? "flex gap-2 text-muted-foreground" : ""}>
                      {d.isDash && <span className="text-muted-foreground shrink-0">-</span>}
                      <span>{d.text}</span>
                    </div>
                  ))}
                </div>
              )}
            </li>
          ))}
        </ol>
      );
      continue;
    }

    // Regular text line
    elements.push(
      <p key={`${keyPrefix}-p-${i}`} className={elements.length > 0 ? "mt-1" : ""}>
        {trimmed}
      </p>
    );
    i++;
  }

  return elements;
}

/**
 * Renders assistant message content with formatted bullet points, numbered lists, and data tables.
 * Splits plain text into visual blocks: headings, bullets, numbered items, tables, and paragraphs.
 *
 * Tables are denoted by [TABLE]...[/TABLE] blocks with pipe-delimited rows.
 */
export function FormattedMessage({ content }: { content: string }) {
  // Split content by [TABLE]...[/TABLE] blocks
  const parts = content.split(/\[TABLE\]|\[\/TABLE\]/i);
  const elements: React.ReactNode[] = [];

  // Determine which parts are table blocks vs text.
  // After splitting by [TABLE] and [/TABLE], the pattern is:
  // text, tableContent, text, tableContent, ...
  // The first part is always text, then alternates.
  let isTable = false;
  for (let pIdx = 0; pIdx < parts.length; pIdx++) {
    const part = parts[pIdx];

    if (isTable) {
      // Try to parse as a table
      const tableData = parseTable(part);
      if (tableData) {
        elements.push(<DataTable key={`table-${pIdx}`} headers={tableData.headers} rows={tableData.rows} />);
      } else {
        // Fallback: may still be a markdown pipe table, or plain text
        elements.push(...renderSegmentsWithMarkdownTables(part, `tf-${pIdx}`));
      }
    } else {
      const trimmedPart = part.trim();
      if (trimmedPart) {
        elements.push(...renderSegmentsWithMarkdownTables(part, `s-${pIdx}`));
      }
    }

    isTable = !isTable;
  }

  return <>{elements}</>;
}
