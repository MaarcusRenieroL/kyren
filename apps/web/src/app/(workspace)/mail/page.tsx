import type { Metadata } from "next";

import { MailApp } from "~/src/components/mail/mail-app";

export const metadata: Metadata = { title: "Messages" };

export default function MailPage() {
  return <MailApp />;
}
