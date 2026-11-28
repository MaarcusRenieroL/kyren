import { ThemeProviders } from "~/src/components/providers/theme-providers";

// This page sits outside the workspace and auth layouts; give it the theme
// context it used to inherit from the root layout.
export default function MaintenanceLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return <ThemeProviders>{children}</ThemeProviders>;
}
