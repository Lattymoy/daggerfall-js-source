// PINE-SHARE (2026-09-30, Mac: "2 in 5 trees Pine"; found tracing GATHER-SAID, `06-Systems/Online-Arc.md`). Pine is the
// one tier-1 wood (PROF0 4.2) and stood only in the Mountain and Mountain Woods: the Woodlands, the Haunted Woodlands and
// the Swamp stood Oak alone on ground nobody confirmed (Logging 10), and the Rainforest and Subtropical stood nothing - a
// Novice logger in five of the seven forests could never chop. Every herb table and every vein table holds a tier 1; the
// woods were the one gap. Now a forest whose own woods hold no tier 1 stands PINE_SHARE of its trees as Pine (section 6's
// tier-1 weight, 2 in 5), on any ground, after the rare wood's roll; the Mountain and Mountain Woods are untouched. The
// service recomputes each tree from this law, so the fix is the law's alone. bible/06-Systems/Professions-Arc.md 25.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { standService, T0 } from '../accountDb.mjs';
import {
  trees, nodeKey, WOOD_TABLES, NODE_COUNTS, PINE_WOOD, PINE_SHARE, NODE_TIER_WEIGHTS, regionWritTable, drawFromTable, nodeRoll,
} from '../../src/net/nodeLaw.js';
import { xpForRank, harvestXp } from '../../src/net/professionLaw.js';
import { SEASONS } from '../../src/systems/gameDate.js';
import { sharedClassicMinutes } from '../../src/net/wire.js';
import { utcDay } from '../../src/net/marksLaw.js';

const MOUNTAIN = 226, RAINFOREST = 227, SWAMP = 228, SUBTROPICAL = 229, MOUNTAIN_WOODS = 230, WOODS = 231, HAUNTED = 232, DESERT = 224;
const PINELESS = [WOODS, HAUNTED, SWAMP, RAINFOREST, SUBTROPICAL];
const GLENUMBRA = 59;
const DAY = 86_400;

/** Every tree of `days` days of `xs` pixels in a climate, on one kind of ground. */
function sample(climate, confirmed, { days = 30, xs = 60 } = {}) {
  const out = [];
  for (let day = 20500; day < 20500 + days; day++) for (let x = 0; x < xs; x++) out.push(...trees({ x, y: 100, day, climate, confirmed }));
  return out;
}
const share = (ts, pred) => ts.filter(pred).length / Math.max(1, ts.length);
/** The share of a climate's tree SLOTS that stand Pine - an unconfirmed Rainforest's other slots stand nothing. */
const slotShare = (climate, confirmed, { days = 30, xs = 60 } = {}) => sample(climate, confirmed, { days, xs }).filter((t) => t.material === PINE_WOOD).length / (days * xs * NODE_COUNTS[climate].tree);

// ─── THE LAW ─────────────────────────────────────────────────────────

test('PINE-SHARE law: Pine, 2 trees in 5, in every forest whose woods hold no tier 1 - on ground nobody confirmed too', () => {
  assert.equal(PINE_WOOD, 'log:pine');
  assert.equal(PINE_SHARE, NODE_TIER_WEIGHTS[0] / 100);
  assert.equal(PINE_SHARE, 0.4);
  for (const c of PINELESS) {
    assert.ok(!WOOD_TABLES[c].includes(PINE_WOOD), `${c}: its own woods hold no Pine`);
    for (const confirmed of [false, true]) {
      const ts = sample(c, confirmed);
      const pine = slotShare(c, confirmed);
      assert.ok(pine > 0.34 && pine < 0.46, `${c} ${confirmed ? 'confirmed' : 'unconfirmed'}: about 2 trees in 5 Pine (${pine.toFixed(3)})`);
      assert.ok(ts.filter((t) => t.material === PINE_WOOD).every((t) => t.tier === 1 && t.rare === false));
    }
  }
});

test('PINE-SHARE law: a Novice can chop in every forest - Woodlands, Haunted Woodlands and Swamp stand Pine beside their Oak; an unconfirmed Rainforest or Subtropical pixel stands only Pine (no Teak on anyone\'s word)', () => {
  for (const c of [WOODS, HAUNTED, SWAMP]) {
    const ts = sample(c, false);
    assert.deepEqual([...new Set(ts.map((t) => t.material))].sort(), ['log:oak', PINE_WOOD], `${c}: Oak and Pine, nothing past tier 2`);
  }
  for (const c of [RAINFOREST, SUBTROPICAL]) {
    const ts = sample(c, false);
    assert.ok(ts.length > 0, `${c}: trees stand unconfirmed now`);
    assert.ok(ts.every((t) => t.material === PINE_WOOD), `${c}: Pine alone - Teak, Mahogany and Cherry are past tier 2`);
  }
  // most pixels a day hold a Pine where Pine is the share (the Swamp's three trees the fewest)
  for (const c of PINELESS) {
    let pixels = 0, withPine = 0;
    for (let day = 20500; day < 20530; day++) for (let x = 0; x < 60; x++) { pixels++; if (trees({ x, y: 100, day, climate: c, confirmed: false }).some((t) => t.material === PINE_WOOD)) withPine++; }
    assert.ok(withPine / pixels > 0.75, `${c}: ${withPine} of ${pixels} pixels hold a Pine`);
  }
});

test('PINE-SHARE law: the Mountain and Mountain Woods, whose woods hold Pine, are untouched - every tree the table\'s own draw; the rare wood still rolls first, and the Desert stands none', () => {
  for (const c of [MOUNTAIN, MOUNTAIN_WOODS]) {
    for (let day = 20500; day < 20520; day++) {
      for (let x = 0; x < 40; x++) {
        for (const t of trees({ x, y: 100, day, climate: c, confirmed: true })) {
          const want = drawFromTableOf(c, x, day, t.slot);
          assert.deepEqual([t.material, t.tier], [want.material, want.tier], `${c} (${x}, ${day}) slot ${t.slot}: the table's draw`);
        }
      }
    }
  }
  assert.ok(Math.abs(share(sample(MOUNTAIN_WOODS, false), (t) => t.material === PINE_WOOD) - 40 / 65) < 0.05, 'Mountain Woods: Pine at its table\'s weight (40:25), not a share on top');
  assert.equal(sample(DESERT, true).length, 0);
  const rare = sample(HAUNTED, true, { days: 40, xs: 80 }).filter((t) => t.rare);
  assert.ok(rare.length > 0 && rare.every((t) => t.material === 'log:ghostwood'), 'the rare wood still stands');
  const rareShare = rare.length / (40 * 80 * NODE_COUNTS[HAUNTED].tree);
  assert.ok(rareShare > 0.04 && rareShare < 0.06, `the rare wood rolls first - still one tree in twenty (${rareShare.toFixed(3)})`);
});

/** What the table alone draws for a slot - the tree law before PINE-SHARE: tree()'s dice 3 and 4 through the table. */
const unitOf = (x, day, slot, k) => nodeRoll('tree', x, 100, day, slot, k) / 4294967296;
const drawFromTableOf = (climate, x, day, slot) => drawFromTable(WOOD_TABLES[climate], unitOf(x, day, slot, 3), unitOf(x, day, slot, 4), 7);

test('PINE-SHARE law: a Court may ask for the Pine a forest stands - the writ table names it wherever the share stands it', () => {
  const woods = (climate, confirmed) => regionWritTable(17, [{ climate, confirmed }], SEASONS.Summer).map((m) => m.material).filter((k) => k.startsWith('log:'));
  assert.deepEqual(woods(WOODS, false), ['log:oak', PINE_WOOD]);
  assert.deepEqual(woods(RAINFOREST, false), [PINE_WOOD], 'an unconfirmed Rainforest: its Pine alone');
  assert.deepEqual(woods(MOUNTAIN, false), [PINE_WOOD], 'the Mountain: its own');
  assert.deepEqual(woods(DESERT, true), [], 'the Desert grows no tree');
});

// ─── THE SERVICE ─────────────────────────────────────────────────────

const hourAt = (s) => Math.floor((((Math.floor(sharedClassicMinutes(s * 1000)) % 1440) + 1440) % 1440) / 60);
function secondAt(from, want) {
  for (let s = from; s < from + 2 * 7200; s += 30) if (hourAt(s) === want && hourAt(s - 60) === want && hourAt(s + 60) === want) return s;
  throw new Error('no such hour');
}
const NOON = secondAt(utcDay(T0) * DAY + 3600, 12);
const realNow = Date.now;
Date.now = () => NOON * 1000;
test.after(() => { Date.now = realNow; });
let _rid = 0;
const rid = () => `pine-${String(++_rid).padStart(6, '0')}`;
function treeAt(climate, pred, from = 300) {
  const day = utcDay(NOON);
  for (let x = from; x < from + 600; x++) {
    const t = trees({ x, y: 210, day, climate, confirmed: false }).find(pred);
    if (t) return { x, climate, ...t, key: nodeKey({ kind: 'tree', x, y: 210, day, slot: t.slot }) };
  }
  throw new Error('no such tree');
}
const chop = (who, n, act = { cuts: 0, clean: false }) => ({
  character: who.character, node: n.key, kind: 'logs', climate: n.climate, region: GLENUMBRA, act, at: NOON - 2, rid: rid(),
});

test('PINE-SHARE service: a Novice logger in the Woodlands fells a Pine (Logging XP 15, 22 clean) and is refused an Oak - the service\'s tree is the law\'s', async () => {
  const s = await standService({ PROFESSIONS_OPEN: 'on', MARKS_OPEN: 'on', DEVELOPER_HANDLES: 'Mac' });
  const mac = await s.seated('Mac');
  const pine = treeAt(WOODS, (t) => t.material === PINE_WOOD);
  const r = await s.call('/v1/prof/harvest', chop(mac, pine), mac.secret);
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.deepEqual([r.body.material, r.body.xp, r.body.track.profession, r.body.track.xp], [PINE_WOOD, harvestXp(1, 0, false), 'logging', 15]);
  const clean = treeAt(WOODS, (t) => t.material === PINE_WOOD, pine.x + 1);
  const c = await s.call('/v1/prof/harvest', chop(mac, clean, { cuts: 3, clean: true }), mac.secret);
  assert.equal(c.status, 200, JSON.stringify(c.body));
  assert.equal(c.body.xp, harvestXp(1, 0, true));
  assert.equal(harvestXp(1, 0, true), 22);
  const oak = treeAt(WOODS, (t) => t.material === 'log:oak');
  assert.deepEqual((await s.call('/v1/prof/harvest', chop(mac, oak), mac.secret)).body, { error: 'prof-rank' }, 'Oak still asks Logging 10');
  assert.ok(xpForRank(10) > 37, 'the rank the Oak asks is far above two Pines');
  const rain = treeAt(RAINFOREST, () => true, 800);   // pixels of its own: a node's key names no climate
  assert.equal(rain.material, PINE_WOOD);
  const rr = await s.call('/v1/prof/harvest', chop(mac, rain), mac.secret);
  assert.equal(rr.status, 200, `an unconfirmed Rainforest Pine is felled: ${JSON.stringify(rr.body)}`);
});
