"use client";

import { useEffect, useState } from "react";

import { useTrpcClient } from "@kyren/api/react";
import type { AppRouter } from "@kyren/api/server";
import type { inferRouterOutputs } from "@trpc/server";
import { InlineAlert } from "@kyren/ui/components/inline-alert";

type Notice = inferRouterOutputs<AppRouter>["announcement"]["active"][number];

const tones = { info: "info", warning: "warning", critical: "danger" } as const;

/** What the platform is telling everyone: planned work, incidents, news. */
export function AnnouncementBanner() {
  const trpc = useTrpcClient();
  const [notices, setNotices] = useState<Notice[]>([]);

  useEffect(() => {
    let current = true;

    trpc.announcement.active
      .query()
      .then((rows) => {
        if (current) setNotices(rows);
      })
      .catch(() => {
        // A banner is never worth an error on the page.
      });

    return () => {
      current = false;
    };
  }, [trpc]);

  if (!notices.length) return null;

  return (
    <div
      className="flex flex-col gap-2 px-6 pt-4"
      role="region"
      aria-label="Announcements"
    >
      {notices.map((notice) => (
        <InlineAlert
          key={notice.id}
          tone={tones[notice.severity as keyof typeof tones] ?? "info"}
          title={notice.title}
        >
          {notice.body}
        </InlineAlert>
      ))}
    </div>
  );
}
