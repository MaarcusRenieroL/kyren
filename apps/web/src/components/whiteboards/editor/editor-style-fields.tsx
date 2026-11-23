import { FieldSet, FieldLegend } from "@zentro/ui/shadcn/field";
import { Label } from "@zentro/ui/shadcn/label";
import { Checkbox } from "@zentro/ui/shadcn/checkbox";
import { Input } from "@zentro/ui/shadcn/input";
import { Button } from "@zentro/ui/shadcn/button";
import { boardTheme } from "@zentro/ui/lib/theme-colors";
import { fills, palette, stickyColors, type El } from "../canvas/model";
import type { BoardStyle } from "./editor-types";

export function EditorStyleFields({
  style,
  single,
  linearSingle,
  restyle,
  onElbowToggle,
}: {
  style: BoardStyle;
  single: El | null;
  linearSingle: El | null;
  restyle: (diff: Partial<El>) => void;
  onElbowToggle: (elbow: boolean) => void;
}) {
  return (
    <>
      <FieldSet className="flex flex-col gap-1.5">
        <FieldLegend className="mb-1 text-ink-2">Stroke</FieldLegend>
        <div className="flex flex-wrap gap-1.5">
          {palette.map((colour) => (
            <Button
              variant="custom"
              key={colour}
              type="button"
              aria-label={`Stroke ${colour}`}
              aria-pressed={(single?.color ?? style.color) === colour}
              onClick={() => restyle({ color: colour })}
              className={`size-6 rounded-full border-2 ${(single?.color ?? style.color) === colour ? "border-ink" : "border-line"}`}
              style={{
                background: colour === "ink" ? "currentColor" : colour,
              }}
            />
          ))}
        </div>
      </FieldSet>
      <FieldSet className="flex flex-col gap-1.5">
        <FieldLegend className="mb-1 text-ink-2">Fill</FieldLegend>
        <div className="flex flex-wrap gap-1.5">
          {fills.map((colour) => (
            <Button
              variant="custom"
              key={colour}
              type="button"
              aria-label={colour === "none" ? "No fill" : `Fill ${colour}`}
              aria-pressed={(single?.fill ?? style.fill) === colour}
              onClick={() => restyle({ fill: colour })}
              className={`size-6 rounded-md border-2 ${(single?.fill ?? style.fill) === colour ? "border-ink" : "border-line"}`}
              style={{
                background:
                  colour === "none"
                    ? `repeating-conic-gradient(${boardTheme.checker} 0 25%, transparent 0 50%) 0 0 / 8px 8px`
                    : colour,
              }}
            />
          ))}
        </div>
      </FieldSet>
      <FieldSet className="flex items-center gap-1.5">
        <FieldLegend className="mb-1 text-ink-2">Stroke width</FieldLegend>
        {[1, 2, 4, 8].map((width) => (
          <Button
            key={width}
            size="sm"
            variant={
              (single?.strokeWidth ?? style.strokeWidth) === width
                ? "secondary"
                : "ghost"
            }
            aria-label={`Width ${width}`}
            onClick={() => restyle({ strokeWidth: width })}
          >
            <span
              className="block w-5 rounded-full bg-ink"
              style={{ height: Math.max(1, width / 1.5) }}
            />
          </Button>
        ))}
      </FieldSet>
      <FieldSet className="flex items-center gap-1.5">
        <FieldLegend className="mb-1 text-ink-2">Line</FieldLegend>
        {(["solid", "dashed", "dotted"] as const).map((dash) => (
          <Button
            key={dash}
            size="sm"
            variant={
              (single?.dash ?? style.dash) === dash ? "secondary" : "ghost"
            }
            onClick={() => restyle({ dash })}
          >
            {dash}
          </Button>
        ))}
      </FieldSet>
      <FieldSet className="flex-row flex flex-wrap items-center gap-1.5">
        <FieldLegend className="mb-1 text-ink-2">Text size</FieldLegend>
        {[14, 18, 28, 44].map((size, i) => (
          <Button
            key={size}
            size="sm"
            variant={
              (single?.fontSize ?? style.fontSize) === size
                ? "secondary"
                : "ghost"
            }
            aria-label={`Text size ${["small", "medium", "large", "huge"][i]}`}
            onClick={() => restyle({ fontSize: size })}
          >
            {["S", "M", "L", "XL"][i]}
          </Button>
        ))}
      </FieldSet>
      <Label className="flex items-center gap-2 text-ink">
        <Checkbox
          checked={single?.sketch ?? style.sketch}
          onCheckedChange={(checked) => restyle({ sketch: checked === true })}
        />
        Hand-drawn look
      </Label>
      {single && (single.type === "rect" || single.type === "frame") ? (
        <Label className="flex items-center gap-2 text-ink">
          <Checkbox
            checked={Boolean(single.rounded)}
            onCheckedChange={(checked) =>
              restyle({ rounded: checked === true })
            }
          />
          Rounded corners
        </Label>
      ) : null}
      {linearSingle ? (
        <Label className="flex items-center gap-2 text-ink">
          <Checkbox
            checked={Boolean(linearSingle.elbow)}
            onCheckedChange={(checked) => onElbowToggle(checked === true)}
          />
          Elbow connector
        </Label>
      ) : null}
      {single?.type === "sticky" ? (
        <FieldSet className="flex-row flex flex-wrap gap-1.5">
          <FieldLegend className="mb-1 text-ink-2">Note colour</FieldLegend>
          {stickyColors.map((colour) => (
            <Button
              variant="custom"
              key={colour}
              type="button"
              aria-label={`Note ${colour}`}
              onClick={() => restyle({ fill: colour })}
              className="size-6 rounded-md border-2 border-line"
              style={{ background: colour }}
            />
          ))}
        </FieldSet>
      ) : null}
      <Label className="flex flex-col items-stretch gap-1 text-ink-2">
        Opacity
        <Input
          appearance="native"
          type="range"
          min={10}
          max={100}
          step={10}
          value={Math.round((single?.opacity ?? 1) * 100)}
          onChange={(event) =>
            restyle({ opacity: Number(event.target.value) / 100 })
          }
          aria-label="Opacity"
        />
      </Label>
    </>
  );
}
