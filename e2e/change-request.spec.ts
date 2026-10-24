import { expect, test } from "@playwright/test";
import { BEN_THANH, loginAdmin, randomMobile, unlock } from "./helpers";

test("a submitted change waits for approval, then updates the dossier", async ({ page }) => {
  const phone = randomMobile();
  const note = `e2e run ${phone.normalized}`;
  await unlock(page);

  await page.goto(`/people/${BEN_THANH.id}/request-change`);
  await page.getByRole("button", { name: "Submit request" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Propose at least one change" })).toBeVisible();

  await page.getByLabel("New mobile phone").fill(phone.input);
  await page.getByLabel("Note for the admin (optional)").fill(note);
  await page.getByRole("button", { name: "Submit request" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Transmission queued for review" })).toBeVisible();

  // The record is unchanged until an admin approves.
  await page.goto("/");
  await page.getByTestId("roster-entry").filter({ hasText: BEN_THANH.name }).click();
  await expect(page.getByTestId("dossier")).not.toContainText(phone.display);

  await loginAdmin(page);
  await expect(page).toHaveURL("/admin");
  await page.getByRole("link", { name: /^Requests/ }).click();
  const card = page.locator("article", { hasText: note });
  await expect(card).toBeVisible();
  await expect(card.locator(".diff-changed")).toContainText(phone.display);
  await card.getByRole("button", { name: "Approve" }).click();
  await expect(card).toBeHidden();

  await page.goto("/");
  await page.getByTestId("roster-entry").filter({ hasText: BEN_THANH.name }).click();
  await expect(page.getByTestId("dossier")).toContainText(phone.display);
});
