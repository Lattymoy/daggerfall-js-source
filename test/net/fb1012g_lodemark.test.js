// FIELD BUGS 2026-10-12g LODE-MARK - "Motherlodes don't show up on compass": "In the announce text it says to look for
// the motherlode on your compass but it doesn't come up at all unless its only from a certain distance? Makes it to
// where motherlodes can only be found by luck wandering around." The warning said "Look for it on your compass" ten
// minutes (a Sense's thirty) before anything stood to be marked; an account whose Motherlode today was found was told the
// same of lodes that stood for it nowhere; and the far mark was Mining's copper, under every vein and boulder in reach.
// The book's marks (net/motherlodeBook.js markedAll), the compass's colour (ui/nodeMarks.js) and the world host's
// wiring. bible/01-Overview/bugs/Field-Bugs-2026-10-12g.md.
import '../chargenDom.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { T0 } from '../accountDb.mjs';
import { createMotherlodeBook, MOTHERLODE_TEXT } from '../../src/net/motherlodeBook.js';
import { motherlodeKey } from '../../src/net/motherlodeLaw.js';
import { nodeMarkCss, nodeMarkRgb, nodeCompassPoints, MOTHERLODE_MARK_CSS, NODE_MARK_CSS, FIRE_MARK_CSS } from '../../src/ui/nodeMarks.js';
import { QUEST_MARK_CSS } from '../../src/ui/quest/questMarks.js';
import { PARTY_GREEN_CSS } from '../../src/net/social.js';
import { SHIP_MARK_CSS } from '../../src/ui/enhanced/enhancedHud.js';

const tick = () => new Promise((r) => setTimeout(r, 0));
const DAY0 = Math.floor(T0 / 86400);
const lode = (k, over = {}) => ({ k, key: motherlodeKey(DAY0, k), x: 300 + k, y: 120, climate: 226, region: 21, material: 'ore:ebony', opensAt: DAY0 * 86400 + k * 28800 + 3600, closesAt: DAY0 * 86400 + k * 28800 + 3600 + 7200, struck: 0, ...over });
function bookRig({ lodes = [lode(0), lode(1), lode(2)], found = null } = {}) {
  let nowS = DAY0 * 86400 + 60;
  const said = [];
  const door = { motherlodes: async () => ({ ok: true, data: { day: Math.floor(nowS / 86400), lodes: lodes.map((l) => ({ ...l })), found } }) };
  const b = createMotherlodeBook({ door, character: () => 'char-1', me: () => 'acct-1', nowS: () => nowS, nowMs: () => 1_000_000, say: (t) => said.push(t), regionName: () => 'Wrothgarian Mountains', oreName: () => 'Ebony', rand: () => 0 });
  return { b, said, at: (s) => { nowS = s; } };
}

test('LODE-MARK the compass marks a Motherlode from the moment its warning is said, through its rising, and not after it is spent or gone (mutants: the warned lode unmarked; marked before its warning; marked once spent)', async () => {
  const r = bookRig();
  r.b.tick(); await tick();
  const l0 = r.b.state.lodes[0];
  r.at(l0.opensAt - 900); r.b.tick();
  assert.deepEqual(r.b.markedAll(), [], 'nothing said yet: nothing marked');
  r.at(l0.opensAt - 600); r.b.tick();
  assert.equal(r.said.at(-1), MOTHERLODE_TEXT.warn('Ebony', 'Wrothgarian Mountains', 10));
  assert.deepEqual(r.b.markedAll().map((l) => l.key), [l0.key], '"Look for it on your compass" - and there it is');
  assert.deepEqual(r.b.standingAll(), [], 'though nothing stands on the ground yet');
  r.at(l0.opensAt + 5); r.b.tick();
  assert.deepEqual(r.b.markedAll().map((l) => l.key), [l0.key], 'risen: still marked');
  r.at(l0.closesAt); r.b.tick();
  assert.deepEqual(r.b.markedAll(), [], 'gone: no mark');
  const out = [];
  assert.equal(r.b.markedAll(out), out, 'into the caller\'s own list');
  const spent = bookRig({ lodes: [lode(0, { struck: 20 })] });
  spent.b.tick(); await tick();
  spent.at(spent.b.state.lodes[0].opensAt - 600); spent.b.tick();
  assert.deepEqual(spent.b.markedAll(), [], 'a spent lode is no mark');
});

test('LODE-MARK an account whose Motherlode today is found is told of none and shown none (mutants: the warning said to a finder; the risen line said; a finder marked)', async () => {
  const r = bookRig({ found: 'found-key' });
  r.b.tick(); await tick();
  const l0 = r.b.state.lodes[0];
  r.at(l0.opensAt - 600); r.b.tick();
  r.at(l0.opensAt + 5); r.b.tick();
  assert.deepEqual(r.said, [], 'neither the warning nor the rising - it stands for them nowhere');
  assert.deepEqual(r.b.markedAll(), []);
  assert.deepEqual(r.b.standingAll(), []);
  // warned, and then the day's find heard (another device's strike): the mark goes with it
  const late = bookRig();
  late.b.tick(); await tick();
  const k = late.b.state.lodes[1];
  late.at(k.opensAt - 600); late.b.tick();
  assert.deepEqual(late.b.markedAll().map((l) => l.key), [k.key], 'warned: marked');
  late.b.state.found = 'found-elsewhere';
  assert.deepEqual(late.b.markedAll(), [], 'found since: no mark');
});

test('LODE-MARK the far mark is its own colour, clear of every other mark on the strip, and drawn over the near veins (mutants: Mining\'s copper; the floats off the hex; the far mark first under the rest)', () => {
  assert.equal(nodeMarkCss('motherlode'), MOTHERLODE_MARK_CSS);
  assert.equal(MOTHERLODE_MARK_CSS, '#00e5c8');
  const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  assert.deepEqual(nodeMarkRgb('motherlode').map((v) => Math.round(v * 255)), rgb(MOTHERLODE_MARK_CSS));
  const others = [...Object.values(NODE_MARK_CSS), FIRE_MARK_CSS, QUEST_MARK_CSS, PARTY_GREEN_CSS, '#9a1808', '#ff5a2a', ...Object.values(SHIP_MARK_CSS)];
  for (const o of others) assert.ok(Math.hypot(...rgb(MOTHERLODE_MARK_CSS).map((v, i) => v - rgb(o)[i])) >= 75, `beside ${o}`);
  // the host hands the far marks FIRST: nodeCompassPoints draws its list last to first, so the first stands over the rest
  const pts = nodeCompassPoints([{ profession: 'motherlode', at: [0, 0, 900], d: 0, reach: 1 }, { profession: 'mining', at: [5, 0, 5], d: 7, reach: 150 }]);
  assert.equal(pts.at(-1).mark, 'motherlode', 'the last drawn, over every vein');
  const w = readFileSync(new URL('../../src/scenes/world.js', import.meta.url), 'utf8');
  assert.match(w, /for \(const l of motherlodeBook\.markedAll\(_lodesUp\)\) \{/);
  assert.match(w, /\{ profession: 'motherlode', at: \[0, 0, 0\], d: 0, reach: 1 \}/);
  assert.match(w, /return nodeCompassPoints\(far\.length \? \[\.\.\.far, \.\.\.\(near \?\? \[\]\)\] : near, trackerAnimals\(\)\);/);
});
