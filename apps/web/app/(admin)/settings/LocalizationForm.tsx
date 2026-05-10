'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { updateBusinessSettings } from '@/actions/business-settings';

type Props = {
  initial: {
    name: string;
    legalName: string | null;
    email: string;
    phone: string | null;
    timezone: string;
    locale: string;
    currency: string;
    taxRateBps: number;
  };
};

const COMMON_TIMEZONES = [
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'America/Phoenix',
  'America/Anchorage',
  'Pacific/Honolulu',
  'America/Mexico_City',
  'Europe/Madrid',
  'Europe/London',
  'UTC',
];

const COMMON_LOCALES = ['en', 'en-US', 'es', 'es-MX', 'es-US'];
const COMMON_CURRENCIES = ['USD', 'EUR', 'MXN', 'CAD', 'GBP'];

export function LocalizationForm({ initial }: Props) {
  const router = useRouter();
  const [timezone, setTimezone] = useState(initial.timezone);
  const [locale, setLocale] = useState(initial.locale);
  const [currency, setCurrency] = useState(initial.currency);
  const [taxPercent, setTaxPercent] = useState(
    (initial.taxRateBps / 100).toFixed(2),
  );
  const [err, setErr] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErr(null);
    setSavedAt(null);
    const taxRateBps = Math.max(
      0,
      Math.min(20_000, Math.round(Number(taxPercent || 0) * 100)),
    );
    startTransition(async () => {
      try {
        await updateBusinessSettings({
          name: initial.name,
          legalName: initial.legalName,
          email: initial.email,
          phone: initial.phone,
          timezone,
          locale,
          currency,
          taxRateBps,
        });
        setSavedAt(new Date().toLocaleTimeString());
        router.refresh();
      } catch (e) {
        setErr((e as Error).message);
      }
    });
  }

  const tzOptions = COMMON_TIMEZONES.includes(timezone)
    ? COMMON_TIMEZONES
    : [...COMMON_TIMEZONES, timezone];
  const localeOptions = COMMON_LOCALES.includes(locale)
    ? COMMON_LOCALES
    : [...COMMON_LOCALES, locale];
  const currencyOptions = COMMON_CURRENCIES.includes(currency)
    ? COMMON_CURRENCIES
    : [...COMMON_CURRENCIES, currency];

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Timezone">
          <select
            value={timezone}
            onChange={(e) => setTimezone(e.target.value)}
            className="w-full rounded border px-2 py-1 text-sm"
          >
            {tzOptions.map((tz) => (
              <option key={tz} value={tz}>
                {tz}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Locale">
          <select
            value={locale}
            onChange={(e) => setLocale(e.target.value)}
            className="w-full rounded border px-2 py-1 text-sm"
          >
            {localeOptions.map((l) => (
              <option key={l} value={l}>
                {l}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Currency">
          <select
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
            className="w-full rounded border px-2 py-1 text-sm"
          >
            {currencyOptions.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Tax rate (%)">
          <input
            type="number"
            min={0}
            max={200}
            step="0.01"
            value={taxPercent}
            onChange={(e) => setTaxPercent(e.target.value)}
            className="w-full rounded border px-2 py-1 text-sm"
          />
        </Field>
      </div>

      <div className="flex items-center gap-3 pt-1">
        <button
          type="submit"
          disabled={pending}
          className="rounded bg-black px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-60"
        >
          {pending ? 'Saving…' : 'Save localization'}
        </button>
        {savedAt && !err && (
          <span className="text-xs text-emerald-600">✓ Settings saved at {savedAt}</span>
        )}
        {err && <span className="text-xs text-red-600">{err}</span>}
      </div>
    </form>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-neutral-600">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  );
}
