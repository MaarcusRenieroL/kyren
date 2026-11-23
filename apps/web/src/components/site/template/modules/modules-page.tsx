/* eslint-disable @typescript-eslint/no-explicit-any */
import { ModulesHero } from "./modules-hero";
import { ModulesGrid } from "./modules-grid";

export function ModulesPage({ v }: { v: any }) {
  const { pg } = v;

  if (!pg.modules) return null;

  return (
    <>
      <ModulesHero v={v} />
      <ModulesGrid v={v} />
    </>
  );
}
