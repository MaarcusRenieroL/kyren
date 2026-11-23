"use client";

import { useEffect, useState } from "react";
import { CheckIcon, FileIcon, MessageSquareIcon } from "lucide-react";

import { cn } from "@zentro/ui/lib/utils";
import { Button } from "@zentro/ui/shadcn/button";

import { copy, storageKey, type Kind } from "./coming-soon-data";
import { ComingSoonPreview } from "./coming-soon-preview";

export type { Kind } from "./coming-soon-data";

/**
 * A module that is planned but not built. It says so plainly, offers the one
 * action, and shows a dim, inert preview of what is coming.
 */
export function ComingSoon({ kind, email }: { kind: Kind; email: string }) {
  const { name, headline, body, planned } = copy[kind];
  const Icon = kind === "files" ? FileIcon : MessageSquareIcon;
  const [notified, setNotified] = useState(false);

  useEffect(() => {
    try {
      setNotified(localStorage.getItem(storageKey(kind)) === "1");
    } catch {
      // Storage can be blocked; the button just stays available.
    }
  }, [kind]);

  const notify = () => {
    setNotified(true);
    try {
      localStorage.setItem(storageKey(kind), "1");
    } catch {
      // Not fatal: the confirmation still shows for this visit.
    }
  };

  return (
    <div className="flex min-w-0 flex-col">
      <div className="flex items-center gap-3">
        <h1 className="font-display text-[length:var(--title-size)] leading-[1.1]">
          {name}
        </h1>
        <span className="rounded-full border border-dashed border-ink-3 px-2.5 py-px font-mono text-[11px] text-ink-2">
          Coming
        </span>
      </div>

      <div className="flex flex-col items-center gap-3.5 pt-14 pb-9 text-center">
        <span
          className={cn(
            "flex size-14 items-center justify-center rounded-2xl border border-hairline text-ink",
            kind === "files" ? "bg-tint-projects" : "bg-tint-teams",
          )}
        >
          <Icon className="size-[22px]" aria-hidden="true" />
        </span>
        <h2 className="font-display font-semibold text-3xl tracking-tight text-ink sm:text-4xl">
          {headline}
        </h2>
        <p className="max-w-[540px] text-base leading-6 text-ink-2">{body}</p>
        {notified ? (
          <p
            className="mt-1.5 flex h-11 items-center gap-2 text-[15px]"
            role="status"
          >
            <span className="flex size-[18px] items-center justify-center rounded-full bg-success text-on-success">
              <CheckIcon
                className="size-3"
                strokeWidth={3}
                aria-hidden="true"
              />
            </span>
            We’ll email {email} when it’s ready.
          </p>
        ) : (
          <Button size="lg" className="mt-1.5" onClick={notify}>
            Notify me
          </Button>
        )}
        <span className="font-mono text-xs text-ink-3">{planned}</span>
      </div>

      <ComingSoonPreview kind={kind} />
    </div>
  );
}
