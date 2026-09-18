/**
 * Read the repo's gitignored `.env` into process.env (existing variables win). A tiny parser,
 * no dependency: `NAME=value` lines, optional quotes, `#` comments. Shared by the tools that
 * need an API key (gen-art, gen-video-runway); nothing here ever prints a value.
 */
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

export function loadDotEnv(root) {
  const file = path.join(root, '.env');
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/.exec(line);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}

/** The variable's value, or a clear error naming the `.env` line to add. */
export function requireEnv(name, hint) {
  const v = process.env[name];
  if (!v)
    throw new Error(`${name} is not set: add \`${name}=…\` to .env${hint ? ` (${hint})` : ''}`);
  return v;
}
