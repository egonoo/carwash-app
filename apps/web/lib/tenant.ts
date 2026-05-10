import { headers } from 'next/headers';
import { cache } from 'react';
import { prisma } from './db';
import { BusinessFeaturesSchema, type BusinessFeatures } from '@splash/schemas';

export type TenantContext = {
  id: string;
  slug: string;
  name: string;
  timezone: string;
  currency: string;
  locale: string;
  brandColor: string | null;
  logoStorageKey: string | null;
  features: BusinessFeatures;
};

const hostSuffix = () => process.env.NEXT_PUBLIC_BOOKING_HOST_SUFFIX ?? '.splash.app';

export function extractSubdomain(host: string | null): string | null {
  if (!host) return null;
  const clean = host.split(':')[0]!.toLowerCase();
  const suffix = hostSuffix();
  if (clean.endsWith(suffix)) {
    const sub = clean.slice(0, -suffix.length);
    if (!sub || sub === 'www' || sub === 'app' || sub === 'api') return null;
    return sub;
  }
  return null;
}

/**
 * Resuelve el tenant desde el request actual (middleware setea header `x-tenant-slug`
 * o `x-tenant-host` para dominios custom). No lanza: devuelve null si no resuelve.
 * Cacheado por request.
 */
export const resolveTenantFromRequest = cache(async (): Promise<TenantContext | null> => {
  const h = await headers();
  const slug = h.get('x-tenant-slug');
  const host = h.get('x-tenant-host');

  let business = null as Awaited<ReturnType<typeof prisma.business.findFirst>>;

  if (slug) {
    business = await prisma.business.findFirst({
      where: { slug, deletedAt: null, status: 'active' },
    });
  } else if (host) {
    const domain = await prisma.businessDomain.findUnique({ where: { host } });
    if (domain) {
      business = await prisma.business.findFirst({
        where: { id: domain.businessId, deletedAt: null, status: 'active' },
      });
    }
  }

  if (!business) return null;

  const features = BusinessFeaturesSchema.parse(business.features ?? {});

  return {
    id: business.id,
    slug: business.slug,
    name: business.name,
    timezone: business.timezone,
    currency: business.currency,
    locale: business.locale,
    brandColor: business.brandColor,
    logoStorageKey: business.logoStorageKey,
    features,
  };
});

/**
 * Throws si no hay tenant. Usar en páginas/acciones que requieren uno.
 */
export async function requireTenant(): Promise<TenantContext> {
  const t = await resolveTenantFromRequest();
  if (!t) throw new Error('TENANT_NOT_FOUND');
  return t;
}

/**
 * Verifica que el negocio tenga la feature activa. Throws FEATURE_DISABLED si no.
 */
export function requireFeature(features: BusinessFeatures, key: keyof BusinessFeatures) {
  if (!features[key]) {
    const err = new Error(`FEATURE_DISABLED:${key}`);
    (err as any).code = 'FEATURE_DISABLED';
    throw err;
  }
}
