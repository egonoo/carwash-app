'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Menu, X } from 'lucide-react';

const NAV_LINKS = [
  { href: '#features', label: 'Features' },
  { href: '#dashboard', label: 'Dashboard' },
  { href: '#mobile', label: 'Mobile' },
  { href: '#pricing', label: 'Pricing' },
];

export function Nav() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <header className="sticky top-0 z-40">
      <div
        className={`transition-all duration-300 ${
          scrolled
            ? 'border-b border-white/[0.06] bg-[#06070A]/70 backdrop-blur-xl'
            : 'border-b border-transparent'
        }`}
      >
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link href="/" className="flex items-center gap-2">
            <Logo />
            <span className="text-[15px] font-semibold tracking-tight">Splash</span>
          </Link>

          <nav className="hidden items-center gap-8 md:flex">
            {NAV_LINKS.map((l) => (
              <a
                key={l.href}
                href={l.href}
                className="text-sm text-white/70 transition-colors hover:text-white"
              >
                {l.label}
              </a>
            ))}
          </nav>

          <div className="hidden items-center gap-2 md:flex">
            <Link
              href="/login"
              className="rounded-md px-3 py-1.5 text-sm text-white/80 transition-colors hover:text-white"
            >
              Sign in
            </Link>
            <Link
              href="/signup"
              className="rounded-md bg-white px-3.5 py-1.5 text-sm font-medium text-[#06070A] transition-colors hover:bg-white/90"
            >
              Get started
            </Link>
          </div>

          <button
            type="button"
            aria-label="Toggle menu"
            className="rounded-md p-2 text-white/80 hover:bg-white/5 md:hidden"
            onClick={() => setOpen((v) => !v)}
          >
            {open ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>

        <AnimatePresence>
          {open && (
            <motion.div
              key="mobile-nav"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden border-t border-white/[0.06] bg-[#06070A]/95 backdrop-blur-xl md:hidden"
            >
              <div className="mx-auto flex max-w-7xl flex-col gap-1 px-4 py-3">
                {NAV_LINKS.map((l) => (
                  <a
                    key={l.href}
                    href={l.href}
                    onClick={() => setOpen(false)}
                    className="rounded-md px-3 py-2 text-sm text-white/80 hover:bg-white/5"
                  >
                    {l.label}
                  </a>
                ))}
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <Link
                    href="/login"
                    className="rounded-md border border-white/10 px-3 py-2 text-center text-sm text-white/90 hover:bg-white/5"
                  >
                    Sign in
                  </Link>
                  <Link
                    href="/signup"
                    className="rounded-md bg-white px-3 py-2 text-center text-sm font-medium text-[#06070A] hover:bg-white/90"
                  >
                    Get started
                  </Link>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </header>
  );
}

function Logo() {
  return (
    <span
      aria-hidden
      className="grid h-7 w-7 place-items-center rounded-md bg-gradient-to-br from-[#0A84FF] to-[#5E5CE6] text-white shadow-[0_0_24px_-4px_rgba(10,132,255,0.6)]"
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
        <path
          d="M12 3c4 6 7 9 7 13a7 7 0 1 1-14 0c0-4 3-7 7-13Z"
          fill="currentColor"
        />
      </svg>
    </span>
  );
}
