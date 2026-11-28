import { headers } from "next/headers";
import type { ReactNode } from "react";

import { Toaster } from "@kyren/ui/shadcn/sonner";

import { DensityScript } from "./density-script";
import { ThemeProvider } from "./theme-provider";
import { AppTRPCProvider } from "./trpc-provider";

/**
 * Everything the workspace needs: theme, toasts and the tRPC client. Public
 * pages deliberately skip this so their HTML can be prerendered and cached.
 *
 * Density lives on <html>, so set it in a nonce-bearing inline script before
 * the shell paints; a nested wrapper would not be seen by `useDensity`.
 */
export async function AppProviders({ children }: { children: ReactNode }) {
  const nonce = (await headers()).get("x-nonce") ?? undefined;

  return (
    <>
      <DensityScript />
      <ThemeProvider
        attribute="class"
        defaultTheme="system"
        enableSystem
        disableTransitionOnChange
        nonce={nonce}
      >
        <AppTRPCProvider>{children}</AppTRPCProvider>
        <Toaster />
      </ThemeProvider>
    </>
  );
}
