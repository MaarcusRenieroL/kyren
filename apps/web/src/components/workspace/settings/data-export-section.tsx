"use client";

import { useState } from "react";
import { DownloadIcon } from "lucide-react";

import { useTrpcClient } from "@zentro/api/react";
import { toastError } from "@zentro/ui/index";
import { Button } from "@zentro/ui/shadcn/button";

import { SettingsRow, SettingsTile } from "./settings-kit";

/** Downloads what the signed-in person wrote or created in this organization. */
export function DataExportSection() {
  const trpc = useTrpcClient();
  const [busy, setBusy] = useState(false);

  async function download() {
    setBusy(true);
    try {
      const data = await trpc.user.exportMyData.query();
      const url = URL.createObjectURL(
        new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }),
      );
      const link = document.createElement("a");

      link.href = url;
      link.download = `my-data-${new Date().toISOString().slice(0, 10)}.json`;
      link.click();
      URL.revokeObjectURL(url);
    } catch {
      toastError("Could not export your data", "Try again in a moment.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <SettingsTile>
      <SettingsRow
        label="Your data"
        description="Your tasks, comments, chat messages and docs in this organization, as a JSON file."
      >
        <div>
          <Button
            variant="outline"
            disabled={busy}
            onClick={() => void download()}
          >
            <DownloadIcon aria-hidden />
            {busy ? "Preparing…" : "Download my data"}
          </Button>
        </div>
      </SettingsRow>
    </SettingsTile>
  );
}
