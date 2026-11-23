import {
  AlertTriangleIcon,
  InfoIcon,
  LightbulbIcon,
  StarIcon,
} from "lucide-react";

export const callouts = {
  note: {
    label: "Note",
    icon: InfoIcon,
    tone: "border-signal bg-signal-subtle/50",
  },
  tip: {
    label: "Tip",
    icon: LightbulbIcon,
    tone: "border-success bg-success-subtle/50",
  },
  warning: {
    label: "Warning",
    icon: AlertTriangleIcon,
    tone: "border-warning bg-warning-subtle/50",
  },
  important: {
    label: "Important",
    icon: StarIcon,
    tone: "border-danger bg-danger-subtle/40",
  },
} as const;

export type Block =
  | { type: "code"; lang: string; code: string }
  | { type: "quote"; lines: string[] }
  | { type: "list"; ordered: boolean; items: string[] }
  | { type: "table"; head: string[]; rows: string[][] }
  | { type: "text"; lines: string[] };

export const isTableRow = (line: string) => /^\s*\|.*\|\s*$/.test(line);
export const isSeparator = (line: string) => /^\s*\|[\s:|-]+\|\s*$/.test(line);
export const cells = (line: string) =>
  line
    .trim()
    .replace(/^\||\|$/g, "")
    .split("|")
    .map((cell) => cell.trim());

export function parseBlocks(body: string): Block[] {
  const blocks: Block[] = [];

  for (const part of body.split(/(```[\s\S]*?```)/g)) {
    if (!part) continue;

    if (part.startsWith("```") && part.endsWith("```") && part.length >= 6) {
      const inner = part.slice(3, -3).replace(/^\n/, "");
      const firstBreak = inner.indexOf("\n");
      const first = firstBreak === -1 ? "" : inner.slice(0, firstBreak);
      const hasLang = /^[a-z0-9+#.-]{1,20}$/i.test(first.trim());

      blocks.push({
        type: "code",
        lang: hasLang ? first.trim() : "",
        code: (hasLang ? inner.slice(firstBreak + 1) : inner).replace(
          /\n$/,
          "",
        ),
      });
      continue;
    }

    const lines = part.split("\n");
    let index = 0;

    while (index < lines.length) {
      const line = lines[index]!;

      if (/^>\s?/.test(line)) {
        const quote: string[] = [];

        while (index < lines.length && /^>\s?/.test(lines[index]!)) {
          quote.push(lines[index]!.replace(/^>\s?/, ""));
          index += 1;
        }

        blocks.push({ type: "quote", lines: quote });
      } else if (/^\s*([-*]|\d+\.)\s+\S/.test(line)) {
        const ordered = /^\s*\d+\./.test(line);
        const items: string[] = [];

        while (
          index < lines.length &&
          /^\s*([-*]|\d+\.)\s+\S/.test(lines[index]!) &&
          /^\s*\d+\./.test(lines[index]!) === ordered
        ) {
          items.push(lines[index]!.replace(/^\s*([-*]|\d+\.)\s+/, ""));
          index += 1;
        }

        blocks.push({ type: "list", ordered, items });
      } else if (
        isTableRow(line) &&
        index + 1 < lines.length &&
        isSeparator(lines[index + 1]!)
      ) {
        const head = cells(line);
        const rows: string[][] = [];

        index += 2;

        while (index < lines.length && isTableRow(lines[index]!)) {
          rows.push(cells(lines[index]!));
          index += 1;
        }

        blocks.push({ type: "table", head, rows });
      } else {
        const last = blocks.at(-1);

        if (last?.type === "text") {
          last.lines.push(line);
        } else {
          blocks.push({ type: "text", lines: [line] });
        }

        index += 1;
      }
    }
  }

  return blocks;
}
