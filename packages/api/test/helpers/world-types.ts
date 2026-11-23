import { members, organizations, users } from "@kyren/db/schema";

export type Role = "owner" | "admin" | "member";

export type TestUser = typeof users.$inferSelect;
export type TestOrg = typeof organizations.$inferSelect;
export type TestMember = typeof members.$inferSelect;
