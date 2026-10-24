#!/usr/bin/env node
// Fails when anything that must stay on the server shows up in files served to browsers.
// Prints only the file path and the pattern name, never the matched value.
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

export const DEFAULT_SCAN_DIRS = [".next/static", ".vercel/output/static"];

export const DEFAULT_SECRET_ENV_NAMES = [
  "SUPABASE_URL",
  "SUPABASE_PUBLISHABLE_KEY",
  "SUPABASE_SECRET_KEY",
  "CLASS_PASSCODE_HASH",
  "SESSION_SECRET",
  "RATE_LIMIT_SALT",
];

const STATIC_PATTERNS = [
  { name: "supabase secret key (sb_secret_)", test: (text) => text.includes("sb_secret_") },
  { name: "supabase publishable key (sb_publishable_)", test: (text) => text.includes("sb_publishable_") },
  { name: "supabase project URL (supabase.co)", test: (text) => text.includes("supabase.co") },
  { name: "JWT (eyJhbGciOi)", test: (text) => text.includes("eyJhbGciOi") },
];

// Short values ("30", "vn") would match by accident and are not secrets.
const MIN_SECRET_LENGTH = 8;

/**
 * @param {Record<string, string | undefined>} env
 * @param {string[]} names env vars whose literal values must never reach the browser
 */
export function buildPatterns(env = process.env, names = DEFAULT_SECRET_ENV_NAMES) {
  const patterns = [...STATIC_PATTERNS];
  for (const name of names) {
    const value = env[name];
    if (value && value.length >= MIN_SECRET_LENGTH) {
      patterns.push({ name: `value of ${name}`, test: (text) => text.includes(value) });
    }
  }
  return patterns;
}

function* walk(dir) {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) yield* walk(path);
    else yield path;
  }
}

/** Returns `{ scannedFiles, findings: [{ file, pattern }] }` for the directories that exist. */
export function scanDirectories(dirs, patterns, root = process.cwd()) {
  const findings = [];
  let scannedFiles = 0;
  for (const dir of dirs) {
    const absolute = join(root, dir);
    if (!existsSync(absolute)) continue;
    for (const file of walk(absolute)) {
      scannedFiles += 1;
      const text = readFileSync(file, "latin1");
      for (const pattern of patterns) {
        if (pattern.test(text)) findings.push({ file: relative(root, file), pattern: pattern.name });
      }
    }
  }
  return { scannedFiles, findings };
}

function main() {
  const names = process.env.SCAN_SECRET_ENV_NAMES
    ? process.env.SCAN_SECRET_ENV_NAMES.split(",").map((name) => name.trim()).filter(Boolean)
    : DEFAULT_SECRET_ENV_NAMES;
  const { scannedFiles, findings } = scanDirectories(DEFAULT_SCAN_DIRS, buildPatterns(process.env, names));

  if (scannedFiles === 0) {
    console.error(`No client bundle found in ${DEFAULT_SCAN_DIRS.join(" or ")}. Build first.`);
    process.exit(2);
  }
  if (findings.length > 0) {
    console.error(`Client bundle scan FAILED: ${findings.length} finding(s) in ${scannedFiles} files.`);
    for (const { file, pattern } of findings) console.error(`  ${file}: ${pattern}`);
    process.exit(1);
  }
  console.log(`Client bundle scan passed: ${scannedFiles} files, no server-only values found.`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
