/**
 * Codes are only ever emailed to verify an address. Signing in, resetting a
 * password or changing an email with a code would skip two-factor and the
 * password, so those routes are switched off.
 */
export const disabledCodePaths = [
  "/sign-in/email-otp",
  "/forget-password/email-otp",
  "/email-otp/request-password-reset",
  "/email-otp/reset-password",
  "/email-otp/check-verification-otp",
  "/email-otp/request-email-change",
  "/email-otp/change-email",
];

// Endpoints that read or change organization data are only reachable through
// our tRPC procedures, which check permissions with @zentro/permissions. Better
// Auth's own role check is wide open (see access-control.ts), so leaving these
// reachable over HTTP would let any member call them directly.
export const disabledOrganizationPaths = [
  "/organization/add-team-member",
  "/organization/cancel-invitation",
  "/organization/create-role",
  "/organization/create-team",
  "/organization/delete",
  "/organization/delete-role",
  "/organization/get-active-member",
  "/organization/get-active-member-role",
  "/organization/get-full-organization",
  "/organization/get-invitation",
  "/organization/get-organization",
  "/organization/get-role",
  "/organization/has-permission",
  "/organization/invite-member",
  "/organization/list-invitations",
  "/organization/list-members",
  "/organization/list-roles",
  "/organization/list-team-members",
  "/organization/list-teams",
  "/organization/list-user-invitations",
  "/organization/list-user-teams",
  "/organization/remove-member",
  "/organization/remove-team",
  "/organization/remove-team-member",
  "/organization/set-active-team",
  "/organization/update",
  "/organization/update-member-role",
  "/organization/update-role",
  "/organization/update-team",
  // Accepts any session field, including `activeOrganizationId`, so a session
  // could be pointed at an organization the user does not belong to.
  "/update-session",
];
