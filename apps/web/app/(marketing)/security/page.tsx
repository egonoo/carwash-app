import type { Metadata } from 'next';
import Link from 'next/link';
import {
  AlertTriangle,
  CreditCard,
  Database,
  KeyRound,
  Lock,
  Network,
  ScrollText,
  ShieldCheck,
  UserCheck,
} from 'lucide-react';
import { GlassCard, PageHero, PageSection } from '../_components/PageHero';

export const metadata: Metadata = {
  title: 'Security — Splash',
  description:
    'How Splash protects customer data, payments, and photos — from infrastructure to access controls.',
};

const PILLARS = [
  {
    icon: Lock,
    title: 'Encryption everywhere',
    desc: 'TLS 1.2+ in transit. Data at rest encrypted with AES-256. Database backups encrypted and access-controlled.',
  },
  {
    icon: KeyRound,
    title: 'Strong authentication',
    desc: 'Argon2id password hashing. Session tokens are signed and short-lived. SSO and 2FA on the roadmap for Pro and Scale.',
  },
  {
    icon: UserCheck,
    title: 'Least-privilege access',
    desc: 'Production access is limited to a small on-call group. All access is logged and reviewed.',
  },
  {
    icon: Database,
    title: 'Tenant isolation',
    desc: 'Every query is scoped by business id at the application layer. Customer A cannot read or write customer B\'s data.',
  },
  {
    icon: CreditCard,
    title: 'PCI scope minimized',
    desc: 'Payment card data flows directly to Stripe. Splash never sees full PANs and is not in PCI scope for cardholder storage.',
  },
  {
    icon: Network,
    title: 'Hardened headers',
    desc: 'HSTS preload, X-Frame-Options DENY, strict referrer policy, and tight permissions policy applied to every response.',
  },
  {
    icon: ScrollText,
    title: 'Audit logging',
    desc: 'Sensitive admin actions are logged with actor, IP, and timestamp for forensic investigation.',
  },
  {
    icon: ShieldCheck,
    title: 'Secure development',
    desc: 'Mandatory code review, automated dependency scanning, and a private security review before every major release.',
  },
];

export default function SecurityPage() {
  return (
    <>
      <PageHero
        eyebrow="Security"
        title={
          <>
            Built so the boring{' '}
            <span className="bg-gradient-to-r from-white via-white to-[#5EB1FF] bg-clip-text text-transparent">
              never becomes the news.
            </span>
          </>
        }
        description="Splash handles customer details, photos, and payments. We treat that responsibility seriously and design defensively at every layer."
      />

      <PageSection>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {PILLARS.map((p) => (
            <div
              key={p.title}
              className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-6"
            >
              <div className="grid h-9 w-9 place-items-center rounded-md border border-white/10 bg-white/[0.04] text-white/90">
                <p.icon size={16} />
              </div>
              <h3 className="mt-5 text-[15px] font-semibold tracking-tight">
                {p.title}
              </h3>
              <p className="mt-1.5 text-sm leading-relaxed text-white/60">
                {p.desc}
              </p>
            </div>
          ))}
        </div>
      </PageSection>

      <PageSection className="!pt-0">
        <div className="grid gap-6 lg:grid-cols-2">
          <GlassCard>
            <h2 className="text-xl font-semibold tracking-tight">
              Infrastructure
            </h2>
            <ul className="mt-4 space-y-3 text-[15px] leading-relaxed text-white/70">
              <li>Hosted on a major cloud provider with SOC 2 Type II controls.</li>
              <li>Managed Postgres with daily encrypted backups and point-in-time recovery.</li>
              <li>Object storage for photos with signed, expiring URLs and per-tenant prefixes.</li>
              <li>Separate environments for development, staging, and production with no shared credentials.</li>
            </ul>
          </GlassCard>

          <GlassCard>
            <h2 className="text-xl font-semibold tracking-tight">
              Application & data
            </h2>
            <ul className="mt-4 space-y-3 text-[15px] leading-relaxed text-white/70">
              <li>All endpoints rate-limited; abusive traffic blocked at the edge.</li>
              <li>Webhooks signed with HMAC-SHA256 and timestamp-validated.</li>
              <li>Customer data is portable and exportable on request.</li>
              <li>Photo retention follows the customer&apos;s plan; data is removed at the end of the retention window.</li>
            </ul>
          </GlassCard>

          <GlassCard>
            <h2 className="text-xl font-semibold tracking-tight">
              Payments
            </h2>
            <ul className="mt-4 space-y-3 text-[15px] leading-relaxed text-white/70">
              <li>All card data is tokenized by Stripe; Splash receives only metadata.</li>
              <li>Operators connect their own Stripe accounts via Stripe Connect Standard.</li>
              <li>Splash does not custody funds — payouts flow directly from Stripe to the operator&apos;s bank account.</li>
              <li>Refunds are auditable with timestamps and the acting admin.</li>
            </ul>
          </GlassCard>

          <GlassCard>
            <h2 className="text-xl font-semibold tracking-tight">
              People & process
            </h2>
            <ul className="mt-4 space-y-3 text-[15px] leading-relaxed text-white/70">
              <li>Background checks for employees with production access.</li>
              <li>Mandatory MFA on every admin account and infrastructure provider.</li>
              <li>Quarterly access reviews; immediate revocation on offboarding.</li>
              <li>Incident response runbooks with on-call rotations.</li>
            </ul>
          </GlassCard>
        </div>
      </PageSection>

      <PageSection className="!pt-0 !pb-32">
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="flex items-start gap-3 rounded-2xl border border-amber-400/20 bg-amber-400/[0.06] p-6 text-sm text-amber-100/90">
            <AlertTriangle size={18} className="mt-0.5 shrink-0 text-amber-300" />
            <div>
              <h3 className="text-base font-semibold text-amber-100">
                Responsible disclosure
              </h3>
              <p className="mt-2 leading-relaxed">
                Found a security issue? We&apos;d love to hear from you.
                Please email the team via the contact page with{' '}
                <span className="font-medium">[security]</span> in the subject
                line. We acknowledge reports within one business day and aim
                to fix qualifying issues quickly. We do not currently run a
                paid bounty, but we recognize researchers in our changelog.
              </p>
              <Link
                href="/contact"
                className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-amber-100 hover:underline"
              >
                Report a vulnerability →
              </Link>
            </div>
          </div>

          <GlassCard>
            <h3 className="text-base font-semibold tracking-tight">
              Compliance & attestations
            </h3>
            <p className="mt-3 text-sm leading-relaxed text-white/70">
              Splash is in private beta. SOC 2 Type II is on the roadmap; a
              gap assessment is underway. A signed Data Processing Addendum
              is available on request and is published in summary form on
              our DPA page.
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              {[
                'GDPR-aligned',
                'CCPA-aligned',
                'Stripe Connect Standard',
                'TLS 1.2+',
              ].map((tag) => (
                <span
                  key={tag}
                  className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-xs text-white/70"
                >
                  {tag}
                </span>
              ))}
            </div>
            <p className="mt-5 text-xs text-white/45">
              Note: Final legal and security review required before any of
              these statements appear on a publicly launched site.
            </p>
          </GlassCard>
        </div>
      </PageSection>
    </>
  );
}
