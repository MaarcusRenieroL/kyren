"use client";

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  type ReactNode,
} from "react";
import { DownloadIcon, PlusIcon } from "lucide-react";
import { Button } from "@zentro/ui/shadcn/button";

export const FramedContext = createContext(false);
export const useFramed = () => useContext(FramedContext);

export type FrameAction = {
  label: string;
  onClick: () => void;
  /** "outline" with a download icon for secondary actions like exports. */
  kind?: "create" | "export";
} | null;

export const FrameActionContext = createContext<(action: FrameAction) => void>(
  () => undefined,
);

/**
 * Puts a page's main action ("New role") in the frame's header, next to the
 * title. Outside a frame it does nothing and returns false, so the page shows
 * its own button.
 */
export function useFrameAction(
  label: string | null,
  onClick: () => void,
  kind: "create" | "export" = "create",
) {
  const framed = useFramed();
  const set = useContext(FrameActionContext);
  const latest = useRef(onClick);

  useEffect(() => {
    latest.current = onClick;
  });

  useEffect(() => {
    if (!framed || !label) return;

    set({ label, kind, onClick: () => latest.current() });

    return () => set(null);
  }, [framed, label, kind, set]);

  return framed && Boolean(label);
}

export function FrameActionButton({ action }: { action: FrameAction }) {
  if (!action) return null;

  if (action.kind === "export") {
    return (
      <Button variant="outline" onClick={action.onClick}>
        <DownloadIcon />
        {action.label}
      </Button>
    );
  }

  return (
    <Button className="h-10 px-3.5 font-semibold" onClick={action.onClick}>
      <PlusIcon />
      {action.label}
    </Button>
  );
}

/** Renders its children only outside a Team or Overview frame. */
export function HideWhenFramed({
  children,
  fallback = null,
}: {
  children: ReactNode;
  /** What shows instead inside a frame. */
  fallback?: ReactNode;
}) {
  return useFramed() ? fallback : children;
}
