import type { AppRouter } from "@kyren/api/server";
import type { inferRouterOutputs } from "@trpc/server";

export type Runs = inferRouterOutputs<AppRouter>["payroll"]["runs"];
export type Salaries = inferRouterOutputs<AppRouter>["payroll"]["salaries"];
export type Mine = inferRouterOutputs<AppRouter>["payroll"]["mine"];
export type Tab = "runs" | "salaries" | "mine";
