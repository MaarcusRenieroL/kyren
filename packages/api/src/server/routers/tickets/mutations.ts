import { TRPCError } from "@trpc/server";
import { and, eq, isNull, sql } from "@zentro/db/drizzle";
import { tasks, ticketMessages, tickets } from "@zentro/db/schema";
import { z } from "zod";

import { currentMemberId } from "../../chat";
import { mailTicketReply } from "../../ticket-mail";
import {
  assertAssignee,
  createInput,
  findTicket,
  procedure,
  ticketPriorities,
  ticketRef,
  ticketStatuses,
  uuid,
} from "./types";

export const ticketMutationsProcedures = {
  create: procedure("tickets.create", ["ticket.created"])
    .input(createInput)
    .mutation(async ({ ctx, input }) => {
      const memberId = await currentMemberId(ctx);

      if (input.assigneeMemberId) {
        await assertAssignee(ctx, input.assigneeMemberId);
      }

      return ctx.db.transaction(async (tx) => {
        // Serialize numbering per organization; the lock ends with the transaction.
        await tx.execute(
          sql`select pg_advisory_xact_lock(hashtextextended(${ctx.activeOrganization.id}, 0))`,
        );

        const [last] = await tx
          .select({
            max: sql<number>`coalesce(max(${tickets.number}), 0)::int`,
          })
          .from(tickets)
          .where(eq(tickets.organizationId, ctx.activeOrganization.id));
        const number = (last?.max ?? 0) + 1;

        const [row] = await tx
          .insert(tickets)
          .values({
            ...input,
            number,
            organizationId: ctx.activeOrganization.id,
            createdByMemberId: memberId,
          })
          .returning({ id: tickets.id });

        await ctx.audit.record(tx, {
          action: "ticket.created",
          target: {
            id: row!.id,
            label: `${ticketRef(number)} ${input.subject}`,
          },
        });

        return { id: row!.id, ref: ticketRef(number) };
      });
    }),

  update: procedure("tickets.update", ["ticket.updated"])
    .input(
      z.object({
        id: uuid,
        status: z.enum(ticketStatuses).optional(),
        priority: z.enum(ticketPriorities).optional(),
        category: z.string().trim().max(60).nullable().optional(),
        assigneeMemberId: uuid.nullable().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const ticket = await findTicket(ctx, input.id);

      if (input.assigneeMemberId) {
        await assertAssignee(ctx, input.assigneeMemberId);
      }

      const { id, ...changes } = input;

      await ctx.db.transaction(async (tx) => {
        await tx
          .update(tickets)
          .set({
            ...changes,
            ...(changes.status
              ? {
                  // Saving an already-resolved ticket keeps its first time.
                  resolvedAt:
                    changes.status === "resolved"
                      ? sql`coalesce(${tickets.resolvedAt}, now())`
                      : null,
                }
              : {}),
            updatedAt: new Date(),
          })
          .where(eq(tickets.id, id));

        await ctx.audit.record(tx, {
          action: "ticket.updated",
          target: {
            id: ticket.id,
            label: `${ticketRef(ticket.number)} ${ticket.subject}`,
          },
        });
      });

      return { id: ticket.id };
    }),

  /** A reply to the requester, or an internal note. */
  reply: procedure("tickets.reply")
    .input(
      z.object({
        id: uuid,
        kind: z.enum(["reply", "note"]).default("reply"),
        body: z.string().trim().min(1, "Write something first.").max(20_000),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const ticket = await findTicket(ctx, input.id);
      const memberId = await currentMemberId(ctx);

      await ctx.db.transaction(async (tx) => {
        await tx.insert(ticketMessages).values({
          ticketId: ticket.id,
          organizationId: ctx.activeOrganization.id,
          authorMemberId: memberId,
          kind: input.kind,
          body: input.body,
        });

        await tx
          .update(tickets)
          .set({ updatedAt: new Date() })
          .where(eq(tickets.id, ticket.id));

        // Answering the requester parks an open ticket until they respond.
        // The status is part of the filter, so a ticket resolved a moment ago
        // is not moved back to pending.
        if (input.kind === "reply") {
          // The first answer to the requester stops the response clock.
          await tx
            .update(tickets)
            .set({
              firstRespondedAt: sql`coalesce(${tickets.firstRespondedAt}, now())`,
            })
            .where(eq(tickets.id, ticket.id));
          await tx
            .update(tickets)
            .set({ status: "pending" })
            .where(and(eq(tickets.id, ticket.id), eq(tickets.status, "open")));
        }
      });

      // The requester gets an agent's reply by email; internal notes never go out.
      if (input.kind === "reply")
        await mailTicketReply(ticket, input.body, ctx.db);

      return { id: ticket.id };
    }),

  /** Links the ticket to the engineering task that fixes it, by task key. */
  linkTask: procedure("tickets.update", ["ticket.updated"])
    .input(
      z.object({
        id: uuid,
        taskKey: z.string().trim().max(40).nullable(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const ticket = await findTicket(ctx, input.id);
      let taskId: string | null = null;

      if (input.taskKey) {
        const [task] = await ctx.db
          .select({ id: tasks.id })
          .from(tasks)
          .where(
            and(
              eq(tasks.organizationId, ctx.activeOrganization.id),
              sql`upper(${tasks.key}) = ${input.taskKey.toUpperCase()}`,
              isNull(tasks.deletedAt),
            ),
          )
          .limit(1);

        if (!task) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: `No task with the key ${input.taskKey}.`,
          });
        }

        taskId = task.id;
      }

      await ctx.db.transaction(async (tx) => {
        await tx
          .update(tickets)
          .set({ linkedTaskId: taskId, updatedAt: new Date() })
          .where(eq(tickets.id, ticket.id));
        await ctx.audit.record(tx, {
          action: "ticket.updated",
          target: {
            id: ticket.id,
            label: `${ticketRef(ticket.number)} ${ticket.subject}`,
          },
        });
      });

      return { id: ticket.id };
    }),

  remove: procedure("tickets.delete", ["ticket.deleted"])
    .input(z.object({ id: uuid }))
    .mutation(async ({ ctx, input }) => {
      const ticket = await findTicket(ctx, input.id);

      await ctx.db.transaction(async (tx) => {
        await tx.delete(tickets).where(eq(tickets.id, ticket.id));
        await ctx.audit.record(tx, {
          action: "ticket.deleted",
          target: {
            id: ticket.id,
            label: `${ticketRef(ticket.number)} ${ticket.subject}`,
          },
        });
      });

      return { id: ticket.id };
    }),
};
