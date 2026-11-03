import type { Metadata } from "next";

import { ImportPeople } from "~/src/components/hr/import-people";

export const metadata: Metadata = { title: "Import people" };

export default function ImportPeoplePage() {
  return <ImportPeople />;
}
