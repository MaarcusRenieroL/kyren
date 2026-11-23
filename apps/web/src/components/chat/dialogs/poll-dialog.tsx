"use client";

import { Label } from "@zentro/ui/shadcn/label";
import { FieldSet, FieldLegend } from "@zentro/ui/shadcn/field";
import { Checkbox } from "@zentro/ui/shadcn/checkbox";
import { useState } from "react";
import { PlusIcon, Trash2Icon } from "lucide-react";
import { useTrpcClient } from "@zentro/api/react";
import { toastError } from "@zentro/ui/index";
import { Button } from "@zentro/ui/shadcn/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@zentro/ui/shadcn/dialog";
import { Input } from "@zentro/ui/shadcn/input";

/** A question with two to eight options. */
export function PollDialog({
  channelId,
  parentId,
  initialQuestion = "",
  initialOptions,
  onClose,
  onCreated,
}: {
  channelId: string;
  parentId?: string;
  initialQuestion?: string;
  initialOptions?: string[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const trpc = useTrpcClient();
  const [question, setQuestion] = useState(initialQuestion);
  const [options, setOptions] = useState(initialOptions ?? ["", ""]);
  const [multiple, setMultiple] = useState(false);
  const [saving, setSaving] = useState(false);
  const valid =
    question.trim() && options.filter((option) => option.trim()).length >= 2;

  const submit = async () => {
    if (!valid) return;

    setSaving(true);

    try {
      await trpc.chat.createPoll.mutate({
        channelId,
        parentId,
        question: question.trim(),
        options: options.map((option) => option.trim()).filter(Boolean),
        multiple,
      });
      onCreated();
      onClose();
    } catch (error) {
      toastError(error, "Could not create the poll");
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="gap-4 sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle className="text-xl">Create a poll</DialogTitle>
          <DialogDescription>
            Ask a question and let people vote. Results update live.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="poll-question" className="text-sm font-medium">
            Question
          </Label>
          <Input
            id="poll-question"
            autoFocus
            value={question}
            maxLength={200}
            onChange={(event) => setQuestion(event.target.value)}
            placeholder="Where should we have lunch?"
          />
        </div>
        <FieldSet className="flex flex-col gap-2">
          <FieldLegend className="mb-1 text-sm font-medium">
            Options
          </FieldLegend>
          {options.map((option, index) => (
            <div key={index} className="flex items-center gap-2">
              <Input
                value={option}
                maxLength={100}
                aria-label={`Option ${index + 1}`}
                onChange={(event) =>
                  setOptions((current) =>
                    current.map((entry, i) =>
                      i === index ? event.target.value : entry,
                    ),
                  )
                }
                placeholder={`Option ${index + 1}`}
              />
              {options.length > 2 ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Remove option ${index + 1}`}
                  onClick={() =>
                    setOptions((current) =>
                      current.filter((_, i) => i !== index),
                    )
                  }
                >
                  <Trash2Icon className="size-4" />
                </Button>
              ) : null}
            </div>
          ))}
          {options.length < 8 ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="self-start"
              onClick={() => setOptions((current) => [...current, ""])}
            >
              <PlusIcon className="size-4" />
              Add option
            </Button>
          ) : null}
        </FieldSet>
        <Label className="flex items-center gap-2.5 text-sm">
          <Checkbox
            checked={multiple}
            onCheckedChange={(checked) => setMultiple(checked === true)}
            className="size-4 accent-[var(--signal)]"
          />
          Allow picking more than one option
        </Label>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={!valid || saving} onClick={() => void submit()}>
            {saving ? "Creating…" : "Create poll"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
