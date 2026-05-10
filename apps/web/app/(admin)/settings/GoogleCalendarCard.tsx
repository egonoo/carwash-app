'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  disconnectGoogleCalendar,
  startGoogleCalendarConnect,
} from '@/actions/google-calendar';

type Props = {
  connected: boolean;
  email: string | null;
  connectedAt: Date | null;
};

export function GoogleCalendarCard({ connected, email, connectedAt }: Props) {
  const router = useRouter();
  const [err, setErr] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onConnect() {
    setErr(null);
    startTransition(async () => {
      try {
        const { url } = await startGoogleCalendarConnect();
        window.location.href = url;
      } catch (e) {
        setErr((e as Error).message);
      }
    });
  }

  function onDisconnect() {
    if (!confirm('Disconnect Google Calendar?')) return;
    setErr(null);
    startTransition(async () => {
      try {
        await disconnectGoogleCalendar();
        router.refresh();
      } catch (e) {
        setErr((e as Error).message);
      }
    });
  }

  return (
    <div className="rounded border bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold">Google Calendar</h3>
          <p className="mt-1 text-sm text-neutral-600">
            Sync appointments and receive calendar notifications.
          </p>
        </div>
        <span
          className={`rounded-full px-3 py-1 text-xs font-semibold ${
            connected
              ? 'bg-emerald-100 text-emerald-800'
              : 'bg-neutral-100 text-neutral-700'
          }`}
        >
          {connected ? 'Connected' : 'Not connected'}
        </span>
      </div>

      {connected && (
        <dl className="mt-3 grid grid-cols-1 gap-2 text-xs sm:grid-cols-2">
          <div>
            <dt className="text-neutral-500">Account</dt>
            <dd className="mt-0.5 break-all font-medium">{email ?? '—'}</dd>
          </div>
          <div>
            <dt className="text-neutral-500">Connected at</dt>
            <dd className="mt-0.5 font-medium">
              {connectedAt ? new Date(connectedAt).toLocaleString() : '—'}
            </dd>
          </div>
        </dl>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {connected ? (
          <>
            <button
              type="button"
              onClick={onConnect}
              disabled={pending}
              className="rounded border px-3 py-1.5 text-sm hover:bg-neutral-50 disabled:opacity-60"
            >
              {pending ? 'Working…' : 'Reconnect'}
            </button>
            <button
              type="button"
              onClick={onDisconnect}
              disabled={pending}
              className="rounded border border-red-200 px-3 py-1.5 text-sm text-red-700 hover:bg-red-50 disabled:opacity-60"
            >
              Disconnect
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={onConnect}
            disabled={pending}
            className="rounded bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
          >
            {pending ? 'Opening Google…' : 'Connect Google Calendar'}
          </button>
        )}
      </div>

      {err && <p className="mt-2 text-xs text-red-600">{err}</p>}
    </div>
  );
}
