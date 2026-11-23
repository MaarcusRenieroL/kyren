/* eslint-disable @typescript-eslint/no-explicit-any */
import { SecurityHero } from "./security-hero";
import { SecurityRoles } from "./security-roles";
import { SecurityPermissions } from "./security-permissions";
import { SecurityAudit } from "./security-audit";
import { SecurityScope } from "./security-scope";

export function SecurityPage({ v }: { v: any }) {
  return (
    <>
      <SecurityHero v={v} />
      <SecurityRoles v={v} />
      <SecurityPermissions v={v} />
      <SecurityAudit v={v} />
      <SecurityScope v={v} />
    </>
  );
}
