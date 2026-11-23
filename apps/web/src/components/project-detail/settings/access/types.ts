import { GlobeIcon, LockIcon, UsersIcon } from "lucide-react";

export type Visibility = "organization" | "team" | "private";
export type Option = { id: string; label: string };
export type Access = {
  projectId: string;
  visibility: Visibility;
  teamId: string | null;
  availableRoles: Array<{ id: string; name: string }>;
  assignments: Array<{
    id: string;
    roleId: string;
    roleName: string;
    principalType: "user" | "team";
    principalId: string;
    principalName: string;
  }>;
};

export const noTeam = "__none__";

export const visibilityCards: Record<
  Visibility,
  { title: string; body: string; Icon: typeof GlobeIcon }
> = {
  organization: {
    title: "Everyone in the organization",
    body: "Anyone in the organization can find and view it. Editing still needs a project role.",
    Icon: GlobeIcon,
  },
  team: {
    title: "The owning team",
    body: "The owning team and the people added below. Hidden from everyone else.",
    Icon: UsersIcon,
  },
  private: {
    title: "Only people added here",
    body: "Hidden from search and Projects for everyone else, except owners and admins.",
    Icon: LockIcon,
  },
};

export const field =
  "h-11 w-full justify-start gap-2.5 rounded-md border-hairline bg-surface text-[15px] shadow-none data-[size=default]:h-11 [&>svg:last-child]:ml-auto";
