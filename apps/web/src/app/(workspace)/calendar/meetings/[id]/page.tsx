import type { Metadata } from "next";

import { MeetingDetail } from "~/src/components/meetings/meeting-detail";

export const metadata: Metadata = { title: "Meeting" };

export default async function MeetingPage({
  params,
}: Readonly<{ params: Promise<{ id: string }> }>) {
  const { id } = await params;

  return <MeetingDetail id={id} />;
}
