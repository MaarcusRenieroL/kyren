import { TRPCError } from "@trpc/server";
import { and, eq } from "@zentro/db/drizzle";
import { roleAssignments, teams } from "@zentro/db/schema";
import { z } from "zod";

import { assertHoldsAll } from "../../access";
import { assertAnyPermission, protectedProcedure } from "../../trpc";
import {
  assertMayModifyUser,
  assertTeamLeadBounds,
  describeAssignment,
  loadRole,
  resolveScope,
} from "./helpers";
import {
  assignKeys,
  conflict,
  notFound,
  scopeSchema,
  uuid,
} from "./types";

export const assignmentMutationProcedures = {
  assign: protectedProcedure
    .meta({
      permissions: [
        "roles.assign",
        "teams.members.manage",
        "projects.members.manage",
      ],
      audit: ["assignment.created"],
    })
    .input(
      z.object({
        roleId: uuid,
        principalType: z.enum(["user", "team"]),
        principalId: uuid,
        scopeType: scopeSchema,
        scopeId: uuid,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const resource = await resolveScope(ctx, input.scopeType, input.scopeId);

      await assertAnyPermission(ctx, assignKeys[input.scopeType], resource);

      const role = await loadRole(ctx, input.roleId);

      if (role.scope !== input.scopeType) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `This is a ${role.scope} role and cannot be assigned at ${input.scopeType} level.`,
        });
      }

      if (
        role.systemKey === "owner" ||
        role.systemKey === "admin" ||
        role.systemKey === "member"
      ) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message:
            "Owner, Admin and Member are base roles; change them from the members page.",
        });
      }

      if (input.scopeType === "team") {
        await assertTeamLeadBounds(ctx, input.scopeId, {
          type: input.principalType,
          id: input.principalId,
        });
      }

      if (input.principalType === "user") {
        await assertMayModifyUser(ctx, input.principalId);
      } else {
        const [team] = await ctx.db
          .select({ id: teams.id })
          .from(teams)
          .where(
            and(
              eq(teams.id, input.principalId),
              eq(teams.organizationId, ctx.activeOrganization.id),
            ),
          )
          .limit(1);

        if (!team) {
          throw notFound("Team not found.");
        }
      }

      await assertHoldsAll(ctx.permissions, role.permissions, resource);

      const names = await describeAssignment(ctx, input);

      const assignment = await ctx.db.transaction(async (tx) => {
        const [created] = await tx
          .insert(roleAssignments)
          .values({
            organizationId: ctx.activeOrganization.id,
            roleId: role.id,
            principalType: input.principalType,
            principalId: input.principalId,
            scopeType: input.scopeType,
            scopeId: input.scopeId,
            createdByUserId: ctx.user.id,
          })
          .onConflictDoNothing()
          .returning();

        if (!created) {
          throw conflict("This role is already assigned there.");
        }

        const scope = {
          projectId: input.scopeType === "project" ? input.scopeId : null,
          teamId: input.scopeType === "team" ? input.scopeId : null,
        };
        const details = {
          roleId: role.id,
          roleName: role.name,
          principalType: input.principalType,
          principalId: input.principalId,
          principalName: names.principalName,
          scopeType: input.scopeType,
          scopeId: input.scopeId,
          scopeName: names.scopeName,
        };

        await ctx.audit.record(tx, {
          action: "assignment.created",
          target: {
            id: created.id,
            label: `${role.name} for ${names.principalName ?? "someone"} on ${names.scopeName}`,
          },
          ...scope,
          metadata: { ...details, after: input },
        });

        if (input.scopeType === "project") {
          await ctx.audit.record(tx, {
            action: "project.member_added",
            target: { id: input.scopeId, label: names.scopeName },
            ...scope,
            metadata: details,
          });
        }

        return created;
      });

      return assignment;
    }),

  unassign: protectedProcedure
    .meta({
      permissions: [
        "roles.assign",
        "teams.members.manage",
        "projects.members.manage",
      ],
      audit: ["assignment.removed"],
    })
    .input(z.object({ assignmentId: uuid }))
    .mutation(async ({ ctx, input }) => {
      const [assignment] = await ctx.db
        .select()
        .from(roleAssignments)
        .where(
          and(
            eq(roleAssignments.id, input.assignmentId),
            eq(roleAssignments.organizationId, ctx.activeOrganization.id),
          ),
        )
        .limit(1);

      if (!assignment) {
        throw notFound("Assignment not found.");
      }

      const resource = await resolveScope(
        ctx,
        assignment.scopeType,
        assignment.scopeId,
      );

      await assertAnyPermission(
        ctx,
        assignKeys[assignment.scopeType],
        resource,
      );

      const role = await loadRole(ctx, assignment.roleId);

      if (assignment.principalType === "user") {
        await assertMayModifyUser(ctx, assignment.principalId);
      }

      await assertHoldsAll(ctx.permissions, role.permissions, resource);

      const names = await describeAssignment(ctx, assignment);

      await ctx.db.transaction(async (tx) => {
        await tx
          .delete(roleAssignments)
          .where(eq(roleAssignments.id, assignment.id));

        const scope = {
          projectId:
            assignment.scopeType === "project" ? assignment.scopeId : null,
          teamId: assignment.scopeType === "team" ? assignment.scopeId : null,
        };
        const details = {
          roleId: assignment.roleId,
          roleName: role.name,
          principalType: assignment.principalType,
          principalId: assignment.principalId,
          principalName: names.principalName,
          scopeType: assignment.scopeType,
          scopeId: assignment.scopeId,
          scopeName: names.scopeName,
        };

        await ctx.audit.record(tx, {
          action: "assignment.removed",
          target: {
            id: assignment.id,
            label: `${role.name} for ${names.principalName ?? "someone"} on ${names.scopeName}`,
          },
          ...scope,
          metadata: { ...details, before: details },
        });

        if (assignment.scopeType === "project") {
          await ctx.audit.record(tx, {
            action: "project.member_removed",
            target: { id: assignment.scopeId, label: names.scopeName },
            ...scope,
            metadata: details,
          });
        }
      });

      return { id: assignment.id };
    }),
};
