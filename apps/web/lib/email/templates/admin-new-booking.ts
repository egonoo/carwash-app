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

export type AdminNewBookingInput = {
  /** Business display name — appears in the greeting. */
  businessName: string;
  /** Booking state at the moment the email was triggered. */
  state: 'awaiting_zelle' | 'pending_card' | 'confirmed';
  /** Customer name (first + last when available). */
  customerName: string;
  /** Customer email — clickable mailto. */
  customerEmail: string;
  /** Customer phone in display format. */
  customerPhone: string;
  /** Display string for the appointment start, in business timezone. */
  appointmentWhen: string;
  /** Service / package label snapshot. */
  packageName: string;
  /** Add-ons label like "Pet hair, Engine bay". Empty string omits the row. */
  addonsLabel?: string;
  /** Vehicle display label. */
  vehicleLabel: string;
  /** Zone label. */
  zoneName: string;
  /** Service address single-line label. */
  serviceAddress: string;
  /** Total in business currency, formatted. */
  totalFormatted: string;
  /** Deposit amount, formatted. */
  depositFormatted: string;
  /** Deposit method snapshot. */
  depositMethod: 'card' | 'zelle';
  /** Admin appointment detail URL — opens /appointments/{id}. */
  appointmentUrl?: string;
};

const STATE_COPY: Record<
  AdminNewBookingInput['state'],
  { eyebrowLabel: string; heading: string; lede: (b: string) => string }
> = {
  awaiting_zelle: {
    eyebrowLabel: 'Awaiting Zelle',
    heading: 'New booking — verify Zelle when it lands',
    lede: (b) =>
      `${b} just received a new booking with Zelle as the deposit method. Confirm the booking once the transfer hits the account.`,
  },
  pending_card: {
    eyebrowLabel: 'Pending deposit',
    heading: 'New booking — deposit processing',
    lede: (b) =>
      `${b} just received a new booking. The customer's card deposit is processing; we'll flip the appointment to confirmed automatically when Stripe captures it.`,
  },
  confirmed: {
    eyebrowLabel: 'Confirmed',
    heading: 'New confirmed booking',
    lede: (b) =>
      `${b} just had a new booking confirmed. Deposit captured — it's on the schedule.`,
  },
};

/**
 * Internal alert sent to the business owner / admin when a new booking comes
 * in. Recipient defaults to Business.email at the call site.
 */
export function renderAdminNewBookingEmail(input: AdminNewBookingInput): RenderedEmail {
  const copy = STATE_COPY[input.state];
  const subject = `[${input.businessName}] ${
    input.state === 'awaiting_zelle'
      ? 'New booking — Zelle pending'
      : input.state === 'confirmed'
        ? 'New confirmed booking'
        : 'New booking — deposit processing'
  } · ${input.customerName}`;

  const detailRows: DetailRow[] = [
    { label: 'When', value: input.appointmentWhen },
    { label: 'Customer', value: `${input.customerName} · ${input.customerPhone}` },
    { label: 'Customer email', value: input.customerEmail },
    { label: 'Service', value: input.packageName },
    ...(input.addonsLabel ? [{ label: 'Add-ons', value: input.addonsLabel }] : []),
    { label: 'Vehicle', value: input.vehicleLabel },
    { label: 'Zone', value: input.zoneName },
    { label: 'Address', value: input.serviceAddress },
    { label: 'Total', value: input.totalFormatted },
    {
      label: `Deposit (${input.depositMethod === 'card' ? 'card' : 'Zelle'})`,
      value: input.depositFormatted,
    },
  ];

  const cta = input.appointmentUrl
    ? ctaButton({ href: input.appointmentUrl, label: 'Open in admin' })
    : '';

  const bodyHtml = [
    eyebrow(copy.eyebrowLabel),
    heading(copy.heading),
    paragraph(copy.lede(input.businessName)),
    detailsTable(detailRows),
    cta,
    divider(),
    muted(
      'You receive this alert because your business email is set as the booking notification recipient. Update it from Settings → Business.',
    ),
  ]
    .filter(Boolean)
    .join('\n');

  const html = emailLayout({
    preheader: `${input.customerName} booked ${input.packageName} for ${input.appointmentWhen}.`,
    title: subject,
    bodyHtml,
    footerNote: 'Splash — automated booking alert for your business.',
  });

  const textParts = [
    copy.lede(input.businessName),
    '',
    detailsTextBlock(detailRows),
  ];
  if (input.appointmentUrl) textParts.push('', `Open: ${input.appointmentUrl}`);
  textParts.push(
    '',
    'You receive this alert because your business email is set as the booking notification recipient. Update it from Settings → Business.',
  );

  return { subject, html, text: textParts.join('\n') };
}
