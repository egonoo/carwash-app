'use client';

import { Fragment, useState, useTransition } from 'react';
import { upsertBlock, deleteBlock } from '@/actions/availability';

export type BlockRow = {
  id: string;
  dateLabel: string;
  ymd: string;
  startHHMM: string;
  endHHMM: string;
  timeLabel: string;
  allDay: boolean;
  reason: string | null;
  pastDue: boolean;
};

type FormValues = {
  id?: string;
  date: string;
  allDay: boolean;
  start: string;
  end: string;
  reason: string;
};

function todayInTz(timezone: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

function emptyValues(timezone: string): FormValues {
  return {
    date: todayInTz(timezone),
    allDay: false,
    start: '09:00',
    end: '12:00',
    reason: '',
  };
}

export function BlocksManager({
  rows,
  timezone,
}: {
  rows: BlockRow[];
  timezone: string;
}) {
  const [mode, setMode] = useState<{ kind: 'list' } | { kind: 'edit'; id?: string }>({
    kind: 'list',
  });
  const [values, setValues] = useState<FormValues>(emptyValues(timezone));
  const [error, setError] = useState<string | null>(null);
  const [rowError, setRowError] = useState<Record<string, string | null>>({});
  const [isPending, startTransition] = useTransition();

  function startCreate() {
    setValues(emptyValues(timezone));
    setError(null);
    setMode({ kind: 'edit' });
  }

  function startEdit(row: BlockRow) {
    setValues({
      id: row.id,
      date: row.ymd,
      allDay: row.allDay,
      start: row.startHHMM,
      end: row.endHHMM === '23:59' && row.allDay ? '23:59' : row.endHHMM,
      reason: row.reason ?? '',
    });
    setError(null);
    setMode({ kind: 'edit', id: row.id });
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!values.allDay && values.start >= values.end) {
      setError('End must be after start.');
      return;
    }

    startTransition(async () => {
      try {
        await upsertBlock({
          id: values.id,
          date: values.date,
          allDay: values.allDay,
          start: values.allDay ? undefined : values.start,
          end: values.allDay ? undefined : values.end,
          reason: values.reason || undefined,
        });
        setMode({ kind: 'list' });
      } catch (err: unknown) {
        const msg =
          (err as { details?: { message?: string }; message?: string })?.details?.message ??
          (err instanceof Error ? err.message : 'Failed to save');
        setError(msg);
      }
    });
  }

  function onDelete(row: BlockRow) {
    if (!confirm('Delete this blocked time?')) return;
    setRowError({ ...rowError, [row.id]: null });
    startTransition(async () => {
      try {
        await deleteBlock({ id: row.id });
      } catch (err: unknown) {
        const msg =
          (err as { details?: { message?: string }; message?: string })?.details?.message ??
          (err instanceof Error ? err.message : 'Failed to delete');
        setRowError({ ...rowError, [row.id]: msg });
      }
    });
  }

  return (
    <div className="space-y-4">
      {mode.kind === 'list' && (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={startCreate}
            className="rounded bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700"
          >
            + Add blocked time
          </button>
        </div>
      )}

      {mode.kind === 'edit' && !mode.id && (
        <BlockForm
          values={values}
          setValues={setValues}
          onSubmit={submit}
          onCancel={() => setMode({ kind: 'list' })}
          isPending={isPending}
          error={error}
          isEdit={false}
        />
      )}

      {rows.length === 0 && mode.kind === 'list' && (
        <div className="rounded border border-dashed p-6 text-center text-sm text-neutral-500">
          No blocked time configured.
        </div>
      )}

      {rows.length > 0 && (
        <div className="overflow-hidden rounded border bg-white">
          <table className="w-full text-left text-sm">
            <thead className="bg-neutral-50 text-xs uppercase text-neutral-600">
              <tr>
                <th className="px-3 py-2">Date</th>
                <th className="px-3 py-2">Time</th>
                <th className="px-3 py-2">Reason</th>
                <th className="px-3 py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <Fragment key={row.id}>
                  <tr className={`border-t ${row.pastDue ? 'bg-neutral-50 text-neutral-500' : ''}`}>
                    <td className="px-3 py-2">
                      <div className="font-medium">{row.dateLabel}</div>
                      {row.pastDue && (
                        <div className="text-[10px] uppercase tracking-wide text-neutral-400">
                          past
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-2 text-xs">{row.timeLabel}</td>
                    <td className="px-3 py-2 text-xs">
                      {row.reason ? (
                        row.reason
                      ) : (
                        <span className="text-neutral-400">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <div className="inline-flex gap-2">
                        <button
                          type="button"
                          onClick={() => startEdit(row)}
                          disabled={isPending}
                          className="rounded border px-2 py-1 text-xs hover:bg-neutral-100"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => onDelete(row)}
                          disabled={isPending}
                          className="rounded border border-red-200 px-2 py-1 text-xs text-red-700 hover:bg-red-50 disabled:opacity-60"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                  {rowError[row.id] && (
                    <tr className="border-t bg-red-50">
                      <td colSpan={4} className="px-3 py-1 text-xs text-red-700">
                        {rowError[row.id]}
                      </td>
                    </tr>
                  )}
                  {mode.kind === 'edit' && mode.id === row.id && (
                    <tr className="border-t">
                      <td colSpan={4} className="p-3">
                        <BlockForm
                          values={values}
                          setValues={setValues}
                          onSubmit={submit}
                          onCancel={() => setMode({ kind: 'list' })}
                          isPending={isPending}
                          error={error}
                          isEdit
                        />
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function BlockForm({
  values,
  setValues,
  onSubmit,
  onCancel,
  isPending,
  error,
  isEdit,
}: {
  values: FormValues;
  setValues: (v: FormValues) => void;
  onSubmit: (e: React.FormEvent) => void;
  onCancel: () => void;
  isPending: boolean;
  error: string | null;
  isEdit: boolean;
}) {
  return (
    <form onSubmit={onSubmit} className="space-y-3 rounded border bg-neutral-50 p-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Date" required>
          <input
            type="date"
            required
            value={values.date}
            onChange={(e) => setValues({ ...values, date: e.target.value })}
            className="w-full rounded border px-2 py-1 text-sm"
          />
        </Field>
        <Field label="All day">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={values.allDay}
              onChange={(e) => setValues({ ...values, allDay: e.target.checked })}
            />
            {values.allDay ? 'Blocks the entire day' : 'Specific window'}
          </label>
        </Field>
        <Field label="Start time">
          <input
            type="time"
            value={values.start}
            disabled={values.allDay}
            onChange={(e) => setValues({ ...values, start: e.target.value })}
            className="w-full rounded border px-2 py-1 text-sm disabled:bg-neutral-100 disabled:text-neutral-400"
          />
        </Field>
        <Field label="End time">
          <input
            type="time"
            value={values.end}
            disabled={values.allDay}
            onChange={(e) => setValues({ ...values, end: e.target.value })}
            className="w-full rounded border px-2 py-1 text-sm disabled:bg-neutral-100 disabled:text-neutral-400"
          />
        </Field>
      </div>
      <Field label="Reason" hint="Optional, shown only to admins.">
        <input
          type="text"
          maxLength={200}
          value={values.reason}
          onChange={(e) => setValues({ ...values, reason: e.target.value })}
          placeholder="e.g. Personal appointment"
          className="w-full rounded border px-2 py-1 text-sm"
        />
      </Field>

      {error && <p className="text-xs text-red-600">{error}</p>}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={isPending}
          className="rounded bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
        >
          {isPending ? 'Saving…' : isEdit ? 'Save changes' : 'Create'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded border px-3 py-1.5 text-sm hover:bg-neutral-100"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

function Field({
  label,
  required,
  hint,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-neutral-700">
        {label}
        {required && <span className="text-red-500"> *</span>}
      </span>
      <div className="mt-1">{children}</div>
      {hint && <span className="mt-0.5 block text-[10px] text-neutral-500">{hint}</span>}
    </label>
  );
}
