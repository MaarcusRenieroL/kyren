import {
  createCipheriv,
  randomBytes,
} from "node:crypto";
import * as schema from "../../schema";

export const PREFIX = "enc:v1:";

export function encryptField(value: string | null) {
  if (value === null) return null;
  const raw = process.env.FIELD_ENCRYPTION_KEY;
  if (!raw) return value;
  const secret = Buffer.from(raw, "base64");
  if (secret.length !== 32) return value;
  const nonce = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", secret, nonce);
  const body = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return `${PREFIX}${Buffer.concat([nonce, cipher.getAuthTag(), body]).toString("base64")}`;
}

export const dayMs = 86_400_000;
export const now = Date.now();
export const when = (days: number) => new Date(now + days * dayMs);
export const dateStr = (days: number) => when(days).toISOString().slice(0, 10);
export const orgId = "5cba4782-7a7d-4b3b-8ffe-0222125241fc";

export type MemberInfo = {
  memberId: string;
  userId: string;
  name: string;
  email: string;
};

export type SeedMembers = {
  priya: MemberInfo;
  daniel: MemberInfo;
  meilin: MemberInfo;
  tomas: MemberInfo;
  sofia: MemberInfo;
  jamal: MemberInfo;
  ravi: MemberInfo;
  hannah: MemberInfo;
};

export type SeedContext = {
  orgId: string;
  members: SeedMembers;
  memberMap: Map<string, MemberInfo>;
  teamMap: Map<string, string>;
  websiteProject: typeof schema.projects.$inferSelect;
  mobileProject: typeof schema.projects.$inferSelect;
};
