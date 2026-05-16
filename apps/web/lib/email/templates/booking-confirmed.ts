import {
  ctaButton,
  detailsTable,
  detailsTextBlock,
  divider,
  emailLayout,
  eyebrow,
  heading,
  muted,
  paragraph,
  type DetailRow,
} from './_layout';
import type { RenderedEmail } from './booking-received';

export type BookingConfirmedInput = {
  customerFirstName: string;
  businessName: string;
  appointmentWhen: string;
  packageName: string;
  vehicleLabel: string;
  serviceAddress: string;
  totalFormatted: string;
  depositPaidFormatted: string;
  balanceDueFormatted: string;
  /** Method that captured the deposit. Drives the receipt copy. */
  depositMethod: 'card' | 'zelle' | 'cash' | 'other';
  manageUrl?: string;
};

/**
 * Customer "your booking is confirmed" email — sent after the deposit is
 * captured (either Stripe `payment_intent.succeeded` or admin Zelle confirm).
 */
export function renderBookingConfirmedEmail(input: BookingConfirmedInput): RenderedEmail {
  const subject = `Your booking is confirmed · ${input.businessName}`;

  const intro = `Hi ${input.customerFirstName} — your appointment with ${input.businessName} is locked in. We've received your deposit; here are the details.`;

  const methodLabel =
    input.depositMethod === 'card'
      ? 'Card'
      : input.depositMethod === 'zelle'
        ? 'Zelle'
        : input.depositMethod === 'cash'
          ? 'Cash'
          : 'Other';

  const detailRows: DetailRow[] = [
    { label: 'When', value: input.appointmentWhen },
    { label: 'Service', value: input.packageName },
    { label: 'Vehicle', value: input.vehicleLabel },
    { label: 'Address', value: input.serviceAddress },
    { label: 'Total', value: input.totalFormatted },
    { label: `Deposit paid (${methodLabel})`, value: input.depositPaidFormatted },
    { label: 'Balance due on service', value: input.balanceDueFormatted },
  ];

  const cta = input.manageUrl
    ? ctaButton({ href: input.manageUrl, label: 'Manage your appointment' })
    : '';

  const bodyHtml = [
    eyebrow('Confirmed'),
    heading('Your booking is confirmed'),
    paragraph(intro),
    detailsTable(detailRows),
    cta,
    divider(),
    muted(
      `On the day of service, the ${input.businessName} team will let you know when they're on the way. Reply to this email if anything needs to change.`,
    ),
  ]
    .filter(Boolean)
    .join('\n');

  const html = emailLayout({
    preheader: `Your appointment with ${input.businessName} is locked in.`,
    title: subject,
    bodyHtml,
    footerNote: `You're receiving this because you booked an appointment with ${input.businessName} via Splash.`,
  });

  const textParts = [
    intro,
    '',
    detailsTextBlock(detailRows),
  ];
  if (input.manageUrl) textParts.push('', `Manage: ${input.manageUrl}`);
  textParts.push(
    '',
    `On the day of service, the ${input.businessName} team will let you know when they're on the way. Reply to this email if anything needs to change.`,
  );

  return { subject, html, text: textParts.join('\n') };
}
