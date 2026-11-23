/* eslint-disable @typescript-eslint/no-explicit-any */
import { LegalHero } from "./legal-hero";
import { LegalContent } from "./legal-content";

export function LegalPage({ v }: { v: any }) {
  return (
    <>
      <LegalHero v={v} />
      <LegalContent v={v} />
    </>
  );
}
