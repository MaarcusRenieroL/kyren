import { FileTextIcon } from "lucide-react";
import { StatusGlyph } from "@zentro/ui/components/status-glyph";
import type { Item } from "./types";

export function Glyph({ item }: { item: Pick<Item, "type" | "status"> }) {
  return item.type === "task" ? (
    <StatusGlyph status={item.status ?? "todo"} size={13} decorative />
  ) : (
    <FileTextIcon className="size-3.5 text-ink-3" aria-hidden="true" />
  );
}
