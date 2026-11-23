import { and, eq, sql } from "@kyren/db/drizzle";
import { intakeForms, tickets, type IntakeField } from "@kyren/db/schema";

import type { DbHandle } from "./access";
import { ticketsOpenToPublic } from "./tickets-public";
import { nextAssignee } from "./ticket-assignment";
import { mailTicketReceived } from "./ticket-mail";

type Tx = DbHandle & {
  execute: (query: ReturnType<typeof sql>) => Promise<unknown>;
};

type Db = DbHandle & {
  transaction: <T>(run: (tx: Tx) => Promise<T>) => Promise<T>;
};

export type PublicForm = {
  name: string;
  description: string;
  fields: IntakeField[];
};

export type IntakeResult =
  | { ok: true; ref: string }
  | { ok: false; errors: Record<string, string> };

const tokenShape = /^[0-9a-f]{48}$/;
const EMAIL = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/;

const findForm = async (db: DbHandle, token: string) => {
  if (!tokenShape.test(token)) return null;

  const [form] = await db
    .select()
    .from(intakeForms)
    .where(and(eq(intakeForms.token, token), eq(intakeForms.enabled, true)))
    .limit(1);

  if (!form || !(await ticketsOpenToPublic(db, form.organizationId))) {
    return null;
  }

  return form;
};

/** What a visitor needs to fill the form in, nothing about the organization. */
export async function publicForm(
  db: DbHandle,
  token: string,
): Promise<PublicForm | null> {
  const form = await findForm(db, token);

  return form
    ? {
        name: form.name,
        description: form.description,
        fields: form.fields,
      }
    : null;
}

/** Checks the answers against the form and, when they fit, opens a ticket. */
export async function submitIntake(
  db: Db,
  token: string,
  answers: Record<string, unknown>,
): Promise<IntakeResult> {
  const form = await findForm(db, token);

  if (!form)
    return { ok: false, errors: { form: "This form is not available." } };

  const errors: Record<string, string> = {};
  const clean: Record<string, string> = {};

  for (const field of form.fields) {
    const raw = answers[field.id];
    const value = typeof raw === "string" ? raw.trim() : "";
    const limit = field.type === "longtext" ? 5_000 : 300;

    if (!value) {
      if (field.required) errors[field.id] = "Required.";

      continue;
    }

    if (field.type === "email" && !EMAIL.test(value)) {
      errors[field.id] = "Enter a valid email address.";
      continue;
    }

    if (field.type === "choice" && !(field.options ?? []).includes(value)) {
      errors[field.id] = "Pick one of the choices.";
      continue;
    }

    clean[field.id] = value.slice(0, limit);
  }

  if (Object.keys(errors).length) return { ok: false, errors };

  const byType = (type: IntakeField["type"]) =>
    form.fields.find((field) => field.type === type);
  const requesterName =
    (byType("name") && clean[byType("name")!.id])?.slice(0, 120) || "Anonymous";
  const requesterEmail = byType("email")
    ? (clean[byType("email")!.id]?.toLowerCase() ?? null)
    : null;
  const topic = form.fields.find((field) => field.type === "text");
  const subject =
    `${form.name}${topic && clean[topic.id] ? `: ${clean[topic.id]}` : ""}`
      .trim()
      .slice(0, 200);
  const description = form.fields
    .filter((field) => field.type !== "name" && field.type !== "email")
    .filter((field) => clean[field.id])
    .map((field) => `${field.label}: ${clean[field.id]}`)
    .join("\n\n")
    .slice(0, 10_000);

  const created = await db.transaction(async (tx) => {
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtextextended(${form.organizationId}, 0))`,
    );

    const [last] = await tx
      .select({ max: sql<number>`coalesce(max(${tickets.number}), 0)::int` })
      .from(tickets)
      .where(eq(tickets.organizationId, form.organizationId));
    const number = (last?.max ?? 0) + 1;

    const [row] = await tx
      .insert(tickets)
      .values({
        organizationId: form.organizationId,
        number,
        subject,
        description,
        requesterName,
        requesterEmail,
        category: form.name.slice(0, 80),
        assigneeMemberId: await nextAssignee(tx, form.organizationId),
      })
      .returning({
        number: tickets.number,
        subject: tickets.subject,
        requesterEmail: tickets.requesterEmail,
        portalToken: tickets.portalToken,
      });

    return row!;
  });

  // The person who filled the form learns it arrived, with its reference.
  await mailTicketReceived(created, "auto-generated", db as never);

  return { ok: true as const, ref: `SUP-${created.number}` };
}
