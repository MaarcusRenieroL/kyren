"use client";

import { Button } from "@kyren/ui/shadcn/button";
import { useEffect, useState, type ReactNode } from "react";
import { useTheme } from "next-themes";
import { useDensity } from "@kyren/ui/components/appearance";
import { StatusGlyph } from "@kyren/ui/components/status-glyph";
import { TaskKey } from "@kyren/ui/components/task-key";
import { cn } from "@kyren/ui/lib/utils";
import { parseDensity, type Density } from "@kyren/ui/lib/theme-colors";

import { SettingsHeader, SettingsRow, SettingsTile } from "../settings-kit";

type ThemeChoice = "light" | "dark" | "system";

/**
 * A 96px miniature of the app in the theme it names. Each pane wears the
 * `.light` or `.dark` token scope, so it shows that theme whatever is active.
 */
function ThemePreview({ mode }: { mode: ThemeChoice }) {
  const pane = (dark: boolean) => (
    <div
      className={cn(
        dark ? "dark" : "light",
        "flex h-full flex-1 flex-col gap-1.5 bg-canvas p-2",
      )}
    >
      <span className="h-1.5 w-8 rounded-full bg-ink" />
      {[0, 1, 2].map((row) => (
        <span
          key={row}
          className="flex h-3.5 items-center gap-1 rounded bg-surface px-1"
        >
          <span
            className={cn(
              "size-1.5 rounded-full",
              row === 0 ? "bg-signal" : "bg-status-todo",
            )}
          />
          <span className="h-1 flex-1 rounded-full bg-hairline" />
        </span>
      ))}
    </div>
  );

  return (
    <div
      aria-hidden="true"
      className="flex h-24 overflow-hidden rounded-lg border border-hairline"
    >
      {mode === "system" ? (
        <>
          {pane(false)}
          {pane(true)}
        </>
      ) : (
        pane(mode === "dark")
      )}
    </div>
  );
}

function ChoiceCard({
  selected,
  label,
  description,
  onSelect,
  children,
}: {
  selected: boolean;
  label: string;
  description?: string;
  onSelect: () => void;
  children: ReactNode;
}) {
  return (
    <Button
      variant="custom"
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      className={cn(
        "flex flex-col gap-2.5 rounded-xl border bg-surface p-3 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring",
        selected
          ? "border-[1.5px] border-signal ring-4 ring-signal/20"
          : "border-hairline hover:border-line-strong",
      )}
    >
      {children}
      <span className="flex items-center gap-2">
        <span
          aria-hidden="true"
          className={cn(
            "size-4 shrink-0 rounded-full border",
            selected ? "border-[5px] border-signal" : "border-line-strong",
          )}
        />
        <span className="flex flex-col">
          <span className="text-sm font-medium">{label}</span>
          {description ? (
            <span className="text-xs text-ink-3">{description}</span>
          ) : null}
        </span>
      </span>
    </Button>
  );
}

function DensityPreview({ density }: { density: Density }) {
  const rows = density === "comfortable" ? 3 : 5;
  const height = density === "comfortable" ? "h-[30px]" : "h-5";

  return (
    <div
      aria-hidden="true"
      className="flex h-24 flex-col overflow-hidden rounded-lg border border-hairline bg-canvas"
    >
      {Array.from({ length: rows }).map((_, index) => (
        <span
          key={index}
          className={cn(
            "flex shrink-0 items-center gap-1.5 border-b border-hairline px-2 last:border-b-0",
            height,
          )}
        >
          <span className="size-2 rounded-full bg-status-todo" />
          <span className="h-1 flex-1 rounded-full bg-line-strong/60" />
        </span>
      ))}
    </div>
  );
}

export function AppearanceSection() {
  const { theme, setTheme } = useTheme();
  const [density, setDensity] = useDensity();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const currentTheme = (
    mounted ? (theme ?? "system") : "system"
  ) as ThemeChoice;

  return (
    <div className="flex flex-col gap-6">
      <SettingsHeader
        eyebrow="ACCOUNT"
        title="Appearance"
        description="Changes apply right away. There’s nothing to save."
      />

      <SettingsTile>
        <SettingsRow
          label="Theme"
          description="Follows your system unless you choose."
        >
          <div
            role="radiogroup"
            aria-label="Theme"
            className="grid gap-3 sm:grid-cols-3"
          >
            {(
              [
                ["light", "Light"],
                ["dark", "Dark"],
                ["system", "Match system"],
              ] as const
            ).map(([value, label]) => (
              <ChoiceCard
                key={value}
                label={label}
                selected={currentTheme === value}
                onSelect={() => setTheme(value)}
              >
                <ThemePreview mode={value} />
              </ChoiceCard>
            ))}
          </div>
        </SettingsRow>
        <SettingsRow label="Density" description="Changes row height only.">
          <div
            role="radiogroup"
            aria-label="Density"
            className="grid gap-3 sm:grid-cols-2"
          >
            {(
              [
                ["comfortable", "Comfortable", "Roomy rows, 44px and up"],
                ["compact", "Compact", "Fits more on screen, 32px rows"],
              ] as const
            ).map(([value, label, hint]) => (
              <ChoiceCard
                key={value}
                label={label}
                description={hint}
                selected={density === value}
                onSelect={() => setDensity(parseDensity(value))}
              >
                <DensityPreview density={value} />
              </ChoiceCard>
            ))}
          </div>
        </SettingsRow>
      </SettingsTile>

      <section aria-label="Preview" className="flex flex-col gap-2">
        <p className="eyebrow">Preview</p>
        <div className="tile overflow-hidden">
          <p className="flex items-center gap-2 px-4 pt-3 pb-1 text-sm font-medium">
            <StatusGlyph status="in-progress" size={14} decorative />
            In progress
            <span className="font-mono text-xs text-ink-3">2</span>
          </p>
          <ul>
            {[
              [
                "in-progress",
                "ZEN-18",
                "Fix login redirect loop on expired sessions",
              ],
              ["in-progress", "ZEN-22", "Retry failed webhook deliveries"],
            ].map(([status, key, title]) => (
              <li
                key={key}
                className="flex h-(--row-h) items-center gap-3 border-t border-hairline/60 px-4"
              >
                <StatusGlyph status={status!} size={16} />
                <TaskKey>{key}</TaskKey>
                <span className="truncate text-sm text-ink">{title}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </div>
  );
}
