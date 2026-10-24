import { expect, test } from "@playwright/test";
import { loginAdmin, unlock, VIEWER } from "./helpers";

test("a signed-in non-admin is refused and cannot reach the console", async ({ page }) => {
  await unlock(page);
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/admin\/login$/);

  await loginAdmin(page, VIEWER);
  await expect(page.getByRole("alert").filter({ hasText: "Login failed" })).toBeVisible();
  await page.goto("/admin/requests");
  await expect(page).toHaveURL(/\/admin\/login$/);
});

test("the admin console lists people and flags missing pins", async ({ page }) => {
  await unlock(page);
  await loginAdmin(page);
  await expect(page).toHaveURL("/admin");
  await expect(page.getByRole("heading", { name: "People" })).toBeVisible();
  await expect(page.locator("tbody tr").filter({ hasText: "no pin" })).toHaveCount(1);

  await page.getByRole("button", { name: "Log out" }).click();
  await expect(page).toHaveURL(/\/admin\/login$/);
});
