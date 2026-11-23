import { auth } from "@kyren/auth";
import { toNextJsHandler } from "better-auth/next-js";

import {
  authAllowedDuringMaintenance,
  maintenanceResponse,
} from "~/src/lib/maintenance";

const handler = toNextJsHandler(auth);

export const { GET } = handler;

/** Auth changes respect maintenance mode like every other write. */
export async function POST(request: Request) {
  if (!authAllowedDuringMaintenance(new URL(request.url).pathname)) {
    const paused = await maintenanceResponse();

    if (paused) return paused;
  }

  return handler.POST(request);
}
