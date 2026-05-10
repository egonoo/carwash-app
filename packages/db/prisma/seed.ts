import { PrismaClient, AddonPricingMode, DiscountValueType, DepositPolicyType } from '@prisma/client';
import 'dotenv/config';

const prisma = new PrismaClient();

const VEHICLE_TYPES = [
  { slug: 'sedan', name: 'Sedan', examples: 'Civic, Camry, Audi A3, Mercedes CLA250', displayOrder: 0 },
  { slug: 'small-suv', name: 'Small SUV (2 rows)', examples: 'RAV4, BMW X1, Mercedes GLE', displayOrder: 1 },
  { slug: 'medium-suv', name: 'Medium SUV / Pickup', examples: 'Ford F-150, Silverado, Tesla Model X', displayOrder: 2 },
  { slug: 'xl-suv', name: 'XL SUV / XL Pickup', examples: 'Ford 2500/3500, Lifted trucks, Suburban', displayOrder: 3 },
] as const;

type VehicleSlug = typeof VEHICLE_TYPES[number]['slug'];

const PACKAGES: Array<{
  slug: string;
  name: string;
  description: string;
  displayOrder: number;
  prices: Record<VehicleSlug, number>;
  duration: Record<VehicleSlug, number>;
}> = [
  {
    slug: 'car-wash',
    name: 'Car Wash',
    description: 'Full exterior hand wash with tire shine.',
    displayOrder: 0,
    prices: { sedan: 6499, 'small-suv': 6999, 'medium-suv': 7499, 'xl-suv': 7999 },
    duration: { sedan: 45, 'small-suv': 50, 'medium-suv': 60, 'xl-suv': 75 },
  },
  {
    slug: 'car-wash-interior',
    name: 'Car Wash + Interior Detail',
    description: 'Everything in Car Wash plus deep interior vacuum, wipe down and dash.',
    displayOrder: 1,
    prices: { sedan: 12499, 'small-suv': 13999, 'medium-suv': 14999, 'xl-suv': 15999 },
    duration: { sedan: 105, 'small-suv': 120, 'medium-suv': 135, 'xl-suv': 150 },
  },
  {
    slug: 'upholstery-shampoo',
    name: 'Upholstery Shampoo + Car Wash',
    description: 'Deep shampoo of seats and carpets.',
    displayOrder: 2,
    prices: { sedan: 22999, 'small-suv': 24999, 'medium-suv': 25999, 'xl-suv': 28999 },
    duration: { sedan: 180, 'small-suv': 210, 'medium-suv': 225, 'xl-suv': 240 },
  },
  {
    slug: 'full-detail',
    name: 'Full Detail',
    description: 'Complete exterior + interior transformation.',
    displayOrder: 3,
    prices: { sedan: 23500, 'small-suv': 25000, 'medium-suv': 27500, 'xl-suv': 29000 },
    duration: { sedan: 240, 'small-suv': 270, 'medium-suv': 300, 'xl-suv': 330 },
  },
  {
    slug: 'paint-enhancement',
    name: 'Paint Enhancement',
    description: 'One-step polish to remove minor swirls and restore gloss.',
    displayOrder: 4,
    prices: { sedan: 27999, 'small-suv': 29999, 'medium-suv': 32499, 'xl-suv': 36999 },
    duration: { sedan: 300, 'small-suv': 330, 'medium-suv': 360, 'xl-suv': 390 },
  },
  {
    slug: 'paint-correction',
    name: 'Paint Correction',
    description: 'Multi-step correction to remove deep scratches and restore showroom finish.',
    displayOrder: 5,
    prices: { sedan: 38999, 'small-suv': 41999, 'medium-suv': 45999, 'xl-suv': 51999 },
    duration: { sedan: 420, 'small-suv': 450, 'medium-suv': 480, 'xl-suv': 540 },
  },
];

const ADDONS: Array<{
  slug: string;
  name: string;
  pricingMode: AddonPricingMode;
  basePriceCents: number;
  durationMinutes: number;
  defaultQuantity?: number;
  maxQuantity?: number;
  requiresAdminQuote?: boolean;
  displayOrder: number;
}> = [
  { slug: 'pet-hair-removal', name: 'Pet hair removal', pricingMode: 'starting_at', basePriceCents: 1500, durationMinutes: 20, displayOrder: 0 },
  { slug: 'extra-vacuuming', name: 'Extra vacuuming', pricingMode: 'fixed', basePriceCents: 2000, durationMinutes: 15, displayOrder: 1 },
  { slug: 'water-spots-removal', name: 'Water spots removal', pricingMode: 'starting_at', basePriceCents: 3000, durationMinutes: 30, displayOrder: 2 },
  { slug: 'exterior-plastic-protection', name: 'Exterior plastic protection', pricingMode: 'fixed', basePriceCents: 1000, durationMinutes: 10, displayOrder: 3 },
  { slug: 'headlights-restoration', name: 'Headlights restoration', pricingMode: 'fixed', basePriceCents: 3000, durationMinutes: 30, displayOrder: 4 },
  { slug: 'hand-wax', name: 'Hand wax', pricingMode: 'starting_at', basePriceCents: 3500, durationMinutes: 45, displayOrder: 5 },
  { slug: 'tree-sap-removal', name: 'Tree sap removal', pricingMode: 'starting_at', basePriceCents: 1000, durationMinutes: 15, displayOrder: 6 },
  { slug: 'plastic-mats-wash', name: 'Plastic mats wash', pricingMode: 'fixed', basePriceCents: 1000, durationMinutes: 10, displayOrder: 7 },
  { slug: 'carpet-mats-cleaning', name: 'Carpet mats cleaning', pricingMode: 'fixed', basePriceCents: 2000, durationMinutes: 20, displayOrder: 8 },
  { slug: 'engine-wash', name: 'Engine wash', pricingMode: 'fixed', basePriceCents: 8500, durationMinutes: 30, displayOrder: 9 },
  { slug: 'rims-detail', name: 'Rims detail', pricingMode: 'per_unit', basePriceCents: 1000, durationMinutes: 10, defaultQuantity: 4, maxQuantity: 8, displayOrder: 10 },
  { slug: 'roof-cleaning', name: 'Roof cleaning', pricingMode: 'starting_at', basePriceCents: 2500, durationMinutes: 20, displayOrder: 11 },
  { slug: 'carpet-cleaning', name: 'Carpet cleaning', pricingMode: 'starting_at', basePriceCents: 4900, durationMinutes: 60, displayOrder: 12 },
  { slug: 'overspray', name: 'Overspray', pricingMode: 'quote_on_site', basePriceCents: 0, durationMinutes: 30, requiresAdminQuote: true, displayOrder: 13 },
];

async function seedBusiness(slug: string, name: string) {
  const business = await prisma.business.upsert({
    where: { slug },
    update: {
      stripeAccountId: 'acct_dev_local',
      stripeAccountReady: true,
    },
    create: {
      slug,
      name,
      email: `owner@${slug}.splash.app`,
      timezone: 'America/New_York',
      currency: 'USD',
      locale: 'en',
      stripeAccountId: 'acct_dev_local',
      stripeAccountReady: true,
    },
  });

  // vehicle types
  const vtByslug: Record<string, string> = {};
  for (const vt of VEHICLE_TYPES) {
    const created = await prisma.vehicleType.upsert({
      where: { businessId_slug: { businessId: business.id, slug: vt.slug } },
      update: { name: vt.name, examples: vt.examples, displayOrder: vt.displayOrder },
      create: { businessId: business.id, ...vt },
    });
    vtByslug[vt.slug] = created.id;
  }

  // packages + prices
  for (const pkg of PACKAGES) {
    const created = await prisma.package.upsert({
      where: { businessId_slug: { businessId: business.id, slug: pkg.slug } },
      update: { name: pkg.name, description: pkg.description, displayOrder: pkg.displayOrder },
      create: {
        businessId: business.id,
        slug: pkg.slug,
        name: pkg.name,
        description: pkg.description,
        displayOrder: pkg.displayOrder,
      },
    });
    for (const vt of VEHICLE_TYPES) {
      await prisma.packagePrice.upsert({
        where: { packageId_vehicleTypeId: { packageId: created.id, vehicleTypeId: vtByslug[vt.slug]! } },
        update: {
          priceCents: pkg.prices[vt.slug],
          durationMinutes: pkg.duration[vt.slug],
          isAvailable: true,
        },
        create: {
          packageId: created.id,
          vehicleTypeId: vtByslug[vt.slug]!,
          businessId: business.id,
          priceCents: pkg.prices[vt.slug],
          durationMinutes: pkg.duration[vt.slug],
          isAvailable: true,
        },
      });
    }
  }

  // addons
  for (const a of ADDONS) {
    await prisma.addon.upsert({
      where: { businessId_slug: { businessId: business.id, slug: a.slug } },
      update: a,
      create: { businessId: business.id, ...a },
    });
  }

  // resource default
  const resources = await prisma.resource.findMany({ where: { businessId: business.id } });
  if (resources.length === 0) {
    await prisma.resource.create({
      data: { businessId: business.id, name: 'Unit 1', color: '#0A84FF', displayOrder: 0 },
    });
  }

  // zones (1 default)
  const zone = await prisma.zone.upsert({
    where: { businessId_slug: { businessId: business.id, slug: 'local-area' } },
    update: { name: 'Local Area', isActive: true },
    create: {
      businessId: business.id,
      slug: 'local-area',
      name: 'Local Area',
      description: 'Default service area',
      color: '#10B981',
      isActive: true,
      displayOrder: 0,
      zipCodes: [],
    },
  });

  // schedule templates (Mon–Sat 08:00–18:00) + zone assignments
  await prisma.scheduleTemplate.deleteMany({ where: { businessId: business.id } });
  const windowStart = new Date('1970-01-01T08:00:00Z');
  const windowEnd = new Date('1970-01-01T18:00:00Z');
  for (let dow = 1; dow <= 6; dow++) {
    await prisma.scheduleTemplate.create({
      data: { businessId: business.id, dayOfWeek: dow, windowStart, windowEnd, isActive: true },
    });
    await prisma.scheduleTemplateZone.upsert({
      where: {
        businessId_dayOfWeek_zoneId: {
          businessId: business.id,
          dayOfWeek: dow,
          zoneId: zone.id,
        },
      },
      update: {},
      create: { businessId: business.id, dayOfWeek: dow, zoneId: zone.id },
    });
  }

  // loyalty program + tiers default
  const program = await prisma.loyaltyProgram.upsert({
    where: { businessId: business.id },
    update: {},
    create: {
      businessId: business.id,
      isActive: true,
      appliesToAddons: false,
      countPackagesOnly: true,
      autoApply: true,
      name: 'Loyalty Rewards',
      description: 'Earn discounts as you service the same vehicle with us.',
    },
  });

  const existingTiers = await prisma.loyaltyTier.count({ where: { programId: program.id } });
  if (existingTiers === 0) {
    await prisma.loyaltyTier.createMany({
      data: [
        {
          programId: program.id,
          businessId: business.id,
          name: 'Tier 1 — 5 services',
          visitsRequired: 5,
          discountType: DiscountValueType.percentage,
          discountValue: 1500, // 15.00%
          displayOrder: 0,
          maxRedemptionsPerVehicle: 1,
        },
        {
          programId: program.id,
          businessId: business.id,
          name: 'Tier 2 — 10 services',
          visitsRequired: 10,
          discountType: DiscountValueType.percentage,
          discountValue: 2500, // 25.00%
          displayOrder: 1,
          maxRedemptionsPerVehicle: 1,
        },
      ],
    });
  }

  console.log(`✓ seeded business "${name}" (${slug})`);
}

async function main() {
  await seedBusiness('demo', 'Demo Car Wash');
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
