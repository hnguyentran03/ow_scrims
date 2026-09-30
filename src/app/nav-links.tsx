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
            className={
              active
                ? "relative flex h-12 items-center font-display text-md tracking-[0.06em] text-ink after:absolute after:inset-x-0 after:bottom-0 after:h-[3px] after:-skew-x-[20deg] after:bg-accent after:content-['']"
                : "relative flex h-12 items-center font-display text-md tracking-[0.06em] text-muted hover:text-ink"
            }
          >
            {label}
          </Link>
        );
      })}
    </>
  );
}
