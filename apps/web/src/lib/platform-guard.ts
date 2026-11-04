import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";

import { appRouter } from "@zentro/api/server";

import { paths } from "~/src/lib/paths";
import { createRequestContext } from "~/src/lib/request-context";

export type PlatformAccess =
  | { ok: true; name: string; email: string }
  | { ok: false; message: string };

/**
 * The platform console's page guard. It asks the same procedure the API uses,
 * so the role, two-factor, recent sign-in and network rules cannot drift apart.
 * Strangers see a plain "not found"; a platform admin who is short of
 * two-factor or a fresh sign-in is told what to do.
 */
export async function requirePlatformAccess(): Promise<PlatformAccess> {
  const request = new Request("http://localhost/platform", {
    headers: await headers(),
  });
  const ctx = await createRequestContext(request);

  try {
    const me = await appRouter.createCaller(ctx as never).platform.me();

    return { ok: true, name: me.name, email: me.email };
  } catch (error) {
    const code = (error as { code?: string }).code;

    if (code === "UNAUTHORIZED") redirect(paths.auth.signIn());
    if (code === "FORBIDDEN") {
      return { ok: false, message: (error as Error).message };
    }

    notFound();
  }
}
