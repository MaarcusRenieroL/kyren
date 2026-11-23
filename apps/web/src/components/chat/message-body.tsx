"use client";

import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from "@kyren/ui/shadcn/table";
import type { ReactNode } from "react";
import { cn } from "@kyren/ui/lib/utils";
import { useCustomEmoji } from "./custom-emoji";
import { CodeBlock } from "./message-body/code-block";
import { parseBlocks, callouts } from "./message-body/parse-blocks";
import { MentionChip, renderInline } from "./message-body/inline-renderer";
import {
  messageTime,
  dayHeading,
  relativeAgo,
  untilLabel,
  fileSize,
} from "./message-body/format-time";

export {
  MentionChip,
  messageTime,
  dayHeading,
  relativeAgo,
  untilLabel,
  fileSize,
};

/** A message body, with mentions, task keys, emoji and a little structure. */
export function MessageBody({
  body,
  names,
  meId,
  taskKeys,
  highlight,
  className,
}: {
  body: string;
  names: Record<string, string>;
  meId?: string;
  /** Keys that are real tasks; other key-looking words stay plain text. */
  taskKeys?: ReadonlySet<string>;
  /** Words to mark, for search results. */
  highlight?: string[];
  className?: string;
}) {
  const { emoji: custom } = useCustomEmoji();

  const inline = (line: string, prefix: string) =>
    renderInline(line, prefix, names, custom, meId, taskKeys, highlight);

  const lines = (rows: string[], prefix: string) =>
    rows.map((row, lineIndex) => (
      <span key={`${prefix}-${lineIndex}`}>
        {lineIndex > 0 ? <br /> : null}
        {inline(row, `${prefix}-${lineIndex}`)}
      </span>
    ));

  const blocks = parseBlocks(body);
  const Wrapper = blocks.every((block) => block.type === "text")
    ? "span"
    : "div";

  return (
    <Wrapper className={cn("break-words whitespace-pre-wrap", className)}>
      {blocks.map((block, blockIndex) => {
        const key = `b${blockIndex}`;

        if (block.type === "code") {
          return <CodeBlock key={key} lang={block.lang} code={block.code} />;
        }

        if (block.type === "quote") {
          const first = /^\[!(note|tip|warning|important)\]\s*(.*)$/i.exec(
            block.lines[0] ?? "",
          );

          if (first) {
            const kind =
              callouts[first[1]!.toLowerCase() as keyof typeof callouts];
            const Icon = kind.icon;
            const rest = [first[2] ?? "", ...block.lines.slice(1)].filter(
              (line, i) => i > 0 || line,
            );

            return (
              <div
                key={key}
                className={cn(
                  "my-1.5 flex gap-2.5 rounded-lg border-l-[3px] px-3 py-2 whitespace-normal",
                  kind.tone,
                )}
              >
                <Icon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                <div className="min-w-0">
                  <p className="text-xs font-semibold">{kind.label}</p>
                  <div className="text-[15px] leading-6">
                    {lines(rest, key)}
                  </div>
                </div>
              </div>
            );
          }

          return (
            <blockquote
              key={key}
              className="my-1 border-l-2 border-line-strong pl-3 text-ink-2 whitespace-normal"
            >
              {lines(block.lines, key)}
            </blockquote>
          );
        }

        if (block.type === "list") {
          const Tag = block.ordered ? "ol" : "ul";

          return (
            <Tag
              key={key}
              className={cn(
                "my-1 space-y-0.5 pl-5 whitespace-normal",
                block.ordered ? "list-decimal" : "list-disc",
              )}
            >
              {block.items.map((item, i) => (
                <li key={`${key}-${i}`}>{inline(item, `${key}-${i}`)}</li>
              ))}
            </Tag>
          );
        }

        if (block.type === "table") {
          return (
            <div
              key={key}
              className="my-1.5 max-w-full overflow-x-auto whitespace-normal"
            >
              <Table className="border-collapse text-sm">
                <TableHeader>
                  <TableRow>
                    {block.head.map((cell, i) => (
                      <TableHead
                        key={i}
                        className="border border-hairline bg-sunken px-2.5 py-1 text-left font-semibold"
                      >
                        {inline(cell, `${key}-h${i}`)}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {block.rows.map((row, r) => (
                    <TableRow key={r}>
                      {row.map((cell, i) => (
                        <TableCell
                          key={i}
                          className="border border-hairline px-2.5 py-1"
                        >
                          {inline(cell, `${key}-${r}-${i}`)}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          );
        }

        return <span key={key}>{lines(block.lines, key)}</span>;
      })}
    </Wrapper>
  );
}
