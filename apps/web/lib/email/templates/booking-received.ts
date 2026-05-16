import {
  calloutBox,
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

export type BookingReceivedInput = {
  /** Customer-facing first name. */
  customerFirstName: string;
  /** Business display name — appears in copy and footer. */
  businessName: string;
  /** Display string for the appointment start, in business timezone. */
  appointmentWhen: string;
  /** Service / package label snapshot. */
  packageName: string;
  /** Vehicle label like "2022 Tesla Model 3" or "Tesla Model 3 (Black)". */
  vehicleLabel: string;
  /** Service address single-line label. */
  serviceAddress: string;
  /** Total in business currency, formatted (e.g. "$129.00"). */
  totalFormatted: string;
  /** Deposit amount in business currency, formatted. */
  depositFormatted: string;
  /** Balance due on service, formatted. */
  balanceFormatted: string;
  /** Deposit method picked at booking time. */
  depositMethod: 'card' | 'zelle';
  /** Self-serve manage URL — pass an empty string to omit the CTA. */
  manageUrl?: string;
  /** Required only when depositMethod === 'zelle'. */
  zelle?: {
    handle: string;
    memo: string;
  };
};

export type RenderedEmail = {
  subject: string;
  html: string;
  text: string;
};

/**
 * Customer "we got your booking" email.
 *
 *  - depositMethod = 'card'  → reservation received, deposit charging via Stripe
 *  - depositMethod = 'zelle' → reservation held, awaiting Zelle verification
 */
export function renderBookingReceivedEmail(input: BookingReceivedInput): RenderedEmail {
  const isZelle = input.depositMethod === 'zelle';

  const subject = isZelle
    ? `Reservation received — send Zelle to confirm · ${input.businessName}`
    : `We got your booking · ${input.businessName}`;

  const intro = isZelle
    ? `Hi ${input.customerFirstName} — we've reserved your slot with ${input.businessName}. To confirm, send the deposit by Zelle and we'll lock it in as soon as the team verifies the transfer.`
    : `Hi ${input.customerFirstName} — we got your booking with ${input.businessName}. Your deposit is processing; you'll get a separate confirmation as soon as it clears.`;

  const detailRows: DetailRow[] = [
    { label: 'When', value: input.appointmentWhen },
    { label: 'Service', value: input.packageName },
    { label: 'Vehicle', value: input.vehicleLabel },
    { label: 'Address', value: input.serviceAddress },
    { label: 'Total', value: input.totalFormatted },
    {
      label: isZelle ? 'Deposit (send via Zelle)' : 'Deposit (charging)',
      value: input.depositFormatted,
    },
    { label: 'Balance on service', value: input.balanceFormatted },
  ];

  const zelleCallout =
    isZelle && input.zelle
      ? calloutBox(
          `<strong style="display:block;margin-bottom:6px;">Zelle instructions</strong>
           Send <strong>${escapeAttr(input.depositFormatted)}</strong> to <code style="background:rgba(255,255,255,0.06);padding:1px 6px;border-radius:4px;">${escapeAttr(input.zelle.handle)}</code><br/>
           Memo / note: <code style="background:rgba(255,255,255,0.06);padding:1px 6px;border-radius:4px;">${escapeAttr(input.zelle.memo)}</code><br/>
           If we don't receive the deposit within 24 hours the reservation will be released.`,
        )
      : '';

  const cta = input.manageUrl
    ? ctaButton({ href: input.manageUrl, label: 'Manage your appointment' })
    : '';

  const bodyHtml = [
    eyebrow(isZelle ? 'Reservation pending' : 'Booking received'),
    heading(isZelle ? 'Send Zelle to confirm your slot' : 'We got your booking'),
    paragraph(intro),
    detailsTable(detailRows),
    zelleCallout,
    cta,
    divider(),
    muted(
      isZelle
        ? `Questions? Just reply to this email — it goes straight to the ${input.businessName} team.`
        : `You'll get a separate confirmation once your deposit clears. Reply to this email to reach the ${input.businessName} team.`,
    ),
  ]
    .filter(Boolean)
    .join('\n');

  const html = emailLayout({
    preheader: isZelle
      ? `Send your deposit via Zelle to confirm your appointment with ${input.businessName}.`
      : `Your booking with ${input.businessName} is in — confirmation will follow once the deposit clears.`,
    title: subject,
    bodyHtml,
    footerNote: `You're receiving this because you booked an appointment with ${input.businessName} via Splash.`,
  });

  const textParts = [
    intro,
    '',
    detailsTextBlock(detailRows),
  ];
  if (isZelle && input.zelle) {
    textParts.push(
      '',
      'Zelle instructions',
      `  Amount: ${input.depositFormatted}`,
      `  Send to: ${input.zelle.handle}`,
      `  Memo: ${input.zelle.memo}`,
      '',
      "If we don't receive the deposit within 24h the reservation will be released.",
    );
  }
  if (input.manageUrl) {
    textParts.push('', `Manage: ${input.manageUrl}`);
  }
  textParts.push(
    '',
    isZelle
      ? `Questions? Just reply to this email — it goes straight to the ${input.businessName} team.`
      : `You'll get a separate confirmation once your deposit clears. Reply to this email to reach the ${input.businessName} team.`,
  );

  return { subject, html, text: textParts.join('\n') };
}

function escapeAttr(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
