import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { siteConfig } from "@/core/config/site";
import { AdminAuth } from "@/domains/admin/server/AdminAuth";
import { AutoPrint } from "@/domains/courses/components/AutoPrint";
import { CourseView } from "@/domains/courses/components/CourseView";
import { CourseRepository } from "@/domains/courses/server/CourseRepository";
import { PrintButton } from "@/domains/invoices/components/PrintButton";
import { TestimonialRepository } from "@/domains/testimonials/server/TestimonialRepository";

export const metadata: Metadata = { title: "Course PDF", robots: { index: false, follow: false } };

/** Site chrome off; dark backgrounds kept so the PDF matches the website. */
const PRINT_CSS =
  "@media print{body>:not(main){display:none!important}html,body{-webkit-print-color-adjust:exact;print-color-adjust:exact}main{padding-top:0!important}@page{margin:0}}";

/** The saved course (draft or live) as the public page, opened straight into the print dialog. Admins only. */
export default async function CoursePdfPage({ params }: PageProps<"/admin/course-pdf/[id]">) {
  await AdminAuth.require();
  const course = await CourseRepository.fromEnv()?.byId((await params).id);
  if (!course) notFound();
  const ticker = course.testimonialTicker;
  const testimonials = (ticker && (await TestimonialRepository.fromEnv()?.approvedFor(ticker))) || [];
  const url = `${siteConfig.url}/courses/${course.slug}`;

  return (
    <div data-plain-page className="pt-20 font-body print:pt-0">
      <style>{PRINT_CSS}</style>
      <AutoPrint />
      <p className="sticky top-0 z-10 flex justify-center gap-4 bg-gold/90 py-1 font-mono text-[11px] tracking-wider text-canvas uppercase print:hidden">
        Choose “Save as PDF” in the print dialog ·
        <PrintButton className="underline" />
      </p>
      <CourseView
        course={course}
        testimonials={testimonials}
        booking={
          <p className="text-center text-lg">
            Book your session at <span className="text-gold">{url.replace("https://", "")}</span>
          </p>
        }
      />
    </div>
  );
}
