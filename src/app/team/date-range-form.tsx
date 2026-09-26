"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { extraParams } from "@/lib/range";

/** GET form to the current tab; the page reads ?from=&to=, and every other query param (e.g. a player page's hero) rides along as a hidden input. */
export function DateRangeForm() {
  const pathname = usePathname();
  const params = useSearchParams();
  const extra = extraParams(params, ["from", "to"]);
  const clearQuery = new URLSearchParams(extra).toString();
  return (
    <form key={params.toString()} method="get" action={pathname} className="flex flex-wrap items-end gap-3 text-sm">
      {extra.map(([k, v], i) => (
        <input key={i} type="hidden" name={k} value={v} />
      ))}
      <label className="flex flex-col">
        From
        <input type="date" name="from" defaultValue={params.get("from") ?? ""} className="rounded bg-zinc-900 px-2 py-1" />
      </label>
      <label className="flex flex-col">
        To
        <input type="date" name="to" defaultValue={params.get("to") ?? ""} className="rounded bg-zinc-900 px-2 py-1" />
      </label>
      <button type="submit" className="rounded bg-orange-500 px-3 py-1 font-medium text-black">Apply</button>
      <Link href={clearQuery ? `${pathname}?${clearQuery}` : pathname} className="text-zinc-400 hover:underline">Clear</Link>
    </form>
  );
}
