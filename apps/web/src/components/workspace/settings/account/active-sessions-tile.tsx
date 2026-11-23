"use client";

import { LaptopIcon, SmartphoneIcon, TabletIcon } from "lucide-react";
import { authClient } from "@zentro/auth/client";
import { toastError, toastSuccess } from "@zentro/ui/index";
import { Button } from "@zentro/ui/shadcn/button";
import { Skeleton } from "@zentro/ui/shadcn/skeleton";

import { SettingsTile } from "../settings-kit";

export type SessionRow = {
  token: string;
  userAgent?: string | null;
  ipAddress?: string | null;
  updatedAt: Date | string;
};

export function describeDevice(userAgent?: string | null) {
  const ua = userAgent ?? "";
  const browser = /edg\//i.test(ua)
    ? "Edge"
    : /chrome\//i.test(ua)
      ? "Chrome"
      : /firefox\//i.test(ua)
        ? "Firefox"
        : /safari\//i.test(ua)
          ? "Safari"
          : "Browser";
  const os = /iphone/i.test(ua)
    ? "iPhone"
    : /ipad/i.test(ua)
      ? "iPad"
      : /android/i.test(ua)
        ? "Android"
        : /mac os x/i.test(ua)
          ? "macOS"
          : /windows/i.test(ua)
            ? "Windows"
            : /linux/i.test(ua)
              ? "Linux"
              : "Unknown device";
  const Icon = /iphone|android/i.test(ua)
    ? SmartphoneIcon
    : /ipad/i.test(ua)
      ? TabletIcon
      : LaptopIcon;

  return { name: `${browser} on ${os}`, Icon };
}

export function lastActive(value: Date | string) {
  const minutes = Math.max(
    0,
    Math.round((Date.now() - new Date(value).getTime()) / 60000),
  );

  if (minutes < 2) return "Active now";
  if (minutes < 60) return `${minutes}m ago`;
  if (minutes < 60 * 24) return `${Math.floor(minutes / 60)}h ago`;

  return `${Math.floor(minutes / (60 * 24))}d ago`;
}

export function ActiveSessionsTile({
  sessions,
  currentToken,
  revoking,
  onRevoke,
  onRefresh,
}: {
  sessions: SessionRow[] | null;
  currentToken: string | null;
  revoking: string | null;
  onRevoke: (token: string) => void;
  onRefresh: () => Promise<void>;
}) {
  const others = (sessions ?? []).filter(
    (session) => session.token !== currentToken,
  );

  return (
    <section className="flex flex-col gap-2" aria-labelledby="sessions-title">
      <div className="flex items-center gap-3">
        <h3 id="sessions-title" className="text-sm font-semibold">
          Active sessions
        </h3>
        <span className="flex-1" />
        {others.length > 0 ? (
          <Button
            variant="custom"
            type="button"
            onClick={async () => {
              const { error } = await authClient.revokeOtherSessions();
              if (error) {
                toastError(error, "Could not sign out other devices");
                return;
              }
              toastSuccess("Done", "Every other device is signed out.");
              await onRefresh();
            }}
            className="rounded-xs text-[13px] text-signal underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            Sign out of all other sessions
          </Button>
        ) : null}
      </div>
      <SettingsTile>
        {sessions === null ? (
          <div className="flex flex-col gap-3 px-[22px] py-[18px]">
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-4 w-1/3" />
          </div>
        ) : sessions.length === 0 ? (
          <p className="px-[22px] py-[18px] text-sm text-ink-2">
            No sessions to show.
          </p>
        ) : (
          sessions.map((session) => {
            const { name, Icon } = describeDevice(session.userAgent);
            const here = session.token === currentToken;

            return (
              <div
                key={session.token}
                className="flex items-center gap-3 px-[22px] py-3.5"
              >
                <Icon
                  className="size-[18px] shrink-0 text-ink-3"
                  aria-hidden="true"
                />
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="flex items-center gap-2 text-sm font-medium">
                    <span className="truncate">{name}</span>
                    {here ? (
                      <span className="rounded-full border border-hairline px-2 py-px text-[11px] font-normal text-ink-2">
                        This device
                      </span>
                    ) : null}
                  </span>
                  <span className="truncate font-mono text-xs text-ink-3">
                    {session.ipAddress || "Unknown IP"} ·{" "}
                    {lastActive(session.updatedAt)}
                  </span>
                </div>
                {here ? null : (
                  <Button
                    variant="outline"
                    size="sm"
                    loading={revoking === session.token}
                    onClick={() => onRevoke(session.token)}
                  >
                    Sign out
                  </Button>
                )}
              </div>
            );
          })
        )}
      </SettingsTile>
    </section>
  );
}
