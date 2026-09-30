import type { TdHTMLAttributes, ThHTMLAttributes } from "react";

export interface SortState {
  active: boolean;
  dir: 1 | -1;
  onToggle: () => void;
}

type Pin = "first" | "second";
const PIN: Record<Pin, string> = { first: "sticky left-0 z-10 w-24 bg-surface", second: "sticky left-24 z-10 bg-surface" };

/** The scroll container and table. Rows are plain <tr>; our rows pass className="bg-ours/8". */
export function Table({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`overflow-x-auto rounded-card border border-line ${className}`}>
      <table className="w-full border-collapse text-sm">{children}</table>
    </div>
  );
}

/** Header cell. With `sort`, the label becomes a button and the <th> carries aria-sort; pass `sort` only from client components. */
export function Th({ numeric, pin, sort, className = "", children, ...rest }: ThHTMLAttributes<HTMLTableCellElement> & { numeric?: boolean; pin?: Pin; sort?: SortState }) {
  const ariaSort = sort?.active ? (sort.dir === 1 ? "ascending" : "descending") : undefined;
  return (
    <th
      {...rest}
      aria-sort={ariaSort}
      className={`bg-surface px-3 py-2 text-sm font-medium whitespace-nowrap text-muted ${numeric ? "text-right" : "text-left"} ${pin ? PIN[pin] : ""} ${className}`}
    >
      {sort ? (
        <button type="button" onClick={sort.onToggle} className="inline-flex items-center gap-1 hover:text-ink">
          {children}
          {sort.active && <span aria-hidden>{sort.dir === 1 ? "▲" : "▼"}</span>}
        </button>
      ) : (
        children
      )}
    </th>
  );
}

export function Td({ numeric, pin, muted, className = "", children, ...rest }: TdHTMLAttributes<HTMLTableCellElement> & { numeric?: boolean; pin?: Pin; muted?: boolean }) {
  return (
    <td
      {...rest}
      className={`border-t border-line px-3 py-1.5 whitespace-nowrap ${numeric ? "text-right" : ""} ${muted ? "text-muted" : ""} ${pin ? PIN[pin] : ""} ${className}`}
    >
      {children}
    </td>
  );
}
