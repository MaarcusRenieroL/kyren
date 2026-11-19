"use client";

import Link from "next/link";

import { authClient } from "@zentro/auth/client";
import { Button } from "@zentro/ui/shadcn/button";

import { TwoFactorSection } from "./two-factor-section";
import { apiPath } from "~/src/lib/paths";

/**
 * Shown to members of an organization that requires two-factor. It sits
 * outside the workspace, so nothing here depends on workspace access.
 */
export function TwoFactorGate() {
  async function leave() {
    await authClient.signOut();
    window.location.assign(apiPath("/auth/sign-in"));
  }

  return (
    <main className="mx-auto flex w-full max-w-xl flex-col gap-6 px-4 py-12">
      <header className="flex flex-col gap-1.5">
        <h1 className="text-[22px] leading-7 font-semibold">
          Your organization requires two-factor sign-in
        </h1>
        <p className="text-[15px] leading-[22px] text-ink-2">
          Turn it on to keep using Zentro. It takes a minute with an
          authenticator app.
        </p>
      </header>

      <TwoFactorSection />

      <div className="flex gap-2">
        <Button asChild>
          <Link href="/dashboard">Continue to Zentro</Link>
        </Button>
        <Button variant="outline" onClick={() => void leave()}>
          Sign out
        </Button>
      </div>
    </main>
  );
}
