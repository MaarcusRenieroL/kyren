import type { Metadata } from "next";

import { NetworkAccess } from "~/src/components/admin/network-access";

export const metadata: Metadata = { title: "Network access" };

export default function AdminNetworkPage() {
  return <NetworkAccess />;
}
