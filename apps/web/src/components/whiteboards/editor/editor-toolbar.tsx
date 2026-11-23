import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@kyren/ui/shadcn/dropdown-menu";
import { Input } from "@kyren/ui/shadcn/input";
import { useRef, type RefObject } from "react";
import {
  CheckSquareIcon,
  DownloadIcon,
  Grid3x3Icon,
  ImageIcon,
  LayoutTemplateIcon,
} from "lucide-react";
import { Button } from "@kyren/ui/shadcn/button";
import { templates } from "../canvas/templates";
import { tools, type Tool } from "./editor-types";

export function EditorToolbar({
  tool,
  setTool,
  grid,
  setGrid,
  menu,
  setMenu,
  onAddImage,
  onAddTemplate,
  onExport,
  onOpenTaskPicker,
  hasSelection,
}: {
  tool: Tool;
  setTool: (tool: Tool) => void;
  grid: boolean;
  setGrid: (grid: boolean) => void;
  menu: "templates" | "export" | null;
  setMenu: (menu: "templates" | "export" | null) => void;
  onAddImage: (file: File) => void;
  onAddTemplate: (id: string) => void;
  onExport: (format: "png" | "svg" | "copy") => void;
  onOpenTaskPicker: () => void;
  hasSelection: boolean;
}) {
  const fileRef = useRef<HTMLInputElement>(null);

  return (
    <>
      <div
        role="toolbar"
        aria-label="Drawing tools"
        className="tab-scroll absolute top-3 left-1/2 z-10 flex max-w-[calc(100%-1rem)] -translate-x-1/2 items-center gap-1 rounded-xl border border-line bg-canvas p-1 shadow-sm [&>*]:shrink-0"
      >
        {tools.map(({ id: toolId, label, key, icon: Icon }) => (
          <Button
            key={toolId}
            size="icon-sm"
            variant={tool === toolId ? "secondary" : "ghost"}
            aria-label={label}
            aria-pressed={tool === toolId}
            title={`${label} — ${key.toUpperCase()}`}
            onClick={() => setTool(toolId)}
          >
            <Icon aria-hidden />
          </Button>
        ))}
        <span className="mx-1 h-5 w-px bg-line" aria-hidden />
        <Button
          size="icon-sm"
          variant="ghost"
          aria-label="Add image"
          title="Add image"
          onClick={() => fileRef.current?.click()}
        >
          <ImageIcon aria-hidden />
        </Button>
        <Button
          size="icon-sm"
          variant="ghost"
          aria-label="Add task card"
          title="Add task card"
          onClick={onOpenTaskPicker}
        >
          <CheckSquareIcon aria-hidden />
        </Button>
        <Button
          size="icon-sm"
          variant={menu === "templates" ? "secondary" : "ghost"}
          aria-label="Templates"
          aria-expanded={menu === "templates"}
          title="Templates"
          onClick={() => setMenu(menu === "templates" ? null : "templates")}
        >
          <LayoutTemplateIcon aria-hidden />
        </Button>
        <DropdownMenu
          open={menu === "export"}
          onOpenChange={(open) => setMenu(open ? "export" : null)}
        >
          <DropdownMenuTrigger asChild>
            <Button
              size="icon-sm"
              variant={menu === "export" ? "secondary" : "ghost"}
              aria-label="Export"
            >
              <DownloadIcon aria-hidden />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" sideOffset={8}>
            {(
              [
                ["png", "Download PNG"],
                ["svg", "Download SVG"],
                ["copy", "Copy as image"],
              ] as const
            ).map(([format, label]) => (
              <DropdownMenuItem key={format} onSelect={() => onExport(format)}>
                {label}
                {hasSelection ? " (selection)" : ""}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
        <Button
          size="icon-sm"
          variant={grid ? "secondary" : "ghost"}
          aria-label="Snap to grid"
          aria-pressed={grid}
          title="Snap to grid"
          onClick={() => setGrid(!grid)}
        >
          <Grid3x3Icon aria-hidden />
        </Button>
        <Input
          appearance="native"
          ref={fileRef}
          type="file"
          accept="image/png,image/jpeg,image/gif,image/webp"
          hidden
          aria-label="Image to add"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) onAddImage(file);
            event.target.value = "";
          }}
        />
      </div>

      {menu === "templates" ? (
        <ul
          aria-label="Templates"
          className="absolute top-14 left-1/2 z-20 w-72 -translate-x-1/2 overflow-hidden rounded-xl border border-line bg-canvas shadow-lg"
        >
          {templates.map((template) => (
            <li key={template.id}>
              <Button
                variant="custom"
                type="button"
                className="flex w-full flex-col px-4 py-2 text-left hover:bg-hover"
                onClick={() => onAddTemplate(template.id)}
              >
                <span className="text-sm font-medium text-ink">
                  {template.name}
                </span>
                <span className="text-xs text-ink-2">
                  {template.description}
                </span>
              </Button>
            </li>
          ))}
        </ul>
      ) : null}
    </>
  );
}
