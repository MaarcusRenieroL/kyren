"use client";

import { XIcon } from "lucide-react";
import { Button } from "@zentro/ui/shadcn/button";
import { Input } from "@zentro/ui/shadcn/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@zentro/ui/shadcn/select";
import { Textarea } from "@zentro/ui/shadcn/textarea";
import { emailError, type Invite } from "./create-org-types";

type StepTeammatesProps = {
  invites: Invite[];
  setInvites: React.Dispatch<React.SetStateAction<Invite[]>>;
  nextId: number;
  setNextId: React.Dispatch<React.SetStateAction<number>>;
  pasting: boolean;
  setPasting: (v: boolean) => void;
  pasted: string;
  setPasted: (v: string) => void;
};

export function StepTeammates({
  invites,
  setInvites,
  nextId,
  setNextId,
  pasting,
  setPasting,
  pasted,
  setPasted,
}: StepTeammatesProps) {
  const updateInvite = (id: number, patch: Partial<Invite>) =>
    setInvites((rows) =>
      rows.map((row) => (row.id === id ? { ...row, ...patch } : row)),
    );

  const addPasted = () => {
    const emails = pasted
      .split(/[\s,;]+/)
      .map((value) => value.trim())
      .filter(Boolean);
    let id = nextId;
    const added = emails.map((email) => ({
      id: id++,
      email,
      role: "member" as const,
      error: emailError(email),
    }));

    setNextId(id);
    setInvites((rows) => [...rows.filter((row) => row.email.trim()), ...added]);
    setPasted("");
    setPasting(false);
  };

  return (
    <div className="tile flex flex-col gap-2.5 p-[22px]">
      <div className="grid grid-cols-[minmax(0,1fr)_120px_32px] gap-2 text-[13px] font-medium sm:grid-cols-[minmax(0,1fr)_140px_32px]">
        <span>Email</span>
        <span>Role</span>
        <span />
      </div>
      {invites.map((row, index) => (
        <div key={row.id} className="flex flex-col gap-1.5">
          <div className="grid grid-cols-[minmax(0,1fr)_120px_32px] items-center gap-2 sm:grid-cols-[minmax(0,1fr)_140px_32px]">
            <Input
              type="email"
              value={row.email}
              placeholder="name@company.com"
              aria-label={`Teammate ${index + 1} email`}
              aria-invalid={Boolean(row.error) || undefined}
              className="font-mono text-sm"
              onChange={(event) =>
                updateInvite(row.id, {
                  email: event.target.value,
                  error: undefined,
                })
              }
              onBlur={() =>
                updateInvite(row.id, { error: emailError(row.email) })
              }
            />
            <Select
              value={row.role}
              onValueChange={(role) =>
                updateInvite(row.id, { role: role as Invite["role"] })
              }
            >
              <SelectTrigger
                aria-label={`Teammate ${index + 1} role`}
                className="w-full"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="admin">Admin</SelectItem>
                <SelectItem value="member">Member</SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant="custom"
              type="button"
              aria-label={`Remove teammate ${index + 1}`}
              disabled={invites.length === 1}
              onClick={() =>
                setInvites((rows) => rows.filter((item) => item.id !== row.id))
              }
              className="flex size-8 items-center justify-center justify-self-center rounded-md text-ink-3 outline-none hover:bg-hover hover:text-ink focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-40"
            >
              <XIcon className="size-3.5" />
            </Button>
          </div>
          {row.error ? (
            <p role="alert" className="text-[13px] leading-5 text-danger-text">
              {row.error}
            </p>
          ) : null}
        </div>
      ))}

      {pasting ? (
        <div className="flex flex-col gap-2 pt-1">
          <Textarea
            value={pasted}
            onChange={(event) => setPasted(event.target.value)}
            placeholder="Paste emails separated by commas, spaces or new lines"
            aria-label="Emails to add"
            className="min-h-24 font-mono text-sm"
          />
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={addPasted}>
              Add these
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setPasting(false)}>
              Cancel
            </Button>
          </div>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 pt-1 text-[13px]">
        <Button
          variant="custom"
          type="button"
          onClick={() => {
            setInvites((rows) => [
              ...rows,
              { id: nextId, email: "", role: "member" },
            ]);
            setNextId((value) => value + 1);
          }}
          className="rounded-xs text-signal underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        >
          Add another
        </Button>
        <Button
          variant="custom"
          type="button"
          onClick={() => setPasting(true)}
          className="rounded-xs text-signal underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        >
          Paste a list of emails
        </Button>
        <span className="flex-1" />
        <span className="text-ink-3">Invites expire after 7 days.</span>
      </div>
    </div>
  );
}
