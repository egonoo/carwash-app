import { requireSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { refreshStripeAccountStatus } from '@/actions/stripe-connect';
import { BusinessProfileForm } from './BusinessProfileForm';
import { LocalizationForm } from './LocalizationForm';
import { ConnectStripeButton } from './ConnectStripeButton';
import { GoogleCalendarCard } from './GoogleCalendarCard';
import { FeaturesPanel } from './FeaturesPanel';

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

const FEATURE_KEYS = [
  'sms',
  'promo_codes',
  'photos',
  'loyalty',
  'custom_domain',
  'google_calendar',
  'multiple_resources',
] as const;
type FeatureKey = (typeof FEATURE_KEYS)[number];

export default async function SettingsPage({ searchParams }: PageProps) {
  const session = await requireSession();
  const sp = (await searchParams) ?? {};

  if (sp.stripe === 'return') {
    try {
      await refreshStripeAccountStatus();
    } catch (err) {
      console.error('refreshStripeAccountStatus failed', err);
    }
  }

  const business = await prisma.business.findUnique({
    where: { id: session.activeBusinessId },
    select: {
      name: true,
      legalName: true,
      slug: true,
      email: true,
      phone: true,
      timezone: true,
      currency: true,
      locale: true,
      taxRateBps: true,
      plan: true,
      status: true,
      stripeAccountId: true,
      stripeAccountReady: true,
      stripeChargesEnabled: true,
      stripeDetailsSubmitted: true,
      stripePayoutsEnabled: true,
      stripeDisabledReason: true,
      stripeRequirementsDue: true,
      googleCalendarEmail: true,
      googleCalendarConnectedAt: true,
      features: true,
    },
  });
  if (!business) return null;

  const rawFeatures = (business.features as Record<string, boolean>) ?? {};
  const features = FEATURE_KEYS.reduce<Record<FeatureKey, boolean>>(
    (acc, k) => {
      acc[k] = Boolean(rawFeatures[k]);
      return acc;
    },
    {} as Record<FeatureKey, boolean>,
  );

  const hasStripeAccount = Boolean(business.stripeAccountId);
  const stripeStatus = ((): {
    label: string;
    tone: 'green' | 'amber' | 'red' | 'neutral';
  } => {
    if (!hasStripeAccount) return { label: 'Not connected', tone: 'neutral' };
    if (business.stripeAccountReady)
      return { label: 'Ready to accept payments', tone: 'green' };
    if (business.stripeDisabledReason)
      return { label: 'Action required', tone: 'red' };
    if (!business.stripeDetailsSubmitted)
      return { label: 'Setup incomplete', tone: 'amber' };
    return { label: 'Pending verification', tone: 'amber' };
  })();

  const stripeBanner = ((): { tone: 'green' | 'amber' | 'red'; text: string } | null => {
    if (sp.stripe === 'return') {
      return business.stripeAccountReady
        ? { tone: 'green', text: 'Stripe is connected. You can accept payments.' }
        : {
            tone: 'amber',
            text: 'Stripe setup is incomplete. Finish setup to accept payments.',
          };
    }
    if (sp.stripe === 'refresh') {
      return {
        tone: 'amber',
        text: 'Stripe setup was not completed. Continue setup to accept payments.',
      };
    }
    return null;
  })();

  const googleBanner = ((): { tone: 'green' | 'amber' | 'red'; text: string } | null => {
    if (sp.google === 'connected') {
      return { tone: 'green', text: 'Google Calendar connected.' };
    }
    if (sp.google === 'error') {
      const reason = typeof sp.reason === 'string' ? sp.reason : 'unknown';
      return {
        tone: 'red',
        text: `Google Calendar connection failed (${reason}). Please try again.`,
      };
    }
    return null;
  })();

  const toneClass = {
    green: 'bg-emerald-50 border-emerald-200 text-emerald-900',
    amber: 'bg-amber-50 border-amber-200 text-amber-900',
    red: 'bg-red-50 border-red-200 text-red-900',
    neutral: 'bg-neutral-100 text-neutral-700',
  } as const;

  const badgeToneClass = {
    green: 'bg-emerald-100 text-emerald-800',
    amber: 'bg-amber-100 text-amber-800',
    red: 'bg-red-100 text-red-800',
    neutral: 'bg-neutral-100 text-neutral-700',
  } as const;

  const googleConnected = business.googleCalendarConnectedAt !== null;

  const profileInitial = {
    name: business.name,
    legalName: business.legalName,
    email: business.email,
    phone: business.phone,
    slug: business.slug,
    timezone: business.timezone,
    locale: business.locale,
    currency: business.currency,
    taxRateBps: business.taxRateBps,
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">Settings</h1>
        <p className="mt-1 text-sm text-neutral-600">
          Manage your business profile, integrations, and feature flags.
        </p>
      </header>

      <section className="rounded border bg-white p-4">
        <h2 className="font-semibold">Business profile</h2>
        <p className="mt-1 text-xs text-neutral-500">Name, contact details, and URL slug.</p>
        <div className="mt-4">
          <BusinessProfileForm initial={profileInitial} />
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3 text-xs text-neutral-500 sm:grid-cols-4">
          <Field label="Plan" value={business.plan} />
          <Field label="Status" value={business.status} />
        </div>
      </section>

      <section className="rounded border bg-white p-4">
        <h2 className="font-semibold">Localization &amp; tax</h2>
        <p className="mt-1 text-xs text-neutral-500">
          Timezone, locale, currency, and the tax rate applied at checkout.
        </p>
        <div className="mt-4">
          <LocalizationForm initial={profileInitial} />
        </div>
      </section>

      <section className="rounded border bg-white p-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="font-semibold">Stripe Connect</h2>
            <p className="mt-1 text-sm text-neutral-600">
              Connect your Stripe account to accept card deposits online.
            </p>
          </div>
          <span
            className={`rounded-full px-3 py-1 text-xs font-semibold ${badgeToneClass[stripeStatus.tone]}`}
          >
            {stripeStatus.label}
          </span>
        </div>

        {stripeBanner && (
          <div
            className={`mt-3 rounded border px-3 py-2 text-sm ${toneClass[stripeBanner.tone]}`}
          >
            {stripeBanner.text}
          </div>
        )}

        {hasStripeAccount && (
          <dl className="mt-4 grid grid-cols-1 gap-3 text-sm sm:grid-cols-3">
            <Field
              label="Payouts"
              value={business.stripePayoutsEnabled ? 'Enabled' : 'Not yet enabled'}
            />
            <Field
              label="Charges"
              value={business.stripeChargesEnabled ? 'Enabled' : 'Not yet enabled'}
            />
            <Field
              label="Onboarding"
              value={business.stripeDetailsSubmitted ? 'Submitted' : 'Not submitted'}
            />
          </dl>
        )}

        {hasStripeAccount && business.stripeDisabledReason && (
          <div className="mt-3 rounded border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-900">
            <div className="font-semibold">Stripe paused this account</div>
            <div className="mt-0.5">Reason: {business.stripeDisabledReason}</div>
          </div>
        )}

        {hasStripeAccount && business.stripeRequirementsDue.length > 0 && (
          <div className="mt-3 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
            <div className="font-semibold">Stripe still needs:</div>
            <ul className="mt-1 list-disc pl-4">
              {business.stripeRequirementsDue.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
          </div>
        )}

        <div className="mt-4">
          <ConnectStripeButton
            hasAccount={hasStripeAccount}
            ready={business.stripeAccountReady}
          />
        </div>
      </section>

      <section className="rounded border bg-white p-4">
        <h2 className="font-semibold">Integrations</h2>
        <p className="mt-1 text-xs text-neutral-500">
          Third-party services connected to this business.
        </p>

        {googleBanner && (
          <div
            className={`mt-3 rounded border px-3 py-2 text-sm ${toneClass[googleBanner.tone]}`}
          >
            {googleBanner.text}
          </div>
        )}

        <div className="mt-4">
          <GoogleCalendarCard
            connected={googleConnected}
            email={business.googleCalendarEmail}
            connectedAt={business.googleCalendarConnectedAt}
          />
        </div>
      </section>

      <section className="rounded border bg-white p-4">
        <h2 className="font-semibold">Features</h2>
        <p className="mt-1 text-xs text-neutral-500">
          Toggle product capabilities for this business. Changes take effect immediately.
        </p>
        <div className="mt-4">
          <FeaturesPanel initial={features} />
        </div>
      </section>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs uppercase text-neutral-500">{label}</dt>
      <dd className="mt-0.5 font-medium break-all">{value}</dd>
    </div>
  );
}
