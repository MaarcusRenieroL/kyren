import { ThemeProviders } from "~/src/components/providers/theme-providers";

// Help articles are public but keep the strict CSP, so they use the nonce
// provider rather than the cached public-page shell.
export default function HelpLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return <ThemeProviders>{children}</ThemeProviders>;
}
