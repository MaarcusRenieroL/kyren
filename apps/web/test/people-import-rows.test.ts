import { describe, expect, it } from "vitest";

import { parsePeopleCsv } from "../src/components/hr/import-rows";

describe("parsePeopleCsv", () => {
  it("reads common column names", () => {
    const { rows, error, warnings } = parsePeopleCsv(
      "Full Name,Email Address,Title,Team,Office,Start Date\nAna Lee,ana@example.com,Designer,Product,Lisbon,2030-02-01",
    );

    expect(error).toBeNull();
    expect(warnings).toEqual([]);
    expect(rows).toEqual([
      {
        name: "Ana Lee",
        email: "ana@example.com",
        jobTitle: "Designer",
        department: "Product",
        location: "Lisbon",
        startDate: "2030-02-01",
      },
    ]);
  });

  it("drops bad emails and dates with a warning, and nameless rows", () => {
    const { rows, warnings } = parsePeopleCsv(
      "name,email,start\nBo,nope,soon\n,x@y.co,",
    );

    expect(rows).toEqual([
      {
        name: "Bo",
        email: null,
        jobTitle: "",
        department: null,
        location: null,
        startDate: null,
      },
    ]);
    expect(warnings.join(" ")).toMatch(/email/);
    expect(warnings.join(" ")).toMatch(/start date/);
    expect(warnings.join(" ")).toMatch(/Line 3: no name/);
  });

  it("explains an unusable file", () => {
    expect(parsePeopleCsv("a,b\n1,2").error).toMatch(/Name/);
    expect(parsePeopleCsv("name\n").error).toMatch(/no people/);
  });
});
