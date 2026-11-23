import type { AppRouter } from "@zentro/api/server";
import type { inferRouterOutputs } from "@trpc/server";

export type Ticket = inferRouterOutputs<AppRouter>["tickets"]["get"];
export type People = inferRouterOutputs<AppRouter>["tickets"]["assignees"];

export const dateFormat = new Intl.DateTimeFormat(undefined, {
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});
