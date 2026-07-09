// Shared helpers for the tools/ scripts.
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

// Load KEY=VALUE pairs from apps/web/.env.local into process.env (without a dep).
export function loadEnv() {
  const here = dirname(fileURLToPath(import.meta.url));
  const envPath = join(here, "..", "apps", "web", ".env.local");
  try {
    for (const line of readFileSync(envPath, "utf8").split("\n")) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  } catch {
    /* no env file — rely on real process.env */
  }
}

// Minimal --flag value parser.
export function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    if (!argv[i].startsWith("--")) continue;
    const key = argv[i].slice(2);
    const next = argv[i + 1];
    out[key] = next && !next.startsWith("--") ? (i++, next) : true;
  }
  return out;
}

export const here = dirname(fileURLToPath(import.meta.url));
