import { JSX } from "react";

import { DataExportSection } from "~/src/components/workspace/settings/data-export-section";
import { ProfileSection } from "~/src/components/workspace/settings/account-sections";
import { getDashboardContext } from "~/src/lib/dashboard-context";

export const metadata = { title: "Profile" };

export default async function ProfileSectionPage(): Promise<JSX.Element> {
  const { session, organization } = await getDashboardContext();

  return (
    <div className="flex flex-col gap-6">
      <ProfileSection
        name={session.user.name}
        email={session.user.email}
        organizationName={organization.name}
      />
      <DataExportSection />
    </div>
  );
}
