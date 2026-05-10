import { cookies } from 'next/headers';
import { SignJWT, jwtVerify } from 'jose';
import argon2 from 'argon2';
import { cache } from 'react';
import { prisma } from './db';

const COOKIE_NAME = 'splash.session';
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7; // 7d
const secret = () => new TextEncoder().encode(process.env.SESSION_SECRET ?? 'dev-secret-change-me');

export type AdminSession = {
  userId: string;
  activeBusinessId: string;
  role: 'owner' | 'admin' | 'staff' | 'readonly';
  isSuperAdmin: boolean;
};

export async function hashPassword(pw: string): Promise<string> {
  return argon2.hash(pw, { type: argon2.argon2id, memoryCost: 19456, timeCost: 2, parallelism: 1 });
}

export async function verifyPassword(hash: string, pw: string): Promise<boolean> {
  try {
    return await argon2.verify(hash, pw);
  } catch {
    return false;
  }
}

export async function signSession(payload: AdminSession): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_SECONDS}s`)
    .sign(secret());
}

export async function setSessionCookie(payload: AdminSession) {
  const token = await signSession(payload);
  const jar = await cookies();
  jar.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_TTL_SECONDS,
  });
}

export async function clearSessionCookie() {
  const jar = await cookies();
  jar.delete(COOKIE_NAME);
}

export const getSession = cache(async (): Promise<AdminSession | null> => {
  const jar = await cookies();
  const token = jar.get(COOKIE_NAME)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    return payload as unknown as AdminSession;
  } catch {
    return null;
  }
});

export async function requireSession(): Promise<AdminSession> {
  const s = await getSession();
  if (!s) {
    const err = new Error('UNAUTHORIZED');
    (err as any).code = 'UNAUTHORIZED';
    throw err;
  }
  return s;
}

export async function requireRole(
  allowed: AdminSession['role'][],
): Promise<AdminSession> {
  const s = await requireSession();
  if (!allowed.includes(s.role) && !s.isSuperAdmin) {
    const err = new Error('FORBIDDEN');
    (err as any).code = 'FORBIDDEN';
    throw err;
  }
  return s;
}

/** Mini-JWT para tokens firmados de "manage" del cliente (reagenda/cancel). */
export async function signManageToken(appointmentId: string): Promise<string> {
  const s = new TextEncoder().encode(process.env.MANAGE_TOKEN_SECRET ?? 'dev-manage');
  return new SignJWT({ apt: appointmentId })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('30d')
    .sign(s);
}

export async function verifyManageToken(token: string): Promise<{ appointmentId: string } | null> {
  const s = new TextEncoder().encode(process.env.MANAGE_TOKEN_SECRET ?? 'dev-manage');
  try {
    const { payload } = await jwtVerify(token, s);
    return { appointmentId: payload.apt as string };
  } catch {
    return null;
  }
}
