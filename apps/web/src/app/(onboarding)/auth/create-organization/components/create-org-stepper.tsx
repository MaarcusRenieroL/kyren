"use client";

import Link from "next/link";
import { CheckIcon } from "lucide-react";
import { Logo } from "@kyren/ui/components/logo";
import { cn } from "@kyren/ui/lib/utils";
import { paths } from "~/src/lib/paths";

export const steps = ["Workspace", "Teammates", "Modules"] as const;

export function Stepper({ step }: { step: number }) {
  return (
    <ol className="flex flex-1 items-center justify-center gap-2.5">
      {steps.map((label, index) => {
        const number = index + 1;
        const done = number < step;
        const current = number === step;

        return (
          <li key={label} className="flex items-center gap-2.5">
            <span
              aria-current={current ? "step" : undefined}
              className={cn(
                "flex items-center gap-2 text-sm",
                current
                  ? "font-medium text-ink"
                  : done
                    ? "text-ink"
                    : "text-ink-3",
              )}
            >
              <span
                className={cn(
                  "flex size-[22px] items-center justify-center rounded-full font-mono text-[11px]",
                  done && "bg-success font-bold text-on-success",
                  current && "bg-ink text-ink-inverse",
                  !done && !current && "border border-hairline",
                )}
              >
                {done ? (
                  <CheckIcon className="size-3" strokeWidth={3} />
                ) : (
                  number
                )}
              </span>
              <span className="hidden sm:inline">{label}</span>
            </span>
            {index < steps.length - 1 ? (
              <span
                aria-hidden="true"
                className="h-px w-6 bg-line-strong sm:w-10"
              />
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}

export function CreateOrgHeader({
  step,
  email,
}: {
  step: number;
  email: string;
}) {
  return (
    <header className="flex h-16 items-center gap-4 border-b border-hairline px-5 sm:px-8">
      <Link href={paths.home()} aria-label="Kyren home" className="w-fit">
        <Logo />
      </Link>
      <Stepper step={step} />
      <span className="hidden font-mono text-xs text-ink-3 md:block">
        {email}
      </span>
    </header>
  );
}
