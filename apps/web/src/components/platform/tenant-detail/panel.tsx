import type { ReactNode } from "react";

export function Panel({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3 rounded-xl border border-line p-4">
      <h2 className="text-sm font-semibold">{title}</h2>
      {children}
    </section>
  );
}
