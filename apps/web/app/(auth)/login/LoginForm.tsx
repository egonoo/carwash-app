'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight } from 'lucide-react';
import { login } from '@/actions/auth';

export function LoginForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    startTransition(async () => {
      try {
        await login({ email, password });
        router.push('/today');
      } catch (e) {
        setErr((e as Error).message);
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="mt-6 space-y-4">
      <div>
        <label
          htmlFor="email"
          className="text-xs font-medium uppercase tracking-[0.14em] text-white/50"
        >
          Email
        </label>
        <input
          id="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          autoCapitalize="off"
          autoCorrect="off"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="mt-2 h-11 w-full rounded-lg border border-white/10 bg-white/[0.04] px-3 text-[15px] text-white placeholder:text-white/35 focus:border-[#0A84FF] focus:outline-none focus:ring-2 focus:ring-[#0A84FF]/30"
          placeholder="you@business.com"
        />
      </div>
      <div>
        <label
          htmlFor="password"
          className="text-xs font-medium uppercase tracking-[0.14em] text-white/50"
        >
          Password
        </label>
        <input
          id="password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="mt-2 h-11 w-full rounded-lg border border-white/10 bg-white/[0.04] px-3 text-[15px] text-white placeholder:text-white/35 focus:border-[#0A84FF] focus:outline-none focus:ring-2 focus:ring-[#0A84FF]/30"
          placeholder="••••••••"
        />
      </div>
      {err && (
        <div
          role="alert"
          className="rounded-md border border-red-400/30 bg-red-400/[0.08] px-3 py-2 text-xs text-red-200"
        >
          {err}
        </div>
      )}
      <button
        type="submit"
        disabled={pending}
        className="group inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-white text-[15px] font-medium text-[#06070A] transition-transform hover:-translate-y-[1px] disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0"
      >
        {pending ? 'Signing in…' : 'Sign in'}
        {!pending && (
          <ArrowRight
            size={16}
            className="transition-transform group-hover:translate-x-0.5"
          />
        )}
      </button>
    </form>
  );
}
