import type z from "zod";
import type {
  createProjectSchema,
  createTeamSchema,
  joinOrganizationListSchema,
  orgInviteDetailsSchema,
  updateProjectBySlugSchema,
  updateTeamSchema,
} from "./schemas/project-team";
import type {
  createTaskCommentSchema,
  createTaskSchema,
  updateTaskByKeySchema,
} from "./schemas/task";

export * from "./schemas/project-team";
export * from "./schemas/task";
export * from "./schemas/doc";

export type OrgInviteDetailsFormValues = z.infer<typeof orgInviteDetailsSchema>;
export type JoinOrganizationListSchema = z.infer<
  typeof joinOrganizationListSchema
>;

export type CreateProjectFormValues = z.infer<typeof createProjectSchema>;
export type UpdateProjectFormValues = z.infer<typeof updateProjectBySlugSchema>;
export type CreateTeamFormValues = z.input<typeof createTeamSchema>;
export type UpdateTeamFormValues = z.input<typeof updateTeamSchema>;
export type CreateTaskFormValues = z.input<typeof createTaskSchema>;
export type UpdateTaskByKeyFormValues = z.input<typeof updateTaskByKeySchema>;
export type CreateTaskCommentFormValues = z.input<
  typeof createTaskCommentSchema
>;
