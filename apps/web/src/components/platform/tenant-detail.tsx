"use client";

import { useState } from "react";
import Link from "next/link";
import { useTrpcClient } from "@zentro/api/react";
import { InlineAlert } from "@zentro/ui/components/inline-alert";
import { toastError, toastSuccess } from "@zentro/ui/index";
import { Button } from "@zentro/ui/shadcn/button";
import { useAsyncData } from "~/src/lib/use-async-data";
import {
  Failed,
  Title,
  formatBytes,
  formatDate,
} from "./common";
import { Panel } from "./tenant-detail/panel";
import { InspectionPanel, type InspectionData } from "./tenant-detail/inspection-panel";
import { DeletionPanel } from "./tenant-detail/deletion-panel";
import { TenantActionsPanel } from "./tenant-detail/tenant-actions-panel";
import { FeatureFlagsPanel, LimitsPanel } from "./tenant-detail/tenant-config-panels";

export function TenantDetail({ id }: { id: string }) {
  const trpc = useTrpcClient();
  const detail = useAsyncData(
    () => trpc.platform.tenants.get.query({ id }),
    [id],
  );
  const [busy, setBusy] = useState(false);
  const [reason, setReason] = useState("");
  const [flagsText, setFlagsText] = useState<string | null>(null);
  const [members, setMembers] = useState<string | null>(null);
  const [storage, setStorage] = useState<string | null>(null);
  const [inspection, setInspection] = useState<InspectionData | null>(null);

  async function run(work: () => Promise<unknown>, done: string) {
    setBusy(true);
    try {
      await work();
      toastSuccess(done);
      detail.reload();
    } catch (error) {
      toastError(error, "That did not work.");
    } finally {
      setBusy(false);
    }
  }

  if (detail.status === "error") return <Failed error={detail.error} />;
  if (!detail.data) return <p className="text-sm text-ink-2">Loading…</p>;

  const { organization, owners, usage, history } = detail.data;
  const flagsValue =
    flagsText ?? JSON.stringify(organization.featureFlags, null, 2);
  const membersValue = members ?? String(organization.limits.members ?? "");
  const storageValue = storage ?? String(organization.limits.storageMb ?? "");
  const needsReason = reason.trim().length < 3;

  return (
    <>
      <Title
        title={organization.name}
        description={`${organization.slug} · created ${formatDate(organization.createdAt)}`}
        actions={
          <Link href="/platform" className="text-sm text-ink-2 hover:text-ink">
            ← All tenants
          </Link>
        }
      />

      {organization.deletionScheduledFor ? (
        <InlineAlert tone="danger" title="Scheduled for deletion">
          Everything is purged on{" "}
          {formatDate(organization.deletionScheduledFor)}. Until then the
          organization is locked and can be restored.
          <div className="mt-2">
            <Button
              size="sm"
              disabled={busy}
              onClick={() =>
                void run(
                  () => trpc.platform.tenants.cancelDeletion.mutate({ id }),
                  "Deletion canceled",
                )
              }
            >
              Cancel deletion and reactivate
            </Button>
          </div>
        </InlineAlert>
      ) : organization.suspendedAt ? (
        <InlineAlert tone="warning" title="Suspended">
          {organization.suspendedReason ?? "No reason given."} Since{" "}
          {formatDate(organization.suspendedAt)}.
        </InlineAlert>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Usage">
          <dl className="grid grid-cols-2 gap-2 text-sm">
            <dt className="text-ink-2">Members</dt>
            <dd>{usage.members}</dd>
            <dt className="text-ink-2">Projects</dt>
            <dd>{usage.projects}</dd>
            <dt className="text-ink-2">Tasks</dt>
            <dd>{usage.tasks}</dd>
            <dt className="text-ink-2">Files</dt>
            <dd>
              {usage.files} · {formatBytes(usage.storageBytes)}
            </dd>
            <dt className="text-ink-2">Owners</dt>
            <dd>
              {owners.length
                ? owners.map((owner) => owner.email).join(", ")
                : "—"}
            </dd>
          </dl>
        </Panel>

        <TenantActionsPanel
          reason={reason}
          setReason={setReason}
          busy={busy}
          needsReason={needsReason}
          isSuspended={Boolean(organization.suspendedAt)}
          hasDeletionScheduled={Boolean(organization.deletionScheduledFor)}
          onInspect={() =>
            void run(async () => {
              setInspection(
                await trpc.platform.tenants.inspect.mutate({ id, reason }),
              );
            }, "Opened read-only view")
          }
          onExport={() =>
            void run(async () => {
              const dump = await trpc.platform.tenants.export.mutate({
                id,
                reason,
              });
              const url = URL.createObjectURL(
                new Blob([JSON.stringify(dump, null, 2)], {
                  type: "application/json",
                }),
              );
              const link = document.createElement("a");
              link.href = url;
              link.download = `${organization.slug}-export.json`;
              link.click();
              URL.revokeObjectURL(url);
            }, "Export downloaded")
          }
          onSuspend={() =>
            void run(
              () => trpc.platform.tenants.suspend.mutate({ id, reason }),
              "Suspended",
            )
          }
          onReactivate={() =>
            void run(
              () => trpc.platform.tenants.reactivate.mutate({ id }),
              "Reactivated",
            )
          }
        />

        <FeatureFlagsPanel
          flagsValue={flagsValue}
          setFlagsText={setFlagsText}
          busy={busy}
          onSaveFlags={() =>
            void run(async () => {
              const flags = JSON.parse(flagsValue || "{}") as Record<
                string,
                boolean
              >;
              await trpc.platform.tenants.setFlags.mutate({ id, flags });
              setFlagsText(null);
            }, "Flags saved")
          }
        />

        <LimitsPanel
          membersValue={membersValue}
          setMembers={setMembers}
          storageValue={storageValue}
          setStorage={setStorage}
          busy={busy}
          onSaveLimits={() =>
            void run(async () => {
              await trpc.platform.tenants.setLimits.mutate({
                id,
                members: membersValue.trim() ? Number(membersValue) : null,
                storageMb: storageValue.trim() ? Number(storageValue) : null,
              });
              setMembers(null);
              setStorage(null);
            }, "Limits saved")
          }
        />
      </div>

      {inspection ? <InspectionPanel inspection={inspection} /> : null}

      {!organization.deletionScheduledFor ? (
        <DeletionPanel
          organizationSlug={organization.slug}
          busy={busy}
          onScheduleDeletion={(confirmSlug) =>
            void run(
              () =>
                trpc.platform.tenants.requestDeletion.mutate({
                  id,
                  confirmSlug,
                }),
              "Deletion scheduled",
            )
          }
        />
      ) : null}

      <Panel title="Operator history">
        <ul className="text-sm">
          {history.map((event) => (
            <li key={event.id} className="text-ink-2">
              {formatDate(event.createdAt)} · {event.actorEmail} ·{" "}
              {event.action}
            </li>
          ))}
          {!history.length ? (
            <li className="text-ink-2">Nothing yet.</li>
          ) : null}
        </ul>
      </Panel>
    </>
  );
}
