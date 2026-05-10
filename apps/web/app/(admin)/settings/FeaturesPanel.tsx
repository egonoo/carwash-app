'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { updateFeatureFlags } from '@/actions/catalog';

type FeatureKey =
  | 'sms'
  | 'promo_codes'
  | 'photos'
  | 'loyalty'
  | 'custom_domain'
  | 'google_calendar'
  | 'multiple_resources';

type Props = {
  initial: Record<FeatureKey, boolean>;
};

const ROWS: Array<{ key: FeatureKey; label: string; description: string }> = [
  { key: 'loyalty', label: 'Loyalty rewards', description: 'Per-vehicle visit counter and redeemable tiers.' },
  { key: 'photos', label: 'Evidence photos', description: 'Pre/in-progress/post photos uploaded to R2.' },
  { key: 'promo_codes', label: 'Promo codes', description: 'Discount codes applied at booking.' },
  { key: 'sms', label: 'SMS notifications', description: 'Send reminders and confirmations by text.' },
  { key: 'google_calendar', label: 'Google Calendar', description: 'Sync appointments with a Google calendar.' },
  { key: 'multiple_resources', label: 'Multiple resources', description: 'Allow concurrent jobs across resources.' },
  { key: 'custom_domain', label: 'Custom domain', description: 'Serve the public booking site on your own domain.' },
];

export function FeaturesPanel({ initial }: Props) {
  const router = useRouter();
  const [features, setFeatures] = useState<Record<FeatureKey, boolean>>(initial);
  const [savingKey, setSavingKey] = useState<FeatureKey | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function toggle(key: FeatureKey) {
    const next = !features[key];
    setFeatures((prev) => ({ ...prev, [key]: next }));
    setSavingKey(key);
    setErr(null);
    setSavedAt(null);
    startTransition(async () => {
      try {
        await updateFeatureFlags({ [key]: next } as Record<FeatureKey, boolean>);
        setSavedAt(new Date().toLocaleTimeString());
        router.refresh();
      } catch (e) {
        // Revert on failure.
        setFeatures((prev) => ({ ...prev, [key]: !next }));
        setErr((e as Error).message);
      } finally {
        setSavingKey(null);
      }
    });
  }

  return (
    <div className="space-y-2">
      <ul className="divide-y rounded border bg-white">
        {ROWS.map((row) => (
          <li key={row.key} className="flex items-center justify-between gap-3 px-3 py-2">
            <div>
              <div className="text-sm font-medium">{row.label}</div>
              <div className="text-xs text-neutral-500">{row.description}</div>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={features[row.key]}
              onClick={() => toggle(row.key)}
              disabled={pending && savingKey === row.key}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${
                features[row.key] ? 'bg-emerald-600' : 'bg-neutral-300'
              } disabled:opacity-60`}
            >
              <span
                className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition ${
                  features[row.key] ? 'translate-x-5' : 'translate-x-1'
                }`}
              />
            </button>
          </li>
        ))}
      </ul>
      <div className="flex items-center gap-3 px-1 text-xs">
        {savedAt && !err && (
          <span className="text-emerald-600">✓ Settings saved at {savedAt}</span>
        )}
        {err && <span className="text-red-600">{err}</span>}
      </div>
    </div>
  );
}
