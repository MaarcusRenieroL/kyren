import { ThemeProviders } from "~/src/components/providers/theme-providers";

export default function ShareLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return <ThemeProviders>{children}</ThemeProviders>;
}
