"use client";

import { useState, type FormEvent } from "react";

import { authClient } from "@zentro/auth/client";
import { useTrpcClient } from "@zentro/api/react";
import { toastError } from "@zentro/ui/index";
import { Button } from "@zentro/ui/shadcn/button";
import { Input } from "@zentro/ui/shadcn/input";

import { paths } from "~/src/lib/paths";

import { SettingsRow, SettingsTile } from "./settings-kit";

/** A person's own copy of their data, and the way to be erased. */
export function PrivacySection() {
  const trpc = useTrpcClient();
  const [busy, setBusy] = useState(false);
  const [confirmEmail, setConfirmEmail] = useState("");

  async function download() {
    setBusy(true);

    try {
      const data = await trpc.privacy.exportMine.query();
      const url = URL.createObjectURL(
        new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }),
      );
      const link = document.createElement("a");

      link.href = url;
      link.download = "my-zentro-data.json";
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      toastError(error, "Could not export your data.");
    } finally {
      setBusy(false);
    }
  }

  async function erase(event: FormEvent) {
    event.preventDefault();
    setBusy(true);

    try {
      await trpc.privacy.eraseMine.mutate({ confirmEmail });
      await authClient.signOut().catch(() => undefined);
      window.location.assign(paths.auth.signIn());
    } catch (error) {
      toastError(error, "Could not erase your account.");
      setBusy(false);
    }
  }

  return (
    <SettingsTile>
      <SettingsRow
        label="Download my data"
        description="A file with your profile and everything you created in this workspace."
      >
        <Button
          variant="outline"
          disabled={busy}
          onClick={() => void download()}
        >
          Download
        </Button>
      </SettingsRow>
      <SettingsRow
        label="Delete my account"
        description="Removes you from this workspace. What you wrote stays, without your name. If this is your only workspace, your account is erased and you are signed out. This cannot be undone."
      >
        <form className="flex flex-wrap items-center gap-2" onSubmit={erase}>
          <Input
            aria-label="Type your email to confirm"
            placeholder="Type your email to confirm"
            className="w-64"
            value={confirmEmail}
            onChange={(e) => setConfirmEmail(e.target.value)}
          />
          <Button
            type="submit"
            variant="destructive"
            disabled={busy || !confirmEmail.trim()}
          >
            Delete my account
          </Button>
        </form>
      </SettingsRow>
    </SettingsTile>
  );
}
