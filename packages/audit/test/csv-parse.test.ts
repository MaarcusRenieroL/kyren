import { describe, expect, it } from "vitest";

import { buildCsv, parseCsv } from "../src/csv";

describe("parseCsv", () => {
  it("reads plain rows with LF, CRLF and a BOM", () => {
    expect(parseCsv("﻿a,b\r\n1,2\n3,4\n")).toEqual([
      ["a", "b"],
      ["1", "2"],
      ["3", "4"],
    ]);
  });

  it("reads quoted cells with commas, quotes and line breaks", () => {
    expect(parseCsv('a,"b, c","say ""hi""","line\nbreak"')).toEqual([
      ["a", "b, c", 'say "hi"', "line\nbreak"],
    ]);
  });

  it("keeps empty cells and skips blank lines", () => {
    expect(parseCsv("a,,c\n\n,,\nd,e,f")).toEqual([
      ["a", "", "c"],
      ["d", "e", "f"],
    ]);
  });

  it("round-trips what buildCsv writes", () => {
    const rows = [["x, y", 'q"uote', "multi\nline", ""]];

    expect(parseCsv(buildCsv(["a", "b", "c", "d"], rows)).slice(1)).toEqual(
      rows,
    );
  });
});
