import type { El } from "../canvas/model";
import type { BoardStyle } from "./editor-types";
import { EditorStyleFields } from "./editor-style-fields";
import { EditorArrangeActions } from "./editor-arrange-actions";

export function EditorStylePanel({
  style,
  single,
  linearSingle,
  selection,
  allLocked,
  restyle,
  onElbowToggle,
  restack,
  copyAndPaste,
  lock,
  removeSelected,
  align,
  group,
}: {
  style: BoardStyle;
  single: El | null;
  linearSingle: El | null;
  selection: El[];
  allLocked: boolean;
  restyle: (diff: Partial<El>) => void;
  onElbowToggle: (elbow: boolean) => void;
  restack: (toFront: boolean) => void;
  copyAndPaste: () => void;
  lock: (locked: boolean) => void;
  removeSelected: () => void;
  align: (type: "left" | "hcentre" | "right" | "top" | "vcentre" | "bottom") => void;
  group: (makeGroup: boolean) => void;
}) {
  return (
    <aside
      aria-label="Style"
      className="absolute top-16 left-3 z-10 flex max-h-[calc(100%-6rem)] w-56 flex-col gap-3 overflow-y-auto rounded-xl border border-line bg-canvas p-3 text-xs shadow-sm"
    >
      <EditorStyleFields
        style={style}
        single={single}
        linearSingle={linearSingle}
        restyle={restyle}
        onElbowToggle={onElbowToggle}
      />
      <EditorArrangeActions
        selection={selection}
        allLocked={allLocked}
        restack={restack}
        copyAndPaste={copyAndPaste}
        lock={lock}
        removeSelected={removeSelected}
        align={align}
        group={group}
      />
    </aside>
  );
}
