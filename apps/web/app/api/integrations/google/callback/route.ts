import { NextResponse, type NextRequest } from 'next/server';
import { audit } from '@/lib/audit';
import { requireSession } from '@/lib/auth';
import {
  emailFromIdToken,
  exchangeGoogleCode,
  verifyOauthState,
} from '@/lib/google-calendar';
import { withTenant } from '@/lib/rls';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function settingsRedirect(qs: string): NextResponse {
  const base = (process.env.NEXT_PUBLIC_APP_URL ?? '').replace(/\/$/, '');
  return NextResponse.redirect(`${base}/settings?${qs}`);
}

export async function GET(req: NextRequest) {
  const url = req.nextUrl;
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const errorParam = url.searchParams.get('error');

  if (errorParam) {
    return settingsRedirect(`google=error&reason=${encodeURIComponent(errorParam)}`);
  }
  if (!code || !state) {
    return settingsRedirect('google=error&reason=missing_params');
  }

  const verified = await verifyOauthState(state);
  if (!verified) return settingsRedirect('google=error&reason=invalid_state');

  let session;
  try {
    session = await requireSession();
  } catch {
    return settingsRedirect('google=error&reason=unauthenticated');
  }
  if (session.activeBusinessId !== verified.businessId) {
    return settingsRedirect('google=error&reason=business_mismatch');
  }

  let tokens;
  try {
    tokens = await exchangeGoogleCode(code);
  } catch (err) {
    console.error('google oauth code exchange failed', err);
    return settingsRedirect('google=error&reason=token_exchange_failed');
  }

  if (!tokens.refreshToken) {
    return settingsRedirect('google=error&reason=no_refresh_token');
  }

  const email = tokens.idToken ? emailFromIdToken(tokens.idToken) : null;

  await withTenant(verified.businessId, async (tx) => {
    await tx.business.update({
      where: { id: verified.businessId },
      data: {
        googleRefreshTokenEnc: tokens.refreshToken,
        googleCalendarEmail: email,
        googleCalendarId: email ?? null,
        googleCalendarConnectedAt: new Date(),
      },
    });
    await audit(tx, {
      businessId: verified.businessId,
      actorType: 'user',
      actorUserId: verified.userId,
      action: 'update',
      entityType: 'business',
      entityId: verified.businessId,
      diff: { googleCalendarConnected: true, email },
      metadata: { event: 'google_calendar.connected', scope: tokens.scope },
    });
  });

  return settingsRedirect('google=connected');
}
