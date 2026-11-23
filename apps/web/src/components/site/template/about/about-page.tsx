/* eslint-disable @typescript-eslint/no-explicit-any */
import { AboutHero } from "./about-hero";
import { AboutPrinciples } from "./about-principles";
import { AboutContact } from "./about-contact";

export function AboutPage({ v }: { v: any }) {
  return (
    <>
      <AboutHero v={v} />
      <AboutPrinciples v={v} />
      <AboutContact v={v} />
    </>
  );
}
