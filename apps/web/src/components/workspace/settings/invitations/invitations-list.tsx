"use client";

import { useState, type FC } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2Icon, CircleDashedIcon, CircleIcon } from "lucide-react";
import { useTrpcClient } from "@zentro/api/react";
import { Button } from "@zentro/ui/components/shadcn/button";
import { toastError, toastSuccess } from "@zentro/ui/index";
import { cn } from "@zentro/ui/lib/utils";
import { usePermission } from "~/src/components/permissions/permission-provider";
import { trpcResult } from "~/src/lib/trpc-result";
import {
  capitalize,
  DAY,
  shortDate,
  stateOf,
  type InvitationRow,
} from "./invitations-helpers";

type InvitationsListProps = {
  invitations: InvitationRow[];
  canInvite: boolean;
};

export const InvitationsList: FC<InvitationsListProps> = ({
  invitations,
  canInvite,
}) => {
  const canResend = usePermission("invitations.resend");
  const canCancel = usePermission("invitations.cancel");
  const [busyId, setBusyId] = useState<string | null>(null);

  const router = useRouter();
  const trpc = useTrpcClient();
  const now = Date.now();

  const sent = invitations.filter(
    (invitation) =>
      invitation.status === "pending" || invitation.status === "accepted",
  );
  const pendingCount = sent.filter(
    (invitation) => stateOf(invitation, now) === "pending",
  ).length;

  const act = async (id: string, kind: "resend" | "cancel") => {
    setBusyId(id);

    try {
      const { error: actError } =
        kind === "resend"
          ? await trpcResult(
              trpc.invitation.resend.mutate({ invitationId: id }),
            )
          : await trpcResult(
              trpc.invitation.cancel.mutate({ invitationId: id }),
            );

      if (actError) {
        toastError(actError.statusText, actError.message);
        return;
      }

      toastSuccess(
        kind === "resend" ? "Invite sent again" : "Invite cancelled",
        kind === "resend"
          ? "It's good for another 7 days."
          : "The link no longer works.",
      );
      router.refresh();
    } finally {
      setBusyId(null);
    }
  };

  return (
    <section
      aria-labelledby="sent-title"
      className={cn("flex flex-col gap-2", !canInvite && "lg:col-span-2")}
    >
      <h2 id="sent-title" className="flex items-center gap-2 font-semibold">
        Sent invites
        <span className="font-mono text-xs font-normal text-ink-3">
          {pendingCount}
        </span>
      </h2>

      {sent.length > 0 ? (
        <ul className="flex flex-col">
          {sent.map((invitation) => {
            const state = stateOf(invitation, now);
            const left = invitation.expiresAt
              ? Math.ceil(
                  (new Date(invitation.expiresAt).getTime() - now) / DAY,
                )
              : null;
            const busy = busyId === invitation.id;

            return (
              <li
                key={invitation.id}
                className="flex flex-col gap-2 border-b border-hairline/60 py-3"
              >
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <div className="min-w-0 flex-[1_1_14rem]">
                    <p className="truncate font-mono text-sm">
                      {invitation.email}
                    </p>
                    <p suppressHydrationWarning className="text-xs text-ink-3">
                      {capitalize(invitation.role)}
                      {invitation.inviterName
                        ? ` · invited by ${invitation.inviterName.split(" ")[0]}, ${shortDate(invitation.createdAt)}`
                        : ` · ${shortDate(invitation.createdAt)}`}
                    </p>
                  </div>

                  {state === "pending" ? (
                    <span className="inline-flex items-center gap-1 rounded-sm border border-hairline px-1.5 py-px text-[11px] text-ink-2">
                      <CircleIcon className="size-3" aria-hidden="true" />
                      Pending
                    </span>
                  ) : state === "expired" ? (
                    <span className="inline-flex items-center gap-1 rounded-sm border border-danger/50 bg-danger-subtle px-1.5 py-px text-[11px] text-danger-text">
                      <CircleDashedIcon
                        className="size-3"
                        aria-hidden="true"
                      />
                      Expired
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-sm border border-hairline px-1.5 py-px text-[11px] text-ink-2">
                      <CheckCircle2Icon
                        className="size-3 text-success-text"
                        aria-hidden="true"
                      />
                      Accepted
                    </span>
                  )}

                  <span
                    suppressHydrationWarning
                    className={cn(
                      "w-32 font-mono text-xs text-ink-3",
                      state === "pending" &&
                        left !== null &&
                        left <= 3 &&
                        "text-warning-text",
                      state === "expired" && "text-danger-text",
                    )}
                  >
                    {state === "accepted"
                      ? `Joined ${shortDate(invitation.createdAt)}`
                      : state === "expired"
                        ? shortDate(invitation.expiresAt!)
                        : left === null
                          ? "No expiry"
                          : `Expires in ${left} ${left === 1 ? "day" : "days"}`}
                  </span>

                  {state === "expired" && canResend ? (
                    <Button
                      variant="outline"
                      size="sm"
                      loading={busy}
                      onClick={() => act(invitation.id, "resend")}
                    >
                      Resend
                    </Button>
                  ) : null}
                </div>

                {state === "pending" && (canResend || canCancel) ? (
                  <div className="flex gap-1">
                    {canResend ? (
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={busy}
                        onClick={() => act(invitation.id, "resend")}
                      >
                        Resend
                      </Button>
                    ) : null}
                    {canCancel ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={busy}
                        onClick={() => act(invitation.id, "cancel")}
                      >
                        Cancel
                      </Button>
                    ) : null}
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-line-strong px-6 py-14 text-center">
          <p className="font-display font-semibold text-xl tracking-tight text-ink">
            No invites waiting.
          </p>
          <p className="max-w-[380px] text-[15px] leading-[22px] text-ink-2">
            Invites you send show up here until they&apos;re accepted or expire
            after 7 days.
          </p>
        </div>
      )}
    </section>
  );
};
