"use client";

import { useState, type ReactNode } from "react";

const SMALL_BUTTON = "rounded px-2 py-1 text-xs text-muted transition-colors hover:bg-surface-raised hover:text-ink disabled:opacity-30";

let nextKey = 0;
/** A stable React key for a new list item. */
export const listKey = () => nextKey++;

/**
 * An ordered list of cards with add, remove, drag-to-reorder (by the ⋮⋮
 * handle, so text inside the fields stays selectable) and ↑/↓ for keyboards.
 */
export function RepeatableList<T extends { key: number }>({
  items,
  onChange,
  create,
  max,
  noun,
  disabled,
  error,
  children,
}: {
  items: T[];
  onChange: (items: T[]) => void;
  create: () => T;
  max: number;
  /** "Module", "Step", … */
  noun: string;
  disabled?: boolean;
  error?: string;
  /** The fields of one item. */
  children: (item: T, update: (patch: Partial<T>) => void, index: number) => ReactNode;
}) {
  const [armed, setArmed] = useState<number | null>(null);
  const [dragging, setDragging] = useState<number | null>(null);

  const update = (key: number, patch: Partial<T>) => onChange(items.map((item) => (item.key === key ? { ...item, ...patch } : item)));
  const move = (index: number, by: -1 | 1) => {
    const next = [...items];
    [next[index], next[index + by]] = [next[index + by], next[index]];
    onChange(next);
  };
  const moveTo = (key: number, targetKey: number) => {
    if (key === targetKey) return;
    const item = items.find((i) => i.key === key)!;
    const rest = items.filter((i) => i.key !== key);
    const at = rest.findIndex((i) => i.key === targetKey);
    // Dropping onto a later item lands after it, onto an earlier one before it.
    const after = items.findIndex((i) => i.key === key) <= at;
    onChange([...rest.slice(0, at + (after ? 1 : 0)), item, ...rest.slice(at + (after ? 1 : 0))]);
  };

  return (
    <div>
      {items.length === 0 && (
        <p className="rounded-md border border-dashed border-line px-4 py-6 text-center text-sm text-muted">
          No {noun.toLowerCase()}s yet. This section is hidden on the public page until you add one.
        </p>
      )}
      <ol className="grid gap-4">
        {items.map((item, index) => (
          <li
            key={item.key}
            draggable={armed === item.key}
            onDragStart={() => setDragging(item.key)}
            onDragEnd={() => {
              setDragging(null);
              setArmed(null);
            }}
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => dragging !== null && moveTo(dragging, item.key)}
            className={`rounded-lg border border-line bg-canvas/40 p-4 ${dragging === item.key ? "opacity-40" : ""}`}
          >
            <div className="flex items-center justify-between gap-3">
              <span className="flex items-center gap-2">
                <span
                  aria-hidden
                  onMouseDown={() => setArmed(item.key)}
                  onMouseUp={() => setArmed(null)}
                  className="cursor-grab px-1 text-muted/60 select-none"
                  title="Drag to reorder"
                >
                  ⋮⋮
                </span>
                <span className="font-mono text-xs text-quant">
                  {noun} {String(index + 1).padStart(2, "0")}
                </span>
              </span>
              <span className="flex gap-1">
                <button type="button" className={SMALL_BUTTON} disabled={disabled || index === 0} onClick={() => move(index, -1)} aria-label={`Move ${noun} ${index + 1} up`}>
                  ↑
                </button>
                <button
                  type="button"
                  className={SMALL_BUTTON}
                  disabled={disabled || index === items.length - 1}
                  onClick={() => move(index, 1)}
                  aria-label={`Move ${noun} ${index + 1} down`}
                >
                  ↓
                </button>
                <button
                  type="button"
                  className={`${SMALL_BUTTON} hover:text-red-400`}
                  disabled={disabled}
                  onClick={() => onChange(items.filter((i) => i.key !== item.key))}
                >
                  Remove
                </button>
              </span>
            </div>
            <div className="mt-3 grid gap-3">{children(item, (patch) => update(item.key, patch), index)}</div>
          </li>
        ))}
      </ol>
      {error && (
        <p role="alert" className="mt-2 text-xs text-gold">
          {error}
        </p>
      )}
      <button
        type="button"
        disabled={disabled || items.length >= max}
        onClick={() => onChange([...items, create()])}
        className="mt-4 h-9 rounded-md border border-quant/50 px-4 text-sm text-quant transition-colors hover:bg-quant/10 disabled:opacity-40"
      >
        + Add {noun.toLowerCase()}
      </button>
    </div>
  );
}
