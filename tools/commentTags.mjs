// The comment ratchet (HISTORY-OUT, bible/Home.md): counts each file's comment lines that carry history - a date, a
// bible page, an owner's quote, an audit, a moved pin or a leading slice tag (tools/commentRules.mjs). What stands is
// in tools/commentTagsBaseline.json, which only goes down; test/tooling/commenttags.test.js holds the tree to it.
//
//   node tools/commentTags.mjs            the totals, and any file over its baseline
//   node tools/commentTags.mjs --lower    write the baseline down to today's counts (after a sweep)
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isMain } from './lib/isMain.mjs';
import { historyLines } from './commentRules.mjs';

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
export const BASELINE = 'tools/commentTagsBaseline.json';
export const DIRS = Object.freeze(['src', 'server/src', 'server-account/src', 'test', 'tools', 'scripts', 'app']);
const SKIP = new Set(['node_modules', 'fixtures', 'mutants']);

function walk(dir, out = []) {
  if (!existsSync(join(ROOT, dir))) return out;
  for (const e of readdirSync(join(ROOT, dir), { withFileTypes: true })) {
    if (SKIP.has(e.name)) continue;
    const p = `${dir}/${e.name}`;
    if (e.isDirectory()) walk(p, out);
    else if (/\.(?:m?js|cjs)$/.test(e.name)) out.push(p);
  }
  return out;
}

/** Every measured file's count of history lines, files with none left out. */
export function measure() {
  const out = {};
  for (const f of DIRS.flatMap((d) => walk(d)).sort()) {
    const n = historyLines(readFileSync(join(ROOT, f), 'utf8'));
    if (n) out[f] = n;
  }
  return out;
}

/** `{ over, lower }`: files above their baseline (a new file's is 0), and files below it. */
export function verdict(now, base) {
  const over = [],
    lower = [];
  for (const [f, n] of Object.entries(now)) if (n > (base[f] ?? 0)) over.push(`${f}: ${n} (baseline ${base[f] ?? 0})`);
  for (const [f, n] of Object.entries(base)) if ((now[f] ?? 0) < n) lower.push(`${f}: ${now[f] ?? 0} (baseline ${n})`);
  return { over, lower };
}

if (isMain(import.meta.url)) {
  const now = measure();
  const total = Object.values(now).reduce((a, b) => a + b, 0);
  if (process.argv.includes('--lower')) {
    const base = existsSync(join(ROOT, BASELINE)) ? JSON.parse(readFileSync(join(ROOT, BASELINE), 'utf8')) : null;
    const next = base
      ? Object.fromEntries(
          Object.entries(now)
            .map(([f, n]) => [f, Math.min(n, base[f] ?? n)])
            .filter(([f]) => f in base),
        )
      : now;
    writeFileSync(join(ROOT, BASELINE), `${JSON.stringify(next, null, 1)}\n`);
    console.log(
      `baseline written: ${Object.keys(next).length} files, ${Object.values(next).reduce((a, b) => a + b, 0)} history lines`,
    );
  } else {
    const base = JSON.parse(readFileSync(join(ROOT, BASELINE), 'utf8'));
    const { over } = verdict(now, base);
    console.log(`${total} history lines in ${Object.keys(now).length} files`);
    for (const o of over) console.log(`OVER ${o}`);
    if (over.length) process.exit(1);
  }
}
