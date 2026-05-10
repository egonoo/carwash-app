'use client';

import { useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

type Phase = 'pre_service_admin' | 'in_progress' | 'post_service';

const ALLOWED_MIME: Record<string, true> = {
  'image/jpeg': true,
  'image/png': true,
  'image/heic': true,
  'image/webp': true,
};

const MAX_BYTES = 10 * 1024 * 1024;

type Props = {
  appointmentId: string;
};

export function PhotoUploader(props: Props) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [phase, setPhase] = useState<Phase>('pre_service_admin');
  const [note, setNote] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [progress, setProgress] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  async function uploadFile(file: File) {
    if (!ALLOWED_MIME[file.type]) {
      throw new Error(`Unsupported file type: ${file.type}`);
    }
    if (file.size > MAX_BYTES) {
      throw new Error('File exceeds 10 MB');
    }

    const presignRes = await fetch('/api/photos/presign', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        appointmentId: props.appointmentId,
        phase,
        mimeType: file.type,
        bytes: file.size,
        note: note.trim() || undefined,
      }),
    });
    const presignBody = await presignRes.json().catch(() => null);
    if (!presignRes.ok || !presignBody?.ok) {
      throw new Error(presignBody?.error?.message ?? 'Presign failed');
    }
    const { uploadUrl, uploadHeaders } = presignBody.data as {
      uploadUrl: string;
      uploadHeaders: Record<string, string>;
    };

    const putRes = await fetch(uploadUrl, {
      method: 'PUT',
      headers: uploadHeaders,
      body: file,
    });
    if (!putRes.ok) {
      throw new Error(`R2 upload failed (${putRes.status})`);
    }
  }

  function onSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;
    setErr(null);

    startTransition(async () => {
      try {
        for (let i = 0; i < files.length; i++) {
          setProgress(`Uploading ${i + 1}/${files.length}…`);
          await uploadFile(files[i]);
        }
        setProgress(null);
        setNote('');
        if (inputRef.current) inputRef.current.value = '';
        router.refresh();
      } catch (e) {
        setProgress(null);
        setErr((e as Error).message);
      }
    });
  }

  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="text-sm font-medium">Phase</span>
          <select
            value={phase}
            onChange={(e) => setPhase(e.target.value as Phase)}
            className="mt-1 w-full rounded border px-3 py-2"
            disabled={pending}
          >
            <option value="pre_service_admin">Pre-service (admin)</option>
            <option value="in_progress">In progress</option>
            <option value="post_service">Post service</option>
          </select>
        </label>
        <label className="block">
          <span className="text-sm font-medium">Note (optional)</span>
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={500}
            className="mt-1 w-full rounded border px-3 py-2"
            disabled={pending}
          />
        </label>
      </div>
      <div>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept="image/jpeg,image/png,image/heic,image/webp"
          onChange={onSelect}
          disabled={pending}
          className="block text-sm"
        />
      </div>
      {progress && <div className="text-sm text-neutral-500">{progress}</div>}
      {err && <div className="text-sm text-danger">{err}</div>}
    </div>
  );
}
