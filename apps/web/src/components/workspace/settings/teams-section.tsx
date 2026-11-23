"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { paths } from "~/src/lib/paths";
import { useTrpcClient } from "@zentro/api/react";
import { toastError, toastSuccess } from "@zentro/ui";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@zentro/ui/components/shadcn/alert-dialog";
import { Skeleton } from "@zentro/ui/components/shadcn/skeleton";
import { TeamCard } from "./teams/team-card";
import { TeamDialog } from "./teams/team-dialog";
import { TeamsEmptyState, TeamsStats } from "./teams/teams-stats";
import {
  emptyForm,
  type AvailableMember,
  type Team,
  type TeamColor,
  type TeamFormState,
  type TeamScopeCounts,
  type TeamsSectionProps,
} from "./teams/teams-types";

export type { TeamsSectionProps };

export function TeamsSection({ permissions }: TeamsSectionProps) {
  const trpc = useTrpcClient();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [teams, setTeams] = useState<Team[]>([]);
  const [availableMembers, setAvailableMembers] = useState<AvailableMember[]>([]);
  const [scopeCounts, setScopeCounts] = useState<TeamScopeCounts>({});
  const [isLoading, setIsLoading] = useState(true);
  const [dialogMode, setDialogMode] = useState<"create" | "edit">("create");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTeamId, setEditingTeamId] = useState<string | null>(null);
  const [form, setForm] = useState<TeamFormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [teamToDelete, setTeamToDelete] = useState<Team | null>(null);

  async function loadTeams() {
    setIsLoading(true);
    try {
      const [teamList, memberList] = await Promise.all([
        trpc.team.getAll.query(),
        trpc.team.getAvailableMembers.query(),
      ]);
      const [projectList, taskList, docList] = await Promise.all([
        trpc.project.getProjectsByOrgId.query().catch(() => []),
        trpc.task.getTasksByOrgId.query({}).catch(() => []),
        trpc.docs.getAll.query({}).catch(() => []),
      ]);
      const nextScopeCounts: TeamScopeCounts = {};

      for (const team of teamList) {
        nextScopeCounts[team.id] = {
          projects: 0,
          archived: 0,
          tasks: 0,
          docs: 0,
        };
      }

      for (const project of projectList) {
        if (project.teamId) {
          const counts = nextScopeCounts[project.teamId];
          if (counts) {
            counts.projects += 1;
            if (project.archivedAt) counts.archived += 1;
          }
        }
      }

      for (const task of taskList) {
        if (task.teamId && task.status !== "done") {
          const counts = nextScopeCounts[task.teamId];
          if (counts) counts.tasks += 1;
        }
      }

      for (const doc of docList) {
        if (doc.teamId) {
          const counts = nextScopeCounts[doc.teamId];
          if (counts) counts.docs += 1;
        }
      }

      setTeams(teamList);
      setAvailableMembers(memberList);
      setScopeCounts(nextScopeCounts);
    } catch (error) {
      toastError(error, "Failed to load teams");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadTeams();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const wantsNew = searchParams.get("new") === "1";
  const wantsEdit = searchParams.get("edit");

  useEffect(() => {
    if (isLoading || (!wantsNew && !wantsEdit)) return;

    const team = wantsEdit
      ? teams.find((entry) => entry.id === wantsEdit)
      : null;

    if (wantsNew && permissions.canCreateTeams) openCreateDialog();
    if (team) openEditDialog(team);
    router.replace(paths.teamsSettings(), { scroll: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading, wantsNew, wantsEdit]);

  function openCreateDialog() {
    setDialogMode("create");
    setEditingTeamId(null);
    setForm(emptyForm);
    setDialogOpen(true);
  }

  function openEditDialog(team: Team) {
    setDialogMode("edit");
    setEditingTeamId(team.id);
    setForm({
      name: team.name,
      description: team.description ?? "",
      color: team.color as TeamColor,
      memberIds: team.members.map((member) => member.memberId),
    });
    setDialogOpen(true);
  }

  async function saveTeam(changes: { details: boolean; members: boolean }) {
    try {
      setSaving(true);
      if (dialogMode === "create") {
        await trpc.team.create.mutate({
          name: form.name,
          description: form.description,
          color: form.color,
          memberIds: form.memberIds,
        });
        toastSuccess("Team created");
      } else if (editingTeamId) {
        if (changes.details) {
          await trpc.team.update.mutate({
            id: editingTeamId,
            name: form.name,
            description: form.description,
            color: form.color,
          });
        }
        if (changes.members) {
          await trpc.team.updateMembers.mutate({
            teamId: editingTeamId,
            memberIds: form.memberIds,
          });
        }
        toastSuccess("Team updated");
      }
      setDialogOpen(false);
      await loadTeams();
    } catch (error) {
      toastError(error, "Failed to save team");
    } finally {
      setSaving(false);
    }
  }

  async function deleteTeam() {
    if (!teamToDelete) return;
    try {
      await trpc.team.delete.mutate({ id: teamToDelete.id });
      toastSuccess("Team deleted");
      setTeamToDelete(null);
      await loadTeams();
    } catch (error) {
      toastError(error, "Failed to delete team");
    }
  }

  return (
    <div className="flex flex-col gap-5">
      {isLoading ? (
        <div className="grid gap-3 lg:grid-cols-2">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-36 rounded-xl" />
          ))}
        </div>
      ) : teams.length ? (
        <>
          <TeamsStats
            teams={teams}
            availableMembers={availableMembers}
            scopeCounts={scopeCounts}
          />
          <div className="grid gap-3 lg:grid-cols-2">
            {teams.map((team) => (
              <TeamCard
                key={team.id}
                team={team}
                counts={scopeCounts[team.id]}
                onEdit={() => openEditDialog(team)}
                onDelete={() => setTeamToDelete(team)}
              />
            ))}
          </div>
        </>
      ) : (
        <TeamsEmptyState
          canCreate={permissions.canCreateTeams}
          onCreate={openCreateDialog}
        />
      )}

      <TeamDialog
        availableMembers={availableMembers}
        teamId={editingTeamId}
        form={form}
        mode={dialogMode}
        open={dialogOpen}
        saving={saving}
        onChange={setForm}
        onOpenChange={setDialogOpen}
        onSubmit={saveTeam}
      />

      <AlertDialog
        open={Boolean(teamToDelete)}
        onOpenChange={(open) => {
          if (!open) setTeamToDelete(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete team?</AlertDialogTitle>
            <AlertDialogDescription>
              {teamToDelete?.name} will be removed from team lists. Members will
              stay in the organization.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={deleteTeam}
            >
              Delete team
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
