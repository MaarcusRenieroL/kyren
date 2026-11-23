"use client";

import { Label } from "@zentro/ui/shadcn/label";
import { FieldSet, FieldLegend } from "@zentro/ui/shadcn/field";
import { Button } from "@zentro/ui/shadcn/button";
import { HashIcon, LockIcon } from "lucide-react";
import { cn } from "@zentro/ui/lib/utils";
import { Input } from "@zentro/ui/shadcn/input";
import { Textarea } from "@zentro/ui/shadcn/textarea";

import type { ChannelData } from "../channel-view";
import { LinkPicker } from "../pickers";

export function AboutTab({
  channel,
  name,
  setName,
  topic,
  setTopic,
  description,
  setDescription,
  visibility,
  setVisibility,
  fixedLink,
  link,
  setLink,
  canManage,
}: {
  channel: ChannelData;
  name: string;
  setName: (v: string) => void;
  topic: string;
  setTopic: (v: string) => void;
  description: string;
  setDescription: (v: string) => void;
  visibility: "public" | "private";
  setVisibility: (v: "public" | "private") => void;
  fixedLink: boolean;
  link: { type: "team" | "project"; id: string } | null;
  setLink: (v: { type: "team" | "project"; id: string } | null) => void;
  canManage: boolean;
}) {
  return (
    <div className="flex flex-col gap-4">
      <Label className="flex flex-col items-stretch gap-1.5 text-sm font-medium">
        Name
        <Input
          value={name}
          disabled={!canManage}
          onChange={(event) => setName(event.target.value)}
          maxLength={80}
        />
      </Label>
      <Label className="flex flex-col items-stretch gap-1.5 text-sm font-medium">
        Topic
        <Input
          value={topic}
          disabled={!canManage}
          onChange={(event) => setTopic(event.target.value)}
          maxLength={250}
          placeholder="What’s this channel for?"
        />
      </Label>
      <Label className="flex flex-col items-stretch gap-1.5 text-sm font-medium">
        Description
        <Textarea
          value={description}
          disabled={!canManage}
          onChange={(event) => setDescription(event.target.value)}
          rows={3}
          maxLength={2000}
        />
      </Label>
      <FieldSet className="flex flex-col gap-2" disabled={!canManage}>
        <FieldLegend className="mb-1 text-sm font-medium">
          Who can see it
        </FieldLegend>
        <div className="grid gap-2 sm:grid-cols-2">
          {(
            [
              [
                "public",
                "Public",
                "Anyone at the organization can find and join it.",
              ],
              [
                "private",
                "Private",
                "Only invited people can see it or read messages.",
              ],
            ] as const
          ).map(([value, label, hint]) => (
            <Button
              variant="custom"
              key={value}
              type="button"
              role="radio"
              aria-checked={visibility === value}
              onClick={() => setVisibility(value)}
              className={cn(
                "flex flex-col gap-1 rounded-lg border p-3 text-left",
                visibility === value
                  ? "border-ink"
                  : "border-hairline hover:border-ink-3",
              )}
            >
              <span className="flex items-center gap-1.5 text-sm font-medium">
                {value === "private" ? (
                  <LockIcon className="size-3.5" aria-hidden="true" />
                ) : (
                  <HashIcon className="size-3.5" aria-hidden="true" />
                )}
                {label}
              </span>
              <span className="text-[13px] text-ink-2">{hint}</span>
            </Button>
          ))}
        </div>
      </FieldSet>
      <div className="flex flex-col gap-1.5">
        <span className="text-sm font-medium">Link to</span>
        {fixedLink && channel.link ? (
          <p className="rounded-md border border-hairline px-3 py-2 text-sm text-ink-2">
            Discussion of{" "}
            <a
              href={channel.link.href}
              className="font-medium text-signal-strong hover:underline"
            >
              {channel.link.key ? `${channel.link.key} · ` : ""}
              {channel.link.name}
            </a>
            . It follows that {channel.link.type}.
          </p>
        ) : (
          <LinkPicker value={link} onChange={setLink} disabled={!canManage} />
        )}
      </div>
      {!canManage ? (
        <p className="text-[13px] text-ink-3">
          Only channel admins can change these.
        </p>
      ) : null}
    </div>
  );
}
