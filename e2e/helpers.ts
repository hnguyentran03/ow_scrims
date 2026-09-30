import { readFileSync } from "node:fs";
import path from "node:path";
import { expect, type APIRequestContext, type Browser, type Page } from "@playwright/test";
import { BASE_URL } from "./config";

/** Sample logs under test/samples with values pinned in test/parser/derive.test.ts. */
export const SAMPLES = {
  /** Antarctic Peninsula, Control, 3-0, Team 1 wins, 661 s. */
  antarctic: "Log-2026-04-15-21-12-58.txt",
  /** Lijiang Tower, Control, 1-2, Team 2 wins, 744 s. */
  lijiang: "Log-2026-04-02-17-21-48.txt",
} as const;

export function samplePath(name: string): string {
  return path.join(process.cwd(), "test", "samples", name);
}

/** A page for beforeAll/afterAll hooks, where the test-scoped `page` fixture does not exist. Close it when done. */
export async function newPage(browser: Browser): Promise<Page> {
  const context = await browser.newContext({ baseURL: BASE_URL });
  return context.newPage();
}

/** Creates a scrim through the home form and returns its id from the redirect. */
export async function createScrim(page: Page, input: { name: string; date: string; opponent: string }): Promise<number> {
  await page.goto("/");
  await page.getByLabel("Name", { exact: true }).fill(input.name);
  await page.getByLabel("Date", { exact: true }).fill(input.date);
  await page.getByLabel("Opponent", { exact: true }).fill(input.opponent);
  await page.getByRole("button", { name: "Create scrim" }).click();
  await expect(page).toHaveURL(/\/scrims\/\d+$/);
  return Number(new URL(page.url()).pathname.split("/").pop());
}

/** Uploads a sample log through the API route as Team 1. */
export async function uploadLog(request: APIRequestContext, scrimId: number, sample: string): Promise<void> {
  const res = await request.post(`/api/scrims/${scrimId}/maps`, {
    multipart: {
      file: { name: sample, mimeType: "text/plain", buffer: readFileSync(samplePath(sample)) },
      ourSide: "1",
    },
  });
  expect(res.status(), await res.text()).toBe(201);
}

/** Deletes a scrim through its page; a scrim that is already gone (404) is skipped. */
export async function deleteScrim(page: Page, scrimId: number): Promise<void> {
  const res = await page.goto(`/scrims/${scrimId}`);
  if (res?.status() === 404) return;
  await page.getByRole("button", { name: "Delete scrim" }).click();
  await expect(page).toHaveURL(/\/$/);
}
