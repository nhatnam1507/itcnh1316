import { expect, type Page } from "@playwright/test";

export const PASSCODE = process.env.E2E_PASSCODE ?? "local-class-passcode";
export const ADMIN = { email: "admin@classnet.test", password: "local-admin-password" };
export const VIEWER = { email: "viewer@classnet.test", password: "local-viewer-password" };

/** Matches supabase/seed.sql. */
export const SEEDED_PEOPLE_COUNT = 6;
export const HOAN_KIEM = { id: "11111111-1111-4111-8111-000000000001", name: "Nguyễn Văn Ảo", lng: 105.8524, lat: 21.0287 };
export const BEN_THANH = { id: "11111111-1111-4111-8111-000000000002", name: "Trần Thị Mẫu" };

export async function unlock(page: Page): Promise<void> {
  await page.goto("/unlock");
  await page.getByLabel("Class passcode").fill(PASSCODE);
  await page.getByRole("button", { name: "Unlock" }).click();
  await expect(page).toHaveURL("/");
  await expect(page.getByRole("heading", { name: "CLASSNET // SURVEILLANCE CONSOLE" })).toBeVisible();
}

export async function loginAdmin(page: Page, credentials = ADMIN): Promise<void> {
  await page.goto("/admin/login");
  await page.getByLabel("Email").fill(credentials.email);
  await page.getByLabel("Password").fill(credentials.password);
  await page.getByRole("button", { name: "Log in" }).click();
}

export async function waitForMap(page: Page): Promise<void> {
  await expect(page.getByTestId("directory-map")).toHaveAttribute("data-ready", "true", { timeout: 30_000 });
}

/** Moves the mouse onto the pin at the given coordinates. */
export async function hoverPin(page: Page, lng: number, lat: number): Promise<void> {
  const box = await page.getByTestId("directory-map").boundingBox();
  if (!box) throw new Error("map not rendered");
  const point = await page.evaluate(
    ([x, y]) => window.__classnetDirectoryMap?.project(x, y) ?? null,
    [lng, lat] as const,
  );
  if (!point) throw new Error("map test hook missing");
  await page.mouse.move(box.x + point.x - 30, box.y + point.y - 30);
  await page.mouse.move(box.x + point.x, box.y + point.y, { steps: 5 });
}

/** Clicks the pin at the given coordinates, which locks onto that classmate. */
export async function clickPin(page: Page, lng: number, lat: number): Promise<void> {
  await hoverPin(page, lng, lat);
  await page.mouse.down();
  await page.mouse.up();
}

export function randomMobile(): { input: string; normalized: string; display: string } {
  const digits = String(Math.floor(Math.random() * 1e8)).padStart(8, "0");
  return {
    input: `09${digits.slice(0, 1)} ${digits.slice(1, 4)} ${digits.slice(4)}`,
    normalized: `+849${digits}`,
    display: `+84 9${digits.slice(0, 2)} ${digits.slice(2, 5)} ${digits.slice(5)}`,
  };
}
