// PROF2 (2026-09-28, Mac: "Go") - MINING'S CLIENT: the Pick-Axe's act (the strikes, the glint that counts double and
// moves, the clean finish, Gentle acts), where a node stands (a rock field's piece, else a stone tile, else nature's
// ground; a boulder a piece itself), the plan the prompt says, the one gathering host every profession is a kind in,
// the new materials as items (DFU's own metals and gems, the registered ores, ingots and stone on DFU's dyed pictures),
// the forge's arithmetic - and the done-when, driven through the real Worker: VEINS PLACED ON ROCK FIELDS; SIGNATURES BY
// KINGDOM. Then the hosts' wiring. bible/06-Systems/Professions-Arc.md 23.
import './chargenDom.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { standService, T0, sessionStorageOf } from './accountDb.mjs';
import { accountProf, SESSION_KEY } from '../src/net/accountClient.js';
import { createProfBook } from '../src/net/profBook.js';
import { veins, boulders, nodeKey, utcDayOfMs, dveinKey } from '../src/net/nodeLaw.js';
import { MINE_ACT, strikesFor, glintsMax, SMELT_RECIPES, smeltRecipe } from '../src/net/professionLaw.js';
import { createMineAct, MINE_POINTS, aimOff } from '../src/systems/mineAct.js';
import {
  standMineNodes, rockFoot, mineFlats, mineRecord, minePlan, pickHandFrame, standDungeonVeins, ROCK_OFFSET, NODE_SPACING_M, VEIN_FLATS, LODESTONE_RECORD,
  PICK_HAND, PROSPECT_M, DUNGEON_SKIP, mineKind,
} from '../src/scenes/mineHost.js';
import { createGatherHost, aimAt, wrapDeg } from '../src/scenes/gatherHost.js';
import { herbKind, SICKLE_HAND } from '../src/scenes/herbHost.js';
import { mintMaterialItem, materialLabel, materialCountLabel, withdrawIntoPack } from '../src/systems/profItems.js';
import { templateByIndex, inventoryItemImage } from '../src/systems/itemTemplates.js';
import { MINING_TEMPLATE_ROWS, PROF_ITEM_GROUP } from '../src/systems/profTemplates.js';
import { DYE_COLORS, DYE_TARGETS } from '../src/characters/dyes.js';
import { smeltable } from '../src/ui/profPages.js';
import { setForagingHost } from '../src/systems/foragingInstall.js';
import { FT } from '../src/systems/foragingLaw.js';
import { groundAt } from '../src/world/terrainNature.js';
import { HEIGHTMAP_DIMENSION, TERRAIN_SIZE } from '../src/world/terrainSampler.js';
import { DECOR_STATIONS, DECOR_STATION_FEES, DECOR_STATION_NAMES } from '../src/net/decorLaw.js';
import { sharedClassicMinutes } from '../src/net/wire.js';
import { utcDay } from '../src/net/marksLaw.js';

const src = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const noWait = () => Promise.resolve();
const tick = () => new Promise((r) => setImmediate(r));
const DAY = 86_400;
const WOODS = 231, MOUNTAIN = 226, WAYREST = 23, GLENUMBRA = 59;
const hourAt = (s) => Math.floor((((Math.floor(sharedClassicMinutes(s * 1000)) % 1440) + 1440) % 1440) / 60);
function noonOf(dayStart) {
  for (let s = dayStart + 3600; s < dayStart + 3 * 7200; s += 30) if (hourAt(s) === 12 && hourAt(s - 60) === 12 && hourAt(s + 60) === 12) return s;
  throw new Error('no noon');
}
const NOON = noonOf(utcDay(T0) * DAY);
const memStorage = () => { const m = new Map(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)) }; };
/** A flat pixel: every sample at a quarter height, every tile `tile` (1 dirt, 2 grass, 3 stone). */
const flatPixel = (tile = 2) => ({ samples: new Float32Array(HEIGHTMAP_DIMENSION * HEIGHTMAP_DIMENSION).fill(0.25), tilemap: new Uint8Array(128 * 128).fill(tile) });
/** A dice that answers each value in turn. */
const seq = (...u) => { let i = 0; return () => u[i++ % u.length]; };

// ─── THE ACT ─────────────────────────────────────────────────────────

test('PROF2 act: a node takes its tier\'s strikes; a strike on the glint counts two; one strike a swing; the glint moves after a strike and when its time is out', () => {
  const a = createMineAct({ tier: 1, rng: seq(0, 0.5, 0.9) });   // the glint on point 0, then 2, then 4
  assert.equal(a.state.need, strikesFor(1));
  assert.equal(a.state.glint, 0);
  const on = { yaw: MINE_POINTS[0][0], pitch: MINE_POINTS[0][1] };
  a.tick(0.1, { attack: true, aim: on });
  assert.deepEqual([a.state.points, a.state.glints, a.state.strikes, a.state.last], [2, 1, 1, 'glint']);
  assert.equal(a.state.glint, 2, 'moved after the strike');
  a.tick(0.1, { attack: true, aim: on });
  assert.equal(a.state.strikes, 1, 'inside the swing: nothing');
  a.tick(MINE_ACT.swingS, { attack: false, aim: on });
  a.tick(0.01, { attack: true, aim: { yaw: 0, pitch: 0 } });
  assert.deepEqual([a.state.points, a.state.glints, a.state.last], [3, 1, 'plain'], 'off the glint: one');
  assert.ok(a.swing > 0.9, 'the swing just struck');
  a.tick(MINE_ACT.swingS, {});
  a.tick(0.01, { attack: true, aim: { yaw: MINE_POINTS[a.state.glint][0], pitch: MINE_POINTS[a.state.glint][1] } });
  assert.equal(a.state.done, true);
  assert.deepEqual(a.report(), { strikes: 3, glints: 2, clean: false }, 'a strike off the glint: no clean finish');
  // the glint's own time
  const b = createMineAct({ tier: 1, band: 1, rng: seq(0, 0.3) });
  b.tick(MINE_ACT.glintS - 0.01, {});
  assert.equal(b.state.glint, 0);
  b.tick(0.02, {});
  assert.equal(b.state.glint, 1, 'past 1.2 s it moves');
  assert.equal(createMineAct({ tier: 1, master: true }).state.glintS, MINE_ACT.masterGlintS);
  assert.equal(createMineAct({ tier: 1, band: 1.3 }).state.glintS, MINE_ACT.glintS * 1.3, 'the Pick-Axe\'s band widens it');
  assert.equal(aimOff({ yaw: 3, pitch: 4 }, [0, 0]), 5);
});

test('PROF2 act: every strike on the glint is the clean finish, in the fewest strikes; Gentle acts strike plain; Escape cancels; a report only at the end', () => {
  const a = createMineAct({ tier: 5, rng: seq(0.1, 0.5, 0.7, 0.3, 0.9) });
  let strikes = 0;
  while (!a.state.done) {
    const g = MINE_POINTS[a.state.glint];
    a.tick(MINE_ACT.swingS + 0.01, {});
    a.tick(0.01, { attack: true, aim: { yaw: g[0] + 2, pitch: g[1] - 1 } });   // within 2.5 degrees
    strikes++;
  }
  assert.equal(strikes, glintsMax(5));
  assert.deepEqual(a.report(), { strikes: 4, glints: 4, clean: true });
  const g = createMineAct({ tier: 1, gentle: true });
  assert.equal(g.state.glint, -1, 'no glint to find');
  for (let i = 0; i < 4; i++) { g.tick(MINE_ACT.swingS + 0.01, {}); g.tick(0.01, { attack: true, aim: { yaw: 0, pitch: 0 } }); }
  assert.deepEqual(g.report(), { strikes: 4, glints: 0, clean: false });
  const c = createMineAct({ tier: 1 });
  assert.equal(c.report(), null);
  c.cancel();
  c.tick(0.1, { attack: true, aim: { yaw: 0, pitch: 0 } });
  assert.equal(c.state.strikes, 0, 'a cancelled act strikes nothing');
});

// ─── WHERE A NODE STANDS ─────────────────────────────────────────────

test('PROF2 stand: a vein stands at the foot of the rock piece nearest its law point, on the side facing it; a boulder IS a piece; the nodes at a field NODE_SPACING_M apart (ROCK-SHARE)', () => {
  const { samples, tilemap } = flatPixel(2);
  const day = 20500;
  const law = veins({ x: 400, y: 150, day, climate: MOUNTAIN, region: WAYREST });
  // one rock piece close by every vein's point, and one about every boulder's (ROCK-FOOT: the boulders claim first)
  const rocks = law.map((v) => [v.u * TERRAIN_SIZE - 2, 0, v.v * TERRAIN_SIZE + 4, v.u * TERRAIN_SIZE + 2, 6, v.v * TERRAIN_SIZE + 8]);
  const quarry = boulders({ x: 400, y: 150, day, climate: MOUNTAIN }).map((b) => [b.u * TERRAIN_SIZE - 2, 0, b.v * TERRAIN_SIZE - 2, b.u * TERRAIN_SIZE + 2, 5, b.v * TERRAIN_SIZE + 2]);
  assert.equal(quarry.length, 5, 'the Mountain\'s five (BOULDERS)');
  const nodes = standMineNodes({ px: 400, py: 150, day, climate: MOUNTAIN, region: WAYREST, samples, tilemap, rocks: [...quarry, ...rocks] });
  const vs = nodes.filter((n) => n.what === 'vein');
  assert.equal(vs.length, law.length);
  for (const n of vs) {
    const v = law[n.slot];
    const x = v.u * TERRAIN_SIZE, z = v.v * TERRAIN_SIZE;
    assert.deepEqual(n.rock, rocks[n.slot], 'its own nearest piece');
    assert.ok(Math.abs(n.local[0] - x) < 1e-9, 'straight south of the piece, facing its point');
    assert.ok(Math.abs(n.local[2] - (z + 4 - ROCK_OFFSET)) < 1e-9, 'at the foot, a little off the box');
    assert.ok(Math.abs(n.local[1] - groundAt(samples, n.local[0], n.local[2])) < 1e-9, 'on the ground');
  }
  const bs = nodes.filter((n) => n.what === 'boulder');
  assert.deepEqual(bs.map((n) => n.rock), quarry, 'every boulder its own nearest piece');
  assert.ok(bs.every((n) => n.key.startsWith('boulder:400:150:') && n.lift >= 0.4 && n.lift <= 1.2));
  // the veins' pieces alone: the boulders claim first - ROCK-SHARE: a piece holds a node on each of its sides, the nodes
  // NODE_SPACING_M apart - and a vein with no side left stands on the ground beside the field
  assert.equal(NODE_SPACING_M, 6);
  const only = standMineNodes({ px: 400, py: 150, day, climate: MOUNTAIN, region: WAYREST, samples, tilemap, rocks });
  const onlyB = only.filter((n) => n.what === 'boulder');
  assert.ok(onlyB.length >= 1 && onlyB.every((n) => rocks.includes(n.rock)), 'the boulders at the veins\' pieces');
  assert.equal(only.filter((n) => n.what === 'vein').length, law.length, 'every vein stands');
  const at = only.filter((n) => n.rock);
  for (let i = 0; i < at.length; i++) for (let j = i + 1; j < at.length; j++) {
    assert.ok(Math.hypot(at[i].local[0] - at[j].local[0], at[i].local[2] - at[j].local[2]) >= 6 - 1e-9, 'two nodes at the field never closer than NODE_SPACING_M');
  }
  assert.deepEqual(rockFoot([0, 0, 0, 10, 5, 10], 2, 5), [-ROCK_OFFSET, 5], 'a point inside a footprint: its nearest edge');
});

test('PROF2 stand: with no rock field a vein takes the nearest stone tile where nature could stand, else nature\'s ground; the sea and a town stand none', () => {
  const day = 20500;
  const stone = flatPixel(2);
  const law = veins({ x: 400, y: 150, day, climate: WOODS, region: GLENUMBRA });
  const tx = Math.floor(law[0].u * 128), ty = Math.floor(law[0].v * 128);
  stone.tilemap[(ty + 3) * 128 + tx] = 3;   // a stone tile three rows off the first vein's point
  const n = standMineNodes({ px: 400, py: 150, day, climate: WOODS, region: GLENUMBRA, ...stone }).find((x) => x.slot === 0);
  assert.deepEqual([n.local[0], n.local[2]], [tx * TERRAIN_SIZE / 128, (ty + 3) * TERRAIN_SIZE / 128], 'on the stone tile');
  const grass = flatPixel(2);
  const g = standMineNodes({ px: 400, py: 150, day, climate: WOODS, region: GLENUMBRA, ...grass }).find((x) => x.slot === 0);
  assert.deepEqual([g.local[0], g.local[2]], [tx * TERRAIN_SIZE / 128, ty * TERRAIN_SIZE / 128], 'nature\'s ground at its own point');
  assert.deepEqual(standMineNodes({ px: 400, py: 150, day, climate: 223, region: 31, ...grass }), [], 'the sea stands none');
  const town = standMineNodes({ px: 400, py: 150, day, climate: WOODS, region: GLENUMBRA, ...grass, locationRect: { xMin: 0, xMax: 128, yMin: 0, yMax: 128 } });
  assert.deepEqual(town, [], 'never in a town');
});

test('PROF2 stand: the pictures - a metal\'s own item flat, Lodestone\'s for a new ore and for loose stone; a cluster round the foot', () => {
  const vein = { what: 'vein', slot: 1, material: 'metal:iron', local: [10, 2, 10] };
  assert.equal(mineRecord(vein), templateByIndex(71).worldTextureRecord, 'Iron\'s own picture');
  assert.equal(mineRecord({ ...vein, material: 'ore:mithril' }), LODESTONE_RECORD);
  assert.equal(mineRecord({ what: 'boulder', material: 'stone:rough' }), LODESTONE_RECORD);
  const f = mineFlats(vein);
  assert.equal(f.length, VEIN_FLATS);
  assert.deepEqual(f[0], [10, 2, 10]);
  assert.ok(f.every((p) => p[1] === 2 && Math.hypot(p[0] - 10, p[2] - 10) < 1));
});

test('PROF2 stand: a dungeon\'s veins on its walls - the dungeon\'s own ray answers each; a vein its ray cannot place stands nowhere', () => {
  const asked = [];
  const nodes = standDungeonVeins({ dungeon: 4321, day: 20500, climate: MOUNTAIN, confirmed: true, wall: (m, b) => { asked.push([m, b]); return asked.length === 1 ? null : [1, 2, 3]; } });
  assert.ok(asked.length >= 1);
  assert.equal(nodes.length, asked.length - 1);
  assert.ok(nodes.every((n) => n.what === 'dvein' && n.key.startsWith('dvein:4321:20500:') && n.tier >= 3));
  assert.deepEqual([...DUNGEON_SKIP], ['inside', 'town', 'daylight', 'sea'], 'underground: the foe and the load are asked');
});

// ─── THE PLAN ────────────────────────────────────────────────────────

test('PROF2 plan: what E does at a vein or a boulder, and what it needs - worked today, the day\'s sixty, the rank, the Pick-Axe, the Stores\' room', () => {
  const base = { node: { what: 'vein', tier: 2, material: 'metal:lodestone' }, taken: false, counting: false, rank: 10, pick: true, storesFull: () => false, today: 0, cap: 60 };
  assert.deepEqual(minePlan(base), { harvest: 'ore', verb: 'Mine Lodestone', rest: 'Mining 10', ready: true });
  assert.equal(minePlan({ ...base, rank: 9 }).rest, 'needs Mining 10');
  assert.equal(minePlan({ ...base, pick: false }).rest, 'needs a Pick-Axe');
  assert.equal(minePlan({ ...base, storesFull: () => true }).rest, 'Stores full - Lodestone');
  assert.deepEqual([minePlan({ ...base, taken: true }).verb, minePlan({ ...base, taken: true }).ready], ['Lodestone - worked today', false]);
  assert.equal(minePlan({ ...base, counting: true }).rest, 'being counted');
  assert.equal(minePlan({ ...base, today: 60 }).ready, false);
  const b = minePlan({ ...base, node: { what: 'boulder', tier: 1, material: 'stone:rough' } });
  assert.deepEqual([b.harvest, b.verb], ['stone', 'Quarry the stone']);
  assert.deepEqual(pickHandFrame(0), { state: 'Idle', frame: 0 });
  assert.deepEqual([pickHandFrame(1).frame, pickHandFrame(0.5).frame, pickHandFrame(0.01).frame], [0, 2, 4], 'StrikeDown\'s frames over the swing');
  assert.deepEqual({ ...PICK_HAND }, { group: 'Weapons', templateIndex: 126, material: 0 });
  assert.equal(templateByIndex(126).name, 'Warhammer', 'the Pick-Axe in the hand is DFU\'s Warhammer (PROF0 5.1)');
  assert.equal(PROSPECT_M, 200);
});

// ─── THE ONE HOST ────────────────────────────────────────────────────

/** The gathering host over one flat pixel with rock pieces - its book a real one over a scripted door. */
function hostRig({ answer, rocks = null, mining = 0, specs = {} } = {}) {
  const day = utcDayOfMs(NOON * 1000);
  const { samples, tilemap } = flatPixel(2);
  const law = veins({ x: 400, y: 150, day, climate: WOODS, region: GLENUMBRA });
  const rockList = rocks ?? law.map((v) => [v.u * TERRAIN_SIZE - 2, 0, v.v * TERRAIN_SIZE + 4, v.u * TERRAIN_SIZE + 2, 6, v.v * TERRAIN_SIZE + 8]);
  const entry = { px: 400, py: 150, samples, tilemap, locationRect: null, batches: [], rocks: rockList };
  const asked = [];
  const door = {
    account: () => 'acct-1',
    state: async () => ({ ok: true, data: { day, character: 'c1', tracks: [{ profession: 'mining', xp: mining, rank: 0, specs: { 50: specs[50] ?? null, 100: null } }], today: {}, taken: [], stores: [], caps: { harvests: 60, stores: 5000 } } }),
    pixels: async (c, px) => ({ ok: true, data: { pixels: px.map(([x, y]) => ({ x, y, state: 'none' })), dungeons: [] } }),
    harvest: async (b) => { asked.push(b); return answer ?? { ok: true, data: { node: b.node, kind: b.kind, material: 'metal:iron', qty: 3, xp: 22, track: { profession: 'mining', xp: 22, rank: 1 }, today: 1, gem: 'gem:amber', gemStore: { material: 'gem:amber', own: 1, bought: 0 } } }; },
  };
  const book = createProfBook({ door, storage: memStorage(), character: () => 'c1', now: () => NOON * 1000, sleep: noWait });
  const said = [];
  const hud = { setPrompt: (p) => { said.prompt = p; }, setMeter: (m) => { said.meter = m; }, toast: (t) => said.push(t), banner: (t) => said.push(`BANNER ${t}`), setChip: () => {}, frame: () => {}, dispose: () => {} };
  const built = new Map([['400,150', entry]]);
  const pick = { templateIndex: FT.PickAxe, currentCondition: 50, maxCondition: 50 };
  const entity = { items: [pick], stats: {} };
  const feet = [0, 0, 0];
  const view = { yaw: 0, pitch: 0 };
  let input = { held: false, attack: false, choice: false };
  const host = createGatherHost({
    book, hud, kinds: [herbKind({ book }), mineKind({ book })],
    renderer: { createBillboardBatch: () => ({}), destroyBatch: () => {} }, getTexture: async () => ({ recordCount: 999 }), uploadRecord: () => {},
    billboardSize: () => ({ w: 0.3, h: 0.3 }), flatBatchAabb: () => [0, 0, 0, 0, 0, 0],
    built: () => built, pixelTranslation: (x, y, out) => { out[0] = 0; out[1] = 0; out[2] = 0; return out; },
    pixelInfo: () => ({ climate: WOODS, region: GLENUMBRA }), nowMs: () => NOON * 1000,
    eye: () => ({ pos: [feet[0], feet[1] + 1.6, feet[2]], dir: [Math.sin((view.yaw * Math.PI) / 180), Math.sin((view.pitch * Math.PI) / 180), Math.cos((view.yaw * Math.PI) / 180)] }),
    view: () => view, feet: () => feet, entity: () => entity, keyLabel: () => 'E', input: () => input, active: () => true,
  });
  return { host, book, said, asked, entry, law, feet, view, pick, entity, setInput: (i) => { input = { held: false, attack: false, choice: false, ...i }; } };
}
/** Stand the player 1.5 m south of a node, looking at it. */
function face(rig, node) {
  const [x, y, z] = node.local;
  rig.feet[0] = x; rig.feet[1] = y; rig.feet[2] = z - 1.5;
  const at = aimAt([x, y + 1.6, z - 1.5], [x, y + (node.lift ?? 0.3), z], { yaw: 0, pitch: 0 });
  rig.view.yaw = -at.yaw; rig.view.pitch = -at.pitch;
}

test('PROF2 host: one host, every kind - the vein stood on its rock, the nearest node targeted, E starts the Pick-Axe\'s act, attack strikes, the harvest asked as ore with the act\'s report; the answer said (the gem too); the Warhammer in the hand while it plays', async () => {
  setForagingHost({ world: () => ({ inside: false, insideDungeon: false, insideCastle: false, locationType: 0xffff, inLocationRect: false, hour: 12, climate: WOODS, region: GLENUMBRA, enemiesNear: false, carriedWeight: 0, maxEncumbrance: 100, swimming: false, exteriorWater: 'None' }) });
  try {
    const rig = hostRig();
    await rig.book.refresh();
    rig.host.onBuilt(rig.entry);
    await tick(); await tick();
    const vs = rig.host.nodesOf(400, 150).filter((n) => n.kind === 'mine' && n.what === 'vein');
    assert.equal(vs.length, rig.law.length, 'the pixel\'s veins stood');
    assert.ok(rig.entry.batches.length > 0, 'their flats in the pixel\'s own list');
    face(rig, vs[0]);
    rig.host.tick(0.016);
    assert.equal(rig.host.target?.node.key, vs[0].key);
    assert.match(rig.said.prompt.verb, /^Mine /);
    assert.equal(rig.host.press(), true);
    assert.equal(rig.host.acting(), true);
    assert.deepEqual({ ...rig.host.handTool(), frame: 0 }, { ...PICK_HAND, state: 'Idle', frame: 0 });
    for (let i = 0; i < 8 && rig.host.acting(); i++) {
      rig.setInput({ attack: true });
      rig.host.tick(MINE_ACT.swingS + 0.01);
      rig.setInput({});
      rig.host.tick(0.01);
    }
    await tick(); await tick();
    assert.equal(rig.host.acting(), false, 'the strikes are the node\'s');
    for (let i = 0; i < 5; i++) { rig.host.tick(0.016); await tick(); }
    assert.equal(rig.asked.length, 1, 'asked once - a pump never asks again a harvest on the wire');
    assert.equal(rig.said.filter((t) => /to your Stores$/.test(t)).length, 1, 'its answer said once');
    assert.deepEqual([rig.asked[0].node, rig.asked[0].kind, rig.asked[0].climate, rig.asked[0].region], [vs[0].key, 'ore', WOODS, GLENUMBRA]);
    assert.ok(Number.isSafeInteger(rig.asked[0].act.strikes) && rig.asked[0].act.strikes >= 2);
    assert.equal(rig.pick.currentCondition, 49, 'the act wore the Pick-Axe by one (FORAGE0 14.1)');
    assert.ok(rig.said.includes('+3 Iron and an Amber to your Stores'), 'the gem said with the ore (GATHER-SAID: one line)');
    assert.ok(rig.said.some((t) => /^\+22 Mining XP/.test(t)));
    assert.equal(rig.book.held('gem:amber'), 1, 'the gem\'s Stores applied');
    rig.host.dispose();
  } finally { setForagingHost(null); }
});

test('PROF2 host: Escape ends an act with nothing lost; walking off ends it; no Pick-Axe, no act - the prompt says so (AUDIT 29: the press goes on); the dungeon is a place of its own', async () => {
  setForagingHost({ world: () => ({ inside: false, insideDungeon: false, insideCastle: false, locationType: 0xffff, inLocationRect: false, hour: 12, climate: WOODS, region: GLENUMBRA, enemiesNear: false, carriedWeight: 0, maxEncumbrance: 100, swimming: false, exteriorWater: 'None' }) });
  try {
    const rig = hostRig();
    await rig.book.refresh();
    rig.host.onBuilt(rig.entry);
    await tick(); await tick();
    const v = rig.host.nodesOf(400, 150).find((n) => n.what === 'vein');
    face(rig, v);
    rig.host.tick(0.016);
    rig.host.press();
    assert.equal(rig.host.cancel(), true);
    assert.equal(rig.host.acting(), false);
    assert.equal(rig.pick.currentCondition, 50, 'nothing worn');
    rig.host.tick(0.016);
    rig.host.press();
    rig.feet[2] -= 10;
    rig.host.tick(0.016);
    assert.equal(rig.host.acting(), false, 'walked off');
    assert.equal(rig.asked.length, 0);
    rig.entity.items = [];
    face(rig, v);
    rig.host.tick(0.016);
    assert.equal(rig.said.prompt.rest, 'needs a Pick-Axe');
    assert.equal(rig.host.press(), false, 'AUDIT 29 C1: a node that cannot be worked takes no press - the prompt says what it needs, the press goes on');
    // a dungeon: its own flats' doors, dropped when it is left
    const stood = [], dropped = [];
    rig.host.enterDungeon({ id: 77, climate: MOUNTAIN, region: WAYREST, wall: () => [0, 0, 0], stand: async (a, r, s, c) => { const b = { a, r, c }; stood.push(b); return b; }, drop: (b) => dropped.push(b) });
    await tick(); await tick();
    assert.ok(stood.length >= 1, 'the dungeon\'s veins on its walls');
    rig.host.leaveDungeon();
    assert.equal(dropped.length, stood.length, 'dropped with the dungeon');
    rig.host.dispose();
  } finally { setForagingHost(null); }
});

test('PROF2 host: the gathering shell keeps Herbalism a kind in it - the Sickle is still DFU\'s Tanto in the hand; aimAt reads the port\'s +yaw as right', () => {
  assert.deepEqual({ ...SICKLE_HAND }, { group: 'Weapons', templateIndex: 114, material: 0 });
  assert.deepEqual(aimAt([0, 0, 0], [0, 0, 10], { yaw: 5, pitch: 0 }), { yaw: 5, pitch: 0 }, 'the view turned right of the node: the cursor right of centre');
  assert.equal(Math.round(aimAt([0, 0, 0], [10, 0, 10], { yaw: 45, pitch: 0 }).yaw * 1e9), 0);
  assert.deepEqual([wrapDeg(190), wrapDeg(-190), wrapDeg(180)], [-170, 170, 180]);
});

// ─── THE MATERIALS AS ITEMS ──────────────────────────────────────────

test('PROF2 items: a metal or a gem withdrawn is DFU\'s own item in its own group; an ore, ingot or stone its registered template, stacking, on DFU\'s picture dyed by its metal', () => {
  const iron = mintMaterialItem('metal:iron', false);
  assert.deepEqual([iron.group, iron.templateIndex], ['MetalIngredients', 71]);
  const ruby = mintMaterialItem('gem:ruby', false);
  assert.deepEqual([ruby.group, ruby.templateIndex], ['Gems', 0]);
  const ingot = mintMaterialItem('ingot:ebony', false);
  assert.deepEqual([ingot.group, ingot.templateIndex], [PROF_ITEM_GROUP, 627]);
  assert.equal(templateByIndex(627).name, 'Ebony Ingot');
  assert.deepEqual(inventoryItemImage(ingot), { archive: 254, record: 63, dye: DYE_COLORS.Ebony, dyeTarget: DYE_TARGETS.WeaponsAndArmor }, 'Iron\'s bar, dyed Ebony by DFU\'s own ChangeDye');
  assert.equal(inventoryItemImage(mintMaterialItem('ore:mithril', false)).dye, DYE_COLORS.Mithril);
  assert.deepEqual(inventoryItemImage(mintMaterialItem('stone:rough', false)).dyeTarget, null, 'stone is Lodestone\'s lump as it is');
  assert.equal(MINING_TEMPLATE_ROWS.length, 19);
  assert.ok(MINING_TEMPLATE_ROWS.every((r) => r.stackable === true && r.rarity === 10 && r.isIngredient === false), 'never shelved, never an ingredient');
  assert.equal(mintMaterialItem('wood:charcoal', false)?.templateIndex, 652, 'PROF4: Charcoal is Logging\'s, registered with it');
  const pack = { items: [] };
  assert.equal(withdrawIntoPack(pack, 'ingot:iron', 5, false), 5);
  assert.equal(pack.items.length, 1, 'the ingots stack');
  assert.equal(pack.items[0].stackCount, 5);
  assert.deepEqual([materialLabel('ore:dwarven', false), materialCountLabel('metal:iron', 30, false), materialCountLabel('gem:ruby', 2, false), materialCountLabel('ingot:mithril', 2, false)], ['Dwarven Scrap', 'Iron', 'Rubies', 'Mithril Ingots']);
});

test('PROF2 forge: what the Stores can smelt of a recipe - every input\'s units over its need, to a smelt\'s most; the home forge a fourth station at the alchemy station\'s licence', () => {
  const held = (m) => ({ 'metal:iron': 9, 'metal:copper': 3, 'metal:tin': 5, 'ingot:iron': 400 }[m] ?? 0);
  assert.equal(smeltable(smeltRecipe('ingot:iron'), held), 4);
  assert.equal(smeltable(smeltRecipe('metal:brass'), held), 3);
  assert.equal(smeltable(smeltRecipe('ingot:steel'), held), 0, 'no Charcoal');
  assert.equal(smeltable(smeltRecipe('ingot:iron'), () => 1000), 100);
  assert.equal(SMELT_RECIPES.length, 10);
  assert.deepEqual([...DECOR_STATIONS], ['alchemy', 'spells', 'enchant', 'forge', 'workbench', 'loom', 'mason', 'jeweller']);   // PROF4: the workbench, a fifth; PROF7: the loom, a sixth; PIN MOVED (PROF11): the mason's bench, a seventh; PIN MOVED (PROF10): the jeweller's bench, an eighth
  assert.deepEqual([DECOR_STATION_FEES.forge, DECOR_STATION_NAMES.forge], [50_000, 'Forge']);
});

// ─── THE DONE-WHEN ───────────────────────────────────────────────────

test('PROF2 DONE WHEN: veins placed on rock fields; signatures by kingdom - a confirmed Wayrest pixel\'s signature vein (beside its six - AUDIT 29 A6), stood at its rock piece, is Mithril; mined through the real Worker, withdrawn, smelted', async (t) => {
  t.mock.method(Date, 'now', () => NOON * 1000);
  const s = await standService({ PROFESSIONS_OPEN: 'on', MARKS_OPEN: 'on' });
  const raw = s.env.DB._raw;
  const day = utcDayOfMs(NOON * 1000);
  // Wayrest's Mountain pixel, confirmed by three accounts a week registered
  const px = 410, py = 160;
  for (const h of ['Witness1', 'Witness2', 'Witness3']) {
    const w = await s.registered(h);
    raw.prepare('UPDATE players SET registered_at = ? WHERE id = ?').run(NOON - 8 * DAY, w.id);
    const v = veins({ x: px, y: py, day, climate: MOUNTAIN, region: WAYREST, confirmed: false });
    await s.call('/v1/prof/harvest', { character: w.character, node: nodeKey({ kind: 'vein', x: px, y: py, day, slot: v.length - 1 }), kind: 'ore', climate: MOUNTAIN, region: WAYREST, act: {}, at: NOON - 1, rid: `wit-${h}-000000` }, w.secret);
  }
  const mac = await s.registered('Mac');
  raw.prepare(`INSERT INTO prof_tracks (player, char_id, profession, xp, updated_at) VALUES (?, ?, 'mining', ?, ?)`).run(mac.id, mac.character, 60_000, NOON);
  const door = accountProf({ fetch: s.fetch, storage: sessionStorageOf(SESSION_KEY, mac) });
  const book = createProfBook({ door, storage: memStorage(), character: () => mac.character, now: () => NOON * 1000, sleep: noWait });
  assert.equal((await book.refresh()).ok, true);
  await book.askPixels([[px, py]]);
  assert.equal(book.pixel(px, py).state, 'confirmed');
  // the client stands it on its rock field: the signature's vein, at the piece
  const { samples, tilemap } = flatPixel(2);
  const law = veins({ x: px, y: py, day, climate: MOUNTAIN, region: WAYREST, confirmed: true });
  const rocks = law.map((v) => [v.u * TERRAIN_SIZE + 3, 0, v.v * TERRAIN_SIZE - 2, v.u * TERRAIN_SIZE + 9, 7, v.v * TERRAIN_SIZE + 2]);
  const quarry = boulders({ x: px, y: py, day, climate: MOUNTAIN }).map((b) => [b.u * TERRAIN_SIZE - 2, 0, b.v * TERRAIN_SIZE - 2, b.u * TERRAIN_SIZE + 2, 5, b.v * TERRAIN_SIZE + 2]);   // ROCK-FOOT: the boulders' own, claimed first
  const stood = standMineNodes({ px, py, day, climate: MOUNTAIN, region: WAYREST, confirmed: true, samples, tilemap, rocks: [...quarry, ...rocks] });
  assert.equal(stood.filter((n) => n.what === 'vein').length, 13, 'the Mountain\'s twelve (PIN MOVED, MORE-NODES) and Wayrest\'s one');
  const first = stood.find((n) => n.signature);
  assert.deepEqual([first.slot, first.material, first.rock], [12, 'ore:mithril', rocks[12]], 'Wayrest\'s signature, at its rock piece');
  const r = await book.harvest({ node: first.key, kind: 'ore', climate: MOUNTAIN, region: WAYREST, act: { strikes: 4, glints: 4, clean: true }, at: NOON - 1 });
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.equal(r.data.material, 'ore:mithril');
  assert.ok(r.data.qty >= 2);
  // smelted at a forge, and the ingot withdrawn as its registered template
  const sm = await book.smelt('ingot:mithril', 1);
  assert.equal(sm.ok, true, JSON.stringify(sm));
  const pack = { items: [] };
  const w = await book.withdraw('ingot:mithril', 1, (k, n) => withdrawIntoPack(pack, k, n));
  assert.equal(w.ok, true);
  assert.deepEqual([pack.items[0].templateIndex, templateByIndex(pack.items[0].templateIndex).name], [625, 'Mithril Ingot']);
  assert.equal(book.track('smithing').xp, 50, 'Smithing, 10 a unit a tier');
  assert.equal(dveinKey({ dungeon: 1, day, slot: 0 }), `dvein:1:${day}:0`);
});

// ─── THE HOSTS ───────────────────────────────────────────────────────

test('PROF2 hosts: the streaming world stands every kind through the one host, its rock pieces carried on the pixel; the dungeon\'s veins through its own doors; the forge at a smith\'s or a home; the Prospector\'s compass on both skins', () => {
  const w = src('src/scenes/world.js');
  assert.match(w, /gatherHost = createGatherHost\(\{\n\s*book: profBook, hud, kinds: \[herbKind\(\{ book: profBook \}\), mineKind\(\{ book: profBook, lodes: motherlodeBook, marks: marksBook \}\),[^\n]*\n\s*treeKind\(\{ book: profBook, renderer, flatBatchAabb, getTexture, billboardSize, uploadRecord \}\),[^\n]*\n\s*huntKind\(\{ book: profBook, bodies: \(\) => huntBodies\(\), openLoot: openHuntLoot \}\),/);   // PROF4: Logging's trees, the third; PROF7: Hunting's bodies, the fourth; PROF8's casts after them; PIN MOVED (PROF2b): Mining's with the Motherlodes
  assert.match(w, /if \(rockPick\(m\.pick\)\) \{ const foot = rockFootprint\(cpu\.positions, cpu\.indices, m\.matrix, samples\); if \(foot\) pixelRocks\.push\(foot\); \}/, 'a rock piece that stood - after the road\'s clearance; ROCK-FOOT: as it stands out of the ground');
  assert.match(w, /rocks: pixelRocks,/);
  assert.match(w, /const rockPick = \(i\) => WOD_ROCK_SITES\.includes\(wodPicks\[i\]\?\.name\);/);   // ROCK-SUNK: the rock sites one list, the shrub's exemption's too
  assert.match(src('src/world/wodLocationObjects.js'), /export const WOD_ROCK_SITES = Object\.freeze\(\['Rocks', 'Mountains'\]\);/, 'the Rocks and Mountains layouts');
  assert.match(w, /if \(!townTalk\.overlayActive && act === 'Escape' && gatherHost\?\.cancel\(\)\) \{ e\.preventDefault\(\); e\.profActEnded = true; return true; \}/, 'Escape above the mode gate');
  assert.ok(w.indexOf("act === 'Escape' && gatherHost?.cancel()") < w.indexOf("if (!townTalk.overlayActive && (modes?.mode ?? 'exterior') === 'exterior') {"), 'before the exterior gate');
  assert.match(w, /nodes: professionMarks\(\),/);   // PROF7 moved it: a Tracker's animals beside a Prospector's veins; NODE-MARKS: every node beside them
  assert.match(w, /const near = nodeMarksAt\(feet\), far = motherlodeMarks\(\);\n\s*return nodeCompassPoints\(far\.length \? \[\.\.\.\(near \?\? \[\]\), \.\.\.far\] : near, trackerAnimals\(\)\);/);   // PIN MOVED (PROF2b): and the far Motherlodes
  assert.match(src('src/scenes/mineHost.js'), /return \(specs\('mining'\)\[50\] === 'prospector' && PROSPECTOR_MARKS\[n\.what\]\) \|\| MINE_MARKS\[n\.what\] \|\| MINE_MARKS\.vein;/, 'NODE-MARKS: the Prospector\'s veins marked from PROSPECT_M off, in the mine kind\'s own mark');
  assert.match(w, /onDungeonLeave: \(\) => \{ const n = handOverRoomFoes\(\);[^\n]*gatherHost\?\.leaveDungeon\(\); worldPublish\(performance\.now\(\), true\); \},/, 'the veins dropped while the dungeon still stands');
  assert.match(w, /profPress: \(\) => gatherHost\?\.press\(\) \?\? false,/);
  assert.match(src('src/world/worldOfDaggerfall.js'), /name: session\.name\[pick\.index\], prefabName: session\.prefab\[pick\.index\] \}\)\);/);   // FOREST1: and the prefab's name - a site or a rock field
  const m = src('src/scenes/worldModes.js');
  assert.match(m, /\n\s*dungeonLoc = dfLocation;\n\s*host\.profDungeonEntered\?\.\(ctx\);/, 'after the flip and its lock, once the dungeon is the one stood in');
  assert.match(m, /if \(interact && !pressCast && host\.profPress\?\.\(\)\) return true;/, 'AUDIT 29: Interact alone, above QG1');
  assert.match(m, /if \(PROF_STATIONS\.includes\(piece\.station\)\) \{ if \(forgeOffered\(\)\) interiorKeyCtx\.togglePause\(\{ at: 'stores' \}\); else say\(stationColdLine\(piece\.station\)\); return; \}/, 'AUDIT 29 B2: a cold forge says so');
  assert.match(m, /if \(t === BUILDING_TYPES\.WeaponSmith \|\| t === BUILDING_TYPES\.Armorer\) return interiorBuilding\.insideOpenShop === false \? null : \{ kind: 'shop', fee: FORGE_FEE \};/, 'AUDIT 29 D4: open for trade');
  const d = src('src/scenes/dungeonContext.js');
  assert.match(d, /actTool: \(\) => opts\.actTool\?\.\(\) \?\? null,/);
  assert.match(d, /if \(held && opts\.profActing\?\.\(\)\) return;/, 'AUDIT 29 D2: the press alone');
  assert.match(d, /if \(dfLocation\?\.spawned \|\| isGateArena\(dfLocation\) \|\| isArenaFloor\(dfLocation\) \|\| !Number\.isSafeInteger\(dfLocation\?\.mapTableData\?\.mapId\)\) return null;/, 'a spawned dungeon grows none, nor the Burning Court (AUDIT 29 D5), nor the arena\'s floor (ARENA2)');
  assert.match(src('src/ui/hud.js'), /drawNodeCompassMarks\(renderer, nodes, playerXZ, heading01, \{ bx, by, bw, s \}\);/);   // NODE-MARKS: in each profession's colour
  assert.match(src('src/ui/enhancedHud.js'), /drawNodeMarks\(opts\.nodes \?\? null, opts\.playerXZ \?\? null, heading01\);/);
  assert.match(src('src/systems/save.js'), /import '\.\/profTemplates\.js';/, 'every scene a save loads in knows the new templates');
  assert.doesNotMatch(src('src/scenes/exterior.js'), /gatherHost|createProfBook/, 'the fixed city: no wilderness, no nodes (PROF0 17.1, FLAGGED)');
});
