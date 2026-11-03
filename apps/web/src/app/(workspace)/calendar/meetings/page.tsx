import type { Metadata } from "next";

import { MeetingList } from "~/src/components/meetings/meeting-list";
import { getModuleAccess } from "~/src/lib/dashboard-context";

export const metadata: Metadata = { title: "Meetings" };

export default async function MeetingsPage() {
  return <MeetingList canCreate={await getModuleAccess("calendar.create")} />;
}
