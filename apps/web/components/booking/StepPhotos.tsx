'use client';

import { useEffect, useRef } from 'react';
import type { WizardPhoto, WizardState } from './state';

const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp'] as const;
const MAX_BYTES = 10 * 1024 * 1024;
const MAX_PHOTOS = 12;

/**
 * Las fotos se acumulan en `state.photos` con previewUrl creado UNA vez por
 * archivo. El upload real (a R2 vía /api/photos/presign) ocurre en StepReviewPay
 * tras createBookingDraft, cuando el appointmentId ya existe.
 */
export function StepPhotos({
  state,
  onChange,
  onNext,
  onBack,
  minRequired,
}: {
  businessId: string;
  state: WizardState;
  onChange: (patch: Partial<WizardState>) => void;
  onNext: () => void;
  onBack: () => void;
  minRequired: number;
}) {
  const ec = state.evidenceConsent;
  const photos = state.photos;

  // Revoke object URLs cuando el componente se desmonte. No revocamos en
  // updates parciales para no invalidar URLs que sigan en uso.
  const photosRef = useRef(photos);
  photosRef.current = photos;
  useEffect(() => {
    return () => {
      for (const p of photosRef.current) {
        try {
          URL.revokeObjectURL(p.previewUrl);
        } catch {
          // ignore
        }
      }
    };
  }, []);

  const validCount = photos.filter((p) => p.status === 'ok').length;
  const canContinue = validCount >= minRequired && ec.currentStateAccepted;

  function addFiles(list: FileList | null) {
    if (!list || list.length === 0) return;
    const remaining = MAX_PHOTOS - photos.length;
    if (remaining <= 0) return;
    const incoming = Array.from(list).slice(0, remaining);
    const next: WizardPhoto[] = incoming.map((file) => {
      const id = `${file.name}-${file.size}-${file.lastModified}-${Math.random().toString(36).slice(2, 8)}`;
      const validation = validate(file);
      const previewUrl = URL.createObjectURL(file);
      return {
        id,
        file,
        previewUrl,
        status: validation.ok ? 'ok' : 'invalid',
        errorMsg: validation.ok ? undefined : validation.message,
      };
    });
    onChange({ photos: [...photos, ...next] });
  }

  function remove(id: string) {
    const target = photos.find((p) => p.id === id);
    if (target) {
      try {
        URL.revokeObjectURL(target.previewUrl);
      } catch {
        // ignore
      }
    }
    onChange({ photos: photos.filter((p) => p.id !== id) });
  }

  function markBroken(id: string) {
    onChange({
      photos: photos.map((p) =>
        p.id === id
          ? { ...p, status: 'broken', errorMsg: 'Could not load preview' }
          : p,
      ),
    });
  }

  return (
    <section className="space-y-4">
      <h2 className="text-xl font-semibold">Vehicle condition photos</h2>
      <p className="text-sm text-neutral-600">
        This protects you and us — existing scratches, dents or damage will be documented before the service.
      </p>

      <div>
        <label className="btn-ghost cursor-pointer">
          + Add photo
          <input
            type="file"
            accept={ALLOWED_MIME.join(',')}
            multiple
            className="hidden"
            onChange={(e) => {
              addFiles(e.target.files);
              e.target.value = '';
            }}
          />
        </label>
        <div className="mt-2 text-xs text-neutral-500">
          {validCount}/{minRequired} valid · up to {MAX_PHOTOS} photos · JPEG, PNG or WebP, max 10 MB
        </div>
      </div>

      {photos.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          {photos.map((p) => (
            <PhotoCard key={p.id} photo={p} onRemove={() => remove(p.id)} onError={() => markBroken(p.id)} />
          ))}
        </div>
      )}

      <div className="space-y-2 text-sm">
        <label className="flex items-start gap-2">
          <input
            type="checkbox"
            className="mt-0.5 h-4 w-4"
            checked={ec.currentStateAccepted}
            onChange={(e) =>
              onChange({ evidenceConsent: { ...ec, currentStateAccepted: e.target.checked } })
            }
          />
          <span>
            <strong>I confirm these photos represent the current condition of my vehicle before service.</strong>
          </span>
        </label>
        <label className="flex items-start gap-2">
          <input
            type="checkbox"
            className="mt-0.5 h-4 w-4"
            checked={ec.marketingUseConsent}
            onChange={(e) =>
              onChange({ evidenceConsent: { ...ec, marketingUseConsent: e.target.checked } })
            }
          />
          <span>I allow the business to use before/after photos for marketing (plates/faces blurred).</span>
        </label>
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

function PhotoCard({
  photo,
  onRemove,
  onError,
}: {
  photo: WizardPhoto;
  onRemove: () => void;
  onError: () => void;
}) {
  const broken = photo.status !== 'ok';
  return (
    <div className="relative aspect-square overflow-hidden rounded bg-neutral-100">
      {photo.status === 'ok' ? (
        <img
          src={photo.previewUrl}
          className="h-full w-full object-cover"
          alt=""
          onError={onError}
        />
      ) : (
        <div className="flex h-full w-full flex-col items-center justify-center p-2 text-center text-xs text-danger">
          <span className="font-semibold">{photo.status === 'invalid' ? 'Not supported' : 'Broken'}</span>
          {photo.errorMsg && <span className="mt-1 text-[10px] text-neutral-600">{photo.errorMsg}</span>}
        </div>
      )}
      <button
        type="button"
        onClick={onRemove}
        aria-label="Remove photo"
        className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-xs text-white hover:bg-black/80"
      >
        ✕
      </button>
      {broken && (
        <div className="pointer-events-none absolute inset-0 ring-2 ring-danger/50" />
      )}
    </div>
  );
}

function validate(file: File): { ok: true } | { ok: false; message: string } {
  const mime = file.type.toLowerCase();
  if (!ALLOWED_MIME.includes(mime as (typeof ALLOWED_MIME)[number])) {
    if (mime === 'image/heic' || mime === 'image/heif' || /\.(heic|heif)$/i.test(file.name)) {
      return { ok: false, message: 'HEIC not supported. Convert to JPEG first.' };
    }
    return { ok: false, message: 'Use JPEG, PNG or WebP' };
  }
  if (file.size > MAX_BYTES) {
    return { ok: false, message: 'Larger than 10 MB' };
  }
  if (file.size <= 0) {
    return { ok: false, message: 'Empty file' };
  }
  return { ok: true };
}
