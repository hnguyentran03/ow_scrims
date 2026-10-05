import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

/**
 * Sandbox isolation rests on this: a page rendered at build time, or cached across
 * requests, would serve one visitor's sandbox to the next. `next build` prerenders
 * anything it can, so every page has to opt out explicitly.
 */
const APP_DIR = path.join(process.cwd(), "src", "app");
const EXPORT = 'export const dynamic = "force-dynamic"';

/**
 * Only page.tsx: not-found.tsx, error.tsx and loading.tsx render inside an already-dynamic
 * page's tree and carry no route segment config of their own.
 */
function pagesUnder(dir: string): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) found.push(...pagesUnder(full));
    else if (entry.name === "page.tsx") found.push(full);
  }
  return found;
}

describe("route segment config", () => {
  const pages = pagesUnder(APP_DIR);

  it("finds the app's pages", () => {
    expect(pages.length).toBeGreaterThan(10);
  });

  it.each(pages.map((p) => path.relative(process.cwd(), p)))("%s is force-dynamic", (rel) => {
    expect(readFileSync(path.join(process.cwd(), rel), "utf8")).toContain(EXPORT);
  });
});
