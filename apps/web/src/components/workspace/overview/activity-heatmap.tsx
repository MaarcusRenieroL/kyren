import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from "@zentro/ui/shadcn/table";
import { cn } from "@zentro/ui/lib/utils";
import type { OverviewData } from "~/src/lib/overview-data";

/** Done-task counts as cells: darker green means more finished that day. */
export function heatClass(count: number, max: number) {
  if (count === 0) return "bg-sunken text-transparent";

  const level = count / Math.max(max, 1);

  if (level > 0.75) return "bg-success text-on-success";
  if (level > 0.4) return "bg-success/70 text-on-success";

  return "bg-success/35 text-ink";
}

export function DoneHeatmap({ data }: { data: OverviewData }) {
  const max = Math.max(0, ...data.heatmap.flatMap((row) => row.counts));
  const doneTotal = data.heatmap.reduce((sum, row) => sum + row.total, 0);

  return (
    <section
      aria-labelledby="done-week"
      className="tile flex flex-col gap-4 p-5"
    >
      <div className="flex items-baseline gap-3">
        <h2 id="done-week" className="flex-1 font-semibold">
          Tasks done, last 7 days
        </h2>
        <span className="font-mono text-xs text-ink-3">{doneTotal} total</span>
      </div>
      {data.heatmap.length ? (
        <Table className="w-full min-w-[17rem] border-separate border-spacing-1 text-sm sm:min-w-[30rem]">
          <TableHeader className="static bg-transparent [&_tr]:border-0">
            <TableRow className="h-auto border-0 hover:bg-transparent">
              <TableHead className="h-auto px-0 w-20 sm:w-28" />
              {data.days.map((day) => (
                <TableHead
                  key={day.key}
                  scope="col"
                  className={cn(
                    "h-auto px-0 text-center pb-1 font-mono text-[11px] font-normal text-ink-3",
                    day.today && "font-semibold text-ink",
                  )}
                >
                  {day.letter}
                </TableHead>
              ))}
              <TableHead className="h-auto px-0 w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.heatmap.map((row) => (
              <TableRow
                className="h-auto border-0 hover:bg-transparent"
                key={row.id}
              >
                <TableHead
                  scope="row"
                  className="h-auto px-0 normal-case tracking-normal max-w-20 truncate pr-2 text-left font-normal text-ink-2 sm:max-w-28"
                >
                  {row.name}
                </TableHead>
                {row.counts.map((count, index) => (
                  <TableCell
                    key={data.days[index]!.key}
                    className={cn(
                      "px-0 py-0 h-8 rounded-sm text-center font-mono text-xs",
                      heatClass(count, max),
                    )}
                  >
                    {count || ""}
                  </TableCell>
                ))}
                <TableCell className="px-0 text-right font-mono text-sm">
                  {row.total}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ) : (
        <p className="text-sm text-ink-2">
          Make teams and give them work to see who finishes what, day by day.
        </p>
      )}
    </section>
  );
}
