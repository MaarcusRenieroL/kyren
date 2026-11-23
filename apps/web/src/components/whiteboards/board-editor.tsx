"use client";

import Link from "next/link";
import { Button } from "@kyren/ui/shadcn/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@kyren/ui/shadcn/dialog";
import { TaskPicker } from "./canvas/task-picker";
import { route } from "./canvas/geometry";
import { touch } from "./canvas/model";
import { shortcuts } from "./editor/editor-types";
import { EditorHeader } from "./editor/editor-header";
import { EditorToolbar } from "./editor/editor-toolbar";
import { EditorStylePanel } from "./editor/editor-style-panel";
import { EditorFooterControls } from "./editor/editor-footer-controls";
import { EditorCanvas } from "./editor/editor-canvas";
import { useBoardEditor } from "./editor/use-board-editor";

export function BoardEditor({ id }: { id: string }) {
  const b = useBoardEditor({ id });

  if (b.state === "loading") {
    return (
      <p role="status" className="p-6 text-sm text-ink-2">
        Loading board…
      </p>
    );
  }

  if (b.state === "missing") {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
        <p className="text-ink">This board could not be opened.</p>
        <Button asChild variant="outline">
          <Link href="/whiteboards">Back to boards</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="relative -mx-4 -mt-5 -mb-12 flex h-[calc(100svh-3.5rem)] min-h-[480px] flex-col overflow-hidden border-t border-hairline md:-mx-(--gutter) md:-mt-7 md:-mb-16">
      <EditorHeader
        title={b.title}
        canEdit={b.canEdit}
        save={b.save}
        others={b.others}
        frames={b.frames}
        onPresent={b.present}
      />

      <div className="relative min-h-0 flex-1 overflow-hidden bg-sunken/40">
        {b.canEdit && b.presenting === null ? (
          <EditorToolbar
            tool={b.tool}
            setTool={b.setTool}
            grid={b.grid}
            setGrid={b.setGrid}
            menu={b.menu}
            setMenu={b.setMenu}
            onAddImage={b.addImage}
            onAddTemplate={b.addTemplate}
            onExport={b.exportBoard}
            onOpenTaskPicker={() => b.setPicking(true)}
            hasSelection={b.selection.length > 0}
          />
        ) : null}

        {b.showStyle && b.presenting === null ? (
          <EditorStylePanel
            style={b.style}
            single={b.single}
            linearSingle={b.linearSingle}
            selection={b.selection}
            allLocked={b.allLocked}
            restyle={b.restyle}
            onElbowToggle={(elbow) => {
              if (b.linearSingle) {
                const next = touch(b.linearSingle, { elbow });
                b.replace([
                  route(next, new Map(b.latest.current.map((o) => [o.id, o]))),
                ]);
              }
            }}
            restack={b.restack}
            copyAndPaste={() => {
              b.copy();
              b.paste(20);
            }}
            lock={(locked) => b.lock(locked)}
            removeSelected={b.removeSelected}
            align={b.align}
            group={b.group}
          />
        ) : null}

        <EditorCanvas
          id={id}
          svgRef={b.svgRef}
          layerRef={b.layerRef}
          view={b.view}
          grid={b.grid}
          cursor={b.cursor}
          shown={b.shown}
          statuses={b.statuses}
          editing={b.editing}
          setEditing={b.setEditing}
          editingEl={b.editingEl}
          editingBox={b.editingBox}
          finishEditing={b.finishEditing}
          presenting={b.presenting}
          selection={b.selection}
          selectionBox={b.selectionBox}
          canEdit={b.canEdit}
          linearSingle={b.linearSingle}
          openComment={b.openComment}
          allLocked={b.allLocked}
          drag={b.drag}
          startResize={b.startResize}
          startEndDrag={b.startEndDrag}
          others={b.others}
          onDown={b.onDown}
          onMove={b.onMove}
          onUp={b.onUp}
          onWheel={b.onWheel}
          onDoubleClick={b.onDoubleClick}
          pointerRef={b.pointer}
          setMenu={b.setMenu}
        />

        <EditorFooterControls
          view={b.view}
          setView={b.setView}
          zoomBy={b.zoomBy}
          fit={b.fit}
          setHelpOpen={b.setHelpOpen}
          showMap={b.showMap}
          setShowMap={b.setShowMap}
          canEdit={b.canEdit}
          undo={b.undo}
          redo={b.redo}
          presenting={b.presenting}
          frames={b.frames}
          present={b.present}
          shown={b.shown}
          canvasSize={b.canvasSize}
        />
      </div>

      <TaskPicker
        open={b.picking}
        onOpenChange={b.setPicking}
        onPick={b.addTask}
      />
      <Dialog open={b.helpOpen} onOpenChange={b.setHelpOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Keyboard shortcuts</DialogTitle>
          </DialogHeader>
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
            {shortcuts.map(([keys, what]) => (
              <div key={keys} className="contents">
                <dt className="font-mono text-xs text-ink">{keys}</dt>
                <dd className="text-ink-2">{what}</dd>
              </div>
            ))}
          </dl>
        </DialogContent>
      </Dialog>
    </div>
  );
}
