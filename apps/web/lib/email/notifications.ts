import { Prisma } from '@splash/db';
import { prisma } from '@/lib/db';

/**
 * Minimal Prisma client surface this module touches. Accepting the union of
 * `PrismaClient` and `Prisma.TransactionClient` lets the enqueue helper run
 * inside an existing `withTenant` transaction *or* standalone — without
 * coupling to either lib/rls or lib/db at the type level.
 */
type AnyPrisma = Prisma.TransactionClient | typeof prisma;

export type EnqueueEmailNotificationInput = {
  businessId: string;
  template: string;
  payload?: Prisma.InputJsonValue;
  appointmentId?: string | null;
  customerId?: string | null;
  userId?: string | null;
  /** Defaults to "now" — set in the future for scheduled reminders. */
  scheduledAt?: Date;
};

/**
 * Insert a `notification` row in `queued` state for a future Resend dispatch.
 * Caller is responsible for actually sending the email and then calling
 * `markNotificationSent` / `markNotificationFailed` with the result.
 *
 * Designed to be called inside a `withTenant` transaction so it commits or
 * rolls back atomically with the booking-side work.
 */
export async function enqueueEmailNotification(
  tx: AnyPrisma,
  input: EnqueueEmailNotificationInput,
): Promise<{ id: string }> {
  const row = await tx.notification.create({
    data: {
      businessId: input.businessId,
      appointmentId: input.appointmentId ?? null,
      customerId: input.customerId ?? null,
      userId: input.userId ?? null,
      channel: 'email',
      template: input.template,
      status: 'queued',
      scheduledAt: input.scheduledAt ?? new Date(),
      ...(input.payload !== undefined ? { payload: input.payload } : {}),
    },
    select: { id: true },
  });
  return { id: row.id };
}

/**
 * Flip a queued notification to `sent` and record Resend's message id.
 * Uses the global `prisma` client — call after the surrounding transaction
 * has committed so a delivery failure can't roll back booking state.
 */
export async function markNotificationSent(
  notificationId: string,
  externalId: string,
): Promise<void> {
  await prisma.notification.update({
    where: { id: notificationId },
    data: {
      status: 'sent',
      sentAt: new Date(),
      externalProvider: 'resend',
      externalId,
      error: null,
      failedAt: null,
    },
  });
}

/**
 * Flip a queued notification to `failed` with the provider error.
 */
export async function markNotificationFailed(
  notificationId: string,
  error: string,
): Promise<void> {
  await prisma.notification.update({
    where: { id: notificationId },
    data: {
      status: 'failed',
      failedAt: new Date(),
      externalProvider: 'resend',
      error: error.slice(0, 1000),
    },
  });
}

/**
 * Cancel a queued notification — used by future reschedule/cancel flows so a
 * pending reminder doesn't fire after the appointment changes.
 */
export async function cancelQueuedNotification(notificationId: string): Promise<void> {
  await prisma.notification.update({
    where: { id: notificationId },
    data: { status: 'cancelled' },
  });
}

/**
 * Stable string identifiers for the templates this module knows about. Stored
 * in `notification.template` so we can filter and render history later.
 */
export const EmailTemplate = {
  BookingReceived: 'booking.received',
  BookingConfirmed: 'booking.confirmed',
  AdminNewBooking: 'admin.new_booking',
} as const;

export type EmailTemplateName = (typeof EmailTemplate)[keyof typeof EmailTemplate];
