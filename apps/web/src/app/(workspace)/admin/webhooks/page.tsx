import type { Metadata } from "next";

import { Webhooks } from "~/src/components/admin/webhooks";

export const metadata: Metadata = { title: "Webhooks" };

export default function AdminWebhooksPage() {
  return <Webhooks />;
}
