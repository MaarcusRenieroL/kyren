import { expect } from "vitest";
import type { World } from "./world";

export type Caller = Awaited<ReturnType<World["caller"]>>;

export const forbidden = { code: "FORBIDDEN" };
export const notFound = { code: "NOT_FOUND" };

export async function expectAllowed(promise: Promise<unknown>) {
  await expect(promise).resolves.not.toThrow();
}

export function randomId() {
  return crypto.randomUUID();
}
