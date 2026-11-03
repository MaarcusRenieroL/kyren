import type { Metadata } from "next";

import { PublicIntakeForm } from "~/src/components/tickets/public-intake-form";

// A form's link is shared on purpose, but it is not for search engines.
export const metadata: Metadata = {
  title: "Contact us",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default async function IntakeFormPage({
  params,
}: Readonly<{ params: Promise<{ token: string }> }>) {
  const { token } = await params;

  return <PublicIntakeForm token={token} />;
}
