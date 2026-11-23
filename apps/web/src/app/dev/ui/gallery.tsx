"use client";

import { Specimens } from "./gallery-sections/specimens";

const panels = [
  { label: "Light · compact", theme: "", density: "compact" },
  { label: "Dark · compact", theme: "dark", density: "compact" },
  { label: "Light · comfortable", theme: "", density: "comfortable" },
  { label: "Dark · comfortable", theme: "dark", density: "comfortable" },
] as const;

export function Gallery() {
  return (
    <main className="min-h-screen bg-canvas p-6 text-ink">
      <h1 className="mb-6 font-display text-3xl">
        Primitives <span className="font-mono text-signal">gallery</span>
      </h1>
      <div className="grid gap-6 xl:grid-cols-2">
        {panels.map((panel) => (
          <div
            key={panel.label}
            data-density={panel.density}
            data-testid={`panel-${panel.theme || "light"}-${panel.density}`}
            className={`${panel.theme} rounded-xl border border-hairline bg-canvas p-5 text-ink`}
          >
            <p className="mb-5 text-xs font-medium tracking-wide text-ink-3 uppercase">
              {panel.label}
            </p>
            <Specimens />
          </div>
        ))}
      </div>
    </main>
  );
}
