"use client";

import { useState } from "react";
import { TooltipProvider } from "@zentro/ui/shadcn/tooltip";
import { ControlsSpecimens } from "./controls-specimens";
import { DataSpecimens } from "./data-specimens";
import { OverlaySpecimens } from "./overlay-specimens";

export function Specimens() {
  const [tab, setTab] = useState("one");

  return (
    <TooltipProvider>
      <div className="space-y-8">
        <ControlsSpecimens tab={tab} setTab={setTab} />
        <DataSpecimens tab={tab} setTab={setTab} />
        <OverlaySpecimens />
      </div>
    </TooltipProvider>
  );
}
