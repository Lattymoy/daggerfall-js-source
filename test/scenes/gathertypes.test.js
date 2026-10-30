// OW-GATHER-TYPES (a player's ask): the Overworld's gathering groups under the Gathering refinements - the real gathering
// host (its herb, mine and tree kinds) over a stood pixel, `overworldGroups` read with a type switched off and with
// "Workable by me" at a low and a high rank (systems/travel/travelViewGatherFilters.js).
import '../chargenDom.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { createGatherHost, GROUP_REFRESH_MS, GROUP_LIFT_M, groupLabel } from '../../src/scenes/gatherHost.js';
import { herbKind } from '../../src/scenes/herbHost.js';
import { mineKind } from '../../src/scenes/mineHost.js';
import { treeKind } from '../../src/scenes/treeHost.js';
import { setForagingHost } from '../../src/systems/foraging/foragingInstall.js';
import { CLIMATES, LOCATION_TYPES } from '../../src/formats/mapsFile.js';
import { trees, veins, boulders, utcDayOfMs } from '../../src/net/nodeLaw.js';
import { groundAt } from '../../src/world/terrain/terrainNature.js';
import { HEIGHTMAP_DIMENSION, TERRAIN_SIZE } from '../../src/world/terrain/terrainSampler.js';
import { tierOpen } from '../../src/net/professionLaw.js';
import { gatherTypeKey, toggleGatherMine, toggleGatherType, setGatherSection, _resetTravelViewGather } from '../../src/systems/travel/travelViewGatherFilters.js';

const WOODS = CLIMATES.Woodlands, GLENUMBRA = 59;
const NOON_MS = (20500 * 86_400 + 43_200) * 1000;
const DAY = utcDayOfMs(NOON_MS);
const tick = () => new Promise((r) => setImmediate(r));
const WILD = Object.freeze({ inside: false, insideDungeon: false, insideCastle: false, locationType: LOCATION_TYPES.None, inLocationRect: false,
  hour: 12, climate: WOODS, region: GLENUMBRA, enemiesNear: false, carriedWeight: 0, maxEncumbrance: 100, swimming: false, exteriorWater: 'None' });

/** A Woodlands pixel on flat grass: a rock piece by every vein and boulder, the forest's flats by the law's trees. */
function pixelEntry(px, py) {
  const samples = new Float32Array(HEIGHTMAP_DIMENSION * HEIGHTMAP_DIMENSION).fill(0.5);
  const rocks = veins({ x: px, y: py, day: DAY, climate: WOODS, region: GLENUMBRA }).map((v) => [v.u * TERRAIN_SIZE - 2, 0, v.v * TERRAIN_SIZE + 4, v.u * TERRAIN_SIZE + 2, 6, v.v * TERRAIN_SIZE + 8]);
  for (const b of boulders({ x: px, y: py, day: DAY, climate: WOODS })) {
    const x = b.u * TERRAIN_SIZE, z = b.v * TERRAIN_SIZE, g = groundAt(samples, x, z);
    rocks.push([x - 1.5, g - 1, z + 1, x + 1.5, g + 4, z + 4]);
  }
  const flats = trees({ x: px, y: py, day: DAY, climate: WOODS }).map((t, i) => ({ id: i, group: '504_12', i, x: t.u * TERRAIN_SIZE + 1, y: 0, z: t.v * TERRAIN_SIZE }));
  const batch = { archive: 504, record: 12, size: { w: 4, h: 8 } };
  const forest = { base: 504, archive: 504, trees: flats, groups: new Map([['504_12', { batch, centers: flats.map((f) => [f.x, f.y, f.z]), size: batch.size }]]) };
  return { px, py, samples, tilemap: new Uint8Array(128 * 128).fill(2), locationRect: null, batches: [], rocks, forest };
}

/** The gathering host over `pixels` (each [px, py], laid out east of the first), its clock the test's. */
async function stage(pixels = [[405, 150]]) {
  const S = { now: NOON_MS, taken: new Set(), open: true, shift: [0, 0, 0], rank: 100 };
  const book = {
    state: { open: true, today: {}, caps: { stores: 5000 } },
    stale: () => false, refresh: async () => ({ ok: true }), pixel: () => ({ state: 'none' }), askPixels: async () => [], pump: () => {},
    dungeon: () => null, askDungeon: async () => false, held: () => 0, taken: (key) => S.taken.has(key), counting: () => false,
    track: () => ({ rank: S.rank, specs: { 50: null, 100: null } }), harvest: () => new Promise(() => {}),
  };
  S.book = book;
  const renderer = { createBillboardBatch: () => ({}), destroyBatch: () => {}, moveBillboardBatch: () => true };
  const [x0, y0] = pixels[0];
  const built = new Map(pixels.map(([px, py]) => [`${px},${py}`, pixelEntry(px, py)]));
  S.host = createGatherHost({
    book, kinds: [herbKind({ book }), mineKind({ book }), treeKind({ book, renderer })],
    hud: { setPrompt: () => {}, setMeter: () => {}, toast: () => {}, banner: () => {}, setChip: () => {}, frame: () => {}, dispose: () => {} },
    renderer, getTexture: async () => ({ recordCount: 999 }), uploadRecord: () => {}, billboardSize: () => ({ w: 0.3, h: 0.3 }), flatBatchAabb: () => [0, 0, 0, 0, 0, 0],
    built: () => built, pixelTranslation: (x, y, out) => { out[0] = (x - x0) * TERRAIN_SIZE + S.shift[0]; out[1] = S.shift[1]; out[2] = (y0 - y) * TERRAIN_SIZE + S.shift[2]; return out; },   // `shift`: the floating origin's
    pixelInfo: () => ({ climate: WOODS, region: GLENUMBRA }), nowMs: () => S.now,
    eye: () => ({ pos: [0, 1.6, 0], dir: [0, 0, 1] }), view: () => ({ yaw: 0, pitch: 0 }), feet: () => [0, 0, 0], entity: () => ({ items: [] }),
    keyLabel: () => 'E', input: () => ({ held: false, attack: false, choice: false }), active: () => true, activeDungeon: () => false,
  });
  setForagingHost({ world: () => WILD, monthValue: () => 5, entity: () => null, startQuest: () => true, professionsOpen: () => true, keyLabel: () => 'E', professionUse: () => false });
  for (const e of built.values()) S.host.onBuilt(e);
  S.built = built;
  await tick(); await tick();
  S.nodes = (px, py, kind) => S.host.nodesOf(px, py).filter((n) => n.kind === kind);
  S.later = () => { S.now += GROUP_REFRESH_MS + 1; };
  S.done = () => { S.host.dispose(); setForagingHost(null); };
  return S;
}


const MID = [TERRAIN_SIZE / 2, 0, TERRAIN_SIZE / 2];
const labelOf = (g, kind) => g.find((m) => m.kind === kind)?.label ?? null;
/** The pixel's nodes of a kind the Overworld counts, with their type keys. */
const typed = (s, kindId) => s.nodes(405, 150, kindId).map((n) => ({ n, type: gatherTypeKey(kindId, n) }));

test('OW-GATHER-TYPES groups: a type switched off leaves its nodes out of the group\'s count and the group itself when none are left - and at once, not at the next refresh (mutants: the filter unread; the count of the whole pixel; the cache kept)', async () => {
  _resetTravelViewGather();
  const s = await stage();
  try {
    const mining = typed(s, 'mine');
    const types = [...new Set(mining.map((m) => m.type))];
    assert.ok(types.length >= 2, `the pixel's mining has more than one type: ${types}`);
    assert.equal(labelOf(s.host.overworldGroups(MID), 'gather mining'), groupLabel('mining', mining.length), 'by default every node counts');
    // one type off - read again at once (no s.later())
    const off = types[0], left = mining.filter((m) => m.type !== off).length;
    toggleGatherType(off);
    assert.equal(labelOf(s.host.overworldGroups(MID), 'gather mining'), groupLabel('mining', left), 'only that type left the count');
    assert.equal(labelOf(s.host.overworldGroups(MID), 'gather logging'), groupLabel('logging', typed(s, 'tree').length), 'the other professions untouched');
    // every type off: no group of it
    for (const t of types) if (t !== off) toggleGatherType(t);
    assert.ok(!s.host.overworldGroups(MID).some((m) => m.kind === 'gather mining'), 'every mining type off: no mining glyph');
    // a profession's None, then its All
    setGatherSection('tree', false);
    assert.ok(!s.host.overworldGroups(MID).some((m) => m.kind === 'gather logging'), 'logging: None');
    setGatherSection('tree', true);
    setGatherSection('mine', true);
    assert.equal(labelOf(s.host.overworldGroups(MID), 'gather logging'), groupLabel('logging', typed(s, 'tree').length), 'logging: All');
    assert.equal(labelOf(s.host.overworldGroups(MID), 'gather mining'), groupLabel('mining', mining.length), 'mining: All');
  } finally { s.done(); _resetTravelViewGather(); }
});

test('OW-GATHER-TYPES groups: "Workable by me" counts only the nodes the player\'s rank can work, by that profession\'s rank (mutants: the rank read from another profession; the tier compared to the rank; the switch ignored)', async () => {
  _resetTravelViewGather();
  const s = await stage();
  try {
    const all = { mine: typed(s, 'mine'), tree: typed(s, 'tree'), herb: typed(s, 'herb') };
    const open = (kind, rank) => all[kind].filter(({ n }) => tierOpen(rank, n.tier)).length;
    assert.ok(all.mine.some(({ n }) => n.tier > 1) || all.tree.some(({ n }) => n.tier > 1) || all.herb.some(({ n }) => n.tier > 1), 'the pixel stands something above tier 1, or the test proves nothing');
    s.rank = 0;
    toggleGatherMine();
    const g = s.host.overworldGroups(MID);
    for (const [kind, profession] of [['mine', 'mining'], ['tree', 'logging'], ['herb', 'herbalism']]) {
      const want = open(kind, 0);
      assert.equal(labelOf(g, `gather ${profession}`), want ? groupLabel(profession, want) : null, `${profession} at rank 0`);
    }
    // a master sees every node, switch on or off
    s.rank = 100; s.later();   // a rank is read again at the refresh (a rank rises a harvest at a time)
    assert.equal(labelOf(s.host.overworldGroups(MID), 'gather mining'), groupLabel('mining', all.mine.length));
    toggleGatherMine();   // off again
    s.rank = 0; s.later();
    assert.equal(labelOf(s.host.overworldGroups(MID), 'gather mining'), groupLabel('mining', all.mine.length), 'switch off: rank no longer matters');
  } finally { s.done(); _resetTravelViewGather(); }
});

test('OW-GATHER-TYPES wiring: the host drops a node before it is counted, asks the filters from `overworldGroups` and stops listening with `dispose` (by source)', () => {
  const src = readFileSync(new URL('../../src/scenes/gatherHost.js', import.meta.url), 'utf8');
  assert.match(src, /gatherNodeShown\(k\.id, n, rank\(profession\)\)/, 'every node is asked');
  assert.match(src, /const stopGatherFilters = onTravelViewGather\(\(\) => \{ groupsAt = null; \}\)/, 'a changed switch drops the cache');
  assert.match(src, /stopGatherFilters\(\); hud\.dispose\(\)/, 'dispose lets go of the listener');
});

test('OW-GATHER-NEAR: a group\'s glyph stands on the node of it nearest the player and moves to the next nearest as the player walks - at the refresh, never every call; its count and key stay the pixel\'s (mutants: the nodes\' middle; the first node; the glyph never moved)', async () => {
  _resetTravelViewGather();
  const s = await stage();
  try {
    for (const [kindId, kind, profession] of [['mine', 'gather mining', 'mining'], ['tree', 'gather logging', 'logging'], ['herb', 'gather herbalism', 'herbalism']]) {
      const nodes = s.nodes(405, 150, kindId);
      assert.ok(nodes.length >= 3, `${profession}: ${nodes.length} nodes`);
      const nearestTo = (x, z) => nodes.reduce((b, n) => (Math.hypot(n.local[0] - x, n.local[2] - z) < Math.hypot(b.local[0] - x, b.local[2] - z) ? n : b));
      // stand at each of two far-apart nodes' feet: the glyph is on that node, not on the middle
      const first = nodes[0], far = nodes.reduce((b, n) => (Math.hypot(n.local[0] - first.local[0], n.local[2] - first.local[2]) > Math.hypot(b.local[0] - first.local[0], b.local[2] - first.local[2]) ? n : b));
      const at = (n) => [n.local[0], n.local[1] + GROUP_LIFT_M, n.local[2]];
      s.later();
      const read = s.host.overworldGroups([first.local[0], 0, first.local[2]]).find((m) => m.kind === kind);
      const here = { ...read, at: [...read.at] };   // a mark's `at` is written in place at every call
      assert.deepEqual(here.at, at(nearestTo(first.local[0], first.local[2])), `${profession}: on the node beside the player`);
      assert.equal(here.label, groupLabel(profession, nodes.length), 'the whole group\'s count');
      // walk to the far node: not moved until the refresh, then there
      const there = [far.local[0], 0, far.local[2]];
      assert.deepEqual(s.host.overworldGroups(there).find((m) => m.kind === kind).at, here.at, 'within GROUP_REFRESH_MS: as read');
      s.later();
      const moved = s.host.overworldGroups(there).find((m) => m.kind === kind);
      assert.deepEqual(moved.at, at(nearestTo(far.local[0], far.local[2])), `${profession}: on the node beside the player now`);
      assert.equal(moved.key, here.key, 'the same mark - the pixel\'s');
      assert.equal(moved.label, here.label);
    }
  } finally { s.done(); _resetTravelViewGather(); }
});
