"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeftIcon } from "lucide-react";

import { useTrpcClient } from "@zentro/api/react";
import { PageHeader } from "@zentro/ui/components/page-header";
import { toastError, toastSuccess } from "@zentro/ui/index";
import { Button } from "@zentro/ui/shadcn/button";

import { parsePeopleCsv, type ParsedPeople } from "./import-rows";

export function ImportPeople() {
  const trpc = useTrpcClient();
  const router = useRouter();
  const [parsed, setParsed] = useState<ParsedPeople | null>(null);
  const [fileName, setFileName] = useState("");
  const [busy, setBusy] = useState(false);

  async function readFile(file: File | undefined) {
    if (!file) return;
    setFileName(file.name);
    setParsed(parsePeopleCsv(await file.text()));
  }

  async function submit() {
    if (!parsed || parsed.error) return;
    setBusy(true);
    try {
      const { created, skipped } = await trpc.hr.importEmployees.mutate({
        rows: parsed.rows,
      });

      toastSuccess(
        `Added ${created} ${created === 1 ? "person" : "people"}`,
        skipped ? `${skipped} already on file were skipped.` : undefined,
      );
      router.push("/hr");
    } catch (error) {
      toastError(
        "Could not import the people",
        error instanceof Error ? error.message : "Try again.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-w-0 flex-1 flex-col gap-6 overflow-y-auto p-6">
      <PageHeader
        breadcrumbs={
          <Link
            href="/hr"
            className="inline-flex items-center gap-1 text-sm text-ink-2 hover:underline"
          >
            <ArrowLeftIcon className="size-3.5" aria-hidden />
            People
          </Link>
        }
        title="Import people"
        description="Upload a CSV with a Name column. Email, Job title, Department, Location and Start date (YYYY-MM-DD) are optional. People whose email is already on file are skipped."
      />

      <div className="flex max-w-xl flex-col gap-4">
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
              {fileName}: {parsed.rows.length}{" "}
              {parsed.rows.length === 1 ? "person" : "people"} ready.
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
          <Button
            disabled={!parsed || Boolean(parsed.error) || busy}
            onClick={() => void submit()}
          >
            {busy ? "Importing…" : "Import people"}
          </Button>
        </div>
      </div>
    </div>
  );
}
