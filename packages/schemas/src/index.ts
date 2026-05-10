import { z } from 'zod';

export const uuid = z.string().uuid();
export const cents = z.number().int().min(0);
export const bps = z.number().int().min(0).max(10000);
export const e164 = z.string().regex(/^\+[1-9]\d{1,14}$/, 'Invalid E.164 phone');
export const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
export const isoDateTime = z.string().datetime({ offset: true });

// ----------------------------- Business features -----------------------------
export const BusinessFeaturesSchema = z.object({
  loyalty: z.boolean().default(true),
  photos: z.boolean().default(true),
  promo_codes: z.boolean().default(true),
  multiple_resources: z.boolean().default(false),
  custom_domain: z.boolean().default(false),
  sms: z.boolean().default(false),
  google_calendar: z.boolean().default(true),
});
export type BusinessFeatures = z.infer<typeof BusinessFeaturesSchema>;

// ----------------------------- Booking -----------------------------
export const AvailabilityQuerySchema = z.object({
  businessId: uuid,
  zoneId: uuid,
  date: isoDate,
  packageId: uuid,
  vehicleTypeId: uuid,
  addonIds: z.array(uuid).default([]),
});

export const AddonSelectionSchema = z.object({
  addonId: uuid,
  quantity: z.number().int().min(1).max(20).default(1),
});

export const PricePreviewInputSchema = z.object({
  businessId: uuid,
  packageId: uuid,
  vehicleTypeId: uuid,
  vehicleId: uuid.optional(),
  zoneId: uuid.optional(),
  customerEmail: z.string().email().optional(),
  addons: z.array(AddonSelectionSchema).default([]),
  promoCode: z.string().trim().toUpperCase().optional(),
});

export const BookingVehicleInputSchema = z.object({
  existingVehicleId: uuid.optional(),
  vehicleTypeId: uuid,
  make: z.string().trim().min(1).max(50).optional(),
  model: z.string().trim().min(1).max(50).optional(),
  year: z.number().int().min(1900).max(2100).optional(),
  color: z.string().trim().max(30).optional(),
  plate: z.string().trim().toUpperCase().max(15).optional(),
  plateState: z.string().trim().toUpperCase().length(2).optional(),
  vin: z.string().trim().toUpperCase().length(17).regex(/^[A-HJ-NPR-Z0-9]{17}$/).optional(),
  nickname: z.string().max(50).optional(),
});

export const BookingCustomerInputSchema = z.object({
  email: z.string().email().toLowerCase(),
  phone: e164,
  firstName: z.string().trim().min(1).max(60),
  lastName: z.string().trim().max(60).optional(),
  addressLine1: z.string().trim().min(3).max(200),
  addressLine2: z.string().trim().max(100).optional(),
  addressCity: z.string().trim().min(1).max(80),
  addressState: z.string().trim().length(2),
  addressZip: z.string().trim().min(3).max(12),
  addressLat: z.number().optional(),
  addressLng: z.number().optional(),
  addressPlaceId: z.string().optional(),
  customerInstructions: z.string().max(500).optional(),
  marketingConsent: z.boolean().default(false),
  nonRefundableDepositAccepted: z.literal(true),
});

export const BookingEvidenceConsentSchema = z.object({
  currentStateAccepted: z.literal(true),
  marketingUseConsent: z.boolean().default(false),
});

export const DepositMethodSchema = z.enum(['card', 'zelle']).default('card');
export const BalancePaymentMethodSchema = z.enum(['cash', 'zelle', 'card']);

export const BookingDraftInputSchema = z.object({
  businessId: uuid,
  zoneId: uuid,
  startsAt: isoDateTime,
  packageId: uuid,
  vehicleTypeId: uuid,
  addons: z.array(AddonSelectionSchema).default([]),
  vehicle: BookingVehicleInputSchema,
  customer: BookingCustomerInputSchema,
  evidenceConsent: BookingEvidenceConsentSchema,
  promoCode: z.string().trim().toUpperCase().optional(),
  idempotencyKey: uuid,
  depositMethod: DepositMethodSchema,
});
export type BookingDraftInput = z.infer<typeof BookingDraftInputSchema>;

// ----------------------------- Admin: Loyalty -----------------------------
export const LoyaltyProgramUpdateSchema = z.object({
  isActive: z.boolean().optional(),
  appliesToAddons: z.boolean().optional(),
  countPackagesOnly: z.boolean().optional(),
  resetOnRedemption: z.boolean().optional(),
  autoApply: z.boolean().optional(),
  name: z.string().max(80).optional(),
  description: z.string().max(500).optional(),
});

export const LoyaltyTierUpsertSchema = z.object({
  id: uuid.optional(),
  visitsRequired: z.number().int().min(1).max(1000),
  discountType: z.enum(['percentage', 'fixed']),
  discountValue: z.number().int().min(1),
  appliesToPackageIds: z.array(uuid).default([]),
  maxRedemptionsPerVehicle: z.number().int().min(1).default(1),
  displayOrder: z.number().int().min(0).default(0),
  name: z.string().max(80).optional(),
  isActive: z.boolean().default(true),
});

export const LoyaltyAdjustSchema = z.object({
  vehicleId: uuid,
  delta: z.number().int().refine((n) => n !== 0, 'delta cannot be 0'),
  reason: z.string().trim().min(3).max(500),
});

export const LoyaltyGrantManualSchema = z.object({
  appointmentId: uuid,
  tierId: uuid.optional(),
  discountType: z.enum(['percentage', 'fixed']),
  discountValue: z.number().int().min(1),
  reason: z.string().trim().min(3).max(500),
});

// ----------------------------- Admin: Appointment -----------------------------
export const AppointmentStatusSchema = z.enum([
  'draft',
  'pending_deposit',
  'confirmed',
  'on_the_way',
  'arrived',
  'in_progress',
  'completed',
  'cancelled',
  'no_show',
  'rescheduled',
]);

export const UpdateAppointmentStatusSchema = z.object({
  appointmentId: uuid,
  newStatus: AppointmentStatusSchema,
  reason: z.string().max(500).optional(),
});

export const AddManualExtraSchema = z.object({
  appointmentId: uuid,
  name: z.string().trim().min(1).max(100),
  priceCents: cents,
  quantity: z.number().int().min(1).max(100).default(1),
  durationMinutes: z.number().int().min(0).max(600).default(0),
  reason: z.string().trim().max(500).optional(),
});

export const RecordPaymentSchema = z.object({
  appointmentId: uuid,
  kind: z.enum(['final', 'tip', 'extra']),
  method: z.enum(['card_online', 'card_terminal', 'cash', 'zelle', 'venmo', 'cashapp', 'other']),
  amountCents: z.number().int(),
  externalReference: z.string().max(100).optional(),
  notes: z.string().max(500).optional(),
});

// ----------------------------- Admin: Zones -----------------------------
const ZIP_RE = /^[A-Za-z0-9\- ]{3,12}$/;

export const ZoneUpsertSchema = z.object({
  id: uuid.optional(),
  name: z.string().trim().min(1).max(80),
  slug: z
    .string()
    .trim()
    .min(2)
    .max(40)
    .regex(/^[a-z0-9-]+$/, 'lowercase, numbers and dashes only')
    .optional(),
  color: z
    .string()
    .trim()
    .regex(/^#[0-9A-Fa-f]{6}$/, 'hex color like #3366ff')
    .optional()
    .or(z.literal('').transform(() => undefined)),
  description: z.string().trim().max(500).optional().or(z.literal('').transform(() => undefined)),
  zipCodes: z
    .array(z.string().trim().min(1, 'zip cannot be empty').regex(ZIP_RE, 'invalid zip'))
    .max(500)
    .default([])
    .transform((arr) =>
      Array.from(
        new Set(
          arr
            .map((z) => z.trim().toUpperCase())
            .filter((z) => z.length > 0),
        ),
      ),
    ),
  isActive: z.boolean().default(true),
  travelTimeMinutes: z.number().int().min(0).max(600).optional().nullable(),
  extraFeeCents: z.number().int().min(0).max(100_000).default(0),
  maxConcurrentJobs: z.number().int().min(1).max(20).default(1),
  displayOrder: z.number().int().min(0).default(0),
});
export type ZoneUpsertInput = z.infer<typeof ZoneUpsertSchema>;

// ----------------------------- Admin: Availability -----------------------------
const HHMM_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const hhmm = z.string().regex(HHMM_RE, 'Use HH:MM (24h)');
const dayOfWeek = z.number().int().min(0).max(6);

const TimeRangeSchema = z
  .object({ start: hhmm, end: hhmm })
  .refine((v) => toMinutes(v.end) > toMinutes(v.start), {
    message: 'End must be after start',
    path: ['end'],
  });

function toMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

export const WorkingHoursDaySchema = z
  .object({
    dayOfWeek,
    enabled: z.boolean(),
    start: hhmm.optional(),
    end: hhmm.optional(),
  })
  .refine((v) => !v.enabled || (v.start && v.end), {
    message: 'Start and end are required when the day is enabled',
    path: ['enabled'],
  })
  .refine(
    (v) => !v.enabled || !v.start || !v.end || toMinutes(v.end) > toMinutes(v.start),
    { message: 'End must be after start', path: ['end'] },
  );

export const SaveWorkingHoursSchema = z.object({
  days: z.array(WorkingHoursDaySchema).length(7),
});

export const BreaksDaySchema = z.object({
  dayOfWeek,
  windows: z.array(TimeRangeSchema).max(8).default([]),
});

export const SaveBreaksSchema = z.object({
  days: z.array(BreaksDaySchema).length(7),
});

export const BlockUpsertSchema = z
  .object({
    id: uuid.optional(),
    date: isoDate,
    allDay: z.boolean().default(false),
    start: hhmm.optional(),
    end: hhmm.optional(),
    reason: z.string().trim().max(200).optional().or(z.literal('').transform(() => undefined)),
  })
  .refine((v) => v.allDay || (v.start && v.end), {
    message: 'Start and end are required unless all-day is checked',
    path: ['start'],
  })
  .refine(
    (v) => v.allDay || !v.start || !v.end || toMinutes(v.end) > toMinutes(v.start),
    { message: 'End must be after start', path: ['end'] },
  );

export const BlockDeleteSchema = z.object({ id: uuid });

// ----------------------------- Photos -----------------------------
export const PhotoPresignSchema = z.object({
  appointmentId: uuid,
  phase: z.enum(['pre_service_customer', 'pre_service_admin', 'in_progress', 'post_service']),
  mimeType: z.enum(['image/jpeg', 'image/png', 'image/heic', 'image/webp']),
  bytes: z.number().int().min(1).max(10 * 1024 * 1024),
  slotTag: z.string().max(40).optional(),
  note: z.string().max(500).optional(),
});

export const PhotoCompleteSchema = z.object({
  photoId: uuid,
  width: z.number().int().optional(),
  height: z.number().int().optional(),
});
