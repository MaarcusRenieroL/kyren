import {
  AlignCenterHorizontalIcon,
  AlignCenterVerticalIcon,
  AlignEndHorizontalIcon,
  AlignEndVerticalIcon,
  AlignStartHorizontalIcon,
  AlignStartVerticalIcon,
  BringToFrontIcon,
  CopyIcon,
  GroupIcon,
  LockIcon,
  SendToBackIcon,
  Trash2Icon,
  UngroupIcon,
  UnlockIcon,
} from "lucide-react";
import { Button } from "@zentro/ui/shadcn/button";
import type { El } from "../canvas/model";

export function EditorArrangeActions({
  selection,
  allLocked,
  restack,
  copyAndPaste,
  lock,
  removeSelected,
  align,
  group,
}: {
  selection: El[];
  allLocked: boolean;
  restack: (toFront: boolean) => void;
  copyAndPaste: () => void;
  lock: (locked: boolean) => void;
  removeSelected: () => void;
  align: (type: "left" | "hcentre" | "right" | "top" | "vcentre" | "bottom") => void;
  group: (makeGroup: boolean) => void;
}) {
  if (!selection.length) return null;

  return (
    <>
      <div className="flex flex-wrap gap-1" aria-label="Arrange">
        <Button
          size="icon-sm"
          variant="ghost"
          aria-label="Bring to front"
          title="Bring to front — ]"
          onClick={() => restack(true)}
        >
          <BringToFrontIcon aria-hidden />
        </Button>
        <Button
          size="icon-sm"
          variant="ghost"
          aria-label="Send to back"
          title="Send to back — ["
          onClick={() => restack(false)}
        >
          <SendToBackIcon aria-hidden />
        </Button>
        <Button
          size="icon-sm"
          variant="ghost"
          aria-label="Duplicate"
          title="Duplicate — Ctrl D"
          onClick={copyAndPaste}
        >
          <CopyIcon aria-hidden />
        </Button>
        <Button
          size="icon-sm"
          variant="ghost"
          aria-label={allLocked ? "Unlock" : "Lock"}
          onClick={() => lock(!allLocked)}
        >
          {allLocked ? (
            <UnlockIcon aria-hidden />
          ) : (
            <LockIcon aria-hidden />
          )}
        </Button>
        <Button
          size="icon-sm"
          variant="ghost"
          aria-label="Delete selected"
          onClick={removeSelected}
        >
          <Trash2Icon aria-hidden />
        </Button>
      </div>
      {selection.length > 1 ? (
        <div className="flex flex-wrap gap-1" aria-label="Align">
          <Button
            size="icon-sm"
            variant="ghost"
            aria-label="Align left"
            onClick={() => align("left")}
          >
            <AlignStartVerticalIcon aria-hidden />
          </Button>
          <Button
            size="icon-sm"
            variant="ghost"
            aria-label="Align centres"
            onClick={() => align("hcentre")}
          >
            <AlignCenterVerticalIcon aria-hidden />
          </Button>
          <Button
            size="icon-sm"
            variant="ghost"
            aria-label="Align right"
            onClick={() => align("right")}
          >
            <AlignEndVerticalIcon aria-hidden />
          </Button>
          <Button
            size="icon-sm"
            variant="ghost"
            aria-label="Align top"
            onClick={() => align("top")}
          >
            <AlignStartHorizontalIcon aria-hidden />
          </Button>
          <Button
            size="icon-sm"
            variant="ghost"
            aria-label="Align middles"
            onClick={() => align("vcentre")}
          >
            <AlignCenterHorizontalIcon aria-hidden />
          </Button>
          <Button
            size="icon-sm"
            variant="ghost"
            aria-label="Align bottom"
            onClick={() => align("bottom")}
          >
            <AlignEndHorizontalIcon aria-hidden />
          </Button>
          <Button
            size="icon-sm"
            variant="ghost"
            aria-label="Group"
            title="Group — Ctrl G"
            onClick={() => group(true)}
          >
            <GroupIcon aria-hidden />
          </Button>
          <Button
            size="icon-sm"
            variant="ghost"
            aria-label="Ungroup"
            title="Ungroup — Ctrl Shift G"
            onClick={() => group(false)}
          >
            <UngroupIcon aria-hidden />
          </Button>
        </div>
      ) : null}
    </>
  );
}
