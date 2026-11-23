export const docsEditorClassName =
  "min-h-[620px] text-base leading-[26px] outline-none [&_.ProseMirror>*+*]:mt-3 [&_.ProseMirror]:min-h-[620px] [&_.ProseMirror]:outline-none [&_.ProseMirror_p.is-editor-empty:first-child::before]:pointer-events-none [&_.ProseMirror_p.is-editor-empty:first-child::before]:float-left [&_.ProseMirror_p.is-editor-empty:first-child::before]:h-0 [&_.ProseMirror_p.is-editor-empty:first-child::before]:text-muted-foreground [&_.ProseMirror_p.is-editor-empty:first-child::before]:content-[attr(data-placeholder)] [&_.ProseMirror_h1]:mt-8 [&_.ProseMirror_h1]:mb-3 [&_.ProseMirror_h1]:text-3xl [&_.ProseMirror_h1]:font-semibold [&_.ProseMirror_h1]:tracking-tight [&_.ProseMirror_h2]:mt-7 [&_.ProseMirror_h2]:mb-0 [&_.ProseMirror_h2]:text-[22px] [&_.ProseMirror_h2]:font-semibold [&_.ProseMirror_h3]:mt-6 [&_.ProseMirror_h3]:mb-2 [&_.ProseMirror_h3]:text-xl [&_.ProseMirror_h3]:font-semibold [&_.ProseMirror_h4]:mt-5 [&_.ProseMirror_h4]:mb-2 [&_.ProseMirror_h4]:text-lg [&_.ProseMirror_h4]:font-semibold [&_.ProseMirror_h5]:mt-4 [&_.ProseMirror_h5]:mb-2 [&_.ProseMirror_h5]:text-base [&_.ProseMirror_h5]:font-semibold [&_.ProseMirror_h6]:mt-4 [&_.ProseMirror_h6]:mb-2 [&_.ProseMirror_h6]:text-sm [&_.ProseMirror_h6]:font-semibold [&_.ProseMirror_h6]:uppercase [&_.ProseMirror_h6]:text-muted-foreground [&_.ProseMirror_ul]:ml-5 [&_.ProseMirror_ul]:list-disc [&_.ProseMirror_ol]:ml-5 [&_.ProseMirror_ol]:list-decimal [&_.ProseMirror_blockquote]:my-4 [&_.ProseMirror_blockquote]:border-l-2 [&_.ProseMirror_blockquote]:pl-4 [&_.ProseMirror_blockquote]:text-muted-foreground [&_.ProseMirror_pre]:my-4 [&_.ProseMirror_pre]:overflow-x-auto [&_.ProseMirror_pre]:rounded-lg [&_.ProseMirror_pre]:border [&_.ProseMirror_pre]:bg-muted/50 [&_.ProseMirror_pre]:p-4 [&_.ProseMirror_code]:rounded [&_.ProseMirror_code]:bg-muted [&_.ProseMirror_code]:px-1.5 [&_.ProseMirror_code]:py-0.5 [&_.ProseMirror_code]:text-sm [&_.ProseMirror_table]:my-4 [&_.ProseMirror_table]:w-full [&_.ProseMirror_table]:border-collapse [&_.ProseMirror_th]:border [&_.ProseMirror_th]:bg-muted/60 [&_.ProseMirror_th]:px-3 [&_.ProseMirror_th]:py-2 [&_.ProseMirror_th]:text-left [&_.ProseMirror_td]:border [&_.ProseMirror_td]:px-3 [&_.ProseMirror_td]:py-2 [&_.ProseMirror_ul[data-type='taskList']]:ml-0 [&_.ProseMirror_ul[data-type='taskList']]:list-none [&_.ProseMirror_ul[data-type='taskList']>li]:flex [&_.ProseMirror_ul[data-type='taskList']>li]:items-start [&_.ProseMirror_ul[data-type='taskList']>li]:gap-2.5 [&_.ProseMirror_ul[data-type='taskList']_input]:mt-[5px] [&_.ProseMirror_ul[data-type='taskList']_input]:size-4 [&_.ProseMirror_ul[data-type='taskList']_input]:accent-ink [&_.ProseMirror_li[data-checked='true']>div]:text-ink-3 [&_.ProseMirror_li[data-checked='true']>div]:line-through [&_.ProseMirror_li+li]:mt-1.5";

export function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export function renderInlineMarkdown(value: string) {
  return escapeHtml(value)
    .split(/(`[^`]+`)/)
    .map((part) =>
      part.length > 2 && part.startsWith("`") && part.endsWith("`")
        ? `<code>${part.slice(1, -1)}</code>`
        : part
            .replace(
              /\[([^\]]+)\]\(((?:https?:\/\/|mailto:|\/)[^\s)]+)\)/g,
              '<a href="$2" class="mention-link">$1</a>',
            )
            .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
            .replace(/\*([^*]+)\*/g, "<em>$1</em>"),
    )
    .join("");
}

export function parseMarkdownTableRow(line: string) {
  return line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((cell) => cell.trim());
}

export function isMarkdownTableSeparator(line: string) {
  const cells = parseMarkdownTableRow(line);

  return (
    line.trim().startsWith("|") &&
    cells.length > 0 &&
    cells.every((cell) => /^:?-{3,}:?$/.test(cell))
  );
}

export function markdownToHtml(markdown: string) {
  const lines = markdown.split("\n");
  const html: string[] = [];
  let codeLines: string[] = [];
  let isCodeBlock = false;

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? "";

    if (line.startsWith("```")) {
      if (isCodeBlock) {
        html.push(
          `<pre><code>${escapeHtml(codeLines.join("\n"))}</code></pre>`,
        );
        codeLines = [];
      }

      isCodeBlock = !isCodeBlock;
      continue;
    }

    if (isCodeBlock) {
      codeLines.push(line);
      continue;
    }

    if (
      line.trim().startsWith("|") &&
      lines[index + 1] &&
      isMarkdownTableSeparator(lines[index + 1] ?? "")
    ) {
      const headers = parseMarkdownTableRow(line);
      const rows: string[][] = [];
      index += 2;

      while (lines[index]?.trim().startsWith("|")) {
        rows.push(parseMarkdownTableRow(lines[index] ?? ""));
        index += 1;
      }

      index -= 1;
      html.push(
        `<table><tbody><tr>${headers
          .map((header) => `<th>${escapeHtml(header)}</th>`)
          .join("")}</tr>${rows
          .map((row) => {
            return `<tr>${headers
              .map((_, cellIndex) => {
                return `<td>${escapeHtml(row[cellIndex] ?? "")}</td>`;
              })
              .join("")}</tr>`;
          })
          .join("")}</tbody></table>`,
      );
      continue;
    }

    if (line.startsWith("# ")) {
      html.push(`<h1>${escapeHtml(line.slice(2))}</h1>`);
      continue;
    }

    if (line.startsWith("## ")) {
      html.push(`<h2>${escapeHtml(line.slice(3))}</h2>`);
      continue;
    }

    if (line.startsWith("### ")) {
      html.push(`<h3>${escapeHtml(line.slice(4))}</h3>`);
      continue;
    }

    if (line.startsWith("#### ")) {
      html.push(`<h4>${escapeHtml(line.slice(5))}</h4>`);
      continue;
    }

    if (line.startsWith("##### ")) {
      html.push(`<h5>${escapeHtml(line.slice(6))}</h5>`);
      continue;
    }

    if (line.startsWith("###### ")) {
      html.push(`<h6>${escapeHtml(line.slice(7))}</h6>`);
      continue;
    }

    if (line.startsWith("> ")) {
      html.push(
        `<blockquote><p>${renderInlineMarkdown(line.slice(2))}</p></blockquote>`,
      );
      continue;
    }

    const task = /^- \[([ xX])\] /.exec(line);

    if (task) {
      const checked = task[1] !== " ";

      html.push(
        `<ul data-type="taskList"><li data-type="taskItem" data-checked="${checked}"><label><input type="checkbox"${checked ? " checked" : ""}><span></span></label><div><p>${renderInlineMarkdown(
          line.slice(6),
        )}</p></div></li></ul>`,
      );
      continue;
    }

    if (line.startsWith("- ")) {
      html.push(
        `<ul><li><p>${renderInlineMarkdown(line.slice(2))}</p></li></ul>`,
      );
      continue;
    }

    if (!line.trim()) {
      continue;
    }

    html.push(`<p>${renderInlineMarkdown(line)}</p>`);
  }

  if (isCodeBlock && codeLines.length) {
    html.push(`<pre><code>${escapeHtml(codeLines.join("\n"))}</code></pre>`);
  }

  return html
    .join("")
    .replaceAll("</ul><ul>", "")
    .replaceAll('</ul><ul data-type="taskList">', "");
}

function inlineMarkdown(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) {
    return node.textContent ?? "";
  }

  if (!(node instanceof Element)) {
    return "";
  }

  const tag = node.tagName.toLowerCase();
  const children = Array.from(node.childNodes).map(inlineMarkdown).join("");

  if (tag === "code") {
    return `\`${children}\``;
  }

  if (tag === "strong" || tag === "b") {
    return `**${children}**`;
  }

  if (tag === "em" || tag === "i") {
    return `*${children}*`;
  }

  if (tag === "a") {
    const href = node.getAttribute("href") ?? "";

    return /^(https?:\/\/|mailto:|\/)/.test(href)
      ? `[${children}](${href})`
      : children;
  }

  return children;
}

function blockInlineMarkdown(node: Element) {
  return Array.from(node.childNodes).map(inlineMarkdown).join("").trim();
}

export function htmlToMarkdown(html: string) {
  if (typeof window === "undefined") {
    return "";
  }

  const doc = new DOMParser().parseFromString(html, "text/html");
  const blocks: string[] = [];

  for (const element of Array.from(doc.body.children)) {
    const tag = element.tagName.toLowerCase();

    if (tag === "h1") {
      blocks.push(`# ${blockInlineMarkdown(element)}`);
    } else if (tag === "h2") {
      blocks.push(`## ${blockInlineMarkdown(element)}`);
    } else if (tag === "h3") {
      blocks.push(`### ${blockInlineMarkdown(element)}`);
    } else if (tag === "h4") {
      blocks.push(`#### ${blockInlineMarkdown(element)}`);
    } else if (tag === "h5") {
      blocks.push(`##### ${blockInlineMarkdown(element)}`);
    } else if (tag === "h6") {
      blocks.push(`###### ${blockInlineMarkdown(element)}`);
    } else if (tag === "blockquote") {
      blocks.push(`> ${blockInlineMarkdown(element)}`);
    } else if (tag === "pre") {
      const code = element.querySelector("code")?.textContent ?? element.textContent ?? "";
      blocks.push(`\`\`\`\n${code}\n\`\`\``);
    } else if (tag === "ul" && element.getAttribute("data-type") === "taskList") {
      const items = Array.from(element.querySelectorAll(":scope > li")).map((item) => {
        const checked = item.getAttribute("data-checked") === "true";
        const contentEl = item.querySelector(":scope > div") ?? item;
        return `- [${checked ? "x" : " "}] ${blockInlineMarkdown(contentEl)}`;
      });
      if (items.length) blocks.push(items.join("\n"));
    } else if (tag === "ul") {
      const items = Array.from(element.querySelectorAll(":scope > li")).map(
        (item) => `- ${blockInlineMarkdown(item)}`,
      );
      if (items.length) blocks.push(items.join("\n"));
    } else if (tag === "ol") {
      const items = Array.from(element.querySelectorAll(":scope > li")).map(
        (item, i) => `${i + 1}. ${blockInlineMarkdown(item)}`,
      );
      if (items.length) blocks.push(items.join("\n"));
    } else if (tag === "table") {
      const rows = Array.from(element.querySelectorAll("tr"));
      if (rows.length) {
        const tableLines: string[] = [];
        const headerRow = rows[0];
        const headerCells = Array.from(headerRow?.querySelectorAll("th, td") ?? []).map(
          (c) => blockInlineMarkdown(c) || " ",
        );
        tableLines.push(`| ${headerCells.join(" | ")} |`);
        tableLines.push(`| ${headerCells.map(() => "---").join(" | ")} |`);
        for (let i = 1; i < rows.length; i++) {
          const cells = Array.from(rows[i]?.querySelectorAll("td") ?? []).map(
            (c) => blockInlineMarkdown(c) || " ",
          );
          tableLines.push(`| ${cells.join(" | ")} |`);
        }
        blocks.push(tableLines.join("\n"));
      }
    } else if (tag === "p") {
      const text = blockInlineMarkdown(element);
      if (text) blocks.push(text);
    }
  }

  return blocks.join("\n\n");
}
