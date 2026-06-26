"use client";

import type { ReactNode } from "react";
import Markdown from "react-markdown";
import type { Components } from "react-markdown";
import remarkGfm from "remark-gfm";

import { cn } from "@/lib/utils";
import {
  contentToMarkdown,
  shouldUseMarkdownRenderer,
} from "@/lib/chat/markdown-suitability";
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/table";

interface MarkdownRendererProps {
  content: string;
  className?: string;
  /** False while streaming; markdown is only rendered once the reply is complete. */
  isComplete?: boolean;
}

const COMPONENTS: Components = {
  h1: ({ children }) => (
    <p className="mt-2 font-semibold text-foreground first:mt-0">{children}</p>
  ),
  h2: ({ children }) => (
    <p className="mt-2 font-semibold text-foreground first:mt-0">{children}</p>
  ),
  h3: ({ children }) => (
    <p className="mt-2 font-semibold text-foreground first:mt-0">{children}</p>
  ),
  h4: ({ children }) => (
    <p className="mt-2 font-semibold text-foreground first:mt-0">{children}</p>
  ),
  h5: ({ children }) => (
    <p className="mt-2 font-semibold text-foreground first:mt-0">{children}</p>
  ),
  h6: ({ children }) => (
    <p className="mt-2 font-semibold text-foreground first:mt-0">{children}</p>
  ),
  p: ({ children }) => <p className="mt-1 first:mt-0">{children}</p>,
  ul: ({ children }) => (
    <ul className="mt-1 flex list-disc flex-col gap-0.5 pl-5 first:mt-0">
      {children}
    </ul>
  ),
  ol: ({ children }) => (
    <ol className="mt-1 flex list-decimal flex-col gap-0.5 pl-5 first:mt-0">
      {children}
    </ol>
  ),
  li: ({ children }) => <li className="pl-1">{children}</li>,
  a: ({ children, href }) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-primary underline underline-offset-2"
    >
      {children}
    </a>
  ),
  strong: ({ children }) => (
    <strong className="font-semibold text-foreground">{children}</strong>
  ),
  em: ({ children }) => <em className="italic">{children}</em>,
  code: ({ children }) => (
    <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">
      {children}
    </code>
  ),
  blockquote: ({ children }) => (
    <blockquote className="mt-1 border-l-2 border-border pl-3 text-muted-foreground first:mt-0">
      {children}
    </blockquote>
  ),
  hr: () => <hr className="my-2 border-border" />,
  table: ({ children }) => (
    <div className="mt-2 overflow-hidden rounded-lg border border-border first:mt-0">
      <Table>{children}</Table>
    </div>
  ),
  thead: ({ children }) => <TableHeader>{children}</TableHeader>,
  tbody: ({ children }) => <TableBody>{children}</TableBody>,
  tr: ({ children }) => <TableRow>{children}</TableRow>,
  th: ({ children }) => (
    <TableHead className="text-xs font-semibold">{children}</TableHead>
  ),
  td: ({ children }) => <TableCell className="text-xs">{children}</TableCell>,
};

export function MarkdownRenderer({
  content,
  className,
  isComplete = true,
}: MarkdownRendererProps) {
  const trimmed = content.trim();
  if (!trimmed) return null;

  if (!isComplete || !shouldUseMarkdownRenderer(trimmed)) {
    return (
      <p className={cn("text-sm leading-relaxed whitespace-pre-wrap", className)}>
        {trimmed}
      </p>
    );
  }

  return (
    <div className={cn("text-sm leading-relaxed break-words", className)}>
      <Markdown remarkPlugins={[remarkGfm]} components={COMPONENTS}>
        {contentToMarkdown(trimmed)}
      </Markdown>
    </div>
  );
}
