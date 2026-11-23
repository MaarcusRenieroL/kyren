import z from "zod";

export const taskStatusSchema = z.enum([
  "backlog",
  "todo",
  "in-progress",
  "review",
  "done",
]);

export const taskPrioritySchema = z.enum(["low", "medium", "high"]);

/**
 * A due date. A bare day (YYYY-MM-DD) from a caller that sends no time means
 * the end of that day, not its first instant; the app itself sends the end of
 * the day in the viewer's own zone.
 */
const dueDate = z.preprocess(
  (value) =>
    value === ""
      ? null
      : typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)
        ? `${value}T23:59:59.999Z`
        : value,
  z.coerce.date().optional().nullable(),
);

export const createTaskSchema = z.object({
  /** A doc to link the new task to, when it is created from that doc. */
  linkDocId: z.string().uuid().optional(),
  parentTaskId: z.string().uuid().optional().nullable(),
  /** A chat message to link the new task to, when made from that message. */
  linkMessageId: z.string().uuid().optional(),
  projectId: z
    .string({ error: "Pick a project so this task gets a key like ZEN-18." })
    .uuid("Pick a project so this task gets a key like ZEN-18."),
  name: z.string().trim().min(1, "Task name is required.").max(120),
  description: z.string().trim().max(10000).optional().or(z.literal("")),
  status: taskStatusSchema.default("todo"),
  priority: taskPrioritySchema.default("medium"),
  assignedToMemberId: z
    .string()
    .uuid("Choose someone from the list, or leave this empty.")
    .optional()
    .nullable(),
  dueAt: dueDate,
  estimatePoints: z.number().int().min(0).max(100).optional().nullable(),
});

/** Up to this many tasks arrive in one import. */
export const MAX_IMPORT_ROWS = 200;

export const importTasksSchema = z.object({
  projectId: z.string().uuid(),
  rows: z
    .array(
      z.object({
        name: z.string().trim().min(1, "Task name is required.").max(120),
        description: z.string().trim().max(10000).optional(),
        status: taskStatusSchema.default("todo"),
        priority: taskPrioritySchema.default("medium"),
        dueAt: dueDate,
      }),
    )
    .min(1, "Add at least one row.")
    .max(MAX_IMPORT_ROWS, `Import up to ${MAX_IMPORT_ROWS} tasks at a time.`),
});

export const getTasksSchema = z.object({
  teamId: z.string().uuid().optional().nullable(),
  /** Only this project's tasks (still limited to projects the caller sees). */
  projectId: z.string().uuid().optional(),
});

export const getTaskByKeySchema = z.object({
  key: z.string(),
});

export const createSubtaskSchema = z.object({
  parentTaskKey: z.string().trim().min(1, "Parent task key is required."),
  name: z.string().trim().min(1, "Subtask name is required.").max(120),
  assignedToMemberId: z.string().uuid().optional().nullable(),
});

export const updateTaskByKeySchema = z.object({
  key: z.string().trim().min(1, "Task key is required."),
  name: z.string().trim().min(1, "Task name is required.").max(120).optional(),
  description: z.string().trim().max(10000).optional().nullable(),
  status: taskStatusSchema.optional(),
  priority: taskPrioritySchema.optional(),
  parentTaskId: z.string().uuid().optional().nullable(),
  assignedToMemberId: z.string().uuid().optional().nullable(),
  estimatePoints: z.number().int().min(0).max(100).optional().nullable(),
  timeSpentMinutes: z.number().int().min(0).optional(),
  dueAt: dueDate,
});

export const logTaskTimeSchema = z.object({
  key: z.string().trim().min(1, "Task key is required."),
  durationMinutes: z
    .number()
    .int()
    .min(1, "Duration must be at least 1 minute.")
    .max(1440),
  note: z.string().trim().max(500).optional().nullable(),
});

export const deleteTaskByKeySchema = z.object({
  key: z.string().trim().min(1, "Task key is required."),
});

export const getTaskCommentsSchema = z.object({
  taskKey: z.string().trim().min(1, "Task key is required."),
});

export const createTaskCommentSchema = z.object({
  taskKey: z.string().trim().min(1, "Task key is required."),
  body: z.string().trim().min(1, "Comment is required.").max(10000),
});

export const getTaskActivityEventsSchema = z.object({
  taskKey: z.string().trim().min(1, "Task key is required."),
});
