import type { FC } from "react";
import { formatEventTime } from "@kyren/utils";
import { getAuditEvent } from "@kyren/audit";
import { toastSuccess } from "@kyren/ui/index";
import { Button } from "@kyren/ui/shadcn/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@kyren/ui/shadcn/sheet";
import { ActorAvatar } from "~/src/components/actor-avatar";
import { sentenceFor } from "../activity-feed";
import { copyText } from "~/src/lib/clipboard";
import { moduleOf, type Row } from "./types";
import { AuditDiff } from "./audit-diff";

type AuditEventSheetProps = {
  selected: Row | null;
  onClose: () => void;
};

export const AuditEventSheet: FC<AuditEventSheetProps> = ({
  selected,
  onClose,
}) => {
  return (
    <Sheet open={Boolean(selected)} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-md">
        {selected ? (
          <>
            <SheetHeader>
              <span className="eyebrow">
                {moduleOf(selected.action)} ·{" "}
                {getAuditEvent(selected.action)?.label ?? selected.action}
              </span>
              <SheetTitle className="text-lg leading-6">
                {sentenceFor(selected)}
              </SheetTitle>
              <SheetDescription className="sr-only">
                Details of this event
              </SheetDescription>
            </SheetHeader>
            <div className="flex flex-col gap-5 px-4 pb-6 text-sm">
              <dl className="grid grid-cols-[6.5rem_minmax(0,1fr)] gap-x-3 gap-y-2.5 text-[13px]">
                <dt className="text-ink-3">Actor</dt>
                <dd className="flex items-center gap-2">
                  <ActorAvatar
                    name={selected.actorName ?? selected.actorEmail ?? "System"}
                    size={20}
                  />
                  {selected.actorName ?? selected.actorEmail ?? "System"}
                </dd>
                <dt className="text-ink-3">Time</dt>
                <dd className="font-mono text-xs">
                  {formatEventTime(selected.createdAt)}
                </dd>
                <dt className="text-ink-3">Action</dt>
                <dd className="font-mono text-xs break-all">
                  {selected.action}
                </dd>
                <dt className="text-ink-3">Target</dt>
                <dd className="break-all">
                  {selected.targetType} {selected.targetLabel ?? ""}
                </dd>
                <dt className="text-ink-3">IP address</dt>
                <dd className="font-mono text-xs">
                  {selected.ip ?? "unknown"}
                </dd>
                <dt className="text-ink-3">User agent</dt>
                <dd className="font-mono text-xs break-all">
                  {selected.userAgent ?? "unknown"}
                </dd>
                <dt className="text-ink-3">Request ID</dt>
                <dd className="font-mono text-xs break-all">
                  {selected.requestId ?? "none"}
                </dd>
                <dt className="text-ink-3">Event ID</dt>
                <dd className="font-mono text-xs break-all">{selected.id}</dd>
              </dl>
              <div className="flex flex-col gap-2">
                <span className="eyebrow">Change</span>
                <AuditDiff metadata={selected.metadata} />
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    void copyText(JSON.stringify(selected, null, 2)).then(
                      (done) => {
                        if (done) toastSuccess("Event copied");
                      },
                    );
                  }}
                >
                  Copy event JSON
                </Button>
              </div>
            </div>
          </>
        ) : null}
      </SheetContent>
    </Sheet>
  );
};
