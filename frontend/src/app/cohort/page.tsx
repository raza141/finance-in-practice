import type { Metadata } from "next";

import { ComingSoon } from "@/core/components/ui/ComingSoon";

export const metadata: Metadata = {
  title: "Free Cohort",
  description: "A free group cohort for finance students. Dates and syllabus announced soon.",
  alternates: { canonical: "/cohort" },
};

export default function CohortPage() {
  return (
    <ComingSoon
      eyebrow="Free Cohort"
      title="Learn alongside a cohort, free"
      description="A free, live group programme covering core finance and quant skills. Dates and syllabus will be announced here; book a free diagnostic session meanwhile to get a head start."
    />
  );
}
