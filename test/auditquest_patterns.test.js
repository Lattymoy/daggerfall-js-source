// AUDIT-QUEST - THE 82 ACTION PATTERNS, REGENERATED FROM DFU (2026-09-15).
//
// A quest script is a text file. Every line of every one of the 265
// vendored quests reaches the machine through exactly one action's
// `Pattern` regex, so those 82 patterns ARE the quest system's surface:
// a missing alternative is a quest line the reference accepts and the
// port silently refuses.
//
// The repo already has a family of pins that regenerate a port table
// from Daggerfall Unity's own C# and compare cell for cell - ENEMY_BASICS
// off EnemyBasics.cs, LOOT_MATRICES off LootTables.cs, the ingredient
// ITEM_GROUPS off ItemEnums.cs (see test/dfuRoot.mjs, PY1). The quest
// system had no member of it. This is that member.
//
// WHAT IS COMPARED, and the one language difference that is not drift.
// C# permits the SAME named group in different alternates of one regex -
// `(?<symbol>...)|...(?<symbol>...)` - and JavaScript does not, so the
// port renames or suffixes the repeats (`symbol2`, `sym`, `setvarName`,
// `notName`). Seven patterns differ in exactly that way and in no other.
// So the comparison erases group NAMES and compares the SKELETON, which
// is where a missing alternative, a changed literal or a loosened
// character class would show - and it is exact, all 82.
//
// (The 82nd, WorldUpdate, is the port's one declared guard: it parses
// the verbatim pattern and refuses the line, because the action routes
// into WorldDataVariants and zero vendored quests write one. Its pattern
// lives in the guard registry rather than on a class, and is read from
// there so the count stays 82 rather than 81 and a silent drop of the
// guard fails here.)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dfuFile } from './dfuRoot.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(root, p), 'utf8');

/** DFU names the class; the port renames seven of them. */
const RENAMED = Object.freeze({
  Climate: 'ClimateCondition', Enemies: 'EnemiesAction', KillFoe: 'KillFoeAction',
  Season: 'SeasonCondition', SetPlayerCrime: 'SetPlayerCrimeAction',
  SpawnCityGuards: 'SpawnCityGuardsAction', Weather: 'WeatherCondition',
});

/** The concatenated string literals inside `public override string Pattern`. */
function dfuPattern(src) {
  const i = src.search(/public\s+override\s+string\s+Pattern/);
  if (i < 0) return null;
  let d = 0, k = src.indexOf('{', i);
  const start = k;
  for (; k < src.length; k++) { if (src[k] === '{') d++; else if (src[k] === '}' && --d === 0) break; }
  const body = src.slice(start, k + 1);
  return [...body.matchAll(/@"((?:[^"]|"")*)"/g)].map((m) => m[1].replace(/""/g, '"')).join('') || null;
}

/** The port's, off the class - a `/.../` literal or a built `new RegExp`. */
function portPatterns() {
  const src = read('src/systems/quest/actions.js');
  const out = new Map();
  for (const m of src.matchAll(/export class ([A-Za-z0-9_]+) extends ActionTemplate \{([\s\S]*?)\n\}/g)) {
    const [, name, body] = m;
    const g = body.match(/get pattern\(\)\s*\{([\s\S]*?)\n {2}\}/);
    if (!g) continue;
    const lit = g[1].match(/return\s+\/((?:\\.|\[(?:\\.|[^\]])*\]|[^/\\])*)\/[a-z]*\s*;/);
    if (lit) { out.set(name, lit[1]); continue; }
    if (/new RegExp\(/.test(g[1])) {
      const parts = [...g[1].matchAll(/'((?:\\.|[^'\\])*)'/g)].map((p) => p[1].replace(/\\\\/g, '\\'));
      if (parts.length) out.set(name, parts.join(''));
    }
  }
  // ...and the guard registry, so the declared-but-refused action counts
  for (const m of src.matchAll(/^ {2}([A-Za-z0-9_]+): \/(.+)\/,$/gm)) out.set(m[1], m[2]);
  return out;
}

/**
 * The pattern's STRUCTURE, with group naming erased entirely.
 *
 * Two differences the port is entitled to, and no third:
 *  - C# permits the same named group in different alternates of one
 *    regex and JavaScript does not, so the port renames the repeats.
 *  - The one DECLARED GUARD (WorldUpdate) only has to match the line and
 *    refuse it - it reads no groups - so it captures without naming.
 * Erasing `(?<name>` to `(` covers both and leaves everything a drift
 * would touch: the alternatives, the literal words, the character
 * classes, the quantifiers and the order.
 */
const skeleton = (s) => s.replace(/\(\?<[A-Za-z_][A-Za-z0-9_]*>/g, '(').replace(/\\\//g, '/').trim();

const ACTIONS_DIR = 'Assets/Scripts/Game/Questing/Actions';
const dfuDir = () => {
  const u = dfuFile(`${ACTIONS_DIR}/CreateFoe.cs`);
  return existsSync(u) ? dirname(u.pathname ?? String(u).replace('file://', '')) : null;
};

test('AUDIT-QUEST: every DFU action Pattern regenerates the port\'s, skeleton for skeleton', (t) => {
  const dir = dfuDir();
  if (!dir) return t.skip('no Daggerfall Unity checkout - set DFU_PATH (test/dfuRoot.mjs)');
  const files = readdirSync(dir).filter((f) => f.endsWith('.cs')).sort();
  assert.equal(files.length, 82, `DFU ships ${files.length} action classes, not the 82 this pin was written against`);

  const port = portPatterns();
  const bad = [];
  let compared = 0;
  for (const f of files) {
    const name = f.slice(0, -3);
    const mine = port.get(RENAMED[name] ?? name);
    const theirs = dfuPattern(readFileSync(join(dir, f), 'utf8'));
    if (!theirs) { bad.push(`${name}: DFU carries no Pattern this reader can find`); continue; }
    if (!mine) { bad.push(`${name}: the port has no pattern for it - an action the corpus can name and nothing answers`); continue; }
    compared++;
    if (skeleton(theirs) !== skeleton(mine)) {
      bad.push(`${name}:\n      DFU : ${skeleton(theirs)}\n      port: ${skeleton(mine)}`);
    }
  }
  assert.equal(compared, 82, `only ${compared} of 82 patterns were actually compared - the extractor has gone blind somewhere`);
  assert.deepEqual(bad, [],
    'a quest line the reference accepts is a line this port silently refuses (or the reverse).\n'
    + 'Group NAMES are erased before comparing - C# allows duplicates in alternates and JS does not, which is\n'
    + 'the only difference the port is entitled to. Anything else here is drift.');
});

test('AUDIT-QUEST: the port answers every action DFU ships, by class or by declared guard', (t) => {
  const dir = dfuDir();
  if (!dir) return t.skip('no Daggerfall Unity checkout - set DFU_PATH (test/dfuRoot.mjs)');
  const port = portPatterns();
  const missing = readdirSync(dir).filter((f) => f.endsWith('.cs')).map((f) => f.slice(0, -3))
    .filter((n) => !port.has(RENAMED[n] ?? n));
  assert.deepEqual(missing, [],
    'DFU ships this action and the port has neither an implementation nor a declared guard for it.\n'
    + 'A guard is an honest answer (it parses the verbatim pattern and refuses the line, naming its blocker);\n'
    + 'silence is not.');
});
