import { notFound } from "next/navigation";

import { TenantDetail } from "~/src/components/platform/tenant-detail";

export default async function PlatformTenantPage({
  params,
}: Readonly<{ params: Promise<{ id: string }> }>) {
  const { id } = await params;

  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();

  return <TenantDetail id={id} />;
}
