"use client";

import { useState } from "react";
import { Badge } from "@kyren/ui/shadcn/badge";
import { Button } from "@kyren/ui/shadcn/button";
import { Input } from "@kyren/ui/shadcn/input";
import { Label } from "@kyren/ui/shadcn/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@kyren/ui/shadcn/select";

import { useCatalog } from "./use-catalog";

export type Override = {
  id: string;
  permission: string;
  effect: "allow" | "deny";
  scopeType: string;
  reason: string | null;
};

type Props = {
  overrides: Override[];
  canOverride: boolean;
  userId: string;
  organizationId: string;
  onRemoveOverride: (id: string) => Promise<void>;
  onSaveOverride: (input: {
    permission: string;
    effect: "allow" | "deny";
    reason?: string;
  }) => Promise<void>;
};

export function MemberOverridesSection({
  overrides,
  canOverride,
  organizationId,
  onRemoveOverride,
  onSaveOverride,
}: Props) {
  const catalog = useCatalog();
  const [permission, setPermission] = useState("");
  const [effect, setEffect] = useState<"allow" | "deny">("deny");
  const [reason, setReason] = useState("");

  const handleSave = async () => {
    await onSaveOverride({
      permission,
      effect,
      reason: reason || undefined,
    });
    setPermission("");
    setReason("");
  };

  return (
    <section className="space-y-3">
      <h3 className="text-sm font-semibold">Permission overrides</h3>
      <ul className="divide-y rounded-md border">
        {overrides.length ? (
          overrides.map((override) => (
            <li
              key={override.id}
              className="flex items-center justify-between gap-3 px-3 py-2 text-sm"
            >
              <span>
                <Badge
                  variant={
                    override.effect === "deny" ? "destructive" : "default"
                  }
                >
                  {override.effect}
                </Badge>{" "}
                {override.permission}
                {override.reason ? (
                  <span className="text-muted-foreground">
                    {" "}
                    · {override.reason}
                  </span>
                ) : null}
              </span>
              {canOverride ? (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onRemoveOverride(override.id)}
                >
                  Remove
                </Button>
              ) : null}
            </li>
          ))
        ) : (
          <li className="px-3 py-4 text-center text-sm text-muted-foreground">
            No overrides.
          </li>
        )}
      </ul>
      {canOverride ? (
        <div className="grid gap-2 md:grid-cols-[1fr_8rem]">
          <Select value={permission} onValueChange={setPermission}>
            <SelectTrigger aria-label="Permission to override">
              <SelectValue placeholder="Permission" />
            </SelectTrigger>
            <SelectContent>
              {(catalog ?? [])
                .filter((entry) => entry.enabled && !entry.ownerOnly)
                .map((entry) => (
                  <SelectItem key={entry.key} value={entry.key}>
                    {entry.label}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
          <Select
            value={effect}
            onValueChange={(value) => setEffect(value as "allow" | "deny")}
          >
            <SelectTrigger aria-label="Override effect">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="allow">Allow</SelectItem>
              <SelectItem value="deny">Deny</SelectItem>
            </SelectContent>
          </Select>
          <div className="space-y-1 md:col-span-2">
            <Label htmlFor="override-reason">Reason (optional)</Label>
            <Input
              id="override-reason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
            />
          </div>
          <Button
            className="md:col-span-2"
            disabled={!permission || !organizationId}
            onClick={handleSave}
          >
            Save override
          </Button>
        </div>
      ) : null}
    </section>
  );
}
