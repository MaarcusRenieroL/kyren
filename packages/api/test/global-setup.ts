import { ensureTestDatabase } from "@kyren/test-utils";

export default async function setup() {
  await ensureTestDatabase();
}
