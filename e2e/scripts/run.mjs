// E2E orchestrator: database lifecycle wraps `playwright test`. Playwright
// boots webServer before globalSetup, so DB setup cannot live in globalSetup
// — this script guarantees the fresh DB exists first and is dropped after.
import { execSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const playwrightBin = path.resolve(root, "node_modules/.bin/playwright");
const [, , ...playwrightArgs] = process.argv;

function run(command) {
  execSync(command, { cwd: root, stdio: "inherit" });
}

run("node scripts/db-setup.mjs");
try {
  run(`${playwrightBin} test ${playwrightArgs.join(" ")}`);
} finally {
  run("node scripts/db-teardown.mjs");
}