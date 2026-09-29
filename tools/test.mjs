import { readdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

// Enumerate files ourselves; shell glob expansion differs on Windows and Linux.
const root = fileURLToPath(new URL("../", import.meta.url));
const files = readdirSync(resolve(root, "tests"))
    .filter(name => name.endsWith(".test.js"))
    .sort()
    .map(name => resolve(root, "tests", name));
if (!files.length) throw new Error("No tests discovered");
const result = spawnSync(process.execPath, ["--test", ...files], { cwd: root, stdio: "inherit" });
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
