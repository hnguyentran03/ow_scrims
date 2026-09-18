"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  ["", "Overview"],
  ["/killfeed", "Killfeed"],
  ["/charts", "Charts"],
  ["/events", "Events"],
  ["/compare", "Compare"],
] as const;

export function MapTabs({ base }: { base: string }) {
  const pathname = usePathname();
  return (
    <nav className="flex gap-4 border-b border-zinc-800 text-sm">
      {TABS.map(([suffix, label]) => {
        const href = `${base}${suffix}`;
        const active = pathname === href;
        return (
          <Link
            key={href}
            href={href}
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
