/**
 * Tiny presentation helpers shared by the booking-side email wiring.
 * Pure functions — no DB, no Resend, no side effects.
 */

const CURRENCY_SYMBOL: Record<string, string> = {
  USD: '$',
  CAD: 'CA$',
  EUR: '€',
  GBP: '£',
};

export function formatMoneyCents(cents: number, currency: string = 'USD'): string {
  const symbol = CURRENCY_SYMBOL[currency.toUpperCase()] ?? `${currency.toUpperCase()} `;
  const value = (cents / 100).toFixed(2);
  return `${symbol}${value}`;
}

/**
 * Render an appointment start time in the business timezone, suitable for
 * email body and subject lines (e.g. "Mon, May 13, 2026 · 10:30 AM EDT").
 */
export function formatAppointmentTime(
  date: Date,
  timezone: string,
  locale: string = 'en-US',
): string {
  const fmt = new Intl.DateTimeFormat(locale, {
    timeZone: timezone,
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short',
  });
  // Intl returns "Mon, May 13, 2026, 10:30 AM EDT"; replace the comma between
  // the date and the time with a middot for visual rhythm.
  return fmt.format(date).replace(/, (\d{1,2}:\d{2})/, ' · $1');
}

export type VehicleLike = {
  year?: number | null;
  make?: string | null;
  model?: string | null;
  color?: string | null;
  nickname?: string | null;
};

export function formatVehicleLabel(v: VehicleLike): string {
  const yearMakeModel = [v.year, v.make, v.model].filter(Boolean).join(' ');
  const base = yearMakeModel || v.nickname || 'Vehicle';
  if (v.color && yearMakeModel) return `${base} (${v.color})`;
  return base;
}

export type CustomerLike = {
  firstName: string;
  lastName?: string | null;
};

export function formatCustomerName(c: CustomerLike): string {
  return [c.firstName, c.lastName].filter(Boolean).join(' ').trim() || c.firstName;
}

export type AddressLike = {
  line1?: string | null;
  line2?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
};

export function formatAddress(a: AddressLike): string {
  const head = [a.line1, a.line2].filter(Boolean).join(', ');
  const tail = [a.city, a.state, a.zip].filter(Boolean).join(', ');
  return [head, tail].filter(Boolean).join(' · ');
}

/**
 * Less specific variant — used when the encrypted line1 is not safely
 * available (e.g. inside admin-side post-commit handlers that intentionally
 * skip decryption). Drops line1/2 entirely.
 */
export function formatCityStateZip(a: AddressLike): string {
  return [a.city, a.state, a.zip].filter(Boolean).join(', ');
}
