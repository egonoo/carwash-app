import type { WizardState } from './state';

export function StepVehicle({
  vehicleTypes,
  state,
  onChange,
  onNext,
  onBack,
}: {
  vehicleTypes: Array<{ id: string; name: string; examples: string | null }>;
  state: WizardState;
  onChange: (patch: Partial<WizardState>) => void;
  onNext: () => void;
  onBack: () => void;
}) {
  const v = state.vehicle;
  const canContinue = !!state.vehicleTypeId;

  return (
    <section className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">What are we washing?</h2>
        <p className="text-sm text-neutral-600">Pick the size that matches your vehicle.</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {vehicleTypes.map((vt) => (
            <button
              key={vt.id}
              onClick={() => onChange({ vehicleTypeId: vt.id })}
              className={`card text-left transition ${
                state.vehicleTypeId === vt.id ? 'ring-2 ring-[color:var(--brand)]' : 'hover:bg-neutral-50'
              }`}
            >
              <div className="font-semibold">{vt.name}</div>
              {vt.examples && <div className="mt-1 text-xs text-neutral-500">{vt.examples}</div>}
            </button>
          ))}
        </div>
      </div>

      <div>
        <h3 className="font-semibold">Tell us about your car (optional but helps)</h3>
        <p className="mt-1 text-xs text-neutral-500">
          We'll save these details so next time is faster. Plate is optional.
        </p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <Input label="Make" value={v.make ?? ''} onChange={(val) => onChange({ vehicle: { ...v, make: val } })} placeholder="Honda" />
          <Input label="Model" value={v.model ?? ''} onChange={(val) => onChange({ vehicle: { ...v, model: val } })} placeholder="Civic" />
          <Input
            label="Year"
            value={v.year?.toString() ?? ''}
            onChange={(val) => onChange({ vehicle: { ...v, year: Number(val) || undefined } })}
            placeholder="2020"
          />
          <Input label="Color" value={v.color ?? ''} onChange={(val) => onChange({ vehicle: { ...v, color: val } })} placeholder="Blue" />
          <Input label="Plate (optional)" value={v.plate ?? ''} onChange={(val) => onChange({ vehicle: { ...v, plate: val.toUpperCase() } })} />
          <Input label="Plate state" value={v.plateState ?? ''} onChange={(val) => onChange({ vehicle: { ...v, plateState: val.toUpperCase() } })} placeholder="FL" />
        </div>
      </div>

      <div className="flex justify-between">
        <button className="btn-ghost" onClick={onBack}>Back</button>
        <button className="btn-primary" disabled={!canContinue} onClick={onNext}>
          Continue
        </button>
      </div>
    </section>
  );
}

function Input({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
}) {
  return (
    <div>
      <label className="label">{label}</label>
      <input
        className="input mt-1"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
    </div>
  );
}
