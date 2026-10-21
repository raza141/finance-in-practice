import type { Metadata } from "next";
import Link from "next/link";

import { LegalPage, type LegalSection } from "@/core/components/ui/LegalPage";
import { siteConfig } from "@/core/config/site";
import { TermsRepository, type TermsVersion } from "@/domains/settings/server/TermsRepository";
import { TermsText } from "@/domains/settings/services/TermsText";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: "The terms for Finance in Practice tutoring: bookings, fees, payment, rescheduling, materials and what we can and cannot promise.",
  alternates: { canonical: "/terms" },
};

const UPDATED = "11 October 2026";

const DAY = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Dubai" });

/** The newest version published in admin (Settings → Terms), or null: the built-in text below applies. */
async function published(): Promise<TermsVersion | null> {
  try {
    return (await TermsRepository.fromEnv()?.latest()) ?? null;
  } catch (error) {
    console.error("terms: could not load the published version", error);
    return null;
  }
}

// Payment, rescheduling and scope mirror the default invoice terms (SettingsContract.INVOICE_TERMS); change both together.
export default async function TermsPage() {
  const { whatsapp } = siteConfig.contact;
  const version = await published();

  const sections: LegalSection[] = [
    {
      heading: "About these terms",
      body: (
        <p>
          These terms apply when you use this website or book tutoring with {siteConfig.name}, run by {whatsapp.owner} in{" "}
          {siteConfig.delivery.onsiteCity}, United Arab Emirates. By booking a session you agree to them.
        </p>
      ),
    },
    {
      heading: "The free diagnostic",
      body: (
        <p>
          The first 30-minute diagnostic session is free and comes with no obligation. We use it to see where you stand and suggest a plan.
          You decide afterwards whether to continue.
        </p>
      ),
    },
    {
      heading: "Sessions and fees",
      body: (
        <>
          <p>
            Sessions are 1-on-1, either in person in {siteConfig.delivery.onsiteCity} (at your home or in {siteConfig.delivery.onsiteArea})
            or live online. Fees are shown on each course page and confirmed on your invoice or quote before you pay. The invoice is what
            applies if the two ever differ.
          </p>
          <p>Fees cover the sessions or coaching period stated on your invoice. They are personal to you and cannot be transferred.</p>
        </>
      ),
    },
    {
      heading: "Payment",
      body: (
        <p>
          Payment is due by the date on your invoice, by bank transfer quoting the invoice number. A session is confirmed once its payment is
          received.
        </p>
      ),
    },
    {
      heading: "Rescheduling and cancellations",
      body: (
        <ul>
          <li>You can move a session with at least 24 hours&rsquo; notice, at no cost.</li>
          <li>Changes with less than 24 hours&rsquo; notice, or missed sessions, may count as delivered.</li>
          <li>If we have to cancel or move a session, we will offer a new time or refund that session in full.</li>
        </ul>
      ),
    },
    {
      heading: "No guaranteed results",
      body: (
        <p>
          We teach and prepare you as well as we can, but your exam result depends on many things outside our control. We do not guarantee
          that you will pass any exam or reach any grade.
        </p>
      ),
    },
    {
      heading: "Educational purposes only",
      body: (
        <p>
          Everything on this site, in sessions and in our materials is for education. It is not financial, investment, tax or legal advice,
          and {siteConfig.name} does not provide regulated advisory services. Market data shown on the site may be delayed or incomplete.
        </p>
      ),
    },
    {
      heading: "Exam bodies and trademarks",
      body: (
        <p>
          CFA® and Chartered Financial Analyst® are registered trademarks owned by CFA Institute. FRM® and Financial Risk Manager® are
          registered trademarks of the Global Association of Risk Professionals (GARP). We are independent of both. They do not endorse,
          promote or warrant the accuracy or quality of our services.
        </p>
      ),
    },
    {
      heading: "Our materials",
      body: (
        <p>
          Notes, exam maps, models, code and other materials we share are for your own study. Please do not resell, republish or share them
          publicly without our written permission.
        </p>
      ),
    },
    {
      heading: "Reviews",
      body: (
        <p>
          If you send us a review, you confirm it is your own honest experience. We may check it before publishing and can decline or remove
          reviews that are false, abusive or identify other people.
        </p>
      ),
    },
    {
      heading: "Liability",
      body: (
        <p>
          As far as the law allows, our total liability to you for any claim is limited to the fees you paid us for the sessions concerned.
          Nothing here limits rights you have under UAE consumer protection law.
        </p>
      ),
    },
    {
      heading: "Governing law",
      body: <p>These terms are governed by the laws of the Emirate of Abu Dhabi and the federal laws of the UAE.</p>,
    },
    {
      heading: "Contact and changes",
      body: (
        <p>
          Questions about these terms? WhatsApp <a href={`https://wa.me/${whatsapp.number}`}>{whatsapp.display}</a>. We may update these
          terms; the version on this page, with the date at the top, is the one that applies to new bookings.
        </p>
      ),
    },
  ];

  const live: LegalSection[] | null = version
    ? TermsText.parse(version.body).map((section) => ({
        heading: section.heading,
        body: (
          <>
            {section.blocks.map((block, i) =>
              block.kind === "p" ? (
                <p key={i}>{block.text}</p>
              ) : (
                <ul key={i}>
                  {block.items.map((item, j) => (
                    <li key={j}>{item}</li>
                  ))}
                </ul>
              ),
            )}
          </>
        ),
      }))
    : null;

  return (
    <LegalPage
      title="Terms of Service"
      updated={version ? DAY.format(version.createdAt) : UPDATED}
      intro={
        <p>
          Plain terms for 1-on-1 tutoring. How we handle your data is in our{" "}
          <Link href="/privacy" className="text-quant underline underline-offset-2">Privacy Policy</Link>.
        </p>
      }
      sections={live ?? sections}
    />
  );
}
