export type RoleRow = {
  id: string;
  name: string;
  description: string | null;
  scope: string;
  kind: string;
  systemKey: string | null;
  permissions: string[];
  assignmentCount: number;
  editable: boolean;
};
