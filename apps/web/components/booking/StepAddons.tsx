import type { WizardState } from './state';

type Addon = {
  id: string;
  name: string;
  description: string | null;
  pricingMode: string;
  basePriceCents: number;
  durationMinutes: number;
  defaultQuantity: number;
  maxQuantity: number;
};

export function StepAddons({
  addons,
  state,
  onChange,
  onNext,
  onBack,
}: {
  addons: Addon[];
  state: WizardState;
  onChange: (patch: Partial<WizardState>) => void;
  onNext: () => void;
  onBack: () => void;
}) {
  function toggle(a: Addon) {
    const exists = state.addons.find((s) => s.addonId === a.id);
    if (exists) {
      onChange({ addons: state.addons.filter((s) => s.addonId !== a.id) });
    } else {
      onChange({ addons: [...state.addons, { addonId: a.id, quantity: a.defaultQuantity }] });
    }
  }

  function setQty(id: string, qty: number) {
    onChange({
      addons: state.addons.map((s) => (s.addonId === id ? { ...s, quantity: qty } : s)),
    });
  }

  return (
    <section className="space-y-4">
      <h2 className="text-xl font-semibold">Add-ons (optional)</h2>
      <div className="space-y-2">
        {addons.map((a) => {
          const sel = state.addons.find((s) => s.addonId === a.id);
          const priceLabel =
            a.pricingMode === 'quote_on_site'
              ? 'Quote on site'
              : a.pricingMode === 'starting_at'
                ? `from $${(a.basePriceCents / 100).toFixed(0)}`
                : a.pricingMode === 'per_unit'
                  ? `$${(a.basePriceCents / 100).toFixed(0)} each`
                  : `$${(a.basePriceCents / 100).toFixed(0)}`;

          return (
            <div
              key={a.id}
              className={`card flex items-center justify-between ${
                sel ? 'ring-2 ring-[color:var(--brand)]' : ''
              }`}
            >
              <label className="flex items-start gap-3">
                <input type="checkbox" checked={!!sel} onChange={() => toggle(a)} className="mt-1 h-4 w-4" />
                <span>
                  <span className="font-medium">{a.name}</span>
                  <span className="ml-2 text-sm text-neutral-500">{priceLabel}</span>
                  {a.description && (
                    <span className="mt-1 block text-xs text-neutral-500">{a.description}</span>
                  )}
                </span>
              </label>
              {sel && a.pricingMode === 'per_unit' && (
                <input
                  type="number"
                  min={1}
                  max={a.maxQuantity}
                  value={sel.quantity}
                  onChange={(e) => setQty(a.id, Math.max(1, Math.min(a.maxQuantity, Number(e.target.value))))}
                  className="input w-20"
                />
              )}
            </div>
          );
        })}
      </div>
      <div className="flex justify-between">
        <button className="btn-ghost" onClick={onBack}>Back</button>
        <button className="btn-primary" onClick={onNext}>Continue</button>
      </div>
    </section>
  );
}
