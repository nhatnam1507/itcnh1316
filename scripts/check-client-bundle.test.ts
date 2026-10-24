import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { buildPatterns, scanDirectories } from "./check-client-bundle.mjs";

const STATIC_DIR = ".next/static";
const LEAK_FILE = join(STATIC_DIR, "chunks/leak.js");

describe("client bundle scan", () => {
  let root: string;

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "bundle-scan-"));
    mkdirSync(join(root, STATIC_DIR, "chunks"), { recursive: true });
    writeFileSync(join(root, STATIC_DIR, "chunks/clean.js"), "console.log('hello map');");
  });

  afterEach(() => rmSync(root, { recursive: true, force: true }));

  it("passes a clean bundle", () => {
    expect(scanDirectories([STATIC_DIR], buildPatterns({}), root)).toEqual({ scannedFiles: 1, findings: [] });
  });

  it.each([
    ["const k='sb_secret_abc'", "supabase secret key (sb_secret_)"],
    ["const k='sb_publishable_abc'", "supabase publishable key (sb_publishable_)"],
    ["fetch('https://abcd.supabase.co/rest/v1')", "supabase project URL (supabase.co)"],
    ["const t='eyJhbGciOiJIUzI1NiJ9.x.y'", "JWT (eyJhbGciOi)"],
  ])("flags %s", (content, pattern) => {
    writeFileSync(join(root, LEAK_FILE), content);
    const { findings } = scanDirectories([STATIC_DIR], buildPatterns({}), root);
    expect(findings).toEqual([{ file: LEAK_FILE, pattern }]);
  });

  it("flags the literal value of a configured env var by name only", () => {
    writeFileSync(join(root, LEAK_FILE), "x='http://127.0.0.1:54321'");
    const patterns = buildPatterns({ SUPABASE_URL: "http://127.0.0.1:54321", SESSION_SECRET: "short" });
    const { findings } = scanDirectories([STATIC_DIR], patterns, root);
    expect(findings).toEqual([{ file: LEAK_FILE, pattern: "value of SUPABASE_URL" }]);
    expect(JSON.stringify(findings)).not.toContain("54321");
  });

  it("ignores directories that do not exist", () => {
    expect(scanDirectories([".vercel/output/static"], buildPatterns({}), root).scannedFiles).toBe(0);
  });
});
