import { z } from "zod";

export const uuid = z.string().uuid();

/** A real calendar date as YYYY-MM-DD; "2026-02-31" is refused, not rolled over. */
export const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a date.")
  .refine((value) => {
    const parsed = new Date(`${value}T00:00:00Z`);

    return (
      !Number.isNaN(+parsed) && parsed.toISOString().slice(0, 10) === value
    );
  }, "That date does not exist.");
