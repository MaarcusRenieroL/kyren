export type SlaPolicy = {
  firstResponseMinutes: number | null;
  resolutionMinutes: number | null;
};

export type SlaClock = {
  /** none: no target applies. met: done in time. */
  state: "none" | "ok" | "due_soon" | "met" | "breached";
  dueAt: Date | null;
};

const minute = 60_000;

/** A target counts as "due soon" once a quarter of its window is left. */
const WARN_FRACTION = 0.25;

function clock(
  createdAt: Date,
  windowMinutes: number | null,
  doneAt: Date | null,
  now: Date,
): SlaClock {
  if (windowMinutes === null) return { state: "none", dueAt: null };

  const dueAt = new Date(createdAt.getTime() + windowMinutes * minute);

  if (doneAt) {
    return { state: doneAt <= dueAt ? "met" : "breached", dueAt };
  }

  const left = dueAt.getTime() - now.getTime();

  if (left < 0) return { state: "breached", dueAt };
  if (left <= windowMinutes * minute * WARN_FRACTION) {
    return { state: "due_soon", dueAt };
  }

  return { state: "ok", dueAt };
}

/**
 * Where a ticket stands against its priority's targets. Worked out when read,
 * so changing a target applies to open tickets at once. Time is wall-clock;
 * there are no business hours. Spam never has a target.
 */
export function slaState(
  ticket: {
    createdAt: Date;
    firstRespondedAt: Date | null;
    resolvedAt: Date | null;
  },
  status: string,
  policy: SlaPolicy | null,
  now: Date = new Date(),
) {
  if (!policy || status === "spam") {
    const none: SlaClock = { state: "none", dueAt: null };

    return { response: none, resolution: none };
  }

  // A ticket closed without a reply is judged by when it was closed.
  const answeredAt = ticket.firstRespondedAt ?? ticket.resolvedAt;

  return {
    response: clock(
      ticket.createdAt,
      policy.firstResponseMinutes,
      answeredAt,
      now,
    ),
    resolution: clock(
      ticket.createdAt,
      policy.resolutionMinutes,
      ticket.resolvedAt,
      now,
    ),
  };
}

/** The dates as text, for sending to the browser. */
export function serializeSla(sla: ReturnType<typeof slaState>) {
  const part = (value: SlaClock) => ({
    state: value.state,
    dueAt: value.dueAt?.toISOString() ?? null,
  });

  return { response: part(sla.response), resolution: part(sla.resolution) };
}
