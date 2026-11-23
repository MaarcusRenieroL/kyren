"use client";

import { Label } from "@zentro/ui/shadcn/label";
import { Checkbox } from "@zentro/ui/shadcn/checkbox";
import { Button } from "@zentro/ui/shadcn/button";
import { Input } from "@zentro/ui/shadcn/input";
import { NativeSelect } from "@zentro/ui/shadcn/native-select";

import { typeWords, type DraftField, type FieldType } from "./intake-types";

type Props = {
  index: number;
  field: DraftField;
  canRemove: boolean;
  onUpdate: (index: number, patch: Partial<DraftField>) => void;
  onRemove: (index: number) => void;
};

export function IntakeFieldRow({
  index,
  field,
  canRemove,
  onUpdate,
  onRemove,
}: Props) {
  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <Input
        aria-label={`Question ${index + 1}`}
        className="w-56"
        maxLength={80}
        value={field.label}
        onChange={(e) => onUpdate(index, { label: e.target.value })}
      />
      <NativeSelect
        aria-label={`Question ${index + 1} type`}
        size="sm"
        className="w-32"
        value={field.type}
        onChange={(e) => onUpdate(index, { type: e.target.value as FieldType })}
      >
        {Object.entries(typeWords).map(([value, label]) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </NativeSelect>
      {field.type === "choice" ? (
        <Input
          aria-label={`Question ${index + 1} choices`}
          className="w-48"
          placeholder="Comma-separated"
          value={field.options}
          onChange={(e) => onUpdate(index, { options: e.target.value })}
        />
      ) : null}
      <Label className="flex items-center gap-1 text-ink-2">
        <Checkbox
          checked={field.required}
          onCheckedChange={(checked) =>
            onUpdate(index, { required: checked === true })
          }
        />
        Required
      </Label>
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={!canRemove}
        onClick={() => onRemove(index)}
      >
        Remove
      </Button>
    </div>
  );
}
