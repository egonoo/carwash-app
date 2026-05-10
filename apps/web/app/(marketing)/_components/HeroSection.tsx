'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { ArrowRight, Sparkles } from 'lucide-react';
import { DashboardMockup } from './DashboardMockup';

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0 },
};

const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08, delayChildren: 0.05 } },
};

export function HeroSection() {
  return (
    <section className="relative pt-20 sm:pt-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <motion.div
          initial="hidden"
          animate="show"
          variants={stagger}
          className="mx-auto max-w-3xl text-center"
        >
          <motion.div variants={fadeUp} className="flex justify-center">
            <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs text-white/70">
              <Sparkles size={12} className="text-[#5EB1FF]" />
              Now in private beta — onboarding 50 detailing teams
            </span>
          </motion.div>

          <motion.h1
            variants={fadeUp}
            className="mt-6 text-4xl font-semibold tracking-tight sm:text-5xl md:text-6xl lg:text-[68px] lg:leading-[1.05]"
          >
            The mobile car wash{' '}
            <span className="bg-gradient-to-r from-white via-white to-[#5EB1FF] bg-clip-text text-transparent">
              operating system.
            </span>
          </motion.h1>

          <motion.p
            variants={fadeUp}
            className="mx-auto mt-6 max-w-2xl text-balance text-lg text-white/70 sm:text-xl"
          >
            Splash gives mobile detailing teams a single platform for bookings,
            deposits, routes, loyalty, and photo evidence — purpose-built for
            crews running their business from a phone.
          </motion.p>

          <motion.div
            variants={fadeUp}
            className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row"
          >
            <Link
              href="/signup"
              className="group inline-flex items-center justify-center gap-2 rounded-md bg-white px-5 py-3 text-sm font-medium text-[#06070A] shadow-[0_8px_30px_-12px_rgba(255,255,255,0.4)] transition-transform hover:-translate-y-[1px]"
            >
              Start your free trial
              <ArrowRight
                size={16}
                className="transition-transform group-hover:translate-x-0.5"
              />
            </Link>
            <Link
              href="#dashboard"
              className="inline-flex items-center justify-center rounded-md border border-white/15 bg-white/[0.03] px-5 py-3 text-sm font-medium text-white/90 backdrop-blur-sm transition-colors hover:bg-white/[0.06]"
            >
              See it in action
            </Link>
          </motion.div>

          <motion.p
            variants={fadeUp}
            className="mt-4 text-xs text-white/45"
          >
            No credit card required · 14-day trial · Cancel anytime
          </motion.p>
        </motion.div>

        {/* Hero mockup */}
        <motion.div
          initial={{ opacity: 0, y: 32, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.7, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
          className="relative mx-auto mt-16 max-w-6xl"
        >
          {/* Glow */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 -z-10 blur-3xl"
            style={{
              background:
                'radial-gradient(60% 60% at 50% 50%, rgba(10,132,255,0.35), transparent 70%)',
            }}
          />
          <div className="relative rounded-2xl border border-white/10 bg-[#0B0E14]/80 p-2 shadow-[0_30px_120px_-30px_rgba(10,132,255,0.4)] backdrop-blur-sm">
            <div className="overflow-hidden rounded-xl border border-white/[0.06]">
              <DashboardMockup />
            </div>
          </div>
        </motion.div>

        {/* Logos / trust strip */}
        <div className="mt-16 flex flex-col items-center gap-6">
          <p className="text-xs uppercase tracking-[0.2em] text-white/40">
            Trusted by mobile detailing teams across the country
          </p>
          <div className="grid w-full max-w-3xl grid-cols-3 items-center gap-6 sm:grid-cols-6">
            {[
              'Pacific Detail Co.',
              'Mirror Mobile',
              'ShineRoute',
              'CrewWash',
              'Clarity Auto',
              'Ridgeway Detail',
            ].map((name) => (
              <div
                key={name}
                className="text-center text-xs font-medium text-white/40 sm:text-sm"
              >
                {name}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
