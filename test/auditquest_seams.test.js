// AUDIT-QUEST F1/F2/F3 - THE BRIDGE STATES WHAT IT WAS GIVEN (2026-09-15).
//
// Three findings, one root cause: `createQuestBridge` never reported
// which of its contract members the host left unwired.
//
//   F1  THE WORD "LOUDLY" WAS WRITTEN OVER AN OPERATION THAT IS SILENT.
//       `machine.js:55` - "absent = headless, every Place pends its site
//       LOUDLY" - and `place.js:16`/`:128`/`:172`, `person.js:15` and
//       the bridge's own header all said it. What happens is
//       `sitePending = true`: a boolean. MEASURED against the real
//       corpus: all 265 vendored quests start with no world seam, and
//       262 emit nothing at all. 215 of the quest system's 229
//       optional-chained seam calls are silent on absence.
//
//   F2  `scenes/exterior.js` wires 30 of 65. The 35 it does not include
//       the whole item family, the reward, the disease and curse cures,
//       video, song, and every talk and rumor seam - and `?exterior` is
//       the scene a developer reaches for to test a quest.
//
//   F3  The gate that exists to catch that - audit24_questseams'
//       "every bridge ctx seam is SUPPLIED or declared PENDING" - opens
//       `src/scenes/world.js` BY NAME and reads no other host.
//
// The bridge reports at construction now. This file keeps the contract
// honest and reads EVERY host, derived, so F3 cannot come back here.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { QUEST_CTX_CONTRACT, QUEST_CTX_OPTIONAL_BY_DESIGN, reportUnwiredSeams } from '../src/scenes/questBridge.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(root, p), 'utf8');
const decomment = (s) => s.replace(/\/\/[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '');

/** Every `src/scenes/*.js` that builds a bridge - DERIVED, which is the
 *  whole of F3. A sixth host joins these checks by existing. */
function hostsBuildingABridge() {
  return readdirSync(join(root, 'src/scenes')).filter((f) => f.endsWith('.js'))
    .map((f) => `src/scenes/${f}`)
    .filter((p) => /questBridge = createQuestBridge\(/.test(read(p)))
    .sort();
}

/** The top-level keys of a host's ctx literal. */
function wiredBy(path) {
  const src = read(path);
  const i = src.indexOf('questBridge = createQuestBridge(');
  assert.ok(i > 0, `${path} no longer builds a bridge the way this gate reads`);
  let d = 0, k = src.indexOf('{', i);
  const start = k;
  for (; k < src.length; k++) {
    const c = src[k];
    if (c === '/' && src[k + 1] === '/') { k = src.indexOf('\n', k); continue; }
    if (c === '\'' || c === '"' || c === '`') { const q = c; for (k++; k < src.length; k++) { if (src[k] === '\\') k++; else if (src[k] === q) break; } continue; }
    if (c === '{') d++; else if (c === '}' && --d === 0) break;
  }
  const body = decomment(src.slice(start, k + 1));
  const keys = new Set();
  let depth = 0;
  for (const line of body.split('\n')) {
    const m = line.trim().match(/^([A-Za-z_$][\w$]*)\s*[:(,]/);
    if (depth === 1 && m) keys.add(m[1]);
    depth += (line.match(/[{[(]/g) ?? []).length - (line.match(/[}\])]/g) ?? []).length;
  }
  return keys;
}

test('AUDIT-QUEST: the contract IS the bridge\'s own usage, both ways', () => {
  // A hand-kept contract list would be F3 again in a new place, so it is
  // re-derived from the bridge's source here on every run.
  const body = decomment(read('src/scenes/questBridge.js'));
  const used = new Set([...body.matchAll(/\bctx\??\.([A-Za-z_$][\w$]*)/g)].map((m) => m[1]));
  const listed = new Set(QUEST_CTX_CONTRACT);
  assert.deepEqual([...used].filter((k) => !listed.has(k)).sort(), [],
    'the bridge reads a ctx member the contract does not list - add it, or the host is never told it is missing');
  assert.deepEqual([...listed].filter((k) => !used.has(k)).sort(), [],
    'the contract lists a member the bridge no longer reads - a host would be warned about a seam nothing wants');
  assert.ok(QUEST_CTX_CONTRACT.length >= 60, `the contract collapsed to ${QUEST_CTX_CONTRACT.length} members - the derivation has broken`);
});

test('AUDIT-QUEST F1: an absent seam SAYS SO - the charter\'s "loudly", made true', () => {
  const said = [];
  const warn = console.warn, error = console.error;
  console.warn = (...a) => said.push(a.join(' '));
  console.error = (...a) => said.push(a.join(' '));
  try {
    const absent = reportUnwiredSeams({ data: {} }, QUEST_CTX_CONTRACT, 'a bare ctx');
    assert.ok(absent.length > 50, 'a bare ctx is missing nearly everything');
    assert.equal(said.length, 1, 'ONE line, not sixty - a report nobody reads is the silence it replaced');
    assert.match(said[0], new RegExp(`wired ${1 + QUEST_CTX_OPTIONAL_BY_DESIGN.length}/\\d+ seams`), 'data, and the members a host may decline on purpose (QREPAIR added hasQuestTopics to them)');
    assert.match(said[0], /these quest verbs will idle/);
    // ...and a fully wired ctx says nothing at all.
    said.length = 0;
    const full = Object.fromEntries(QUEST_CTX_CONTRACT.map((k) => [k, () => {}]));
    assert.deepEqual(reportUnwiredSeams(full, QUEST_CTX_CONTRACT, 'a full ctx'), []);
    assert.equal(said.length, 0, 'a host that wired everything hears nothing');
  } finally { console.warn = warn; console.error = error; }
});

test('AUDIT-QUEST F1: the REQUIRED member is an error, not a warning', () => {
  const said = [];
  const warn = console.warn, error = console.error;
  console.warn = () => {}; console.error = (...a) => said.push(a.join(' '));
  try {
    reportUnwiredSeams({}, QUEST_CTX_CONTRACT, 'a ctx with no data seam');
    assert.equal(said.length, 1, 'the one member the bridge cannot work without is louder than the rest');
    assert.match(said[0], /wired NO data/);
  } finally { console.warn = warn; console.error = error; }
});

test('AUDIT-QUEST F3: EVERY host that builds a bridge is read, and the shipping host wires the lot', () => {
  const hosts = hostsBuildingABridge();
  assert.ok(hosts.includes('src/scenes/world.js'), 'the shipping host still builds the bridge');
  assert.ok(hosts.length >= 2, `only ${hosts.length} host builds a bridge - this gate used to read one BY NAME, which was F3`);

  // The SHIPPING host must wire everything the bridge reads, bar the
  // members declared optional by design. A new seam added to the bridge
  // and not wired here fails on the next run instead of idling in play.
  const owed = QUEST_CTX_CONTRACT.filter((k) => !QUEST_CTX_OPTIONAL_BY_DESIGN.includes(k));
  const w = wiredBy('src/scenes/world.js');
  assert.deepEqual(owed.filter((k) => !w.has(k)), [],
    'src/scenes/world.js is the host players actually run. A contract member it does not wire is a quest verb\n'
    + 'that idles in the real game - which, before the bridge reported, it did in silence.');

  // Every OTHER host is read too, and its coverage recorded rather than
  // demanded: a dev scene may legitimately wire less. What it may not do
  // is wire less WITHOUT the bridge saying so, which the F1 test pins.
  for (const h of hosts.filter((p) => p !== 'src/scenes/world.js')) {
    const keys = wiredBy(h);
    const missing = owed.filter((k) => !keys.has(k));
    assert.ok(keys.size > 0, `${h} builds a bridge and this gate could parse no members out of it`);
    assert.match(read(h), /createQuestBridge\([\s\S]{0,40000}?\{ label: '/,
      `${h} builds a bridge without a label, so its report would not name it`);
    assert.ok(missing.length < QUEST_CTX_CONTRACT.length, `${h} wires nothing at all`);
  }
});

test('AUDIT-QUEST F1: no line claims LOUD over a silent assignment', () => {
  // THE GENERATIVE FORM OF F1. The word was written five times across
  // the quest system over `x = true` - a boolean. It is a good word and
  // the charter needs it, so it is kept for the places that really do
  // raise something (`machine.js:228` and `questMacros.js:17` surface
  // C#'s own error shapes, and they throw). What it may not do again is
  // sit on a line whose whole effect is to set a flag.
  const bad = [];
  const dir = join(root, 'src/systems/quest');
  for (const f of readdirSync(dir).filter((n) => n.endsWith('.js'))) {
    read(`src/systems/quest/${f}`).split('\n').forEach((line, i) => {
      if (!/\bLOUD(LY)?\b/i.test(line)) return;
      // the claim is on a line that ASSIGNS and does nothing else
      if (/^\s*(this\.)?[A-Za-z_$][\w$.]*\s*=\s*(true|false|null|\d+)\s*;/.test(line)) {
        bad.push(`src/systems/quest/${f}:${i + 1} - "${line.trim().slice(0, 78)}"`);
      }
    });
  }
  assert.deepEqual(bad, [],
    'this line says it is loud and its whole effect is to set a flag. Either raise something, or say PENDS -\n'
    + 'AUDIT-QUEST F1 measured the difference: 262 of 265 vendored quests start headless with nothing in the log.');
});
