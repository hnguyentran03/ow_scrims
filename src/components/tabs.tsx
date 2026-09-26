"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { isActiveTab } from "./tab-active";

export interface Tab {
  suffix: string;
  label: string;
}

/** Tab nav shared by the map and team areas. Active tab by pathname; the query string is kept so filters survive tab changes. */
export function Tabs({ base, tabs }: { base: string; tabs: readonly Tab[] }) {
  const pathname = usePathname();
  const query = useSearchParams().toString();
  return (
    <nav className="flex gap-4 border-b border-zinc-800 text-sm">
      {tabs.map(({ suffix, label }) => {
        const path = `${base}${suffix}`;
        const active = isActiveTab(pathname, path, suffix);
        return (
          <Link
            key={path}
            href={query ? `${path}?${query}` : path}
            aria-current={active ? "page" : undefined}
            className={active ? "-mb-px border-b-2 border-zinc-100 pb-2 font-medium" : "pb-2 text-zinc-400 hover:text-zinc-200"}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
