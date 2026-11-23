import { TRPCError } from "@trpc/server";
import { and, eq, isNotNull, isNull } from "@kyren/db/drizzle";
import { docs } from "@kyren/db/schema";

import { deleteDocSchema, restoreDocSchema } from "../../../types/zod-schema";
import { docById } from "../../resources";
import { permissionProcedure } from "../../trpc";

export const docTrashProcedures = {
  delete: permissionProcedure("docs.trash_own", docById("id"), {
    module: "docs",
    audit: ["doc.trashed"],
  })
    .input(deleteDocSchema)
    .mutation(async ({ ctx, input }) => {
      const { db, activeOrganization } = ctx;
      const { id } = input;

      return db.transaction(async (tx) => {
        const [deletedDoc] = await tx
          .update(docs)
          .set({
            deletedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(docs.organizationId, activeOrganization.id),
              eq(docs.id, id),
              isNull(docs.deletedAt),
            ),
          )
          .returning({
            id: docs.id,
            slug: docs.slug,
            title: docs.title,
            projectId: docs.projectId,
            teamId: docs.teamId,
          });

        if (!deletedDoc) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Doc not found",
          });
        }

        await ctx.audit.record(tx, {
          action: "doc.trashed",
          target: { id: deletedDoc.id, label: deletedDoc.title },
          projectId: deletedDoc.projectId,
          teamId: deletedDoc.teamId,
          metadata: { slug: deletedDoc.slug },
        });

        return { id: deletedDoc.id, slug: deletedDoc.slug };
      });
    }),

  restore: permissionProcedure("docs.restore", docById("id"), {
    module: "docs",
    audit: ["doc.restored"],
  })
    .input(restoreDocSchema)
    .mutation(async ({ ctx, input }) => {
      const { db, activeOrganization } = ctx;
      const { id } = input;

      return db.transaction(async (tx) => {
        const [restoredDoc] = await tx
          .update(docs)
          .set({
            deletedAt: null,
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(docs.organizationId, activeOrganization.id),
              eq(docs.id, id),
              isNotNull(docs.deletedAt),
            ),
          )
          .returning({
            id: docs.id,
            slug: docs.slug,
            title: docs.title,
            projectId: docs.projectId,
            teamId: docs.teamId,
          });

        if (!restoredDoc) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Doc not found",
          });
        }

        await ctx.audit.record(tx, {
          action: "doc.restored",
          target: { id: restoredDoc.id, label: restoredDoc.title },
          projectId: restoredDoc.projectId,
          teamId: restoredDoc.teamId,
          metadata: { slug: restoredDoc.slug },
        });

        return { id: restoredDoc.id, slug: restoredDoc.slug };
      });
    }),
};
