'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { archiveCustomer, restoreCustomer } from '@/actions/admin-customers';

export function CustomerRowActions({
  customerId,
  archived,
}: {
  customerId: string;
  archived: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  function runArchive() {
    setErr(null);
    startTransition(async () => {
      try {
        await archiveCustomer({ customerId });
        setConfirmOpen(false);
        router.refresh();
      } catch (e) {
        setErr((e as Error).message ?? 'Could not archive this customer.');
      }
    });
  }

  function runRestore() {
    setErr(null);
    startTransition(async () => {
      try {
        await restoreCustomer({ customerId });
        router.refresh();
      } catch (e) {
        setErr((e as Error).message ?? 'Could not restore this customer.');
      }
    });
  }

  if (archived) {
    return (
      <div className="flex flex-col items-end gap-1">
        <button
          type="button"
          className="text-xs font-medium text-[color:var(--brand)] hover:underline disabled:opacity-50"
          onClick={runRestore}
          disabled={pending}
        >
          {pending ? 'Restoring…' : 'Restore'}
        </button>
        {err && <span className="text-[11px] text-danger">{err}</span>}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-end gap-1">
      {!confirmOpen ? (
        <button
          type="button"
          className="text-xs font-medium text-neutral-500 hover:text-danger hover:underline disabled:opacity-50"
          onClick={() => {
            setErr(null);
            setConfirmOpen(true);
          }}
          disabled={pending}
        >
          Archive
        </button>
      ) : (
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="text-xs font-semibold text-danger hover:underline disabled:opacity-50"
            onClick={runArchive}
            disabled={pending}
          >
            {pending ? 'Archiving…' : 'Confirm'}
          </button>
          <button
            type="button"
            className="text-xs text-neutral-500 hover:underline"
            onClick={() => setConfirmOpen(false)}
            disabled={pending}
          >
            Cancel
          </button>
        </div>
      )}
      {err && <span className="text-[11px] text-danger">{err}</span>}
    </div>
  );
}
