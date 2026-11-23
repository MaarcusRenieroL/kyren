"use client";

import { StatusGlyph } from "@zentro/ui/components/status-glyph";
import { cn } from "@zentro/ui/lib/utils";

import {
  channels,
  files,
  initials,
  messages,
  type Kind,
} from "./coming-soon-data";

export function ComingSoonPreview({ kind }: { kind: Kind }) {
  return (
    <div
      aria-hidden="true"
      inert
      className="pointer-events-none relative opacity-[0.42] [mask-image:linear-gradient(180deg,#000_30%,transparent)]"
    >
      <span className="absolute top-3 right-4 z-10 font-mono text-[11px] tracking-[0.08em] text-ink-2">
        PREVIEW · NOT LIVE
      </span>
      {kind === "files" ? (
        <div className="rounded-xl border border-dashed border-hairline px-3 py-2">
          <div className="flex h-9 items-center gap-3 border-b border-hairline px-2 font-mono text-[11px] tracking-[0.08em] text-ink-3">
            <span className="flex-1">NAME</span>
            <span className="hidden w-[200px] sm:block">LINKED TO</span>
            <span className="w-20 text-right">SIZE</span>
            <span className="hidden w-[90px] text-right sm:block">UPDATED</span>
          </div>
          {files.map((file) => (
            <div
              key={file.name}
              className="flex h-[52px] items-center gap-3 border-b border-hairline px-2"
            >
              <span className="flex min-w-0 flex-1 items-center gap-2.5 text-sm">
                <span
                  className={cn(
                    "flex size-[30px] shrink-0 items-center justify-center rounded-sm border border-hairline font-mono text-[9px]",
                    file.tint,
                  )}
                >
                  {file.ext}
                </span>
                <span className="truncate">{file.name}</span>
              </span>
              <span className="hidden w-[200px] items-center gap-1.5 sm:flex">
                <span className="rounded-xs border border-hairline px-1.5 font-mono text-xs">
                  {file.key}
                </span>
                <span className="truncate text-xs text-ink-2">
                  {file.linked}
                </span>
              </span>
              <span className="w-20 text-right font-mono text-xs text-ink-2">
                {file.size}
              </span>
              <span className="hidden w-[90px] text-right font-mono text-xs text-ink-2 sm:block">
                {file.date}
              </span>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid min-h-[380px] rounded-xl border border-dashed border-hairline sm:grid-cols-[220px_minmax(0,1fr)]">
          <div className="hidden flex-col gap-0.5 border-r border-hairline px-2.5 py-3.5 sm:flex">
            <span className="px-2 pb-1.5 font-mono text-[11px] tracking-[0.08em] text-ink-3">
              CHANNELS
            </span>
            {channels.map((channel, index) => (
              <span
                key={channel}
                className={cn(
                  "flex h-8 items-center rounded-md px-2 text-sm",
                  index === 0 && "bg-hover font-medium",
                )}
              >
                {channel}
              </span>
            ))}
          </div>
          <div className="flex flex-col gap-4 px-5 py-4">
            {messages.map((message) => (
              <div key={message.time} className="flex gap-2.5">
                <span className="flex size-[30px] shrink-0 items-center justify-center rounded-full border border-hairline bg-tint-tasks font-mono text-[11px]">
                  {initials(message.who)}
                </span>
                <div className="flex flex-col gap-1">
                  <span className="text-sm">
                    <span className="font-semibold">{message.who}</span>{" "}
                    <span className="font-mono text-[11px] text-ink-3">
                      {message.time}
                    </span>
                  </span>
                  <span className="text-sm leading-5">{message.body}</span>
                  {message.link ? (
                    <span className="inline-flex h-[30px] items-center gap-2 self-start rounded-md border border-hairline px-2.5 text-[13px]">
                      <StatusGlyph
                        status={message.link.status}
                        size={12}
                        decorative
                      />
                      <span className="font-mono text-xs">
                        {message.link.key}
                      </span>
                      {message.link.title}
                    </span>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
