import { ThemeProviders } from "~/src/components/providers/theme-providers";

// Development-only catalogues still need the theme and toast context.
export default function DevLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return <ThemeProviders>{children}</ThemeProviders>;
}
