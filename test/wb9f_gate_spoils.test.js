// WB9f (2026-09-30, Mac: "Improve the loot drops that emit on his death and have them spread out more. The player should
// be able to inspect and pick up the ground item, not just walk over it"): HIS SPOILS, SPREAD AND HANDLED, DRIVEN. The
// throw (world/gateSpew.js - a slot of a wider fan a piece, harder, and each launch kept on the court's floor); the floor
// (scenes/spoilsPool.js - a resting piece an activation target, named, listed and taken by the press, its rest told);
// the court (scenes/gateCourt.js - the floor it keeps them on, the gold out of his chest, each landing's sparks); the
// seams (the court's targets and words, the press's rung, the plaque's list, the world host's hooks) by source.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  spewLaunches, spewPiece, stepSpew, restOf, floorRayAt, keepLaunch, SPEW_SPREAD, SPEW_SPEED, SPEW_SLOT_MARGIN, SPEW_KEEP_TRIES, SPEW_KEEP_EASE, SPEW_FLIGHT_MAX_S,
} from '../src/world/gateSpew.js';
import { PROJECTILE_FIXED_DT } from '../src/scenes/droppedTorches.js';
import { seededRng } from '../src/systems/wind.js';
import { createSpoilsPool, spoilsList, SPOILS_TEXT, SPOIL_KEY, SPOIL_GOLD_KEY, SPOIL_BOX_HALF_M, SPOIL_BOX_MIN_H } from '../src/scenes/spoilsPool.js';
import { RAY_DISTANCE, TREASURE_ACTIVATION_DISTANCE } from '../src/player/activate.js';
import { RARITIES } from '../src/systems/lootRarity.js';
import { ITEMISED_KEYS, keyItemises, resolveHover } from '../src/systems/worldHover.js';
import { createGateCourt, spoilsKeep, SPEW_RIM_M, SPOILS_BURST_COLOR, SPEW_AT_MS } from '../src/scenes/gateCourt.js';
import { FX_KINDS, sparkAt, FX_SPARK_VS } from '../src/render/gateFx.js';
import { tierColour } from '../src/render/spoilsGlow.js';
import { GATE_STATE_EMPTY } from '../src/net/gateLink.js';
import { mintReceipt } from '../src/net/gateReceipt.js';
import { COURTS, COURT_R } from '../src/net/gateBrain.js';
import { courtToDungeon } from '../src/world/gateArena.js';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const flat = floorRayAt(0);
const bearingOf = (l) => Math.atan2(l.dir[0], l.dir[2]);
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));

test('WB9f the throw: a slot of the fan a piece - five pieces span most of a fan twice WB5\'s, no two leave on one line, the first to leave not always the leftmost; the seed\'s own; thrown harder (mutants: the slots unshuffled; the margin gone; the old spread)', () => {
  assert.ok(SPEW_SPREAD >= 1.5 && SPEW_SPREAD < Math.PI / 2 + 0.1, 'a half-disc toward the player - never behind him');
  assert.ok(SPEW_SPEED.min >= 8 && SPEW_SPEED.max >= 12, 'harder than WB5\'s 7-10.5');
  const firstSlot = new Set();
  const minGap = (4 * SPEW_SLOT_MARGIN * SPEW_SPREAD) / 5;
  for (let seed = 1; seed <= 60; seed++) {
    const b0 = 0.7, L = spewLaunches(seededRng(seed), 5, b0);
    assert.deepEqual(L, spewLaunches(seededRng(seed), 5, b0), 'the seed\'s own');
    const off = L.map((l) => wrap(bearingOf(l) - b0));
    for (const o of off) assert.ok(Math.abs(o) <= SPEW_SPREAD + 1e-9, 'inside the fan');
    const sorted = [...off].sort((a, b) => a - b);
    for (let i = 1; i < sorted.length; i++) assert.ok(sorted[i] - sorted[i - 1] >= minGap - 1e-9, `seed ${seed}: two pieces ${(sorted[i] - sorted[i - 1]).toFixed(3)} rad apart`);
    assert.ok(sorted.at(-1) - sorted[0] >= 2 * SPEW_SPREAD * (3 + 2 * SPEW_SLOT_MARGIN) / 5 - 1e-9, 'spanning the fan');
    firstSlot.add(sorted.indexOf(off[0]));
    for (const l of L) assert.ok(l.speed >= SPEW_SPEED.min && l.speed <= SPEW_SPEED.max);
  }
  assert.ok(firstSlot.size >= 4, `the first piece out takes any slot, by the seed (${[...firstSlot]})`);
  // a lone piece: anywhere in the fan, as WB5 threw it
  const [one] = spewLaunches(seededRng(5), 1, 0);
  assert.ok(Math.abs(bearingOf(one)) <= SPEW_SPREAD);
});

test('WB9f the spread on the floor: over a flat floor, across 200 seeds, no two of a kill\'s five pieces come to rest within a metre of each other, and all of them within a dozen metres of him (mutant: the old spread)', () => {
  let worst = Infinity, far = 0;
  for (let seed = 1; seed <= 200; seed++) {
    const pts = spewLaunches(seededRng((seed ^ 0x5a5a) >>> 0), 5, 0.3).map((l) => restOf([0, 3.1, 0], l, 0));
    for (let i = 0; i < pts.length; i++) {
      far = Math.max(far, Math.hypot(pts[i][0], pts[i][2]));
      for (let j = i + 1; j < pts.length; j++) worst = Math.min(worst, Math.hypot(pts[i][0] - pts[j][0], pts[i][2] - pts[j][2]));
    }
  }
  assert.ok(worst >= 1, `the nearest two ${worst.toFixed(2)} m apart`);
  assert.ok(far <= 12, `the farthest ${far.toFixed(1)} m out`);
});

test('WB9f the flight flown ahead: restOf is the torch\'s own flight stepped to rest over the floor\'s plane; the plane answers only a step that crosses it downward', () => {
  const [l] = spewLaunches(seededRng(11), 1, 0);
  const p = spewPiece([0, 3.1, 0], l);
  let n = 0;
  while (!p.rest && n++ < SPEW_FLIGHT_MAX_S / PROJECTILE_FIXED_DT + 2) stepSpew(p, flat);
  assert.deepEqual(restOf([0, 3.1, 0], l, 0), p.pos, 'the same rest');
  assert.equal(restOf([0, 3.1, 0], l, 0)[1], 0, 'on the floor');
  assert.equal(floorRayAt(2)([0, 3, 0], [0, 1, 0], 5), null, 'up: no floor');
  assert.equal(floorRayAt(2)([0, 3, 0], [0, -1, 0], 0.5), null, 'short of it');
  assert.deepEqual(floorRayAt(2)([0, 3, 0], [0, -1, 0], 2), { dist: 1, normal: [0, 1, 0] });
});

test('WB9f the court keeps its spoils: a launch that would rest inside the floor is answered as it is; one that would carry off the edge is thrown softer until it rests inside, its direction kept; one no softening keeps is turned toward the centre (mutants: the keep ignored; the ease never applied; the fallback left pointing off the edge)', () => {
  const keep = { centre: [0, 0, 0], r: 22, floorY: 0 };
  const [l] = spewLaunches(seededRng(3), 1, Math.PI / 2);
  assert.equal(keepLaunch([0, 3.1, 0], l, keep), l, 'well inside: untouched');
  assert.equal(keepLaunch([0, 3.1, 0], l, null), l, 'no floor to keep: untouched');
  // at the edge, thrown outward
  const from = [20, 3.1, 0], out = { at: 0, dir: [0.6, 0.8, 0], speed: 12 };
  const rest0 = restOf(from, out, 0);
  assert.ok(Math.hypot(rest0[0], rest0[2]) > keep.r, 'unkept, it goes over the edge');
  const kept = keepLaunch(from, out, keep);
  const rest1 = restOf(from, kept, 0);
  assert.ok(Math.hypot(rest1[0], rest1[2]) <= keep.r, 'kept on the floor');
  assert.deepEqual(kept.dir, out.dir, 'the same way');
  assert.ok(kept.speed < out.speed && kept.speed >= out.speed * SPEW_KEEP_EASE ** SPEW_KEEP_TRIES - 1e-9, 'softer, by the ease');
  assert.equal(kept.at, out.at, 'leaving when it would');
  // a floor too small for any throw: turned to the centre
  const tiny = { centre: [0, 0, 0], r: 0.5, floorY: 0 };
  const turned = keepLaunch([6, 3.1, 0], { at: 0, dir: [0.6, 0.8, 0], speed: 12 }, tiny);
  assert.ok(turned.dir[0] < 0, 'toward the centre');
  assert.ok(Math.abs(Math.hypot(...turned.dir) - 1) < 1e-9, 'still a unit direction');
  assert.ok(Math.abs(turned.dir[1] - 0.8) < 1e-12, 'as steeply as it left');
});

const WALL = 1_700_000_000_000;
function pool({ feet = null, restLog = null } = {}) {
  const clock = { t: 100000 };
  const pack = [], said = [];
  const mem = new Map();
  const st = { get: (k) => (mem.has(k) ? JSON.parse(mem.get(k)) : null), set: (k, v) => mem.set(k, JSON.stringify(v)), remove: (k) => mem.delete(k) };
  const p = createSpoilsPool({
    ray: flat, feet: () => (feet ? feet() : null), now: () => clock.t, take: (x) => pack.push(x), say: (t) => said.push(t), store: st,
    who: () => 'char-1', wall: () => WALL, itemName: (item) => `Named ${item.name}`,
  });
  const run = (ms, step = 16) => { for (let t = 0; t < ms; t += step) { clock.t += step; p.frame(restLog ? (pos, tier, kind) => restLog.push({ pos: [...pos], tier, kind }) : undefined); } };
  return { p, clock, pack, said, run };
}

test('WB9f the pool keeps them on the floor it is handed: a kill at the court\'s edge, thrown outward, rests every piece inside it; with no floor handed they fly as thrown (mutant: the pool drops the keep)', () => {
  const keep = { centre: [0, 0, 0], r: 12, floorY: 0 };
  const kept = pool(), free = pool();
  kept.p.spew({ day: 705, seed: 77, level: 6, at: [10, 3.1, 0], bearing: Math.PI / 2, keep });
  free.p.spew({ day: 705, seed: 77, level: 6, at: [10, 3.1, 0], bearing: Math.PI / 2 });
  kept.run(6000); free.run(6000);
  const r = (q) => Math.hypot(q.pos[0], q.pos[2]);
  assert.ok(free.p.state().pieces.some((q) => r(q) > keep.r), 'thrown as they leave him, some go over the edge');
  assert.ok(kept.p.state().pieces.every((q) => q.rest && r(q) <= keep.r + 1e-9), 'kept, every one rests on the floor');
});

test('WB9f the floor in the ray: each resting piece a target in the loot piles\' own shape - a box over it, won at the ray\'s reach, taken at the treasure\'s; an item\'s key itemises, the gold\'s names; none in the air, none taken; one list refilled (mutants: flying pieces stood; the gold itemised; a taken piece still stood)', () => {
  const h = pool();
  assert.equal(h.p.targets().length, 0, 'an empty floor stands nothing');
  h.p.spew({ day: 700, seed: 99, level: 8, at: [0, 3.1, 0], bearing: 0 });
  h.run(100);
  assert.equal(h.p.targets().length, 0, 'in the air: nothing to press');
  h.run(4000);
  const list = spoilsList(99, 8), t0 = h.p.targets(), s = h.p.state().pieces;
  assert.equal(t0.length, list.length, 'all at rest'); assert.equal(list.length, 6, 'GEM2 (PIN MOVED): three pieces, the Warden\'s gem, the ember and the gold');
  assert.equal(h.p.targets(), t0, 'one list, refilled');
  const t = [...t0];
  t.forEach((x, i) => {
    assert.equal(x.key, `${list[i].kind === 'gold' ? SPOIL_GOLD_KEY : SPOIL_KEY}${i}`);
    assert.equal(x.distance, RAY_DISTANCE); assert.equal(x.reach, TREASURE_ACTIVATION_DISTANCE);
    const [px, py, pz] = s[i].pos;
    assert.deepEqual(x.aabb.min, [px - SPOIL_BOX_HALF_M, py, pz - SPOIL_BOX_HALF_M]);
    assert.ok(x.aabb.max[1] - py >= SPOIL_BOX_MIN_H - 1e-9, 'tall enough to aim at');
    assert.equal(keyItemises(x.key), list[i].kind === 'item', 'an item lists; the gold names');
  });
  assert.ok(ITEMISED_KEYS.includes(SPOIL_KEY) && !ITEMISED_KEYS.includes(SPOIL_GOLD_KEY));
  assert.equal(h.p.pick(t[1].key), true);
  assert.deepEqual(h.p.targets().map((x) => x.key), t.filter((_, i) => i !== 1).map((x) => x.key), 'a taken piece is no target');
});

test('WB9f inspected and pressed: a piece\'s word is its own name and its tier, the gold its sum; the plaque lists the one item; the press takes it into the pack and says so - once (GATE-UX: and nothing else does); a key for a piece in the air, a taken one or another kind answers nothing (mutants: the name without its tier; the press that never takes; the press taking twice; the walk-over back)', () => {
  const h = pool();
  h.p.spew({ day: 701, seed: 42, level: 12, at: [0, 3.1, 0], bearing: 1 });
  const list = spoilsList(42, 12);
  assert.equal(h.p.nameOf(`${SPOIL_KEY}0`), null, 'in the air: nothing to name yet');
  assert.equal(h.p.pick(`${SPOIL_KEY}0`), false, 'nor to take');
  h.run(4000);
  const item = list[0], tier = RARITIES[item.tier];
  assert.deepEqual(h.p.nameOf(`${SPOIL_KEY}0`), { title: `Named ${item.item.name}`, subs: item.tier !== 'common' ? [tier.label] : [] }, 'its own word and its tier');
  const g = list.findIndex((q) => q.kind === 'gold');
  assert.deepEqual(h.p.nameOf(`${SPOIL_GOLD_KEY}${g}`), { title: SPOILS_TEXT.goldName(list[g].gold) });
  assert.equal(h.p.nameOf(`${SPOIL_KEY}${g}`), null, 'the gold is not an item\'s key');
  assert.equal(h.p.nameOf(`${SPOIL_GOLD_KEY}0`), null, 'nor an item the gold\'s');
  assert.equal(h.p.nameOf('loot:0'), null, 'another family\'s key: not mine');
  assert.deepEqual(h.p.contentsOf(`${SPOIL_KEY}0`).map((x) => x.name), [item.item.name], 'the plaque lists the one item');
  assert.equal(h.p.contentsOf(`${SPOIL_GOLD_KEY}${g}`), null);
  // the plaque, driven: the itemised frame with its row
  const frame = resolveHover({ key: `${SPOIL_KEY}0`, distance: 2, reach: TREASURE_ACTIVATION_DISTANCE }, { name: (k) => h.p.nameOf(k), contents: (k) => h.p.contentsOf(k) });
  assert.equal(frame.kind, 'items'); assert.equal(frame.title, `Named ${item.item.name}`); assert.equal(frame.rows.length, 1);
  assert.equal(h.p.pick(`${SPOIL_KEY}0`), true, 'pressed: taken');
  assert.equal(h.pack.length, 1); assert.equal(h.pack[0].item.name, item.item.name);
  assert.equal(h.said.at(-1), SPOILS_TEXT.item(item.item.name, item.tier), 'its name said, with its tier');
  assert.equal(h.p.pick(`${SPOIL_KEY}0`), false, 'once');
  assert.equal(h.pack.length, 1);
  assert.equal(h.p.pick(`${SPOIL_GOLD_KEY}${g}`), true);
  assert.equal(h.said.at(-1), SPOILS_TEXT.gold(list[g].gold));
  // GATE-UX (Mac: "Loot at the end can still be walked over and picked up"): walking over takes nothing, however long
  const me = { at: null }, w = pool({ feet: () => me.at });
  w.p.spew({ day: 702, seed: 7, level: 3, at: [0, 3.1, 0], bearing: 0 });
  w.run(4000);
  for (const q of w.p.state().pieces) { me.at = [q.pos[0], q.pos[1], q.pos[2]]; w.run(2000); }
  assert.equal(w.pack.length, 0, 'every piece stood on, none taken');
  assert.ok(w.p.state().pieces.every((q) => !q.taken), 'all still on the floor');
});

test('WB9f each landing told: the floor says each piece\'s rest once, where it lies, its tier and kind - the court\'s sparks (mutant: the rest never told)', () => {
  const log = [];
  const h = pool({ restLog: log });
  h.p.spew({ day: 703, seed: 5, level: 4, at: [0, 3.1, 0], bearing: 0 });
  h.run(5000);
  const list = spoilsList(5, 4), s = h.p.state().pieces;
  assert.equal(log.length, list.length, 'once a piece');
  for (const e of log) {
    const i = s.findIndex((q) => q.pos[0] === e.pos[0] && q.pos[2] === e.pos[2]);
    assert.ok(i >= 0, 'where it lies');
    assert.equal(e.tier, list[i].tier); assert.equal(e.kind, list[i].kind);
  }
  const bad = pool();
  bad.p.spew({ day: 704, seed: 5, level: 4, at: [0, 3.1, 0], bearing: 0 });
  assert.doesNotThrow(() => { for (let k = 0; k < 300; k++) { bad.clock.t += 16; bad.p.frame(() => { throw new Error('a spark'); }); } }, 'a spark that throws is not the spoils\' problem');
  assert.ok(bad.p.state().pieces.every((q) => q.rest));
});

test('WB9f the court: his spoils kept on the floor of the court he fell in, SPEW_RIM_M in from its edge; his chest bursts in gold as they leave it, the sparks falling to the floor under it; each piece\'s landing throws its tier\'s sparks, a Rare-or-better\'s brighter (mutants: the keep unsent; the gold burst gone; the landing sparks gone)', async () => {
  for (let k = 0; k < COURTS.length; k++) {
    const [cx, cz] = COURTS[k], K = spoilsKeep(cx + 3, cz - 5);
    assert.deepEqual(K.centre, courtToDungeon(cx, 0, cz), `court ${k}'s own floor`);
    assert.equal(K.r, COURT_R - SPEW_RIM_M); assert.equal(K.floorY, courtToDungeon(0, 0, 0)[1]);
  }
  const link = { st: GATE_STATE_EMPTY, r: null, state() { return this.st; }, receipt() { return this.r; } };
  const clock = { t: 50000 };
  const spewed = [];
  let onRest = null;
  const fake = { spew: (x) => { spewed.push(x); return true; }, frame: (cb) => { onRest = cb; }, batches: () => [], lights: () => [], drawPass: () => false, gather() {} };
  const [x2, z2] = COURTS[2];
  const c = createGateCourt({ link, spoils: fake, now: () => clock.t, feet: () => courtToDungeon(x2, 0, z2 + 8), player: () => ({ level: 9, health: 50, maxHealth: 50 }), say() {} });
  link.st = { ...GATE_STATE_EMPTY, day: 710, boss: 'ruhn', x: x2 + 4, z: z2 - 3, ct: 2, fell: { at: 50000, top: ['Mac'], n: 2 } };
  link.r = await mintReceipt({ d: 710, b: 'ruhn', s: 'acct-1', c: 4242, x: 'dealt' }, null, { subtle: globalThis.crypto.subtle, nowS: 50 });
  clock.t = 50000 + SPEW_AT_MS; c.frame();
  assert.equal(spewed.length, 1);
  assert.deepEqual(spewed[0].keep, spoilsKeep(x2 + 4, z2 - 3), 'the last court\'s floor');
  assert.equal(typeof onRest, 'function', 'the floor tells the court of each rest');
  clock.t += 20; c.frame();
  const gold = c.state().bursts.find((b) => b.kind === FX_KINDS.spoils);
  assert.ok(gold, 'the gold burst');
  assert.deepEqual(gold.color, SPOILS_BURST_COLOR);
  assert.deepEqual(gold.at, spewed[0].at, 'out of his chest');
  onRest([1, 0, 2], 'legendary', 'item');
  onRest([3, 0, 4], 'common', 'gold');
  clock.t += 20; c.frame();
  const b = c.state().bursts;
  const leg = b.find((q) => q.at[0] === 1 && q.at[2] === 2), com = b.find((q) => q.at[0] === 3 && q.at[2] === 4);
  assert.equal(leg.kind, FX_KINDS.spoilRestRare); assert.deepEqual(leg.color, tierColour('legendary'));
  assert.equal(com.kind, FX_KINDS.spoilRest); assert.deepEqual(com.color, tierColour('common'));
  assert.ok(FX_KINDS.spoilRestRare.share > FX_KINDS.spoilRest.share, 'a Rare-or-better\'s brighter');
  // the burst's sparks fall to the floor under it, not to its own height
  const high = sparkAt(4, 1.0, 0.9, -3);
  assert.ok(high.at[1] < 0 && high.at[1] >= -3 + 0.05 - 1e-9, 'fallen to the floor below the chest');
  assert.equal(sparkAt(4, 1.0).at[1], 0.05, 'a floor burst rests on its own floor, as before');
  assert.match(FX_SPARK_VS, /uniform float uFloor;/);
});

test('WB9f the seams, by source: the court stands the spoils and their words where it is stood; the dungeon arm\'s press takes a piece through the host before any loot rung; the plaque\'s list asks the host; the world host hands the pool to all four and names an item as the loot piles do (mutants: each seam removed)', () => {
  const wm = read('src/scenes/worldModes.js');
  assert.match(wm, /ctx\.addActivationTargets\(\(\) => host\.spoilTargets\?\.\(\) \?\? NO_TARGETS\);/);
  assert.match(wm, /ctx\.addActivationNamer\(\(key\) => \(typeof key === 'string' && key\.startsWith\('spoil'\) \? host\.spoilName\?\.\(key\) \?\? null : null\)\);/);
  const press = wm.indexOf("if (key.startsWith('spoil')) { quickLootSpend(); host.takeSpoil?.(key); return true; }");   // AUDIT WB9 (spoils F2): the armed key spent on it
  assert.ok(press > 0, 'the press rung');
  assert.ok(press > wm.indexOf('if (_pick.distance > _pick.reach) { setMidScreenText(TOO_FAR_AWAY_TEXT); return true; }', press - 2000), 'after the reach is judged');
  assert.ok(press < wm.indexOf("if (key.startsWith('loot:') || key.startsWith('corpse:')", press), 'before the loot rung');
  assert.match(wm, /spoilContents: \(key\) => host\.spoilContents\?\.\(key\) \?\? null,/);
  assert.match(read('src/scenes/dungeonContext.js'), /if \(kind === 'spoil'\) return opts\.spoilContents\?\.\(key\) \?\? null;/);
  const w = read('src/scenes/world.js');
  assert.match(w, /spoilTargets: \(\) => floorPool\(\)\?\.targets\(\) \?\? null,/);   // SD9e: the floor of the place I stand in - the court's, or the Hour's (PIN MOVED)
  assert.match(w, /spoilName: \(key\) => floorPool\(\)\?\.nameOf\(key\) \?\? null,/);
  assert.match(w, /spoilContents: \(key\) => floorPool\(\)\?\.contentsOf\(key\) \?\? null,/);
  assert.match(w, /takeSpoil: \(key\) => !!floorPool\(\)\?\.pick\(key\),/);
  assert.match(w, /const floorPool = \(\) => \(modes\?\.sdRealmSlot\?\.\(\) != null \? sdSpoilsPool : spoilsPool\);/, 'the court\'s pool anywhere but the Hour');
  assert.match(w, /itemName: \(item\) => lootPileName\(\[item\]\),/);
  const gc = read('src/scenes/gateCourt.js');
  assert.match(gc, /spoils\?\.frame\(onSpoilRest\);/);
  assert.match(gc, /acct: claims\.s, keep, claims \}\)\) \{/);   // WB12d: and its rite
});
