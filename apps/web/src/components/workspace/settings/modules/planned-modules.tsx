import { cn } from "@zentro/ui/lib/utils";
import { planned, plannedTint } from "./modules-config";

export function PlannedModules() {
  return (
    <section aria-labelledby="coming-title" className="flex flex-col gap-3.5">
      <div className="flex items-baseline gap-2.5 pt-4">
        <h2 id="coming-title" className="text-[15px] font-semibold">
          Coming
        </h2>
        <span className="font-mono text-xs text-ink-3">
          {planned.length} planned · not available yet
        </span>
      </div>
      <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {planned.map((item) => (
          <li
            key={item.name}
            className="flex flex-col gap-1.5 rounded-xl border border-dashed border-hairline px-4 py-3.5 opacity-55"
          >
            <div className="flex items-center gap-2.5">
              <span
                aria-hidden="true"
                className={cn(
                  "size-6 rounded-md border border-hairline",
                  plannedTint[item.tint],
                )}
              />
              <span className="text-[15px] font-semibold">{item.name}</span>
              <span className="flex-1" />
              <span className="rounded-full border border-dashed border-ink-3 px-2 py-px font-mono text-[11px] text-ink-2">
                Coming
              </span>
            </div>
            <p className="text-[13px] leading-5 text-ink-2">
              {item.description}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}
