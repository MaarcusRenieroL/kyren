/** "09:24" for today, "Yesterday 09:24", or "Oct 12 09:24". */
export function messageTime(value: Date | string) {
  const date = new Date(value);

  return date.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

export function dayHeading(value: Date | string, now = new Date()) {
  const date = new Date(value);
  const start = (d: Date) =>
    new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const diff = Math.round((start(now) - start(date)) / 86_400_000);

  if (diff === 0) return "Today";
  if (diff === 1) return "Yesterday";

  return date.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

export function relativeAgo(value: Date | string) {
  const minutes = Math.round((Date.now() - new Date(value).getTime()) / 60_000);

  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  if (minutes < 24 * 60) return `${Math.round(minutes / 60)}h ago`;

  return dayHeading(value);
}

/** "in 20 min", "in 3h", "Tomorrow 09:00": when something is due. */
export function untilLabel(value: Date | string) {
  const date = new Date(value);
  const minutes = Math.round((date.getTime() - Date.now()) / 60_000);

  if (minutes <= 0) return "due now";
  if (minutes < 60) return `in ${minutes} min`;
  if (minutes < 24 * 60) return `in ${Math.round(minutes / 60)}h`;

  return `${dayHeading(date)} ${messageTime(date)}`;
}

export function fileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
