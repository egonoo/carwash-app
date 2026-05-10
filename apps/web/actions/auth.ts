'use server';

import { z } from 'zod';
import { prisma } from '@/lib/db';
import { verifyPassword, setSessionCookie, clearSessionCookie } from '@/lib/auth';
import { errs } from '@/lib/errors';

const LoginSchema = z.object({
  email: z.string().email().toLowerCase(),
  password: z.string().min(6).max(200),
});

export async function login(input: z.infer<typeof LoginSchema>) {
  const parsed = LoginSchema.parse(input);

  const user = await prisma.appUser.findUnique({
    where: { email: parsed.email },
    include: { businessRoles: true },
  });
  if (!user || !user.passwordHash) throw errs.unauthorized();

  const valid = await verifyPassword(user.passwordHash, parsed.password);
  if (!valid) throw errs.unauthorized();

  const role = user.businessRoles[0];
  if (!role && !user.isSuperAdmin) throw errs.forbidden('No business assigned');

  await setSessionCookie({
    userId: user.id,
    activeBusinessId: role?.businessId ?? '',
    role: role?.role ?? 'readonly',
    isSuperAdmin: user.isSuperAdmin,
  });

  await prisma.appUser.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
  });

  return { ok: true as const };
}

export async function logout() {
  await clearSessionCookie();
  return { ok: true as const };
}
