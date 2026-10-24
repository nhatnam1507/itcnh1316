import { expect, test } from "@playwright/test";
import { BEN_THANH, clickPin, HOAN_KIEM, hoverPin, SEEDED_PEOPLE_COUNT, unlock, waitForMap } from "./helpers";

test("hovering a pin only highlights it; clicking locks on and fills the intel panel", async ({ page }) => {
  await unlock(page);
  await expect(page.getByTestId("roster-count")).toHaveText(`[${SEEDED_PEOPLE_COUNT}]`);
  await expect(page.getByTestId("roster-entry")).toHaveCount(SEEDED_PEOPLE_COUNT);
  await expect(page.getByText("AWAITING TARGET")).toBeVisible();
  await expect(page.getByTestId("roster-entry").filter({ hasText: "no fix" })).toHaveCount(1);

  await waitForMap(page);
  await hoverPin(page, HOAN_KIEM.lng, HOAN_KIEM.lat);
  await expect(page.getByTestId("roster-entry").filter({ hasText: HOAN_KIEM.name })).toHaveAttribute(
    "data-highlighted",
    "true",
  );
  await expect(page.getByText("AWAITING TARGET")).toBeVisible();

  await clickPin(page, HOAN_KIEM.lng, HOAN_KIEM.lat);
  const dossier = page.getByTestId("dossier");
  await expect(dossier).toContainText(HOAN_KIEM.name);
  await expect(dossier.getByRole("link", { name: /\+84/ })).toHaveAttribute("href", /^tel:\+84/);
  // One sequence for every lock: tracking while the camera flies in, then locked.
  await expect(page.locator(".target-callout-kicker")).toHaveText("Target locked", { timeout: 15_000 });
  await expect(page).toHaveURL(new RegExp(`\\?p=${HOAN_KIEM.id}$`));
});

test("picking a roster entry selects that classmate", async ({ page }) => {
  await unlock(page);
  await page.getByTestId("roster-entry").filter({ hasText: BEN_THANH.name }).click();
  await expect(page.getByTestId("dossier")).toContainText(BEN_THANH.name);
  await expect(page.getByTestId("dossier").getByRole("link", { name: "Request change" })).toHaveAttribute(
    "href",
    `/people/${BEN_THANH.id}/request-change`,
  );
});

test.describe("on a phone-sized screen", () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

  test("tapping a pin opens the dossier drawer", async ({ page }) => {
    await unlock(page);
    await waitForMap(page);
    const dossier = page.getByTestId("dossier");
    await expect(dossier).toBeHidden();

    const box = await page.getByTestId("directory-map").boundingBox();
    const point = await page.evaluate(
      ([x, y]) => window.__classnetDirectoryMap!.project(x, y),
      [HOAN_KIEM.lng, HOAN_KIEM.lat] as const,
    );
    await page.touchscreen.tap(box!.x + point.x, box!.y + point.y);
    await expect(dossier).toBeVisible();
    await expect(dossier).toContainText(HOAN_KIEM.name);

    await page.getByRole("button", { name: "Close dossier" }).click();
    await expect(dossier).toBeHidden();
  });
});
