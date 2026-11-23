import { asc, count, eq } from "@zentro/db/drizzle";
import { roleAssignments, roles } from "@zentro/db/schema";
import { z } from "zod";

import { permissionProcedure } from "../../trpc";
import { loadRole } from "./helpers";
import { uuid } from "./types";

export const roleQueryProcedures = {
  list: permissionProcedure("roles.view").query(async ({ ctx }) => {
    const rows = await ctx.db
      .select()
      .from(roles)
      .where(eq(roles.organizationId, ctx.activeOrganization.id))
      .orderBy(asc(roles.scope), asc(roles.kind), asc(roles.name));
    const counts = await ctx.db
      .select({ roleId: roleAssignments.roleId, count: count() })
      .from(roleAssignments)
      .where(eq(roleAssignments.organizationId, ctx.activeOrganization.id))
      .groupBy(roleAssignments.roleId);

    return rows.map((role) => ({
      ...role,
      assignmentCount: counts.find((row) => row.roleId === role.id)?.count ?? 0,
      editable:
        role.kind === "custom" ||
        role.systemKey === "admin" ||
        role.systemKey === "member",
    }));
  }),

  get: permissionProcedure("roles.view")
    .input(z.object({ id: uuid }))
    .query(async ({ ctx, input }) => loadRole(ctx, input.id)),
};
