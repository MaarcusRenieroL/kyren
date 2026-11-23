import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { auth } from "@kyren/auth";

import { TwoFactorGate } from "~/src/components/workspace/settings/two-factor-gate";
import { paths } from "~/src/lib/paths";

export const metadata: Metadata = { title: "Turn on two-factor" };

export default async function TwoFactorRequiredPage() {
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session?.user) {
    redirect(paths.auth.signIn());
  }

  return <TwoFactorGate />;
}
