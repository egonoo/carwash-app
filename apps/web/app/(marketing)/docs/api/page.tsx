import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, Code, Lock, Webhook } from 'lucide-react';
import { GlassCard, PageHero, PageSection } from '../../_components/PageHero';

export const metadata: Metadata = {
  title: 'API reference — Splash',
  description:
    'A first look at the Splash REST API. Currently in private preview for Pro and Scale customers.',
};

const ENDPOINTS = [
  {
    method: 'GET',
    path: '/v1/bookings',
    desc: 'List bookings for your business with cursor pagination and date filters.',
  },
  {
    method: 'POST',
    path: '/v1/bookings',
    desc: 'Create a booking on behalf of a customer (deposits captured through your Stripe account).',
  },
  {
    method: 'GET',
    path: '/v1/customers/{id}',
    desc: 'Fetch a customer record, vehicles, loyalty progress, and booking history.',
  },
  {
    method: 'GET',
    path: '/v1/availability',
    desc: 'Resolve real, bookable slots for a service in a given zone on a given day.',
  },
  {
    method: 'POST',
    path: '/v1/webhooks',
    desc: 'Subscribe to booking, payment, and photo events delivered with HMAC signatures.',
  },
];

export default function ApiReferencePage() {
  return (
    <>
      <PageHero
        eyebrow="API reference"
        title={
          <>
            The Splash API is{' '}
            <span className="bg-gradient-to-r from-white via-white to-[#5EB1FF] bg-clip-text text-transparent">
              in private preview.
            </span>
          </>
        }
        description="A REST API for bookings, availability, customers, vehicles, and webhooks. Available to Pro and Scale customers on request while we stabilize versioning and rate limits."
      >
        <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link
            href="/contact"
            className="group inline-flex items-center justify-center gap-2 rounded-md bg-white px-5 py-3 text-sm font-medium text-[#06070A] transition-transform hover:-translate-y-[1px]"
          >
            Request preview access
            <ArrowRight
              size={16}
              className="transition-transform group-hover:translate-x-0.5"
            />
          </Link>
          <Link
            href="/docs"
            className="inline-flex items-center justify-center rounded-md border border-white/15 bg-white/[0.04] px-5 py-3 text-sm font-medium text-white/90 hover:bg-white/[0.08]"
          >
            Back to docs
          </Link>
        </div>
      </PageHero>

      <PageSection>
        <div className="grid gap-6 lg:grid-cols-3">
          <GlassCard>
            <span className="grid h-10 w-10 place-items-center rounded-md bg-gradient-to-br from-[#0A84FF] to-[#5E5CE6] text-white">
              <Lock size={18} />
            </span>
            <h3 className="mt-5 text-lg font-semibold tracking-tight">
              Authentication
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-white/65">
              Bearer tokens scoped to a single business. Tokens are issued from
              Settings → API and can be rotated at any time.
            </p>
          </GlassCard>
          <GlassCard>
            <span className="grid h-10 w-10 place-items-center rounded-md bg-gradient-to-br from-[#0A84FF] to-[#5E5CE6] text-white">
              <Code size={18} />
            </span>
            <h3 className="mt-5 text-lg font-semibold tracking-tight">
              Format
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-white/65">
              JSON over HTTPS, predictable resource URLs, ISO-8601 timestamps,
              cursor-based pagination, and explicit error codes.
            </p>
          </GlassCard>
          <GlassCard>
            <span className="grid h-10 w-10 place-items-center rounded-md bg-gradient-to-br from-[#0A84FF] to-[#5E5CE6] text-white">
              <Webhook size={18} />
            </span>
            <h3 className="mt-5 text-lg font-semibold tracking-tight">
              Webhooks
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-white/65">
              Subscribe to <code className="rounded bg-white/5 px-1">booking.*</code>,{' '}
              <code className="rounded bg-white/5 px-1">payment.*</code>, and{' '}
              <code className="rounded bg-white/5 px-1">photo.*</code> events
              with HMAC-SHA256 signatures.
            </p>
          </GlassCard>
        </div>
      </PageSection>

      <PageSection className="!pt-0">
        <div className="max-w-2xl">
          <span className="text-xs font-medium uppercase tracking-[0.2em] text-[#5EB1FF]">
            Preview surface
          </span>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
            What&apos;s in the private preview
          </h2>
          <p className="mt-4 text-[15px] leading-relaxed text-white/65">
            These endpoints are stable for preview customers. Field shapes may
            still evolve before the public 1.0 release, so pin a version header
            and read the changelog.
          </p>
        </div>

        <div className="mt-8 overflow-hidden rounded-2xl border border-white/[0.07] bg-white/[0.02]">
          <ul className="divide-y divide-white/[0.05]">
            {ENDPOINTS.map((e) => (
              <li
                key={`${e.method} ${e.path}`}
                className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:gap-6"
              >
                <span
                  className={`inline-flex w-fit items-center justify-center rounded-md px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider ${
                    e.method === 'GET'
                      ? 'bg-emerald-400/15 text-emerald-200'
                      : 'bg-[#0A84FF]/20 text-[#5EB1FF]'
                  }`}
                >
                  {e.method}
                </span>
                <code className="text-sm font-medium text-white">
                  {e.path}
                </code>
                <p className="text-sm text-white/60 sm:ml-auto sm:max-w-md sm:text-right">
                  {e.desc}
                </p>
              </li>
            ))}
          </ul>
        </div>
      </PageSection>

      <PageSection className="!pt-0 !pb-32">
        <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-[#0E1424] via-[#0B0E14] to-[#0B0E14] p-8 text-center sm:p-12">
          <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            Want early access?
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-white/65">
            Tell us what you want to build and we&apos;ll provision a preview
            token for your business.
          </p>
          <div className="mt-6 flex justify-center">
            <Link
              href="/contact"
              className="group inline-flex items-center justify-center gap-2 rounded-md bg-white px-5 py-3 text-sm font-medium text-[#06070A] transition-transform hover:-translate-y-[1px]"
            >
              Request access
              <ArrowRight
                size={16}
                className="transition-transform group-hover:translate-x-0.5"
              />
            </Link>
          </div>
        </div>
      </PageSection>
    </>
  );
}
