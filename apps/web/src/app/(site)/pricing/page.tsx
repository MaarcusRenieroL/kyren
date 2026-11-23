import type { Metadata } from "next";
import { JSX } from "react";

import { SitePage } from "~/src/components/site/site-page";

import { workspaceRate } from "~/src/components/site/workspace-pricing";

export const metadata: Metadata = {
  title: "Pricing",
  description:
    `Self-host Kyren for US$${workspaceRate} per workspace per month. Estimate your total with server, backup and email costs.`,
};

export default function Page(): JSX.Element {
  return <SitePage page="pricing" />;
}
