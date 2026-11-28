import { AppProviders } from "~/src/components/providers/app-providers";

// A payslip reads through the tRPC client, so it needs the workspace providers.
export default function PayslipLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return <AppProviders>{children}</AppProviders>;
}
