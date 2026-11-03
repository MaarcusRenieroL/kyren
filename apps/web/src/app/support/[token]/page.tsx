import type { Metadata } from "next";

import { SupportPortal } from "~/src/components/tickets/support-portal";

// A private link: keep it out of search engines and out of Referer headers.
export const metadata: Metadata = {
  title: "Your support request",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default async function SupportPage({
  params,
}: Readonly<{ params: Promise<{ token: string }> }>) {
  const { token } = await params;

  return <SupportPortal token={token} />;
}
