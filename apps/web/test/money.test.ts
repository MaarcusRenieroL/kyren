import { describe, expect, it } from "vitest";

import {
  formatMoney,
  minorDigits,
  toMajor,
  toMinor,
} from "../src/components/payroll/money";

describe("money in currencies without two decimals", () => {
  it("knows each currency's minor unit", () => {
    expect(minorDigits("USD")).toBe(2);
    expect(minorDigits("JPY")).toBe(0);
    expect(minorDigits("BHD")).toBe(3);
  });

  it("converts typed amounts and stored amounts both ways", () => {
    expect(toMinor(5_000_000, "JPY")).toBe(5_000_000);
    expect(toMinor(12.5, "USD")).toBe(1250);
    expect(toMinor(1.234, "BHD")).toBe(1234);
    expect(toMajor(5_000_000, "JPY")).toBe(5_000_000);
  });

  it("formats yen without dividing by a hundred", () => {
    expect(formatMoney(1234, "JPY")).toContain("1,234");
    expect(formatMoney(1234, "JPY")).not.toContain("12.34");
  });
});
