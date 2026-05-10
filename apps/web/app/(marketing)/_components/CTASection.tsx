'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';

export function CTASection() {
  return (
    <section className="relative py-24 sm:py-32">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.5 }}
          className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-[#0E1424] via-[#0B0E14] to-[#0B0E14] px-6 py-16 text-center shadow-[0_30px_120px_-30px_rgba(10,132,255,0.5)] sm:px-10 sm:py-20"
        >
          {/* Animated halo */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 -z-0"
            style={{
              background:
                'radial-gradient(60% 50% at 50% 0%, rgba(10,132,255,0.35), transparent 60%), radial-gradient(40% 40% at 80% 100%, rgba(94,92,230,0.25), transparent 60%)',
            }}
          />
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 -z-0 opacity-[0.06]"
            style={{
              backgroundImage:
                'linear-gradient(rgba(255,255,255,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.6) 1px, transparent 1px)',
              backgroundSize: '32px 32px',
            }}
          />

          <div className="relative">
            <h2 className="mx-auto max-w-2xl text-balance text-3xl font-semibold tracking-tight sm:text-4xl md:text-5xl">
              Run your detailing business like a SaaS company.
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-balance text-base text-white/65 sm:text-lg">
              Setup takes minutes. Bring your own Stripe account, paste in your
              services, and you're taking online bookings the same day.
            </p>

            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link
                href="/signup"
                className="group inline-flex items-center justify-center gap-2 rounded-md bg-white px-5 py-3 text-sm font-medium text-[#06070A] transition-transform hover:-translate-y-[1px]"
              >
                Start your free trial
                <ArrowRight
                  size={16}
                  className="transition-transform group-hover:translate-x-0.5"
                />
              </Link>
              <Link
                href="/contact"
                className="inline-flex items-center justify-center rounded-md border border-white/15 bg-white/[0.04] px-5 py-3 text-sm font-medium text-white/90 hover:bg-white/[0.08]"
              >
                Talk to the founders
              </Link>
            </div>

            <p className="mt-3 text-xs text-white/45">
              14-day trial · No credit card · Cancel anytime
            </p>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
