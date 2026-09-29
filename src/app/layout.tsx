import type { Metadata } from "next";
import Link from "next/link";
import { POSITION_FEATURES_ENABLED } from "@/lib/flags";
import "./globals.css";

export const metadata: Metadata = { title: "ow-scrims", description: "Overwatch scrim analytics" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-zinc-950 text-zinc-100 antialiased">
        <header className="border-b border-zinc-800">
          <nav className="mx-auto flex max-w-6xl gap-4 px-4 py-3 text-sm">
            <Link href="/" className="font-medium hover:underline">Scrims</Link>
            <Link href="/team" className="font-medium hover:underline">Team</Link>
            {POSITION_FEATURES_ENABLED && <Link href="/maps" className="font-medium hover:underline">Maps</Link>}
          </nav>
        </header>
        <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
      </body>
    </html>
  );
}
