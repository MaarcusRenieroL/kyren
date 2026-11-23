"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { applyDensity } from "@zentro/ui/components/appearance";
import type { ShellModule } from "../app-sidebar";
import { goKeys, isTyping } from "./types";

type UseCommandPaletteShortcutsParams = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  modules: ShellModule[];
  actions: Array<{ id: string; label: string; key?: string; run: () => void }>;
};

export function useCommandPaletteShortcuts({
  open,
  onOpenChange,
  modules,
  actions,
}: UseCommandPaletteShortcutsParams) {
  const router = useRouter();
  const { resolvedTheme, setTheme } = useTheme();
  const goPending = useRef<number | null>(null);

  const toggleTheme = () =>
    setTheme(resolvedTheme === "dark" ? "light" : "dark");

  const toggleDensity = () =>
    applyDensity(
      document.documentElement.dataset.density === "compact"
        ? "comfortable"
        : "compact",
    );

  // Shortcuts that work anywhere in the app.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();

      if (key === "k" && (event.metaKey || event.ctrlKey) && !event.shiftKey) {
        event.preventDefault();
        onOpenChange(!open);
        return;
      }

      if ((event.metaKey || event.ctrlKey) && event.shiftKey) {
        if (key === "l") {
          event.preventDefault();
          toggleTheme();
        } else if (key === "d") {
          event.preventDefault();
          toggleDensity();
        }
        return;
      }

      if (open || event.metaKey || event.ctrlKey || event.altKey) return;
      if (isTyping(event.target)) return;

      // G then a letter navigates; a lone C, D or P creates.
      if (goPending.current !== null) {
        window.clearTimeout(goPending.current);
        goPending.current = null;

        const target = modules.find(
          (item) => goKeys[item.id]?.toLowerCase() === key,
        );

        if (target) {
          event.preventDefault();
          router.push(target.href);
        }
        return;
      }

      if (key === "g") {
        goPending.current = window.setTimeout(() => {
          goPending.current = null;
        }, 1000);
        return;
      }

      const action = actions.find((item) => item.key?.toLowerCase() === key);

      if (action) {
        event.preventDefault();
        action.run();
      }
    };

    window.addEventListener("keydown", onKey);

    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, modules, actions, resolvedTheme, router]);

  return {
    resolvedTheme,
    toggleTheme,
    toggleDensity,
  };
}
