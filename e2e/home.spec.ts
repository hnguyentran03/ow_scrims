import { expect, test } from "./fixtures";

test("home page renders", async ({ page }) => {
  const res = await page.goto("/");
  expect(res?.status()).toBe(200);
  await expect(page.getByRole("heading", { name: "Scrims" })).toBeVisible();
  await expect(page.getByText("No scrims yet")).toBeVisible();
});
