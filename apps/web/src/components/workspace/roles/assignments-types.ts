export type Option = { id: string; label: string };

export type AssignmentRow = {
  id: string;
  roleName: string;
  principalType: "user" | "team";
  principalName: string;
  scopeType: "organization" | "team" | "project";
  scopeId: string;
  scopeName: string;
};

export type RoleOption = {
  id: string;
  name: string;
  scope: string;
  systemKey: string | null;
};
