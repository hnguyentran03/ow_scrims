"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { isActiveTab } from "@/components/tab-active";

/** Top-nav links for the shell header. Active section carries the accent underline; mirrors src/components/tabs.tsx. */
export function NavLinks({ links }: { links: Array<{ href: string; label: string }> }) {
  const pathname = usePathname();
  return (
    <>
      {links.map(({ href, label }) => {
        const active = isActiveTab(pathname, href, href === "/" ? "" : href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={active ? "-mb-px border-b-2 border-accent pb-3 pt-3 font-medium text-ink" : "pb-3 pt-3 text-muted hover:text-ink"}
          >
            {label}
          </Link>
        );
      })}
    </>
  );
}
