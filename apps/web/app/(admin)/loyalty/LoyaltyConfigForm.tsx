'use client';

import { useTransition, useState } from 'react';
import { updateLoyaltyProgram } from '@/actions/loyalty';

type Initial = {
  isActive: boolean;
  appliesToAddons: boolean;
  countPackagesOnly: boolean;
  resetOnRedemption: boolean;
  autoApply: boolean;
  name: string;
  description: string;
} | null;

export function LoyaltyConfigForm({ initial }: { initial: Initial }) {
  const [state, setState] = useState(
    initial ?? {
      isActive: true,
      appliesToAddons: false,
      countPackagesOnly: true,
      resetOnRedemption: false,
      autoApply: true,
      name: 'Loyalty Rewards',
      description: '',
    },
  );
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    startTransition(async () => {
      try {
        await updateLoyaltyProgram(state);
        setMsg('Saved');
      } catch (err) {
        setMsg('Error: ' + (err as Error).message);
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="card space-y-4">
      <h2 className="text-lg font-semibold">Program configuration</h2>

      <div>
        <label className="label">Program name</label>
        <input
          className="input mt-1"
          value={state.name}
          onChange={(e) => setState({ ...state, name: e.target.value })}
        />
      </div>

      <div>
        <label className="label">Description (optional)</label>
        <textarea
          className="input mt-1"
          rows={2}
          value={state.description}
          onChange={(e) => setState({ ...state, description: e.target.value })}
        />
      </div>

      <fieldset className="space-y-2">
        <Toggle
          label="Program active"
          checked={state.isActive}
          onChange={(v) => setState({ ...state, isActive: v })}
        />
        <Toggle
          label="Auto-apply reward at checkout"
          checked={state.autoApply}
          onChange={(v) => setState({ ...state, autoApply: v })}
        />
        <Toggle
          label="Count packages only (add-ons do not count as a visit)"
          checked={state.countPackagesOnly}
          onChange={(v) => setState({ ...state, countPackagesOnly: v })}
        />
        <Toggle
          label="Apply discount to add-ons"
          checked={state.appliesToAddons}
          onChange={(v) => setState({ ...state, appliesToAddons: v })}
        />
        <Toggle
          label="Reset counter on redemption"
          checked={state.resetOnRedemption}
          onChange={(v) => setState({ ...state, resetOnRedemption: v })}
        />
      </fieldset>

      <div className="flex items-center gap-3">
        <button type="submit" className="btn-primary" disabled={pending}>
          {pending ? 'Saving…' : 'Save'}
        </button>
        {msg && <span className="text-sm text-neutral-600">{msg}</span>}
      </div>
    </form>
  );
}

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-3 text-sm">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4"
      />
      <span>{label}</span>
    </label>
  );
}
