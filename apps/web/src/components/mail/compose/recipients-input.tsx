"use client";

import { Button } from "@zentro/ui/shadcn/button";
import { Input } from "@zentro/ui/shadcn/input";
import { useMemo, useState } from "react";
import { XIcon } from "lucide-react";
import { Label } from "@zentro/ui/shadcn/label";
import type { Person } from "./types";

export function Recipients({
  label,
  value,
  people,
  onChange,
}: {
  label: string;
  value: string[];
  people: Person[];
  onChange: (next: string[]) => void;
}) {
  const [query, setQuery] = useState("");
  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return people
      .filter(
        (person) =>
          !value.includes(person.id) &&
          (person.name.toLowerCase().includes(q) ||
            person.email.toLowerCase().includes(q)),
      )
      .slice(0, 6);
  }, [people, query, value]);

  const add = (id: string) => {
    onChange([...value, id]);
    setQuery("");
  };

  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={`mail-${label}`}>{label}</Label>
      <div className="flex flex-wrap items-center gap-1.5 rounded-md border border-line px-2 py-1.5">
        {value.map((id) => {
          const person = people.find((item) => item.id === id);
          return (
            <span
              key={id}
              className="flex items-center gap-1 rounded-full bg-sunken px-2 py-0.5 text-xs"
            >
              {person?.name ?? "Someone"}
              <Button
                type="button"
                aria-label={`Remove ${person?.name ?? "recipient"}`}
                onClick={() => onChange(value.filter((item) => item !== id))}
              >
                <XIcon className="size-3" aria-hidden />
              </Button>
            </span>
          );
        })}
        <Input
          id={`mail-${label}`}
          value={query}
          autoComplete="off"
          placeholder={value.length ? "" : "Search people"}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && matches[0]) {
              event.preventDefault();
              add(matches[0].id);
            }
            if (event.key === "Backspace" && !query && value.length)
              onChange(value.slice(0, -1));
          }}
          className="min-w-32 flex-1 bg-transparent text-sm outline-none"
        />
      </div>
      {matches.length ? (
        <ul className="rounded-md border border-line bg-canvas p-1 shadow-sm">
          {matches.map((person) => (
            <li key={person.id}>
              <Button
                variant="custom"
                type="button"
                onClick={() => add(person.id)}
                className="flex w-full flex-col rounded px-2 py-1 text-left text-sm hover:bg-sunken"
              >
                <span>{person.name}</span>
                <span className="text-xs text-ink-3">{person.email}</span>
              </Button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
