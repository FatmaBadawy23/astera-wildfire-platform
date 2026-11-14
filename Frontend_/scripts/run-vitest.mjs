// Starts Vitest from the canonical project path, with an uppercase Windows drive letter.
//
// Why: Node's ES module cache is case-sensitive. When Vitest is started through a path spelled `c:\...` while
// the disk path is `C:\...` (as npm/npx can do on Windows), Node loads Vitest's runner twice, and the global
// `afterEach` in src/test/setup.ts fails with "Vitest failed to find the current suite".
// Usage: node scripts/run-vitest.mjs [vitest arguments]   (all arguments are passed through unchanged)
import { realpathSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

/** `c:\x` → `C:\x`; other paths are returned unchanged. */
const upperDrive = (p) => p.replace(/^([a-z]):/, (_, d) => `${d.toUpperCase()}:`);

// The frontend folder, from this file's location (not process.cwd(), which may carry the lowercase spelling).
const root = upperDrive(realpathSync.native(resolve(dirname(fileURLToPath(import.meta.url)), "..")));
const entry = upperDrive(realpathSync.native(join(root, "node_modules", "vitest", "vitest.mjs")));

process.chdir(root);
process.argv = [process.argv[0], entry, ...process.argv.slice(2)];
await import(pathToFileURL(entry).href);
