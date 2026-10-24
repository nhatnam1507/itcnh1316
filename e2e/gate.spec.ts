import { expect, test } from "@playwright/test";
import { PASSCODE, unlock } from "./helpers";

test("the directory redirects to /unlock without the passcode cookie", async ({ page, request }) => {
  const response = await request.get("/", { maxRedirects: 0 });
  expect(response.status()).toBe(307);
  expect(response.headers()["location"]).toMatch(/\/unlock$/);
  expect(response.headers()["x-robots-tag"]).toBe("noindex, nofollow");
  expect(await response.text()).not.toContain("+84");

  const action = await request.post("/", { headers: { "next-action": "x" }, maxRedirects: 0 });
  expect(action.status()).toBe(401);

  await page.goto("/");
  await expect(page).toHaveURL(/\/unlock$/);
});

test("a wrong passcode shows an error and the right one opens the dashboard", async ({ page }) => {
  await page.goto("/unlock");
  await page.getByLabel("Class passcode").fill(`${PASSCODE}-wrong`);
  await page.getByRole("button", { name: "Unlock" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "ACCESS DENIED" })).toBeVisible();
  await expect(page).toHaveURL(/\/unlock$/);

  await unlock(page);
  const unlocked = await page.request.get("/");
  expect(unlocked.headers()["x-robots-tag"]).toBe("noindex, nofollow");
});

test("the sixth wrong passcode in a row is rate-limited", async ({ page }) => {
  // A dedicated client address keeps this bucket apart from the other tests' unlocks.
  await page.setExtraHTTPHeaders({ "x-forwarded-for": `203.0.113.${Math.floor(Math.random() * 200) + 1}` });
  await page.goto("/unlock");
  const submit = async (passcode: string) => {
    await page.getByLabel("Class passcode").fill(passcode);
    await Promise.all([
      page.waitForResponse((response) => response.request().method() === "POST" && response.url().endsWith("/unlock")),
      page.getByRole("button", { name: "Unlock" }).click(),
    ]);
  };
  for (let attempt = 1; attempt <= 5; attempt++) {
    await submit(`wrong-${attempt}`);
    await expect(page.getByRole("alert").filter({ hasText: "ACCESS DENIED" })).toBeVisible();
  }
  // Even the correct passcode is refused once the limit is reached.
  await submit(PASSCODE);
  await expect(page.getByRole("alert").filter({ hasText: "Too many failed attempts" })).toBeVisible();
  await expect(page).toHaveURL(/\/unlock$/);
});
