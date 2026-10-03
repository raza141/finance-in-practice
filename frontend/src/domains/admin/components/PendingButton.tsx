"use client";

import { useFormStatus } from "react-dom";
import type { ReactNode } from "react";

/** Submit button that disables itself and shows progress while its form's action runs. */
export function PendingButton({ children, pendingLabel, className = "" }: { children: ReactNode; pendingLabel: string; className?: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} aria-busy={pending} className={`${className} disabled:cursor-wait disabled:opacity-60`}>
      {pending ? pendingLabel : children}
    </button>
  );
}
