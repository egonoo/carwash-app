'use client';

import { motion } from 'framer-motion';
import {
  Calendar,
  CarFront,
  CheckCircle2,
  CircleDot,
  CreditCard,
  Home,
  Image as ImageIcon,
  LayoutGrid,
  MapPin,
  Settings,
  Star,
  TrendingUp,
  Users,
  Wallet,
} from 'lucide-react';

/**
 * Static, pixel-detailed admin dashboard mockup. Pure CSS — no real data.
 * Used in the hero and dashboard showcase sections.
 */
export function DashboardMockup() {
  return (
    <div className="grid grid-cols-[200px_1fr] bg-[#0B0E14] text-white/90">
      {/* Sidebar */}
      <aside className="hidden border-r border-white/[0.06] bg-[#080A10] p-3 sm:block">
        <div className="px-2 pb-3 text-[11px] uppercase tracking-wider text-white/40">
          Pacific Detail Co.
        </div>
        <SideItem icon={<Home size={14} />} label="Today" />
        <SideItem icon={<LayoutGrid size={14} />} label="Dashboard" active />
        <SideItem icon={<Calendar size={14} />} label="Schedule" />
        <SideItem icon={<CircleDot size={14} />} label="Appointments" />
        <SideItem icon={<Users size={14} />} label="Customers" />
        <SideItem icon={<CarFront size={14} />} label="Vehicles" />
        <SideItem icon={<MapPin size={14} />} label="Zones" />
        <SideItem icon={<Wallet size={14} />} label="Payments" />
        <SideItem icon={<Star size={14} />} label="Loyalty" />
        <SideItem icon={<Settings size={14} />} label="Settings" />
      </aside>

      {/* Body */}
      <div className="p-4 sm:p-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold sm:text-base">Today</h3>
            <p className="text-xs text-white/50">Tuesday · May 12 · 5 jobs scheduled</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="hidden rounded-md border border-emerald-400/20 bg-emerald-400/10 px-2 py-1 text-[10px] text-emerald-300 sm:inline">
              Stripe connected
            </span>
            <span className="rounded-md border border-white/10 bg-white/[0.03] px-2 py-1 text-[10px] text-white/70">
              Live
            </span>
          </div>
        </div>

        {/* KPIs */}
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Kpi label="Bookings (7d)" value="142" trend="+18%" tone="up" />
          <Kpi label="Revenue (7d)" value="$8,420" trend="+12%" tone="up" />
          <Kpi label="No-show rate" value="1.4%" trend="−0.6%" tone="down" />
          <Kpi label="Avg. ticket" value="$59" trend="+$3" tone="up" />
        </div>

        {/* Two columns: schedule + revenue chart */}
        <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-3">
          {/* Schedule */}
          <div className="lg:col-span-2 rounded-lg border border-white/[0.06] bg-[#0E1219]">
            <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-3">
              <div className="text-xs font-semibold tracking-wide text-white/80">
                Today's route
              </div>
              <div className="text-[10px] text-white/40">Pasadena → Downey → Local</div>
            </div>
            <ul className="divide-y divide-white/[0.05]">
              <Job
                time="08:30"
                customer="J. Mendoza"
                vehicle="2022 Honda Civic"
                addon="Premium Wax"
                status="confirmed"
                amount="$95"
              />
              <Job
                time="10:00"
                customer="A. Patel"
                vehicle="2024 Tesla Model Y"
                addon="Interior Detail"
                status="on_the_way"
                amount="$140"
              />
              <Job
                time="11:45"
                customer="R. Liu"
                vehicle="2021 Ford F-150"
                addon="Standard Wash"
                status="arrived"
                amount="$65"
              />
              <Job
                time="14:00"
                customer="S. Walker"
                vehicle="2023 BMW iX"
                addon="Ceramic Refresh"
                status="in_progress"
                amount="$210"
              />
              <Job
                time="16:30"
                customer="K. Adebayo"
                vehicle="2020 Subaru Outback"
                addon="Premium Wax"
                status="confirmed"
                amount="$110"
              />
            </ul>
          </div>

          {/* Revenue + recent activity */}
          <div className="space-y-3">
            <div className="rounded-lg border border-white/[0.06] bg-[#0E1219] p-4">
              <div className="flex items-center justify-between">
                <div className="text-xs font-semibold tracking-wide text-white/80">
                  Revenue
                </div>
                <span className="text-[10px] text-white/40">Last 14 days</span>
              </div>
              <RevenueChart />
              <div className="mt-3 flex items-center justify-between text-[11px] text-white/60">
                <span>$16,910 collected</span>
                <span className="inline-flex items-center gap-1 text-emerald-300">
                  <TrendingUp size={11} /> +14%
                </span>
              </div>
            </div>

            <div className="rounded-lg border border-white/[0.06] bg-[#0E1219]">
              <div className="border-b border-white/[0.06] px-4 py-2 text-xs font-semibold text-white/80">
                Recent activity
              </div>
              <ul className="divide-y divide-white/[0.05] text-[11px]">
                <Activity
                  icon={<CreditCard size={11} className="text-emerald-300" />}
                  text="Deposit captured · $20"
                  meta="J. Mendoza · 2m"
                />
                <Activity
                  icon={<ImageIcon size={11} className="text-sky-300" />}
                  text="Pre-service photos · 4"
                  meta="A. Patel · 8m"
                />
                <Activity
                  icon={<CheckCircle2 size={11} className="text-emerald-300" />}
                  text="Loyalty reward unlocked"
                  meta="R. Liu · 23m"
                />
                <Activity
                  icon={<Star size={11} className="text-amber-300" />}
                  text="5-star review left"
                  meta="K. Adebayo · 1h"
                />
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function SideItem({
  icon,
  label,
  active,
}: {
  icon: React.ReactNode;
  label: string;
  active?: boolean;
}) {
  return (
    <div
      className={`mb-0.5 flex items-center gap-2 rounded-md px-2 py-1.5 text-[12px] ${
        active
          ? 'bg-white/[0.06] text-white'
          : 'text-white/60 hover:bg-white/[0.03]'
      }`}
    >
      <span className={active ? 'text-white' : 'text-white/50'}>{icon}</span>
      {label}
    </div>
  );
}

function Kpi({
  label,
  value,
  trend,
  tone,
}: {
  label: string;
  value: string;
  trend: string;
  tone: 'up' | 'down';
}) {
  return (
    <div className="rounded-lg border border-white/[0.06] bg-[#0E1219] px-3 py-2.5">
      <div className="text-[10px] uppercase tracking-wide text-white/40">{label}</div>
      <div className="mt-1 text-base font-semibold sm:text-lg">{value}</div>
      <div
        className={`mt-0.5 text-[10px] ${
          tone === 'up' ? 'text-emerald-300' : 'text-rose-300'
        }`}
      >
        {trend} vs last week
      </div>
    </div>
  );
}

const STATUS_STYLES: Record<
  string,
  { label: string; cls: string; dot: string }
> = {
  confirmed: {
    label: 'Confirmed',
    cls: 'bg-sky-400/10 text-sky-300 border-sky-400/20',
    dot: 'bg-sky-400',
  },
  on_the_way: {
    label: 'On the way',
    cls: 'bg-violet-400/10 text-violet-300 border-violet-400/20',
    dot: 'bg-violet-400',
  },
  arrived: {
    label: 'Arrived',
    cls: 'bg-amber-400/10 text-amber-300 border-amber-400/20',
    dot: 'bg-amber-400',
  },
  in_progress: {
    label: 'In progress',
    cls: 'bg-emerald-400/10 text-emerald-300 border-emerald-400/20',
    dot: 'bg-emerald-400',
  },
};

function Job({
  time,
  customer,
  vehicle,
  addon,
  status,
  amount,
}: {
  time: string;
  customer: string;
  vehicle: string;
  addon: string;
  status: keyof typeof STATUS_STYLES;
  amount: string;
}) {
  const s = STATUS_STYLES[status]!;
  return (
    <li className="flex items-center gap-3 px-4 py-3">
      <div className="w-12 text-[11px] tabular-nums text-white/50">{time}</div>
      <div className="flex-1 min-w-0">
        <div className="truncate text-[12px] font-medium text-white">
          {customer} · <span className="text-white/60">{vehicle}</span>
        </div>
        <div className="truncate text-[10px] text-white/40">{addon}</div>
      </div>
      <span
        className={`hidden items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] sm:inline-flex ${s.cls}`}
      >
        <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />
        {s.label}
      </span>
      <div className="w-12 text-right text-[11px] font-medium tabular-nums text-white/80">
        {amount}
      </div>
    </li>
  );
}

function Activity({
  icon,
  text,
  meta,
}: {
  icon: React.ReactNode;
  text: string;
  meta: string;
}) {
  return (
    <li className="flex items-center gap-2 px-4 py-2">
      <span className="grid h-5 w-5 place-items-center rounded-md bg-white/[0.04]">
        {icon}
      </span>
      <span className="flex-1 truncate text-white/80">{text}</span>
      <span className="text-[10px] text-white/40">{meta}</span>
    </li>
  );
}

function RevenueChart() {
  // Static SVG sparkline — no data, no animation cost
  const points = [
    20, 24, 22, 30, 28, 36, 34, 42, 40, 50, 48, 58, 64, 72,
  ];
  const max = Math.max(...points);
  const w = 220;
  const h = 60;
  const step = w / (points.length - 1);
  const path = points
    .map((p, i) => {
      const x = i * step;
      const y = h - (p / max) * (h - 6) - 3;
      return `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(' ');
  const area = `${path} L ${w} ${h} L 0 ${h} Z`;
  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      className="mt-3 h-[60px] w-full"
      preserveAspectRatio="none"
    >
      <defs>
        <linearGradient id="revGrad" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="#0A84FF" stopOpacity="0.5" />
          <stop offset="100%" stopColor="#0A84FF" stopOpacity="0" />
        </linearGradient>
      </defs>
      <motion.path
        d={area}
        fill="url(#revGrad)"
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6 }}
      />
      <motion.path
        d={path}
        fill="none"
        stroke="#5EB1FF"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={{ pathLength: 0 }}
        whileInView={{ pathLength: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 1.2, ease: 'easeOut' }}
      />
    </svg>
  );
}
