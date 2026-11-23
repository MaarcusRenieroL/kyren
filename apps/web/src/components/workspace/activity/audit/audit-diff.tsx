export function AuditDiff({ metadata }: { metadata: Record<string, unknown> }) {
  const changes = (metadata.changes ?? []) as Array<{
    field: string;
    from: string | null;
    to: string | null;
  }>;
  const rest = Object.fromEntries(
    Object.entries(metadata).filter(([key]) => key !== "changes"),
  );

  return (
    <div className="flex flex-col gap-3 text-sm">
      {changes.length ? (
        <div className="grid grid-cols-2 gap-2 font-mono text-xs">
          {(["from", "to"] as const).map((side) => (
            <div
              key={side}
              className="flex min-w-0 flex-col gap-1 rounded-md border border-hairline p-2.5"
            >
              <span className="font-sans text-[11px] text-ink-3">
                {side === "from" ? "Before" : "After"}
              </span>
              {changes.map((change) => (
                <span
                  key={change.field}
                  className={
                    side === "from"
                      ? "break-all text-ink-3 line-through"
                      : "rounded-xs bg-selected px-1 break-all"
                  }
                >
                  {change.field}: {change[side] ?? "none"}
                </span>
              ))}
            </div>
          ))}
        </div>
      ) : null}
      {Object.keys(rest).length ? (
        <pre className="max-h-64 overflow-auto rounded-md border border-hairline bg-sunken p-2.5 text-xs">
          {JSON.stringify(rest, null, 2)}
        </pre>
      ) : null}
    </div>
  );
}
