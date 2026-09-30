import type { CSSProperties, TdHTMLAttributes, ThHTMLAttributes } from "react";

export interface SortState {
  active: boolean;
  dir: 1 | -1;
  onToggle: () => void;
}

type Pin = "first" | "second";

// Table auto-layout ignores a w-24 class on a cell, so the first pin's width is set inline from PIN_WIDTH
// and the second pin's left offset is read from the same constant; otherwise the two pinned columns overlap.
const PIN_WIDTH = "6rem";
const PIN: Record<Pin, string> = {
  first: "sticky left-0 z-10 truncate",
  second: "sticky z-10 border-r border-line",
};
const PIN_STYLE: Record<Pin, CSSProperties> = {
  first: { width: PIN_WIDTH, minWidth: PIN_WIDTH, maxWidth: PIN_WIDTH },
  second: { left: PIN_WIDTH },
};

// Header labels are uppercased on the inner content, not the <th>: a browser's form-control default
// (text-transform: none) would otherwise reset the sort button back to sentence case.
const LABEL = "uppercase tracking-[0.06em]";

/** The scroll container and table. Rows are plain <tr>; our rows pass className="bg-ours/8". */
export function Table({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`overflow-x-auto rounded-card border border-line ${className}`}>
      <table className="w-full border-collapse text-sm">{children}</table>
    </div>
  );
}

/** Header cell. With `sort`, the label becomes a button and the <th> carries aria-sort; pass `sort` only from client components. */
export function Th({ numeric, pin, sort, tint, className = "", style, children, ...rest }: ThHTMLAttributes<HTMLTableCellElement> & { numeric?: boolean; pin?: Pin; sort?: SortState; tint?: boolean }) {
  const ariaSort = sort ? (sort.active ? (sort.dir === 1 ? "ascending" : "descending") : "none") : undefined;
  return (
    <th
      {...rest}
      aria-sort={ariaSort}
      style={pin ? { ...PIN_STYLE[pin], ...style } : style}
      className={`${pin && tint ? "bg-surface-ours" : "bg-surface"} px-3 py-2 text-xs font-medium whitespace-nowrap text-muted ${numeric ? "text-right" : "text-left"} ${pin ? PIN[pin] : ""} ${className}`}
    >
      {sort ? (
        <button type="button" onClick={sort.onToggle} className={`inline-flex items-center gap-1 ${LABEL} hover:text-ink`}>
          {children}
          {sort.active && <span aria-hidden>{sort.dir === 1 ? "▲" : "▼"}</span>}
        </button>
      ) : (
        <span className={LABEL}>{children}</span>
      )}
    </th>
  );
}

/** Body cell. A pinned cell needs an opaque background of its own; `tint` picks the one that matches an our-row. */
export function Td({ numeric, pin, muted, tint, className = "", style, children, ...rest }: TdHTMLAttributes<HTMLTableCellElement> & { numeric?: boolean; pin?: Pin; muted?: boolean; tint?: boolean }) {
  return (
    <td
      {...rest}
      style={pin ? { ...PIN_STYLE[pin], ...style } : style}
      className={`border-t border-line px-3 py-1.5 whitespace-nowrap ${numeric ? "text-right" : ""} ${muted ? "text-muted" : ""} ${pin ? `${PIN[pin]} ${tint ? "bg-surface-ours" : "bg-surface"}` : ""} ${className}`}
    >
      {children}
    </td>
  );
}
