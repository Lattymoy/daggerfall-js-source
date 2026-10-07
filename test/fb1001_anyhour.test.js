// ANY-HOUR (2026-10-01, Mac: "Remove the time limit for professions. Should be available at any time"). The
// professions borrowed Foraging's checks for an act's start (FORAGE0 14.3) - daylight 07:00-17:59 among them - so from
// 18:00 to 06:59 a vein, a boulder, an herb patch (the Sickle's or the Basket's), a tree and the net said "You need
// daylight to mine effectively!" and the like, and the service refused any surface harvest whose act ended in those
// hours (`prof-night`, on the shared clock). Now a profession's act keeps no hours: the client never asks the daylight
// (systems/foragingInstall.js foragingActRefusal), the net's prompt names no hour (scenes/fishHost.js NET_WHERE), the
// words say none, and the service answers a harvest at any hour (server-account/src/professions.js harvestNode).
// Foraging's own Use - offline and a guest's lane, the mod's 1:1 - keeps the mod's day (test/forage2_tools.test.js
// pins its refusal). The real gathering host with its kinds over a stood pixel (test/fb0930b_toolsaid.test.js's), and
// the real Worker over node:sqlite (test/accountDb.mjs).
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { setForagingHost, createForagingItem, foragingActRefusal, PROFESSION_TOOL_HOW } from '../src/systems/foragingInstall.js';
import { FT } from '../src/systems/foragingLaw.js';
import { CLIMATES, LOCATION_TYPES } from '../src/formats/mapsFile.js';
import { createGatherHost, aimAt } from '../src/scenes/gatherHost.js';
import { herbKind } from '../src/scenes/herbHost.js';
import { mineKind } from '../src/scenes/mineHost.js';
import { treeKind } from '../src/scenes/treeHost.js';
import { NET_WHERE, NET_WHERE_WORDS } from '../src/scenes/fishHost.js';
import { FISHING_HOW } from '../src/ui/profPages.js';
import { trees, veins, boulders, nodeKey, utcDayOfMs } from '../src/net/nodeLaw.js';
import { sharedClassicMinutes } from '../src/net/wire.js';
import { utcDay } from '../src/net/marksLaw.js';
import { groundAt } from '../src/world/terrainNature.js';
import { HEIGHTMAP_DIMENSION, TERRAIN_SIZE } from '../src/world/terrainSampler.js';
import { standService, T0 } from './accountDb.mjs';

const WOODS = CLIMATES.Woodlands, GLENUMBRA = 59;
const PX = 405, PY = 150;
const NOON_MS = (20500 * 86_400 + 43_200) * 1000;
const DAY = utcDayOfMs(NOON_MS);
const tick = () => new Promise((r) => setImmediate(r));
/** The wild at `hour`: no settlement, no foe near, the load light, dry ground. */
const wild = (hour) => ({ inside: false, insideDungeon: false, insideCastle: false, locationType: LOCATION_TYPES.None, inLocationRect: false,
  hour, climate: WOODS, region: GLENUMBRA, enemiesNear: false, carriedWeight: 10, maxEncumbrance: 100, swimming: false, exteriorWater: 'None' });

/** A Woodlands pixel on flat grass: a rock piece north of every vein, every boulder its own piece, the forest's flats a
 *  metre off the law's trees (test/fb1001_mining.test.js's). */
function pixelEntry() {
  const law = veins({ x: PX, y: PY, day: DAY, climate: WOODS, region: GLENUMBRA });
  const rocks = law.map((v) => [v.u * TERRAIN_SIZE - 2, 0, v.v * TERRAIN_SIZE + 4, v.u * TERRAIN_SIZE + 2, 6, v.v * TERRAIN_SIZE + 8]);
  const samples = new Float32Array(HEIGHTMAP_DIMENSION * HEIGHTMAP_DIMENSION).fill(0.5);
  for (const b of boulders({ x: PX, y: PY, day: DAY, climate: WOODS })) {
    const x = b.u * TERRAIN_SIZE, z = b.v * TERRAIN_SIZE, g = groundAt(samples, x, z);
    rocks.push([x - 1.5, g - 1, z + 1, x + 1.5, g + 4, z + 4]);
  }
  const flats = trees({ x: PX, y: PY, day: DAY, climate: WOODS }).map((t, i) => ({ id: i, group: '504_12', i, x: t.u * TERRAIN_SIZE + 1, y: 0, z: t.v * TERRAIN_SIZE }));
  const batch = { archive: 504, record: 12, size: { w: 4, h: 8 } };
  const forest = { base: 504, archive: 504, trees: flats, groups: new Map([['504_12', { batch, centers: flats.map((f) => [f.x, f.y, f.z]), size: batch.size }]]) };
  return { px: PX, py: PY, samples, tilemap: new Uint8Array(128 * 128).fill(2), locationRect: null, batches: [], rocks, forest };
}

/** A player with the Sickle, the Basket, the Pick-Axe and the Wood-Axe, every profession at 100 and open, in the wild at
 *  `hour` - and the gathering host over the pixel, its book a stand-in that records every harvest asked. */
async function stage(hour) {
  const S = { asked: [], said: [], prompt: null, meter: null };
  S.e = { stats: { intelligence: 60, agility: 60, strength: 55, endurance: 50, luck: 50 }, items: [FT.Sickle, FT.Basket, FT.PickAxe, FT.WoodAxe].map((t) => createForagingItem(t)), wagonItems: [] };
  const book = {
    state: { open: true, today: {}, caps: { stores: 5000 } },
    stale: () => false, refresh: async () => ({ ok: true }), pixel: () => ({ state: 'none' }), askPixels: async () => [], pump: () => {},
    dungeon: () => null, askDungeon: async () => false, held: () => 0, taken: () => false, counting: () => false,
    track: () => ({ rank: 100, specs: { 50: null, 100: null } }),
    harvest: (h) => { S.asked.push(h); return new Promise(() => {}); },
  };
  const feet = [400, 0, 400];
  const view = { yaw: 0, pitch: 0 };
  S.input = { held: false, attack: false, choice: false };
  const rad = Math.PI / 180;
  const eye = () => ({ pos: [feet[0], feet[1] + 1.6, feet[2]], dir: [Math.sin(view.yaw * rad) * Math.cos(view.pitch * rad), Math.sin(view.pitch * rad), Math.cos(view.yaw * rad) * Math.cos(view.pitch * rad)] });
  const renderer = { createBillboardBatch: () => ({}), destroyBatch: () => {}, moveBillboardBatch: () => true };
  const entry = pixelEntry();
  const built = new Map([[`${PX},${PY}`, entry]]);
  S.host = createGatherHost({
    book, kinds: [herbKind({ book }), mineKind({ book }), treeKind({ book, renderer })],
    hud: {
      setPrompt: (p) => { S.prompt = p; }, setMeter: (a) => { S.meter = a ? a.state.kind : null; },
      toast: (t) => S.said.push(t), banner: () => {}, setChip: () => {}, frame: () => {}, dispose: () => {},
    },
    renderer, getTexture: async () => ({ recordCount: 999 }), uploadRecord: () => {}, billboardSize: () => ({ w: 0.3, h: 0.3 }), flatBatchAabb: () => [0, 0, 0, 0, 0, 0],
    built: () => built, pixelTranslation: (x, y, out) => { out[0] = 0; out[1] = 0; out[2] = 0; return out; },
    pixelInfo: () => ({ climate: WOODS, region: GLENUMBRA }), nowMs: () => NOON_MS,
    eye, view: () => view, feet: () => feet, entity: () => S.e,
    keyLabel: (a) => ({ Interact: 'E', ActChoice: 'Up' })[a] ?? '?', input: () => S.input,
    active: () => true, activeDungeon: () => false, lit: () => S.lit ?? null,   // PROF-MENU: the plaque's lit row
  });
  setForagingHost({ world: () => wild(hour), monthValue: () => 5, entity: () => null, startQuest: () => true, professionsOpen: () => true, keyLabel: () => 'E', professionUse: () => false });
  S.host.onBuilt(entry);
  await tick(); await tick();
  S.nodes = (kind) => S.host.nodesOf(PX, PY).filter((n) => n.kind === kind);
  /** Stand a metre and a half south of a node and look at its aim point; the host finds its target. */
  S.face = (n) => {
    const [x, y, z] = n.local;
    feet[0] = x; feet[1] = y; feet[2] = z - 1.5;
    const a = aimAt([x, y + 1.6, z - 1.5], [x, y + (n.lift ?? 0.3), z], { yaw: 0, pitch: 0 });
    view.yaw = -a.yaw; view.pitch = -a.pitch;
    S.host.tick(0.016);
  };
  /** E at the node: whether an act began, and its kind. */
  S.start = (n) => { S.face(n); S.said.length = 0; S.host.press(); S.host.tick(0.016); const kind = S.host.acting() ? S.meter : null; S.host.cancel(); return kind; };
  S.done = () => { S.host.dispose(); setForagingHost(null); };
  return S;
}

test('ANY-HOUR: the instruction - at 21:00 and at 03:00 every gathering act starts: a vein and a boulder, an herb patch by the Sickle and by the Basket, a tree; the net\'s checks pass in the water (mutants: the act asks the daylight again)', async () => {
  for (const hour of [21, 3, 12]) {
    const s = await stage(hour);
    try {
      const vein = s.nodes('mine').find((n) => n.what === 'vein');
      const boulder = s.nodes('mine').find((n) => n.what === 'boulder');
      const tree = s.nodes('tree')[0];
      const patch = s.nodes('herb')[0];
      assert.ok(vein && boulder && tree && patch, `${hour}:00 - a vein, a boulder, a tree and a patch stand`);
      assert.equal(s.start(vein), 'mine', `${hour}:00 - the vein: ${s.said.join(' | ')}`);
      assert.equal(s.start(boulder), 'mine', `${hour}:00 - the boulder: ${s.said.join(' | ')}`);
      assert.equal(s.start(tree), 'chop', `${hour}:00 - the tree: ${s.said.join(' | ')}`);
      assert.ok(['hand', 'steady'].includes(s.start(patch)), `${hour}:00 - the patch's herbs (by hand, or the Sickle's steady hand): ${s.said.join(' | ')}`);
      // PROF-MENU: the patch's list - its Basket row lit and pressed
      s.lit = 'food';
      assert.equal(s.start(patch), 'basket', `${hour}:00 - the patch, by the Basket: ${s.said.join(' | ')}`);
      s.lit = null;
      assert.deepEqual(s.said.filter((l) => /daylight/.test(l)), [], 'no line asks for daylight');
      // the net: Foraging's checks for its act, in the water
      setForagingHost({ world: () => ({ ...wild(hour), swimming: true, exteriorWater: 'Swimming' }), monthValue: () => 5, entity: () => null, professionsOpen: () => true });
      assert.equal(foragingActRefusal(FT.FishingNet), null, `${hour}:00 - the net's act`);
      // and what the act still asks: a foe near, at any hour
      setForagingHost({ world: () => ({ ...wild(hour), enemiesNear: true }), monthValue: () => 5, entity: () => null, professionsOpen: () => true });
      assert.equal(foragingActRefusal(FT.PickAxe), 'You cannot mine with enemies nearby!', 'the other checks stand');
    } finally { s.done(); }
  }
});

test('ANY-HOUR: the words keep no hours - the Fishing-Net\'s line, the Fishing page and the net\'s prompt name none (mutants: the line, the page and the prompt said the daylight again)', () => {
  assert.doesNotMatch(PROFESSION_TOOL_HOW[FT.FishingNet]('E'), /daylight|07:00|17:59/);
  assert.match(PROFESSION_TOOL_HOW[FT.FishingNet]('E'), /^Fishing is done in water: stand in it, swim, or stand at sea until its acts show, then press E \(or use the Fishing-Net\)\.$/);   // PROF-MENU: its acts - the list, or the prompt
  assert.doesNotMatch(FISHING_HOW, /daylight|07:00|17:59/);
  assert.match(FISHING_HOW, /stand at sea, at any hour\./);
  assert.deepEqual([...NET_WHERE], ['inside', 'town'], 'the ground\'s words: inside and a settlement - never the hour');
  assert.deepEqual(Object.keys(NET_WHERE_WORDS), ['inside', 'town']);
});

// ─── THE SERVICE ─────────────────────────────────────────────────────

const SDAY = 86_400;
const MOUNTAIN = 226, WAYREST = 23;
const hourAt = (s) => Math.floor((((Math.floor(sharedClassicMinutes(s * 1000)) % 1440) + 1440) % 1440) / 60);
/** The first second from `from` at which the shared clock reads `want` o'clock, a minute either side too. */
function secondAt(from, want) {
  for (let s = from; s < from + 2 * 7200; s += 30) if (hourAt(s) === want && hourAt(s - 60) === want && hourAt(s + 60) === want) return s;
  throw new Error('no such hour');
}

test('ANY-HOUR: the service answers a harvest at any hour of the shared clock - a boulder\'s stone at 02:00, 21:00 and noon, each its own; Hunting and the dungeon veins never kept hours (mutants: the night refused again)', async () => {
  const realNow = Date.now;
  try {
    const s = await standService({ PROFESSIONS_OPEN: 'on', MARKS_OPEN: 'on', DEVELOPER_HANDLES: 'Mac' });
    const mac = await s.registered('Mac');
    let n = 0;
    for (const [i, want] of [2, 21, 12].entries()) {
      const at = secondAt(utcDay(T0) * SDAY + 3600, want);
      Date.now = () => at * 1000;
      const day = utcDay(at);
      assert.ok(boulders({ x: 400, y: 200, day, climate: MOUNTAIN }).length > i, 'a boulder for each hour');
      const body = { character: mac.character, node: nodeKey({ kind: 'boulder', x: 400, y: 200, day, slot: i }), kind: 'stone', climate: MOUNTAIN, region: WAYREST, act: { glints: 0 }, at: at - 2, rid: `anyhour-${String(++n).padStart(6, '0')}` };
      const r = await s.call('/v1/prof/harvest', body, mac.secret);
      assert.equal(r.status, 200, `${want}:00 on the shared clock: ${JSON.stringify(r.body)}`);
      assert.deepEqual([r.body.material, r.body.kind], ['stone:rough', 'stone'], `${want}:00: the stone`);
    }
  } finally { Date.now = realNow; }
});
