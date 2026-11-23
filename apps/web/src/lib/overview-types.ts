export type OverviewRow = {
  id: string;
  name: string;
  href: string;
  open: number;
  doneWeek: number;
  overdue: number;
  total: number;
  done: number;
};

export type OverviewData = {
  kpis: {
    doneWeek: number;
    donePrevWeek: number;
    open: number;
    openSinceMonday: number;
    overdue: number;
    overdueSinceMonday: number;
    docsWeek: number;
    docsPrevWeek: number;
    activePeople: number;
    activePrevWeek: number;
    people: number;
  };
  /** Seven days ending today, oldest first. */
  days: Array<{ key: string; letter: string; today: boolean }>;
  heatmap: Array<{ id: string; name: string; counts: number[]; total: number }>;
  projects: OverviewRow[];
  teams: OverviewRow[];
};

export const weekdayLetters = ["S", "M", "T", "W", "T", "F", "S"];
