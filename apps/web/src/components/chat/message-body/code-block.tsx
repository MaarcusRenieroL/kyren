"use client";

import { Button } from "@kyren/ui/shadcn/button";
import { useState } from "react";
import { CheckIcon, CopyIcon } from "lucide-react";
import { copyText } from "~/src/lib/clipboard";

export function CodeBlock({ code, lang }: { code: string; lang: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <div className="group/code my-1.5 overflow-hidden rounded-lg border border-hairline bg-sunken">
      <div className="flex items-center justify-between border-b border-hairline px-3 py-1 font-mono text-[11px] text-ink-3">
        <span>{lang || "code"}</span>
        <Button
          variant="custom"
          type="button"
          onClick={() => {
            void copyText(code).then((done) => {
              if (!done) return;
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            });
          }}
          className="flex items-center gap-1 rounded-xs outline-none hover:text-ink focus-visible:ring-2 focus-visible:ring-ring"
          aria-label="Copy code"
        >
          {copied ? (
            <CheckIcon className="size-3" aria-hidden="true" />
          ) : (
            <CopyIcon className="size-3" aria-hidden="true" />
          )}
          {copied ? "Copied" : "Copy"}
        </Button>
      </div>
      <pre className="overflow-x-auto px-3 py-2 font-mono text-[13px] leading-5 whitespace-pre">
        {code}
      </pre>
    </div>
  );
}
