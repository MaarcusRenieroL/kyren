import type { ReactNode } from "react";
import { cn } from "@kyren/ui/lib/utils";
import {
  Select,
  SelectContent,
  SelectTrigger,
  SelectValue,
} from "@kyren/ui/shadcn/select";

/** One filter as a 32px chip: its name, then its value once it is set. */
export function FilterChip({
  label,
  active,
  value,
  onValueChange,
  display,
  children,
  icon,
  ariaLabel,
  showValue = false,
}: {
  label: string;
  active: boolean;
  value: string;
  onValueChange: (value: string) => void;
  display: string;
  children: ReactNode;
  icon?: ReactNode;
  ariaLabel?: string;
  showValue?: boolean;
}) {
  return (
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger
        aria-label={ariaLabel ?? label}
        className={cn(
          "h-8 shrink-0 gap-1.5 rounded-xl border-hairline bg-transparent px-2.5 text-[13px] shadow-none data-[size=default]:h-8",
          active && "bg-surface",
        )}
      >
        {icon}
        <span className="text-ink-3">{label}</span>
        <SelectValue>
          {/* A filter shows its value only once it is set. */}
          {active || showValue ? (
            <span className="font-medium text-ink">{display}</span>
          ) : null}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>{children}</SelectContent>
    </Select>
  );
}
