export type TeamColor =
  | "slate"
  | "red"
  | "orange"
  | "amber"
  | "green"
  | "blue"
  | "purple"
  | "pink";

export type AvailableMember = {
  id: string;
  role: string;
  userId: string;
  name: string;
  email: string;
  image: string | null;
};

export type TeamMember = AvailableMember & {
  teamId: string;
  memberId: string;
  createdAt: Date;
};

export type Team = {
  id: string;
  name: string;
  description: string | null;
  color: string;
  createdByMemberId: string | null;
  createdAt: Date;
  updatedAt: Date;
  members: TeamMember[];
};

export type TeamScopeCounts = Record<
  string,
  {
    projects: number;
    archived: number;
    tasks: number;
    docs: number;
  }
>;

export type TeamFormState = {
  name: string;
  description: string;
  color: TeamColor;
  memberIds: string[];
};

export type TeamsSectionProps = {
  permissions: {
    canCreateTeams: boolean;
    canUpdateTeams: boolean;
    canDeleteTeams: boolean;
    canManageTeamMembers: boolean;
  };
};

export const teamColors: Array<{
  value: TeamColor;
  label: string;
  className: string;
}> = [
  { value: "slate", label: "Slate", className: "bg-ink-3" },
  { value: "red", label: "Red", className: "cat-1 bg-(--cat)" },
  { value: "orange", label: "Orange", className: "cat-2 bg-(--cat)" },
  { value: "amber", label: "Amber", className: "cat-3 bg-(--cat)" },
  { value: "green", label: "Green", className: "cat-4 bg-(--cat)" },
  { value: "blue", label: "Blue", className: "cat-6 bg-(--cat)" },
  { value: "purple", label: "Purple", className: "cat-7 bg-(--cat)" },
  { value: "pink", label: "Pink", className: "cat-8 bg-(--cat)" },
];

export const emptyForm: TeamFormState = {
  name: "",
  description: "",
  color: "slate",
  memberIds: [],
};

export function getColorClass(color: string) {
  return (
    teamColors.find((teamColor) => teamColor.value === color)?.className ??
    "bg-ink-3"
  );
}

export function formatRole(role: string) {
  return role.charAt(0).toUpperCase() + role.slice(1);
}

export function sortMembers<T extends Pick<AvailableMember, "email" | "name">>(
  members: T[],
) {
  return [...members].sort(
    (a, b) => a.name.localeCompare(b.name) || a.email.localeCompare(b.email),
  );
}
