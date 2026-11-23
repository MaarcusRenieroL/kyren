import type { Metadata } from "next";
import { JSX } from "react";

import { SitePage } from "~/src/components/site/site-page";

export const metadata: Metadata = {
  title: "Subprocessors",
  description: "The companies that help run Kyren, and what each one does.",
};

export default function Page(): JSX.Element {
  return <SitePage page="legal" doc="subprocessors" />;
}
