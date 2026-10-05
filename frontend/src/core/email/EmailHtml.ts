import { siteConfig } from "@/core/config/site";

export interface EmailMessage {
  subject: string;
  html: string;
  text: string;
}

/**
 * Inline-styled HTML building blocks for transactional email. Every piece of
 * user-entered text goes through `escape` (text and attribute values alike).
 * Pure: safe to import anywhere.
 */
export class EmailHtml {
  private static readonly ENTITIES: Record<string, string> = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  };

  static escape(value: string): string {
    return value.replace(/[&<>"']/g, (ch) => EmailHtml.ENTITIES[ch]);
  }

  /** Escaped text with line breaks kept. */
  static paragraph(value: string): string {
    return `<p style="margin:0 0 16px;line-height:1.6">${EmailHtml.escape(value).replace(/\r?\n/g, "<br>")}</p>`;
  }

  /** Label/value rows. Values are escaped here unless passed as `{ html }` (already safe). */
  static table(rows: readonly [string, string | { html: string }][]): string {
    const cells = rows
      .map(
        ([label, value]) =>
          `<tr><td style="padding:6px 16px 6px 0;color:#64748b;vertical-align:top;white-space:nowrap">${EmailHtml.escape(label)}</td>` +
          `<td style="padding:6px 0;color:#0f172a">${typeof value === "string" ? EmailHtml.escape(value).replace(/\r?\n/g, "<br>") : value.html}</td></tr>`,
      )
      .join("");
    return `<table role="presentation" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin:0 0 20px;font-size:15px">${cells}</table>`;
  }

  /** Link to an http(s) URL; anything else is shown as plain text. */
  static link(url: string, label = url): string {
    if (!/^https?:\/\/\S+$/i.test(url)) return EmailHtml.escape(label);
    return `<a href="${EmailHtml.escape(url)}" style="color:#0e7490">${EmailHtml.escape(label)}</a>`;
  }

  static button(url: string, label: string): string {
    return (
      `<p style="margin:24px 0"><a href="${EmailHtml.escape(url)}" ` +
      `style="display:inline-block;background:#0b1120;color:#ffffff;text-decoration:none;padding:12px 22px;border-radius:6px;font-weight:600">` +
      `${EmailHtml.escape(label)}</a></p>`
    );
  }

  /** Branded shell around already-built (safe) body HTML. */
  static document(title: string, bodyHtml: string): string {
    return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${EmailHtml.escape(title)}</title></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:Arial,Helvetica,sans-serif;color:#0f172a">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:24px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:8px;overflow:hidden">
<tr><td style="background:#0b1120;padding:20px 28px;color:#d4af37;font-family:Georgia,serif;font-size:20px;font-style:italic">${EmailHtml.escape(siteConfig.name)}</td></tr>
<tr><td style="padding:28px;font-size:15px">${bodyHtml}</td></tr>
<tr><td style="padding:16px 28px;border-top:1px solid #e2e8f0;color:#64748b;font-size:12px">${EmailHtml.escape(siteConfig.name)} · <a href="${siteConfig.url}" style="color:#64748b">${siteConfig.domain}</a></td></tr>
</table></td></tr></table></body></html>`;
  }
}
