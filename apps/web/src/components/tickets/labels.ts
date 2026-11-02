export const statusLabels: Record<string, string> = {
  open: "Open",
  pending: "Pending",
  resolved: "Resolved",
  spam: "Spam",
};

export const priorityLabels: Record<string, string> = {
  low: "Low",
  normal: "Normal",
  high: "High",
  urgent: "Urgent",
};

export const priorityTone: Record<string, string> = {
  low: "bg-sunken text-ink-2",
  normal: "bg-sunken text-ink-2",
  high: "bg-tint-sun text-ink",
  urgent: "bg-danger-subtle text-danger-text",
};

export const statusTone: Record<string, string> = {
  open: "bg-tint-projects text-ink",
  pending: "bg-tint-sun text-ink",
  resolved: "bg-tint-teams text-ink",
  spam: "bg-sunken text-ink-2",
};

export const selectClass =
  "h-9 rounded-lg border border-line bg-surface px-2.5 text-sm text-ink outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60";

/** The readable message of an error; schema failures arrive as a JSON list of issues. */
export const messageOf = (error: unknown) => {
  if (!(error instanceof Error)) return undefined;

  if (error.message.startsWith("[")) {
    try {
      const issues = JSON.parse(error.message) as { message?: string }[];
      const text = issues
        .map((issue) => issue.message)
        .filter(Boolean)
        .join(" ");

      if (text) return text;
    } catch {
      // Not JSON after all: fall through to the raw message.
    }
  }

  return error.message;
};

/** True when the server said the record is missing or off limits, not that something broke. */
export const isMissing = (error: unknown) => {
  const code = (error as { data?: { code?: string } } | null)?.data?.code;

  return code === "NOT_FOUND" || code === "FORBIDDEN";
};
