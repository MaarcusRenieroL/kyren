"use client";

import { Button } from "@kyren/ui/shadcn/button";
import { useState, useEffect } from "react";
import { SparklesIcon } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@kyren/ui/shadcn/sheet";
import { Tabs, TabsList, TabsTrigger } from "@kyren/ui/shadcn/tabs";
import { usePermission } from "~/src/components/permissions/permission-provider";
import { SearchTab } from "./ai-copilot/search-tab";
import { MicroOpsTab } from "./ai-copilot/microops-tab";
import { CustodianTab } from "./ai-copilot/custodian-tab";

export function AiCopilotBubble() {
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("search");
  // The sweep rewrites links across the organization, so only admins run it.
  const canSweep = usePermission("org.settings.update");

  // Keyboard shortcut: Cmd/Ctrl + J to toggle
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "j") {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <>
      {/* In the top bar, so it never sits on top of a page's content. */}
      <Button
        variant="custom"
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Open AI Copilot"
        title="AI Copilot"
        className="flex size-8 items-center justify-center rounded-md text-signal outline-none transition-colors hover:bg-hover focus-visible:ring-2 focus-visible:ring-ring"
      >
        <SparklesIcon className="size-4" />
      </Button>

      {/* Copilot Drawer Sheet */}
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side="right"
          className="flex w-full flex-col sm:max-w-md p-0"
        >
          <SheetHeader className="border-b border-hairline p-4 pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="flex size-7 items-center justify-center rounded-lg bg-signal/15 text-signal">
                  <SparklesIcon className="size-4" />
                </span>
                <SheetTitle className="text-base font-semibold">
                  Kyren Copilot
                </SheetTitle>
              </div>
            </div>
            <SheetDescription className="text-xs text-ink-3">
              Search the work you can see, quick keyword estimates, and
              workspace upkeep.
            </SheetDescription>
          </SheetHeader>

          <Tabs
            value={activeTab}
            onValueChange={setActiveTab}
            className="flex flex-1 flex-col overflow-hidden"
          >
            <TabsList
              className={`grid ${canSweep ? "grid-cols-3" : "grid-cols-2"} border-b border-hairline bg-surface-subtle p-1 rounded-none`}
            >
              <TabsTrigger value="search" className="text-xs">
                Context
              </TabsTrigger>
              <TabsTrigger value="microops" className="text-xs">
                Micro-Ops
              </TabsTrigger>
              {canSweep ? (
                <TabsTrigger value="custodian" className="text-xs">
                  Custodian
                </TabsTrigger>
              ) : null}
            </TabsList>

            <SearchTab onClose={() => setOpen(false)} />
            <MicroOpsTab />
            {canSweep ? <CustodianTab /> : null}
          </Tabs>
        </SheetContent>
      </Sheet>
    </>
  );
}
