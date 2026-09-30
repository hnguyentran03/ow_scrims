import type { Page } from "@playwright/test";
import { BASE_URL } from "./config";
import { expect, test } from "./fixtures";
import { createScrim, deleteScrim, newPage, SAMPLES, uploadLog } from "./helpers";

const TABS: Array<{ label: string; suffix: string; check: (page: Page) => Promise<void> }> = [
  { label: "Overview", suffix: "", check: async (page) => expect(page.getByText("Score", { exact: true })).toBeVisible() },
  { label: "Killfeed", suffix: "/killfeed", check: async (page) => expect(page.getByRole("link", { name: "Download CSV" })).toBeVisible() },
  { label: "Charts", suffix: "/charts", check: async (page) => expect(page.getByRole("heading", { name: "Tempo", exact: true })).toBeVisible() },
  { label: "Events", suffix: "/events", check: async (page) => expect(page.getByRole("button", { name: "All", exact: true })).toBeVisible() },
  {
    label: "Compare",
    suffix: "/compare",
    check: async (page) => {
      await expect(page.getByRole("group", { name: "Left" }).getByLabel("Player")).toBeVisible();
      await expect(page.getByRole("group", { name: "Right" }).getByLabel("Player")).toBeVisible();
    },
  },
  {
    label: "Telemetry",
    suffix: "/telemetry",
    check: async (page) => expect(page.getByLabel("Player").or(page.getByText("Damage logging was off for this map")).first()).toBeVisible(),
  },
];

test.describe("map tabs", () => {
  let scrimId = 0;
  let base = "";

  test.beforeAll(async ({ browser, playwright }) => {
    const page = await newPage(browser);
    scrimId = await createScrim(page, { name: "e2e map tabs", date: "2026-04-15", opponent: "Cerberus" });
    const request = await playwright.request.newContext({ baseURL: BASE_URL });
    await uploadLog(request, scrimId, SAMPLES.antarctic);
    await request.dispose();
    await page.goto(`/scrims/${scrimId}`);
    base = (await page.getByRole("link", { name: /Antarctic Peninsula/ }).getAttribute("href")) ?? "";
    await page.context().close();
    expect(base).toMatch(/\/scrims\/\d+\/maps\/\d+$/);
  });

  test.afterAll(async ({ browser }) => {
    const page = await newPage(browser);
    await deleteScrim(page, scrimId);
    await page.context().close();
  });

  for (const tab of TABS) {
    test(`${tab.label} renders`, async ({ page }) => {
      const res = await page.goto(`${base}${tab.suffix}`);
      expect(res?.status()).toBe(200);
      await expect(page.getByRole("link", { name: tab.label, exact: true })).toHaveAttribute("aria-current", "page");
      await tab.check(page);
    });
  }
});
