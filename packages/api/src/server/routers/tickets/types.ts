import { TRPCError } from "@trpc/server";
import { and, eq } from "@zentro/db/drizzle";
import { members, ticketSlaPolicies, tickets } from "@zentro/db/schema";
import { z } from "zod";

import { type SlaPolicy } from "../../sla";
import { permissionProcedure, type OrganizationContext } from "../../trpc";

export const uuid = z.string().uuid();

export const ticketStatuses = ["open", "pending", "resolved", "spam"] as const;
/** How the public desk hands out tickets. */
export const assignmentModes = ["round_robin", "least_open"] as const;
export type AssignmentMode = (typeof assignmentModes)[number];
export const ticketPriorities = ["low", "normal", "high", "urgent"] as const;
export const ticketViews = [
  "mine",
  "unassigned",
  "open",
  "pending",
  "resolved",
  "spam",
] as const;

export const procedure = (permission: string, audit?: string[], also?: string[]) =>
  permissionProcedure(permission, undefined, {
    module: "tickets",
    audit,
    also,
  });

export const escapeLike = (value: string) => value.replace(/[\\%_]/g, "\\$&");

/**
 * The return date of someone away today, "" when they are away with no return
 * date, and `null` when they are present or the ticket is unassigned.
 */
export function awayUntil(
  away: Map<string, string | null>,
  memberId: string | null,
): string | null {
  return memberId && away.has(memberId) ? (away.get(memberId) ?? "") : null;
}

/** The targets for each priority, as the organization set them. */
export async function loadSlaPolicies(ctx: OrganizationContext) {
  const rows = await ctx.db
    .select()
    .from(ticketSlaPolicies)
    .where(eq(ticketSlaPolicies.organizationId, ctx.activeOrganization.id));

  return new Map<string, SlaPolicy>(
    rows.map((row) => [
      row.priority,
      {
        firstResponseMinutes: row.firstResponseMinutes,
        resolutionMinutes: row.resolutionMinutes,
      },
    ]),
  );
}

export const ticketRef = (number: number) => `SUP-${number}`;

export async function findTicket(ctx: OrganizationContext, id: string) {
  const [ticket] = await ctx.db
    .select()
    .from(tickets)
    .where(
      and(
        eq(tickets.id, id),
        eq(tickets.organizationId, ctx.activeOrganization.id),
      ),
    )
    .limit(1);

  if (!ticket) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Ticket not found." });
  }

  return ticket;
}

export async function assertAssignee(ctx: OrganizationContext, memberId: string) {
  const [row] = await ctx.db
    .select({ id: members.id })
    .from(members)
    .where(
      and(
        eq(members.id, memberId),
        eq(members.organizationId, ctx.activeOrganization.id),
      ),
    )
    .limit(1);

  if (!row) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "That person isn't in this organization.",
    });
  }
}

export const createInput = z.object({
  subject: z.string().trim().min(1, "Give the ticket a subject.").max(200),
  description: z.string().trim().max(10_000).default(""),
  requesterName: z.string().trim().min(1, "Who is asking?").max(120),
  requesterEmail: z
    .string()
    .trim()
    .email("That email address doesn't look right.")
    .max(200)
    .nullable()
    .default(null),
  priority: z.enum(ticketPriorities).default("normal"),
  category: z.string().trim().max(60).nullable().default(null),
  assigneeMemberId: uuid.nullable().default(null),
});
