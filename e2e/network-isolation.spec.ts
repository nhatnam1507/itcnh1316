import { expect, test } from "@playwright/test";
import { BEN_THANH, clickPin, HOAN_KIEM, unlock, waitForMap } from "./helpers";

const ALLOWED_HOSTS = new Set(["localhost:3000", "tiles.openfreemap.org"]);

test("the browser talks only to the app and the map tile host", async ({ page }) => {
  const hosts = new Set<string>();
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (url.protocol === "http:" || url.protocol === "https:" || url.protocol === "ws:" || url.protocol === "wss:") {
      hosts.add(url.host);
    }
  });

  await unlock(page);
  await waitForMap(page);
  await clickPin(page, HOAN_KIEM.lng, HOAN_KIEM.lat);
  await expect(page.getByTestId("dossier")).toBeVisible();
  await page.goto(`/people/${BEN_THANH.id}/request-change`);
  await expect(page.getByRole("heading", { name: "Request a change" })).toBeVisible();

  const unexpected = [...hosts].filter((host) => !ALLOWED_HOSTS.has(host));
  expect(unexpected).toEqual([]);
  expect([...hosts].some((host) => host.includes("supabase") || host.endsWith(":54321"))).toBe(false);
});
