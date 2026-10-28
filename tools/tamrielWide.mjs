#!/usr/bin/env node
// TAMRIEL-WIDE (2026-10-28; the owner: "ensure our future development isnt just Daggerfall anymore and is the
// entirety of tamriel"). Counts the code idioms that answer for the Iliac Bay alone, a file at a time. The law is
// bible/Home.md's THE WORLD IS TAMRIEL; test/tooling/tamrielwide.test.js holds the tree to the baseline, which only
// goes down. A line that is the Bay's own data on purpose says so with a `BAY-OWN:` comment, on it or the line above.
//   node tools/tamrielWide.mjs           report what is past the baseline, and what could be lowered
//   node tools/tamrielWide.mjs --lower   rewrite the baseline to today's counts (never raises one)
//   node tools/tamrielWide.mjs --where   print every counted line
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isMain } from './lib/isMain.mjs';

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
export const BASELINE = 'tools/tamrielWideBaseline.json';
export const SOURCE_DIRS = Object.freeze(['src', 'server/src', 'server-account/src']);
/** The marker that takes a line out of the count: the Bay's own data, read on purpose. */
export const BAY_OWN = 'BAY-OWN:';

/** Each idiom: what it matches, and what answers for the whole world instead. */
export const IDIOMS = Object.freeze([
  {
    id: 'pixel-id',
    re: /\b[\w.]*[yY]\w*\s*\*\s*1000\s*\+\s*[\w.]*[xX]\w*/,
    use: 'worldPixelKey (world/worldWide/worldGrid.js): MapsFile\'s y * 1000 + x is unique on the Bay alone',
  },
  {
    id: 'region-walk',
    re: /for\s*\([^)]*\bregionCount\b/,
    use: 'the places registry (world/worldWide/worldPlaces.js): MAPS.BSA\'s regions hold no place past the Bay',
  },
  {
    id: 'bay-bound',
    re: /\b(?:px|py|mapX|mapY|mapPixelX|mapPixelY|pixelX|pixelY)\s*(?:<|>=|<=|>)\s*(?:1000|999|500|499)\b/,
    use: 'worldPixelOk (net/wire.js) for a bound, inBay (world/tamriel/tamrielFrame.js) for the Bay\'s own data',
  },
  {
    id: 'region-62',
    re: /\bregion\w*\s*(?:<|>=|<=|>)\s*6[12]\b/i,
    use: 'BAY_REGION_COUNT or theatreOfRegion (formats/mapsTables.js): the provinces are regions 62..70',
  },
]);

/** The code of a line, without a trailing `//` comment; '' for a comment line. Strings are not parsed: close enough
 *  for a count, and a URL in a string only ever shortens what is read. */
export function codeOf(line) {
  const t = line.trim();
  if (t.startsWith('//') || t.startsWith('*') || t.startsWith('/*')) return '';
  const at = line.indexOf('//');
  return at >= 0 && !/:\s*$/.test(line.slice(0, at)) ? line.slice(0, at) : line;
}

/** Whether line `i` is the Bay's own on purpose: the marker on it or on the line above. */
const ownedAt = (lines, i) => lines[i].includes(BAY_OWN) || (i > 0 && lines[i - 1].includes(BAY_OWN));

/** Counts of each idiom in one source text: `{ id: n }`, idioms with none left out. */
export function countIn(text) {
  const lines = String(text).split('\n');
  const out = {};
  lines.forEach((line, i) => {
    if (ownedAt(lines, i)) return;
    const code = codeOf(line);
    if (!code) return;
    for (const { id, re } of IDIOMS) if (re.test(code)) out[id] = (out[id] ?? 0) + 1;
  });
  return out;
}

/** Every counted line in one text: `[{ id, line, text }]` (1-based line numbers, for a report). */
export function linesIn(text) {
  const lines = String(text).split('\n');
  const out = [];
  lines.forEach((line, i) => {
    if (ownedAt(lines, i)) return;
    const code = codeOf(line);
    for (const { id, re } of IDIOMS) if (code && re.test(code)) out.push({ id, line: i + 1, text: line.trim() });
  });
  return out;
}

const sourceFiles = (root) => SOURCE_DIRS.filter((d) => existsSync(join(root, d))).flatMap((d) =>
  readdirSync(join(root, d), { recursive: true }).map((f) => `${d}/${String(f).split('\\').join('/')}`).filter((f) => /\.m?js$/.test(f)));

/** The tree's counts: `{ idiom: { file: n } }`, every idiom present, files sorted. */
export function measure(root = ROOT) {
  const out = Object.fromEntries(IDIOMS.map(({ id }) => [id, {}]));
  for (const f of sourceFiles(root).sort()) {
    for (const [id, n] of Object.entries(countIn(readFileSync(join(root, f), 'utf8')))) out[id][f] = n;
  }
  return out;
}

/** Against `base`: a file past its count for an idiom (none for one not listed), and a count now lower than written. */
export function verdict(now, base) {
  const over = [], stale = [];
  for (const { id } of IDIOMS) {
    const b = base[id] ?? {}, n0 = now[id] ?? {};
    for (const [f, n] of Object.entries(n0)) if (n > (b[f] ?? 0)) over.push(`${id} ${f}: ${n} (allowed ${b[f] ?? 0})`);
    for (const [f, n] of Object.entries(b)) if ((n0[f] ?? 0) < n) stale.push(`${id} ${f}: ${n0[f] ?? 0} (baseline ${n})`);
  }
  return { over, stale };
}

/** The baseline lowered to `now`: never raised, an entry at zero dropped. */
export function lowered(base, now) {
  return Object.fromEntries(IDIOMS.map(({ id }) => [id, Object.fromEntries(Object.entries(base[id] ?? {})
    .map(([f, n]) => [f, Math.min(n, now[id]?.[f] ?? 0)]).filter(([, n]) => n > 0).sort(([x], [y]) => x.localeCompare(y)))]));
}

if (isMain(import.meta.url)) {
  const path = join(ROOT, BASELINE);
  const base = existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) : {};
  if (process.argv.includes('--where')) {
    for (const f of sourceFiles(ROOT).sort()) {
      for (const { id, line, text } of linesIn(readFileSync(join(ROOT, f), 'utf8'))) console.log(`${id}  ${f}:${line}  ${text}`);
    }
  } else if (process.argv.includes('--lower')) {
    writeFileSync(path, `${JSON.stringify(lowered(base, measure()), null, 1)}\n`);
    console.log('baseline lowered');
  } else {
    const { over, stale } = verdict(measure(), base);
    for (const o of over) console.log(`OVER  ${o} - ${IDIOMS.find((d) => o.startsWith(`${d.id} `))?.use}`);
    for (const s of stale) console.log(`LOWER ${s}`);
    if (!over.length && !stale.length) console.log('tamriel-wide: within the baseline');
    process.exitCode = over.length || stale.length ? 1 : 0;
  }
}
