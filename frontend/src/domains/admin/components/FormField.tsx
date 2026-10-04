import type { ReactNode } from "react";

/** Input classes shared by the admin edit forms. */
export const FIELD =
  "mt-2 w-full rounded-md border border-line bg-canvas/70 px-3 py-2.5 text-ink outline-none focus:border-quant/70 aria-[invalid=true]:border-gold/70 disabled:opacity-60";

/** Labelled admin form control with an error message, or a hint when there is none. */
export function Field({
  label,
  hint,
  error,
  children,
  className = "",
}: {
  label: string;
  hint?: ReactNode;
  error?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={`block ${className}`}>
      <span className="text-[11px] tracking-[0.22em] text-muted uppercase">{label}</span>
      {children}
      {error ? (
        <span role="alert" className="mt-1.5 block text-xs text-gold">
          {error}
        </span>
      ) : (
        hint && <span className="mt-1.5 block text-xs text-muted/80">{hint}</span>
      )}
    </label>
  );
}
