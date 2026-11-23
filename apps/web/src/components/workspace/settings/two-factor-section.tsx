"use client";

import { Label } from "@kyren/ui/shadcn/label";
import { useEffect, useState, type FormEvent } from "react";

import { authClient } from "@kyren/auth/client";
import { toastSuccess } from "@kyren/ui/index";
import { Button } from "@kyren/ui/shadcn/button";
import { Input } from "@kyren/ui/shadcn/input";

import { SettingsRow, SettingsTile } from "./settings-kit";

type Setup = { secret: string; uri: string; backupCodes: string[] };

/** The key inside an otpauth:// link, for typing into an authenticator app. */
export function secretFromUri(uri: string) {
  try {
    return new URL(uri).searchParams.get("secret") ?? "";
  } catch {
    return "";
  }
}

export function TwoFactorSection() {
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [setup, setSetup] = useState<Setup | null>(null);
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void authClient
      .getSession()
      .then((result) => setEnabled(Boolean(result.data?.user.twoFactorEnabled)))
      .catch(() => setEnabled(false));
  }, []);

  function reset() {
    setPassword("");
    setCode("");
    setSetup(null);
    setAsking(false);
    setError(null);
  }

  async function start(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);

    const { data, error: failure } = await authClient.twoFactor.enable({
      password,
    });

    setBusy(false);

    if (failure || !data || !("totpURI" in data)) {
      setError("That password didn’t match.");
      return;
    }

    setSetup({
      secret: secretFromUri(data.totpURI),
      uri: data.totpURI,
      backupCodes: data.backupCodes,
    });
    setPassword("");
  }

  async function confirm(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);

    const { error: failure } = await authClient.twoFactor.verifyTotp({
      code: code.trim(),
    });

    setBusy(false);

    if (failure) {
      setError("That code didn’t work. Check the time on your phone.");
      return;
    }

    setEnabled(true);
    reset();
    toastSuccess("Two-factor sign-in is on");
  }

  async function turnOff(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);

    const { error: failure } = await authClient.twoFactor.disable({ password });

    setBusy(false);

    if (failure) {
      setError("That password didn’t match.");
      return;
    }

    setEnabled(false);
    reset();
    toastSuccess("Two-factor sign-in is off");
  }

  if (enabled === null) return null;

  return (
    <SettingsTile>
      <SettingsRow
        label="Two-factor sign-in"
        description="Ask for a code from an authenticator app after your password."
      >
        {setup ? (
          <form onSubmit={confirm} className="flex max-w-md flex-col gap-3">
            <p className="text-sm text-ink">
              In your authenticator app, add an account with this key, then
              enter the 6-digit code it shows.
            </p>
            <code
              aria-label="Setup key"
              className="rounded-lg bg-sunken px-3 py-2 font-mono text-sm break-all"
            >
              {setup.secret}
            </code>
            <div>
              <p className="text-sm font-medium text-ink">Backup codes</p>
              <p className="text-[13px] text-ink-3">
                Save these now. Each works once if you lose your phone. They
                won’t be shown again.
              </p>
              <ul
                aria-label="Backup codes"
                className="mt-2 grid grid-cols-2 gap-1 font-mono text-sm"
              >
                {setup.backupCodes.map((backup) => (
                  <li key={backup}>{backup}</li>
                ))}
              </ul>
            </div>
            <Label className="flex flex-col items-stretch gap-1.5 text-sm">
              <span className="text-ink-2">6-digit code</span>
              <Input
                inputMode="numeric"
                autoComplete="one-time-code"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                aria-invalid={Boolean(error) || undefined}
              />
            </Label>
            {error ? (
              <p role="alert" className="text-[13px] text-danger-text">
                {error}
              </p>
            ) : null}
            <div className="flex gap-2">
              <Button type="submit" disabled={busy || !code.trim()}>
                Turn on
              </Button>
              <Button type="button" variant="ghost" onClick={reset}>
                Cancel
              </Button>
            </div>
          </form>
        ) : asking ? (
          <form
            onSubmit={enabled ? turnOff : start}
            className="flex max-w-xs flex-col gap-3"
          >
            <Label className="flex flex-col items-stretch gap-1.5 text-sm">
              <span className="text-ink-2">
                Confirm your password to continue
              </span>
              <Input
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                aria-invalid={Boolean(error) || undefined}
              />
            </Label>
            {error ? (
              <p role="alert" className="text-[13px] text-danger-text">
                {error}
              </p>
            ) : null}
            <div className="flex gap-2">
              <Button type="submit" disabled={busy || !password}>
                {enabled ? "Turn off" : "Continue"}
              </Button>
              <Button type="button" variant="ghost" onClick={reset}>
                Cancel
              </Button>
            </div>
          </form>
        ) : (
          <div className="flex items-center gap-3">
            <span className="text-sm text-ink">{enabled ? "On" : "Off"}</span>
            <Button
              variant="outline"
              onClick={() => {
                setAsking(true);
                setError(null);
              }}
            >
              {enabled ? "Turn off" : "Set up"}
            </Button>
          </div>
        )}
      </SettingsRow>
    </SettingsTile>
  );
}
