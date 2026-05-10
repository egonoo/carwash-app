import { SignJWT, jwtVerify } from 'jose';

const STATE_TTL_SECONDS = 600;

const SCOPES = [
  'openid',
  'email',
  'https://www.googleapis.com/auth/calendar.events',
];

function stateSecret(): Uint8Array {
  const s =
    process.env.GOOGLE_OAUTH_STATE_SECRET ??
    process.env.MANAGE_TOKEN_SECRET ??
    'dev-google-oauth-state';
  return new TextEncoder().encode(s);
}

function appUrl(): string {
  const url = process.env.NEXT_PUBLIC_APP_URL;
  if (!url) throw new Error('NEXT_PUBLIC_APP_URL is required');
  return url.replace(/\/$/, '');
}

function clientCreds(): { clientId: string; clientSecret: string } {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error('GOOGLE_OAUTH_CLIENT_ID and GOOGLE_OAUTH_CLIENT_SECRET are required');
  }
  return { clientId, clientSecret };
}

export function googleRedirectUri(): string {
  return `${appUrl()}/api/integrations/google/callback`;
}

export async function signOauthState(payload: {
  businessId: string;
  userId: string;
}): Promise<string> {
  return new SignJWT({ b: payload.businessId, u: payload.userId })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${STATE_TTL_SECONDS}s`)
    .sign(stateSecret());
}

export async function verifyOauthState(
  state: string,
): Promise<{ businessId: string; userId: string } | null> {
  try {
    const { payload } = await jwtVerify(state, stateSecret());
    if (typeof payload.b !== 'string' || typeof payload.u !== 'string') return null;
    return { businessId: payload.b, userId: payload.u };
  } catch {
    return null;
  }
}

export function buildGoogleAuthUrl(state: string): string {
  const { clientId } = clientCreds();
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: googleRedirectUri(),
    response_type: 'code',
    scope: SCOPES.join(' '),
    access_type: 'offline',
    prompt: 'consent',
    include_granted_scopes: 'true',
    state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

export async function exchangeGoogleCode(code: string): Promise<{
  accessToken: string;
  refreshToken: string | null;
  expiresIn: number;
  idToken: string | null;
  scope: string;
}> {
  const { clientId, clientSecret } = clientCreds();
  const body = new URLSearchParams({
    code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: googleRedirectUri(),
    grant_type: 'authorization_code',
  });
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Google token exchange failed: ${res.status} ${text}`);
  }
  const json = (await res.json()) as {
    access_token: string;
    refresh_token?: string;
    expires_in: number;
    id_token?: string;
    scope: string;
  };
  return {
    accessToken: json.access_token,
    refreshToken: json.refresh_token ?? null,
    expiresIn: json.expires_in,
    idToken: json.id_token ?? null,
    scope: json.scope,
  };
}

export function emailFromIdToken(idToken: string): string | null {
  const parts = idToken.split('.');
  if (parts.length !== 3) return null;
  try {
    const payload = JSON.parse(
      Buffer.from(parts[1], 'base64url').toString('utf8'),
    ) as { email?: string };
    return payload.email ?? null;
  } catch {
    return null;
  }
}

export async function revokeGoogleToken(token: string): Promise<void> {
  try {
    await fetch('https://oauth2.googleapis.com/revoke', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ token }).toString(),
    });
  } catch {
    // Best-effort revoke. Local disconnect proceeds regardless.
  }
}
