'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronDown, LogOut, Settings as SettingsIcon, ShieldCheck } from 'lucide-react';
import { logout } from '@/actions/auth';

type Props = {
  fullName: string | null;
  email: string;
  role: 'owner' | 'admin' | 'staff' | 'readonly';
  isSuperAdmin: boolean;
};

function initials(fullName: string | null, email: string): string {
  const source = (fullName ?? email).trim();
  if (!source) return '?';
  const parts = source.split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0]![0]! + parts[1]![0]!).toUpperCase();
  }
  return source.slice(0, 2).toUpperCase();
}

function roleLabel(role: Props['role'], isSuperAdmin: boolean): string {
  if (isSuperAdmin) return 'Platform admin';
  switch (role) {
    case 'owner':
      return 'Owner';
    case 'admin':
      return 'Admin';
    case 'staff':
      return 'Staff';
    case 'readonly':
      return 'Read only';
  }
}

export function UserMenu({ fullName, email, role, isSuperAdmin }: Props) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  function onLogout() {
    startTransition(async () => {
      try {
        await logout();
      } finally {
        router.replace('/login');
        router.refresh();
      }
    });
  }

  const displayName = fullName?.trim() || email;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-3 rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-left transition hover:bg-white/[0.05]"
      >
        <span
          aria-hidden
          className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-gradient-to-br from-[#0A84FF] to-[#5E5CE6] text-[11px] font-semibold text-white shadow-[0_0_18px_-6px_rgba(10,132,255,0.65)]"
        >
          {initials(fullName, email)}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[12px] font-medium text-white">
            {displayName}
          </span>
          <span className="block truncate text-[10px] uppercase tracking-[0.14em] text-white/40">
            {roleLabel(role, isSuperAdmin)}
          </span>
        </span>
        <ChevronDown
          size={14}
          className={`shrink-0 text-white/40 transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute bottom-full left-0 right-0 mb-2 overflow-hidden rounded-lg border border-white/10 bg-[#0B0D12] shadow-[0_30px_80px_-30px_rgba(0,0,0,0.9)] backdrop-blur-xl"
        >
          <div className="px-3 py-3">
            <div className="truncate text-[12px] font-medium text-white">
              {displayName}
            </div>
            <div className="truncate text-[11px] text-white/50">{email}</div>
            {isSuperAdmin && (
              <div className="mt-2 inline-flex items-center gap-1 rounded-full border border-amber-300/30 bg-amber-300/[0.08] px-2 py-0.5 text-[10px] uppercase tracking-[0.14em] text-amber-200">
                <ShieldCheck size={10} />
                Super admin
              </div>
            )}
          </div>
          <div className="h-px bg-white/[0.06]" />
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              router.push('/settings');
            }}
            className="flex w-full items-center gap-2 px-3 py-2 text-[12px] text-white/80 transition hover:bg-white/[0.04]"
          >
            <SettingsIcon size={14} className="text-white/50" />
            Business settings
          </button>
          <button
            type="button"
            role="menuitem"
            disabled={pending}
            onClick={onLogout}
            className="flex w-full items-center gap-2 px-3 py-2 text-[12px] text-red-200/90 transition hover:bg-red-500/[0.08] disabled:cursor-not-allowed disabled:opacity-60"
          >
            <LogOut size={14} className="text-red-300/80" />
            {pending ? 'Signing out…' : 'Sign out'}
          </button>
        </div>
      )}
    </div>
  );
}
