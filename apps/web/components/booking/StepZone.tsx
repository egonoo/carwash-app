type Zone = { id: string; name: string; color: string | null; description: string | null };

export function StepZone({
  zones,
  value,
  onChange,
  onNext,
}: {
  zones: Zone[];
  value: string | null;
  onChange: (id: string) => void;
  onNext: () => void;
}) {
  return (
    <section className="space-y-4">
      <h2 className="text-xl font-semibold">Where should we come?</h2>
      <p className="text-sm text-neutral-600">Select the service area that matches your location.</p>
      <div className="grid gap-3">
        {zones.map((z) => (
          <button
            key={z.id}
            onClick={() => onChange(z.id)}
            className={`card text-left transition ${
              value === z.id ? 'ring-2 ring-[color:var(--brand)]' : 'hover:bg-neutral-50'
            }`}
          >
            <div className="font-semibold">{z.name}</div>
            {z.description && <div className="mt-1 text-sm text-neutral-500">{z.description}</div>}
          </button>
        ))}
      </div>
      <div className="flex justify-end">
        <button className="btn-primary" disabled={!value} onClick={onNext}>
          Continue
        </button>
      </div>
    </section>
  );
}
