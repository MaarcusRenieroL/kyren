"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";

import { useTrpcClient } from "@kyren/api/react";
import type { AppRouter } from "@kyren/api/server";
import type { inferRouterOutputs } from "@trpc/server";
import { toastError, toastSuccess } from "@kyren/ui/index";
import { Button } from "@kyren/ui/shadcn/button";
import { Input } from "@kyren/ui/shadcn/input";

import { Title, formatDate } from "./common";

type Found = inferRouterOutputs<AppRouter>["platform"]["users"]["lookup"];

export function PlatformUsers() {
  const trpc = useTrpcClient();
  const [query, setQuery] = useState("");
  const [found, setFound] = useState<Found | null>(null);
  const [busy, setBusy] = useState(false);

  async function search() {
    setBusy(true);

    try {
      setFound(await trpc.platform.users.lookup.query({ query }));
    } catch (error) {
      toastError(error, "Could not search.");
    } finally {
      setBusy(false);
    }
  }

  async function act(work: () => Promise<unknown>, done: string) {
    setBusy(true);

    try {
      await work();
      toastSuccess(done);
      setFound(await trpc.platform.users.lookup.query({ query }));
    } catch (error) {
      toastError(error, "That did not work.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Title
        title="Users"
        description="Find a person by name or email, end their sessions, or email them a password reset link. You never see or set a password."
      />
      <form
        className="flex gap-2"
        onSubmit={(event: FormEvent) => {
          event.preventDefault();
          void search();
        }}
      >
        <Input
          aria-label="Name or email"
          placeholder="Name or email"
          className="w-72"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <Button type="submit" disabled={busy || query.trim().length < 2}>
          Search
        </Button>
      </form>

      {found && !found.length ? (
        <p className="text-sm text-ink-2">Nobody matches.</p>
      ) : null}
      <ul className="flex flex-col gap-3">
        {found?.map((user) => (
          <li
            key={user.id}
            className="flex flex-col gap-2 rounded-xl border border-line p-4 text-sm"
          >
            <div>
              <span className="font-medium">{user.name}</span>{" "}
              <span className="text-ink-2">{user.email}</span>
            </div>
            <div className="text-ink-2">
              {user.role} ·{" "}
              {user.emailVerified ? "email verified" : "email not verified"} ·{" "}
              {user.twoFactorEnabled ? "two-factor on" : "two-factor off"} ·{" "}
              {user.sessions} {user.sessions === 1 ? "session" : "sessions"} ·
              joined {formatDate(user.createdAt)}
            </div>
            <div className="flex flex-wrap gap-2">
              {user.memberships.map((m) => (
                <Link
                  key={m.organizationId}
                  href={`/platform/tenants/${m.organizationId}`}
                  className="rounded-full bg-sunken px-2 py-0.5 text-xs hover:underline"
                >
                  {m.organizationName} · {m.role}
                </Link>
              ))}
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={busy}
                onClick={() =>
                  void act(
                    () =>
                      trpc.platform.users.signOutEverywhere.mutate({
                        userId: user.id,
                      }),
                    "Signed out everywhere",
                  )
                }
              >
                Sign out everywhere
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={busy}
                onClick={() =>
                  void act(
                    () =>
                      trpc.platform.users.sendPasswordReset.mutate({
                        userId: user.id,
                      }),
                    "Reset link sent",
                  )
                }
              >
                Send password reset
              </Button>
              {user.twoFactorEnabled ? (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busy}
                  onClick={() => {
                    if (
                      !window.confirm(
                        `Turn off two-factor for ${user.email}? Only do this after confirming who they are; they will be signed out everywhere.`,
                      )
                    ) {
                      return;
                    }

                    void act(
                      () =>
                        trpc.platform.users.resetTwoFactor.mutate({
                          userId: user.id,
                        }),
                      "Two-factor turned off",
                    );
                  }}
                >
                  Reset two-factor
                </Button>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}
