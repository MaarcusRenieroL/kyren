"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeftIcon } from "lucide-react";

import { useTrpcClient } from "@zentro/api/react";
import { EmptyState } from "@zentro/ui/components/empty-state";
import { PageHeader } from "@zentro/ui/components/page-header";
import { toastError, toastSuccess } from "@zentro/ui/index";
import { Button } from "@zentro/ui/shadcn/button";

import { useAsyncData } from "~/src/lib/use-async-data";

import { parseTaskCsv, type ParsedImport } from "./import-rows";

const selectClass =
  "h-9 w-full max-w-xs rounded-lg border border-line bg-surface px-2.5 text-sm text-ink outline-none focus-visible:ring-2 focus-visible:ring-ring";

export function ImportTasks() {
  const trpc = useTrpcClient();
  const router = useRouter();
  const [projectId, setProjectId] = useState("");
  const [parsed, setParsed] = useState<ParsedImport | null>(null);
  const [fileName, setFileName] = useState("");
  const [busy, setBusy] = useState(false);
  const {
    data: projects,
    status,
    reload,
  } = useAsyncData(() => trpc.project.getProjectsByOrgId.query(), [trpc]);

  async function readFile(file: File | undefined) {
    if (!file) return;
    setFileName(file.name);
    setParsed(parseTaskCsv(await file.text()));
  }

  async function submit() {
    if (!parsed || !projectId || parsed.error) return;
    setBusy(true);
    try {
      const { created } = await trpc.task.importTasks.mutate({
        projectId,
        rows: parsed.rows,
      });

      toastSuccess(`Imported ${created} task${created === 1 ? "" : "s"}`);
      router.push("/tasks");
    } catch (error) {
      toastError(
        "Could not import the tasks",
        error instanceof Error ? error.message : "Try again.",
      );
    } finally {
      setBusy(false);
    }
  }

  if (status === "error")
    return (
      <div className="p-6">
        <EmptyState
          title="Projects did not load"
          description="Check your connection and try again."
          action={<Button onClick={reload}>Retry</Button>}
        />
      </div>
    );

  const ready = Boolean(parsed && !parsed.error && projectId);

  return (
    <div className="flex min-w-0 flex-1 flex-col gap-6 overflow-y-auto p-6">
      <PageHeader
        breadcrumbs={
          <Link
            href="/tasks"
            className="inline-flex items-center gap-1 text-sm text-ink-2 hover:underline"
          >
            <ArrowLeftIcon className="size-3.5" aria-hidden />
            Tasks
          </Link>
        }
        title="Import tasks"
        description="Upload a CSV with a Name column. Description, Status, Priority and Due date (YYYY-MM-DD) are optional."
      />

      <div className="flex max-w-xl flex-col gap-4">
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="text-ink-2">Project</span>
          <select
            className={selectClass}
            value={projectId}
            onChange={(e) => setProjectId(e.target.value)}
          >
            <option value="">Choose a project</option>
            {(projects ?? []).map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1.5 text-sm">
          <span className="text-ink-2">CSV file</span>
          <input
            type="file"
            accept=".csv,text/csv"
            className="text-sm"
            onChange={(e) => void readFile(e.target.files?.[0])}
          />
        </label>

        {parsed?.error ? (
          <p role="alert" className="text-sm text-danger-text">
            {parsed.error}
          </p>
        ) : parsed ? (
          <div role="status" className="flex flex-col gap-2 text-sm">
            <p className="text-ink">
              {fileName}: {parsed.rows.length} task
              {parsed.rows.length === 1 ? "" : "s"} ready.
            </p>
            <ul className="list-disc pl-5 text-ink-2">
              {parsed.rows.slice(0, 5).map((row, i) => (
                <li key={i}>{row.name}</li>
              ))}
              {parsed.rows.length > 5 ? (
                <li>and {parsed.rows.length - 5} more</li>
              ) : null}
            </ul>
            {parsed.warnings.length ? (
              <ul className="list-disc pl-5 text-xs text-warning-text">
                {parsed.warnings.slice(0, 8).map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}

        <div>
          <Button disabled={!ready || busy} onClick={() => void submit()}>
            {busy ? "Importing…" : "Import tasks"}
          </Button>
        </div>
      </div>
    </div>
  );
}
