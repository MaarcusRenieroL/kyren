import z from "zod";

// `/docs/[slug]` shares its parent with these static routes.
export const reservedDocSlugs = [
  "my-docs",
  "projects",
  "recent",
  "search",
  "trash",
  "new",
] as const;

export const createDocSchema = z.object({
  /** A task to link the new doc to, when it is written for that task. */
  linkTaskKey: z.string().trim().min(1).max(40).optional(),
  projectId: z.string().uuid().optional().nullable(),
  teamId: z.string().uuid().optional().nullable(),
  title: z.string().trim().min(1, "Title is required.").max(160).optional(),
  content: z.string().max(100000).optional(),
  slug: z
    .string()
    .trim()
    .min(1, "Slug is required.")
    .max(120, "Slug must be 120 characters or less.")
    .regex(
      /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
      "Use lowercase letters, numbers, and hyphens only.",
    )
    .refine(
      (slug) => !(reservedDocSlugs as readonly string[]).includes(slug),
      "This slug is reserved.",
    ),
});

export const getDocsSchema = z.object({
  projectId: z.string().uuid().optional().nullable(),
  teamId: z.string().uuid().optional().nullable(),
  includeDeleted: z.boolean().optional().default(false),
});

export const searchDocsSchema = z.object({
  query: z.string().trim().max(200).optional().default(""),
  projectId: z.string().uuid().optional().nullable(),
  teamId: z.string().uuid().optional().nullable(),
  includeDeleted: z.boolean().optional().default(false),
});

export const getDocByIdSchema = z.object({
  id: z.string().uuid(),
});

export const getDocBySlugSchema = z.object({
  slug: z.string().trim().min(1, "Slug is required."),
});

export const updateDocTitleSchema = z.object({
  id: z.string().uuid(),
  title: z.string().trim().min(1, "Title is required.").max(160),
});

export const updateDocContentSchema = z.object({
  id: z.string().uuid(),
  content: z.string().max(100000),
  /** The version this edit was made from. A newer one is not overwritten. */
  expectedUpdatedAt: z.coerce.date().optional(),
});

export const docVersionSchema = z.object({
  id: z.string().uuid(),
  versionId: z.string().uuid(),
});

export const restoreDocVersionSchema = z.object({
  id: z.string().uuid(),
  versionId: z.string().uuid(),
  /** The version on screen. A newer one is not overwritten. */
  expectedUpdatedAt: z.coerce.date(),
});

export const deleteDocCommentSchema = z.object({
  id: z.string().uuid(),
});

export const updateDocCommentSchema = z.object({
  id: z.string().uuid(),
  body: z.string().trim().min(1, "Comment is required.").max(10000),
});

export const deleteDocSchema = z.object({
  id: z.string().uuid(),
});

export const restoreDocSchema = z.object({
  id: z.string().uuid(),
});

export const getDocCommentsSchema = z.object({
  docId: z.string().uuid(),
});

export const createDocCommentSchema = z.object({
  docId: z.string().uuid(),
  body: z.string().trim().min(1, "Comment is required.").max(10000),
  /** Reply to this thread (a top-level comment on the same doc). */
  parentId: z.string().uuid().optional(),
});

export const resolveDocCommentSchema = z.object({
  id: z.string().uuid(),
});
