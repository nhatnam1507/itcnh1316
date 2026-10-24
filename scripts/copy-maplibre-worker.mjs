#!/usr/bin/env node
// MapLibre GL v6 loads its worker from a file next to its own module, which does not
// exist once Next.js bundles the library. Copy the installed worker into public/ so the
// app serves it from its own origin (see src/components/map/maplibre-setup.ts).
import { copyFileSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

const require = createRequire(import.meta.url);
const packageDir = dirname(require.resolve("maplibre-gl/package.json"));
const source = join(packageDir, "dist", "maplibre-gl-worker.mjs");
const targetDir = join(process.cwd(), "public", "maplibre");

mkdirSync(targetDir, { recursive: true });
copyFileSync(source, join(targetDir, "maplibre-gl-worker.mjs"));
