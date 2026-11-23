"use client";

import { EmptyState } from "@kyren/ui/components/empty-state";
import { ErrorState } from "@kyren/ui/components/error-state";
import { InlineAlert } from "@kyren/ui/components/inline-alert";
import { Toolbar } from "@kyren/ui/components/toolbar";
import { Button } from "@kyren/ui/shadcn/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@kyren/ui/shadcn/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@kyren/ui/shadcn/dropdown-menu";
import { Input } from "@kyren/ui/shadcn/input";
import { ScrollArea } from "@kyren/ui/shadcn/scroll-area";
import { Separator } from "@kyren/ui/shadcn/separator";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@kyren/ui/shadcn/sheet";
import { Skeleton } from "@kyren/ui/shadcn/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@kyren/ui/shadcn/tooltip";
import { toastSuccess, toastError } from "@kyren/ui/index";
import { Block } from "./block";

export function OverlaySpecimens() {
  return (
    <>
      <Block title="States">
        <EmptyState
          className="w-80"
          title="No projects yet"
          description="Create a project to start organizing work."
          action={<Button>New project</Button>}
        />
        <ErrorState
          className="w-80"
          onRetry={() => undefined}
          requestId="req_8f2c"
        />
        <div className="w-72 space-y-2">
          <InlineAlert tone="info" title="Info">
            A neutral note.
          </InlineAlert>
          <InlineAlert tone="success">Saved.</InlineAlert>
          <InlineAlert tone="warning" title="Careful">
            This cannot be undone.
          </InlineAlert>
          <InlineAlert tone="danger" title="Failed">
            Try again.
          </InlineAlert>
        </div>
        <div className="w-60 space-y-2">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="h-16 w-full" />
        </div>
      </Block>

      <Block title="Overlays">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="outline">Tooltip</Button>
          </TooltipTrigger>
          <TooltipContent>Short and plain</TooltipContent>
        </Tooltip>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline">Menu</Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem>Edit</DropdownMenuItem>
            <DropdownMenuItem>Duplicate</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem>Delete</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <Dialog>
          <DialogTrigger asChild>
            <Button variant="outline">Dialog</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Dialog</DialogTitle>
              <DialogDescription>
                Scrolls inside the viewport.
              </DialogDescription>
            </DialogHeader>
            <Input placeholder="Name" />
            <DialogFooter>
              <Button>Save</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="outline">Sheet</Button>
          </SheetTrigger>
          <SheetContent>
            <SheetHeader>
              <SheetTitle>Sheet</SheetTitle>
              <SheetDescription>From the right.</SheetDescription>
            </SheetHeader>
          </SheetContent>
        </Sheet>
        <Button
          variant="outline"
          onClick={() => toastSuccess("Saved", "Everything is up to date.")}
        >
          Success toast
        </Button>
        <Button
          variant="outline"
          onClick={() => toastError("Failed", "Something went wrong.")}
        >
          Error toast
        </Button>
        <ScrollArea className="h-16 w-40 rounded-md border border-hairline p-2 text-sm">
          <p>
            Scrollable content. Scrollable content. Scrollable content.
            Scrollable content.
          </p>
        </ScrollArea>
        <Separator className="w-24" />
        <Toolbar>
          <Input className="w-40" placeholder="Filter" />
          <Button variant="outline">Sort</Button>
        </Toolbar>
      </Block>
    </>
  );
}
