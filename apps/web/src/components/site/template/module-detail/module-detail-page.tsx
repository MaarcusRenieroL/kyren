/* eslint-disable @typescript-eslint/no-explicit-any */
import { ModuleHero } from "./module-hero";
import { ModuleScreens } from "./module-screens";
import { ModuleLinks } from "./module-links";
import { ModulePermissions } from "./module-permissions";

export function ModuleDetailPage({ v }: { v: any }) {
  const { pg } = v;

  if (!pg.module) return null;

  return (
    <>
      <ModuleHero v={v} />
      <ModuleScreens v={v} />
      <ModuleLinks v={v} />
      <ModulePermissions v={v} />
    </>
  );
}
