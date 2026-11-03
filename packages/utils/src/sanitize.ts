import sanitizeHtml from "sanitize-html";

/**
 * The only markup rich text may contain. Everything else, including scripts,
 * event handlers, styles, iframes and `javascript:` links, is removed.
 */
const options: sanitizeHtml.IOptions = {
  allowedTags: [
    "p",
    "br",
    "hr",
    "strong",
    "b",
    "em",
    "i",
    "u",
    "s",
    "code",
    "pre",
    "blockquote",
    "h1",
    "h2",
    "h3",
    "ul",
    "ol",
    "li",
    "a",
    "span",
    "mark",
    "label",
    "input",
    "div",
  ],
  allowedAttributes: {
    a: ["href", "title", "target", "rel"],
    // Task lists keep their check boxes, read-only.
    input: ["type", "checked", "disabled"],
    li: ["data-type", "data-checked"],
    ul: ["data-type"],
    span: ["data-type", "data-id", "data-label"],
    code: ["class"],
    pre: ["class"],
  },
  allowedClasses: { code: [/^language-[\w-]+$/], pre: [/^language-[\w-]+$/] },
  allowedSchemes: ["http", "https", "mailto"],
  allowProtocolRelative: false,
  disallowedTagsMode: "discard",
  transformTags: {
    a: (tagName, attribs) => ({
      tagName,
      attribs: {
        ...attribs,
        rel: "noopener noreferrer nofollow",
        ...(attribs.target ? { target: "_blank" } : {}),
      },
    }),
    input: (tagName, attribs) => ({
      tagName,
      attribs: {
        type: "checkbox",
        disabled: "disabled",
        ...(attribs.checked !== undefined ? { checked: "checked" } : {}),
      },
    }),
  },
};

/** Cleans HTML from the editor or a client so it is safe to store and show. */
export function sanitizeRichText(html: string): string {
  return sanitizeHtml(html, options);
}
