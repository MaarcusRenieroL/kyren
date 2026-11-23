"use client";

import Link from "next/link";
import { PlusIcon, SearchIcon, Trash2Icon } from "lucide-react";
import { Breadcrumbs } from "@zentro/ui/components/breadcrumbs";
import { Chip } from "@zentro/ui/components/chip";
import { Combobox } from "@zentro/ui/components/combobox";
import { DayRing } from "@zentro/ui/components/day-ring";
import { DotMatrix } from "@zentro/ui/components/dot-matrix";
import { PageHeader } from "@zentro/ui/components/page-header";
import { SegmentedControl } from "@zentro/ui/components/segmented-control";
import { Stat } from "@zentro/ui/components/stat";
import { StatusGlyph } from "@zentro/ui/components/status-glyph";
import { TaskKey } from "@zentro/ui/components/task-key";
import { TeamPulse } from "@zentro/ui/components/team-pulse";
import { Tile } from "@zentro/ui/components/tile";
import { Button } from "@zentro/ui/shadcn/button";
import { Checkbox } from "@zentro/ui/shadcn/checkbox";
import { Input } from "@zentro/ui/shadcn/input";
import { Progress } from "@zentro/ui/shadcn/progress";
import { RadioGroup, RadioGroupItem } from "@zentro/ui/shadcn/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@zentro/ui/shadcn/select";
import { Switch } from "@zentro/ui/shadcn/switch";
import { Textarea } from "@zentro/ui/shadcn/textarea";
import { Block } from "./block";

const statuses = ["backlog", "todo", "in-progress", "review", "done"];
const variants = [
  "default",
  "secondary",
  "outline",
  "ghost",
  "destructive",
  "link",
] as const;

type ControlsSpecimensProps = {
  tab: string;
  setTab: (tab: string) => void;
};

export function ControlsSpecimens({ tab, setTab }: ControlsSpecimensProps) {
  return (
    <>
      <PageHeader
        breadcrumbs={
          <Breadcrumbs
            LinkComponent={Link}
            items={[
              { label: "Projects", href: "/projects" },
              { label: "Website Redesign", href: "/projects/x" },
              { label: "WR-12", mono: true },
            ]}
          />
        }
        title="Page header"
        description="A serif title, one line of context and the actions on the right."
        actions={
          <>
            <Button variant="outline">Secondary</Button>
            <Button>
              <PlusIcon /> Create
            </Button>
          </>
        }
      />

      <Block title="Start button (the only 52px control)">
        <Button size="start">Start</Button>
        <Button size="start" variant="secondary">
          Mark done
        </Button>
      </Block>

      <Block title="Momentum: state, keys, rings">
        {statuses.map((status) => (
          <span key={status} className="inline-flex items-center gap-2">
            <StatusGlyph status={status} />
            <TaskKey>ZEN-9</TaskKey>
          </span>
        ))}
        <StatusGlyph status="done" celebrate />
        <DayRing done={3} planned={5} size={96} />
        <DayRing done={5} planned={5} size={96} />
        <DotMatrix
          label="Team activity this week"
          values={[2, 5, 8, 4, 9, 1, 0]}
          labels={["M", "T", "W", "T", "F", "S", "S"]}
        />
        <Stat label="Open tasks" value="24" trend="+3 this week" />
      </Block>

      <section className="grid gap-4 sm:grid-cols-2">
        <Tile
          tint="projects"
          icon={<PlusIcon />}
          title="Projects"
          description="Sky tint"
        >
          <Progress value={62} />
        </Tile>
        <Tile
          tint="tasks"
          icon={<PlusIcon />}
          title="Tasks"
          description="Lavender tint"
        >
          <TeamPulse
            items={[
              {
                id: "1",
                actor: "Mei Lin",
                verb: "started",
                taskKey: "ZEN-9",
                title: "Dark mode",
                when: "2m",
              },
              {
                id: "2",
                actor: "Tomás",
                verb: "finished",
                taskKey: "ZEN-4",
                title: "Import CSV",
                when: "9m",
              },
            ]}
          />
        </Tile>
        <Tile
          tint="docs"
          icon={<PlusIcon />}
          title="Docs"
          description="Peach tint"
        />
        <Tile
          tint="teams"
          icon={<PlusIcon />}
          title="Teams"
          description="Mint tint"
        />
        <Tile
          tint="audit"
          icon={<PlusIcon />}
          title="Audit"
          description="Rose tint"
        />
      </section>

      <Block title="Segmented control, chips, combobox">
        <SegmentedControl
          label="Density"
          value={tab === "one" ? "comfortable" : "compact"}
          onValueChange={(value) =>
            setTab(value === "comfortable" ? "one" : "two")
          }
          options={[
            { value: "comfortable", label: "Comfortable" },
            { value: "compact", label: "Compact" },
          ]}
        />
        <Chip>design</Chip>
        <Chip tone="accent" onRemove={() => {}}>
          ZEN-9
        </Chip>
        <div className="w-56">
          <Combobox
            value={tab}
            onValueChange={setTab}
            placeholder="Project"
            options={[
              { value: "one", label: "Website Redesign", hint: "WR" },
              { value: "two", label: "Mobile App", hint: "MA" },
            ]}
          />
        </div>
      </Block>

      <Block title="Buttons">
        {variants.map((variant) => (
          <Button key={variant} variant={variant}>
            {variant}
          </Button>
        ))}
        <Button size="xs">xs</Button>
        <Button size="sm">sm</Button>
        <Button size="lg">lg</Button>
        <Button size="icon" aria-label="Search" variant="outline">
          <SearchIcon />
        </Button>
        <Button loading>Saving</Button>
        <Button disabled>Disabled</Button>
        <Button variant="destructive">
          <Trash2Icon /> Delete
        </Button>
      </Block>

      <Block title="Fields">
        <Input className="w-56" placeholder="Input" />
        <Input className="w-56" defaultValue="Invalid" aria-invalid />
        <Input className="w-56" disabled placeholder="Disabled" />
        <Select defaultValue="a">
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="a">Option A</SelectItem>
            <SelectItem value="b">Option B</SelectItem>
          </SelectContent>
        </Select>
        <Textarea className="w-64" placeholder="Textarea" />
        <Checkbox defaultChecked aria-label="Checked" />
        <Checkbox aria-label="Unchecked" />
        <Switch defaultChecked aria-label="On" />
        <Switch aria-label="Off" />
        <RadioGroup defaultValue="x" className="flex gap-3">
          <RadioGroupItem value="x" aria-label="X" />
          <RadioGroupItem value="y" aria-label="Y" />
        </RadioGroup>
      </Block>
    </>
  );
}
