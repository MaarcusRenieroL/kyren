/**
 * The action items listed in an AI recap: the bullet lines under its
 * "Action items:" heading, up to the next heading or the end.
 */
export function recapActionItems(summary: string | null | undefined) {
  if (!summary) return [];

  const lines = summary.split("\n");
  const start = lines.findIndex((line) =>
    /^\s*\**\s*action items\s*:?\s*\**\s*$/i.test(line),
  );

  if (start === -1) return [];

  const items: string[] = [];

  for (const line of lines.slice(start + 1)) {
    const bullet = /^\s*(?:[-*•]|\d+[.)])\s+(.+)$/.exec(line);

    if (bullet) {
      items.push(bullet[1]!.trim());
      continue;
    }

    // A blank line, or any other line, ends the list.
    if (items.length || line.trim()) break;
  }

  return items.slice(0, 20);
}
