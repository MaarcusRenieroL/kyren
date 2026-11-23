import type { PermissionDefinition } from "../types";
import { definePermission, org, orgTeam, all } from "./common";

export const ticketsPermissions: PermissionDefinition[] = [
  definePermission(
    "tickets.view",
    "View tickets",
    "Open the support queue and read tickets.",
    "Tickets",
    org,
  ),
  definePermission(
    "tickets.create",
    "Create tickets",
    "Log a new support request.",
    "Tickets",
    org,
  ),
  definePermission(
    "tickets.reply",
    "Reply to tickets",
    "Answer the requester and leave internal notes.",
    "Tickets",
    org,
  ),
  definePermission(
    "tickets.update",
    "Update tickets",
    "Change status, priority, assignee and the linked task.",
    "Tickets",
    org,
  ),
  definePermission(
    "tickets.delete",
    "Delete tickets",
    "Remove a ticket and its thread.",
    "Tickets",
    org,
  ),
  definePermission(
    "tickets.manage_sla",
    "Manage response targets",
    "Set how fast tickets of each priority must be answered and resolved.",
    "Tickets",
    org,
  ),
  definePermission(
    "tickets.manage_inbox",
    "Manage the support email address",
    "Turn on email to ticket and replace the address.",
    "Tickets",
    org,
  ),
  definePermission(
    "tickets.manage_forms",
    "Manage intake forms",
    "Build public forms whose answers open tickets.",
    "Tickets",
    org,
  ),
  definePermission(
    "tickets.manage_articles",
    "Manage help articles",
    "Write, publish and delete knowledge base articles.",
    "Tickets",
    org,
  ),
];

export const hrPermissions: PermissionDefinition[] = [
  definePermission(
    "hr.view",
    "View the directory",
    "See the people directory (name, title, team and location).",
    "HR",
    org,
  ),
  definePermission(
    "hr.leave.request",
    "Request time off",
    "Ask for leave and cancel the user's own requests.",
    "HR",
    org,
  ),
  definePermission(
    "hr.manage",
    "Manage people",
    "Add and edit employee records, and approve or reject leave.",
    "HR",
    org,
  ),
];

export const payrollPermissions: PermissionDefinition[] = [
  definePermission(
    "payroll.payslips.view",
    "View own payslips",
    "See the user's own payslips in finished pay runs.",
    "Payroll",
    org,
  ),
  definePermission(
    "payroll.view",
    "View payroll",
    "See every pay run, payslip and salary.",
    "Payroll",
    org,
  ),
  definePermission(
    "payroll.manage",
    "Manage payroll",
    "Set salaries, create draft pay runs and add bonuses.",
    "Payroll",
    org,
  ),
  definePermission(
    "payroll.approve",
    "Approve payroll",
    "Approve a pay run and mark it paid.",
    "Payroll",
    org,
  ),
];

export const adminPermissions: PermissionDefinition[] = [
  definePermission(
    "admin.view",
    "Open administration",
    "See usage, security and setup status for the whole organization.",
    "Administration",
    org,
  ),
  definePermission(
    "admin.manage_api_keys",
    "Manage API keys",
    "Create and revoke keys for the public API.",
    "Administration",
    org,
  ),
  definePermission(
    "admin.manage_webhooks",
    "Manage webhooks",
    "Choose where organization events are sent, and see their deliveries.",
    "Administration",
    org,
  ),
  definePermission(
    "admin.manage_custom_fields",
    "Manage task fields",
    "Add and remove the extra fields every task carries.",
    "Administration",
    org,
  ),
  definePermission(
    "admin.manage_privacy",
    "Export and erase personal data",
    "Download everything held about a member, or remove a member and their personal data.",
    "Administration",
    org,
  ),
  definePermission(
    "admin.manage_retention",
    "Manage data retention",
    "Choose how long chat and closed tickets are kept, and place a legal hold.",
    "Administration",
    org,
  ),
  definePermission(
    "admin.manage_ip_access",
    "Manage network access",
    "Limit the organization to chosen IP addresses and ranges.",
    "Administration",
    org,
  ),
  definePermission(
    "time.view_report",
    "View the time report",
    "See how much time everyone logged on tasks.",
    "Administration",
    org,
  ),
];
