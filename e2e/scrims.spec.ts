import { expect, test } from "./fixtures";
import { createScrim, deleteScrim, newPage, SAMPLES, samplePath } from "./helpers";

const NAME = "e2e core flow";

test.describe.serial("core flow", () => {
  const created: number[] = [];

  test.afterAll(async ({ browser }) => {
    const page = await newPage(browser);
    for (const id of created) await deleteScrim(page, id);
    await page.context().close();
  });

  test("create a scrim, upload a log, read the overview, delete everything", async ({ page }) => {
    // Home: heading and empty state.
    const home = await page.goto("/");
    expect(home?.status()).toBe(200);
    await expect(page.getByRole("heading", { name: "Scrims" })).toBeVisible();
    await expect(page.getByText("No scrims yet")).toBeVisible();

    // Create.
    const scrimId = await createScrim(page, { name: NAME, date: "2026-04-15", opponent: "Cerberus" });
    created.push(scrimId);
    await expect(page.getByRole("heading", { name: NAME })).toBeVisible();

    // Upload through the form as Team 1.
    await page.getByLabel("Log files").setInputFiles(samplePath(SAMPLES.antarctic));
    await page.getByRole("radio", { name: "We were Team 1" }).check();
    await page.getByRole("button", { name: "Upload" }).click();
    await expect(page.getByText("Done")).toBeVisible();
    await expect(page.getByText("Antarctic Peninsula").first()).toBeVisible();

    // The map card.
    const mapLink = page.getByRole("link", { name: /Antarctic Peninsula/ });
    await expect(mapLink).toBeVisible();
    await expect(page.getByText("Won", { exact: true })).toBeVisible();
    await expect(page.getByText(/3 - 0/)).toBeVisible();

    // Overview.
    await mapLink.click();
    await expect(page).toHaveURL(/\/scrims\/\d+\/maps\/\d+$/);
    await expect(page.getByRole("link", { name: "Overview", exact: true })).toHaveAttribute("aria-current", "page");
    await expect(page.getByText("Score", { exact: true })).toBeVisible();
    await expect(page.getByText("3 - 0", { exact: true })).toBeVisible();
    await expect(page.getByText("Match time", { exact: true })).toBeVisible();
    await expect(page.getByText("11:01", { exact: true }).first()).toBeVisible();
    expect(await page.getByRole("table").getByRole("row").count()).toBeGreaterThan(10);

    // Delete the map from the scrim page.
    await page.getByRole("link", { name: NAME }).click();
    await expect(page).toHaveURL(new RegExp(`/scrims/${scrimId}$`));
    await page.getByRole("button", { name: "Delete map" }).click();
    await expect(page.getByRole("link", { name: /Antarctic Peninsula/ })).toHaveCount(0);

    // Delete the scrim.
    await page.getByRole("button", { name: "Delete scrim" }).click();
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByText("No scrims yet")).toBeVisible();
    created.length = 0;
  });
});
