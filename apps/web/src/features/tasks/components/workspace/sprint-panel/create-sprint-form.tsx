import { Label } from "@zentro/ui/shadcn/label";
import { Button } from "@zentro/ui/shadcn/button";
import { Input } from "@zentro/ui/shadcn/input";

export function CreateSprintForm({
  name,
  setName,
  startsOn,
  setStartsOn,
  endsOn,
  setEndsOn,
  busy,
  onSubmit,
}: {
  name: string;
  setName: (n: string) => void;
  startsOn: string;
  setStartsOn: (s: string) => void;
  endsOn: string;
  setEndsOn: (e: string) => void;
  busy: boolean;
  onSubmit: () => void;
}) {
  return (
    <form
      className="flex flex-wrap items-end gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
    >
      <Label className="flex flex-col items-stretch gap-1 text-xs">
        Sprint name
        <Input
          value={name}
          onChange={(event) => setName(event.target.value)}
          required
          maxLength={80}
          className="h-8 w-44"
        />
      </Label>
      <Label className="flex flex-col items-stretch gap-1 text-xs">
        Starts
        <Input
          type="date"
          value={startsOn}
          onChange={(event) => setStartsOn(event.target.value)}
          required
          className="h-8"
        />
      </Label>
      <Label className="flex flex-col items-stretch gap-1 text-xs">
        Ends
        <Input
          type="date"
          value={endsOn}
          onChange={(event) => setEndsOn(event.target.value)}
          required
          className="h-8"
        />
      </Label>
      <Button size="sm" type="submit" disabled={busy || !name.trim()}>
        Create sprint
      </Button>
    </form>
  );
}
