import { Prisma } from '@splash/db';
import { prisma } from './db';

/**
 * Ejecuta `fn` en una transacción con el tenant fijado via `app.current_business_id`.
 * Toda tabla con RLS filtrará/validará contra este setting. El contexto sólo vive
 * dentro de la transacción (tercer arg `true` = is_local).
 */
export async function withTenant<T>(
  businessId: string,
  fn: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('app.current_business_id', ${businessId}::text, true)`;
    return fn(tx);
  });
}

/**
 * Bypass controlado de RLS para operaciones sistémicas (webhooks cross-tenant,
 * super-admin de Splash). Sólo usar cuando el caller no tiene un business_id claro.
 * No exponer a rutas públicas.
 */
export async function withoutTenant<T>(fn: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
  return prisma.$transaction(async (tx) => {
    return fn(tx);
  });
}
