import { JSX } from "react";

import { SecuritySection } from "~/src/components/workspace/settings/account-sections";
import { PrivacySection } from "~/src/components/workspace/settings/privacy-section";
import { TwoFactorSection } from "~/src/components/workspace/settings/two-factor-section";

export const metadata = { title: "Security" };

export default async function SecuritySectionPage(): Promise<JSX.Element> {
  return (
    <div className="flex flex-col gap-6">
      <SecuritySection />
      <TwoFactorSection />
      <PrivacySection />
    </div>
  );
}
