"use client";

import { useCallback, useEffect, useState } from "react";
import { PlusIcon } from "lucide-react";

import { useTrpcClient } from "@kyren/api/react";
import type { AppRouter } from "@kyren/api/server";
import type { inferRouterOutputs } from "@trpc/server";
import { EmptyState } from "@kyren/ui/components/empty-state";
import { PageHeader } from "@kyren/ui/components/page-header";
import { Button } from "@kyren/ui/shadcn/button";
import { toast, toastError } from "@kyren/ui/index";

import { messageOf } from "../tickets/labels";
import { HrTabs } from "./hr-tabs";
import { statusTone, typeLabels, range } from "./leave-helpers";
import { RequestDialog } from "./leave-request-dialog";

type Leave = inferRouterOutputs<AppRouter>["hr"]["leaveList"];

export function LeaveBoard() {
  const trpc = useTrpcClient();
  const [leave, setLeave] = useState<Leave | null>(null);
  const [failed, setFailed] = useState(false);
  const [requesting, setRequesting] = useState(false);

  const load = useCallback(async () => {
    try {
      setLeave(await trpc.hr.leaveList.query());
      setFailed(false);
    } catch {
      setFailed(true);
    }
  }, [trpc]);

  useEffect(() => {
    void load();
  }, [load]);

  async function act(action: () => Promise<unknown>, failure: string) {
    try {
      await action();
      await load();
    } catch (error) {
      toastError(failure, messageOf(error));
    }
  }

  const requestButton = leave?.canRequest ? (
    <Button onClick={() => setRequesting(true)}>
      <PlusIcon aria-hidden />
      Request time off
    </Button>
  ) : null;

  return (
    <div className="flex min-w-0 flex-1 flex-col gap-6 overflow-y-auto p-6">
      <PageHeader
        title="Time off"
        description={
          leave?.canManage
            ? "Requests from everyone. Pending ones wait for your decision."
            : "Your requests and how they were answered."
        }
        actions={requestButton}
      />
      <HrTabs />

      {leave?.balance ? (
        <p className="text-sm text-ink-2">
          <span className="font-medium text-ink">
            {leave.balance.remaining} of{" "}
            {leave.balance.earned + leave.balance.carried} days
          </span>{" "}
          of annual leave left in {leave.balance.year}
          {leave.balance.accrual === "monthly"
            ? ` (earned so far of ${leave.balance.allowance} this year)`
            : ""}
          {leave.balance.carried
            ? ` (${leave.balance.carried} carried over from ${leave.balance.year - 1})`
            : ""}
          , counting requests still waiting for a decision.
        </p>
      ) : null}

      {failed ? (
        <EmptyState
          title="Time off did not load"
          description="Check your connection and try again."
          action={<Button onClick={() => void load()}>Retry</Button>}
        />
      ) : leave === null ? (
        <p role="status" className="text-sm text-ink-2">
          Loading requests…
        </p>
      ) : leave.requests.length === 0 ? (
        <EmptyState
          title="No requests"
          description={
            leave.canRequest
              ? "Ask for time off and your manager will see it here."
              : "You need an employee record before you can request time off. Ask HR to add you."
          }
          action={requestButton}
        />
      ) : (
        <ul className="divide-y divide-line rounded-xl border border-line">
          {leave.requests.map((request) => (
            <li
              key={request.id}
              className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3"
            >
              <div className="min-w-0 flex-[1_1_14rem]">
                <p className="truncate font-medium text-ink">
                  {request.employeeName}
                </p>
                <p className="text-sm text-ink-2">
                  {typeLabels[request.type]} ·{" "}
                  {range(request.startDate, request.endDate)} · {request.days}{" "}
                  {request.days === 1 ? "day" : "days"}
                </p>
                {request.note ? (
                  <p className="text-sm text-ink-3">{request.note}</p>
                ) : null}
              </div>
              <span
                className={`rounded-full px-2 py-0.5 text-xs capitalize ${statusTone[request.status]}`}
              >
                {request.status}
              </span>
              {request.status === "pending" ? (
                <div className="flex gap-1">
                  {leave.canManage ? (
                    <>
                      <Button
                        size="sm"
                        onClick={() =>
                          void act(
                            () =>
                              trpc.hr.leaveDecide.mutate({
                                id: request.id,
                                decision: "approved",
                              }),
                            "Could not approve",
                          )
                        }
                      >
                        Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          void act(
                            () =>
                              trpc.hr.leaveDecide.mutate({
                                id: request.id,
                                decision: "rejected",
                              }),
                            "Could not reject",
                          )
                        }
                      >
                        Reject
                      </Button>
                    </>
                  ) : null}
                  {request.mine ? (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() =>
                        void act(
                          () => trpc.hr.leaveCancel.mutate({ id: request.id }),
                          "Could not cancel",
                        )
                      }
                    >
                      Cancel
                    </Button>
                  ) : null}
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      <RequestDialog
        open={requesting}
        onClose={() => setRequesting(false)}
        onSent={() => {
          setRequesting(false);
          toast.success("Request sent");
          void load();
        }}
      />
    </div>
  );
}
