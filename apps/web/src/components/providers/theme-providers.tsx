import { headers } from "next/headers";
import type { ReactNode } from "react";

import { Toaster } from "@kyren/ui/shadcn/sonner";

import { DensityScript } from "./density-script";
import { ThemeProvider } from "./theme-provider";

/**
 * Theme, density and toasts for routes that keep the strict nonce CSP but do
 * not need the tRPC client. The nonce comes from the proxy, so next-themes can
 * set the theme before first paint without an inline script being blocked.
 */
export async function ThemeProviders({ children }: { children: ReactNode }) {
  const nonce = (await headers()).get("x-nonce") ?? undefined;

  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
      nonce={nonce}
    >
      <DensityScript />
      {children}
      <Toaster />
    </ThemeProvider>
  );
}
