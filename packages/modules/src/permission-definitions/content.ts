import type { PermissionDefinition } from "../types";
import { definePermission, org, orgTeam, all } from "./common";

export const docsPermissions: PermissionDefinition[] = [
  definePermission("docs.view", "View docs", "Read docs.", "Docs", all),
  definePermission(
    "docs.create",
    "Create docs",
    "Create new docs.",
    "Docs",
    all,
  ),
  definePermission(
    "docs.update_own",
    "Edit own docs",
    "Edit docs the user created.",
    "Docs",
    all,
  ),
  definePermission(
    "docs.update_any",
    "Edit any doc",
    "Edit any doc.",
    "Docs",
    all,
  ),
  definePermission(
    "docs.trash_own",
    "Trash own docs",
    "Move docs the user created to the trash.",
    "Docs",
    all,
  ),
  definePermission(
    "docs.trash_any",
    "Trash any doc",
    "Move any doc to the trash.",
    "Docs",
    all,
  ),
  definePermission(
    "docs.restore",
    "Restore docs",
    "Restore docs from the trash.",
    "Docs",
    all,
  ),
  definePermission(
    "docs.delete",
    "Delete docs permanently",
    "Permanently delete docs.",
    "Docs",
    all,
    { uiOnly: "Docs can only be moved to the trash for now." },
  ),
  definePermission(
    "docs.comment",
    "Comment on docs",
    "Write and resolve doc comments.",
    "Docs",
    all,
  ),
  definePermission("docs.search", "Search docs", "Search docs.", "Docs", all),
];

// Not owned by one module.
export const platformPermissions: PermissionDefinition[] = [
  definePermission(
    "modules.view",
    "View modules",
    "See which modules are turned on.",
    "Modules",
    org,
  ),
  definePermission(
    "modules.manage",
    "Manage modules",
    "Turn modules on and off.",
    "Modules",
    org,
  ),
  definePermission(
    "comments.update_own",
    "Edit own comments",
    "Edit comments the user wrote.",
    "Comments",
    all,
    { uiOnly: "Comments cannot be edited yet." },
  ),
  definePermission(
    "comments.update_any",
    "Edit any comment",
    "Edit any comment.",
    "Comments",
    all,
    { uiOnly: "Comments cannot be edited yet." },
  ),
  definePermission(
    "comments.delete_own",
    "Delete own comments",
    "Delete comments the user wrote.",
    "Comments",
    all,
    { uiOnly: "Comments cannot be deleted yet." },
  ),
  definePermission(
    "comments.delete_any",
    "Delete any comment",
    "Delete any comment.",
    "Comments",
    all,
    { uiOnly: "Comments cannot be deleted yet." },
  ),
];

// Chat belongs to the whole organization: channels are found and joined
// there, so its keys have no team or project scope.
