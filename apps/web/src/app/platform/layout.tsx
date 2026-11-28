import type { Metadata } from "next";
import type { ReactNode } from "react";

import { PlatformShell } from "~/src/components/platform/shell";
import { AppProviders } from "~/src/components/providers/app-providers";
import { requirePlatformAccess } from "~/src/lib/platform-guard";

export const metadata: Metadata = {
  title: { default: "Platform", template: "%s · Platform" },
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function PlatformLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  const access = await requirePlatformAccess();

  if (!access.ok) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-3 p-6">
        <h1 className="font-display text-2xl text-ink">Platform console</h1>
        <p className="text-sm text-ink-2">{access.message}</p>
        <p className="text-sm text-ink-2">
          Turn on two-factor in your account security settings, or sign out and
          back in, then reload this page.
        </p>
      </main>
    );
  }

  return (
    <AppProviders>
      <PlatformShell name={access.name} email={access.email}>
        {children}
      </PlatformShell>
    </AppProviders>
  );
}
