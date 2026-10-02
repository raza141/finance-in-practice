import type { Metadata } from "next";

import { ComingSoon } from "@/core/components/ui/ComingSoon";

export const metadata: Metadata = {
  title: "Journal",
  description: "Essays and worked notes on financial theory, risk and Python for finance.",
  alternates: { canonical: "/journal" },
};

export default function JournalPage() {
  return (
    <ComingSoon
      eyebrow="Journal"
      title="Notes from the trading desk of theory"
      description="Worked explanations of exam topics, risk models and the Python behind them. The first entries are being written now."
    />
  );
}
