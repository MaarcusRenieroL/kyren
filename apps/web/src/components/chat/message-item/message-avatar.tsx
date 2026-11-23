"use client";

import { ActorAvatar } from "~/src/components/actor-avatar";
import { cn } from "@zentro/ui/lib/utils";
import { presenceDot } from "./message-item-types";

export function Avatar({
  name,
  presence,
  size = 36,
}: {
  name: string;
  presence?: "active" | "away" | "offline";
  size?: number;
}) {
  return (
    <span className="relative inline-flex shrink-0">
      <ActorAvatar name={name} size={size} />
      {presence ? (
        <span
          role="img"
          aria-label={
            presence === "active"
              ? "Active now"
              : presence === "away"
                ? "Away"
                : "Offline"
          }
          className={cn(
            "absolute -right-0.5 -bottom-0.5 size-2.5 rounded-full ring-2 ring-canvas",
            presenceDot[presence],
          )}
        />
      ) : null}
    </span>
  );
}
