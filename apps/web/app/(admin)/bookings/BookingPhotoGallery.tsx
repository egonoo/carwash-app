'use client';

import { useEffect, useMemo, useState } from 'react';

type EvidencePhoto = {
  id: string;
  phase: string;
  note: string | null;
  uploadedAt: string;
  scanStatus: string;
};

type Props = {
  photos: EvidencePhoto[];
};

type ImageStatus = 'loading' | 'loaded' | 'error';

const phaseLabels: Record<string, string> = {
  pre_service_customer: 'Pre-service (customer)',
  pre_service_admin: 'Pre-service (admin)',
  in_progress: 'In progress',
  post_service: 'Post service',
};

export function BookingPhotoGallery({ photos }: Props) {
  const [imageStatus, setImageStatus] = useState<Record<string, ImageStatus>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [checkedMissing, setCheckedMissing] = useState<Record<string, boolean>>({});

  const markLoaded = (id: string) => {
    setImageStatus((prev) => ({ ...prev, [id]: 'loaded' }));
  };

  const markError = (id: string, message: string) => {
    setImageStatus((prev) => ({ ...prev, [id]: 'error' }));
    setErrors((prev) => ({ ...prev, [id]: message }));
  };

  const inspectMissingPhoto = async (id: string) => {
    if (checkedMissing[id]) return;
    setCheckedMissing((prev) => ({ ...prev, [id]: true }));

    try {
      const res = await fetch(`/api/photos/${id}/image`, { method: 'GET' });
      if (res.ok) return;
      if (res.status === 404) {
        markError(id, 'Photo record exists but file is missing in R2');
      } else {
        markError(id, 'Unable to load image');
      }
    } catch {
      markError(id, 'Unable to load image');
    }
  };

  const groupedPhotos = useMemo(() => {
    return photos.reduce<Record<string, EvidencePhoto[]>>((acc, photo) => {
      const current = acc[photo.phase] ?? [];
      current.push(photo);
      acc[photo.phase] = current;
      return acc;
    }, {});
  }, [photos]);

  if (photos.length === 0) {
    return <p className="text-sm text-neutral-500">No evidence photos available.</p>;
  }

  return (
    <div className="space-y-6">
      {Object.entries(groupedPhotos).map(([phase, phasePhotos]) => (
        <div key={phase}>
          <div className="mb-3 text-sm font-semibold text-neutral-700">{phaseLabels[phase] ?? phase}</div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {phasePhotos.map((photo) => (
              <div key={photo.id} className="overflow-hidden rounded border bg-white shadow-sm">
                <div className="aspect-[4/3] bg-neutral-100">
                  <div className="relative h-full w-full">
                    <img
                      src={`/api/photos/${photo.id}/image`}
                      alt={`Evidence photo ${photo.id}`}
                      className="h-full w-full object-cover"
                      onLoad={() => markLoaded(photo.id)}
                      onError={() => inspectMissingPhoto(photo.id)}
                    />
                    {(imageStatus[photo.id] !== 'loaded' || imageStatus[photo.id] === 'error') && (
                      <div className="absolute inset-0 flex items-center justify-center bg-neutral-100/80 px-2 text-center text-xs text-neutral-500">
                        {imageStatus[photo.id] === 'error'
                          ? errors[photo.id] || 'Unable to load image'
                          : 'Loading photo…'}
                      </div>
                    )}
                  </div>
                </div>
                <div className="space-y-1 p-3 text-xs text-neutral-600">
                  <div>{new Date(photo.uploadedAt).toLocaleString()}</div>
                  {photo.note ? <div>{photo.note}</div> : <div className="text-neutral-400">No note</div>}
                  <div className="rounded-full bg-neutral-100 px-2 py-1 text-[11px] uppercase tracking-wide text-neutral-600">
                    {photo.scanStatus}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
