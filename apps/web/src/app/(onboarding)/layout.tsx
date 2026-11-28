import type { Metadata } from "next";

import { AppProviders } from "~/src/components/providers/app-providers";

export const metadata: Metadata = {
  title: "Set up your workspace",
};

// Onboarding has its own frame (a top bar with the steps), so it sits outside
// the split auth layout. Its client hooks need the tRPC provider too.
export default function OnboardingLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <AppProviders>
      <div className="flex min-h-screen flex-col bg-canvas">{children}</div>
    </AppProviders>
  );
}
