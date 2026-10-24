import { expect, test } from "@playwright/test";
import { loginAdmin, randomMobile, unlock } from "./helpers";

test("the admin creates a person with a hand-set pin, then deletes them", async ({ page }) => {
  const name = `E2E Thử Nghiệm ${Date.now()}`;
  const phone = randomMobile();
  await unlock(page);
  await loginAdmin(page);
  await expect(page).toHaveURL("/admin");

  await page.getByRole("link", { name: "New person" }).first().click();
  await page.getByLabel("Full name").fill(name);
  await page.getByLabel("Date of birth").fill("1998-06-01");
  await page.getByLabel("Mobile phone").fill("0212 345 678");
  await page.getByLabel("Address").fill("Phố thử nghiệm, Hà Nội");

  // Click the map to set the pin by hand; no geocoder is called when a pin is set.
  const map = page.getByRole("application", { name: "Pin location map" });
  await expect(map.locator("canvas")).toBeVisible({ timeout: 30_000 });
  const box = (await map.boundingBox())!;
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  const pinText = page.locator(".pin-toolbar").getByText(/· manual$/);
  await expect(pinText).toBeVisible();
  const clicked = (await pinText.textContent())!.split(" · ")[0];

  await page.getByRole("button", { name: "Create person" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Vietnamese mobile" })).toBeVisible();
  await expect(page.getByLabel("Full name")).toHaveValue(name);

  await page.getByLabel("Mobile phone").fill(phone.input);
  await page.getByRole("button", { name: "Create person" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Saved." })).toBeVisible();
  await expect(page.locator(".pin-toolbar")).toContainText(`${clicked} · manual`);

  await page.goto("/");
  await expect(page.getByTestId("roster-entry").filter({ hasText: name })).toBeVisible();

  await page.goto("/admin");
  await page.getByRole("link", { name }).click();
  await page.getByRole("button", { name: "Delete person" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Type the full name to confirm").fill("wrong name");
  await dialog.getByRole("button", { name: "Delete permanently" }).click();
  await expect(dialog.getByRole("alert").filter({ hasText: "does not match" })).toBeVisible();
  await dialog.getByLabel("Type the full name to confirm").fill(name);
  await dialog.getByRole("button", { name: "Delete permanently" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Person deleted." })).toBeVisible();
  await expect(page.getByRole("link", { name })).toHaveCount(0);

  await page.goto("/");
  await expect(page.getByTestId("roster-entry").filter({ hasText: name })).toHaveCount(0);
});
