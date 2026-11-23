import type { Metadata } from "next";
import { JSX } from "react";

import { SitePage } from "~/src/components/site/site-page";

export const metadata: Metadata = {
  title: "Data processing agreement",
  description:
    "How Kyren processes personal data on an organization's behalf.",
};

export default function Page(): JSX.Element {
  return <SitePage page="legal" doc="dpa" />;
}
