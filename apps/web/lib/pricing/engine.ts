import type { Prisma } from '@splash/db';
import { AddonPricingMode, DiscountValueType, DepositPolicyType } from '@splash/db';
import { loyaltyEligibility, type LoyaltyEligibility } from '@/lib/loyalty/eligibility';

// =============================================================================
// Tipos públicos
// =============================================================================

export type PricingLineItem = {
  kind: 'package' | 'addon' | 'manual_extra' | 'zone_fee';
  refId: string | null;
  name: string;
  description?: string | null;
  pricingMode?: AddonPricingMode | null;
  unitPriceCents: number;
  quantity: number;
  lineTotalCents: number;
  durationMinutes: number;
  pricingNotes?: string | null;
  requiresAdminQuote?: boolean;
};

export type PricingDiscount = {
  kind: 'loyalty' | 'promo' | 'manual';
  sourceId: string | null;
  label: string;
  discountType: DiscountValueType;
  discountValue: number;
  amountCents: number;
  snapshot: Record<string, unknown>;
};

export type PricingBreakdown = {
  lineItems: PricingLineItem[];
  subtotalCents: number;
  discounts: PricingDiscount[];
  discountTotalCents: number;
  subtotalAfterDiscountsCents: number;
  taxRateBps: number;
  taxCents: number;
  totalCents: number;
  durationMinutes: number;
  depositPolicy: {
    type: DepositPolicyType;
    value: number;
    minCents: number;
  };
  depositAmountCents: number;
  balanceDueOnServiceCents: number;
  loyalty: LoyaltyEligibility | null;
};

export type PricingInput = {
  businessId: string;
  packageId: string;
  vehicleTypeId: string;
  vehicleId?: string | null;
  zoneId?: string | null;
  addons: Array<{ addonId: string; quantity: number }>;
  manualExtras?: Array<{
    name: string;
    unitPriceCents: number;
    quantity: number;
    durationMinutes?: number;
    note?: string | null;
  }>;
  promoCode?: string | null;
  // For re-pricing an existing appointment with its own discounts:
  manualLoyaltyRedemption?: {
    discountType: DiscountValueType;
    discountValue: number;
    label: string;
  };
};

// =============================================================================
// Motor principal
// =============================================================================

/**
 * Calcula el breakdown completo de una cita potencial o existente.
 * Lectura pura — no escribe. El caller decide cuándo persistir.
 */
export async function computePricing(
  tx: Prisma.TransactionClient,
  input: PricingInput,
): Promise<PricingBreakdown> {
  // 1. Business + tax + deposit policy
  const business = await tx.business.findUniqueOrThrow({
    where: { id: input.businessId },
    select: {
      taxRateBps: true,
      depositPolicyType: true,
      depositPolicyValue: true,
      depositMinCents: true,
      features: true,
    },
  });

  // 2. Package + price for this vehicle type
  const pkg = await tx.package.findUniqueOrThrow({
    where: { id: input.packageId },
    include: {
      prices: { where: { vehicleTypeId: input.vehicleTypeId } },
    },
  });
  const pkgPrice = pkg.prices[0];
  if (!pkgPrice || !pkgPrice.isAvailable) {
    throw new Error('PACKAGE_NOT_AVAILABLE');
  }

  // 3. Addons referenced
  const addonRows = input.addons.length
    ? await tx.addon.findMany({
        where: { id: { in: input.addons.map((a) => a.addonId) } },
      })
    : [];
  const addonById = new Map(addonRows.map((a) => [a.id, a]));

  // 4. Build line items
  const lineItems: PricingLineItem[] = [];
  let subtotalCents = 0;
  let durationMinutes = pkgPrice.durationMinutes;

  // Package line
  {
    const li: PricingLineItem = {
      kind: 'package',
      refId: pkg.id,
      name: pkg.name,
      description: pkg.description,
      unitPriceCents: pkgPrice.priceCents,
      quantity: 1,
      lineTotalCents: pkgPrice.priceCents,
      durationMinutes: pkgPrice.durationMinutes,
    };
    subtotalCents += li.lineTotalCents;
    lineItems.push(li);
  }

  // Addons
  for (const sel of input.addons) {
    const a = addonById.get(sel.addonId);
    if (!a || a.archivedAt || !a.isActive) continue;
    const qty = Math.max(1, Math.min(sel.quantity, a.maxQuantity));
    let unit = a.basePriceCents;
    let notes: string | null = null;
    let requiresQuote = false;
    switch (a.pricingMode) {
      case AddonPricingMode.fixed:
        unit = a.basePriceCents;
        break;
      case AddonPricingMode.starting_at:
        unit = a.basePriceCents;
        notes = 'Starting price — admin may confirm final price on site.';
        break;
      case AddonPricingMode.per_unit:
        unit = a.basePriceCents; // * qty done below
        break;
      case AddonPricingMode.quote_on_site:
        unit = 0;
        requiresQuote = true;
        notes = 'Quote provided on site; not charged in deposit.';
        break;
    }
    const line: PricingLineItem = {
      kind: 'addon',
      refId: a.id,
      name: a.name,
      description: a.description,
      pricingMode: a.pricingMode,
      unitPriceCents: unit,
      quantity: qty,
      lineTotalCents: unit * qty,
      durationMinutes: a.durationMinutes * qty,
      pricingNotes: notes,
      requiresAdminQuote: requiresQuote,
    };
    subtotalCents += line.lineTotalCents;
    durationMinutes += line.durationMinutes;
    lineItems.push(line);
  }

  // Manual extras (for admin re-pricing on completed appointments)
  if (input.manualExtras?.length) {
    for (const ex of input.manualExtras) {
      const qty = Math.max(1, ex.quantity);
      const line: PricingLineItem = {
        kind: 'manual_extra',
        refId: null,
        name: ex.name,
        unitPriceCents: ex.unitPriceCents,
        quantity: qty,
        lineTotalCents: ex.unitPriceCents * qty,
        durationMinutes: (ex.durationMinutes ?? 0) * qty,
        pricingNotes: ex.note ?? null,
      };
      subtotalCents += line.lineTotalCents;
      durationMinutes += line.durationMinutes;
      lineItems.push(line);
    }
  }

  // 4b. Zone fee — per-zone travel surcharge (sumable al subtotal, no afecta
  // descuentos loyalty/promo porque computeDiscountBase solo mira package/addon).
  if (input.zoneId) {
    const zone = await tx.zone.findUnique({
      where: { id: input.zoneId },
      select: { id: true, name: true, extraFeeCents: true },
    });
    if (zone && zone.extraFeeCents > 0) {
      const line: PricingLineItem = {
        kind: 'zone_fee',
        refId: zone.id,
        name: `Zone fee — ${zone.name}`,
        unitPriceCents: zone.extraFeeCents,
        quantity: 1,
        lineTotalCents: zone.extraFeeCents,
        durationMinutes: 0,
      };
      subtotalCents += line.lineTotalCents;
      lineItems.push(line);
    }
  }

  // 5. Loyalty eligibility (if vehicle known)
  let loyaltyElig: LoyaltyEligibility | null = null;
  if (input.vehicleId) {
    loyaltyElig = await loyaltyEligibility(tx, {
      businessId: input.businessId,
      vehicleId: input.vehicleId,
      packageId: input.packageId,
    });
  }

  // 6. Discounts — apply in deterministic order
  const discounts: PricingDiscount[] = [];

  // 6a. Loyalty (from eligibility or manual override from args)
  const loyaltyDiscount =
    input.manualLoyaltyRedemption ?? (loyaltyElig?.rewardAvailable
      ? {
          discountType: loyaltyElig.rewardAvailable.discountType,
          discountValue: loyaltyElig.rewardAvailable.discountValue,
          label: `Loyalty ${loyaltyElig.rewardAvailable.name ?? ''}`.trim(),
        }
      : null);

  if (loyaltyDiscount) {
    const appliesToAddons = loyaltyElig?.program?.appliesToAddons ?? false;
    const applicableBase = computeDiscountBase(lineItems, { includeAddons: appliesToAddons });
    const amount = computeDiscountAmount(
      applicableBase,
      loyaltyDiscount.discountType,
      loyaltyDiscount.discountValue,
    );
    if (amount > 0) {
      discounts.push({
        kind: 'loyalty',
        sourceId: loyaltyElig?.rewardAvailable?.tierId ?? null,
        label: loyaltyDiscount.label,
        discountType: loyaltyDiscount.discountType,
        discountValue: loyaltyDiscount.discountValue,
        amountCents: amount,
        snapshot: {
          tier: loyaltyElig?.rewardAvailable ?? null,
          appliesToAddons,
          applicableBaseCents: applicableBase,
        },
      });
    }
  }

  // 6b. Promo code
  if (input.promoCode) {
    const promo = await tx.promoCode.findFirst({
      where: {
        businessId: input.businessId,
        code: input.promoCode,
        archivedAt: null,
        activeFrom: { lte: new Date() },
        OR: [{ activeUntil: null }, { activeUntil: { gt: new Date() } }],
      },
    });
    if (promo && subtotalCents >= promo.minSubtotalCents) {
      const applicable = computeDiscountBase(lineItems, {
        includeAddons: promo.appliesToAddons,
        filterPackageIds: promo.appliesToPackageIds.length ? promo.appliesToPackageIds : undefined,
      });
      const amount = computeDiscountAmount(applicable, promo.discountType, promo.discountValue);
      if (amount > 0) {
        discounts.push({
          kind: 'promo',
          sourceId: promo.id,
          label: `Promo ${promo.code}`,
          discountType: promo.discountType,
          discountValue: promo.discountValue,
          amountCents: amount,
          snapshot: { code: promo.code, appliesToAddons: promo.appliesToAddons },
        });
      }
    }
  }

  // 7. Totals
  const discountTotalCents = discounts.reduce((s, d) => s + d.amountCents, 0);
  const subtotalAfterDiscountsCents = Math.max(0, subtotalCents - discountTotalCents);
  const taxCents = Math.round((subtotalAfterDiscountsCents * business.taxRateBps) / 10000);
  const totalCents = subtotalAfterDiscountsCents + taxCents;

  // 8. Deposit (paquete override → negocio default)
  const depositPolicyType = pkg.depositPolicyType ?? business.depositPolicyType;
  const depositPolicyValue = pkg.depositPolicyValue ?? business.depositPolicyValue;
  const depositMinCents = pkg.depositMinCents ?? business.depositMinCents;
  const depositAmountCents = computeDeposit(totalCents, depositPolicyType, depositPolicyValue, depositMinCents);
  const balanceDueOnServiceCents = Math.max(0, totalCents - depositAmountCents);

  return {
    lineItems,
    subtotalCents,
    discounts,
    discountTotalCents,
    subtotalAfterDiscountsCents,
    taxRateBps: business.taxRateBps,
    taxCents,
    totalCents,
    durationMinutes,
    depositPolicy: { type: depositPolicyType, value: depositPolicyValue, minCents: depositMinCents },
    depositAmountCents,
    balanceDueOnServiceCents,
    loyalty: loyaltyElig,
  };
}

// =============================================================================
// Helpers
// =============================================================================

function computeDiscountBase(
  items: PricingLineItem[],
  opts: { includeAddons?: boolean; filterPackageIds?: string[] } = {},
): number {
  let base = 0;
  for (const li of items) {
    if (li.kind === 'package') {
      if (opts.filterPackageIds && li.refId && !opts.filterPackageIds.includes(li.refId)) continue;
      base += li.lineTotalCents;
    } else if (li.kind === 'addon' && opts.includeAddons) {
      base += li.lineTotalCents;
    }
  }
  return base;
}

function computeDiscountAmount(
  baseCents: number,
  type: DiscountValueType,
  value: number,
): number {
  if (baseCents <= 0) return 0;
  if (type === DiscountValueType.percentage) {
    return Math.min(baseCents, Math.round((baseCents * value) / 10000));
  }
  return Math.min(baseCents, value);
}

function computeDeposit(
  totalCents: number,
  type: DepositPolicyType,
  value: number,
  minCents: number,
): number {
  const raw =
    type === DepositPolicyType.fixed ? value : Math.round((totalCents * value) / 10000);
  return Math.max(minCents, Math.min(totalCents, raw));
}
