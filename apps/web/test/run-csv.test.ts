import { describe, expect, it } from "vitest";

import { csvFileName, runCsv } from "../src/components/payroll/run-csv";

describe("runCsv", () => {
  it("writes amounts in major units, one row per person", () => {
    const csv = runCsv([
      {
        employeeName: "Ana",
        currency: "USD",
        base: 500000,
        bonus: 100000,
        deductions: 120000,
        net: 480000,
      },
    ]);

    expect(csv.split("\r\n")).toEqual([
      "Employee,Currency,Base,Bonus,Deductions,Net",
      "Ana,USD,5000.00,1000.00,1200.00,4800.00",
    ]);
  });

  it("defuses spreadsheet formulas in names", () => {
    const csv = runCsv([
      {
        employeeName: '=HYPERLINK("http://x")',
        currency: "USD",
        base: 0,
        bonus: 0,
        deductions: 0,
        net: 0,
      },
    ]);

    expect(csv.split("\r\n")[1]).toMatch(/^"?'=/);
  });
});

describe("csvFileName", () => {
  it("makes a safe file name from the label", () => {
    expect(csvFileName("June 2030 / Eng")).toBe("pay-run-june-2030-eng.csv");
    expect(csvFileName("???")).toBe("pay-run-export.csv");
  });
});
