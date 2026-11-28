import Link from "next/link";

import { Logo } from "@kyren/ui/components/logo";

import { ClientThemeSync } from "~/src/components/providers/client-theme-sync";
import { NotFoundContent } from "~/src/components/system/not-found-content";

// Unknown paths outside the public marketing prefixes are proxied with a
// nonce CSP. Rendering this page on demand lets Next put that nonce on its
// scripts, so the 404 can hydrate at all.
export const dynamic = "force-dynamic";

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col bg-canvas px-6 py-6 text-ink">
      <ClientThemeSync />
      <Link href="/" aria-label="Kyren home" className="w-fit">
        <Logo />
      </Link>
      <div className="my-auto">
        <NotFoundContent />
      </div>
    </main>
  );
}
