import { expect, test as base } from "@playwright/test";

/**
 * The shared `test`: every test fails if the page raised an uncaught error.
 * Console warnings are not collected; only `pageerror` events count.
 */
export const test = base.extend<{ pageErrors: Error[] }>({
  pageErrors: [
    async ({ page }, use) => {
      const errors: Error[] = [];
      page.on("pageerror", (error) => errors.push(error));
      await use(errors);
      expect(errors.map((e) => e.message), "uncaught page errors").toEqual([]);
    },
    { auto: true },
  ],
});

export { expect };
