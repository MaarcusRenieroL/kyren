/* eslint-disable @typescript-eslint/no-explicit-any */
import { RoadmapHero } from "./roadmap-hero";
import { RoadmapTimeline } from "./roadmap-timeline";

export function RoadmapPage({ v }: { v: any }) {
  const { pg } = v;

  if (!pg.roadmap) return null;

  return (
    <>
      <RoadmapHero v={v} />
      <RoadmapTimeline v={v} />
    </>
  );
}
