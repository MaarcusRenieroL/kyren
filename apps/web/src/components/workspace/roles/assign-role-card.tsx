"use client";

import { useMemo } from "react";
import { Button } from "@kyren/ui/shadcn/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@kyren/ui/shadcn/card";
import { Label } from "@kyren/ui/shadcn/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@kyren/ui/shadcn/select";

import { scopeLabels } from "./use-catalog";
import type { Option, RoleOption } from "./assignments-types";

type Props = {
  roles: RoleOption[];
  roleId: string;
  setRoleId: (id: string) => void;
  principalType: "user" | "team";
  setPrincipalType: (type: "user" | "team") => void;
  principalId: string;
  setPrincipalId: (id: string) => void;
  scopeId: string;
  setScopeId: (id: string) => void;
  people: Option[];
  teams: Option[];
  projects: Option[];
  onAssign: () => void;
};

export function AssignRoleCard({
  roles,
  roleId,
  setRoleId,
  principalType,
  setPrincipalType,
  principalId,
  setPrincipalId,
  scopeId,
  setScopeId,
  people,
  teams,
  projects,
  onAssign,
}: Props) {
  const selectedRole = roles.find((role) => role.id === roleId);
  const scopeOptions = useMemo(() => {
    if (selectedRole?.scope === "team") return teams;
    if (selectedRole?.scope === "project") return projects;

    return [];
  }, [selectedRole, teams, projects]);

  const principals = principalType === "user" ? people : teams;
  const ready =
    roleId &&
    principalId &&
    (selectedRole?.scope === "organization" || scopeId);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Assign a role</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4 md:grid-cols-4">
        <div className="space-y-2">
          <Label>Role</Label>
          <Select
            value={roleId}
            onValueChange={(value) => {
              setRoleId(value);
              setScopeId("");
            }}
          >
            <SelectTrigger aria-label="Role">
              <SelectValue placeholder="Choose a role" />
            </SelectTrigger>
            <SelectContent>
              {roles.map((role) => (
                <SelectItem key={role.id} value={role.id}>
                  {role.name} ({scopeLabels[role.scope]})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Assign to</Label>
          <Select
            value={principalType}
            onValueChange={(value) => {
              setPrincipalType(value as "user" | "team");
              setPrincipalId("");
            }}
          >
            <SelectTrigger aria-label="Principal type">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="user">A member</SelectItem>
              <SelectItem value="team">A team</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>{principalType === "user" ? "Member" : "Team"}</Label>
          <Select value={principalId} onValueChange={setPrincipalId}>
            <SelectTrigger aria-label="Principal">
              <SelectValue placeholder="Choose" />
            </SelectTrigger>
            <SelectContent>
              {principals.map((option) => (
                <SelectItem key={option.id} value={option.id}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {selectedRole && selectedRole.scope !== "organization" ? (
          <div className="space-y-2">
            <Label>{scopeLabels[selectedRole.scope]}</Label>
            <Select value={scopeId} onValueChange={setScopeId}>
              <SelectTrigger aria-label="Scope">
                <SelectValue placeholder="Choose" />
              </SelectTrigger>
              <SelectContent>
                {scopeOptions.map((option) => (
                  <SelectItem key={option.id} value={option.id}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : null}
        <div className="md:col-span-4">
          <Button disabled={!ready} onClick={onAssign}>
            Assign role
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
