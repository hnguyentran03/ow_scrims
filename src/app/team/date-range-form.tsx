"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

/** GET form to the current tab; the page reads ?from=&to= and the tabs carry them along. */
export function DateRangeForm() {
  const pathname = usePathname();
  const params = useSearchParams();
  return (
    <form key={params.toString()} method="get" action={pathname} className="flex flex-wrap items-end gap-3 text-sm">
      <label className="flex flex-col">
        From
        <input type="date" name="from" defaultValue={params.get("from") ?? ""} className="rounded bg-zinc-900 px-2 py-1" />
      </label>
      <label className="flex flex-col">
        To
        <input type="date" name="to" defaultValue={params.get("to") ?? ""} className="rounded bg-zinc-900 px-2 py-1" />
      </label>
      <button type="submit" className="rounded bg-orange-500 px-3 py-1 font-medium text-black">Apply</button>
      <Link href={pathname} className="text-zinc-400 hover:underline">Clear</Link>
    </form>
  );
}
