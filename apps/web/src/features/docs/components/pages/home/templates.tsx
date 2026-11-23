"use client";

import { useState, type FC } from "react";
import { useRouter } from "next/navigation";
import { ArrowRightIcon, ChevronDownIcon, ChevronUpIcon } from "lucide-react";

import { useTrpcClient } from "@kyren/api/react";
import { toastError } from "@kyren/ui/index";
import { cn } from "@kyren/ui/lib/utils";
import { Button } from "@kyren/ui/shadcn/button";

import { useReachable } from "~/src/components/permissions/permission-provider";
import { paths } from "~/src/lib/paths";
import { createDocSlug } from "../../../lib/docs";
import { templates, type TemplateItem } from "./templates-data";

export { templates };

export const TemplateRow: FC = () => {
  const trpc = useTrpcClient();
  const router = useRouter();
  const canCreate = useReachable("docs.create");
  const [busy, setBusy] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);

  if (!canCreate) return null;

  const start = async (template: TemplateItem) => {
    if (busy) return;

    setBusy(template.id);

    try {
      const doc = await trpc.docs.create.mutate({
        title: template.title,
        content: template.content,
        slug: `${createDocSlug(template.title)}-${Date.now().toString(36)}`,
      });

      router.push(paths.doc(doc.slug));
    } catch (error) {
      toastError(
        "Could not create the doc",
        error instanceof Error ? error.message : "Please try again.",
      );
      setBusy(null);
    }
  };

  const displayedTemplates = expanded ? templates : templates.slice(0, 4);

  return (
    <section aria-label="Start from a template" className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-ink-3">
            Quick Start Blueprints
          </h2>
          <span className="text-[11px] text-ink-3">
            ({templates.length} templates)
          </span>
        </div>
        <Button
          variant="ghost"
          size="xs"
          onClick={() => setExpanded((prev) => !prev)}
          className="text-xs text-ink-3 hover:text-ink gap-1 h-7"
        >
          {expanded ? (
            <>
              Show less <ChevronUpIcon className="size-3" />
            </>
          ) : (
            <>
              Show all templates <ChevronDownIcon className="size-3" />
            </>
          )}
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {displayedTemplates.map((template) => {
          const Icon = template.icon;
          return (
            <Button
              variant="custom"
              key={template.id}
              type="button"
              disabled={Boolean(busy)}
              onClick={() => void start(template)}
              className="group relative flex flex-col justify-between rounded-2xl border border-hairline bg-surface p-5 text-left shadow-xs transition-all hover:border-hairline-strong hover:shadow-sm hover:-translate-y-0.5 focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60 dark:shadow-[inset_0_1px_0_0_rgba(255,255,255,0.08)] cursor-pointer"
            >
              <div>
                <div className="flex items-center justify-between gap-2 mb-3">
                  <div
                    className={cn(
                      "flex size-9 items-center justify-center rounded-xl border shadow-2xs",
                      template.accent,
                    )}
                  >
                    <Icon className="size-4" />
                  </div>
                  <span className="rounded-md border border-hairline bg-sunken/60 px-2 py-0.5 font-mono text-[10px] font-semibold text-ink-3">
                    {template.badge}
                  </span>
                </div>
                <h3 className="text-[14px] font-semibold text-ink group-hover:text-signal transition-colors tracking-tight line-clamp-1">
                  {busy === template.id ? "Creating…" : template.title}
                </h3>
                <p className="mt-1.5 line-clamp-2 text-xs text-ink-2 leading-relaxed">
                  {template.hint}
                </p>
              </div>

              <div className="mt-4 flex items-center justify-between pt-3 border-t border-hairline/60 text-xs font-semibold text-ink-3 group-hover:text-signal transition-colors">
                <span>Start blueprint</span>
                <ArrowRightIcon className="size-3.5 transition-transform group-hover:translate-x-1" />
              </div>
            </Button>
          );
        })}
      </div>
    </section>
  );
};
