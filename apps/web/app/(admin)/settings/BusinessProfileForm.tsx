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
    slug: string;
    timezone: string;
    locale: string;
    currency: string;
    taxRateBps: number;
  };
};

export function BusinessProfileForm({ initial }: Props) {
  const router = useRouter();
  const [name, setName] = useState(initial.name);
  const [legalName, setLegalName] = useState(initial.legalName ?? '');
  const [email, setEmail] = useState(initial.email);
  const [phone, setPhone] = useState(initial.phone ?? '');
  const [err, setErr] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErr(null);
    setSavedAt(null);
    startTransition(async () => {
      try {
        await updateBusinessSettings({
          name: name.trim(),
          legalName: legalName.trim() || null,
          email: email.trim(),
          phone: phone.trim() || null,
          timezone: initial.timezone,
          locale: initial.locale,
          currency: initial.currency,
          taxRateBps: initial.taxRateBps,
        });
        setSavedAt(new Date().toLocaleTimeString());
        router.refresh();
      } catch (e) {
        setErr((e as Error).message);
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Business name">
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={100}
            className="w-full rounded border px-2 py-1 text-sm"
          />
        </Field>
        <Field label="Legal name (optional)">
          <input
            value={legalName}
            onChange={(e) => setLegalName(e.target.value)}
            maxLength={200}
            className="w-full rounded border px-2 py-1 text-sm"
          />
        </Field>
        <Field label="Contact email">
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            maxLength={254}
            className="w-full rounded border px-2 py-1 text-sm"
          />
        </Field>
        <Field label="Phone">
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            maxLength={40}
            className="w-full rounded border px-2 py-1 text-sm"
          />
        </Field>
        <Field label="URL slug" hint="Read-only — changing this would break customer links.">
          <input
            value={initial.slug}
            readOnly
            className="w-full rounded border bg-neutral-100 px-2 py-1 text-sm text-neutral-600"
          />
        </Field>
      </div>

      <div className="flex items-center gap-3 pt-1">
        <button
          type="submit"
          disabled={pending}
          className="rounded bg-black px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-60"
        >
          {pending ? 'Saving…' : 'Save business profile'}
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
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-neutral-600">{label}</span>
      <div className="mt-1">{children}</div>
      {hint && <span className="mt-0.5 block text-[11px] text-neutral-500">{hint}</span>}
    </label>
  );
}
