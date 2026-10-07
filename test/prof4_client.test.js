// PROF4 (2026-09-28, Mac: "Continue") - LOGGING AND CARPENTRY AS THE CLIENT MAKES THEM: the ring (the Wood-Axe's act) and
// the plane (the workbench's); the forest's own trees as the nodes (the nearest tree flat, sunk when felled, stood again
// at the day's turn), the fall and the stump and the logs, the War Axe in the hand, through the one gathering host; the
// woods as items; Carpentry's pieces (a staff and a bow at their wood's material, arrows a quiver, furniture among the
// home's things with its worth and its mark, the Basket's life); the Workbench on the Stores page; and the done-when,
// driven through the real Worker: DECOR PLACES A CRAFTED TABLE. Then the hosts' wiring. bible/06-Systems/
// Professions-Arc.md 25.
import './chargenDom.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { standService, T0, sessionStorageOf } from './accountDb.mjs';
import { accountProf, SESSION_KEY, accountRefusalText } from '../src/net/accountClient.js';
import { createProfBook } from '../src/net/profBook.js';
import { trees, nodeKey, utcDayOfMs } from '../src/net/nodeLaw.js';
import { xpForRank, CHOP_ACT, chopsFor, ringBand } from '../src/net/professionLaw.js';
import { recipeById, QUALITY_EFFECTS, TOOL_LIFE, PLANE_ACT, grainAt } from '../src/net/recipeLaw.js';
import { decorPieceOf } from '../src/net/decorLaw.js';
import { createChopAct, ringAt, RING_PASS_S } from '../src/systems/chopAct.js';
import { createPlaneAct } from '../src/systems/planeAct.js';
import { mintPiece, mintPieces, craftedText, isCraftedFurniture } from '../src/systems/smithItems.js';
import { mintMaterialItem, materialCountLabel, withdrawIntoPack } from '../src/systems/profItems.js';
import { templateByIndex, inventoryItemImage } from '../src/systems/itemTemplates.js';
import { WOOD_TEMPLATE_ROWS } from '../src/systems/profTemplates.js';
import { itemLongName } from '../src/systems/itemInfo.js';
import { ITEM_FIELDS } from '../src/systems/itemFields.js';
import { weaponOfMaterial } from '../src/combat/enemyEquipment.js';
import { DYE_COLORS, DYE_TARGETS } from '../src/characters/dyes.js';
import { decorFurnishingEntry, furnishingLooks } from '../src/systems/decorFurnish.js';
import { decorItemName } from '../src/systems/decorItems.js';
import { decorLookEntry } from '../src/scenes/decorTool.js';
import {
  standTrees, sinkFelled, treeKind, isTreeRecord, TREE_RECORDS, STUMP_RECORD, LOGS_RECORD, FALL_S, FALL_ANGLE, AXE_HAND, axeHandFrame, treePlan,
} from '../src/scenes/treeHost.js';
import { createGatherHost, aimAt } from '../src/scenes/gatherHost.js';
import { setForagingHost } from '../src/systems/foragingInstall.js';
import { FT } from '../src/systems/foragingLaw.js';
import { TERRAIN_SIZE } from '../src/world/terrainSampler.js';
import { sharedClassicMinutes } from '../src/net/wire.js';
import { utcDay } from '../src/net/marksLaw.js';

const src = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const noWait = () => Promise.resolve();
const tick = () => new Promise((r) => setImmediate(r));
const memStorage = () => { const m = new Map(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)) }; };
const DAY = 86_400;
const WOODS = 231, GLENUMBRA = 59;
const hourAt = (s) => Math.floor((((Math.floor(sharedClassicMinutes(s * 1000)) % 1440) + 1440) % 1440) / 60);
function secondAt(from, want) {
  for (let s = from; s < from + 2 * 7200; s += 30) if (hourAt(s) === want && hourAt(s - 60) === want && hourAt(s + 60) === want) return s;
  throw new Error('no such hour');
}
const NOON = secondAt(utcDay(T0) * DAY + 3600, 12);
const PROV = '0123456789abcdef';

// ─── THE DONE-WHEN ───────────────────────────────────────────────────

test('PROF4 DONE WHEN: DECOR places a crafted table - an Oak felled, its logs sawn at the workbench, a Small Oak Table made through the real Worker and minted among the home\'s things, listed by DECOR, set down as a look in a home and read by a visitor with its maker\'s mark', async (t) => {
  t.mock.method(Date, 'now', () => NOON * 1000);
  const s = await standService({ PROFESSIONS_OPEN: 'on', MARKS_OPEN: 'on' });
  const raw = s.env.DB._raw;
  const mac = await s.registered('Mac');
  const ann = await s.registered('Ann');
  const track = (prof, xp, spec100 = null) => raw.prepare(`INSERT INTO prof_tracks (player, char_id, profession, xp, spec100, updated_at) VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT (player, char_id, profession) DO UPDATE SET xp = excluded.xp, spec100 = excluded.spec100`).run(mac.id, mac.character, prof, xp, spec100, NOON);
  track('logging', xpForRank(10));
  track('carpentry', xpForRank(100), 'master-joiner');
  const door = accountProf({ fetch: s.fetch, storage: sessionStorageOf(SESSION_KEY, mac) });
  const book = createProfBook({ door, storage: memStorage(), character: () => mac.character, now: () => NOON * 1000, sleep: noWait });
  assert.equal((await book.refresh()).ok, true);
  // an Oak of an unconfirmed Woodlands pixel, felled with a clean ring
  const day = utcDayOfMs(NOON * 1000);
  let felled = null;
  for (let x = 300; x < 400 && !felled; x++) {
    const tr = trees({ x, y: 222, day, climate: WOODS }).find((q) => q.material === 'log:oak');   // PINE-SHARE: the Oak, by name
    if (!tr) continue;
    const r = await book.harvest({ node: nodeKey({ kind: 'tree', x, y: 222, day, slot: tr.slot }), kind: 'logs', climate: WOODS, region: GLENUMBRA, act: { chops: 3, cuts: 3, clean: true }, at: NOON - 1 });
    assert.equal(r.ok, true, JSON.stringify(r));
    felled = r.data;
  }
  assert.equal(felled.material, 'log:oak');
  assert.ok(book.held('log:oak') >= 2, 'two logs at the least');
  // sawn at the workbench: two planks a log
  const saw = await book.smelt('saw:oak', 2);
  assert.equal(saw.ok, true, JSON.stringify(saw));
  assert.equal(book.held('plank:oak'), 4);
  // the table made at the workbench, minted among the home's things - never the pack
  const player = { items: [], furnishings: [] };
  const made = await book.craft('table-small:oak', { clean: true, name: 'Silverthorn' }, (data) => {
    for (const it of mintPieces(data)) (isCraftedFurniture(it) ? player.furnishings : player.items).push(it);
  });
  assert.equal(made.ok, true, JSON.stringify(made));
  assert.deepEqual([player.items.length, player.furnishings.length], [0, 1]);
  const [table] = player.furnishings;
  assert.deepEqual([table.group, table.templateIndex, table.provenance, table.maker, table.marked === true || table.quality === 4], ['Furniture', 225, made.data.pieces[0].provenance, 'Silverthorn', true], 'a Master Joiner\'s: marked');
  assert.equal(itemLongName(table), 'Silverthorn\'s Small Oak Table');
  assert.equal(book.held('plank:oak'), 1, 'three spent');
  // DECOR lists it among "Your things", a look of the furniture kind chosen for it
  const entry = decorFurnishingEntry(table, 0);
  assert.ok(entry, 'DECOR2b lists the crafted table');
  assert.deepEqual([entry.item.t, entry.item.g, entry.item.pv, entry.item.mk], [225, 8, table.provenance, 'Silverthorn']);
  const looks = furnishingLooks(table, [{ key: 'm41000', model: 41000, kind: 'bed' }, { key: 'm41100', model: 41100, kind: 'furniture' }]);
  assert.deepEqual(looks.map((l) => l.key), ['m41100'], 'a table takes a furniture look');
  const look = decorLookEntry(entry, looks[0]);
  const piece = decorPieceOf({ id: 'tbl1', model: look.model, flat: null, pos: [1, 0, 1], rot: [0, 0, 0], scale: 1, light: null, storage: false, paid: 0, item: { ...look.item, mk: 'Anyone At All' } });
  assert.ok(piece, 'a free piece of one\'s own');
  // set down in Mac's home through the real Worker - the mark the service's own
  const HOME = { mapId: 1291010263, buildingKey: 0x10203 };
  const house = await s.seatHome(mac, { ...HOME, region: 17, price: 42000 });   // MERGE 2: a house is a realm character's (AUDIT REALM2 S2)
  assert.equal(house.status, 200);
  const placed = await s.call('/v1/homes/decor/place', { ...HOME, character: house.character, piece }, mac.secret);
  assert.equal(placed.status, 200, JSON.stringify(placed.body));
  const seen = (await s.call('/v1/homes/decor', HOME, ann.secret)).body.pieces.find((p) => p.id === 'tbl1');
  assert.deepEqual([seen.model, seen.item.t, seen.item.pv, seen.item.mk], [41100, 225, table.provenance, 'Silverthorn']);
  assert.equal(decorItemName(seen.item), 'Silverthorn\'s Small Oak Table', 'a visitor reads the maker\'s mark');
});

// ─── THE ACTS ────────────────────────────────────────────────────────

test('PROF4 ring: the circle shrinks from three notches onto one over 0.9 s and on to half, then again; a chop on the band a Clean Cut worth two; one a swing; the tree creaks at half; every chop clean the clean act; Gentle acts plain; Esc', () => {
  assert.deepEqual([ringAt(0), ringAt(CHOP_ACT.ringS), Math.round(ringAt(RING_PASS_S) * 1000) / 1000, Math.round(RING_PASS_S * 1000) / 1000], [3, 1, 0.5, 1.125]);
  const act = createChopAct({ tier: 2, rank: 0 });
  assert.deepEqual([act.state.need, Math.round(act.state.band * 1000) / 1000], [chopsFor(2), ringBand(0)]);
  act.tick(CHOP_ACT.ringS);
  assert.equal(act.inBand, true, 'the ring on the notch');
  act.tick(0, { attack: true });
  assert.deepEqual([act.state.cuts, act.state.points, act.state.last], [1, 2, 'clean']);
  act.tick(0.1, { attack: true });
  assert.equal(act.state.chops, 1, 'a press inside a swing is nothing');
  act.tick(CHOP_ACT.swingS);
  act.tick(0, { attack: true });
  assert.deepEqual([act.state.chops, act.state.cuts, act.state.points, act.state.creaked], [2, 1, 3, true], 'far from the notch: plain; half the chops: it creaks');
  assert.equal(act.report(), null, 'not done');
  act.tick(CHOP_ACT.ringS);
  act.tick(0, { attack: true });
  assert.equal(act.state.done, true);
  assert.deepEqual(act.report(), { chops: 3, cuts: 2, clean: false });
  const clean = createChopAct({ tier: 1, rank: 100 });
  for (let i = 0; i < 3; i++) { clean.tick(CHOP_ACT.ringS); clean.tick(0, { attack: true }); clean.tick(CHOP_ACT.swingS - CHOP_ACT.ringS + 0.01); }
  assert.deepEqual(clean.report(), { chops: 3, cuts: 3, clean: true }, 'five chops, three Clean Cuts: clean');
  const lumber = createChopAct({ tier: 5, lumberjack: true });
  assert.equal(lumber.state.need, 6);
  const gentle = createChopAct({ tier: 1, gentle: true });
  gentle.tick(CHOP_ACT.ringS);
  assert.equal(gentle.inBand, false);
  gentle.tick(0, { attack: true });
  assert.equal(gentle.state.cuts, 0);
  const esc = createChopAct({ tier: 1 });
  esc.cancel();
  esc.tick(1, { attack: true });
  assert.deepEqual([esc.state.chops, esc.state.cancelled], [0, true]);
  const wrap = createChopAct({ tier: 1 });
  wrap.tick(RING_PASS_S + 0.2);
  assert.ok(Math.abs(wrap.ring - ringAt(0.2)) < 1e-9, 'the ring starts again after its pass');
});

test('PROF4 plane: a pass pressed at the head and drawn to the foot along the grain is clean within 1.2-4 s; off the grain, too quick or too slow is not; let go early it starts again; a press away from the head is none; Gentle acts plain', () => {
  const along = (act, dev, seconds, steps = 40) => {
    act.press(0.02, act.grain(0.02) + dev, 0);
    for (let i = 1; i <= steps; i++) { const x = 0.02 + (0.98 * i) / steps; act.move(x, act.grain(Math.min(1, x)) + dev, (seconds * i) / steps); }
    return act.report();
  };
  const rng = () => 0.25;
  assert.equal(createPlaneAct({ rng }).grain(0), grainAt(0, 0.25));
  const good = along(createPlaneAct({ rng }), 0.05, 2);
  // AUDIT 30 A1: the pass's clock starts at its first forward move (the fortieth of two seconds after the press)
  assert.deepEqual([good.clean, Math.round(good.deviation * 100) / 100, good.seconds], [true, 0.05, 1.95]);
  assert.equal(along(createPlaneAct({ rng }), 0.3, 2).clean, false, 'off the grain');
  assert.equal(along(createPlaneAct({ rank: 100, band: 1.3, rng }), 0.3, 2).clean, true, 'a Master\'s wider hand, a steady band');
  const quick = along(createPlaneAct({ rng }), 0, 0.5);
  assert.deepEqual([quick.clean, quick.seconds < PLANE_ACT.minS], [false, true]);
  assert.equal(along(createPlaneAct({ rng }), 0, 5).clean, false, 'too slow');
  const slip = createPlaneAct({ rng });
  assert.equal(slip.press(0.5, 0, 0), false, 'the head, or nothing');
  slip.press(0, slip.grain(0), 0);
  slip.move(0.4, slip.grain(0.4), 0.5);
  slip.release();
  assert.deepEqual([slip.state.slips, slip.state.planing, slip.report()], [1, false, null]);
  assert.equal(along(slip, 0.01, 2).clean, true, 'begun again, drawn true');
  assert.equal(along(createPlaneAct({ gentle: true, rng }), 0, 2).clean, false, 'Gentle acts: plain');
  const gone = createPlaneAct({ rng });
  gone.cancel();
  assert.equal(gone.press(0, 0, 0), false);
});

// ─── THE TREES ───────────────────────────────────────────────────────

/** A pixel's forest: one tree flat a metre off each law tree's point, and three more far off - their group's batch. */
function forestOf(px, py, day, climate) {
  const law = trees({ x: px, y: py, day, climate });
  const flats = law.map((t, i) => ({ id: i, group: '504_12', i, x: t.u * TERRAIN_SIZE + 1, y: 0, z: t.v * TERRAIN_SIZE }));
  for (let k = 0; k < 3; k++) flats.push({ id: flats.length, group: '504_13', i: k, x: 5 + k, y: 0, z: 5 });
  const batch12 = { archive: 504, record: 12, size: { w: 4, h: 8 } };
  const batch13 = { archive: 504, record: 13, size: { w: 4, h: 8 } };
  const groups = new Map([
    ['504_12', { batch: batch12, centers: flats.filter((f) => f.group === '504_12').map((f) => [f.x, f.y, f.z]), size: batch12.size }],
    ['504_13', { batch: batch13, centers: flats.filter((f) => f.group === '504_13').map((f) => [f.x, f.y, f.z]), size: batch13.size }],
  ]);
  return { law, forest: { base: 504, archive: 504, trees: flats, groups } };
}

test('PROF4 trees: a pixel\'s trees stand at the forest\'s own tree flats, the nearest to each law point, one a flat; none without a forest; the felled sunk below the ground in their batch and stood again when no longer felled; World of Daggerfall\'s tree records; the plan', () => {
  assert.deepEqual([...TREE_RECORDS[504]], [12, 13, 14, 15, 16, 17, 18, 25, 30]);
  assert.deepEqual([isTreeRecord(504, 19), isTreeRecord(504, 31), isTreeRecord(504, 12), isTreeRecord(505, 12)], [false, false, true, false], 'trunks and logs are no trees; a winter archive is read by its summer\'s');
  assert.deepEqual([STUMP_RECORD, LOGS_RECORD], [19, 31]);
  const day = 20000;
  const { law, forest } = forestOf(400, 150, day, WOODS);
  const stood = standTrees({ px: 400, py: 150, day, climate: WOODS, forest });
  assert.equal(stood.length, law.length);
  stood.forEach((n, i) => {
    assert.deepEqual([n.what, n.material, n.flat.id, n.local, n.key], ['tree', law[i].material, i, [forest.trees[i].x, 0, forest.trees[i].z], nodeKey({ kind: 'tree', x: 400, y: 150, day, slot: law[i].slot })]);
  });
  assert.deepEqual(standTrees({ px: 400, py: 150, day, climate: WOODS, forest: null }), [], 'no forest, no trees');
  const one = { ...forest, trees: [forest.trees[0]] };
  assert.equal(standTrees({ px: 400, py: 150, day, climate: WOODS, forest: one }).length, 1, 'one flat, one node');
  const moved = [];
  const renderer = { moveBillboardBatch: (b, c) => { moved.push([b.record, c.map((x) => x[1])]); return true; } };
  sinkFelled(forest, new Set(['504_12#1']), renderer);
  assert.deepEqual(moved, [[12, forest.groups.get('504_12').centers.map((c, i) => (i === 1 ? c[1] - 9 : c[1]))]], 'the felled one below the ground by its height and a metre; the other group untouched');
  sinkFelled(forest, new Set(['504_12#1']), renderer);
  assert.equal(moved.length, 2, 'sunk again on a restand');
  sinkFelled(forest, new Set(), renderer);
  assert.deepEqual(moved[2], [12, forest.groups.get('504_12').centers.map((c) => c[1])], 'the day turned: stood again');
  sinkFelled(forest, new Set(), renderer);
  assert.equal(moved.length, 3, 'nothing felled then or now: untouched');
  assert.deepEqual([...new Set(stood.map((q) => q.material))].sort(), ['log:oak', 'log:pine'], 'PINE-SHARE: an unconfirmed Woodlands pixel stands its Oak and Pine');
  const node = stood.find((q) => q.material === 'log:oak');
  const plan = (o) => treePlan({ node, taken: false, counting: false, rank: 10, axe: true, storesFull: () => false, today: 0, cap: 60, ...o });
  assert.deepEqual(plan({}), { harvest: 'logs', verb: 'Chop Oak', rest: `Logging 10 - ${chopsFor(2)} chops`, ready: true });
  assert.deepEqual([plan({ rank: 9 }).rest, plan({ axe: false }).rest, plan({ taken: true }).rest, plan({ today: 60 }).rest], ['needs Logging 10', 'needs a Wood-Axe', 'felled today', 'Logging done for today (60)']);
  assert.deepEqual({ ...AXE_HAND }, { group: 'Weapons', templateIndex: 128, material: 0 });
  assert.deepEqual([axeHandFrame(0), axeHandFrame(1), axeHandFrame(0.01)], [{ state: 'Idle', frame: 0 }, { state: 'StrikeDownRight', frame: 0 }, { state: 'StrikeDownRight', frame: 4 }]);
});

test('PROF4 host: the tree targeted, E starts the Wood-Axe\'s ring (DFU\'s War Axe in the hand), attack chops, the harvest asked as logs with the ring\'s report; on the answer the tree falls away from the player and fades, its logs lie at its foot until walked over, its flat sunk and its stump stood', async () => {
  setForagingHost({ world: () => ({ inside: false, insideDungeon: false, insideCastle: false, locationType: 0xffff, inLocationRect: false, hour: 12, climate: WOODS, region: GLENUMBRA, enemiesNear: false, carriedWeight: 0, maxEncumbrance: 100, swimming: false, exteriorWater: 'None' }) });
  try {
    const day = utcDayOfMs(NOON * 1000);
    const { forest } = forestOf(400, 150, day, WOODS);
    const entry = { px: 400, py: 150, samples: new Float32Array(4), tilemap: new Uint8Array(4), locationRect: null, batches: [], forest };
    const asked = [];
    let taken = [];
    const door = {
      account: () => 'acct-1',
      state: async () => ({ ok: true, data: { day, character: 'c1', tracks: [{ profession: 'logging', xp: xpForRank(10), rank: 10, specs: { 50: null, 100: null } }], today: {}, taken, stores: [], caps: { harvests: 60, stores: 5000 } } }),
      pixels: async (c, px) => ({ ok: true, data: { pixels: px.map(([x, y]) => ({ x, y, state: 'none' })), dungeons: [] } }),
      harvest: async (b) => { asked.push(b); taken = [`${b.node}|logs`]; return { ok: true, data: { node: b.node, kind: b.kind, material: 'log:oak', qty: 3, xp: 30, extra: 'wood:resin', extraStore: { material: 'wood:resin', own: 1, bought: 0 }, track: { profession: 'logging', xp: xpForRank(10) + 30, rank: 10 }, today: 1 } }; },
    };
    const book = createProfBook({ door, storage: memStorage(), character: () => 'c1', now: () => NOON * 1000, sleep: noWait });
    const said = [];
    const hud = { setPrompt: (p) => { said.prompt = p; }, setMeter: (m) => { said.meter = m; }, toast: (x) => said.push(x), banner: () => {}, setChip: () => {}, frame: () => {}, dispose: () => {} };
    const made = [], dropped = [], moved = [];
    const renderer = {
      createBillboardBatch: (archive, record, size, centers) => { const b = { archive, record, size, centers }; made.push(b); return b; },
      destroyBatch: (b) => dropped.push(b), moveBillboardBatch: (b, c) => { moved.push([b, c]); return true; },
    };
    const deps = { renderer, getTexture: async () => ({ recordCount: 99 }), uploadRecord: () => {}, billboardSize: () => ({ w: 1, h: 0.4 }), flatBatchAabb: () => [0, 0, 0, 1, 1, 1] };
    const axe = { templateIndex: FT.WoodAxe, currentCondition: 50, maxCondition: 50 };
    const entity = { items: [axe], stats: {} };
    const feet = [0, 0, 0];
    const view = { yaw: 0, pitch: 0 };
    let input = { held: false, attack: false, choice: false };
    const built = new Map([['400,150', entry]]);
    const host = createGatherHost({
      book, hud, kinds: [treeKind({ book, ...deps })], ...deps,
      built: () => built, pixelTranslation: (x, y, out) => { out[0] = 0; out[1] = 0; out[2] = 0; return out; },
      pixelInfo: () => ({ climate: WOODS, region: GLENUMBRA }), nowMs: () => NOON * 1000,
      eye: () => ({ pos: [feet[0], feet[1] + 1.6, feet[2]], dir: [Math.sin((view.yaw * Math.PI) / 180), Math.sin((view.pitch * Math.PI) / 180), Math.cos((view.yaw * Math.PI) / 180)] }),
      view: () => view, feet: () => feet, entity: () => entity, keyLabel: () => 'E', input: () => input, active: () => true,
    });
    await book.refresh();
    host.onBuilt(entry);
    await tick(); await tick();
    const nodes = host.nodesOf(400, 150);
    assert.ok(nodes.length >= 1 && nodes.every((n) => n.kind === 'tree'));
    assert.equal(made.length, 0, 'a standing tree is the forest\'s own flat: no node flat');
    const n = nodes.find((q) => q.material === 'log:oak');   // PINE-SHARE: the Oak the door answers
    const [x, y, z] = n.local;
    feet[0] = x; feet[1] = y; feet[2] = z - 1.5;
    const at = aimAt([x, y + 1.6, z - 1.5], [x, y + n.lift, z], { yaw: 0, pitch: 0 });
    view.yaw = -at.yaw; view.pitch = -at.pitch;
    host.tick(0.016);
    assert.equal(host.target?.node.key, n.key);
    assert.match(said.prompt.verb, /^Chop Oak$/);
    assert.equal(host.press(), true);
    assert.deepEqual({ ...host.handTool(), frame: 0 }, { ...AXE_HAND, state: 'Idle', frame: 0 }, 'DFU\'s War Axe');
    // each chop as the ring meets the notch: the ring starts again at a chop, and its 0.9 s outlasts the swing
    for (let i = 0; i < 10 && host.acting(); i++) {
      input = { held: false, attack: false, choice: false };
      host.tick(CHOP_ACT.ringS);
      input = { held: false, attack: true, choice: false };
      host.tick(0.001);
    }
    input = { held: false, attack: false, choice: false };
    await tick(); await tick(); await tick();
    assert.equal(asked.length, 1);
    assert.deepEqual([asked[0].node, asked[0].kind, asked[0].act.clean, asked[0].act.cuts, asked[0].act.chops], [n.key, 'logs', true, 3, 3], 'three Clean Cuts: a clean ring');
    assert.equal(axe.currentCondition, 49, 'the Wood-Axe worn by one');
    assert.ok(said.includes('+3 Oak Logs and Resin to your Stores'), 'the Resin said with the logs (GATHER-SAID: one line)');
    for (let i = 0; i < 4; i++) { host.tick(0.016); await tick(); }
    const fall = made.find((b) => b.tip);
    assert.ok(fall, 'the tree falls');
    assert.deepEqual([fall.archive, fall.record, fall.noShadow, entry.batches.includes(fall)], [504, 12, true, true], 'its own picture, casting nothing');
    assert.ok(Math.abs(Math.hypot(fall.tip[0], fall.tip[1]) - 1) < 1e-9 && fall.tip[1] > 0, 'away from the player (north of them)');
    const logs = made.find((b) => b.record === LOGS_RECORD);
    assert.ok(logs && entry.batches.includes(logs), 'Woodland Logs at its foot');
    assert.ok(moved.some(([b, c]) => b === forest.groups.get('504_12').batch && c[n.flat.i][1] < forest.trees[n.flat.i].y), 'its flat sunk');
    assert.ok(made.some((b) => b.record === STUMP_RECORD && b.centers.some((c) => c[0] === x && c[2] === z)), 'its stump stood');
    host.tick(FALL_S / 2);
    assert.ok(fall.tip[2] > 0 && fall.tip[2] < FALL_ANGLE, 'falling');
    host.tick(FALL_S);
    assert.ok(dropped.includes(fall) && !entry.batches.includes(fall), 'fallen and gone');
    feet[0] = logs.centers[0][0]; feet[2] = logs.centers[0][2];
    host.tick(0.016);
    assert.ok(dropped.includes(logs) && !entry.batches.includes(logs), 'walked over, taken');
    host.dispose();
  } finally { setForagingHost(null); }
});

// ─── THE PIECES ──────────────────────────────────────────────────────

test('PROF4 pieces: the woods withdraw as their templates (a log on Twigs\' picture, a plank on the Staff\'s dyed Iron); a staff and a bow DFU\'s at their wood\'s material with the quality laid on; arrows twenty, one quiver, no provenance; furniture DFU\'s template, its worth its quality\'s, its mark a Masterwork\'s or a Master Joiner\'s; the Basket\'s life its quality; the words', () => {
  assert.deepEqual([templateByIndex(636).name, templateByIndex(646).name, templateByIndex(652).name, templateByIndex(654).name], ['Oak Log', 'Oak Plank', 'Charcoal', 'Heartwood']);
  assert.equal(WOOD_TEMPLATE_ROWS.length, 17);
  assert.ok(WOOD_TEMPLATE_ROWS.every((r) => r.stackable === true && r.rarity === 10));
  const logPic = inventoryItemImage(mintMaterialItem('log:oak', false));
  assert.deepEqual([logPic.archive, logPic.record, logPic.dyeTarget], [254, 9, null], 'Twigs\' picture as it is');
  assert.deepEqual(inventoryItemImage(mintMaterialItem('plank:teak', false)), { archive: 207, record: 7, dye: DYE_COLORS.Iron, dyeTarget: DYE_TARGETS.WeaponsAndArmor });
  const pack = { items: [] };
  assert.equal(withdrawIntoPack(pack, 'plank:oak', 6, false), 6);
  assert.deepEqual([pack.items.length, pack.items[0].stackCount], [1, 6]);
  assert.deepEqual([materialCountLabel('log:oak', 3, false), materialCountLabel('wood:resin', 2, false), materialCountLabel('leather:cured', 4, false)], ['Oak Logs', 'Resin', 'Cured Leather']);
  const staff = mintPiece({ recipe: 'staff:mahogany', quality: 2, seed: 7, maker: 'Ann' }, PROV);
  const dfu = weaponOfMaterial(115, 5);
  assert.deepEqual([staff.group, staff.templateIndex, staff.material, staff.maxCondition, staff.quality, staff.provenance], ['Weapons', 115, 5, Math.round(dfu.maxCondition * QUALITY_EFFECTS[2].condition), 2, PROV], 'a Mithril Staff, Fine');
  const bow = mintPiece({ recipe: 'longbow:ghostwood', quality: 1, seed: 7, maker: 'Ann' }, PROV);
  assert.deepEqual([bow.templateIndex, bow.material], [130, 7]);
  const arrows = mintPiece({ recipe: 'arrows:south', quality: -1, seed: 7, maker: 'Ann' }, PROV);
  assert.deepEqual([arrows.templateIndex, arrows.stackCount, arrows.provenance, arrows.quality, arrows.currentCondition], [131, 20, undefined, undefined, 0], 'DFU\'s arrow arm: a quiver');
  assert.equal(craftedText([arrows]), 'You made 20 Arrows');
  const plain = mintPiece({ recipe: 'table-large:teak', quality: 0, seed: 7, maker: 'Ann' }, PROV);
  const base = templateByIndex(224).basePrice;
  assert.deepEqual([plain.group, plain.templateIndex, plain.value, plain.marked, itemLongName(plain)], ['Furniture', 224, Math.round(base * QUALITY_EFFECTS[0].condition), undefined, 'Large Teak Table']);
  assert.equal(craftedText([plain]), 'You made a Crude Large Teak Table - it waits among your things for a room to stand in');
  const joined = mintPiece({ recipe: 'chair:oak', quality: 1, seed: 7, maker: 'Ann', marked: true }, PROV);
  assert.deepEqual([joined.marked, itemLongName(joined), craftedText([joined])], [true, 'Ann\'s Oak Chair', 'You made Ann\'s Oak Chair - it waits among your things for a room to stand in']);
  const master = mintPiece({ recipe: 'chair:oak', quality: 4, seed: 7, maker: 'Ann', marked: true }, PROV);
  assert.deepEqual([master.marked, itemLongName(master)], [undefined, 'Ann\'s Oak Chair'], 'a Masterwork\'s mark is its own');
  assert.equal(isCraftedFurniture(master), true);
  const basket = mintPiece({ recipe: 'basket:pine', quality: 2, seed: 7, maker: 'Ann' }, PROV);
  assert.deepEqual([basket.templateIndex, basket.maxCondition], [1607, TOOL_LIFE[2]]);
  assert.equal(mintPiece({ recipe: 'ramkit:oak', quality: -1, seed: 7 }, PROV), null, 'the Ram Kit is the Stores\'');
  assert.deepEqual(ITEM_FIELDS.marked !== undefined, true, 'marked rides the save');
  assert.equal(accountRefusalText('prof-later'), 'That is made when the sieges come.');
  assert.equal(recipeById('bed-fancy-double:teak').templateIndex, 220);
});

// ─── THE PAGES ───────────────────────────────────────────────────────

test('PROF4 pages: the Workbench at a Furniture Store - the saws for the logs held, the families and woods, a bed\'s Linen from the furnisher, a Heartwood for a plank, Craft drawn with the plane (its pass asks the craft clean), Quick craft; a home\'s sells nothing; away, the word; the Forge burns the logs; the Anvil lists the smith\'s alone; Smithing, Logging and Carpentry practised', async () => {
  const { setProfessionsPages, drawStoresPage, drawProfessionsPage, BENCH_FAMILIES, benchRecipes, anvilRecipes, planeWord } = await import('../src/ui/profPages.js');
  const { setPref } = await import('../src/systems/uiPrefs.js');
  setPref('gentleActs', false);
  const held = new Map([['log:oak', 2], ['plank:oak', 7], ['wood:heartwood', 1]]);
  const tracks = new Map([['carpentry', { profession: 'carpentry', xp: xpForRank(10), rank: 10, specs: { 50: null, 100: null } }], ['smithing', { profession: 'smithing', xp: xpForRank(50), rank: 50, specs: { 50: null, 100: null } }]]);
  const book = {
    state: { open: true, day: 1, character: 'c', account: 'a', readAt: Date.now(), stores: new Map(), tracks, today: {}, caps: null }, stale: () => false, refresh: async () => ({ ok: true }),
    held: (k) => held.get(k) ?? 0, store: (k) => ({ material: k, own: held.get(k) ?? 0, bought: 0 }),
    track: (p) => tracks.get(p) ?? { profession: p, xp: 0, rank: 0, specs: { 50: null, 100: null } }, materials: () => [], pendingWithdrawals: 0, pendingCrafts: 0,
    choose: async () => ({ ok: true }),
  };
  const crafted = [], bought = [], works = [];
  let bench = { kind: 'shop', fee: 50 };
  setProfessionsPages({
    book, name: (k) => k, withdraw: async () => ({ ok: true, text: '' }), forge: () => ({ kind: 'shop', fee: 50 }), workbench: () => bench,
    smelt: async (r, n) => { works.push([r, n]); return { ok: true, text: 'worked' }; },
    craft: async (recipe, o) => { crafted.push([recipe, o.clean, o.heartwood]); return { ok: true, text: 'made' }; },
    stock: async (m, n) => { bought.push([m, n]); held.set(m, (held.get(m) ?? 0) + n); return { ok: true, text: 'bought' }; },
    heatBand: () => 1, planeBand: () => 1,
  });
  const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; };
  const kit = { el, divider: (w) => el('h3', null, w), meter: () => el('div') };
  let root = null;
  const draw = () => { root?.remove?.(); root = el('div'); document.body.append(root); drawStoresPage(root, draw, kit); };
  draw();
  const text = () => root.textContent;
  const buttons = () => [...root.querySelectorAll('button')];
  const press = (label) => buttons().find((b) => b.textContent.startsWith(label)).onclick();
  assert.match(text(), /The Workbench/);
  assert.match(text(), /The furnisher's workbench - 50 gold a craft or a saw/);
  assert.match(text(), /plank:oak x2/, 'a saw\'s yield said');
  assert.match(text(), /wood:charcoal/, 'the Forge burns the logs held');
  await buttons().find((b) => b.textContent === 'Burn').onclick();
  assert.deepEqual(works.at(-1), ['burn:oak', 1], 'the Forge\'s Burn is the held log\'s');
  await buttons().find((b) => b.textContent === 'Saw').onclick();
  assert.deepEqual(works.at(-1), ['saw:oak', 1]);
  assert.deepEqual(BENCH_FAMILIES.map(([id]) => id), ['staves', 'bows', 'arrows', 'furniture', 'tools', 'siege']);
  assert.ok(anvilRecipes('tools', 'ingot:iron').every((r) => r.profession === 'smithing'), 'the Basket is the workbench\'s');
  assert.deepEqual(benchRecipes('furniture', 'plank:oak').map((r) => r.id), ['table-large:oak', 'table-small:oak', 'chair:oak', 'bed-plain-double:oak']);
  press('Furniture');
  press('plank:oak');
  const bed = buttons().find((b) => b.textContent.startsWith('Plain Double Bed'));
  assert.match(bed.textContent, /wants its inputs/, 'no Linen');
  bed.onclick();
  await press('Buy 2 from the furnisher - 4 silver');
  assert.deepEqual(bought, [['cloth:linen', 2]]);
  press('Small Oak Table');
  assert.match(text(), /Use a Heartwood for a plank - a step better \(1 stored\)/);
  const box = [...root.querySelectorAll('input')].find((i) => i.type === 'checkbox' && /Heartwood/.test(i.parentNode?.textContent ?? ''));
  box.checked = true; box.onchange();
  assert.match(text(), /wood:heartwood 1 \/ 1/, 'the Heartwood in a plank\'s place');
  press('Craft');
  const board = root.querySelector('.prof-board');
  assert.ok(board, 'the plane\'s board');
  const r = { left: 0, top: 0, width: 100, height: 40 };
  board.getBoundingClientRect = () => r;
  // a pass true to the grain over two seconds (the page reads the clock)
  const clock = [0];
  const realPerf = globalThis.performance.now;
  globalThis.performance.now = () => clock[0];
  try {
    const at = (x) => ({ clientX: x * 100, clientY: 20 - 20 * grainAt(x, 0.5), pointerId: 1 });
    // the act's own grain: read it off the board's drawn line
    const grainLine = [...board.querySelectorAll('polyline')].find((p) => p.getAttribute('class') === 'prof-grain');
    const pts = grainLine.getAttribute('points').split(' ').map((p) => p.split(',').map(Number));
    const grainY = (x) => { const i = Math.min(pts.length - 1, Math.round(x * 40)); return pts[i][1]; };
    board.onpointerdown({ clientX: 1, clientY: grainY(0.01), pointerId: 1 });
    for (let i = 1; i <= 40; i++) { clock[0] = i * 50; board.onpointermove({ clientX: i * 2.5, clientY: grainY(i / 40), pointerId: 1 }); }
    void at;
  } finally { globalThis.performance.now = realPerf; }
  await tick(); await tick();
  assert.deepEqual(crafted.at(-1), ['table-small:oak', true, true], 'drawn true: a clean pass, the Heartwood asked');
  assert.equal(planeWord({ clean: true, seconds: 2 }), 'A clean pass - true to the grain.');
  assert.equal(planeWord({ clean: false, seconds: 0.4 }), 'Too quick - a plane is drawn, not flicked.');
  await press('Quick craft');
  assert.deepEqual(crafted.at(-1).slice(0, 2), ['table-small:oak', false]);
  bench = { kind: 'home', fee: 0 };
  held.delete('cloth:linen');
  draw();
  press('Furniture'); press('plank:oak');
  buttons().find((b) => b.textContent.startsWith('Plain Double Bed')).onclick();
  assert.equal(buttons().some((b) => b.textContent.startsWith('Buy ') && /furnisher/.test(b.textContent)), false, 'a home sells nothing');
  assert.match(text(), /Your workbench/);
  bench = null;
  draw();
  assert.match(text(), /Carpentry is done at a workbench: a Furniture Store's \(50 gold a craft or a saw\)/);
  // the Professions page: Smithing practised - its cards chosen at 50 (PROF4's FOUND)
  root.remove(); root = el('div'); document.body.append(root);
  drawProfessionsPage(root, () => {}, kit);
  const smith = [...root.querySelectorAll('button')].find((b) => b.textContent.startsWith('Smithing'));
  smith.onclick();
  root.remove(); root = el('div'); document.body.append(root);
  drawProfessionsPage(root, () => {}, kit);
  assert.doesNotMatch(root.textContent, /comes later|not practised/);
  const weaponsmith = [...root.querySelectorAll('button')].find((b) => b.textContent.startsWith('Weaponsmith'));
  assert.equal(weaponsmith.disabled, false, 'at rank 50 the smith chooses');
  assert.match(root.textContent, /Steel; the chain/);
  setProfessionsPages(null);
  root.remove();
});

// ─── THE WIRING ──────────────────────────────────────────────────────

test('PROF4 wiring: a built pixel keeps its forest (the tree flats by World of Daggerfall\'s table, their groups\' batches); the host mints furniture among the home\'s things, asks the station by the recipe, the plane\'s band off AGI and WIL; the workbench a Furniture Store\'s or a home\'s station; the billboard shader tips a felled tree; DECOR marks a set-down piece from the service\'s own row', () => {
  const w = src('src/scenes/world.js');
  // PIN MOVED (ECOTONE1, 2026-10-07): a flat's climate is its own - the pixel's, or the neighbour's a border stood it by
  // (`base` its summer archive, the Tree table's key; `archive` the season's set it is drawn in)
  assert.match(w, /if \(isTreeRecord\(base, f\.record\)\) pixelTrees\.push\(\{ id: pixelTrees\.length, group: `\$\{archive\}_\$\{f\.record\}`, i, x: f\.x, y: f\.y, z: f\.z, wood: f\.wood \?\? 0, base, archive \}\);/);   // FOREST1 (AUDIT F3): and how wooded its tile is
  assert.match(w, /forest: \{ base: climate\.natureArchive, archive: natureArchive, trees: pixelTrees\.filter\(\(t\) => forestGroups\.has\(t\.group\)\), groups: forestGroups \},/);
  // PIN MOVED (ECOTONE1): any of the pixel's nature archives - its own, or a neighbour climate's a border stood here
  assert.equal((w.match(/if \(natureSet\.has\(archive\)\) forestGroups\.set\(k, \{ batch, centers, size[^}]*\}\);/g) ?? []).length, 3, 'the season\'s batch, the classic one and (LPT1) a low-poly tree\'s far pictures');
  assert.match(w, /if \(isCraftedFurniture\(it\)\) \(playerEntity\.furnishings \?\?= \[\]\)\.push\(it\);\n\s*else addItem\(\(playerEntity\.items \?\?= \[\]\), it, 'back'\);/);
  // PROF7 moved it: the station a recipe's profession names (craftStation) - the workbench Carpentry's, the loom Outfitting's
  assert.match(w, /const st = craftStation\(recipeById\(recipe\)\?\.profession\);\n\s*const f = st\.here\(\);/);
  assert.match(w, /const craftStation = \(profession\) => \(profession === 'carpentry'\n\s*\? \{ here: \(\) => modes\?\.workbenchHere\?\.\(\) \?\? null,/);
  // PIN MOVED (PROF11): the work names the mason's bench too
  assert.match(w, /const bench = work\?\.station === 'workbench', loom = work\?\.station === 'loom', mason = work\?\.station === 'mason';/);
  assert.match(w, /planeBand: \(\) => planeBand\(\{ agility: liveStat\(playerEntity, 'agility'\), willpower: liveStat\(playerEntity, 'willpower'\) \}\),/);
  const m = src('src/scenes/worldModes.js');
  assert.match(m, /if \(interiorBuilding\.buildingType === BUILDING_TYPES\.FurnitureStore\) return interiorBuilding\.insideOpenShop === false \? null : \{ kind: 'shop', fee: WORKBENCH_FEE \};/);
  assert.match(m, /if \(decorOwnerHere\(\) && interiorDecor\.list\(\)\.some\(\(p\) => p\?\.station === 'workbench'\)\) return \{ kind: 'home', fee: 0 \};/);
  const r = src('src/render/renderer.js');
  assert.match(r, /uniform vec3 uTip;/);
  assert.match(r, /if \(uTip\.z != 0\.0\) \{/);
  assert.match(r, /if \(tp \|\| this\._bbTipOn\) \{ gl\.uniform3f\(this\.bbUTip, tp \? tp\[0\] : 0, tp \? tp\[1\] : 0, tp \? tp\[2\] : 0\); this\._bbTipOn = !!tp; \}/);
  const d = src('server-account/src/decor.js');
  assert.match(d, /const ours = row && row\.owner === player\.id && Number\(row\.template\) === p\.item\.t && Number\(row\.listed\) === 0 && !elsewhere;/);   // AUDIT 30 S6: and not on the market, and not standing twice
  assert.match(d, /delete plain\.mk;/);
  const g = src('src/scenes/gatherHost.js');
  assert.match(g, /for \(const k of kinds\) k\.stood\?\.\(entry, rec\.nodes\.filter\(\(n\) => n\.kind === k\.id\)\);/);
  assert.match(g, /for \(const f of k\.gone\(n\) \? \(k\.goneFlatsOf\?\.\(n, entry\) \?\? \[\]\) : k\.flatsOf\(n\)\) \{/);
  // AUDIT 30 A5: the node as its pixel stands now, the fall's failure its own
  assert.match(g, /const now = s\?\.nodes\.find\(\(x\) => x\.key === a\.node\.key\) \?\? null;\n\s*if \(now && k\.felled\) \{\n\s*try \{ Promise\.resolve\(k\.felled\(now, \{ entry: s\.entry, from: deps\.eye\(\)\.pos, tr: deps\.pixelTranslation\(a\.px, a\.py, \[0, 0, 0\]\) \}\)\)\.catch/);
});
