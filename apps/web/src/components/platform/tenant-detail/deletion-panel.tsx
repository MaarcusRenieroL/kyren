import { useState } from "react";
import { Button } from "@kyren/ui/shadcn/button";
import { Input } from "@kyren/ui/shadcn/input";
import { Panel } from "./panel";

export function DeletionPanel({
  organizationSlug,
  busy,
  onScheduleDeletion,
}: {
  organizationSlug: string;
  busy: boolean;
  onScheduleDeletion: (confirmSlug: string) => void;
}) {
  const [slug, setSlug] = useState("");

  return (
    <Panel title="Delete this organization">
      <p className="text-sm text-ink-2">
        Locks the organization now and permanently deletes everything after
        14 days. Export the data first if the customer may want it. Type the
        slug <span className="font-mono">{organizationSlug}</span> to
        confirm.
      </p>
      <div className="flex flex-wrap gap-2">
        <Input
          aria-label="Confirm slug"
          className="w-56"
          value={slug}
          onChange={(event) => setSlug(event.target.value)}
        />
        <Button
          size="sm"
          variant="outline"
          disabled={busy || slug !== organizationSlug}
          onClick={() => onScheduleDeletion(slug)}
        >
          Schedule deletion
        </Button>
      </div>
    </Panel>
  );
}
