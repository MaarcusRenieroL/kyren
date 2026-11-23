import type { FC } from "react";
import { PlusIcon, SparklesIcon } from "lucide-react";
import { Button } from "@zentro/ui/shadcn/button";

type ActionItemsCompilerProps = {
  extractedActionItems: string[];
  onOpenCreateTask: (prefillName?: string) => void;
};

export const ActionItemsCompiler: FC<ActionItemsCompilerProps> = ({
  extractedActionItems,
  onOpenCreateTask,
}) => {
  if (extractedActionItems.length === 0) return null;

  return (
    <div className="p-3 bg-warning-subtle border-b border-warning/20 text-xs space-y-2">
      <div className="flex items-center justify-between text-warning-text font-medium">
        <div className="flex items-center gap-1.5">
          <SparklesIcon className="size-3.5" />
          <span>
            Spec Action Items Detected ({extractedActionItems.length})
          </span>
        </div>
      </div>
      <p className="text-[11px] text-ink-3 leading-normal">
        Turn markdown checklist items into trackable tickets:
      </p>
      <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
        {extractedActionItems.slice(0, 4).map((item, idx) => (
          <div
            key={idx}
            className="flex items-center justify-between gap-2 p-1.5 rounded bg-background/80 border border-hairline"
          >
            <span className="truncate text-ink text-[12px]">{item}</span>
            <Button
              size="xs"
              variant="secondary"
              className="h-6 text-[11px] shrink-0 gap-1 px-2"
              onClick={() => onOpenCreateTask(item)}
            >
              <PlusIcon className="size-3" />
              Compile
            </Button>
          </div>
        ))}
        {extractedActionItems.length > 4 && (
          <p className="text-[10px] text-ink-3 text-center italic">
            + {extractedActionItems.length - 4} more action items in spec
          </p>
        )}
      </div>
    </div>
  );
};
