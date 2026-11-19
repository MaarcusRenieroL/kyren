/** A `%text%` LIKE pattern where `%`, `_` and `\` in the text match themselves. */
export function likePattern(text: string) {
  return `%${text.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
}
