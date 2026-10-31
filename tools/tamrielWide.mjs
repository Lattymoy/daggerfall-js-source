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

// The spellings. A pixel's coordinate is `py`, `mapPixelY`, `loc.y`; the Bay's width is 1000 or a constant naming it
// (MapsFile's MaxMapPixelX, WOODS' MAP_WIDTH, the frame's BAY_W). AUDIT TAMRIEL-WIDE II T2: the named constants, the
// reversed and bracketed forms and a zero-padded mask, which the first patterns missed. AUDIT TAMRIEL-WIDE III P5/T9: the
// Bay's width by its other names (roadNetwork.js MAP_W, staffCommands.js TP_MAP_W), and a bound handed to a call.
const Y = String.raw`(?:[\w.]*\.p?y|[a-z]?[a-z]?y\d?|\w*Y\d?)`;
const X = String.raw`(?:[\w.]*\.p?x|[a-z]?[a-z]?x\d?|\w*X\d?)`;
const WIDE = String.raw`(?:1000|MAP_WIDTH|MAX_MAP_PIXEL_X|BAY_W|MAP_W|TP_MAP_W)`;
const AT = String.raw`(?:p?[xy]\d?|m[xy]|b[xy]|[nqtcgw][xy]|mapX|mapY|mapPixelX|mapPixelY|pixelX|pixelY|[a-z]+\.p?[xy])`;
const EDGE = String.raw`(?:1000|999|500|499|(?:MAP_WIDTH|MAP_HEIGHT|MAX_MAP_PIXEL_X|MAX_MAP_PIXEL_Y|BAY_W|BAY_H|MAP_W|MAP_H|TP_MAP_W|TP_MAP_H)(?:\s*-\s*1)?)`;
const CMP = String.raw`(?:<=|>=|<|>)`;
/** A coordinate handed to a call with the Bay's edge as its bound: `integer(a.MapX, 999)`, `ok(px, 999)`, `intIn(px, 0, 999)`. */
const ARG_COORD = String.raw`[\w.]*(?:\b[pmbnqtcgw]?[xy]\d?|Map[XY]|Pixel[XY]|map[XY]|pixel[XY])`;
const ARG_BOUND = String.raw`\(\s*${ARG_COORD}\s*,\s*(?:0\s*,\s*)?(?:999|499)\s*\)`;

/** Each idiom: what it matches, and what answers for the whole world instead. */
export const IDIOMS = Object.freeze([
  {
    id: 'pixel-id',
    re: new RegExp(
      [
        String.raw`\b${Y}\s*\)?\s*\*\s*${WIDE}\s*\)?\s*\+\s*\(?\s*${X}\b`,
        String.raw`\b${X}\s*\+\s*\(?\s*${Y}\s*\*\s*${WIDE}\b`,
        String.raw`\b${X}\s*\+\s*\(?\s*${WIDE}\s*\*\s*${Y}\b`,
        String.raw`\b${WIDE}\s*\*\s*${Y}\s*\)?\s*\+\s*${X}\b`,
      ].join('|'),
    ),
    use: "worldPixelKey (world/worldWide/worldGrid.js): MapsFile's y * 1000 + x is unique on the Bay alone",
  },
  {
    id: 'pixel-mask',
    re: /&\s*0x0*[fF]{5}\b(?!f)|%\s*0x100000\b/,
    use: "discoveryKeyOf (systems/discovery.js): a MapId's low 20 bits name one place on the Bay alone",
  },
  {
    id: 'region-count',
    re: /(?:<|>=|<=|>)\s*\(?\s*[\w.?]*\bregionCount\b/,
    use: "the places registry (world/worldWide/worldPlaces.js): MAPS.BSA's regions hold no place past the Bay",
  },
  {
    id: 'bay-bound',
    // a coordinate against the Bay's edge, either way round - not one that is a difference (a time, a height)
    re: new RegExp(
      String.raw`(?<![-+*/%.]\s*)\b${AT}\s*${CMP}\s*${EDGE}(?!\s*[-+*/])\b|\b${EDGE}\s*${CMP}\s*${AT}\b|${ARG_BOUND}`,
    ),
    use: "worldPixelOk (net/wire.js) for a bound, inBay (world/tamriel/tamrielFrame.js) for the Bay's own data",
  },
  {
    id: 'bay-clamp',
    re: /Math\.(?:min|max)\(\s*(?:999|499|(?:MAP_W|MAP_H|MAP_WIDTH|MAP_HEIGHT|BAY_W|BAY_H)\s*-\s*1)\b|Math\.min\([^)]*(?:MAP_W|MAP_WIDTH|BAY_W)\s*-\s*1\s*-\s*p?x|Math\.(?:min|max)\(\s*[\w.]+\s*,\s*(?:999|499)\s*\)/,
    use: 'the world grid (world/worldWide/worldGrid.js inWorldGrid): a pixel clamped into the Bay is a wrong pixel past it',
  },
  {
    id: 'region-62',
    re: /\b(?:region\w*|reg|r)\s*(?:<|>=|<=|>)\s*6[12]\b|\(\s*[\w.]*region\w*\s*,\s*(?:0\s*,\s*)?6[12]\s*\)/i,
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

/** The marker, in a comment, with its reason after it. AUDIT TAMRIEL-WIDE II T4: never one in a string, nor a bare one. */
const MARKED = new RegExp(String.raw`(?:\/\/|\/\*|^\s*\*).*${BAY_OWN}(?:\s*\S){3}`);
/** Whether line `i` is the Bay's own on purpose: the marker on it, or on a comment line just above - a code line's
 *  marker is its own line's alone. */
const ownedAt = (lines, i) =>
  MARKED.test(lines[i]) || (i > 0 && /^\s*(?:\/\/|\/\*|\*)/.test(lines[i - 1]) && MARKED.test(lines[i - 1]));

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

const sourceFiles = (root) =>
  SOURCE_DIRS.filter((d) => existsSync(join(root, d))).flatMap((d) =>
    readdirSync(join(root, d), { recursive: true })
      .map((f) => `${d}/${String(f).split('\\').join('/')}`)
      .filter((f) => /\.m?js$/.test(f)),
  );

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
  const over = [],
    stale = [];
  for (const { id } of IDIOMS) {
    const b = base[id] ?? {},
      n0 = now[id] ?? {};
    for (const [f, n] of Object.entries(n0)) if (n > (b[f] ?? 0)) over.push(`${id} ${f}: ${n} (allowed ${b[f] ?? 0})`);
    for (const [f, n] of Object.entries(b))
      if ((n0[f] ?? 0) < n) stale.push(`${id} ${f}: ${n0[f] ?? 0} (baseline ${n})`);
  }
  return { over, stale };
}

/** The baseline lowered to `now`: never raised, an entry at zero dropped. */
export function lowered(base, now) {
  return Object.fromEntries(
    IDIOMS.map(({ id }) => [
      id,
      Object.fromEntries(
        Object.entries(base[id] ?? {})
          .map(([f, n]) => [f, Math.min(n, now[id]?.[f] ?? 0)])
          .filter(([, n]) => n > 0)
          .sort(([x], [y]) => x.localeCompare(y)),
      ),
    ]),
  );
}

if (isMain(import.meta.url)) {
  const path = join(ROOT, BASELINE);
  const base = existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) : {};
  if (process.argv.includes('--where')) {
    for (const f of sourceFiles(ROOT).sort()) {
      for (const { id, line, text } of linesIn(readFileSync(join(ROOT, f), 'utf8')))
        console.log(`${id}  ${f}:${line}  ${text}`);
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
