/**
 * Decimal places of a currency's minor unit: 2 for USD (cents), 0 for JPY,
 * 3 for BHD. Amounts are stored as whole minor units.
 */
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

/** Whole minor units to an amount people read, such as 1234 cents to 12.34. */
export function toMajor(minor: number, currency: string) {
  return minor / 10 ** minorDigits(currency);
}

/** An amount people typed to whole minor units. */
export function toMinor(major: number, currency: string) {
  return Math.round(major * 10 ** minorDigits(currency));
}

/** Formats whole minor units as money in the given currency. */
export function formatMoney(minor: number, currency = "USD") {
  const digits = minorDigits(currency);

  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
    }).format(minor / 10 ** digits);
  } catch {
    return `${(minor / 10 ** digits).toFixed(digits)} ${currency}`;
  }
}

export function formatPeriod(start: string, end: string) {
  const format = new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });

  return `${format.format(new Date(`${start}T00:00:00Z`))} – ${format.format(new Date(`${end}T00:00:00Z`))}`;
}

export const runTone: Record<string, string> = {
  draft: "bg-sunken text-ink-2",
  approved: "bg-tint-sun text-ink",
  paid: "bg-tint-teams text-ink",
};
