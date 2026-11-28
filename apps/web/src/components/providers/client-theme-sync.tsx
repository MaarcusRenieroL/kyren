"use client";

import { useEffect } from "react";

/**
 * Applies the saved (or system) theme to <html> for the global error and 404
 * pages, which render outside every provider layout. It runs after hydration
 * instead of as an inline script so it works under both the nonce CSP and the
 * public CSP. The cost is a brief light frame before the effect runs.
 */
export function ClientThemeSync() {
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem("theme");
      const dark =
        saved === "dark" ||
        ((saved === null || saved === "system") &&
          window.matchMedia("(prefers-color-scheme: dark)").matches);

      document.documentElement.classList.toggle("dark", dark);
      document.documentElement.style.colorScheme = dark ? "dark" : "light";
    } catch {
      // Storage or matchMedia blocked: leave the default light theme.
    }
  }, []);

  return null;
}
