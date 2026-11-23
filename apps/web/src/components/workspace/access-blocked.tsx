"use client";

import Link from "next/link";

import { authClient } from "@kyren/auth/client";
import { toastError } from "@kyren/ui/index";
import { Button } from "@kyren/ui/shadcn/button";

import { apiPath, paths } from "~/src/lib/paths";

/**
 * Shown instead of the workspace when the organization is suspended or the
 * person's network is not on its allow-list. It sits outside the workspace,
 * so nothing here reads workspace data.
 */
export function AccessBlocked({
  reason,
  message,
  elsewhere,
}: {
  reason: "suspended" | "network";
  message: string;
  /** The person's other organizations they can open from here. */
  elsewhere: { id: string; name: string }[];
}) {
  async function open(organizationId: string) {
    const { error } = await authClient.organization.setActive({
      organizationId,
    });

    if (error) {
      toastError(error, "Could not switch organization");
      return;
    }

    window.location.assign(apiPath(paths.dashboard()));
  }

  async function leave() {
    await authClient.signOut();
    window.location.assign(apiPath(paths.auth.signIn()));
  }

  return (
    <main className="mx-auto flex w-full max-w-xl flex-col gap-6 px-4 py-12">
      <header className="flex flex-col gap-1.5">
        <h1 className="text-[22px] leading-7 font-semibold">
          {reason === "suspended"
            ? "This organization is paused"
            : "You can't reach this organization from here"}
        </h1>
        <p className="text-[15px] leading-[22px] text-ink-2">{message}</p>
        <p className="text-[15px] leading-[22px] text-ink-2">
          {reason === "suspended"
            ? "Nothing in it can be opened until it is reactivated."
            : "Connect from a network your organization allows, such as the office or its VPN, then try again."}
        </p>
      </header>

      {elsewhere.length ? (
        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-medium">Your other organizations</h2>
          <ul className="flex flex-col gap-1.5">
            {elsewhere.map((organization) => (
              <li key={organization.id}>
                <Button
                  variant="outline"
                  className="w-full justify-start"
                  onClick={() => void open(organization.id)}
                >
                  Open {organization.name}
                </Button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <div className="flex gap-2">
        <Button asChild>
          <Link href={paths.dashboard()}>Try again</Link>
        </Button>
        <Button variant="outline" onClick={() => void leave()}>
          Sign out
        </Button>
      </div>
    </main>
  );
}
