import * as React from "react";
import { cn } from "@kyren/ui/lib/utils";
import { ChevronDownIcon } from "lucide-react";

export interface NativeSelectProps extends Omit<
  React.SelectHTMLAttributes<HTMLSelectElement>,
  "size"
> {
  size?: "default" | "sm";
}

export const NativeSelect = React.forwardRef<
  HTMLSelectElement,
  NativeSelectProps
>(({ className, size = "default", children, ...props }, ref) => {
  return (
    <div className="relative inline-flex w-full items-center">
      <select
        ref={ref}
        data-slot="native-select"
        className={cn(
          "flex w-full appearance-none rounded-md border border-border-strong bg-surface py-1 pr-8 pl-3 text-sm text-ink transition-colors outline-none select-none",
          "focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30",
          "disabled:cursor-not-allowed disabled:opacity-50",
          size === "default"
            ? "h-(--control-h)"
            : "h-[calc(var(--control-h)-4px)]",
          className,
        )}
        {...props}
      >
        {children}
      </select>
      <ChevronDownIcon className="pointer-events-none absolute right-2.5 size-4 text-muted-foreground" />
    </div>
  );
});
NativeSelect.displayName = "NativeSelect";
