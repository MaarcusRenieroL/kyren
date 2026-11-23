import { Label } from "@zentro/ui/shadcn/label";
import { cn } from "@zentro/ui/lib/utils";
import { NativeSelect } from "@zentro/ui/shadcn/native-select";

export const ranges = [
  ["any", "Any time", 0],
  ["7", "Last 7 days", 7],
  ["30", "Last 30 days", 30],
  ["90", "Last 90 days", 90],
] as const;

export function Filter({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<[string, string]>;
}) {
  const active = value !== options[0]![0];

  return (
    <Label
      className={cn(
        "flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-[13px]",
        active ? "border-ink" : "border-hairline",
      )}
    >
      <span className="text-ink-3">{label}</span>
      <NativeSelect
        size="sm"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        aria-label={label}
        className="max-w-36 border-none bg-transparent font-medium"
      >
        {options.map(([optionValue, optionLabel]) => (
          <option key={optionValue} value={optionValue}>
            {optionLabel}
          </option>
        ))}
      </NativeSelect>
    </Label>
  );
}
