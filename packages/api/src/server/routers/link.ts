import { TRPCError } from "@trpc/server";
import { and, eq, or } from "@zentro/db/drizzle";
import { docs, members, tasks, workLinks } from "@zentro/db/schema";
import { z } from "zod";
import { docById, taskByKey } from "../resources";
import {
  denialFor,
  permissionProcedure,
  protectedProcedure,
  router,
  type OrganizationContext,
} from "../trpc";
import { getCurrentMember } from "./task-helpers";
import { linksOf, loadDoc, loadTask } from "./link/links-of";
import {
  blocksReach,
  insertLink,
  resolveTarget,
  taskTarget,
} from "./link/mutations-helper";
import { uuid, type LinkedItem, type LinkRelation, type Ref } from "./link/types";

export { linksOf, resolveTarget, type LinkRelation, type LinkedItem };

export const linkRouter = router({
  forTask: permissionProcedure("tasks.view", taskByKey("taskKey"), {
    module: "tasks",
  })
    .input(z.object({ taskKey: z.string().trim().min(1).max(40) }))
    .query(async ({ ctx, input }) => {
      const task = await loadTask(ctx, input.taskKey);

      if (!task) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Task not found." });
      }

      return linksOf(ctx, { type: "task", id: task.id });
    }),

  forDoc: permissionProcedure("docs.view", docById("docId"), {
    module: "docs",
  })
    .input(z.object({ docId: uuid }))
    .query(async ({ ctx, input }) => {
      const doc = await loadDoc(ctx, input.docId);

      if (!doc) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Doc not found." });
      }

      return linksOf(ctx, { type: "doc", id: doc.id });
    }),

  addFromTask: permissionProcedure("tasks.update_own", taskByKey("taskKey"), {
    module: "tasks",
    also: ["tasks.view", "docs.view"],
    audit: ["task.linked"],
  })
    .input(
      z.object({
        taskKey: z.string().trim().min(1).max(40),
        target: taskTarget,
        kind: z.enum(["blocks", "blocked_by", "relates"]),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const task = await loadTask(ctx, input.taskKey);

      if (!task) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Task not found." });
      }

      const target = await resolveTarget(ctx, input.target);

      if (input.kind !== "relates" && target.type !== "task") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Only tasks can block each other.",
        });
      }

      const self: Ref = { type: "task", id: task.id };
      const [from, to] =
        input.kind === "blocked_by" ? [target, self] : [self, target];

      return insertLink(
        ctx,
        from,
        to,
        input.kind === "relates" ? "relates" : "blocks",
        {
          action: "task.linked",
          target: { id: task.id, label: task.key },
          projectId: task.projectId,
          teamId: task.teamId,
          other: target.label,
        },
      );
    }),

  addFromDoc: permissionProcedure("docs.update_own", docById("docId"), {
    module: "docs",
    also: ["tasks.view", "docs.view"],
    audit: ["doc.linked"],
  })
    .input(z.object({ docId: uuid, target: taskTarget }))
    .mutation(async ({ ctx, input }) => {
      const doc = await loadDoc(ctx, input.docId);

      if (!doc) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Doc not found." });
      }

      const target = await resolveTarget(ctx, input.target);

      return insertLink(ctx, { type: "doc", id: doc.id }, target, "relates", {
        action: "doc.linked",
        target: { id: doc.id, label: doc.title || "Untitled" },
        projectId: doc.projectId,
        teamId: doc.teamId,
        other: target.label,
      });
    }),

  // Either side's editor may remove a manual link; mentions go away by
  // editing the text that makes them.
  remove: protectedProcedure
    .meta({
      permissions: ["tasks.update_own", "docs.update_own"],
      audit: ["task.unlinked", "doc.unlinked"],
    })
    .input(z.object({ linkId: uuid }))
    .mutation(async ({ ctx, input }) => {
      const [link] = await ctx.db
        .select()
        .from(workLinks)
        .where(
          and(
            eq(workLinks.organizationId, ctx.activeOrganization.id),
            eq(workLinks.id, input.linkId),
          ),
        )
        .limit(1);

      if (!link) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Link not found." });
      }

      if (link.kind === "mentions" && link.via !== null) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message:
            "This link comes from a mention. Edit the text to remove it.",
        });
      }

      // The caller must be able to edit one of the two ends.
      const ends: Ref[] = [
        { type: link.sourceType as Ref["type"], id: link.sourceId },
        { type: link.targetType as Ref["type"], id: link.targetId },
      ];
      let allowedEnd:
        | {
            ref: Ref;
            label: string;
            projectId: string | null;
            teamId: string | null;
          }
        | undefined;
      let lastDecision;

      for (const ref of ends) {
        if (ref.type === "task") {
          const [task] = await ctx.db
            .select({
              key: tasks.key,
              projectId: tasks.projectId,
              teamId: tasks.teamId,
            })
            .from(tasks)
            .where(eq(tasks.id, ref.id))
            .limit(1);
          const resource = task
            ? await taskByKey()({ ctx, input: { key: task.key } })
            : undefined;

          if (task && resource) {
            lastDecision = await ctx.permissions.check(
              "tasks.update_own",
              resource,
            );

            if (lastDecision.allowed) {
              allowedEnd = {
                ref,
                label: task.key,
                projectId: task.projectId,
                teamId: task.teamId,
              };
              break;
            }
          }
        } else {
          const doc = await loadDoc(ctx, ref.id);
          const resource = doc
            ? await docById()({ ctx, input: { id: ref.id } })
            : undefined;

          if (doc && resource) {
            lastDecision = await ctx.permissions.check(
              "docs.update_own",
              resource,
            );

            if (lastDecision.allowed) {
              allowedEnd = {
                ref,
                label: doc.title || "Untitled",
                projectId: doc.projectId,
                teamId: doc.teamId,
              };
              break;
            }
          }
        }
      }

      if (!allowedEnd) {
        throw denialFor(lastDecision ?? { allowed: false, reasons: [] });
      }

      await ctx.db.transaction(async (tx) => {
        await tx.delete(workLinks).where(eq(workLinks.id, link.id));
        await ctx.audit.record(tx, {
          action:
            allowedEnd.ref.type === "task" ? "task.unlinked" : "doc.unlinked",
          target: { id: allowedEnd.ref.id, label: allowedEnd.label },
          projectId: allowedEnd.projectId,
          teamId: allowedEnd.teamId,
          metadata: { kind: link.kind },
        });
      });

      return { ok: true };
    }),
});
