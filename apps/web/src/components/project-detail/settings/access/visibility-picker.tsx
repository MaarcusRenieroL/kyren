import { Button } from "@kyren/ui/shadcn/button";
import type { FC } from "react";
import { cn } from "@kyren/ui/index";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@kyren/ui/shadcn/select";
import {
  field,
  noTeam,
  visibilityCards,
  type Option,
  type Visibility,
} from "./types";

type VisibilityPickerProps = {
  visibility: Visibility;
  onVisibilityChange: (value: Visibility) => void;
  teamId: string;
  onTeamIdChange: (value: string) => void;
  teamOptions: Option[];
  canManage: boolean;
};

export const VisibilityPicker: FC<VisibilityPickerProps> = ({
  visibility,
  onVisibilityChange,
  teamId,
  onTeamIdChange,
  teamOptions,
  canManage,
}) => {
  return (
    <>
      <section className="flex flex-col gap-2.5">
        <h2 className="text-[15px] font-semibold">Who can see this project</h2>
        <div
          role="radiogroup"
          aria-label="Project visibility"
          className="grid gap-3 md:grid-cols-3"
        >
          {(Object.keys(visibilityCards) as Visibility[]).map((key) => {
            const card = visibilityCards[key];
            const on = visibility === key;

            return (
              <Button
                variant="custom"
                key={key}
                type="button"
                role="radio"
                aria-checked={on}
                disabled={!canManage}
                onClick={() => onVisibilityChange(key)}
                className={cn(
                  "flex items-start gap-3 rounded-xl border p-4 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-default",
                  on
                    ? "border-signal bg-selected"
                    : "border-hairline bg-surface hover:border-ink-3",
                )}
              >
                <span
                  aria-hidden="true"
                  className={cn(
                    "mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border-[1.5px]",
                    on ? "border-signal" : "border-line-strong",
                  )}
                >
                  {on ? (
                    <span className="size-2 rounded-full bg-signal" />
                  ) : null}
                </span>
                <span className="flex flex-col gap-1">
                  <span className="flex items-center gap-2 text-sm font-semibold">
                    <card.Icon className="size-3.5" aria-hidden="true" />
                    {card.title}
                  </span>
                  <span className="text-[13px] leading-5 text-ink-2">
                    {card.body}
                  </span>
                </span>
              </Button>
            );
          })}
        </div>
      </section>

      <section className="flex max-w-[420px] flex-col gap-1.5">
        <h2 className="text-[15px] font-semibold">Owning team</h2>
        <Select
          value={teamId}
          onValueChange={(value) => value !== "" && onTeamIdChange(value)}
          disabled={!canManage}
        >
          <SelectTrigger aria-label="Owning team" className={field}>
            <span
              aria-hidden="true"
              className="size-2.5 rounded-[3px] border border-hairline bg-tint-teams"
            />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={noTeam}>No team</SelectItem>
            {teamOptions.map((team) => (
              <SelectItem key={team.id} value={team.id}>
                {team.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-[13px] text-ink-3">
          {visibility === "team"
            ? "Members of the owning team can see this project."
            : "The owning team is who this project belongs to."}{" "}
          A role given to a person below applies on top of it.
        </p>
      </section>
    </>
  );
};
