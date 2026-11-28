import { ThemeProviders } from "~/src/components/providers/theme-providers";

export default function FormsLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return <ThemeProviders>{children}</ThemeProviders>;
}
