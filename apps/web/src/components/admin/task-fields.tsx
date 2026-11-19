"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";

import { useTrpcClient } from "@zentro/api/react";
import type { AppRouter } from "@zentro/api/server";
import type { inferRouterOutputs } from "@trpc/server";
import { toastError, toastSuccess } from "@zentro/ui/index";
import { Button } from "@zentro/ui/shadcn/button";
import { Input } from "@zentro/ui/shadcn/input";
import { NativeSelect } from "@zentro/ui/shadcn/native-select";

import { Shell } from "./admin-console";

type Field = inferRouterOutputs<AppRouter>["customField"]["list"][number];

const types = ["text", "number", "date", "select"] as const;

export function TaskFields() {
  const trpc = useTrpcClient();
  const [fields, setFields] = useState<Field[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [name, setName] = useState("");
  const [type, setType] = useState<(typeof types)[number]>("text");
  const [choices, setChoices] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setFields(await trpc.customField.list.query());
    } catch {
      setFailed(true);
    }
  }, [trpc]);

  useEffect(() => {
    void load();
  }, [load]);

  async function create(event: FormEvent) {
    event.preventDefault();
    setBusy(true);

    try {
      await trpc.customField.create.mutate({
        name,
        type,
        options: choices
          .split(",")
          .map((choice) => choice.trim())
          .filter(Boolean),
      });
      setName("");
      setChoices("");
      await load();
    } catch (error) {
      toastError(error, "Could not add the field.");
    } finally {
      setBusy(false);
    }
  }

  async function remove(field: Field) {
    if (
      !window.confirm(`Remove ${field.name}? Its value on every task is lost.`)
    ) {
      return;
    }

    try {
      await trpc.customField.remove.mutate({ id: field.id });
      toastSuccess("Field removed");
      await load();
    } catch (error) {
      toastError(error, "Could not remove the field.");
    }
  }

  return (
    <Shell>
      <section
        aria-labelledby="fields"
        className="flex max-w-2xl flex-col gap-4"
      >
        <div>
          <h2 id="fields" className="text-sm font-semibold text-ink">
            Task fields
          </h2>
          <p className="text-sm text-ink-2">
            Add fields every task carries, such as a client, a budget or a
            review date.
          </p>
        </div>

        <form onSubmit={create} className="flex flex-wrap items-end gap-2">
          <label className="flex min-w-40 flex-1 flex-col gap-1.5 text-sm">
            <span className="text-ink-2">Name</span>
            <Input
              value={name}
              maxLength={60}
              onChange={(event) => setName(event.target.value)}
            />
          </label>
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="text-ink-2">Type</span>
            <NativeSelect
              value={type}
              onChange={(event) =>
                setType(event.target.value as (typeof types)[number])
              }
              className="h-9 w-32 capitalize"
            >
              {types.map((option) => (
                <option key={option} value={option} className="capitalize">
                  {option}
                </option>
              ))}
            </NativeSelect>
          </label>
          {type === "select" ? (
            <label className="flex min-w-40 flex-1 flex-col gap-1.5 text-sm">
              <span className="text-ink-2">Choices, separated by commas</span>
              <Input
                value={choices}
                onChange={(event) => setChoices(event.target.value)}
              />
            </label>
          ) : null}
          <Button type="submit" disabled={busy || !name.trim()}>
            Add field
          </Button>
        </form>

        {failed ? (
          <p role="alert" className="text-sm text-danger-text">
            Could not load the fields.
          </p>
        ) : fields === null ? null : fields.length === 0 ? (
          <p className="text-sm text-ink-3">No task fields yet.</p>
        ) : (
          <ul className="divide-y divide-line rounded-xl border border-line">
            {fields.map((field) => (
              <li
                key={field.id}
                className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm"
              >
                <span className="min-w-0">
                  <span className="block truncate text-ink">{field.name}</span>
                  <span className="text-xs text-ink-3 capitalize">
                    {field.type}
                    {field.options.length
                      ? ` · ${field.options.join(", ")}`
                      : ""}
                  </span>
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  aria-label={`Remove ${field.name}`}
                  onClick={() => void remove(field)}
                >
                  Remove
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </Shell>
  );
}
