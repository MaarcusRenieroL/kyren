/* eslint-disable @typescript-eslint/no-explicit-any */
import { StatusHero } from "./status-hero";
import { StatusIncident } from "./status-incident";
import { StatusComponents } from "./status-components";
import { StatusPastIncidents } from "./status-past-incidents";

export function StatusPage({ v }: { v: any }) {
  return (
    <>
      <StatusHero v={v} />
      <StatusIncident v={v} />
      <StatusComponents v={v} />
      <StatusPastIncidents v={v} />
    </>
  );
}
