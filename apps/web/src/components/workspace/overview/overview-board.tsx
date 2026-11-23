import { ArrowUpIcon } from "lucide-react";
import type { FC } from "react";
import type { DashboardActivityItem } from "~/src/lib/dashboard-data";
import type { OverviewData } from "~/src/lib/overview-data";
import { MostDiscussed } from "./most-discussed";
import { WorkspaceStarterChecklist } from "~/src/components/onboarding/workspace-starter-checklist";
import type { StarterProgress } from "~/src/lib/starter-progress";
import { Change, Kpi, Pill } from "./kpi-widgets";
import { Breakdown } from "./breakdown-table";
import { DoneHeatmap } from "./activity-heatmap";
import { ActivityTimeline } from "./activity-timeline";

type Props = {
  data: OverviewData;
  activity: DashboardActivityItem[];
  canSeeAudit: boolean;
  starter: StarterProgress;
  organizationId: string;
};

/** The organization at a glance, for owners and admins. */
export const OverviewBoard: FC<Props> = ({
  data,
  activity,
  canSeeAudit,
  starter,
  organizationId,
}) => {
  const { kpis } = data;

  return (
    <div className="flex flex-col gap-6">
      <WorkspaceStarterChecklist
        progress={starter}
        organizationId={organizationId}
      />
      <section aria-labelledby="workspace-numbers">
        <h2 id="workspace-numbers" className="sr-only">
          Workspace numbers
        </h2>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
          <Kpi label="Tasks done · 7d" value={kpis.doneWeek}>
            <Change
              now={kpis.doneWeek}
              before={kpis.donePrevWeek}
              suffix="vs last week"
              percent
            />
          </Kpi>
          <Kpi label="Open tasks" value={kpis.open}>
            <Pill>
              {kpis.openSinceMonday ? (
                <ArrowUpIcon className="size-3" aria-hidden="true" />
              ) : null}
              {kpis.openSinceMonday} since Monday
            </Pill>
          </Kpi>
          <Kpi label="Overdue" value={kpis.overdue} tone="bad">
            <Pill tone={kpis.overdueSinceMonday ? "bad" : undefined}>
              {kpis.overdueSinceMonday ? (
                <ArrowUpIcon className="size-3" aria-hidden="true" />
              ) : null}
              {kpis.overdueSinceMonday} since Monday
            </Pill>
          </Kpi>
          <Kpi label="Docs edited · 7d" value={kpis.docsWeek}>
            <Change
              now={kpis.docsWeek}
              before={kpis.docsPrevWeek}
              suffix="vs last week"
            />
          </Kpi>
          <Kpi label="Active people" value={kpis.activePeople} of={kpis.people}>
            <Change
              now={kpis.activePeople}
              before={kpis.activePrevWeek}
              suffix="vs last week"
            />
          </Kpi>
        </div>
      </section>

      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="flex min-w-0 flex-col gap-8">
          <DoneHeatmap data={data} />
          <Breakdown
            label="Project"
            rows={data.projects}
            empty="No projects yet."
          />
          <Breakdown label="Team" rows={data.teams} empty="No teams yet." />
        </div>

        <ActivityTimeline activity={activity} canSeeAudit={canSeeAudit} />

        <MostDiscussed />
      </div>
    </div>
  );
};
