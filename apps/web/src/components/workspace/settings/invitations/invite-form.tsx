"use client";

import { Label } from "@kyren/ui/shadcn/label";
import { useState, type FC, type FormEvent, type KeyboardEvent } from "react";
import { useRouter } from "next/navigation";
import { XIcon } from "lucide-react";
import { useTrpcClient } from "@kyren/api/react";
import { Button } from "@kyren/ui/components/shadcn/button";
import { Input } from "@kyren/ui/components/shadcn/input";
import { Switch } from "@kyren/ui/components/shadcn/switch";
import { toastSuccess } from "@kyren/ui/index";
import { cn } from "@kyren/ui/lib/utils";
import { trpcResult } from "~/src/lib/trpc-result";
import { SettingsError } from "../settings-kit";
import { emailPattern, problemWith, type Role } from "./invitations-helpers";
import { RoleSelect } from "./role-select";

type InviteFormProps = {
  organizationName: string;
};

export const InviteForm: FC<InviteFormProps> = ({ organizationName }) => {
  const [several, setSeveral] = useState(false);
  const [email, setEmail] = useState("");
  const [chips, setChips] = useState<string[]>([]);
  const [draft, setDraft] = useState("");
  const [role, setRole] = useState<Role>("member");
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  const router = useRouter();
  const trpc = useTrpcClient();

  const addChips = (text: string) => {
    const next = text
      .split(/[\s,;]+/)
      .map((value) => value.trim().toLowerCase())
      .filter(Boolean);

    if (next.length === 0) return;
    setChips((current) => [...new Set([...current, ...next])]);
    setDraft("");
    setError(null);
  };

  const invalidChips = chips.filter((chip) => !emailPattern.test(chip));
  const validChips = chips.filter((chip) => emailPattern.test(chip));

  const sendAll = async (emails: string[]) => {
    setSending(true);

    const failed: string[] = [];

    for (const address of emails) {
      const { error: sendError } = await trpcResult(
        trpc.invitation.invite.mutate({ email: address, role }),
      );

      if (sendError) failed.push(`${address}: ${sendError.message}`);
    }

    setSending(false);

    const sentCount = emails.length - failed.length;

    if (failed.length > 0) setError(failed.join(" "));
    if (sentCount > 0) {
      toastSuccess(
        sentCount === 1 ? "Invite sent" : `${sentCount} invites sent`,
        "They have 7 days to accept.",
      );
      router.refresh();
    }

    return failed.length === 0;
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();

    if (several) {
      const pending = draft.trim()
        ? [...chips, ...draft.split(/[\s,;]+/).filter(Boolean)]
        : chips;

      if (draft.trim()) addChips(draft);
      if (pending.length === 0) {
        setError("Paste or type at least one email address.");
        return;
      }

      const bad = pending.filter((chip) => !emailPattern.test(chip));

      if (bad.length > 0) {
        const others = pending.length - bad.length;

        setError(
          `${problemWith(bad[0]!)} Fix it or remove it${
            others > 0 ? ` to send the other ${others}` : ""
          }.`,
        );
        return;
      }

      if (await sendAll(pending.map((chip) => chip.toLowerCase()))) {
        setChips([]);
      }

      return;
    }

    const address = email.trim().toLowerCase();

    if (!address) {
      setError("Enter the email address to invite.");
      return;
    }
    if (!emailPattern.test(address)) {
      setError(problemWith(address));
      return;
    }

    setError(null);
    if (await sendAll([address])) setEmail("");
  };

  const onChipKey = (event: KeyboardEvent<HTMLInputElement>) => {
    if (["Enter", ",", " ", "Tab"].includes(event.key) && draft.trim()) {
      event.preventDefault();
      addChips(draft);
    } else if (event.key === "Backspace" && !draft && chips.length) {
      setChips((current) => current.slice(0, -1));
    }
  };

  const sendCount = several ? validChips.length + invalidChips.length : 1;

  return (
    <form
      noValidate
      onSubmit={submit}
      aria-labelledby="invite-title"
      className="tile flex flex-col gap-4 p-5"
    >
      <div className="flex items-center gap-3">
        <h2 id="invite-title" className="flex-1 font-semibold">
          Invite people
        </h2>
        <Label className="flex items-center gap-2 text-[13px] text-ink-2">
          Several at once
          <Switch
            aria-label="Invite several people at once"
            checked={several}
            onCheckedChange={(checked) => {
              setSeveral(checked);
              setError(null);
            }}
          />
        </Label>
      </div>

      {several ? (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="invite-emails" className="text-sm font-medium">
            Emails
          </Label>
          <div
            className={cn(
              "flex min-h-24 flex-wrap content-start gap-1.5 rounded-md border border-input bg-surface p-2 focus-within:ring-2 focus-within:ring-ring",
              error && "border-danger",
            )}
          >
            {chips.map((chip) => {
              const bad = !emailPattern.test(chip);

              return (
                <span
                  key={chip}
                  className={cn(
                    "inline-flex h-6 items-center gap-1 rounded-sm border px-1.5 font-mono text-xs",
                    bad
                      ? "border-danger bg-danger-subtle text-danger-text"
                      : "border-hairline bg-hover",
                  )}
                >
                  {chip}
                  <Button
                    variant="custom"
                    type="button"
                    aria-label={`Remove ${chip}`}
                    onClick={() =>
                      setChips((current) =>
                        current.filter((value) => value !== chip),
                      )
                    }
                    className="text-ink-3 hover:text-ink"
                  >
                    <XIcon className="size-3" />
                  </Button>
                </span>
              );
            })}
            <Input
              id="invite-emails"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={onChipKey}
              onPaste={(event) => {
                event.preventDefault();
                addChips(event.clipboardData.getData("text"));
              }}
              onBlur={() => addChips(draft)}
              placeholder={
                chips.length ? "" : "Paste or type, separated by commas"
              }
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? "invite-error" : undefined}
              className="h-6 min-w-40 flex-1 bg-transparent font-mono text-xs outline-none placeholder:font-sans placeholder:text-ink-3"
            />
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="invite-email" className="text-sm font-medium">
            Email
          </Label>
          <Input
            id="invite-email"
            type="email"
            value={email}
            onChange={(event) => {
              setEmail(event.target.value);
              setError(null);
            }}
            placeholder="name@company.com"
            autoComplete="email"
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? "invite-error" : undefined}
            className="font-mono text-sm"
          />
        </div>
      )}

      <SettingsError id="invite-error">{error ?? undefined}</SettingsError>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="invite-role" className="text-sm font-medium">
          Role
        </Label>
        <RoleSelect id="invite-role" value={role} onChange={setRole} />
        <p className="text-xs text-ink-3">
          {role === "admin"
            ? `Admins manage people, roles and modules in ${organizationName}.`
            : `Members create tasks and docs and see every open project.`}
        </p>
      </div>

      <div className="flex items-center gap-3 border-t border-hairline pt-4">
        <span className="flex-1 text-xs text-ink-3">
          Invites expire after 7 days.
        </span>
        <Button type="submit" loading={sending}>
          {several && sendCount > 1
            ? `Send ${sendCount} invites`
            : "Send invite"}
        </Button>
      </div>
    </form>
  );
};
