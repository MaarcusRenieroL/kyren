"use client";

/** "Arjun is typing…" above the composer. */
export function TypingLine({ names }: { names: string[] }) {
  if (!names.length) return <div className="h-5" aria-hidden="true" />;

  const label =
    names.length === 1
      ? `${names[0]} is typing`
      : names.length === 2
        ? `${names[0]} and ${names[1]} are typing`
        : "Several people are typing";

  return (
    <p
      role="status"
      aria-live="polite"
      className="flex h-5 items-center gap-1.5 px-1 text-xs text-ink-3"
    >
      <span className="flex gap-0.5" aria-hidden="true">
        {[0, 1, 2].map((dot) => (
          <span
            key={dot}
            className="size-1 animate-bounce rounded-full bg-ink-3"
            style={{ animationDelay: `${dot * 120}ms` }}
          />
        ))}
      </span>
      {label}
    </p>
  );
}
