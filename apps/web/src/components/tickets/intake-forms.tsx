"use client";

import { useCallback, useEffect, useState } from "react";

import { useTrpcClient } from "@zentro/api/react";
import { toastError, toastSuccess } from "@zentro/ui/index";
import { Button } from "@zentro/ui/shadcn/button";
import { Input } from "@zentro/ui/shadcn/input";
import { Textarea } from "@zentro/ui/shadcn/textarea";

type FieldType = "name" | "email" | "text" | "longtext" | "choice";

type Draft = {
  id?: string;
  name: string;
  description: string;
  enabled: boolean;
  fields: {
    label: string;
    type: FieldType;
    required: boolean;
    options: string;
  }[];
};

type Form = {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  token: string;
  fields: {
    label: string;
    type: FieldType;
    required: boolean;
    options?: string[];
  }[];
};

const typeWords: Record<FieldType, string> = {
  name: "Requester name",
  email: "Requester email",
  text: "Short text (the subject)",
  longtext: "Long text",
  choice: "Choice",
};

const blank = (): Draft => ({
  name: "",
  description: "",
  enabled: true,
  fields: [
    { label: "Your name", type: "name", required: true, options: "" },
    { label: "Your email", type: "email", required: true, options: "" },
    { label: "What is this about?", type: "text", required: true, options: "" },
    { label: "Details", type: "longtext", required: false, options: "" },
  ],
});

/** For people who manage intake forms: public forms whose answers open tickets. */
export function IntakeForms() {
  const trpc = useTrpcClient();
  const [forms, setForms] = useState<Form[]>([]);
  const [draft, setDraft] = useState<Draft>(blank());
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setForms((await trpc.intake.list.query()) as Form[]);
    } catch {
      // Optional; the queue works without it.
    }
  }, [trpc]);

  useEffect(() => {
    void load();
  }, [load]);

  async function run(work: () => Promise<unknown>, done: string) {
    setBusy(true);

    try {
      await work();
      toastSuccess(done);
      await load();
    } catch (error) {
      toastError(error, "Could not save the form.");
    } finally {
      setBusy(false);
    }
  }

  function setField(index: number, patch: Partial<Draft["fields"][number]>) {
    setDraft({
      ...draft,
      fields: draft.fields.map((field, i) =>
        i === index ? { ...field, ...patch } : field,
      ),
    });
  }

  const link = (token: string) =>
    typeof window === "undefined"
      ? ""
      : `${window.location.origin}/forms/${token}`;

  return (
    <details className="rounded-xl border border-line px-4 py-3">
      <summary className="cursor-pointer text-sm font-medium text-ink">
        Intake forms
      </summary>
      <p className="mt-2 text-sm text-ink-2">
        Share a form&apos;s link with customers. Each answer opens a ticket.
      </p>

      <ul className="mt-3 flex flex-col gap-2 text-sm">
        {forms.map((form) => (
          <li key={form.id} className="rounded-md border border-line p-2">
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="flex-1 truncate text-left font-medium text-ink hover:underline"
                onClick={() =>
                  setDraft({
                    id: form.id,
                    name: form.name,
                    description: form.description,
                    enabled: form.enabled,
                    fields: form.fields.map((f) => ({
                      label: f.label,
                      type: f.type,
                      required: f.required,
                      options: (f.options ?? []).join(", "),
                    })),
                  })
                }
              >
                {form.name}
              </button>
              <span className="text-xs text-ink-2">
                {form.enabled ? "On" : "Off"}
              </span>
              <Button
                size="sm"
                variant="outline"
                disabled={busy}
                onClick={() =>
                  void run(
                    () => trpc.intake.remove.mutate({ id: form.id }),
                    "Form deleted",
                  )
                }
              >
                Delete
              </Button>
            </div>
            <p className="mt-1 break-all font-mono text-xs text-ink-2">
              {link(form.token)}
            </p>
          </li>
        ))}
      </ul>

      <form
        className="mt-3 flex flex-col gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          void run(async () => {
            await trpc.intake.save.mutate({
              ...draft,
              fields: draft.fields.map((field) => ({
                label: field.label,
                type: field.type,
                required: field.required,
                ...(field.type === "choice"
                  ? {
                      options: field.options
                        .split(",")
                        .map((option) => option.trim())
                        .filter(Boolean),
                    }
                  : {}),
              })),
            });
            setDraft(blank());
          }, "Form saved");
        }}
      >
        <Input
          aria-label="Form name"
          placeholder="Form name"
          maxLength={120}
          value={draft.name}
          onChange={(e) => setDraft({ ...draft, name: e.target.value })}
        />
        <Textarea
          aria-label="Form introduction"
          placeholder="Introduction shown above the questions"
          rows={2}
          maxLength={1000}
          value={draft.description}
          onChange={(e) => setDraft({ ...draft, description: e.target.value })}
        />
        {draft.fields.map((field, index) => (
          <div
            key={index}
            className="flex flex-wrap items-center gap-2 text-sm"
          >
            <Input
              aria-label={`Question ${index + 1}`}
              className="w-56"
              maxLength={80}
              value={field.label}
              onChange={(e) => setField(index, { label: e.target.value })}
            />
            <select
              aria-label={`Question ${index + 1} type`}
              className="rounded-md border border-line bg-surface px-2 py-1"
              value={field.type}
              onChange={(e) =>
                setField(index, { type: e.target.value as FieldType })
              }
            >
              {Object.entries(typeWords).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
            {field.type === "choice" ? (
              <Input
                aria-label={`Question ${index + 1} choices`}
                className="w-48"
                placeholder="Comma-separated"
                value={field.options}
                onChange={(e) => setField(index, { options: e.target.value })}
              />
            ) : null}
            <label className="flex items-center gap-1 text-ink-2">
              <input
                type="checkbox"
                checked={field.required}
                onChange={(e) =>
                  setField(index, { required: e.target.checked })
                }
              />
              Required
            </label>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={draft.fields.length <= 1}
              onClick={() =>
                setDraft({
                  ...draft,
                  fields: draft.fields.filter((_, i) => i !== index),
                })
              }
            >
              Remove
            </Button>
          </div>
        ))}
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={draft.fields.length >= 20}
            onClick={() =>
              setDraft({
                ...draft,
                fields: [
                  ...draft.fields,
                  { label: "", type: "text", required: false, options: "" },
                ],
              })
            }
          >
            Add question
          </Button>
          <label className="flex items-center gap-1 text-ink-2">
            <input
              type="checkbox"
              checked={draft.enabled}
              onChange={(e) =>
                setDraft({ ...draft, enabled: e.target.checked })
              }
            />
            Accepting answers
          </label>
          <Button type="submit" size="sm" disabled={busy || !draft.name.trim()}>
            {draft.id ? "Save form" : "Create form"}
          </Button>
          {draft.id ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => setDraft(blank())}
            >
              New form
            </Button>
          ) : null}
        </div>
      </form>
    </details>
  );
}
