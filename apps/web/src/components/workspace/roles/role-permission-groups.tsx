import { Badge } from "@kyren/ui/shadcn/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@kyren/ui/shadcn/card";
import { Switch } from "@kyren/ui/shadcn/switch";

import type { CatalogEntry } from "./use-catalog";
import { moduleNames, type Role } from "./role-editor-types";

type Props = {
  groups: [string, Map<string, CatalogEntry[]>][];
  role: Role;
  myPermissions: Record<string, boolean>;
  selected: Set<string>;
  canEdit: boolean;
  onToggle: (key: string, checked: boolean) => void;
};

export function RolePermissionGroups({
  groups,
  role,
  myPermissions,
  selected,
  canEdit,
  onToggle,
}: Props) {
  return (
    <>
      {groups.map(([moduleId, groupMap]) => (
        <Card key={moduleId}>
          <CardHeader>
            <CardTitle className="text-base">
              {moduleNames[moduleId] ?? moduleId}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            {[...groupMap.entries()].map(([group, entries]) => (
              <div key={group} className="space-y-2">
                <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                  {group}
                </h3>
                <div className="divide-y rounded-md border">
                  {entries.map((entry) => {
                    const allowedHere = entry.scopes.includes(role.scope);
                    const held = Boolean(myPermissions[entry.key]);
                    const isOn = selected.has(entry.key);
                    const locked =
                      !canEdit ||
                      entry.ownerOnly ||
                      !allowedHere ||
                      (!held && !isOn);

                    return (
                      <div
                        key={entry.key}
                        className="flex items-center justify-between gap-4 px-3 py-2.5"
                      >
                        <div className="min-w-0">
                          <p className="text-sm font-medium">
                            {entry.label}
                            {entry.ownerOnly ? (
                              <Badge variant="outline" className="ml-2">
                                Owner only
                              </Badge>
                            ) : null}
                            {!allowedHere && !entry.ownerOnly ? (
                              <Badge variant="outline" className="ml-2">
                                Not for {role.scope} roles
                              </Badge>
                            ) : null}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {entry.description}
                          </p>
                        </div>
                        <Switch
                          aria-label={entry.label}
                          checked={role.systemKey === "owner" || isOn}
                          disabled={locked || role.systemKey === "owner"}
                          onCheckedChange={(checked) =>
                            onToggle(entry.key, checked)
                          }
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      ))}
    </>
  );
}
