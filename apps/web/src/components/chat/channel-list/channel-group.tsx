"use client";

import { Button } from "@kyren/ui/shadcn/button";
import { useState, type ReactNode } from "react";
import { ChevronDownIcon } from "lucide-react";
import { cn } from "@kyren/ui/lib/utils";

export function Group({
  label,
  action,
  children,
}: {
  label: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(true);

  return (
    <section aria-label={label} className="flex flex-col gap-0.5">
      <div className="flex items-center gap-1 px-2 pt-3 pb-1">
        <Button
          variant="custom"
          type="button"
          aria-expanded={open}
          onClick={() => setOpen((value) => !value)}
          className="eyebrow flex flex-1 items-center gap-1 rounded-xs text-left outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <ChevronDownIcon
            className={cn("size-3 transition-transform", !open && "-rotate-90")}
            aria-hidden="true"
          />
          {label}
        </Button>
        {action}
      </div>
      {open ? children : null}
    </section>
  );
}
