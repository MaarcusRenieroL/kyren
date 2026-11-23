"use client";

import { Label } from "@zentro/ui/shadcn/label";
import { Checkbox } from "@zentro/ui/shadcn/checkbox";
import { useState } from "react";
import Link from "next/link";
import { useTrpcClient } from "@zentro/api/react";
import { toastError, toastSuccess } from "@zentro/ui/index";
import { Shell, Loading, Stat, dateFormat, useAdminData } from "./admin-shell";

export function AdminSecurity() {
  const { data, failed } = useAdminData("security");
  const trpc = useTrpcClient();
  const [required, setRequired] = useState<boolean | null>(null);
  const requireTwoFactor = required ?? data?.requireTwoFactor ?? false;
  const [ai, setAi] = useState<boolean | null>(null);
  const aiEnabled = ai ?? data?.aiEnabled ?? false;

  async function changeAi(next: boolean) {
    try {
      await trpc.organization.setAiPolicy.mutate({ enabled: next });
      setAi(next);
      toastSuccess(next ? "AI features are on" : "AI features are off");
    } catch (error) {
      toastError(error, "Could not change the AI setting.");
    }
  }

  async function changePolicy(next: boolean) {
    try {
      await trpc.organization.setTwoFactorPolicy.mutate({ required: next });
      setRequired(next);
      toastSuccess(
        next
          ? "Two-factor is now required"
          : "Two-factor is no longer required",
      );
    } catch (error) {
      toastError(error, "Could not change the requirement.");
    }
  }

  return (
    <Shell>
      {!data ? (
        <Loading failed={failed} />
      ) : (
        <>
          <dl className="grid gap-4 sm:grid-cols-3">
            <Stat
              label="Owners and admins"
              value={String(data.privileged.length)}
            />
            <Stat
              label="Failed sign-ins, 7 days"
              value={String(data.failedSignIns)}
            />
            <Stat
              label="Invitations older than 7 days"
              value={String(data.staleInvitations.length)}
            />
          </dl>

          <section aria-labelledby="policy" className="flex flex-col gap-2">
            <h2 id="policy" className="text-sm font-semibold text-ink">
              Two-factor sign-in
            </h2>
            <Label className="flex items-start gap-3 text-sm">
              <Checkbox
                className="mt-0.5"
                checked={requireTwoFactor}
                onCheckedChange={(checked) =>
                  void changePolicy(checked === true)
                }
              />
              <span>
                <span className="block text-ink">
                  Require two-factor sign-in for everyone
                </span>
                <span className="text-xs text-ink-3">
                  {data.withTwoFactor} of {data.memberCount} people have it on.
                  Others are asked to turn it on before they can continue.
                </span>
              </span>
            </Label>
          </section>

          <section aria-labelledby="ai" className="flex flex-col gap-2">
            <h2 id="ai" className="text-sm font-semibold text-ink">
              AI features
            </h2>
            <Label className="flex items-start gap-3 text-sm">
              <Checkbox
                className="mt-0.5"
                checked={aiEnabled}
                onCheckedChange={(checked) => void changeAi(checked === true)}
              />
              <span>
                <span className="block text-ink">
                  Let AI summarize and translate workspace text
                </span>
                <span className="text-xs text-ink-3">
                  When on, the chat or ticket text you ask about is sent to
                  Anthropic to produce the answer. Each use is listed in the
                  audit log by feature, never with the text. Off by default.
                </span>
              </span>
            </Label>
          </section>

          <section aria-labelledby="keys" className="flex flex-col gap-3">
            <h2 id="keys" className="text-sm font-semibold text-ink">
              Who can administer
            </h2>
            <ul className="divide-y divide-line rounded-xl border border-line">
              {data.privileged.map((person) => (
                <li
                  key={person.id}
                  className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-ink">
                      {person.name}
                    </span>
                    <span className="text-xs text-ink-3">{person.email}</span>
                  </span>
                  <span className="flex items-center gap-2">
                    {!person.verified ? (
                      <span className="rounded-full bg-tint-sun px-2 py-0.5 text-xs">
                        Email not verified
                      </span>
                    ) : null}
                    <span className="rounded-full bg-sunken px-2 py-0.5 text-xs capitalize">
                      {person.role}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          </section>

          {data.staleInvitations.length ? (
            <section aria-labelledby="stale" className="flex flex-col gap-3">
              <h2 id="stale" className="text-sm font-semibold text-ink">
                Invitations still waiting
              </h2>
              <ul className="divide-y divide-line rounded-xl border border-line">
                {data.staleInvitations.map((invite) => (
                  <li
                    key={invite.id}
                    className="flex items-center justify-between gap-4 px-4 py-3 text-sm"
                  >
                    <span className="truncate text-ink">{invite.email}</span>
                    <span className="text-xs text-ink-3">
                      sent {dateFormat.format(new Date(invite.createdAt))}
                    </span>
                  </li>
                ))}
              </ul>
              <Link
                href="/settings/organization/invitations"
                className="text-sm text-ink-2 underline"
              >
                Manage invitations
              </Link>
            </section>
          ) : null}
        </>
      )}
    </Shell>
  );
}
