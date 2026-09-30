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
    <nav className="flex gap-5 overflow-x-auto border-b border-line text-base whitespace-nowrap">
      {tabs.map(({ suffix, label }) => {
        const path = `${base}${suffix}`;
        const active = isActiveTab(pathname, path, suffix);
        return (
          <Link
            key={path}
            href={query ? `${path}?${query}` : path}
            aria-current={active ? "page" : undefined}
            className={
              active
                ? "relative pb-2 font-display text-md tracking-[0.06em] text-ink after:absolute after:inset-x-0 after:-bottom-px after:h-[3px] after:-skew-x-[20deg] after:bg-accent after:content-['']"
                : "relative pb-2 font-display text-md tracking-[0.06em] text-muted hover:text-ink"
            }
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
