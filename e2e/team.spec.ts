import type { Page } from "@playwright/test";
import { BASE_URL } from "./config";
import { expect, test } from "./fixtures";
import { createScrim, deleteScrim, newPage, SAMPLES, uploadLog } from "./helpers";

const TABS: Array<{ label: string; suffix: string; check: (page: Page) => Promise<void> }> = [
  {
    label: "Overview",
    suffix: "",
    check: async (page) => {
      await expect(page.getByText("Record", { exact: true }).first()).toBeVisible();
      await expect(page.getByRole("heading", { name: "Performance by role", exact: true })).toBeVisible();
    },
  },
  { label: "Trends", suffix: "/trends", check: async (page) => expect(page.getByRole("heading", { name: "Win rate by map", exact: true })).toBeVisible() },
  { label: "Teamfights", suffix: "/teamfights", check: async (page) => expect(page.getByRole("heading", { name: "By scrim", exact: true })).toBeVisible() },
  { label: "Players", suffix: "/players", check: async (page) => expect(page.getByRole("heading", { name: "Roster", exact: true })).toBeVisible() },
];

test.describe("team", () => {
  const created: number[] = [];

  test.beforeAll(async ({ browser, playwright }) => {
    const page = await newPage(browser);
    const request = await playwright.request.newContext({ baseURL: BASE_URL });
    const early = await createScrim(page, { name: "e2e team early", date: "2026-04-02", opponent: "Cerberus" });
    created.push(early);
    await uploadLog(request, early, SAMPLES.lijiang);
    const late = await createScrim(page, { name: "e2e team late", date: "2026-04-15", opponent: "Cerberus" });
    created.push(late);
    await uploadLog(request, late, SAMPLES.antarctic);
    await request.dispose();
    await page.context().close();
  });

  test.afterAll(async ({ browser }) => {
    const page = await newPage(browser);
    const failures: unknown[] = [];
    for (const id of created) {
      try {
        await deleteScrim(page, id);
      } catch (error) {
        failures.push(error);
      }
    }
    await page.context().close();
    if (failures.length > 0) throw failures[0];
  });

  test("overview shows the record over both scrims", async ({ page }) => {
    const res = await page.goto("/team");
    expect(res?.status()).toBe(200);
    await expect(page.getByRole("heading", { name: "Team" })).toBeVisible();
    await expect(page.getByText("Record", { exact: true }).first()).toBeVisible();
    // "1-1" also appears in the Last 10 stat, so the first match is enough.
    await expect(page.getByText("1-1", { exact: true }).first()).toBeVisible();
  });

  for (const tab of TABS) {
    test(`${tab.label} renders`, async ({ page }) => {
      const res = await page.goto(`/team${tab.suffix}`);
      expect(res?.status()).toBe(200);
      await expect(page.getByRole("link", { name: tab.label, exact: true })).toHaveAttribute("aria-current", "page");
      await tab.check(page);
    });
  }

  test("a player page opens from the roster", async ({ page }) => {
    await page.goto("/team/players");
    const link = page.getByRole("table").getByRole("link").first();
    const name = (await link.innerText()).trim();
    await link.click();
    await expect(page).toHaveURL(/\/team\/players\/.+/);
    await expect(page.getByRole("heading", { name, exact: true })).toBeVisible();
  });

  test("a date range with no scrims shows the empty line, and Clear restores the record", async ({ page }) => {
    await page.goto("/team");
    await page.getByLabel("From", { exact: true }).fill("2026-05-01");
    await page.getByLabel("To", { exact: true }).fill("2026-05-31");
    await page.getByRole("button", { name: "Apply" }).click();
    await expect(page.getByText("No maps in this range")).toBeVisible();
    await page.getByRole("link", { name: "Clear" }).click();
    await expect(page.getByText("Record", { exact: true }).first()).toBeVisible();
  });
});
