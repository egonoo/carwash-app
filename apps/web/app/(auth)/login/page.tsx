import Link from 'next/link';
import { LoginForm } from './LoginForm';

export default function LoginPage() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-[#06070A] text-white">
      {/* Ambient brand glow + grid — same vocabulary as marketing */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background:
            'radial-gradient(900px 500px at 50% -10%, rgba(10,132,255,0.20), transparent 60%), radial-gradient(700px 400px at 90% 110%, rgba(94,92,230,0.14), transparent 60%), #06070A',
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 opacity-[0.04]"
        style={{
          backgroundImage:
            'linear-gradient(rgba(255,255,255,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.6) 1px, transparent 1px)',
          backgroundSize: '64px 64px',
        }}
      />

      <div className="flex min-h-screen flex-col">
        <header className="px-4 py-5 sm:px-6 lg:px-8">
          <Link href="/" className="inline-flex items-center gap-2">
            <span
              aria-hidden
              className="grid h-7 w-7 place-items-center rounded-md bg-gradient-to-br from-[#0A84FF] to-[#5E5CE6] text-white shadow-[0_0_18px_-4px_rgba(10,132,255,0.6)]"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
                <path
                  d="M12 3c4 6 7 9 7 13a7 7 0 1 1-14 0c0-4 3-7 7-13Z"
                  fill="currentColor"
                />
              </svg>
            </span>
            <span className="text-[15px] font-semibold tracking-tight">Splash</span>
          </Link>
        </header>

        <div className="flex flex-1 items-center justify-center px-4 py-8 sm:px-6">
          <div className="w-full max-w-sm">
            <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-6 shadow-[0_30px_120px_-40px_rgba(10,132,255,0.45)] backdrop-blur-xl sm:p-8">
              <h1 className="text-2xl font-semibold tracking-tight">Welcome back</h1>
              <p className="mt-1 text-sm text-white/55">
                Sign in to your Splash admin panel.
              </p>
              <LoginForm />
            </div>
            <p className="mt-6 text-center text-xs text-white/45">
              Don't have an account yet?{' '}
              <Link href="/signup" className="text-white/85 underline-offset-2 hover:underline">
                Get started
              </Link>
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
