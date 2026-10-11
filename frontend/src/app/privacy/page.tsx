import type { Metadata } from "next";
import Link from "next/link";

import { LegalPage, type LegalSection } from "@/core/components/ui/LegalPage";
import { siteConfig } from "@/core/config/site";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "What Finance in Practice collects when you book, download or write a review, why, who processes it and how to have it deleted.",
  alternates: { canonical: "/privacy" },
};

const UPDATED = "11 October 2026";

export default function PrivacyPage() {
  const { email, whatsapp } = siteConfig.contact;
  const reach = (
    <>
      WhatsApp <a href={`https://wa.me/${whatsapp.number}`}>{whatsapp.display}</a>
      {email && (
        <>
          {" "}or email <a href={`mailto:${email}`}>{email}</a>
        </>
      )}
    </>
  );

  const sections: LegalSection[] = [
    {
      heading: "Who we are",
      body: (
        <p>
          {siteConfig.name} is a 1-on-1 finance tutoring service run by {whatsapp.owner} from {siteConfig.delivery.onsiteCity}, United Arab
          Emirates. We decide how the information below is used. You can reach us on {reach}.
        </p>
      ),
    },
    {
      heading: "What we collect and why",
      body: (
        <ul>
          <li>
            <strong>Booking a session:</strong> your name, email, phone number, chosen course and time slot. We use these to hold the
            session, send the calendar invite and contact you about it.
          </li>
          <li>
            <strong>Downloading a free resource:</strong> your email, which resource you asked for and whether you ticked &ldquo;exam
            tips&rdquo;. We use it to send you the file and, only if you opted in, occasional study tips.
          </li>
          <li>
            <strong>Writing a review:</strong> your name and the details you enter (such as city, exam and scores). With your consent we
            publish them on this site after checking them.
          </li>
          <li>
            <strong>Becoming a student:</strong> your name, contact details and session history, so we can schedule lessons and issue
            invoices and statements.
          </li>
          <li>
            <strong>Messaging us on WhatsApp:</strong> whatever you choose to send, used only to reply.
          </li>
          <li>
            <strong>Visiting the site:</strong> anonymous page-view statistics (pages visited, referring site, country, device type). No
            cookies are used for this and you cannot be identified from it.
          </li>
        </ul>
      ),
    },
    {
      heading: "Cookies",
      body: (
        <p>
          The public site sets no advertising or tracking cookies. Our analytics are cookieless. Only the admin area, used by us, sets a
          cookie to keep us signed in.
        </p>
      ),
    },
    {
      heading: "Who processes it for us",
      body: (
        <>
          <p>We never sell your data. A few services store or handle it on our behalf, only to run this site:</p>
          <ul>
            <li>Vercel: website hosting and anonymous analytics</li>
            <li>Neon: our database</li>
            <li>Cal.com: booking calendar and invites</li>
            <li>Resend: sending emails, such as your resource download</li>
            <li>Meta (WhatsApp): if you message us there</li>
          </ul>
          <p>Some of these services store data outside the UAE, for example in the United States or the European Union.</p>
        </>
      ),
    },
    {
      heading: "How long we keep it",
      body: (
        <ul>
          <li>Booking details: for as long as you are a student and up to 12 months after your last session.</li>
          <li>Resource emails: until you ask us to delete them or unsubscribe from tips.</li>
          <li>Invoices and payment records: as long as UAE accounting rules require.</li>
          <li>Published reviews: until you ask us to take them down.</li>
        </ul>
      ),
    },
    {
      heading: "Your rights",
      body: (
        <p>
          You can ask to see the data we hold about you, correct it, have it deleted, take back your consent (for example to a published
          review or to exam tips), or object to how we use it. Message us on {reach} and we will reply within 30 days. These rights
          follow the UAE Personal Data Protection Law (Federal Decree-Law No. 45 of 2021).
        </p>
      ),
    },
    {
      heading: "Security",
      body: (
        <p>
          Data is sent over HTTPS, the admin area is password-protected, and invoice links are private, unguessable links. No system is
          perfectly secure; if a breach affects you, we will tell you.
        </p>
      ),
    },
    {
      heading: "Children",
      body: <p>Our services are for university students and professionals. We do not knowingly collect data from anyone under 18 without a parent or guardian.</p>,
    },
    {
      heading: "Changes",
      body: <p>If this policy changes, the new version will appear here with a new date at the top.</p>,
    },
  ];

  return (
    <LegalPage
      title="Privacy Policy"
      updated={UPDATED}
      intro={
        <p>
          The short version: we collect only what we need to teach you and reply to you, we do not sell it, and you can ask us to delete it
          at any time. See also our <Link href="/terms" className="text-quant underline underline-offset-2">Terms of Service</Link>.
        </p>
      }
      sections={sections}
    />
  );
}
