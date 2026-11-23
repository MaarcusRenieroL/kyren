"use client";

import Link from "next/link";
import { CountUp } from "@zentro/ui/components/count-up";
import { FigureRow, StatCard } from "@zentro/ui/components/figure-row";
import { Kbd } from "@zentro/ui/components/kbd";
import { OrgAvatar } from "@zentro/ui/components/org-avatar";
import { SectionCard } from "@zentro/ui/components/section-card";
import { SectionNav } from "@zentro/ui/components/section-nav";
import { Spinner } from "@zentro/ui/components/spinner";
import { PriorityGlyph, StatusGlyph } from "@zentro/ui/components/status-glyph";
import { Thread, ThreadItem } from "@zentro/ui/components/thread";
import {
  Avatar,
  AvatarFallback,
  AvatarGroup,
  AvatarGroupCount,
} from "@zentro/ui/shadcn/avatar";
import { Badge } from "@zentro/ui/shadcn/badge";
import { Button } from "@zentro/ui/shadcn/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@zentro/ui/shadcn/card";
import { Progress } from "@zentro/ui/shadcn/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@zentro/ui/shadcn/table";
import { Tabs, TabsList, TabsTrigger } from "@zentro/ui/shadcn/tabs";
import { Block } from "./block";

const statuses = ["backlog", "todo", "in-progress", "review", "done"];

type DataSpecimensProps = {
  tab: string;
  setTab: (tab: string) => void;
};

export function DataSpecimens({ tab, setTab }: DataSpecimensProps) {
  return (
    <>
      <Block title="Tabs and section navigation">
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="one">Overview</TabsTrigger>
            <TabsTrigger value="two">Tasks</TabsTrigger>
            <TabsTrigger value="three">Docs</TabsTrigger>
          </TabsList>
        </Tabs>
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList variant="line">
            <TabsTrigger value="one">Overview</TabsTrigger>
            <TabsTrigger value="two">Tasks</TabsTrigger>
            <TabsTrigger value="three">Docs</TabsTrigger>
          </TabsList>
        </Tabs>
        <SectionNav
          LinkComponent={Link}
          activeHref="/dev/ui"
          items={[
            { href: "/dev/ui", label: "All" },
            { href: "/dev/x", label: "Overview" },
            { href: "/dev/y", label: "Completed" },
          ]}
        />
      </Block>

      <Block title="Badges">
        {[
          "default",
          "secondary",
          "signal",
          "success",
          "warning",
          "info",
          "destructive",
          "outline",
        ].map((variant) => (
          <Badge key={variant} variant={variant as "default"}>
            {variant}
          </Badge>
        ))}
      </Block>

      <Block title="Status and priority">
        {statuses.map((status) => (
          <span
            key={status}
            className="inline-flex items-center gap-1.5 text-sm"
          >
            <StatusGlyph status={status} />
            {status}
          </span>
        ))}
        {["low", "medium", "high"].map((priority) => (
          <span
            key={priority}
            className="inline-flex items-center gap-1.5 text-sm"
          >
            <PriorityGlyph priority={priority} />
            {priority}
          </span>
        ))}
      </Block>

      <Block title="Avatars">
        <Avatar>
          <AvatarFallback seed="u1">PN</AvatarFallback>
        </Avatar>
        <Avatar>
          <AvatarFallback seed="u2">DO</AvatarFallback>
        </Avatar>
        <AvatarGroup>
          {["a", "b", "c"].map((seed) => (
            <Avatar key={seed}>
              <AvatarFallback seed={seed}>
                {seed.toUpperCase()}
              </AvatarFallback>
            </Avatar>
          ))}
          <AvatarGroupCount>+3</AvatarGroupCount>
        </AvatarGroup>
        <OrgAvatar name="Acme Studio" />
        <OrgAvatar name="Empty Co" size="lg" />
      </Block>

      <Block title="Figures">
        <FigureRow
          figures={[
            { label: "Members", value: <CountUp id="g-m" value={8} /> },
            { label: "Projects", value: 6 },
            { label: "Open tasks", value: 37 },
          ]}
        />
        <StatCard
          label="Docs"
          value={10}
          hint="2 in the trash"
          className="w-44"
        />
        <Kbd>⌘K</Kbd>
        <Spinner />
        <div className="w-40">
          <Progress value={60} aria-label="Progress" />
        </div>
      </Block>

      <Block title="Table">
        <Card className="w-full max-w-xl">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Key</TableHead>
                <TableHead>Title</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow>
                <TableCell className="font-mono text-xs">WR-1</TableCell>
                <TableCell>Fix login</TableCell>
                <TableCell>
                  <StatusGlyph status="in-progress" />
                </TableCell>
              </TableRow>
              <TableRow data-state="selected">
                <TableCell className="font-mono text-xs">WR-2</TableCell>
                <TableCell>Update copy</TableCell>
                <TableCell>
                  <StatusGlyph status="done" />
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </Card>
      </Block>

      <Block title="Cards and sections">
        <Card className="w-72">
          <CardHeader>
            <CardTitle>Card</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-ink-2">
            Surface, hairline, no shadow.
          </CardContent>
        </Card>
        <SectionCard
          className="w-72"
          title="Section card"
          description="With a header"
          actions={
            <Button size="sm" variant="outline">
              Edit
            </Button>
          }
        >
          <p className="text-sm text-ink-2">Body</p>
        </SectionCard>
      </Block>

      <Block title="Thread">
        <Thread className="w-80">
          <ThreadItem
            node={
              <Avatar className="size-6">
                <AvatarFallback seed="p">PN</AvatarFallback>
              </Avatar>
            }
          >
            <p className="text-sm">
              Priya moved WR-1 from To do to In progress
            </p>
            <p className="text-xs text-ink-3">2 minutes ago</p>
          </ThreadItem>
          <ThreadItem>
            <p className="text-sm">Daniel commented on WR-1</p>
          </ThreadItem>
        </Thread>
      </Block>
    </>
  );
}
