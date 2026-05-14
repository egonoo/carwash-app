import Link from 'next/link';
import { Github, Twitter, Linkedin } from 'lucide-react';

const COLUMNS: Array<{ title: string; links: { label: string; href: string }[] }> = [
  {
    title: 'Product',
    links: [
      { label: 'Features', href: '#features' },
      { label: 'Dashboard', href: '#dashboard' },
      { label: 'Mobile flow', href: '#mobile' },
      { label: 'Pricing', href: '#pricing' },
      { label: 'Changelog', href: '/changelog' },
    ],
  },
  {
    title: 'Resources',
    links: [
      { label: 'Docs', href: '/docs' },
      { label: 'Help center', href: '/help' },
      { label: 'API reference', href: '/docs/api' },
      { label: 'Status', href: '/status' },
    ],
  },
  {
    title: 'Company',
    links: [
      { label: 'About', href: '/about' },
      { label: 'Customers', href: '/customers-stories' },
      { label: 'Blog', href: '/blog' },
      { label: 'Contact', href: '/contact' },
    ],
  },
  {
    title: 'Legal',
    links: [
      { label: 'Terms', href: '/legal/terms' },
      { label: 'Privacy', href: '/legal/privacy' },
      { label: 'DPA', href: '/legal/dpa' },
      { label: 'Security', href: '/security' },
    ],
  },
];

export function Footer() {
  return (
    <footer className="relative border-t border-white/[0.06] bg-[#06070A]">
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 gap-10 sm:grid-cols-3 md:grid-cols-5">
          {/* Brand column */}
          <div className="col-span-2 sm:col-span-3 md:col-span-1">
            <Link href="/" className="flex items-center gap-2">
              <span
                aria-hidden
                className="grid h-7 w-7 place-items-center rounded-md bg-gradient-to-br from-[#0A84FF] to-[#5E5CE6] text-white"
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
            <p className="mt-4 max-w-xs text-sm text-white/55">
              The mobile car wash operating system — built for the way modern
              detailing teams actually run their business.
            </p>
            <div className="mt-5 flex items-center gap-2">
              <SocialLink href="https://twitter.com" label="Twitter">
                <Twitter size={14} />
              </SocialLink>
              <SocialLink href="https://github.com" label="GitHub">
                <Github size={14} />
              </SocialLink>
              <SocialLink href="https://linkedin.com" label="LinkedIn">
                <Linkedin size={14} />
              </SocialLink>
            </div>
          </div>

          {COLUMNS.map((c) => (
            <div key={c.title}>
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/45">
                {c.title}
              </div>
              <ul className="mt-4 space-y-2.5">
                {c.links.map((l) => (
                  <li key={l.href}>
                    <Link
                      href={l.href as never}
                      className="text-sm text-white/65 transition-colors hover:text-white"
                    >
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 flex flex-col items-start justify-between gap-4 border-t border-white/[0.06] pt-8 sm:flex-row sm:items-center">
          <p className="text-xs text-white/45">
            © {new Date().getFullYear()} Splash Software, Inc. All rights reserved.
          </p>
          <p className="text-xs text-white/40">
            Made for crews on the road. Not affiliated with any vehicle manufacturer.
          </p>
        </div>
      </div>
    </footer>
  );
}

function SocialLink({
  href,
  label,
  children,
}: {
  href: string;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <a
      href={href}
      aria-label={label}
      target="_blank"
      rel="noreferrer"
      className="grid h-8 w-8 place-items-center rounded-md border border-white/10 bg-white/[0.03] text-white/70 transition-colors hover:bg-white/[0.07] hover:text-white"
    >
      {children}
    </a>
  );
}
