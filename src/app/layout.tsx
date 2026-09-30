import type { Metadata } from "next";
import Link from "next/link";
import { POSITION_FEATURES_ENABLED } from "@/lib/flags";
import { archivo } from "./fonts";
import "./globals.css";

export const metadata: Metadata = { title: "ow-scrims", description: "Overwatch scrim analytics" };

const NAV = [
  { href: "/", label: "Scrims" },
  { href: "/team", label: "Team" },
  ...(POSITION_FEATURES_ENABLED ? [{ href: "/maps", label: "Maps" }] : []),
];

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={archivo.variable}>
      <body className="min-h-screen bg-ground text-ink antialiased">
        <header className="border-b border-line">
          <nav className="mx-auto flex h-12 max-w-6xl items-center gap-6 px-4 text-base">
            <span className="text-md font-semibold font-stretch-[85%]">ow-scrims</span>
            {NAV.map((n) => (
              <Link key={n.href} href={n.href} className="text-muted hover:text-ink">
                {n.label}
              </Link>
            ))}
          </nav>
        </header>
        <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
      </body>
    </html>
  );
}
