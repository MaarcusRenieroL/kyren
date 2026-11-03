import type { Metadata } from "next";

import { Retention } from "~/src/components/admin/retention";

export const metadata: Metadata = { title: "Data retention" };

export default function AdminRetentionPage() {
  return <Retention />;
}
