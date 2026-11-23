"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { cn } from "@zentro/ui/lib/utils";
import { paths } from "~/src/lib/paths";
import { builtinShortcodes } from "../custom-emoji";

export const token =
  /(<@[0-9a-f-]{36}>|<!(?:channel|here)>|`[^`\n]+`|\*\*[^*\n]+\*\*|_[^_\n]+_|https?:\/\/[^\s<]+|\b[A-Z][A-Z0-9]{1,9}-\d{1,6}\b|:[a-z0-9_+-]{2,32}:)/g;

export function MentionChip({
  children,
  me = false,
}: {
  children: ReactNode;
  me?: boolean;
}) {
  return (
    <span
      className={cn(
        "rounded-xs px-0.5 font-medium",
        me ? "bg-signal-subtle text-signal-strong" : "text-signal-strong",
      )}
    >
      {children}
    </span>
  );
}

export function renderMarked(
  text: string,
  base: string,
  highlight?: string[],
): ReactNode {
  if (!highlight?.length) return text;

  const words = highlight
    .filter(Boolean)
    .map((word) => word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));

  if (!words.length) return text;

  return text
    .split(new RegExp(`(${words.join("|")})`, "ig"))
    .map((part, i) =>
      i % 2 ? (
        <mark
          key={`${base}-${i}`}
          className="rounded-xs bg-tint-sun px-0.5 text-ink"
        >
          {part}
        </mark>
      ) : (
        part
      ),
    );
}

export function renderInline(
  line: string,
  prefix: string,
  names: Record<string, string>,
  custom: Map<string, string>,
  meId?: string,
  taskKeys?: ReadonlySet<string>,
  highlight?: string[],
): ReactNode[] {
  return line.split(token).map((part, index) => {
    const key = `${prefix}-${index}`;

    if (!part) return null;

    const mention = /^<@([0-9a-f-]{36})>$/.exec(part);

    if (mention) {
      const id = mention[1]!;

      return (
        <MentionChip key={key} me={id === meId}>
          @{names[id] ?? "someone"}
        </MentionChip>
      );
    }

    if (part === "<!channel>" || part === "<!here>") {
      return (
        <MentionChip key={key} me>
          @{part.slice(2, -1)}
        </MentionChip>
      );
    }

    if (part.startsWith("`") && part.endsWith("`") && part.length > 2) {
      return (
        <code
          key={key}
          className="rounded-xs bg-sunken px-1 py-px font-mono text-[0.9em]"
        >
          {part.slice(1, -1)}
        </code>
      );
    }

    if (part.startsWith("**") && part.endsWith("**") && part.length > 4) {
      return <strong key={key}>{part.slice(2, -2)}</strong>;
    }

    if (part.startsWith("_") && part.endsWith("_") && part.length > 2) {
      return <em key={key}>{part.slice(1, -1)}</em>;
    }

    if (/^https?:\/\//.test(part)) {
      return (
        <a
          key={key}
          href={part}
          target="_blank"
          rel="noreferrer noopener"
          className="text-signal-strong underline-offset-2 hover:underline"
        >
          {part}
        </a>
      );
    }

    if (
      /^[A-Z][A-Z0-9]{1,9}-\d{1,6}$/.test(part) &&
      (!taskKeys || taskKeys.has(part))
    ) {
      return (
        <Link
          key={key}
          href={paths.task(part)}
          className="font-mono text-[0.92em] text-signal-strong hover:underline"
        >
          {part}
        </Link>
      );
    }

    const shortcode = /^:([a-z0-9_+-]{2,32}):$/.exec(part);

    if (shortcode) {
      const name = shortcode[1]!;
      const url = custom.get(name);

      if (url) {
        return (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={key}
            src={url}
            alt={`:${name}:`}
            title={`:${name}:`}
            className="mx-px inline-block size-5 align-text-bottom"
          />
        );
      }

      if (builtinShortcodes[name]) {
        return <span key={key}>{builtinShortcodes[name]}</span>;
      }
    }

    return <span key={key}>{renderMarked(part, key, highlight)}</span>;
  });
}
