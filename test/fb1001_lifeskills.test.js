// FIELD BUGS 2026-10-01 - the life skills' audit, the rest (Mac: "Fix the rest").
//
// CAST-LOOK. Fishing's cast is a loose node "just ahead of the look" (scenes/fishHost.js), and it stood 0.6 m under the
// eye 3 m ahead whatever the look - a point the host's 12-degree cone held only between some 23 degrees down and under a
// degree up. Looking out over the water there was no prompt, E went on to the door behind, and the net's Use told an
// angler already in the water to "stand in it ... until the prompt shows". Now the cast stands where the look crosses
// 3 m ahead (castAt, held within CAST_RISE_M of the eye), and it yields: a node in the cone (an herb on the bank) is the
// target before it (`yields`, gatherHost findTarget).
//
// SETTLE-STAND. SETTLE-SAID made a ground node on a settlement's ground say "not in a settlement"; it still stood there,
// glowing and on the compass, where no act could ever work it. Now the host asks the world (`settled` - the acts' own
// check, Foraging's 'town': the place's pixel's town, farm, temple, tavern or wealthy home, its footprint and a city
// block round it) and stands none there - a vein, a boulder, a patch or a tree; Fishing's schools and Hunting's bodies
// are not the ground's.
//
// BOULDERS (acct47) are pinned where the law is (prof1_law, prof2_law, prof2_service) and ROCK-SHARE beside ROCK-FOOT
// (fb1001_rockfoot).
import './chargenDom.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { createGatherHost, aimAt, NODE_AIM_DEG, CAST_HANDBACK_MS } from '../src/scenes/gatherHost.js';
import { fishKind, castAt, CAST_AHEAD_M, CAST_RISE_M } from '../src/scenes/fishHost.js';
import { herbKind } from '../src/scenes/herbHost.js';
import { mineKind } from '../src/scenes/mineHost.js';
import { treeKind } from '../src/scenes/treeHost.js';
import { setForagingHost, createForagingItem } from '../src/systems/foragingInstall.js';
import { FT } from '../src/systems/foragingLaw.js';
import { CLIMATES, LOCATION_TYPES } from '../src/formats/mapsFile.js';
import { trees, veins, boulders, utcDayOfMs } from '../src/net/nodeLaw.js';
import { groundAt } from '../src/world/terrainNature.js';
import { HEIGHTMAP_DIMENSION, TERRAIN_SIZE } from '../src/world/terrainSampler.js';
import { worldCoordToMapPixel, isInLocationRect, locationWorldRect, mapPixelToWorldCoords, SCENE_MAP_RATIO, WORLD_MAP_RMB_DIM } from '../src/world/streamingWorld.js';
import { isPlayerInTown } from '../src/systems/nearbyObjects.js';

const WOODS = CLIMATES.Woodlands, GLENUMBRA = 59;
const PX = 405, PY = 150;
const NOON_MS = (20500 * 86_400 + 43_200) * 1000;
const DAY = utcDayOfMs(NOON_MS);
const tick = () => new Promise((r) => setImmediate(r));
const rad = Math.PI / 180;
/** The wild, the player in the water (the net's ground), no settlement, no foe. */
const WATER = Object.freeze({ inside: false, insideDungeon: false, insideCastle: false, locationType: LOCATION_TYPES.None, inLocationRect: false,
  hour: 12, climate: WOODS, region: GLENUMBRA, enemiesNear: false, carriedWeight: 0, maxEncumbrance: 100, swimming: true, exteriorWater: 'Swimming' });

/** A Woodlands pixel on flat grass: a rock piece north of every vein, every boulder its own piece, the forest's flats a
 *  metre off the law's trees (test/fb1001_anyhour.test.js's). */
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

/** The gathering host over the pixel with the ground's kinds and the net's, the player holding every tool, in the water;
 *  `settled` the world's settlement test, none by default. */
async function stage({ settled = undefined, more = [], nowMs = () => NOON_MS, deps = {} } = {}) {
  const S = { prompt: null, said: [] };
  S.e = { stats: { intelligence: 60, agility: 60, strength: 55, endurance: 50, luck: 50 }, fatigue: 1e9, items: [FT.Sickle, FT.Basket, FT.PickAxe, FT.WoodAxe, FT.FishingNet].map((t) => createForagingItem(t)), wagonItems: [] };   // rested (FISH-TIRED)
  const book = {
    state: { open: true, today: {}, hauls: 0, caps: { stores: 5000 } },
    stale: () => false, refresh: async () => ({ ok: true }), pixel: () => ({ state: 'none' }), askPixels: async () => [], pump: () => {},
    dungeon: () => null, askDungeon: async () => false, held: () => 0, taken: () => false, counting: () => false,
    track: () => ({ rank: 100, specs: { 50: null, 100: null } }), harvest: () => new Promise(() => {}),
  };
  S.feet = [400, 0, 400];
  S.view = { yaw: 0, pitch: 0 };
  const eye = () => ({ pos: [S.feet[0], S.feet[1] + 1.6, S.feet[2]], dir: [Math.sin(S.view.yaw * rad) * Math.cos(S.view.pitch * rad), Math.sin(S.view.pitch * rad), Math.cos(S.view.yaw * rad) * Math.cos(S.view.pitch * rad)] });
  const renderer = { createBillboardBatch: () => ({}), destroyBatch: () => {}, moveBillboardBatch: () => true };
  const fishHostDeps = { pixel: () => ({ x: PX, y: PY }), ground: () => ({ climate: WOODS, region: GLENUMBRA }), eye, feet: () => S.feet, hour: () => 12, storm: () => false, climateAt: () => WOODS, trophy: () => true, day: () => DAY };
  const entry = pixelEntry();
  const built = new Map([[`${PX},${PY}`, entry]]);
  S.host = createGatherHost({
    book, kinds: [herbKind({ book }), mineKind({ book }), treeKind({ book, renderer }), fishKind({ book, host: fishHostDeps }), ...more],
    hud: { setPrompt: (p) => { S.prompt = p; }, setMeter: () => {}, toast: (t) => S.said.push(t), banner: () => {}, setChip: () => {}, frame: () => {}, dispose: () => {} },
    renderer, getTexture: async () => ({ recordCount: 999 }), uploadRecord: () => {}, billboardSize: () => ({ w: 0.3, h: 0.3 }), flatBatchAabb: () => [0, 0, 0, 0, 0, 0],
    built: () => built, pixelTranslation: (x, y, out) => { out[0] = 0; out[1] = 0; out[2] = 0; return out; },
    pixelInfo: () => ({ climate: WOODS, region: GLENUMBRA }), nowMs,
    eye, view: () => S.view, feet: () => S.feet, entity: () => S.e,
    keyLabel: () => 'E', input: () => ({ held: false, attack: false, choice: false }),
    active: () => true, activeDungeon: () => false, settled, ...deps,
  });
  setForagingHost({ world: () => WATER, monthValue: () => 5, entity: () => null, startQuest: () => true, professionsOpen: () => true, keyLabel: () => 'E', professionUse: () => false });
  S.host.onBuilt(entry);
  await tick(); await tick();
  S.nodes = (kind) => S.host.nodesOf(PX, PY).filter((n) => n.kind === kind);
  S.look = (yaw, pitch) => { S.view.yaw = yaw; S.view.pitch = pitch; S.host.tick(0.016); return S.host.target; };
  S.done = () => { S.host.dispose(); setForagingHost(null); };
  return S;
}

test('CAST-LOOK castAt: the cast stands where the look crosses CAST_AHEAD_M ahead, held within CAST_RISE_M of the eye - straight up or down on the look (mutant: under the eye whatever the look)', () => {
  const at = (pitchDeg, yawDeg = 0) => castAt({ pos: [10, 2, 20], dir: [Math.sin(yawDeg * rad) * Math.cos(pitchDeg * rad), Math.sin(pitchDeg * rad), Math.cos(yawDeg * rad) * Math.cos(pitchDeg * rad)] });
  const eq = (a, b) => a.every((v, i) => Math.abs(v - b[i]) < 1e-9);
  assert.ok(eq(at(0), [10, 2, 20 + CAST_AHEAD_M]), 'level: at the eye\'s height');
  assert.ok(eq(at(20), [10, 2 + CAST_AHEAD_M * Math.tan(20 * rad), 20 + CAST_AHEAD_M]), 'up: where the look crosses');
  assert.ok(eq(at(-30, 90), [10 + CAST_AHEAD_M, 2 - CAST_AHEAD_M * Math.tan(30 * rad), 20]), 'down and east');
  assert.ok(eq(at(80), [10, 2 + CAST_RISE_M, 20 + CAST_AHEAD_M]), 'steeper than its hold: held');
  assert.ok(eq(castAt({ pos: [10, 2, 20], dir: [0, -1, 0] }), [10, 2 - CAST_RISE_M, 20]), 'straight down: on the look');
});

test('CAST-LOOK: in the water with a net the cast is the target at any look from 55 degrees down to 55 up (it was 23 down to under one up), E casts and the net\'s Use casts; a node in the cone is the target before it (mutants: the cast under the eye; the cast first)', async () => {
  const s = await stage();
  try {
    // stand where no node of the pixel is near: the cast alone
    s.feet[0] = 2; s.feet[2] = 2;
    for (const pitch of [-55, -30, -24, -11, 0, 1, 5, 10, 25, 40, 55]) {
      const t = s.look(37, pitch);
      assert.equal(t?.node.kind, 'haul', `pitch ${pitch}: the cast`);
      assert.equal(s.prompt?.verb, 'Cast the net', JSON.stringify(s.prompt));
    }
    s.look(37, 15);
    // CAST-E: the cast passes E on to the ladder (a door, the crew, a chest under the look take it first) - and is cast
    // when nothing did
    assert.equal(s.host.press(), false, 'E is passed on: ' + JSON.stringify(s.prompt) + s.said.join('|'));
    assert.equal(s.host.acting(), false, 'nothing cast while the ladder may take it');
    assert.equal(s.host.sayNeed(), true, 'handed back: the cast');
    assert.equal(s.host.acting(), true, 'E casts, looking out over the water');
    s.host.cancel();
    assert.equal(s.host.press(), false);
    s.host.press();   // a second press before the hand-back forgets the first
    assert.equal(s.host.sayNeed(), true);
    assert.equal(s.host.acting(), true, 'one cast');
    s.host.cancel();
    s.look(37, 15);
    s.said.length = 0;
    assert.equal(s.host.useTool(FT.FishingNet), 'started', 'and the net\'s Use');
    s.host.cancel();
    // an herb patch on the bank, looked at from the water: the patch is the target, not the cast
    const patch = s.nodes('herb')[0];
    assert.ok(patch);
    const [x, y, z] = patch.local;
    s.feet[0] = x; s.feet[1] = y; s.feet[2] = z - 1.5;
    const a = aimAt([x, y + 1.6, z - 1.5], [x, y + (patch.lift ?? 0.3), z], { yaw: 0, pitch: 0 });
    assert.equal(s.look(-a.yaw + 5, -a.pitch)?.node.key, patch.key, 'the patch in the cone, five degrees off the look - the cast on it');
    assert.equal(s.look(-a.yaw + 90, 5)?.node.kind, 'haul', 'and the water beside it the cast\'s');
    assert.equal(NODE_AIM_DEG, 12);
  } finally { s.done(); }
});

test('SETTLE-STAND: the gathering host stands no node of the ground on a settlement\'s ground - no picture, no glow, no compass mark - and every other where it was (mutant: the world unasked)', async () => {
  const free = await stage({ settled: () => false });
  const all = { herb: free.nodes('herb'), mine: free.nodes('mine'), tree: free.nodes('tree') };
  free.done();
  assert.ok(all.herb.length && all.mine.length && all.tree.length, 'the wild stands them all');
  // a settlement's ground over the pixel's west half
  const west = (p) => p[0] < TERRAIN_SIZE / 2;
  const s = await stage({ settled: west });
  try {
    for (const kind of ['herb', 'mine', 'tree']) {
      const now = s.nodes(kind);
      assert.deepEqual(now.map((n) => n.key), all[kind].filter((n) => !west(n.local)).map((n) => n.key), `${kind}: the east half's alone`);
    }
    assert.ok(s.host.marks([TERRAIN_SIZE / 4, 0, TERRAIN_SIZE / 2]).every((m) => !west(m.at)), 'no mark in the west');
  } finally { s.done(); }
  // a kind whose nodes are not the ground's (no `where` - as Fishing's schools): stood on a settlement's ground still
  const other = { id: 'other', professions: Object.freeze(['other']), nodesOf: () => [{ key: 'other:1', local: [100, 0, 100] }], flatsOf: () => [], gone: () => false, plan: () => null, start: () => null, cleanNote: () => '', title: () => '' };
  const none = await stage({ settled: () => true, more: [other] });
  try {
    assert.deepEqual([none.nodes('herb'), none.nodes('mine'), none.nodes('tree')].map((l) => l.length), [0, 0, 0], 'all on it: none');
    assert.deepEqual(none.nodes('other').map((n) => n.key), ['other:1'], 'a node not the ground\'s stands');
    none.feet[0] = 2; none.feet[2] = 2;
    assert.equal(none.look(0, 5)?.node.kind, 'haul', 'the water is not the ground\'s: the net still casts');
  } finally { none.done(); }
});

test('SETTLE-STAND the world\'s test: the very closure the streaming world hands the host, over the real location rect - a farm\'s or a temple\'s footprint and a city block round it is settled; past the block, a poor home, a dungeon\'s pixel or none is not (mutants: the block forgotten; every location a settlement)', () => {
  const src = readFileSync(new URL('../src/scenes/world.js', import.meta.url), 'utf8');
  const at = src.indexOf('settled: (pos) => {');
  assert.ok(at > 0, 'the world hands the host its settlement test');
  const end = src.indexOf('},   // SETTLE-STAND', at);
  const body = src.slice(at + 'settled: '.length, end + 1);
  const index = new Map();
  const state = { worldCoords: (p) => ({ x: p[0] * SCENE_MAP_RATIO, z: p[2] * SCENE_MAP_RATIO }) };
  const settled = new Function('state', 'worldCoordToMapPixel', 'locationIndex', 'isPlayerInTown', 'isInLocationRect', 'locationWorldRect', `return (${body});`)(
    state, worldCoordToMapPixel, index, isPlayerInTown, isInLocationRect, locationWorldRect);
  const loc = (type) => ({ exterior: { exteriorData: { width: 1, height: 1, blockNames: ['FARMAA01.RMB'] } }, mapTableData: { locationType: type } });
  const scene = (wx, wz) => [wx / SCENE_MAP_RATIO, 0, wz / SCENE_MAP_RATIO];
  index.set(`${PX},${PY}`, loc(LOCATION_TYPES.HomeFarms));
  const r = locationWorldRect(index.get(`${PX},${PY}`), PX, PY);
  const mid = [(r.minX + r.maxX) / 2, (r.minZ + r.maxZ) / 2];
  const o = mapPixelToWorldCoords(PX, PY);
  assert.deepEqual(worldCoordToMapPixel(mid[0], mid[1]), { x: PX, y: PY }, 'the footprint is on its pixel');
  assert.ok(mid[0] > o.x && mid[1] > o.z);
  assert.equal(settled(scene(mid[0], mid[1])), true, 'the farm itself');
  assert.equal(settled(scene(r.maxX + WORLD_MAP_RMB_DIM - 100, mid[1])), true, 'within the block round it');
  assert.equal(settled(scene(r.maxX + WORLD_MAP_RMB_DIM + 400, mid[1])), false, 'past the block');
  index.set(`${PX},${PY}`, loc(LOCATION_TYPES.ReligionTemple));
  assert.equal(settled(scene(mid[0], mid[1])), true, 'a temple');
  index.set(`${PX},${PY}`, loc(LOCATION_TYPES.HomePoor));
  assert.equal(settled(scene(mid[0], mid[1])), false, 'a poor home is no settlement');
  index.set(`${PX},${PY}`, loc(LOCATION_TYPES.DungeonRuin));
  assert.equal(settled(scene(mid[0], mid[1])), false, 'nor a dungeon');
  index.delete(`${PX},${PY}`);
  assert.equal(settled(scene(mid[0], mid[1])), false, 'nor a pixel with no location');
});

test('CAST-E: a press the cast passed on that the ladder took (a door opened) is never cast by a later hand-back - a second later, nothing (mutant: the hand-back unbounded)', async () => {
  let now = NOON_MS;
  const t = await stage({ nowMs: () => now });
  try {
    t.feet[0] = 2; t.feet[2] = 2;
    assert.equal(t.look(37, 10)?.node.kind, 'haul');
    assert.equal(t.host.press(), false, 'passed on');
    // the ladder opened a door: no hand-back. A second and more later a press the sea took (no `press`) finds nothing
    now += CAST_HANDBACK_MS + 1;
    assert.equal(t.host.sayNeed(), false, 'no stale cast');
    assert.equal(t.host.acting(), false);
    // within the bound, handed back: cast
    assert.equal(t.host.press(), false);
    now += CAST_HANDBACK_MS - 1;
    assert.equal(t.host.sayNeed(), true);
    assert.equal(t.host.acting(), true);
  } finally { t.done(); }
});

test('CAST-E under PROF-MENU (the merge of main\'s menu): the plaque never lists the cast over a door, the crew or a chest in reach - the ray\'s winner keeps it, and E passes on - and lists it over nothing; a cast the plaque lit is cast by E or the click at once (mutants: the cast the plaque\'s over the ray; the lit cast passed on)', async () => {
  let lit = null;
  const s = await stage({ deps: { plaque: () => true, lit: () => lit } });
  try {
    s.feet[0] = 2; s.feet[2] = 2;
    assert.equal(s.look(37, 10)?.node.kind, 'haul');
    assert.equal(s.host.hoverHit({ key: 'door:1', distance: 2, reach: 3 }), null, 'a door in reach keeps the plaque');
    assert.equal(s.host.press(), false, 'and E, unlit, passes on to it');
    s.look(37, 10);
    const hit = s.host.hoverHit(null);
    assert.ok(hit?.key.startsWith('prof:'), 'over nothing, the cast\'s list');
    assert.equal(s.host.hoverHit({ key: 'door:far', distance: 9, reach: 3 })?.key, hit.key, 'a door out of reach: the cast\'s');
    const name = s.host.hoverName(hit.key);
    assert.equal(name.title, 'Open Water');
    lit = name.actions[0].id;
    assert.equal(s.host.press(), true, 'E on the lit cast: cast at once');
    assert.equal(s.host.acting(), true);
    s.host.cancel();
    s.look(37, 10);
    assert.equal(s.host.press({ click: true }), true, 'and the click');
    assert.equal(s.host.acting(), true);
  } finally { s.done(); }
});
