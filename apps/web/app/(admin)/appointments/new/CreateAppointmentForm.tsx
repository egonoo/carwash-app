'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
import {
  createAdminAppointment,
  previewAdminAppointmentPricing,
  type AdminPricingPreview,
} from '@/actions/admin-appointment';

type VehicleOption = {
  id: string;
  internalCode: string;
  make: string | null;
  model: string | null;
  year: number | null;
  plate: string | null;
  vehicleType: { id: string; name: string };
  customer: {
    firstName: string;
    lastName: string | null;
    email: string;
    phoneE164: string;
  };
};

type Option = { id: string; name: string };

type Props = {
  vehicles: VehicleOption[];
  vehicleTypes: Option[];
  zones: Option[];
  packages: Option[];
  addons: Option[];
};

const NEW_VEHICLE = '__new__';

type NewVehicleState = {
  vehicleTypeId: string;
  year: string;
  make: string;
  model: string;
  color: string;
  plate: string;
};

const EMPTY_NEW_VEHICLE: NewVehicleState = {
  vehicleTypeId: '',
  year: '',
  make: '',
  model: '',
  color: '',
  plate: '',
};

function formatVehicleLabel(v: VehicleOption): string {
  const fullName =
    `${v.customer.firstName} ${v.customer.lastName ?? ''}`.trim() || v.customer.email;
  const desc = [v.year, v.make, v.model].filter(Boolean).join(' ') || 'Vehicle';
  const plate = v.plate || v.internalCode;
  return `${fullName} — ${v.vehicleType.name} — ${desc} — ${plate}`;
}

function dollars(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

export function CreateAppointmentForm({
  vehicles,
  vehicleTypes,
  zones,
  packages,
  addons,
}: Props) {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phoneE164, setPhoneE164] = useState('');
  const [vehicleId, setVehicleId] = useState('');
  const [newVehicle, setNewVehicle] = useState<NewVehicleState>(EMPTY_NEW_VEHICLE);
  const [zoneId, setZoneId] = useState('');
  const [startsAt, setStartsAt] = useState('');
  const [durationMinutes, setDurationMinutes] = useState(60);
  const [packageId, setPackageId] = useState('');
  const [addonQty, setAddonQty] = useState<Record<string, number>>({});
  const [paymentMethod, setPaymentMethod] = useState<'' | 'cash' | 'zelle'>('');

  const [preview, setPreview] = useState<AdminPricingPreview | null>(null);
  const [previewErr, setPreviewErr] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  const [submitErr, setSubmitErr] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const selectedAddons = useMemo(
    () =>
      Object.entries(addonQty)
        .filter(([, q]) => q > 0)
        .map(([addonId, quantity]) => ({ addonId, quantity })),
    [addonQty],
  );

  const addonsKey = useMemo(
    () =>
      selectedAddons
        .map((a) => `${a.addonId}:${a.quantity}`)
        .sort()
        .join(','),
    [selectedAddons],
  );

  const isNewVehicle = vehicleId === NEW_VEHICLE;
  const selectedExistingVehicle = isNewVehicle
    ? null
    : vehicles.find((v) => v.id === vehicleId) ?? null;
  const previewVehicleTypeId = isNewVehicle
    ? newVehicle.vehicleTypeId
    : selectedExistingVehicle?.vehicleType.id ?? '';
  const previewVehicleId = isNewVehicle ? null : selectedExistingVehicle?.id ?? null;

  useEffect(() => {
    setPreview(null);
    setPreviewErr(null);
    if (!packageId || !previewVehicleTypeId || !zoneId) return;

    let cancelled = false;
    setPreviewLoading(true);
    const t = setTimeout(async () => {
      try {
        const res = await previewAdminAppointmentPricing({
          packageId,
          vehicleTypeId: previewVehicleTypeId,
          vehicleId: previewVehicleId,
          zoneId,
          addons: selectedAddons,
        });
        if (!cancelled) setPreview(res);
      } catch (e) {
        if (!cancelled) setPreviewErr((e as Error).message);
      } finally {
        if (!cancelled) setPreviewLoading(false);
      }
    }, 250);

    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [packageId, previewVehicleTypeId, previewVehicleId, zoneId, addonsKey, selectedAddons]);

  function selectVehicle(id: string) {
    setVehicleId(id);
    if (id === NEW_VEHICLE || id === '') return;
    const v = vehicles.find((x) => x.id === id);
    if (v) {
      setFirstName(v.customer.firstName);
      setLastName(v.customer.lastName ?? '');
      setEmail(v.customer.email);
      setPhoneE164(v.customer.phoneE164);
    }
  }

  function toggleAddon(id: string, checked: boolean) {
    setAddonQty((prev) => {
      const next = { ...prev };
      if (checked) next[id] = next[id] ?? 1;
      else delete next[id];
      return next;
    });
  }

  function setAddonQtyById(id: string, qty: number) {
    setAddonQty((prev) => ({ ...prev, [id]: Math.max(1, Math.min(50, qty)) }));
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitErr(null);

    if (!startsAt) {
      setSubmitErr('Pick a date and time');
      return;
    }

    const yearNum = newVehicle.year.trim() ? Number(newVehicle.year) : null;

    startTransition(async () => {
      try {
        await createAdminAppointment({
          firstName: firstName.trim(),
          lastName: lastName.trim() || null,
          email: email.trim().toLowerCase(),
          phoneE164: phoneE164.trim(),
          vehicleId: isNewVehicle ? null : vehicleId,
          newVehicle: isNewVehicle
            ? {
                vehicleTypeId: newVehicle.vehicleTypeId,
                year: Number.isFinite(yearNum) ? (yearNum as number) : null,
                make: newVehicle.make.trim(),
                model: newVehicle.model.trim(),
                color: newVehicle.color.trim() || null,
                plate: newVehicle.plate.trim() || null,
              }
            : null,
          zoneId,
          startsAt: new Date(startsAt).toISOString(),
          durationMinutes: preview?.durationMinutes ?? durationMinutes,
          packageId: packageId || null,
          addons: selectedAddons,
          paymentMethod: paymentMethod === '' ? null : paymentMethod,
        });
      } catch (e) {
        const digest = (e as { digest?: string })?.digest;
        if (typeof digest === 'string' && digest.startsWith('NEXT_REDIRECT')) {
          throw e;
        }
        setSubmitErr((e as Error).message);
      }
    });
  }

  const newVehicleValid =
    newVehicle.vehicleTypeId !== '' &&
    newVehicle.make.trim() !== '' &&
    newVehicle.model.trim() !== '';

  const canSubmit =
    !pending &&
    firstName.trim() !== '' &&
    email.trim() !== '' &&
    phoneE164.trim() !== '' &&
    vehicleId !== '' &&
    (!isNewVehicle || newVehicleValid) &&
    zoneId !== '' &&
    startsAt !== '';

  return (
    <form onSubmit={onSubmit} className="grid max-w-3xl gap-6">
      <section className="card space-y-4">
        <h2 className="text-lg font-semibold">Customer</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="text-sm font-medium">First name</span>
            <input
              required
              maxLength={100}
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              className="mt-1 w-full rounded border px-3 py-2"
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium">Last name</span>
            <input
              maxLength={100}
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              className="mt-1 w-full rounded border px-3 py-2"
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium">Email</span>
            <input
              type="email"
              required
              maxLength={254}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full rounded border px-3 py-2"
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium">Phone (E.164)</span>
            <input
              required
              placeholder="+14155551212"
              pattern="\+[1-9]\d{6,14}"
              value={phoneE164}
              onChange={(e) => setPhoneE164(e.target.value)}
              className="mt-1 w-full rounded border px-3 py-2"
            />
          </label>
        </div>
      </section>

      <section className="card space-y-4">
        <h2 className="text-lg font-semibold">Vehicle & zone</h2>
        <label className="block">
          <span className="text-sm font-medium">Vehicle</span>
          <select
            required
            value={vehicleId}
            onChange={(e) => selectVehicle(e.target.value)}
            className="mt-1 w-full rounded border px-3 py-2"
          >
            <option value="" disabled>
              Select a vehicle…
            </option>
            <option value={NEW_VEHICLE}>+ New vehicle</option>
            {vehicles.map((v) => (
              <option key={v.id} value={v.id}>
                {formatVehicleLabel(v)}
              </option>
            ))}
          </select>
          <span className="mt-1 block text-xs text-neutral-500">
            Selecting an existing vehicle auto-fills the customer fields above. Choose
            “New vehicle” to enter a new one for this customer.
          </span>
        </label>

        {isNewVehicle && (
          <div className="space-y-3 rounded border bg-neutral-50 p-3">
            <div className="text-sm font-medium">New vehicle details</div>
            <label className="block">
              <span className="text-sm font-medium">Vehicle type</span>
              <select
                required
                value={newVehicle.vehicleTypeId}
                onChange={(e) =>
                  setNewVehicle((s) => ({ ...s, vehicleTypeId: e.target.value }))
                }
                className="mt-1 w-full rounded border px-3 py-2"
              >
                <option value="" disabled>
                  Select a type…
                </option>
                {vehicleTypes.map((vt) => (
                  <option key={vt.id} value={vt.id}>
                    {vt.name}
                  </option>
                ))}
              </select>
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="text-sm font-medium">Year</span>
                <input
                  type="number"
                  min={1900}
                  max={2100}
                  value={newVehicle.year}
                  onChange={(e) => setNewVehicle((s) => ({ ...s, year: e.target.value }))}
                  className="mt-1 w-full rounded border px-3 py-2"
                />
              </label>
              <label className="block">
                <span className="text-sm font-medium">Make</span>
                <input
                  required
                  maxLength={100}
                  value={newVehicle.make}
                  onChange={(e) => setNewVehicle((s) => ({ ...s, make: e.target.value }))}
                  className="mt-1 w-full rounded border px-3 py-2"
                />
              </label>
              <label className="block">
                <span className="text-sm font-medium">Model</span>
                <input
                  required
                  maxLength={100}
                  value={newVehicle.model}
                  onChange={(e) => setNewVehicle((s) => ({ ...s, model: e.target.value }))}
                  className="mt-1 w-full rounded border px-3 py-2"
                />
              </label>
              <label className="block">
                <span className="text-sm font-medium">Color</span>
                <input
                  maxLength={50}
                  value={newVehicle.color}
                  onChange={(e) => setNewVehicle((s) => ({ ...s, color: e.target.value }))}
                  className="mt-1 w-full rounded border px-3 py-2"
                />
              </label>
              <label className="block sm:col-span-2">
                <span className="text-sm font-medium">Plate (optional)</span>
                <input
                  maxLength={20}
                  value={newVehicle.plate}
                  onChange={(e) => setNewVehicle((s) => ({ ...s, plate: e.target.value }))}
                  className="mt-1 w-full rounded border px-3 py-2"
                />
              </label>
            </div>
            <p className="text-xs text-neutral-500">
              On submit, if this customer already has a vehicle with the same year, make,
              model, and plate, that one will be reused instead of creating a duplicate.
            </p>
          </div>
        )}

        <label className="block">
          <span className="text-sm font-medium">Zone</span>
          <select
            required
            value={zoneId}
            onChange={(e) => setZoneId(e.target.value)}
            className="mt-1 w-full rounded border px-3 py-2"
          >
            <option value="" disabled>
              Select a zone…
            </option>
            {zones.map((z) => (
              <option key={z.id} value={z.id}>
                {z.name}
              </option>
            ))}
          </select>
        </label>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="text-sm font-medium">Date & time</span>
            <input
              type="datetime-local"
              required
              value={startsAt}
              onChange={(e) => setStartsAt(e.target.value)}
              className="mt-1 w-full rounded border px-3 py-2"
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium">Duration (minutes)</span>
            <input
              type="number"
              min={15}
              max={480}
              step={15}
              value={durationMinutes}
              onChange={(e) => setDurationMinutes(Number(e.target.value))}
              required
              className="mt-1 w-full rounded border px-3 py-2"
            />
            {preview && (
              <span className="mt-1 block text-xs text-neutral-500">
                Package + add-ons run {preview.durationMinutes} min — that value will be used.
              </span>
            )}
          </label>
        </div>
      </section>

      <section className="card space-y-4">
        <h2 className="text-lg font-semibold">Services</h2>
        <label className="block">
          <span className="text-sm font-medium">Package</span>
          <select
            value={packageId}
            onChange={(e) => setPackageId(e.target.value)}
            className="mt-1 w-full rounded border px-3 py-2"
          >
            <option value="">No package (empty draft)</option>
            {packages.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>

        <div>
          <div className="text-sm font-medium">Add-ons</div>
          {addons.length === 0 ? (
            <p className="mt-1 text-xs text-neutral-500">No add-ons configured.</p>
          ) : (
            <ul className="mt-2 space-y-2">
              {addons.map((a) => {
                const selected = a.id in addonQty;
                return (
                  <li key={a.id} className="flex items-center gap-3">
                    <input
                      id={`addon-${a.id}`}
                      type="checkbox"
                      checked={selected}
                      onChange={(e) => toggleAddon(a.id, e.target.checked)}
                    />
                    <label htmlFor={`addon-${a.id}`} className="flex-1 text-sm">
                      {a.name}
                    </label>
                    {selected && (
                      <input
                        type="number"
                        min={1}
                        max={50}
                        value={addonQty[a.id]}
                        onChange={(e) => setAddonQtyById(a.id, Number(e.target.value))}
                        className="w-20 rounded border px-2 py-1 text-sm"
                      />
                    )}
                  </li>
                );
              })}
            </ul>
          )}
          {!packageId && (
            <p className="mt-2 text-xs text-neutral-500">
              Pick a package to compute pricing. Add-ons without a package are ignored.
            </p>
          )}
        </div>
      </section>

      <section className="card space-y-3">
        <h2 className="text-lg font-semibold">Estimated totals</h2>
        {!packageId || !vehicleId || !zoneId ? (
          <p className="text-sm text-neutral-500">
            Select a package, vehicle, and zone to see a price preview. With no package, the
            appointment is created as an empty draft you can edit on the detail page.
          </p>
        ) : previewLoading ? (
          <p className="text-sm text-neutral-500">Computing…</p>
        ) : previewErr ? (
          <p className="text-sm text-danger">Preview failed: {previewErr}</p>
        ) : preview ? (
          <dl className="grid grid-cols-2 gap-y-1 text-sm sm:grid-cols-4">
            <dt className="text-neutral-500">Subtotal</dt>
            <dd>{dollars(preview.subtotalCents)}</dd>
            <dt className="text-neutral-500">Discounts</dt>
            <dd>−{dollars(preview.discountTotalCents)}</dd>
            <dt className="text-neutral-500">Tax</dt>
            <dd>{dollars(preview.taxCents)}</dd>
            <dt className="text-neutral-500">Total</dt>
            <dd className="font-semibold">{dollars(preview.totalCents)}</dd>
            <dt className="text-neutral-500">Deposit</dt>
            <dd>{dollars(preview.depositAmountCents)}</dd>
            <dt className="text-neutral-500">Balance on service</dt>
            <dd>{dollars(preview.balanceDueOnServiceCents)}</dd>
          </dl>
        ) : null}
      </section>

      <section className="card space-y-3">
        <h2 className="text-lg font-semibold">Payment method</h2>
        <p className="text-xs text-neutral-500">
          Recorded on the appointment. Marking the deposit/balance as actually paid happens later
          from the detail page.
        </p>
        <div className="flex flex-wrap gap-4 text-sm">
          <label className="inline-flex items-center gap-2">
            <input
              type="radio"
              name="paymentMethod"
              value=""
              checked={paymentMethod === ''}
              onChange={() => setPaymentMethod('')}
            />
            None
          </label>
          <label className="inline-flex items-center gap-2">
            <input
              type="radio"
              name="paymentMethod"
              value="cash"
              checked={paymentMethod === 'cash'}
              onChange={() => setPaymentMethod('cash')}
            />
            Cash
          </label>
          <label className="inline-flex items-center gap-2">
            <input
              type="radio"
              name="paymentMethod"
              value="zelle"
              checked={paymentMethod === 'zelle'}
              onChange={() => setPaymentMethod('zelle')}
            />
            Zelle
          </label>
        </div>
      </section>

      <section className="card">
        <h2 className="text-lg font-semibold">Photos</h2>
        <p className="mt-1 text-xs text-neutral-500">
          Photos can be uploaded after the appointment is created.
        </p>
      </section>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={!canSubmit}
          className="rounded bg-black px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-60"
        >
          {pending ? 'Creating…' : 'Create appointment'}
        </button>
        {submitErr && <span className="text-sm text-danger">{submitErr}</span>}
      </div>
    </form>
  );
}
