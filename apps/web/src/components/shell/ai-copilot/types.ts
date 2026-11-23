import type { AppRouter } from "@zentro/api/server";
import type { inferRouterOutputs } from "@trpc/server";

export type Outputs = inferRouterOutputs<AppRouter>;
export type SearchHit = Outputs["ai"]["semanticSearch"][number];
export type StoryPointResult = Outputs["ai"]["suggestStoryPoints"];
export type TriageResult = Outputs["ai"]["triageTicket"];
export type SweepResult = Outputs["custodian"]["runSweep"];
