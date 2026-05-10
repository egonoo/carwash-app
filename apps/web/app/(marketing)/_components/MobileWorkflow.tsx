'use client';

import { motion } from 'framer-motion';
import {
  Camera,
  Car,
  CheckCircle2,
  ChevronRight,
  Clock,
  CreditCard,
  MapPin,
} from 'lucide-react';
import { SectionHeader } from './FeaturesGrid';

const STEPS = [
  {
    title: 'Pick a zone',
    desc: 'The customer\'s ZIP auto-detects the right service area, fee, and travel time — only available zones are offered.',
  },
  {
    title: 'Choose a real slot',
    desc: 'Working hours, breaks, blocked time, and existing jobs are all respected. No double-booking, no manual back-and-forth.',
  },
  {
    title: 'Hold the slot with a deposit',
    desc: 'A $20 deposit captures via Stripe Connect to your business. Refunded automatically if the customer reschedules in time.',
  },
  {
    title: 'Wash, photograph, get paid',
    desc: 'Crew progresses the appointment through On the way → Arrived → In progress → Completed. Photos and final payment in one place.',
  },
];

export function MobileWorkflow() {
  return (
    <section id="mobile" className="relative overflow-hidden py-24 sm:py-32">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-1/3 -z-10 mx-auto h-[480px] max-w-5xl blur-3xl"
        style={{
          background:
            'radial-gradient(closest-side, rgba(94,92,230,0.25), transparent)',
        }}
      />
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionHeader
          eyebrow="From your phone"
          title="Built mobile-first, end to end"
          sub="The customer-facing booking flow and the crew-facing admin both live on a phone. Everything you need on the road, nothing you don't."
        />

        <div className="mt-16 grid gap-12 lg:grid-cols-[1.2fr_1fr] lg:items-center">
          {/* Phones — three on md+, one centered on mobile */}
          <div className="relative mx-auto flex h-[560px] w-full max-w-[680px] items-center justify-center">
            <Phone
              tilt={-8}
              translateY={20}
              z={1}
              className="absolute left-0 hidden md:block md:left-4"
            >
              <BookingScreen />
            </Phone>
            <Phone tilt={0} translateY={-10} z={2} className="relative">
              <ConfirmationScreen />
            </Phone>
            <Phone
              tilt={8}
              translateY={20}
              z={1}
              className="absolute right-0 hidden md:block md:right-4"
            >
              <CrewScreen />
            </Phone>
          </div>

          {/* Steps */}
          <ol className="space-y-5">
            {STEPS.map((s, i) => (
              <motion.li
                key={s.title}
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-80px' }}
                transition={{ duration: 0.4, delay: i * 0.06 }}
                className="flex gap-4"
              >
                <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full border border-white/10 bg-white/[0.04] text-xs font-medium text-white/80">
                  {i + 1}
                </span>
                <div>
                  <div className="text-[15px] font-semibold">{s.title}</div>
                  <div className="mt-1 text-sm leading-relaxed text-white/60">
                    {s.desc}
                  </div>
                </div>
              </motion.li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}

function Phone({
  children,
  tilt = 0,
  translateY = 0,
  z = 1,
  className = '',
}: {
  children: React.ReactNode;
  tilt?: number;
  translateY?: number;
  z?: number;
  className?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 30, rotate: tilt }}
      whileInView={{ opacity: 1, y: translateY, rotate: tilt }}
      viewport={{ once: true, margin: '-100px' }}
      transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
      style={{ zIndex: z }}
      className={`h-[520px] w-[260px] ${className}`}
    >
      <div className="relative h-full w-full rounded-[2.4rem] border border-white/15 bg-gradient-to-br from-[#15171F] to-[#0A0C12] p-2 shadow-[0_30px_80px_-30px_rgba(10,132,255,0.5)]">
        {/* Notch */}
        <div className="absolute left-1/2 top-2 z-10 h-5 w-24 -translate-x-1/2 rounded-full bg-black" />
        <div className="h-full w-full overflow-hidden rounded-[2rem] border border-white/[0.06] bg-[#0B0E14]">
          {children}
        </div>
      </div>
    </motion.div>
  );
}

/* ------------------------------ Phone screens ----------------------------- */

function BookingScreen() {
  return (
    <div className="flex h-full flex-col bg-[#0B0E14] p-3 pt-6 text-white/90">
      <div className="px-1 pt-2 text-[10px] uppercase tracking-wider text-white/40">
        Pacific Detail Co.
      </div>
      <div className="px-1 text-[15px] font-semibold">Book a wash</div>

      <div className="mt-3 rounded-lg border border-white/[0.06] bg-white/[0.02] p-2.5">
        <div className="flex items-center gap-2 text-[10px] text-white/50">
          <MapPin size={11} className="text-[#5EB1FF]" />
          Pasadena · 91101
        </div>
        <div className="mt-0.5 text-[12px] font-medium">
          Auto-detected zone · $0 fee
        </div>
      </div>

      <div className="mt-3 px-1 text-[10px] uppercase tracking-wider text-white/40">
        Available times · Sat May 17
      </div>
      <div className="mt-1 grid grid-cols-3 gap-1.5">
        {[
          ['8:00', true],
          ['8:30', true],
          ['9:00', false],
          ['9:30', false],
          ['10:00', true],
          ['10:30', true],
          ['11:00', true],
          ['11:30', true],
          ['12:00', false],
        ].map(([t, ok], i) => (
          <div
            key={i}
            className={`rounded-md py-2 text-center text-[11px] font-medium ${
              t === '10:00'
                ? 'bg-[#0A84FF] text-white'
                : ok
                  ? 'border border-white/10 bg-white/[0.03] text-white/80'
                  : 'border border-white/[0.04] bg-white/[0.01] text-white/30 line-through'
            }`}
          >
            {t as string}
          </div>
        ))}
      </div>

      <div className="mt-3 px-1 text-[10px] uppercase tracking-wider text-white/40">
        Service
      </div>
      <div className="mt-1 space-y-1.5">
        <ServiceRow label="Premium Wash" price="$59" duration="45 min" selected />
        <ServiceRow label="Interior Detail" price="+$45" duration="30 min" />
        <ServiceRow label="Ceramic Refresh" price="+$120" duration="60 min" />
      </div>

      <button className="mt-auto rounded-md bg-white py-2.5 text-center text-[12px] font-semibold text-[#06070A]">
        Continue
      </button>
    </div>
  );
}

function ServiceRow({
  label,
  price,
  duration,
  selected,
}: {
  label: string;
  price: string;
  duration: string;
  selected?: boolean;
}) {
  return (
    <div
      className={`flex items-center justify-between rounded-md px-2.5 py-2 ${
        selected
          ? 'border border-[#0A84FF]/40 bg-[#0A84FF]/[0.08]'
          : 'border border-white/[0.06] bg-white/[0.02]'
      }`}
    >
      <div>
        <div className="text-[11px] font-medium">{label}</div>
        <div className="mt-0.5 flex items-center gap-1 text-[9px] text-white/50">
          <Clock size={9} /> {duration}
        </div>
      </div>
      <div className="text-[11px] font-semibold tabular-nums">{price}</div>
    </div>
  );
}

function ConfirmationScreen() {
  return (
    <div className="flex h-full flex-col bg-[#0B0E14] p-3 pt-7 text-white/90">
      <div className="grid place-items-center pt-2">
        <span className="grid h-10 w-10 place-items-center rounded-full bg-emerald-400/15 text-emerald-300">
          <CheckCircle2 size={18} />
        </span>
      </div>
      <div className="mt-3 text-center">
        <div className="text-[15px] font-semibold">You're booked</div>
        <div className="mt-0.5 text-[10px] text-white/50">
          We sent you a confirmation by email and SMS
        </div>
      </div>

      <div className="mt-4 rounded-lg border border-white/[0.06] bg-white/[0.02] p-3">
        <div className="text-[10px] uppercase tracking-wider text-white/40">
          Saturday · May 17 · 10:00 AM
        </div>
        <div className="mt-1 text-[13px] font-semibold">Premium Wash</div>
        <div className="mt-0.5 flex items-center gap-1.5 text-[10px] text-white/50">
          <Car size={11} /> 2024 Tesla Model Y · Pearl White
        </div>
        <div className="mt-3 flex items-center justify-between border-t border-white/[0.06] pt-2 text-[11px]">
          <span className="text-white/60">Deposit</span>
          <span className="font-semibold tabular-nums">$20.00</span>
        </div>
        <div className="flex items-center justify-between text-[11px]">
          <span className="text-white/60">Due on service</span>
          <span className="font-semibold tabular-nums">$39.00</span>
        </div>
      </div>

      <div className="mt-3 rounded-lg border border-emerald-400/20 bg-emerald-400/[0.06] p-2.5">
        <div className="flex items-center gap-2 text-[10px] text-emerald-300">
          <CreditCard size={11} /> Deposit captured · Stripe
        </div>
        <div className="mt-1 text-[11px] text-white/80">
          Pacific Detail Co. ····5582
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-1.5">
        <button className="rounded-md border border-white/10 bg-white/[0.03] py-2 text-[11px] font-medium text-white/80">
          Reschedule
        </button>
        <button className="rounded-md bg-white py-2 text-[11px] font-semibold text-[#06070A]">
          Add to calendar
        </button>
      </div>
    </div>
  );
}

function CrewScreen() {
  return (
    <div className="flex h-full flex-col bg-[#0B0E14] p-3 pt-6 text-white/90">
      <div className="flex items-center justify-between px-1">
        <div className="text-[10px] uppercase tracking-wider text-white/40">
          Crew · Today
        </div>
        <span className="rounded-full border border-emerald-400/20 bg-emerald-400/[0.08] px-1.5 py-0.5 text-[9px] text-emerald-300">
          Live
        </span>
      </div>

      <div className="mt-2 rounded-lg border border-white/[0.06] bg-white/[0.02] p-3">
        <div className="text-[10px] uppercase tracking-wider text-white/40">
          Up next · 10:00 AM
        </div>
        <div className="mt-1 text-[13px] font-semibold">A. Patel</div>
        <div className="text-[10px] text-white/50">
          2024 Tesla Model Y · Pasadena
        </div>
        <div className="mt-2 flex items-center justify-between text-[11px]">
          <span className="text-white/60">Service</span>
          <span className="font-medium">Premium Wash</span>
        </div>
        <div className="flex items-center justify-between text-[11px]">
          <span className="text-white/60">Travel</span>
          <span className="font-medium">12 min · Pasadena</span>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-1.5">
          <button className="rounded-md bg-[#0A84FF] py-1.5 text-[11px] font-semibold">
            On the way
          </button>
          <button className="rounded-md border border-white/10 bg-white/[0.03] py-1.5 text-[11px] font-medium text-white/80">
            Open route
          </button>
        </div>
      </div>

      <div className="mt-3 px-1 text-[10px] uppercase tracking-wider text-white/40">
        Capture
      </div>
      <div className="mt-1 grid grid-cols-3 gap-1.5">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div
            key={i}
            className="grid aspect-square place-items-center rounded-md border border-white/[0.06] bg-gradient-to-br from-white/[0.04] to-white/[0.01] text-white/30"
          >
            {i === 1 ? <Camera size={12} /> : null}
          </div>
        ))}
      </div>

      <div className="mt-3 rounded-lg border border-white/[0.06] bg-white/[0.02] p-2.5">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-medium">Final payment</span>
          <span className="text-[11px] font-semibold tabular-nums">$39.00</span>
        </div>
        <button className="mt-2 flex w-full items-center justify-center gap-1 rounded-md bg-white py-2 text-[11px] font-semibold text-[#06070A]">
          Take payment <ChevronRight size={12} />
        </button>
      </div>
    </div>
  );
}
