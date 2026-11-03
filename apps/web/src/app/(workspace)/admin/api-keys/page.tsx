import type { Metadata } from "next";

import { ApiKeys } from "~/src/components/admin/api-keys";

export const metadata: Metadata = { title: "API keys" };

export default function AdminApiKeysPage() {
  return <ApiKeys />;
}
