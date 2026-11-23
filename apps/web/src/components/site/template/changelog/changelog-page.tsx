/* eslint-disable @typescript-eslint/no-explicit-any */
import { ChangelogHero } from "./changelog-hero";
import { ChangelogList } from "./changelog-list";

export function ChangelogPage({ v }: { v: any }) {
  return (
    <>
      <ChangelogHero v={v} />
      <ChangelogList v={v} />
    </>
  );
}
