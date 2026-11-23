import { Button } from "@kyren/ui/shadcn/button";
import Link from "next/link";
import { XIcon } from "lucide-react";
import { cn } from "@kyren/ui/lib/utils";
import { Glyph } from "./glyph";
import { groups, type Item } from "./types";

export function LinkedGroups({
  items,
  canEdit,
  onRemove,
}: {
  items: Item[];
  canEdit: boolean;
  onRemove: (item: Item) => void;
}) {
  return (
    <>
      {groups.map(({ relation, label }) => {
        const group = items.filter((item) => item.relation === relation);

        if (!group.length) return null;

        return (
          <div key={relation} className="flex flex-col">
            <span
              className={cn(
                "pt-1 pb-0.5 font-mono text-[10px] tracking-[0.08em] text-ink-3 uppercase",
                relation === "blocked_by" && "text-danger-text",
              )}
            >
              {label} · {group.length}
            </span>
            <ul>
              {group.map((item) => (
                <li
                  key={item.linkId}
                  className="group relative flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-hover"
                >
                  <Glyph item={item} />
                  {item.type === "task" && item.key ? (
                    <span className="font-mono text-xs text-ink-3">
                      {item.key}
                    </span>
                  ) : null}
                  <Link
                    href={item.href}
                    className="min-w-0 flex-1 truncate text-sm outline-none after:absolute after:inset-0 after:rounded-md focus-visible:after:ring-2 focus-visible:after:ring-ring"
                  >
                    {item.title}
                  </Link>
                  {canEdit && !item.auto ? (
                    <Button
                      variant="custom"
                      type="button"
                      aria-label={`Remove link to ${item.key ?? item.title}`}
                      onClick={() => void onRemove(item)}
                      className="relative z-[1] rounded-xs p-0.5 text-ink-3 opacity-0 outline-none group-hover:opacity-100 hover:text-ink focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <XIcon className="size-3.5" />
                    </Button>
                  ) : null}
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </>
  );
}
