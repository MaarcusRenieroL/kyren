"use client";

import { Label } from "@kyren/ui/shadcn/label";
import { Textarea } from "@kyren/ui/shadcn/textarea";
import { Input } from "@kyren/ui/shadcn/input";
import { Button } from "@kyren/ui/shadcn/button";
import { useEffect, useState, type FormEvent } from "react";
import { NativeSelect } from "@kyren/ui/shadcn/native-select";
import { apiPath } from "~/src/lib/paths";

type Field = {
  id: string;
  label: string;
  type: "name" | "email" | "text" | "longtext" | "choice";
  required: boolean;
  options?: string[];
};

type Form = { name: string; description: string; fields: Field[] };

const control =
  "w-full rounded-md border border-line bg-surface px-3 py-2 text-sm text-ink";

/** What a visitor sees at a form's public link: the questions and a send button. */
export function PublicIntakeForm({ token }: { token: string }) {
  const [form, setForm] = useState<Form | null>(null);
  const [missing, setMissing] = useState(false);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [trap, setTrap] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [done, setDone] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void fetch(apiPath(`/api/forms/${token}`), { cache: "no-store" }).then(
      async (response) => {
        if (response.ok) setForm((await response.json()) as Form);
        else setMissing(true);
      },
    );
  }, [token]);

  async function send(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setErrors({});

    try {
      const response = await fetch(apiPath(`/api/forms/${token}`), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ answers, website: trap }),
      });
      const result = (await response.json()) as {
        ok?: boolean;
        ref?: string;
        errors?: Record<string, string>;
      };

      if (result.ok) setDone(result.ref ?? "");
      else setErrors(result.errors ?? { form: "Could not send. Try again." });
    } catch {
      setErrors({ form: "Could not send. Try again." });
    } finally {
      setBusy(false);
    }
  }

  if (missing) {
    return (
      <main className="mx-auto max-w-xl px-4 py-12">
        <p className="text-sm text-ink-2">We can&apos;t find that form.</p>
      </main>
    );
  }

  if (!form) return <main className="mx-auto max-w-xl px-4 py-12" />;

  if (done !== null) {
    return (
      <main className="mx-auto max-w-xl px-4 py-12">
        <h1 className="text-xl font-semibold text-ink">Thank you</h1>
        <p className="mt-2 text-sm text-ink-2">
          We received your request{done && done !== "SUP-0" ? ` (${done})` : ""}{" "}
          and will be in touch.
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-xl px-4 py-12">
      <h1 className="text-2xl font-semibold text-ink">{form.name}</h1>
      {form.description ? (
        <p className="mt-2 whitespace-pre-wrap text-sm text-ink-2">
          {form.description}
        </p>
      ) : null}
      <form className="mt-6 flex flex-col gap-4" onSubmit={send} noValidate>
        {form.fields.map((field) => (
          <Label key={field.id} className="flex flex-col gap-1.5 text-sm">
            <span className="text-ink">
              {field.label}
              {field.required ? " *" : ""}
            </span>
            {field.type === "longtext" ? (
              <Textarea
                className={control}
                rows={5}
                maxLength={5000}
                value={answers[field.id] ?? ""}
                onChange={(e) =>
                  setAnswers({ ...answers, [field.id]: e.target.value })
                }
              />
            ) : field.type === "choice" ? (
              <NativeSelect
                value={answers[field.id] ?? ""}
                onChange={(e) =>
                  setAnswers({ ...answers, [field.id]: e.target.value })
                }
              >
                <option value="">Choose…</option>
                {(field.options ?? []).map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </NativeSelect>
            ) : (
              <Input
                className={control}
                type={field.type === "email" ? "email" : "text"}
                maxLength={300}
                value={answers[field.id] ?? ""}
                onChange={(e) =>
                  setAnswers({ ...answers, [field.id]: e.target.value })
                }
              />
            )}
            {errors[field.id] ? (
              <span role="alert" className="text-xs text-danger-text">
                {errors[field.id]}
              </span>
            ) : null}
          </Label>
        ))}
        {/* A trap for bots: hidden from people and from assistive tools. */}
        <div aria-hidden="true" className="absolute -left-[9999px]">
          <Input
            tabIndex={-1}
            autoComplete="off"
            name="website"
            value={trap}
            onChange={(e) => setTrap(e.target.value)}
          />
        </div>
        {errors.form ? (
          <p role="alert" className="text-sm text-danger-text">
            {errors.form}
          </p>
        ) : null}
        <Button
          variant="custom"
          type="submit"
          disabled={busy}
          className="self-start rounded-md bg-ink px-4 py-2 text-sm font-medium text-surface disabled:opacity-60"
        >
          Send
        </Button>
      </form>
    </main>
  );
}
