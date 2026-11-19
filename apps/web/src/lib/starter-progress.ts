import { db } from "@zentro/db";
import { and, count, eq, isNull } from "@zentro/db/drizzle";
import {
  docs,
  invitations,
  members,
  projects,
  tasks,
  whiteboards,
} from "@zentro/db/schema";

export type StarterProgress = {
  project: boolean;
  task: boolean;
  doc: boolean;
  whiteboard: boolean;
  team: boolean;
};

const some = async (query: Promise<{ n: number }[]>) =>
  ((await query)[0]?.n ?? 0) > 0;

/** Which first steps the workspace has really taken. */
export async function getStarterProgress(
  organizationId: string,
): Promise<StarterProgress> {
  const [project, task, doc, whiteboard, colleagues, invited] =
    await Promise.all([
      some(
        db
          .select({ n: count() })
          .from(projects)
          .where(eq(projects.organizationId, organizationId)),
      ),
      some(
        db
          .select({ n: count() })
          .from(tasks)
          .where(
            and(
              eq(tasks.organizationId, organizationId),
              isNull(tasks.deletedAt),
            ),
          ),
      ),
      some(
        db
          .select({ n: count() })
          .from(docs)
          .where(
            and(
              eq(docs.organizationId, organizationId),
              isNull(docs.deletedAt),
            ),
          ),
      ),
      some(
        db
          .select({ n: count() })
          .from(whiteboards)
          .where(
            and(
              eq(whiteboards.organizationId, organizationId),
              isNull(whiteboards.deletedAt),
            ),
          ),
      ),
      db
        .select({ n: count() })
        .from(members)
        .where(eq(members.organizationId, organizationId))
        .then((rows) => (rows[0]?.n ?? 0) > 1),
      some(
        db
          .select({ n: count() })
          .from(invitations)
          .where(
            and(
              eq(invitations.organizationId, organizationId),
              eq(invitations.status, "pending"),
            ),
          ),
      ),
    ]);

  return { project, task, doc, whiteboard, team: colleagues || invited };
}
