"use client";

import { useState, type FormEvent } from "react";
import { LockIcon } from "lucide-react";
import { authClient } from "@kyren/auth/client";
import { toastError, toastSuccess } from "@kyren/ui/index";
import { Input } from "@kyren/ui/shadcn/input";

import {
  SettingsError,
  SettingsFooter,
  SettingsHeader,
  SettingsRow,
  SettingsTile,
} from "../settings-kit";

export function ProfileSection({
  name,
  email,
  organizationName,
}: {
  name: string;
  email: string;
  organizationName: string;
}) {
  const [saved, setSaved] = useState(name);
  const [value, setValue] = useState(name);
  const [touched, setTouched] = useState(false);
  const [saving, setSaving] = useState(false);
  const invalid = value.trim().length < 2;
  const error =
    touched && invalid
      ? "Add your name. Teammates see it on tasks, comments and mentions."
      : undefined;
  const dirty = value.trim() !== saved;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setTouched(true);

    if (invalid) return;

    setSaving(true);

    const { error: failure } = await authClient.updateUser({
      name: value.trim(),
    });

    setSaving(false);

    if (failure) {
      toastError(failure, "Could not save your name");
      return;
    }

    setSaved(value.trim());
    toastSuccess("Saved", "Your name is updated.");
  };

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-6">
      <SettingsHeader
        eyebrow="ACCOUNT"
        title="Profile"
        description={`How you appear to people in ${organizationName}.`}
      />
      <SettingsTile>
        <SettingsRow label="Full name" htmlFor="profile-name">
          <Input
            id="profile-name"
            value={value}
            autoComplete="name"
            aria-invalid={Boolean(error) || undefined}
            aria-describedby={error ? "profile-name-error" : undefined}
            onChange={(event) => setValue(event.target.value)}
            onBlur={() => setTouched(true)}
          />
          <SettingsError id="profile-name-error">{error}</SettingsError>
        </SettingsRow>
        <SettingsRow label="Email" htmlFor="profile-email">
          <div className="relative">
            <Input
              id="profile-email"
              value={email}
              readOnly
              aria-describedby="profile-email-hint"
              className="bg-hover pr-9 font-mono text-sm"
            />
            <LockIcon
              className="absolute top-1/2 right-3 size-3.5 -translate-y-1/2 text-ink-3"
              aria-hidden="true"
            />
          </div>
          <p
            id="profile-email-hint"
            className="text-[13px] leading-5 text-ink-3"
          >
            Your email is how you sign in, so it can’t be changed here.
          </p>
        </SettingsRow>
        <SettingsFooter
          dirty={dirty}
          changes={dirty ? 1 : 0}
          errors={touched && invalid ? 1 : 0}
          saving={saving}
          onDiscard={() => {
            setValue(saved);
            setTouched(false);
          }}
        />
      </SettingsTile>
    </form>
  );
}
