import type { PermissionDefinition } from "../types";
import { definePermission, org, orgTeam, all } from "./common";

export const chatPermissions: PermissionDefinition[] = [
  definePermission(
    "chat.view",
    "View chat",
    "Read public channels and the conversations the user is in.",
    "Chat",
    ["organization"],
  ),
  definePermission(
    "chat.post",
    "Send messages",
    "Post, reply and react in channels and direct messages.",
    "Chat",
    ["organization"],
  ),
  definePermission(
    "chat.channels.create",
    "Create channels",
    "Start new channels and direct messages.",
    "Chat",
    ["organization"],
  ),
  definePermission(
    "chat.files.upload",
    "Share files",
    "Attach files and images to messages.",
    "Chat",
    ["organization"],
  ),
  definePermission(
    "chat.channels.manage",
    "Manage any channel",
    "Rename, archive and change the members of any channel, not only ones the user runs.",
    "Chat",
    ["organization"],
  ),
];

export const filesPermissions: PermissionDefinition[] = [
  definePermission(
    "files.view",
    "View files",
    "Browse the organization's file library.",
    "Files",
    org,
  ),
  definePermission(
    "files.upload",
    "Upload files",
    "Add files to the library.",
    "Files",
    org,
  ),
  definePermission(
    "files.delete_own",
    "Delete own files",
    "Rename and delete files the user uploaded.",
    "Files",
    org,
  ),
  definePermission(
    "files.delete_any",
    "Delete any file",
    "Rename and delete any file in the library.",
    "Files",
    org,
  ),
];

export const calendarPermissions: PermissionDefinition[] = [
  definePermission(
    "calendar.view",
    "View calendar",
    "See the shared calendar and its events.",
    "Calendar",
    org,
  ),
  definePermission(
    "calendar.create",
    "Create events",
    "Add events to the shared calendar.",
    "Calendar",
    org,
  ),
  definePermission(
    "calendar.manage_own",
    "Edit own events",
    "Change or delete events the user created.",
    "Calendar",
    org,
  ),
  definePermission(
    "calendar.manage_any",
    "Edit any event",
    "Change or delete any event.",
    "Calendar",
    org,
  ),
];

export const whiteboardsPermissions: PermissionDefinition[] = [
  definePermission(
    "whiteboards.view",
    "View whiteboards",
    "Open the organization's whiteboards.",
    "Whiteboards",
    org,
  ),
  definePermission(
    "whiteboards.edit",
    "Edit whiteboards",
    "Create boards and draw on them.",
    "Whiteboards",
    org,
  ),
  definePermission(
    "whiteboards.delete_own",
    "Delete own whiteboards",
    "Rename and delete boards the user created.",
    "Whiteboards",
    org,
  ),
  definePermission(
    "whiteboards.delete_any",
    "Delete any whiteboard",
    "Rename and delete any board.",
    "Whiteboards",
    org,
  ),
];

export const mailPermissions: PermissionDefinition[] = [
  definePermission(
    "mail.view",
    "View mail",
    "Open the user's own inbox, sent mail and drafts.",
    "Mail",
    org,
  ),
  definePermission(
    "mail.send",
    "Send mail",
    "Write and send messages to people in the organization.",
    "Mail",
    org,
  ),
];

