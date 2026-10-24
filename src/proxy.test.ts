import { getRedirectUrl, unstable_doesMiddlewareMatch } from "next/experimental/testing/server";
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import nextConfig from "../next.config";
import { classSessionSigningKey } from "./lib/passcode/class-session-key";
import { CLASS_SESSION_COOKIE, createSessionToken } from "./lib/passcode/session-token";
import { config, proxy } from "./proxy";
import { clearServerEnv, stubServerEnv, TEST_ENV } from "./test/test-env";

const ORIGIN = "http://localhost:3000";

async function validCookie(): Promise<string> {
  const token = await createSessionToken(classSessionSigningKey(TEST_ENV), Date.now() + 60_000);
  return `${CLASS_SESSION_COOKIE}=${token}`;
}

function request(path: string, init: { method?: string; cookie?: string; headers?: Record<string, string> } = {}) {
  const headers = new Headers(init.headers);
  if (init.cookie) headers.set("cookie", init.cookie);
  return new NextRequest(new URL(path, ORIGIN), { method: init.method ?? "GET", headers });
}

describe("proxy matcher", () => {
  it.each(["/", "/unlock", "/admin", "/admin/requests", "/people/abc/request-change", "/api/anything"])(
    "runs on %s",
    (url) => {
      expect(unstable_doesMiddlewareMatch({ config, nextConfig, url })).toBe(true);
    },
  );

  it.each(["/_next/static/chunks/app.js", "/_next/image?url=x", "/favicon.ico", "/robots.txt"])(
    "skips %s",
    (url) => {
      expect(unstable_doesMiddlewareMatch({ config, nextConfig, url })).toBe(false);
    },
  );
});

describe("proxy gate", () => {
  beforeEach(() => stubServerEnv());
  afterEach(() => clearServerEnv());

  it("always lets /unlock through", async () => {
    const response = await proxy(request("/unlock"));
    expect(response.headers.get("x-middleware-next")).toBe("1");
    const post = await proxy(request("/unlock", { method: "POST", headers: { "next-action": "abc" } }));
    expect(post.headers.get("x-middleware-next")).toBe("1");
  });

  it("redirects a page request without the cookie to /unlock", async () => {
    const response = await proxy(request("/"));
    expect(response.status).toBe(307);
    expect(getRedirectUrl(response)).toBe(`${ORIGIN}/unlock`);
    expect(response.headers.get("x-robots-tag")).toBe("noindex, nofollow");
  });

  it("redirects admin pages without the cookie", async () => {
    expect(getRedirectUrl(await proxy(request("/admin/requests")))).toBe(`${ORIGIN}/unlock`);
  });

  it("returns 401 for a server action without the cookie", async () => {
    const response = await proxy(request("/people/x/request-change", { method: "POST", headers: { "next-action": "abc" } }));
    expect(response.status).toBe(401);
    expect(await response.text()).toBe("Unauthorized");
  });

  it("returns 401 for any non-GET request without the cookie", async () => {
    for (const method of ["POST", "PUT", "PATCH", "DELETE"]) {
      expect((await proxy(request("/", { method }))).status).toBe(401);
    }
  });

  it("rejects a tampered or foreign cookie", async () => {
    const forged = await createSessionToken("not-the-real-secret".repeat(3), Date.now() + 60_000);
    const response = await proxy(request("/", { cookie: `${CLASS_SESSION_COOKIE}=${forged}` }));
    expect(getRedirectUrl(response)).toBe(`${ORIGIN}/unlock`);
  });

  it("rejects an expired cookie", async () => {
    const expired = await createSessionToken(classSessionSigningKey(TEST_ENV), Date.now() - 1);
    const response = await proxy(request("/", { cookie: `${CLASS_SESSION_COOKIE}=${expired}` }));
    expect(getRedirectUrl(response)).toBe(`${ORIGIN}/unlock`);
  });

  it("lets a valid session through", async () => {
    const cookie = await validCookie();
    expect((await proxy(request("/", { cookie }))).headers.get("x-middleware-next")).toBe("1");
    const action = await proxy(request("/people/x/request-change", { method: "POST", cookie, headers: { "next-action": "a" } }));
    expect(action.headers.get("x-middleware-next")).toBe("1");
  });

  it("lets a valid session reach admin pages without contacting Supabase when no admin cookie exists", async () => {
    const response = await proxy(request("/admin", { cookie: await validCookie() }));
    expect(response.headers.get("x-middleware-next")).toBe("1");
  });

  it("invalidates sessions after the session secret rotates", async () => {
    const cookie = await validCookie();
    stubServerEnv({ SESSION_SECRET: "r".repeat(48) });
    expect(getRedirectUrl(await proxy(request("/", { cookie })))).toBe(`${ORIGIN}/unlock`);
  });
});
