import type { Metadata } from "next";
import Link from "next/link";
import { POSITION_FEATURES_ENABLED } from "@/lib/flags";
import { archivo, bebas } from "./fonts";
import { NavLinks } from "./nav-links";
import { SandboxBar } from "./sandbox-bar";
import "./globals.css";

export const metadata: Metadata = { title: "OW Scrims", description: "Overwatch scrim analytics", robots: { index: false, follow: false } };

const NAV = [
  { href: "/", label: "Scrims" },
  { href: "/team", label: "Team" },
  ...(POSITION_FEATURES_ENABLED ? [{ href: "/maps", label: "Maps" }] : []),
];

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${archivo.variable} ${bebas.variable}`}>
      <body className="min-h-screen bg-ground text-ink antialiased">
        <header className="border-b border-line">
          <nav className="mx-auto flex h-12 max-w-6xl items-center gap-6 px-4 text-base">
            <Link href="/" className="font-display text-lg tracking-[0.04em] text-ink">OW Scrims</Link>
            <NavLinks links={NAV} />
          </nav>
        </header>
        <SandboxBar />
        <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
      </body>
    </html>
  );
}
