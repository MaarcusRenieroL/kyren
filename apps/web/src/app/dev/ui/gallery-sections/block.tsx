import type { ReactNode } from "react";

export function Block({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-3">
      <h3 className="text-xs font-medium tracking-wide text-ink-3 uppercase">
        {title}
      </h3>
      <div className="flex flex-wrap items-center gap-3">{children}</div>
    </section>
  );
}
