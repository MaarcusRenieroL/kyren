import type { ModuleManifest } from "../types";
import {
  mailPermissions,
  ticketsPermissions,
  hrPermissions,
  payrollPermissions,
  adminPermissions,
} from "../permission-definitions";

export const extendedManifests: readonly ModuleManifest[] = [
  {
    id: "mail",
    // Internal to the organization, so not called "Mail" until it can reach
    // outside addresses.
    name: "Messages",
    description: "Private messages between people in your organization.",
    icon: "Inbox",
    basePath: "/mail",
    core: false,
    defaultEnabled: true,
    dependsOn: [],
    permissionNamespaces: ["mail"],
    permissions: mailPermissions,
    nav: [
      {
        id: "work",
        label: "Work",
        order: 20,
        items: [
          {
            label: "Messages",
            href: "/mail",
            permission: "mail.view",
            icon: "Inbox",
          },
        ],
      },
    ],
  },
  {
    id: "tickets",
    name: "Tickets",
    description: "Support requests, replies and the tasks that fix them.",
    icon: "LifeBuoy",
    basePath: "/tickets",
    core: false,
    defaultEnabled: true,
    dependsOn: [],
    permissionNamespaces: ["tickets"],
    permissions: ticketsPermissions,
    nav: [
      {
        id: "work",
        label: "Work",
        order: 20,
        items: [
          {
            label: "Tickets",
            href: "/tickets",
            permission: "tickets.view",
            icon: "LifeBuoy",
          },
        ],
      },
    ],
  },
  {
    id: "hr",
    name: "HR",
    description: "Employee records, time off and the people directory.",
    icon: "UserRound",
    basePath: "/hr",
    core: false,
    defaultEnabled: true,
    dependsOn: [],
    permissionNamespaces: ["hr"],
    permissions: hrPermissions,
    nav: [
      {
        id: "people",
        label: "People",
        order: 25,
        items: [
          {
            label: "HR",
            href: "/hr",
            permission: "hr.view",
            icon: "UserRound",
          },
        ],
      },
    ],
  },
  {
    id: "payroll",
    name: "Payroll",
    description: "Run pay from the same employee records.",
    icon: "Wallet",
    basePath: "/payroll",
    core: false,
    defaultEnabled: true,
    dependsOn: [],
    permissionNamespaces: ["payroll"],
    permissions: payrollPermissions,
    nav: [
      {
        id: "people",
        label: "People",
        order: 25,
        items: [
          {
            label: "Payroll",
            href: "/payroll",
            permission: "payroll.payslips.view",
            icon: "Wallet",
          },
        ],
      },
    ],
  },
  {
    id: "admin",
    name: "Administration",
    description: "One console for usage, security and setup.",
    icon: "ShieldCheck",
    basePath: "/admin",
    core: false,
    defaultEnabled: true,
    dependsOn: [],
    permissionNamespaces: ["admin", "time"],
    permissions: adminPermissions,
    nav: [
      {
        id: "organization",
        label: "Organization",
        order: 30,
        items: [
          {
            label: "Administration",
            href: "/admin",
            permission: "admin.view",
            icon: "ShieldCheck",
          },
        ],
      },
    ],
  },
];
