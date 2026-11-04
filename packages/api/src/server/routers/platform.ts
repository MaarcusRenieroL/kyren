import { platformProcedure, router } from "../trpc";
import {
  platformAnnouncementsRouter,
  platformAuditRouter,
  platformHealthRouter,
  platformIpRouter,
  platformMaintenanceRouter,
} from "./platform-ops";
import { platformTenantsRouter } from "./platform-tenants";
import { platformUsersRouter } from "./platform-users";

export const platformRouter = router({
  /** Who the console is open to; the guard has already checked the caller. */
  me: platformProcedure.query(({ ctx }) => ({
    id: ctx.user.id,
    name: ctx.user.name,
    email: ctx.user.email,
  })),
  tenants: platformTenantsRouter,
  users: platformUsersRouter,
  maintenance: platformMaintenanceRouter,
  ipRules: platformIpRouter,
  announcements: platformAnnouncementsRouter,
  health: platformHealthRouter,
  audit: platformAuditRouter,
});
