"use client";

import { useEffect, useState } from "react";
import { SparklesIcon } from "lucide-react";
import { useTrpcClient } from "@zentro/api/react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@zentro/ui/shadcn/dialog";
import { Skeleton } from "@zentro/ui/shadcn/skeleton";

import { MessageBody } from "../message-body";

/** A short summary of a thread or the latest messages in a channel. */
export function SummaryDialog({
  channelId,
  parentId,
  title,
  onClose,
}: {
  channelId: string;
  parentId?: string;
  title: string;
  onClose: () => void;
}) {
  const trpc = useTrpcClient();
  const [result, setResult] = useState<{ summary: string; ai: boolean } | null>(
    null,
  );
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let live = true;

    trpc.chat.summarize
      .mutate({ channelId, parentId })
      .then((data) => live && setResult(data))
      .catch(() => live && setFailed(true));

    return () => {
      live = false;
    };
  }, [trpc, channelId, parentId]);

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="gap-4 sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <SparklesIcon className="size-5" aria-hidden="true" />
            Summary
          </DialogTitle>
          <DialogDescription>{title}</DialogDescription>
        </DialogHeader>
        {failed ? (
          <p role="alert" className="text-sm text-danger-text">
            Could not summarize this right now. Try again in a moment.
          </p>
        ) : result ? (
          <>
            <div className="text-[15px] leading-6">
              <MessageBody
                body={result.summary
                  .split("\n")
                  .map((line) =>
                    /^\s*[•*]\s/.test(line)
                      ? line.replace(/^\s*[•*]/, "-")
                      : line,
                  )
                  .join("\n")}
                names={{}}
              />
            </div>
            <p className="font-mono text-[11px] text-ink-3">
              {result.ai
                ? "Written by Claude from the messages in view. Check anything important."
                : "A plain recap, not a written summary: set ANTHROPIC_API_KEY to get one."}
            </p>
          </>
        ) : (
          <div className="flex flex-col gap-2" aria-busy="true">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
            <Skeleton className="h-4 w-2/3" />
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
