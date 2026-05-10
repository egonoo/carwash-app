'use server';

import type Stripe from 'stripe';
import { revalidatePath } from 'next/cache';
import { requireRole } from '@/lib/auth';
import { withTenant } from '@/lib/rls';
import { prisma } from '@/lib/db';
import { getStripe } from '@/lib/stripe';
import { audit } from '@/lib/audit';

function getAppUrl(): string {
  const url = process.env.NEXT_PUBLIC_APP_URL;
  if (!url) throw new Error('NEXT_PUBLIC_APP_URL is required');
  return url.replace(/\/$/, '');
}

type AccountStatus = {
  chargesEnabled: boolean;
  detailsSubmitted: boolean;
  payoutsEnabled: boolean;
  ready: boolean;
  requirementsDue: string[];
  disabledReason: string | null;
};

function readStatus(account: Stripe.Account): AccountStatus {
  const chargesEnabled = Boolean(account.charges_enabled);
  const detailsSubmitted = Boolean(account.details_submitted);
  const payoutsEnabled = Boolean(account.payouts_enabled);
  return {
    chargesEnabled,
    detailsSubmitted,
    payoutsEnabled,
    ready: chargesEnabled && detailsSubmitted,
    requirementsDue: account.requirements?.currently_due ?? [],
    disabledReason: account.requirements?.disabled_reason ?? null,
  };
}

async function persistStatus(businessId: string, status: AccountStatus): Promise<void> {
  await withTenant(businessId, async (tx) => {
    await tx.business.update({
      where: { id: businessId },
      data: {
        stripeChargesEnabled: status.chargesEnabled,
        stripeDetailsSubmitted: status.detailsSubmitted,
        stripePayoutsEnabled: status.payoutsEnabled,
        stripeAccountReady: status.ready,
        stripeRequirementsDue: status.requirementsDue,
        stripeDisabledReason: status.disabledReason,
      },
    });
  });
}

/**
 * Single entry point for the "Stripe" button on Settings.
 *  - No accountId          → create Express account + onboarding link.
 *  - accountId, not ready  → onboarding link (resume).
 *  - accountId, ready only → Express dashboard login link.
 *
 * createLoginLink is unreachable unless we have a non-null accountId AND
 * Stripe reports the account as ready in the same request.
 */
export async function openStripeManageLink(): Promise<{
  url: string;
  mode: 'onboarding' | 'dashboard';
}> {
  const session = await requireRole(['owner', 'admin']);
  const stripe = getStripe();

  const business = await prisma.business.findUnique({
    where: { id: session.activeBusinessId },
    select: { id: true, email: true, stripeAccountId: true },
  });
  if (!business) throw new Error('BUSINESS_NOT_FOUND');

  const appUrl = getAppUrl();

  // ---------------------------------------------------------------------------
  // Path 1: no account yet → create Express account + onboarding link, return.
  // ---------------------------------------------------------------------------
  if (!business.stripeAccountId) {
    const account = await stripe.accounts.create({
      type: 'express',
      country: 'US',
      email: business.email,
      capabilities: {
        card_payments: { requested: true },
        transfers: { requested: true },
      },
      metadata: { business_id: business.id },
    });
    const newAccountId = account.id;

    await withTenant(business.id, async (tx) => {
      await tx.business.update({
        where: { id: business.id },
        data: {
          stripeAccountId: newAccountId,
          // A brand-new account is never ready — reset any stale flags.
          stripeAccountReady: false,
          stripeChargesEnabled: false,
          stripeDetailsSubmitted: false,
          stripePayoutsEnabled: false,
          stripeRequirementsDue: [],
          stripeDisabledReason: null,
        },
      });
      await audit(tx, {
        businessId: business.id,
        actorType: 'user',
        actorUserId: session.userId,
        action: 'update',
        entityType: 'business',
        entityId: business.id,
        diff: { stripeAccountId: newAccountId },
        metadata: { event: 'stripe_connect.account_created' },
      });
    });

    const onboarding = await stripe.accountLinks.create({
      account: newAccountId,
      type: 'account_onboarding',
      refresh_url: `${appUrl}/settings?stripe=refresh`,
      return_url: `${appUrl}/settings?stripe=return`,
    });
    return { url: onboarding.url, mode: 'onboarding' };
  }

  // ---------------------------------------------------------------------------
  // From here on, accountId is guaranteed non-null.
  // ---------------------------------------------------------------------------
  const accountId: string = business.stripeAccountId;

  // Refresh live state from Stripe and persist before deciding.
  const account = await stripe.accounts.retrieve(accountId);
  const status = readStatus(account);
  await persistStatus(business.id, status);

  // ---------------------------------------------------------------------------
  // Path 2: account exists but Stripe says not ready → onboarding link.
  // ---------------------------------------------------------------------------
  if (!status.ready) {
    const onboarding = await stripe.accountLinks.create({
      account: accountId,
      type: 'account_onboarding',
      refresh_url: `${appUrl}/settings?stripe=refresh`,
      return_url: `${appUrl}/settings?stripe=return`,
    });
    return { url: onboarding.url, mode: 'onboarding' };
  }

  // ---------------------------------------------------------------------------
  // Path 3: account exists AND Stripe says ready → dashboard login link.
  // ---------------------------------------------------------------------------
  const dashboard = await stripe.accounts.createLoginLink(accountId);
  return { url: dashboard.url, mode: 'dashboard' };
}

/**
 * Re-pulls the account from Stripe and persists the status fields.
 * Called by the Settings page when ?stripe=return is present.
 */
export async function refreshStripeAccountStatus(): Promise<AccountStatus | null> {
  const session = await requireRole(['owner', 'admin']);

  const business = await prisma.business.findUnique({
    where: { id: session.activeBusinessId },
    select: { id: true, stripeAccountId: true },
  });
  if (!business?.stripeAccountId) return null;

  const stripe = getStripe();
  const account = await stripe.accounts.retrieve(business.stripeAccountId);
  const status = readStatus(account);
  await persistStatus(business.id, status);

  revalidatePath('/settings');
  return status;
}
