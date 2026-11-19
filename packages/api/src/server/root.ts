import { router, publicProcedure } from "./trpc";
import { organizationRouter } from "./routers/organization";
import { permissionsRouter } from "./routers/permissions";
import { userRouter } from "./routers/user";
import { adminRouter } from "./routers/admin";
import { hrRouter } from "./routers/hr";
import { payrollRouter } from "./routers/payroll";
import { apiKeyRouter } from "./routers/api-key";
import { webhookRouter } from "./routers/webhook";
import { customFieldRouter } from "./routers/custom-field";
import { meetingRouter } from "./routers/meeting";
import { sprintRouter } from "./routers/sprint";
import { taskViewRouter } from "./routers/task-view";
import { timesheetRouter } from "./routers/timesheet";
import { announcementRouter } from "./routers/announcement";
import { platformRouter } from "./routers/platform";
import { goalsRouter } from "./routers/goals";
import { taskTemplateRouter } from "./routers/task-template";
import { intakeRouter } from "./routers/intake";
import { ipAccessRouter } from "./routers/ip-access";
import { retentionRouter } from "./routers/retention";
import { privacyRouter } from "./routers/privacy";
import { recurrenceRouter } from "./routers/recurrence";
import { kbRouter } from "./routers/kb";
import { ticketsRouter } from "./routers/tickets";
import { activityRouter } from "./routers/activity";
import { auditRouter } from "./routers/audit";
import { calendarRouter } from "./routers/calendar";
import { commentRouter } from "./routers/comment";
import { docsRouter } from "./routers/doc";
import { chatChannelProcedures } from "./routers/chat";
import { chatLinkProcedures } from "./routers/chat-links";
import { chatExtraProcedures } from "./routers/chat-extras";
import { chatMessageProcedures } from "./routers/chat-messages";
import { favoriteRouter } from "./routers/favorite";
import { filesRouterProcedures } from "./routers/files";
import { invitationRouter } from "./routers/invitation";
import { linkRouter } from "./routers/link";
import { notificationRouter } from "./routers/notification";
import { mailRouter } from "./routers/mail";
import { memberRouter } from "./routers/member";
import { modulesRouter } from "./routers/modules";
import { projectRouter } from "./routers/project";
import { searchRouter } from "./routers/search";
import { taskRouter } from "./routers/task";
import { whiteboardRouter } from "./routers/whiteboard";
import { teamRouter } from "./routers/team";
import { automationRouter } from "./routers/automation";
import { aiRouter } from "./routers/ai";
import { custodianRouter } from "./routers/custodian";

export const appRouter = router({
  health: publicProcedure.query(() => {
    return {
      status: "ok",
      message: "tRPC is working",
    };
  }),
  activity: activityRouter,
  admin: adminRouter,
  hr: hrRouter,
  payroll: payrollRouter,
  apiKey: apiKeyRouter,
  webhook: webhookRouter,
  customField: customFieldRouter,
  meeting: meetingRouter,
  sprint: sprintRouter,
  taskView: taskViewRouter,
  timesheet: timesheetRouter,
  tickets: ticketsRouter,
  kb: kbRouter,
  recurrence: recurrenceRouter,
  privacy: privacyRouter,
  retention: retentionRouter,
  ipAccess: ipAccessRouter,
  intake: intakeRouter,
  goals: goalsRouter,
  platform: platformRouter,
  announcement: announcementRouter,
  taskTemplate: taskTemplateRouter,
  audit: auditRouter,
  automation: automationRouter,
  calendar: calendarRouter,
  comment: commentRouter,
  docs: docsRouter,
  chat: router({
    ...chatChannelProcedures,
    ...chatMessageProcedures,
    ...chatExtraProcedures,
    ...chatLinkProcedures,
  }),
  favorite: favoriteRouter,
  files: router(filesRouterProcedures),
  invitation: invitationRouter,
  link: linkRouter,
  mail: mailRouter,
  member: memberRouter,
  notification: notificationRouter,
  modules: modulesRouter,
  organization: organizationRouter,
  permissions: permissionsRouter,
  project: projectRouter,
  search: searchRouter,
  task: taskRouter,
  team: teamRouter,
  whiteboard: whiteboardRouter,
  user: userRouter,
  ai: aiRouter,
  custodian: custodianRouter,
});

export type AppRouter = typeof appRouter;
