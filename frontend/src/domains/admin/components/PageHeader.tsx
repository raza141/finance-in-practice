import type { ReactNode } from "react";

/** Every admin page's top: title, one line on what the page is for, and its main actions on the right. */
export function PageHeader({ title, description, actions, children }: { title: string; description?: ReactNode; actions?: ReactNode; children?: ReactNode }) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4 border-b border-line pb-5">
      <div className="max-w-2xl min-w-0">
        <h1 className="text-3xl font-normal tracking-tight text-balance italic">{title}</h1>
        {description && <p className="mt-1.5 text-sm text-pretty text-muted">{description}</p>}
        {children}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}

/** Header action styles: one primary (the page's main job), the rest secondary. */
export const PRIMARY_ACTION = "inline-flex h-9 items-center rounded-md bg-quant/15 px-3.5 text-sm font-medium text-quant transition-colors hover:bg-quant/25";
export const SECONDARY_ACTION = "inline-flex h-9 items-center rounded-md border border-line px-3.5 text-sm text-muted transition-colors hover:border-quant/50 hover:text-ink";
