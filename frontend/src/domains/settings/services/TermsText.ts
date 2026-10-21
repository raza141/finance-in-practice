import { siteConfig } from "@/core/config/site";

export type TermsBlock = { kind: "p"; text: string } | { kind: "ul"; items: string[] };
export interface TermsSection {
  heading: string;
  blocks: TermsBlock[];
}

/**
 * The terms and conditions as plain text, edited in admin and published as a
 * new version: "## " starts a section, a blank line starts a paragraph, "- "
 * lines make a list. Pure.
 */
export class TermsText {
  static readonly LIMITS = { min: 50, max: 40_000 } as const;

  static parse(body: string): TermsSection[] {
    const sections: TermsSection[] = [];
    for (const chunk of body.replace(/\r\n?/g, "\n").split(/\n(?=## )/)) {
      const lines = chunk.split("\n");
      const first = lines[0]?.trim() ?? "";
      if (!first.startsWith("## ")) continue;
      const blocks: TermsBlock[] = [];
      for (const para of lines.slice(1).join("\n").split(/\n\s*\n/)) {
        const rows = para.split("\n").map((l) => l.trim()).filter(Boolean);
        if (rows.length === 0) continue;
        if (rows.every((r) => r.startsWith("- "))) blocks.push({ kind: "ul", items: rows.map((r) => r.slice(2).trim()) });
        else blocks.push({ kind: "p", text: rows.join(" ") });
      }
      sections.push({ heading: first.slice(3).trim(), blocks });
    }
    return sections;
  }

  /** Null when it can be published; otherwise what to fix. */
  static check(body: string): string | null {
    const length = body.trim().length;
    if (length < TermsText.LIMITS.min || length > TermsText.LIMITS.max) return `Between ${TermsText.LIMITS.min} and ${TermsText.LIMITS.max} characters.`;
    const sections = TermsText.parse(body);
    if (sections.length === 0) return 'Start each section with a line like "## Payment".';
    if (sections.some((s) => !s.heading || s.blocks.length === 0)) return "Every section needs a heading and some text.";
    return null;
  }

  /** The starting draft in admin before any version is published: the built-in /terms text, plus monthly agreements. */
  static draft(): string {
    const { whatsapp } = siteConfig.contact;
    const { onsiteCity, onsiteArea } = siteConfig.delivery;
    return `## About these terms
These terms apply when you use this website or book tutoring with ${siteConfig.name}, run by ${whatsapp.owner} in ${onsiteCity}, United Arab Emirates. By registering or booking a session you agree to them.

## The free diagnostic
The first 30-minute diagnostic session is free and comes with no obligation. We use it to see where you stand and suggest a plan. You decide afterwards whether to continue.

## Sessions and fees
Sessions are 1-on-1, either in person in ${onsiteCity} (at your home or in ${onsiteArea}) or live online. Fees are shown on each course page and confirmed on your invoice, quote or agreement before you pay. The invoice is what applies if they ever differ.

Fees cover the sessions or coaching period stated on your invoice. They are personal to you and cannot be transferred.

## Monthly agreements
A monthly agreement states the fee, the dates (for example until your exam) and the hours included each month. You accept it in your student portal; no signature is needed.

- Hours included in a month are for that month only. Unused hours do not carry over.
- Hours count the time actually studied, as recorded by your instructor, which can differ from the time booked.
- Once a month's hours are used, more sessions need your instructor's approval. Extra hours may be charged at the agreed rate.

## Payment
Payment is due by the date on your invoice, by bank transfer quoting the invoice number. A session is confirmed once its payment is received.

## Rescheduling and cancellations
- You can move a session with at least 24 hours' notice, at no cost.
- Changes with less than 24 hours' notice, or missed sessions, may count as delivered.
- If we have to cancel or move a session, we will offer a new time or refund that session in full.

## No guaranteed results
We teach and prepare you as well as we can, but your exam result depends on many things outside our control. We do not guarantee that you will pass any exam or reach any grade.

## Educational purposes only
Everything on this site, in sessions and in our materials is for education. It is not financial, investment, tax or legal advice, and ${siteConfig.name} does not provide regulated advisory services. Market data shown on the site may be delayed or incomplete.

## Exam bodies and trademarks
CFA® and Chartered Financial Analyst® are registered trademarks owned by CFA Institute. FRM® and Financial Risk Manager® are registered trademarks of the Global Association of Risk Professionals (GARP). We are independent of both. They do not endorse, promote or warrant the accuracy or quality of our services.

## Our materials
Notes, exam maps, models, code and other materials we share are for your own study. Please do not resell, republish or share them publicly without our written permission.

## Reviews
If you send us a review, you confirm it is your own honest experience. We may check it before publishing and can decline or remove reviews that are false, abusive or identify other people.

## Liability
As far as the law allows, our total liability to you for any claim is limited to the fees you paid us for the sessions concerned. Nothing here limits rights you have under UAE consumer protection law.

## Governing law
These terms are governed by the laws of the Emirate of Abu Dhabi and the federal laws of the UAE.

## Contact and changes
Questions about these terms? WhatsApp ${whatsapp.display}. We may update these terms; the version on this page, with the date at the top, is the one that applies. When they change, your portal asks you to accept the new version before your next booking.
`;
  }
}
