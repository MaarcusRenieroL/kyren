"use client";

import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from "@kyren/ui/shadcn/collapsible";
import { Label } from "@kyren/ui/shadcn/label";
import { Checkbox } from "@kyren/ui/shadcn/checkbox";
import { useCallback, useEffect, useState } from "react";

import { useTrpcClient } from "@kyren/api/react";
import { toastError, toastSuccess } from "@kyren/ui/index";
import { Button } from "@kyren/ui/shadcn/button";
import { Input } from "@kyren/ui/shadcn/input";
import { Textarea } from "@kyren/ui/shadcn/textarea";

import { IntakeFieldRow } from "./intake-field-row";
import { blank, type Draft, type Form } from "./intake-types";

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
    <Collapsible
      role="group"
      className="rounded-xl border border-line px-4 py-3"
    >
      <CollapsibleTrigger className="w-full text-left before:mr-2 before:inline-block before:content-['▸'] data-[state=open]:before:rotate-90 cursor-pointer text-sm font-medium text-ink">
        Intake forms
      </CollapsibleTrigger>
      <CollapsibleContent forceMount className="data-[state=closed]:hidden">
        <p className="mt-2 text-sm text-ink-2">
          Share a form&apos;s link with customers. Each answer opens a ticket.
        </p>

        <ul className="mt-3 flex flex-col gap-2 text-sm">
          {forms.map((form) => (
            <li key={form.id} className="rounded-md border border-line p-2">
              <div className="flex items-center gap-2">
                <Button
                  variant="custom"
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
                </Button>
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
            onChange={(e) =>
              setDraft({ ...draft, description: e.target.value })
            }
          />
          {draft.fields.map((field, index) => (
            <IntakeFieldRow
              key={index}
              index={index}
              field={field}
              canRemove={draft.fields.length > 1}
              onUpdate={setField}
              onRemove={(i) =>
                setDraft({
                  ...draft,
                  fields: draft.fields.filter((_, idx) => idx !== i),
                })
              }
            />
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
            <Label className="flex items-center gap-1 text-ink-2">
              <Checkbox
                checked={draft.enabled}
                onCheckedChange={(checked) =>
                  setDraft({ ...draft, enabled: checked === true })
                }
              />
              Accepting answers
            </Label>
            <Button
              type="submit"
              size="sm"
              disabled={busy || !draft.name.trim()}
            >
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
      </CollapsibleContent>
    </Collapsible>
  );
}
