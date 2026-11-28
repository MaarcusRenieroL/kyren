import { cookies, headers } from "next/headers";

import { densityCookie, parseDensity } from "@kyren/ui/lib/theme-colors";

/**
 * Sets the saved density on <html> before the shell paints. Density lives on
 * the root element, so a nested wrapper cannot apply it; this inline script
 * runs before the rest of the body is parsed.
 */
export async function DensityScript() {
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  const density = parseDensity((await cookies()).get(densityCookie)?.value);

  return (
    <script
      nonce={nonce}
      dangerouslySetInnerHTML={{
        __html: `document.documentElement.dataset.density=${JSON.stringify(density)}`,
      }}
    />
  );
}
