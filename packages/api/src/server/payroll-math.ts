const day = 864e5;

const utc = (iso: string) => Date.parse(`${iso}T00:00:00Z`);

/**
 * Base pay for a period, in minor units. Each calendar month is worth a
 * twelfth of the year, and a partly covered month is paid by the day, so a
 * whole month is always exactly a twelfth. Days before `startDate` or after
 * `endDate` are not paid.
 */
export function proratedBase(
  annualSalary: number,
  periodStart: string,
  periodEnd: string,
  startDate?: string | null,
  endDate?: string | null,
) {
  const from = Math.max(
    utc(periodStart),
    startDate ? utc(startDate) : -Infinity,
  );
  const to = Math.min(utc(periodEnd), endDate ? utc(endDate) : Infinity);

  if (to < from) return 0;

  let months = 0;
  const cursor = new Date(from);
  cursor.setUTCDate(1);

  while (+cursor <= to) {
    const first = +cursor;
    const next = Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, 1);
    const last = next - day;
    const covered = (Math.min(to, last) - Math.max(from, first)) / day + 1;

    months += covered / ((next - first) / day);
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }

  return Math.round((annualSalary / 12) * months);
}

/** Decimal places of a currency's minor unit: 2 for USD, 0 for JPY, 3 for BHD. */
export function minorDigits(currency: string) {
  try {
    return (
      new Intl.NumberFormat("en", {
        style: "currency",
        currency,
      }).resolvedOptions().maximumFractionDigits ?? 2
    );
  } catch {
    return 2;
  }
}

/** Whole minor units (never negative) as an exact decimal, 123456 → "1234.56". */
export function minorToDecimal(minor: number, currency: string) {
  const digits = minorDigits(currency);
  const text = String(minor).padStart(digits + 1, "0");

  return digits ? `${text.slice(0, -digits)}.${text.slice(-digits)}` : text;
}
