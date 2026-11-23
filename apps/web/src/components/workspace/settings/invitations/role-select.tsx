"use client";

import type { FC } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@zentro/ui/components/shadcn/select";
import type { Role } from "./invitations-helpers";

export const RoleSelect: FC<{
  id: string;
  value: Role;
  onChange: (role: Role) => void;
}> = ({ id, value, onChange }) => (
  <Select
    value={value}
    onValueChange={(next) => {
      if (next !== "") onChange(next as Role);
    }}
  >
    <SelectTrigger id={id} className="w-full">
      <SelectValue />
    </SelectTrigger>
    <SelectContent>
      <SelectItem value="member">Member</SelectItem>
      <SelectItem value="admin">Admin</SelectItem>
    </SelectContent>
  </Select>
);
