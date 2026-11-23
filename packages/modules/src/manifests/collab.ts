import type { ModuleManifest } from "../types";
import {
  docsPermissions,
  chatPermissions,
  filesPermissions,
  calendarPermissions,
  whiteboardsPermissions,
} from "../permission-definitions";

export const collabManifests: readonly ModuleManifest[] = [
  {
    id: "docs",
    name: "Docs",
    description: "Write, organize and discuss documentation.",
    icon: "BookOpen",
    basePath: "/docs",
    core: false,
    defaultEnabled: true,
    dependsOn: [],
    permissionNamespaces: ["docs"],
    permissions: docsPermissions,
    nav: [
      {
        id: "work",
        label: "Work",
        order: 20,
        items: [
          {
            label: "Docs",
            href: "/docs",
            permission: "docs.view",
            icon: "BookOpen",
            children: [
              {
                label: "All docs",
                href: "/docs",
                permission: "docs.view",
                icon: "FileText",
              },
              {
                label: "My docs",
                href: "/docs/my-docs",
                permission: "docs.view",
                icon: "Star",
              },
              {
                label: "Recent",
                href: "/docs/recent",
                permission: "docs.view",
                icon: "Calendar",
              },
              {
                label: "Project docs",
                href: "/docs/projects",
                permission: "docs.view",
                icon: "Folder",
              },
              {
                label: "Trash",
                href: "/docs/trash",
                permission: "docs.view",
                icon: "Trash2",
              },
            ],
          },
        ],
      },
    ],
  },
  {
    id: "chat",
    name: "Chat",
    description:
      "Channels and direct messages next to the work, linked to tasks and projects.",
    icon: "MessageSquare",
    basePath: "/chat",
    core: false,
    defaultEnabled: true,
    dependsOn: [],
    permissionNamespaces: ["chat"],
    permissions: chatPermissions,
    nav: [
      {
        id: "work",
        label: "Work",
        order: 20,
        items: [
          {
            label: "Chat",
            href: "/chat",
            permission: "chat.view",
            icon: "MessageSquare",
            children: [
              {
                label: "Mentions",
                href: "/chat/mentions",
                permission: "chat.view",
                icon: "AtSign",
              },
              {
                label: "Search messages",
                href: "/chat/search",
                permission: "chat.view",
                icon: "Search",
              },
            ],
          },
        ],
      },
    ],
  },
  {
    id: "files",
    name: "Files",
    description: "One library for every file your team shares.",
    icon: "Folder",
    basePath: "/files",
    core: false,
    defaultEnabled: true,
    dependsOn: [],
    permissionNamespaces: ["files"],
    permissions: filesPermissions,
    nav: [
      {
        id: "work",
        label: "Work",
        order: 20,
        items: [
          {
            label: "Files",
            href: "/files",
            permission: "files.view",
            icon: "Folder",
          },
        ],
      },
    ],
  },
  {
    id: "calendar",
    name: "Calendar",
    description: "A shared calendar for meetings, deadlines and time off.",
    icon: "Calendar",
    basePath: "/calendar",
    core: false,
    defaultEnabled: true,
    dependsOn: [],
    permissionNamespaces: ["calendar"],
    permissions: calendarPermissions,
    nav: [
      {
        id: "work",
        label: "Work",
        order: 20,
        items: [
          {
            label: "Calendar",
            href: "/calendar",
            permission: "calendar.view",
            icon: "Calendar",
          },
        ],
      },
    ],
  },
  {
    id: "whiteboards",
    name: "Whiteboards",
    description: "Sketch, diagram and plan together on an open canvas.",
    icon: "PenTool",
    basePath: "/whiteboards",
    core: false,
    defaultEnabled: true,
    dependsOn: [],
    permissionNamespaces: ["whiteboards"],
    permissions: whiteboardsPermissions,
    nav: [
      {
        id: "work",
        label: "Work",
        order: 20,
        items: [
          {
            label: "Whiteboards",
            href: "/whiteboards",
            permission: "whiteboards.view",
            icon: "PenTool",
          },
        ],
      },
    ],
  },
];
