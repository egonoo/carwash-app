import { Resend } from 'resend';

// TODO: Replace this Reply-To with the real Hostinger mailbox once it is
// provisioned. The same placeholder is rendered on /contact — keep them in
// sync. The `From:` is independent and lives in EMAIL_FROM (must be a sender
// verified in Resend; until splash.app DNS is set up, use a Resend-verified
// sandbox sender there).
export const REPLY_TO_EMAIL = 'hello@getsplashwash.com';

const DEFAULT_FROM = 'Splash <onboarding@resend.dev>';

export type EmailRecipient = string | string[];

export type SendEmailInput = {
  to: EmailRecipient;
  subject: string;
  html: string;
  text: string;
  /** Override the global Reply-To. Defaults to REPLY_TO_EMAIL. */
  replyTo?: EmailRecipient;
  /** Override the From. Defaults to process.env.EMAIL_FROM. */
  from?: string;
  /** Optional cc/bcc — used by future receipt and admin alert paths. */
  cc?: EmailRecipient;
  bcc?: EmailRecipient;
  /** Stable string used for Resend idempotency, mirrors how we key Stripe PIs. */
  idempotencyKey?: string;
  /** Free-form headers (e.g. List-Unsubscribe). */
  headers?: Record<string, string>;
  /** Resend tags for searchable telemetry. */
  tags?: { name: string; value: string }[];
};

export type SendEmailResult =
  | { ok: true; id: string; provider: 'resend' | 'dev-skip' }
  | { ok: false; error: string };

let cachedClient: Resend | null = null;

function getClient(): Resend | null {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return null;
  if (!cachedClient) cachedClient = new Resend(apiKey);
  return cachedClient;
}

function isDevSkip(): boolean {
  return process.env.DEV_SKIP_EMAIL === '1';
}

/**
 * Send a transactional email through Resend. Never throws — returns a tagged
 * result so callers can persist `sent` / `failed` against a Notification row
 * without try/catch noise. In dev (DEV_SKIP_EMAIL=1 or no RESEND_API_KEY) the
 * call is logged and a fake id is returned.
 */
export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  const from = input.from ?? process.env.EMAIL_FROM ?? DEFAULT_FROM;
  const replyTo = input.replyTo ?? REPLY_TO_EMAIL;

  if (isDevSkip()) {
    const id = `email_devskip_${Date.now().toString(36)}`;
    console.info('[email:dev-skip]', {
      id,
      from,
      to: input.to,
      subject: input.subject,
    });
    return { ok: true, id, provider: 'dev-skip' };
  }

  const client = getClient();
  if (!client) {
    return {
      ok: false,
      error: 'RESEND_API_KEY not configured (and DEV_SKIP_EMAIL is not set)',
    };
  }

  try {
    const res = await client.emails.send(
      {
        from,
        to: input.to,
        subject: input.subject,
        html: input.html,
        text: input.text,
        replyTo,
        ...(input.cc ? { cc: input.cc } : {}),
        ...(input.bcc ? { bcc: input.bcc } : {}),
        ...(input.headers ? { headers: input.headers } : {}),
        ...(input.tags ? { tags: input.tags } : {}),
      },
      input.idempotencyKey ? { idempotencyKey: input.idempotencyKey } : undefined,
    );

    if (res.error) {
      return { ok: false, error: res.error.message ?? 'Resend error' };
    }
    if (!res.data?.id) {
      return { ok: false, error: 'Resend returned no message id' };
    }
    return { ok: true, id: res.data.id, provider: 'resend' };
  } catch (err) {
    return { ok: false, error: (err as Error).message ?? String(err) };
  }
}
