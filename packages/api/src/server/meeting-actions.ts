/**
 * The bullets under "Action items:" in an AI recap. Reading stops at the next
 * heading (a line ending in a colon) or a blank line after the list started.
 */
export function actionItemsOf(summary: string | null | undefined) {
  if (!summary) return [];

  const items: string[] = [];
  let inList = false;

  for (const raw of summary.split("\n")) {
    const line = raw.trim();

    if (/^action items:?$/i.test(line)) {
      inList = true;
      continue;
    }

    if (!inList) continue;

    const bullet = /^[-*•]\s+(.+)$/.exec(line);

    if (bullet) {
      items.push(bullet[1]!.trim().slice(0, 200));
    } else if (line === "" ? items.length > 0 : /:$/.test(line)) {
      break;
    }
  }

  return items;
}
