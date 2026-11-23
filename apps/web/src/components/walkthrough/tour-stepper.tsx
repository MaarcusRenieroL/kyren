"use client";

import { useState, useEffect } from "react";
import { ChevronLeftIcon, ChevronRightIcon, CheckIcon } from "lucide-react";

import { Button } from "@kyren/ui/shadcn/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@kyren/ui/shadcn/dialog";
import { Badge } from "@kyren/ui/shadcn/badge";
import { cn } from "@kyren/ui/lib/utils";
import { tours, type TourStep, type TourDefinition } from "./tour-definitions";

export type { TourStep, TourDefinition };
export { tours };

export function TourStepper({
  tourId = "general",
  open,
  onOpenChange,
}: {
  tourId?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [currentStep, setCurrentStep] = useState(0);

  const tour = tours[tourId] ?? tours.general!;
  const steps = tour.steps;
  const isFirst = currentStep === 0;
  const isLast = currentStep === steps.length - 1;

  // Reset to first step whenever reopened
  useEffect(() => {
    if (open) {
      setCurrentStep(0);
    }
  }, [open]);

  // Keyboard navigation: ArrowRight / ArrowLeft / Escape
  useEffect(() => {
    if (!open) return;

    function handleKey(e: KeyboardEvent) {
      if (e.key === "ArrowRight") {
        if (!isLast) setCurrentStep((p) => p + 1);
        else onOpenChange(false);
      } else if (e.key === "ArrowLeft") {
        if (!isFirst) setCurrentStep((p) => p - 1);
      }
    }

    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [open, isFirst, isLast, onOpenChange]);

  const step = steps[currentStep] ?? steps[0]!;
  const IconComponent = tour.icon;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md p-0 overflow-hidden border-hairline">
        {/* Module Header Bar */}
        <div className="flex items-center gap-2.5 border-b border-hairline bg-surface-subtle px-5 py-3">
          <span className="flex size-7 items-center justify-center rounded-lg bg-signal/15 text-signal">
            <IconComponent className="size-4" />
          </span>
          <span className="text-xs font-semibold uppercase tracking-wider text-ink-3">
            {tour.moduleName} Tour
          </span>
          <div className="ml-auto flex items-center gap-1 font-mono text-xs text-ink-3">
            <span>{currentStep + 1}</span>
            <span>/</span>
            <span>{steps.length}</span>
          </div>
        </div>

        {/* Step Content */}
        <div className="flex flex-col gap-4 p-5">
          <DialogHeader className="gap-1.5 text-left">
            <div className="flex items-center gap-2">
              <DialogTitle className="text-base font-semibold text-ink">
                {step.title}
              </DialogTitle>
              {step.badge ? (
                <Badge variant="outline" className="text-[10px] uppercase">
                  {step.badge}
                </Badge>
              ) : null}
            </div>
            <DialogDescription className="text-xs leading-relaxed text-ink-2">
              {step.description}
            </DialogDescription>
          </DialogHeader>

          {/* Feature Bullet Points */}
          {step.bullets && step.bullets.length > 0 ? (
            <div className="flex flex-col gap-2 rounded-lg border border-hairline/80 bg-surface-subtle/50 p-3">
              {step.bullets.map((bullet, idx) => (
                <div key={idx} className="flex items-start gap-2 text-xs">
                  <CheckIcon className="size-3.5 mt-0.5 shrink-0 text-signal" />
                  <span className="text-ink-2">{bullet}</span>
                </div>
              ))}
            </div>
          ) : null}

          {/* Stepper Dots Indicator */}
          <div className="flex items-center justify-center gap-1.5 py-1">
            {steps.map((_, idx) => (
              <Button
                variant="custom"
                key={idx}
                type="button"
                onClick={() => setCurrentStep(idx)}
                aria-label={`Go to tour step ${idx + 1}`}
                aria-current={idx === currentStep ? "step" : undefined}
                className={cn(
                  "h-1.5 rounded-full transition-all",
                  idx === currentStep
                    ? "w-6 bg-signal"
                    : "w-1.5 bg-hairline hover:bg-ink-3",
                )}
              />
            ))}
          </div>
        </div>

        {/* Footer Navigation */}
        <DialogFooter className="flex flex-row items-center justify-between border-t border-hairline bg-surface-subtle px-5 py-3 sm:justify-between">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onOpenChange(false)}
            className="text-xs text-ink-3 hover:text-ink"
          >
            Skip Tour
          </Button>

          <div className="flex items-center gap-2">
            {!isFirst ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentStep((p) => p - 1)}
                className="gap-1 text-xs"
              >
                <ChevronLeftIcon className="size-3.5" />
                Back
              </Button>
            ) : null}

            <Button
              size="sm"
              onClick={() => {
                if (!isLast) {
                  setCurrentStep((p) => p + 1);
                } else {
                  onOpenChange(false);
                }
              }}
              className="gap-1 text-xs"
            >
              {isLast ? "Done" : "Next"}
              {!isLast ? <ChevronRightIcon className="size-3.5" /> : null}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
