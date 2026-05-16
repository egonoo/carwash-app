'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import {
  Calendar,
  ChevronLeft,
  CircleDot,
  Home,
  LayoutGrid,
  MapPin,
  Menu,
  Package,
  Settings,
  Sparkles,
  Star,
  Tag,
  Users,
  Wallet,
  type LucideIcon,
} from 'lucide-react';
import { UserMenu } from './UserMenu';

type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
};

const ITEMS: NavItem[] = [
  { href: '/today', label: 'Today', icon: Home },
  { href: '/dashboard', label: 'Dashboard', icon: LayoutGrid },
  { href: '/schedule', label: 'Schedule', icon: Calendar },
  { href: '/appointments', label: 'Appointments', icon: CircleDot },
  { href: '/bookings', label: 'Bookings', icon: Sparkles },
  { href: '/customers', label: 'Customers', icon: Users },
  { href: '/packages', label: 'Packages', icon: Package },
  { href: '/addons', label: 'Add-ons', icon: Tag },
  { href: '/zones', label: 'Zones', icon: MapPin },
  { href: '/availability', label: 'Availability', icon: Calendar },
  { href: '/payments', label: 'Payments', icon: Wallet },
];

export type SidebarUser = {
  fullName: string | null;
  email: string;
  role: 'owner' | 'admin' | 'staff' | 'readonly';
  isSuperAdmin: boolean;
};

export function Sidebar({
  businessName,
  loyaltyEnabled,
  user,
}: {
  businessName: string;
  loyaltyEnabled: boolean;
  user: SidebarUser;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const items: NavItem[] = [
    ...ITEMS,
    ...(loyaltyEnabled ? [{ href: '/loyalty', label: 'Loyalty', icon: Star }] : []),
    { href: '/settings', label: 'Settings', icon: Settings },
  ];

  function isActive(href: string) {
    if (!pathname) return false;
    return pathname === href || pathname.startsWith(`${href}/`);
  }

  return (
    <>
      {/* Mobile top bar */}
      <div className="admin-sidebar sticky top-0 z-30 flex items-center justify-between border-b px-4 py-3 lg:hidden">
        <div className="flex items-center gap-2">
          <Logo />
          <span className="text-[13px] font-semibold tracking-tight text-white">
            {businessName}
          </span>
        </div>
        <button
          type="button"
          aria-label="Toggle navigation"
          onClick={() => setOpen((v) => !v)}
          className="grid h-8 w-8 place-items-center rounded-md border border-white/10 bg-white/[0.03] text-white/80"
        >
          {open ? <ChevronLeft size={16} /> : <Menu size={16} />}
        </button>
      </div>

      {/* Sidebar */}
      <aside
        className={`admin-sidebar fixed inset-y-0 left-0 z-20 w-64 transform border-r transition-transform duration-200 lg:sticky lg:top-0 lg:h-screen lg:translate-x-0 ${
          open ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        <div className="flex h-full flex-col">
          <div className="border-b border-white/[0.06] px-4 py-4">
            <Link href="/today" className="flex items-center gap-2">
              <Logo />
              <div className="min-w-0">
                <div className="truncate text-[13px] font-semibold tracking-tight text-white">
                  {businessName}
                </div>
                <div className="text-[10px] uppercase tracking-[0.18em] text-white/40">
                  Splash Admin
                </div>
              </div>
            </Link>
          </div>

          <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-3">
            {items.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href as never}
                  onClick={() => setOpen(false)}
                  data-active={active}
                  className="nav-link"
                >
                  <Icon size={15} className="nav-icon" />
                  <span className="truncate">{item.label}</span>
                </Link>
              );
            })}
          </nav>

          <div className="border-t border-white/[0.06] px-3 py-3">
            <UserMenu
              fullName={user.fullName}
              email={user.email}
              role={user.role}
              isSuperAdmin={user.isSuperAdmin}
            />
            <div className="mt-2 flex items-center gap-2 px-1 text-[11px] text-white/40">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)]" />
              All systems operational
            </div>
          </div>
        </div>
      </aside>

      {/* Backdrop for mobile drawer */}
      {open && (
        <div
          aria-hidden
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-10 bg-black/60 backdrop-blur-sm lg:hidden"
        />
      )}
    </>
  );
}

function Logo() {
  return (
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
  );
}

