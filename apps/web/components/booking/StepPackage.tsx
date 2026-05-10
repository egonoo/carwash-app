import type { WizardState } from './state';

export function StepPackage({
  packages,
  state,
  onChange,
  onNext,
  onBack,
}: {
  packages: Array<{
    id: string;
    name: string;
    description: string | null;
    prices: Array<{ vehicleTypeId: string; priceCents: number; durationMinutes: number; isAvailable: boolean }>;
  }>;
  state: WizardState;
  onChange: (patch: Partial<WizardState>) => void;
  onNext: () => void;
  onBack: () => void;
}) {
  const vt = state.vehicleTypeId;
  const available = packages
    .map((p) => ({ ...p, price: p.prices.find((pr) => pr.vehicleTypeId === vt) }))
    .filter((p) => p.price && p.price.isAvailable);

  return (
    <section className="space-y-4">
      <h2 className="text-xl font-semibold">Choose a package</h2>
      <div className="space-y-3">
        {available.map((p) => (
          <button
            key={p.id}
            onClick={() => onChange({ packageId: p.id })}
            className={`card w-full text-left transition ${
              state.packageId === p.id ? 'ring-2 ring-[color:var(--brand)]' : 'hover:bg-neutral-50'
            }`}
          >
            <div className="flex items-baseline justify-between">
              <div className="font-semibold">{p.name}</div>
              <div className="text-sm">
                ${(p.price!.priceCents / 100).toFixed(2)} · {p.price!.durationMinutes}m
              </div>
            </div>
            {p.description && <p className="mt-1 text-sm text-neutral-600">{p.description}</p>}
          </button>
        ))}
      </div>
      <div className="flex justify-between">
        <button className="btn-ghost" onClick={onBack}>Back</button>
        <button className="btn-primary" disabled={!state.packageId} onClick={onNext}>
          Continue
        </button>
      </div>
    </section>
  );
}
