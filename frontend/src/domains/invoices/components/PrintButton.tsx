"use client";

/** Opens the browser's print dialog ("Save as PDF" lives there). */
export function PrintButton({ className = "" }: { className?: string }) {
  return (
    <button type="button" onClick={() => window.print()} className={`print:hidden ${className}`}>
      Print / Save as PDF
    </button>
  );
}
