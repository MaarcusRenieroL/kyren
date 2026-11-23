"use client";

import {
  useCallback,
  useEffect,
  useState,
  type FormEvent,
} from "react";
import { authClient } from "@zentro/auth/client";
import { toastError, toastSuccess } from "@zentro/ui/index";
import { Button } from "@zentro/ui/shadcn/button";
import { Input } from "@zentro/ui/shadcn/input";

import {
  SettingsError,
  SettingsHeader,
  SettingsRow,
  SettingsTile,
} from "../settings-kit";
import {
  ActiveSessionsTile,
  type SessionRow,
} from "./active-sessions-tile";

export function SecuritySection() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [touched, setTouched] = useState({
    current: false,
    next: false,
    confirm: false,
  });
  const [saving, setSaving] = useState(false);
  const [sessions, setSessions] = useState<SessionRow[] | null>(null);
  const [currentToken, setCurrentToken] = useState<string | null>(null);
  const [revoking, setRevoking] = useState<string | null>(null);

  const currentError =
    touched.current && !current ? "Enter your current password." : undefined;
  const nextError = !touched.next
    ? undefined
    : next.length < 8
      ? "Use at least 8 characters."
      : !/\d/.test(next) || !/[a-z]/.test(next) || !/[A-Z]/.test(next)
        ? "Mix upper and lower case letters with at least one number."
        : undefined;
  const confirmError =
    touched.confirm && confirm !== next
      ? "These passwords don’t match. Check both and try again."
      : undefined;

  const loadSessions = useCallback(async () => {
    const [list, active] = await Promise.all([
      authClient.listSessions(),
      authClient.getSession(),
    ]);

    setSessions((list.data as SessionRow[] | null) ?? []);
    setCurrentToken(active.data?.session.token ?? null);
  }, []);

  useEffect(() => {
    void loadSessions().catch(() => setSessions([]));
  }, [loadSessions]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setTouched({ current: true, next: true, confirm: true });

    if (!current || next.length < 8 || nextError || confirm !== next) return;

    setSaving(true);

    const { error } = await authClient.changePassword({
      currentPassword: current,
      newPassword: next,
      revokeOtherSessions: true,
    });

    setSaving(false);

    if (error) {
      toastError(
        error,
        "That current password does not match. Check it and try again.",
      );
      return;
    }

    setCurrent("");
    setNext("");
    setConfirm("");
    setTouched({ current: false, next: false, confirm: false });
    toastSuccess("Password changed", "Other devices were signed out.");
    void loadSessions();
  };

  const revoke = async (token: string) => {
    setRevoking(token);
    const { error } = await authClient.revokeSession({ token });
    setRevoking(null);

    if (error) {
      toastError(error, "Could not sign out that device");
      return;
    }

    toastSuccess("Signed out", "That device no longer has access.");
    await loadSessions();
  };

  return (
    <div className="flex flex-col gap-6">
      <SettingsHeader
        eyebrow="SECURITY"
        title="Password & sessions"
        description="Change your password and see where you’re signed in."
      />

      <form onSubmit={submit} noValidate>
        <SettingsTile>
          <SettingsRow label="Current password" htmlFor="current-password">
            <Input
              id="current-password"
              type="password"
              autoComplete="current-password"
              value={current}
              aria-invalid={Boolean(currentError) || undefined}
              aria-describedby={
                currentError ? "current-password-error" : undefined
              }
              onChange={(event) => setCurrent(event.target.value)}
              onBlur={() =>
                setTouched((state) => ({ ...state, current: true }))
              }
            />
            <SettingsError id="current-password-error">
              {currentError}
            </SettingsError>
          </SettingsRow>
          <SettingsRow label="New password" htmlFor="new-password">
            <Input
              id="new-password"
              type="password"
              autoComplete="new-password"
              value={next}
              aria-invalid={Boolean(nextError) || undefined}
              aria-describedby={nextError ? "new-password-error" : undefined}
              onChange={(event) => setNext(event.target.value)}
              onBlur={() => setTouched((state) => ({ ...state, next: true }))}
            />
            <SettingsError id="new-password-error">{nextError}</SettingsError>
          </SettingsRow>
          <SettingsRow label="Confirm password" htmlFor="confirm-password">
            <Input
              id="confirm-password"
              type="password"
              autoComplete="new-password"
              value={confirm}
              aria-invalid={Boolean(confirmError) || undefined}
              aria-describedby={
                confirmError ? "confirm-password-error" : undefined
              }
              onChange={(event) => setConfirm(event.target.value)}
              onBlur={() =>
                setTouched((state) => ({ ...state, confirm: true }))
              }
            />
            <SettingsError id="confirm-password-error">
              {confirmError}
            </SettingsError>
          </SettingsRow>
          <div className="flex items-center gap-3 bg-sunken/50 px-[22px] py-3.5">
            <p className="text-[13px] text-ink-3">
              Changing it signs you out everywhere else.
            </p>
            <span className="flex-1" />
            <Button
              type="submit"
              variant="outline"
              loading={saving}
              disabled={!current || !next || !confirm}
            >
              Update password
            </Button>
          </div>
        </SettingsTile>
      </form>

      <ActiveSessionsTile
        sessions={sessions}
        currentToken={currentToken}
        revoking={revoking}
        onRevoke={revoke}
        onRefresh={loadSessions}
      />
    </div>
  );
}
