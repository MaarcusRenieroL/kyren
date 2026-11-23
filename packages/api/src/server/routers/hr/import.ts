import { eq, sql } from "@zentro/db/drizzle";
import { employees } from "@zentro/db/schema";
import { z } from "zod";

import { enforceRateLimit } from "../../rate-limit";
import { employeeInput, procedure } from "./types";

export const hrImportProcedures = {
  /**
   * Adds people from a spreadsheet, all or nothing. Rows whose email is already
   * on file (or repeated in the file) are skipped, so re-uploading is safe.
   */
  importEmployees: procedure("hr.manage", ["employee.added"])
    .input(
      z.object({
        rows: z
          .array(
            employeeInput.pick({
              name: true,
              email: true,
              jobTitle: true,
              department: true,
              location: true,
              startDate: true,
            }),
          )
          .min(1, "Add at least one row.")
          .max(200, "Import up to 200 people at a time."),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const organizationId = ctx.activeOrganization.id;

      await enforceRateLimit(ctx.db, `api:import-people:${ctx.user.id}`, {
        max: 20,
        windowMs: 60 * 60 * 1000,
      });

      return ctx.db.transaction(async (tx) => {
        // One import at a time per organization, so two uploads can't both
        // pass the duplicate check.
        await tx.execute(
          sql`select pg_advisory_xact_lock(hashtextextended(${`employees:${organizationId}`}, 0))`,
        );

        const existing = await tx
          .select({ email: employees.email })
          .from(employees)
          .where(eq(employees.organizationId, organizationId));
        const seen = new Set(
          existing.flatMap((row) =>
            row.email ? [row.email.toLowerCase()] : [],
          ),
        );
        let created = 0;
        let skipped = 0;

        for (const row of input.rows) {
          const key = row.email?.toLowerCase();

          if (key && seen.has(key)) {
            skipped += 1;
            continue;
          }
          if (key) seen.add(key);

          const [added] = await tx
            .insert(employees)
            .values({ ...row, organizationId })
            .returning({ id: employees.id });

          await ctx.audit.record(tx, {
            action: "employee.added",
            target: { id: added!.id, label: row.name },
            metadata: { imported: true },
          });
          created += 1;
        }

        return { created, skipped };
      });
    }),
};
