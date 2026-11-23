"use client";

import { WorkspaceStarterChecklist } from "~/src/components/onboarding/workspace-starter-checklist";
import { useReachable } from "~/src/components/permissions/permission-provider";
import type { DashboardWorkItem } from "~/src/lib/dashboard-data";
import type { StarterProgress } from "~/src/lib/starter-progress";
import type { TodayData } from "~/src/lib/today-data";
import { TodayDayStats } from "./components/today-day-stats";
import { TodayFocusHero } from "./components/today-focus-hero";
import { TodayPulseAndHistory } from "./components/today-pulse-and-history";
import { useTodayController } from "./hooks/use-today-controller";

export type TodayViewProps = {
  firstName: string;
  data: TodayData;
  recentWork: DashboardWorkItem[];
  links: { tasks?: string };
  starter: StarterProgress;
  organizationId: string;
};

export function TodayView({
  firstName,
  data,
  recentWork,
  links,
  starter,
  organizationId,
}: TodayViewProps) {
  const canAssign = useReachable("tasks.assign");
  const canCreateTask = useReachable("tasks.create");
  const canInvite = useReachable("members.invite");

  const {
    router,
    greeting,
    counts,
    task,
    focus,
    next,
    done,
    timer,
    running,
    busy,
    celebrating,
    planned,
    inProgress,
    pulse,
    fresh,
    start,
    pause,
    finish,
    pullNext,
  } = useTodayController({ data });

  return (
    <div className="flex w-full flex-col">
      <header className="flex flex-col gap-2">
        <p className="eyebrow" suppressHydrationWarning>
          {greeting ? `${greeting.date} · ` : ""}
          {counts}
        </p>
        <h1 className="font-display font-semibold text-[1.75rem] leading-8 tracking-tight sm:text-[length:var(--title-size)] sm:leading-9">
          {greeting?.hello ?? "Welcome back"},{" "}
          <span className="text-ink">{firstName}</span>
        </h1>
      </header>

      <WorkspaceStarterChecklist
        className="mt-5"
        progress={starter}
        organizationId={organizationId}
      />

      <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-12">
        <TodayFocusHero
          task={task}
          focus={focus}
          running={running}
          timer={timer}
          busy={busy}
          celebrating={celebrating}
          done={done}
          data={data}
          canAssign={canAssign}
          canCreateTask={canCreateTask}
          links={links}
          onStart={start}
          onPause={pause}
          onFinish={finish}
          onPullNext={pullNext}
          onRefresh={() => router.refresh()}
        />

        <TodayDayStats
          done={done}
          planned={planned}
          inProgress={inProgress}
          next={next}
          links={links}
        />

        <TodayPulseAndHistory
          pulse={pulse}
          fresh={fresh}
          data={data}
          canInvite={canInvite}
          recentWork={recentWork}
        />
      </div>
    </div>
  );
}
