#!/usr/bin/env node
/** Copy root llms.txt / llms-full.txt into the demo public/ folder for GitHub Pages. */
import { copyFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const publicDir = resolve(root, "apps/demo/public");
mkdirSync(publicDir, { recursive: true });
for (const name of ["llms.txt", "llms-full.txt"]) {
  copyFileSync(resolve(root, name), resolve(publicDir, name));
}
