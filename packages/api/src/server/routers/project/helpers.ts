import { eq } from "@kyren/db/drizzle";
import { projects } from "@kyren/db/schema";

export const createTaskKeyPrefixBase = (slug: string) => {
  const parts = slug.split("-").filter(Boolean);
  const prefix =
    parts.length > 1
      ? parts.map((part) => part[0]).join("")
      : parts[0]?.slice(0, 6);

  return (prefix ?? "task").replace(/[^a-z0-9]/gi, "").toUpperCase() || "TASK";
};

export const createUniqueTaskKeyPrefix = async ({
  db,
  organizationId,
  slug,
}: {
  db: typeof import("@kyren/db").db;
  organizationId: string;
  slug: string;
}) => {
  const basePrefix = createTaskKeyPrefixBase(slug);
  const existingProjects = await db
    .select({ taskKeyPrefix: projects.taskKeyPrefix })
    .from(projects)
    .where(eq(projects.organizationId, organizationId));

  const existingPrefixes = new Set(
    existingProjects.map((project) => project.taskKeyPrefix),
  );

  if (!existingPrefixes.has(basePrefix)) {
    return basePrefix;
  }

  let suffix = 2;

  while (true) {
    const suffixText = String(suffix);
    const candidate = `${basePrefix.slice(0, 6 - suffixText.length)}${suffixText}`;

    if (!existingPrefixes.has(candidate)) {
      return candidate;
    }

    suffix += 1;
  }
};
