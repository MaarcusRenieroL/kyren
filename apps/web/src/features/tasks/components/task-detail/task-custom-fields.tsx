"use client";

import { useCallback, useEffect, useState } from "react";

import { useTrpcClient } from "@zentro/api/react";
import type { AppRouter } from "@zentro/api/server";
import type { inferRouterOutputs } from "@trpc/server";
import { toastError } from "@zentro/ui/index";
import { Input } from "@zentro/ui/shadcn/input";
import { NativeSelect } from "@zentro/ui/shadcn/native-select";

type Field =
  inferRouterOutputs<AppRouter>["customField"]["valuesForTask"][number];

/** The extra fields an organization defines, editable in place on a task. */
export function TaskCustomFields({
  taskKey,
  canEdit,
}: {
  taskKey: string;
  canEdit: boolean;
}) {
  const trpc = useTrpcClient();
  const [fields, setFields] = useState<Field[]>([]);
  const [failed, setFailed] = useState(false);

  const load = useCallback(async () => {
    try {
      setFields(await trpc.customField.valuesForTask.query({ key: taskKey }));
      setFailed(false);
    } catch {
      // Said out loud, so fields never vanish without a word.
      setFailed(true);
    }
  }, [trpc, taskKey]);

  useEffect(() => {
    void load();
  }, [load]);

  async function save(field: Field, value: string | null) {
    if ((field.value ?? null) === value) return;

    try {
      await trpc.customField.setValue.mutate({
        key: taskKey,
        fieldId: field.fieldId,
        value,
      });
    } catch (error) {
      toastError(error, `Could not save ${field.name}.`);
    }

    await load();
  }

  if (failed && !fields.length) {
    return (
      <p role="status" className="tile px-[22px] py-[18px] text-sm text-ink-2">
        This task’s details did not load.{" "}
        <button type="button" className="underline" onClick={() => void load()}>
          Retry
        </button>
      </p>
    );
  }

  if (!fields.length) return null;

  return (
    <section aria-label="Custom fields" className="tile px-[22px] py-[18px]">
      <h2 className="mb-3 text-sm font-semibold text-ink">Details</h2>
      <dl className="grid gap-3 sm:grid-cols-2">
        {fields.map((field) => (
          <div key={field.fieldId} className="flex flex-col gap-1">
            <dt className="text-xs text-ink-3">
              <label htmlFor={`field-${field.fieldId}`}>{field.name}</label>
            </dt>
            <dd>
              {field.type === "select" ? (
                <NativeSelect
                  id={`field-${field.fieldId}`}
                  disabled={!canEdit}
                  value={field.value ?? ""}
                  onChange={(event) =>
                    void save(field, event.target.value || null)
                  }
                >
                  <option value="">Not set</option>
                  {field.options.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </NativeSelect>
              ) : (
                <Input
                  // Remount on save so the box shows what the server kept.
                  key={`${field.fieldId}:${field.value ?? ""}`}
                  id={`field-${field.fieldId}`}
                  type={
                    field.type === "number"
                      ? "number"
                      : field.type === "date"
                        ? "date"
                        : "text"
                  }
                  step={field.type === "number" ? "any" : undefined}
                  maxLength={1000}
                  disabled={!canEdit}
                  defaultValue={field.value ?? ""}
                  onBlur={(event) =>
                    void save(field, event.target.value.trim() || null)
                  }
                />
              )}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
