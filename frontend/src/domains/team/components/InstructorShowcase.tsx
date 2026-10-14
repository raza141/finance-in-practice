import type { ReactNode } from "react";

import { CosmicScrollStage } from "@/core/components/3d/CosmicScrollStage";
import { FinanceBackdrop } from "@/core/components/backdrop/FinanceBackdrop";

interface InstructorShowcaseProps {
  /** Intro section followed by one InstructorProfile per instructor. */
  children: ReactNode;
  count: number;
}

/** Scroll stage for /about: each instructor is one stop, over the rotating finance backdrop. */
export function InstructorShowcase({ children, count }: InstructorShowcaseProps) {
  return (
    <CosmicScrollStage count={count} className="-mt-20" backdrop={<FinanceBackdrop start="correlation" dim className="absolute inset-0" />}>
      {children}
    </CosmicScrollStage>
  );
}
