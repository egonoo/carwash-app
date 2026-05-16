function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export type LayoutInput = {
  /** Optional preheader text shown in the inbox preview row. */
  preheader?: string;
  /** Page title — usually the same as the email subject. */
  title: string;
  /** HTML body — must be email-safe (table-friendly, inline styles). */
  bodyHtml: string;
  /** Footer note rendered below the divider. Plain text — will be escaped. */
  footerNote?: string;
};

const BG = '#06070A';
const SURFACE = '#0B0E14';
const BORDER = '#1F242E';
const TEXT = '#FFFFFF';
const TEXT_DIM = '#A6ADB8';
const ACCENT = '#5EB1FF';

/**
 * Wraps the given body HTML in a branded, email-client-safe shell. Inline
 * styles only — no <style> blocks, no web fonts, no external assets.
 */
export function emailLayout({ preheader, title, bodyHtml, footerNote }: LayoutInput): string {
  const safeTitle = escapeHtml(title);
  const safePreheader = preheader ? escapeHtml(preheader) : '';
  const safeFooter = footerNote ? escapeHtml(footerNote) : '';
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="x-apple-disable-message-reformatting" />
    <title>${safeTitle}</title>
  </head>
  <body style="margin:0;padding:0;background:${BG};color:${TEXT};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
    ${
      safePreheader
        ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${safePreheader}</div>`
        : ''
    }
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${BG};">
      <tr>
        <td align="center" style="padding:32px 16px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;">
            <tr>
              <td style="padding-bottom:24px;">
                <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                  <tr>
                    <td style="background:linear-gradient(135deg,#0A84FF,#5E5CE6);width:28px;height:28px;border-radius:6px;text-align:center;vertical-align:middle;color:#fff;font-weight:700;font-size:14px;line-height:28px;">S</td>
                    <td style="padding-left:10px;font-size:15px;font-weight:600;color:${TEXT};letter-spacing:-0.01em;">Splash</td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="background:${SURFACE};border:1px solid ${BORDER};border-radius:14px;padding:28px;">
                ${bodyHtml}
              </td>
            </tr>
            <tr>
              <td style="padding:20px 4px 0 4px;color:${TEXT_DIM};font-size:12px;line-height:1.6;">
                ${safeFooter ? `<div>${safeFooter}</div>` : ''}
                <div style="margin-top:6px;">Splash Software, Inc. — the operating system for mobile detailing teams.</div>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

export function paragraph(text: string): string {
  return `<p style="margin:0 0 14px 0;color:${TEXT};font-size:15px;line-height:1.6;">${escapeHtml(text)}</p>`;
}

export function muted(text: string): string {
  return `<p style="margin:0 0 14px 0;color:${TEXT_DIM};font-size:13px;line-height:1.6;">${escapeHtml(text)}</p>`;
}

export function heading(text: string): string {
  return `<h1 style="margin:0 0 16px 0;color:${TEXT};font-size:22px;line-height:1.3;font-weight:600;letter-spacing:-0.01em;">${escapeHtml(text)}</h1>`;
}

export function eyebrow(text: string): string {
  return `<div style="margin:0 0 12px 0;color:${ACCENT};font-size:11px;letter-spacing:0.18em;text-transform:uppercase;font-weight:600;">${escapeHtml(text)}</div>`;
}

export function divider(): string {
  return `<div style="height:1px;background:${BORDER};margin:20px 0;"></div>`;
}

export type DetailRow = { label: string; value: string };

export function detailsTable(rows: DetailRow[]): string {
  const inner = rows
    .map(
      (r) => `
          <tr>
            <td style="padding:8px 0;color:${TEXT_DIM};font-size:13px;width:40%;vertical-align:top;">${escapeHtml(r.label)}</td>
            <td style="padding:8px 0;color:${TEXT};font-size:14px;font-weight:500;text-align:right;vertical-align:top;">${escapeHtml(r.value)}</td>
          </tr>`,
    )
    .join('');
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-top:1px solid ${BORDER};border-bottom:1px solid ${BORDER};margin:8px 0;">
      ${inner}
    </table>`;
}

export function ctaButton({ href, label }: { href: string; label: string }): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:20px 0 6px 0;">
      <tr>
        <td style="background:${TEXT};border-radius:8px;">
          <a href="${escapeHtml(href)}" style="display:inline-block;padding:11px 18px;color:${BG};font-size:14px;font-weight:600;text-decoration:none;letter-spacing:-0.01em;">${escapeHtml(label)}</a>
        </td>
      </tr>
    </table>`;
}

export function calloutBox(htmlInside: string): string {
  return `<div style="background:rgba(10,132,255,0.08);border:1px solid rgba(94,177,255,0.25);border-radius:10px;padding:14px 16px;margin:8px 0 16px 0;color:${TEXT};font-size:14px;line-height:1.55;">${htmlInside}</div>`;
}

/** Plain-text helper to render a "Label: value" details list with line breaks. */
export function detailsTextBlock(rows: DetailRow[]): string {
  return rows.map((r) => `${r.label}: ${r.value}`).join('\n');
}

export { escapeHtml };
