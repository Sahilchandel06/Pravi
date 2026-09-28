import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const run = promisify(execFile);
const root = dirname(fileURLToPath(import.meta.url));

export async function resetDemo() {
  const seedPath = resolve(root, "../../seed/seed.js");
  const result = await run(process.execPath, [seedPath], {
    env: process.env,
    maxBuffer: 1024 * 1024,
  });
  return { message: "Demo data reset", output: result.stdout.trim() };
}
