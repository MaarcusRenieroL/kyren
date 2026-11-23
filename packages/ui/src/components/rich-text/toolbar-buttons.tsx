"use client";

import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { Button } from "../shadcn/button";
import { DropdownMenuItem } from "../shadcn/dropdown-menu";

export function MoreItem({
  icon: Icon,
  label,
  hint,
  disabled,
  onSelect,
}: {
  icon: LucideIcon;
  label: string;
  hint?: string;
  disabled?: boolean;
  onSelect: () => void;
}) {
  return (
    <DropdownMenuItem disabled={disabled} onSelect={onSelect} className="gap-2">
      <Icon className="size-4" aria-hidden="true" />
      {label}
      {hint ? (
        <span className="ml-auto font-mono text-[11px] text-ink-3">{hint}</span>
      ) : null}
    </DropdownMenuItem>
  );
}

export type ToolbarButtonProps = {
  label: string;
  active?: boolean;
  disabled?: boolean;
  children: ReactNode;
  onClick: () => void;
};

export function ToolbarButton({
  label,
  active = false,
  disabled = false,
  children,
  onClick,
}: ToolbarButtonProps) {
  return (
    <Button
      type="button"
      variant={active ? "secondary" : "ghost"}
      size="icon-sm"
      className="size-8"
      disabled={disabled}
      aria-label={label}
      title={label}
      onClick={onClick}
    >
      {children}
    </Button>
  );
}
