export const typeLabels: Record<string, string> = {
  annual: "Annual leave",
  sick: "Sick leave",
  unpaid: "Unpaid leave",
  parental: "Parental leave",
  other: "Other",
};

export const statusTone: Record<string, string> = {
  pending: "bg-tint-sun text-ink",
  approved: "bg-tint-teams text-ink",
  rejected: "bg-danger-subtle text-danger-text",
  cancelled: "bg-sunken text-ink-2",
};

export const range = (start: string, end: string) => {
  const format = new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
  const a = format.format(new Date(`${start}T00:00:00Z`));

  return start === end
    ? a
    : `${a} – ${format.format(new Date(`${end}T00:00:00Z`))}`;
};
