"use client";

import { useState } from "react";
import Link from "next/link";

import { useTrpcClient } from "@zentro/api/react";
import { InlineAlert } from "@zentro/ui/components/inline-alert";
import { toastError, toastSuccess } from "@zentro/ui/index";
import { Button } from "@zentro/ui/shadcn/button";
import { Input } from "@zentro/ui/shadcn/input";

import { useAsyncData } from "~/src/lib/use-async-data";
import {
  Failed,
  Title,
  cell,
  formatBytes,
  formatDate,
  headCell,
  tableClass,
} from "./common";

function Panel({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3 rounded-xl border border-line p-4">
      <h2 className="text-sm font-semibold">{title}</h2>
      {children}
    </section>
  );
}

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
  const [slug, setSlug] = useState("");
  const [inspection, setInspection] = useState<Awaited<
    ReturnType<typeof trpc.platform.tenants.inspect.mutate>
  > | null>(null);

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

        <Panel title="A reason for the actions below">
          <p className="text-sm text-ink-2">
            Looking inside, exporting and suspending are written to the audit
            trail with this reason.
          </p>
          <Input
            aria-label="Reason"
            placeholder="e.g. Support ticket 1234"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
          />
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={busy || needsReason}
              onClick={() =>
                void run(async () => {
                  setInspection(
                    await trpc.platform.tenants.inspect.mutate({ id, reason }),
                  );
                }, "Opened read-only view")
              }
            >
              Look inside (read-only)
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={busy || needsReason}
              onClick={() =>
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
            >
              Export data
            </Button>
            {!organization.suspendedAt ? (
              <Button
                size="sm"
                variant="outline"
                disabled={busy || needsReason}
                onClick={() =>
                  void run(
                    () => trpc.platform.tenants.suspend.mutate({ id, reason }),
                    "Suspended",
                  )
                }
              >
                Suspend
              </Button>
            ) : !organization.deletionScheduledFor ? (
              <Button
                size="sm"
                disabled={busy}
                onClick={() =>
                  void run(
                    () => trpc.platform.tenants.reactivate.mutate({ id }),
                    "Reactivated",
                  )
                }
              >
                Reactivate
              </Button>
            ) : null}
          </div>
        </Panel>

        <Panel title="Feature flags">
          <p className="text-sm text-ink-2">
            A JSON object of flag names to true or false.
          </p>
          <textarea
            aria-label="Feature flags"
            className="min-h-24 rounded-lg border border-line bg-canvas p-2 font-mono text-xs"
            value={flagsValue}
            onChange={(event) => setFlagsText(event.target.value)}
          />
          <div>
            <Button
              size="sm"
              disabled={busy}
              onClick={() =>
                void run(async () => {
                  const flags = JSON.parse(flagsValue || "{}") as Record<
                    string,
                    boolean
                  >;

                  await trpc.platform.tenants.setFlags.mutate({ id, flags });
                  setFlagsText(null);
                }, "Flags saved")
              }
            >
              Save flags
            </Button>
          </div>
        </Panel>

        <Panel title="Limits">
          <p className="text-sm text-ink-2">
            Leave a box empty for the default. Members counts open invitations.
          </p>
          <div className="flex flex-wrap gap-2">
            <Input
              aria-label="Member limit"
              placeholder="Members"
              className="w-32"
              inputMode="numeric"
              value={membersValue}
              onChange={(event) => setMembers(event.target.value)}
            />
            <Input
              aria-label="Storage limit in MB"
              placeholder="Storage (MB)"
              className="w-40"
              inputMode="numeric"
              value={storageValue}
              onChange={(event) => setStorage(event.target.value)}
            />
            <Button
              size="sm"
              disabled={busy}
              onClick={() =>
                void run(async () => {
                  await trpc.platform.tenants.setLimits.mutate({
                    id,
                    members: membersValue.trim() ? Number(membersValue) : null,
                    storageMb: storageValue.trim()
                      ? Number(storageValue)
                      : null,
                  });
                  setMembers(null);
                  setStorage(null);
                }, "Limits saved")
              }
            >
              Save limits
            </Button>
          </div>
        </Panel>
      </div>

      {inspection ? (
        <Panel title={`Read-only view of ${inspection.organization.name}`}>
          <p className="text-sm text-ink-2">
            {inspection.people.length} people · {inspection.pendingInvitations}{" "}
            pending invitations · {inspection.projects.length} projects
          </p>
          <table className={tableClass}>
            <thead>
              <tr>
                <th className={headCell}>Person</th>
                <th className={headCell}>Role</th>
                <th className={headCell}>Joined</th>
              </tr>
            </thead>
            <tbody>
              {inspection.people.map((person) => (
                <tr key={person.email}>
                  <td className={cell}>
                    {person.name}
                    <div className="text-xs text-ink-2">{person.email}</div>
                  </td>
                  <td className={cell}>{person.role}</td>
                  <td className={cell}>{formatDate(person.joinedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="text-sm text-ink-2">
            Projects:{" "}
            {inspection.projects.map((p) => p.name).join(", ") || "none"}
          </p>
          <p className="text-sm text-ink-2">
            Modules off:{" "}
            {inspection.modules
              .filter((m) => !m.enabled)
              .map((m) => m.moduleId)
              .join(", ") || "none"}
          </p>
          <ul className="text-sm">
            {inspection.recent.map((event, index) => (
              <li key={index} className="text-ink-2">
                {formatDate(event.createdAt)} · {event.action} ·{" "}
                {event.targetLabel ?? event.targetType}
              </li>
            ))}
          </ul>
        </Panel>
      ) : null}

      {!organization.deletionScheduledFor ? (
        <Panel title="Delete this organization">
          <p className="text-sm text-ink-2">
            Locks the organization now and permanently deletes everything after
            14 days. Export the data first if the customer may want it. Type the
            slug <span className="font-mono">{organization.slug}</span> to
            confirm.
          </p>
          <div className="flex flex-wrap gap-2">
            <Input
              aria-label="Confirm slug"
              className="w-56"
              value={slug}
              onChange={(event) => setSlug(event.target.value)}
            />
            <Button
              size="sm"
              variant="outline"
              disabled={busy || slug !== organization.slug}
              onClick={() =>
                void run(
                  () =>
                    trpc.platform.tenants.requestDeletion.mutate({
                      id,
                      confirmSlug: slug,
                    }),
                  "Deletion scheduled",
                )
              }
            >
              Schedule deletion
            </Button>
          </div>
        </Panel>
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
