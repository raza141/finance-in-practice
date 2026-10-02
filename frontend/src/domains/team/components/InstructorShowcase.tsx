import type { ReactNode } from "react";

import { CosmicScrollStage } from "@/core/components/3d/CosmicScrollStage";

interface InstructorShowcaseProps {
  /** Intro section followed by one InstructorProfile per instructor. */
  children: ReactNode;
  count: number;
}

/** Scroll stage for /about: each instructor is one stop on the cosmic journey. */
export function InstructorShowcase({ children, count }: InstructorShowcaseProps) {
  return (
    <CosmicScrollStage count={count} className="-mt-20">
      {children}
    </CosmicScrollStage>
  );
}
