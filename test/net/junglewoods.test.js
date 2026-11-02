// JUNGLE-WOODS (2026-10-19, the owner: "The forest region we recently implemented should be a large tree gathering spot.
// Moreso than other places within daggerfall"): a map pixel of the Jungle of Bantha - the owner's area
// (world/jungle/banthaArea.js) - stands JUNGLE_TREE_SLOTS trees a day, four times the richest woods' anywhere else, and
// every one of them stands: a slot whose wood waits on the witnesses (an unconfirmed Rainforest's Teak and Mahogany)
// stands Pine there, where elsewhere it stands nothing. The law is the area's, never the switch's - the service
// recomputes every tree from it. bible/06-Systems/Professions-Arc.md (JUNGLE-WOODS), bible/03-World/Bantha-Jungle.md.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { standService, T0 } from '../accountDb.mjs';
import { trees, tree, treeSlots, nodeKey, NODE_COUNTS, WOOD_TABLES, JUNGLE_TREE_SLOTS, PINE_WOOD } from '../../src/net/nodeLaw.js';
import { banthaAreaHas, BANTHA_AREA_ROWS } from '../../src/world/jungle/banthaArea.js';
import { xpForRank } from '../../src/net/professionLaw.js';
import { standTrees } from '../../src/scenes/treeHost.js';
import { CLIMATES as C } from '../../src/formats/mapsTables.js';
import { utcDay } from '../../src/net/marksLaw.js';

const DAY = 86_400;
const SATAKALAAM = [839, 302], LAINLYN = [737, 289], MOURNOTH = [954, 318];
const OUTSIDE = [700, 210];   // the Bay's north, far from the area
const REGION = 50;   // Satakalaam's
const WOODED = Object.keys(WOOD_TABLES).map(Number);
const day0 = 20745;

// ─── THE LAW ─────────────────────────────────────────────────────────

test('JUNGLE-WOODS law: the jungle stands four times the richest woods\' trees a day - whatever its climate\'s woods, none where no wood grows; outside it every climate keeps its own count (mutants: the count, the area unread, the woods unasked)', () => {
  const richest = Math.max(...Object.values(NODE_COUNTS).map((c) => c.tree));
  assert.equal(richest, 12, 'the Woodlands\' and the Rainforest\'s twelve');
  assert.equal(JUNGLE_TREE_SLOTS, 4 * richest);
  assert.equal(JUNGLE_TREE_SLOTS, 48);
  for (const [x, y] of [SATAKALAAM, LAINLYN, MOURNOTH]) {
    assert.ok(banthaAreaHas(x, y), `${x},${y}: the owner's area`);
    for (const climate of WOODED) assert.equal(treeSlots({ x, y, climate }), JUNGLE_TREE_SLOTS, `${x},${y} climate ${climate}`);
    for (const climate of [C.Desert, C.Desert2, C.Ocean]) assert.equal(treeSlots({ x, y, climate }), 0, `${x},${y} climate ${climate}: no wood grows`);
  }
  for (const climate of [...WOODED, C.Desert, C.Ocean]) {
    assert.equal(treeSlots({ x: OUTSIDE[0], y: OUTSIDE[1], climate }), WOOD_TABLES[climate] ? NODE_COUNTS[climate].tree : 0, `outside, climate ${climate}`);
  }
  // the area's own edge, pixel for pixel: a row's first and last pixel inside, the next ones out
  const [y, x0, x1] = BANTHA_AREA_ROWS[Math.floor(BANTHA_AREA_ROWS.length / 2)];
  assert.deepEqual([x0 - 1, x0, x1, x1 + 1].map((x) => treeSlots({ x, y, climate: C.Rainforest })), [12, 48, 48, 12], `row ${y}: ${x0}-${x1}`);
});

test('JUNGLE-WOODS law: every jungle slot stands a tree - an unconfirmed Rainforest\'s 48 all Pine (tier 1: no Teak on anyone\'s word), a confirmed one\'s its own woods and Pine and the rare Ironwood; outside the area an unconfirmed Rainforest leaves its slots past tier 2 empty, as it did (mutants: the Pine fill everywhere, the fill gone, a fill past tier 1)', () => {
  let fresh = 0, sure = 0;
  const seen = new Set();
  for (let day = day0; day < day0 + 20; day++) {
    for (const [x, y] of [SATAKALAAM, LAINLYN, MOURNOTH]) {
      const u = trees({ x, y, day, climate: C.Rainforest });
      assert.equal(u.length, JUNGLE_TREE_SLOTS, `${x},${y} day ${day}: every slot stands unconfirmed`);
      assert.ok(u.every((t) => t.material === PINE_WOOD && t.tier === 1 && t.rare === false), 'Pine, tier 1, never rare');
      assert.deepEqual(u.map((t) => t.slot), [...Array(JUNGLE_TREE_SLOTS).keys()]);
      fresh += u.length;
      const c = trees({ x, y, day, climate: C.Rainforest, confirmed: true });
      assert.equal(c.length, JUNGLE_TREE_SLOTS, 'and every slot confirmed');
      for (const t of c) seen.add(t.material);
      sure += c.length;
      // the Mountain's foothills in the area: Pine, every slot
      assert.equal(trees({ x, y, day, climate: C.Mountain }).length, JUNGLE_TREE_SLOTS);
    }
    assert.ok(trees({ x: OUTSIDE[0], y: OUTSIDE[1], day, climate: C.Rainforest }).every((t) => t.material === PINE_WOOD), 'outside, unconfirmed: Pine alone');
  }
  assert.equal(fresh, sure);
  assert.deepEqual([...seen].sort(), ['log:ironwood', 'log:mahogany', PINE_WOOD, 'log:teak'], 'a confirmed jungle\'s own woods, Pine, and the rare Ironwood');
  // outside: over many days an unconfirmed Rainforest stands about 2 in 5 of its twelve (PINE-SHARE)
  let n = 0;
  for (let day = day0; day < day0 + 200; day++) n += trees({ x: OUTSIDE[0], y: OUTSIDE[1], day, climate: C.Rainforest }).length;
  assert.ok(n / (200 * 12) > 0.3 && n / (200 * 12) < 0.5, `about 2 in 5 outside (${(n / 2400).toFixed(2)})`);
});

test('JUNGLE-WOODS law: one tree by its slot - the jungle\'s 48th stands and its 49th does not; outside, the climate\'s 13th does not (mutants: the slot bound the climate\'s)', () => {
  const [x, y] = SATAKALAAM;
  assert.ok(tree({ x, y, day: day0, slot: JUNGLE_TREE_SLOTS - 1, climate: C.Rainforest }));
  assert.equal(tree({ x, y, day: day0, slot: JUNGLE_TREE_SLOTS, climate: C.Rainforest }), null);
  assert.equal(tree({ x, y, day: day0, slot: 0, climate: C.Desert }), null);
  assert.equal(tree({ x: OUTSIDE[0], y: OUTSIDE[1], day: day0, slot: NODE_COUNTS[C.Woodlands].tree, climate: C.Woodlands }), null);
  assert.ok(tree({ x: OUTSIDE[0], y: OUTSIDE[1], day: day0, slot: NODE_COUNTS[C.Woodlands].tree - 1, climate: C.Woodlands }));
});

// ─── THE CLIENT ──────────────────────────────────────────────────────

test('JUNGLE-WOODS client: a jungle pixel stands its 48 trees, each at its own tree flat, none inside a rock piece (mutants: the rock check gone, the claim unkept)', () => {
  const [px, py] = SATAKALAAM;
  const flats = [];
  for (let i = 0; i < 400; i++) flats.push({ id: i, group: 'J0', i, x: 2 + (i % 20) * 40, y: 0, z: 2 + Math.floor(i / 20) * 40 });
  const rocks = [[0, -5, 0, 200, 5, 200]];   // a rock piece over the pixel's first corner
  const stood = standTrees({ px, py, day: day0, climate: C.Rainforest, forest: { trees: flats }, rocks });
  assert.equal(stood.length, JUNGLE_TREE_SLOTS);
  assert.equal(new Set(stood.map((n) => n.flat.id)).size, JUNGLE_TREE_SLOTS, 'one node a flat');
  assert.ok(stood.every((n) => !(n.flat.x <= 200 && n.flat.z <= 200)), 'none inside the rock piece');
  assert.deepEqual(stood.map((n) => n.key), stood.map((n) => nodeKey({ kind: 'tree', x: px, y: py, day: day0, slot: n.slot })));
  // outside, the climate's twelve at most
  assert.ok(standTrees({ px: OUTSIDE[0], py: OUTSIDE[1], day: day0, climate: C.Woodlands, forest: { trees: flats } }).length <= NODE_COUNTS[C.Woodlands].tree);
});

// ─── THE SERVICE ─────────────────────────────────────────────────────

const realNow = Date.now;
test.after(() => { Date.now = realNow; });

test('JUNGLE-WOODS service: a jungle tree past the climate\'s twelve is felled - its Pine, on ground nobody confirmed; the jungle\'s 49th and a Woodlands pixel\'s 13th are no node (mutants: the service\'s slots the climate\'s)', async () => {
  const now = utcDay(T0) * DAY + 12 * 3600;
  Date.now = () => now * 1000;
  const s = await standService({ PROFESSIONS_OPEN: 'on', MARKS_OPEN: 'on', DEVELOPER_HANDLES: 'Mac' });
  const raw = s.env.DB._raw;
  const mac = await s.seated('Mac');
  raw.prepare(`INSERT INTO prof_tracks (player, char_id, profession, xp, spec50, spec100, updated_at) VALUES (?, ?, ?, ?, NULL, NULL, ?)
    ON CONFLICT (player, char_id, profession) DO UPDATE SET xp = excluded.xp`).run(mac.id, mac.character, 'logging', xpForRank(10), now);
  const day = utcDay(now);
  let rid = 0;
  const chop = (x, y, slot, climate) => ({
    character: mac.character, node: nodeKey({ kind: 'tree', x, y, day, slot }), kind: 'logs', climate, region: REGION,
    act: { cuts: 0, clean: false }, at: now - 2, rid: `jungle-${String(++rid).padStart(6, '0')}`,
  });
  const [x, y] = SATAKALAAM;
  const r = await s.call('/v1/prof/harvest', chop(x, y, 40, C.Rainforest), mac.secret);
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.deepEqual([r.body.material, r.body.kind], [PINE_WOOD, 'logs'], 'the jungle\'s 41st tree: its Pine');
  assert.deepEqual((await s.call('/v1/prof/harvest', chop(x, y, JUNGLE_TREE_SLOTS, C.Rainforest), mac.secret)).body, { error: 'bad-node' });
  assert.deepEqual((await s.call('/v1/prof/harvest', chop(OUTSIDE[0], OUTSIDE[1], 12, C.Woodlands), mac.secret)).body, { error: 'bad-node' });
  const ok = await s.call('/v1/prof/harvest', chop(OUTSIDE[0], OUTSIDE[1], 11, C.Woodlands), mac.secret);
  assert.equal(ok.status, 200, JSON.stringify(ok.body));
});
