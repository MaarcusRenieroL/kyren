export const percent = (value: number) => `${Math.round(value * 100)}%`;

export type Confidence = "on_track" | "at_risk" | "off_track";

export const confidenceLabel: Record<Confidence, string> = {
  on_track: "On track",
  at_risk: "At risk",
  off_track: "Off track",
};

export const confidenceTone: Record<Confidence, string> = {
  on_track: "bg-success-subtle text-success-text",
  at_risk: "bg-warning-subtle text-warning-text",
  off_track: "bg-danger-subtle text-danger-text",
};

export function ConfidenceBadge({ value }: { value: Confidence }) {
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-xs font-medium ${confidenceTone[value]}`}
    >
      {confidenceLabel[value]}
    </span>
  );
}

export const when = new Intl.DateTimeFormat(undefined, {
  dateStyle: "medium",
  timeStyle: "short",
});

export function Bar({ value, label }: { value: number; label: string }) {
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuenow={Math.round(value * 100)}
      aria-valuemin={0}
      aria-valuemax={100}
      className="h-1.5 w-full overflow-hidden rounded-full bg-sunken"
    >
      <div
        className="h-full bg-ink transition-all"
        style={{ width: `${Math.min(100, Math.max(0, value * 100))}%` }}
      />
    </div>
  );
}
