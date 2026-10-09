// MWNPC10b (2026-10-09, the MW-NPC arc's tenth slice - bible/04-Characters/Morrowind-NPCs.md section 15b): THE SIEGE'S
// FIGHTERS AND THE SHIPS' CREWS IN THEIR MORROWIND BODIES. Neither keeps an entity, so a class one is dressed by its
// class (characters/foeBodies.js rosterLook: a race and face off its seed, a foe's clothes in their dyes, steel for the
// knight, the warrior, the spellsword and the watch - the watch helmed) and a creature one is its creature; each driver
// offers its shown sprites on a lane of its own (siegeNpcs.js, navalCrew.js) before the world's passes draw them.
// Pinned on the real drivers (their own tests' stand-ins) over recording lanes, and the world's draw points by source.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { rosterLook } from '../src/characters/foeBodies.js';
import { MOBILE_TYPES as M } from '../src/characters/mobileTypes.js';
import { EQUIP_SLOTS } from '../src/systems/equip.js';
import { ARMOR_ENUM } from '../src/combat/enemyEquipment.js';
import { createSiegeNpcs } from '../src/scenes/siegeNpcs.js';
import { SIEGE_UNITS_PER_M as REF_M } from '../src/net/siegeRef.js';

const rd = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const settle = () => new Promise((r) => setTimeout(r, 0));
function recordingLane() {
  const L = { offered: [], destroyed: 0, offsets: [], veiled: 0 };
  Object.assign(L, {
    begin() { L.offered.length = 0; },
    stand(lane, actor, conceal) { L.offered.push({ lane, id: actor.id, look: actor.look, dead: actor.dead, scale: actor.scale, swings: actor.swings, hits: actor.hits, moving: actor.moving, feet: actor.feet, conceal }); },
    end() {}, has() { return false; }, draw() {}, drawVeiled() { L.veiled++; }, destroy() { L.destroyed++; }, offsetAll(o) { L.offsets.push(o); },
  });
  return L;
}

test('MWNPC10b-1 rosterLook: a class one dressed by its class off its seed - steel for the knight, the warrior, the spellsword and the watch (helmed), a foe\'s clothes in their dyes for the rest; a creature one its creature, none where there is no match; kept while it is the same one', () => {
  const plate = (l) => l.items.filter((it) => it.group === 'Armor').map((it) => it.templateIndex).sort((a, b) => a - b);
  const steel = [ARMOR_ENUM.Cuirass, ARMOR_ENUM.Greaves, ARMOR_ENUM.Boots, ARMOR_ENUM.Left_Pauldron, ARMOR_ENUM.Right_Pauldron, ARMOR_ENUM.Gauntlets].sort((a, b) => a - b);
  for (const t of [M.Knight, M.Warrior, M.Spellsword]) assert.deepEqual(plate(rosterLook({}, { mobileType: t, seed: 4 })), steel, `${t}: in steel`);
  const watch = rosterLook({}, { mobileType: M.Knight_CityWatch, seed: 4 });
  assert.deepEqual(plate(watch), [...steel, ARMOR_ENUM.Helm].sort((a, b) => a - b), 'the watch helmed');
  assert.ok(watch.items.filter((it) => it.group === 'Armor').every((it) => it.material === 1));
  assert.equal(watch.items.filter((it) => it.equipSlot === EQUIP_SLOTS.Feet).length, 1, 'his boots, no shoes beside');
  const rogue = rosterLook({}, { mobileType: M.Rogue, gender: 'female', seed: 9 });
  assert.equal(plate(rogue).length, 0, 'a rogue in her clothes');
  assert.equal(rogue.gender, 'female');
  assert.deepEqual(rogue.items.map((it) => it.equipSlot), [EQUIP_SLOTS.ChestClothes, EQUIP_SLOTS.LegsClothes, EQUIP_SLOTS.Feet]);
  assert.ok(rogue.items.every((it) => it.group === 'WomensClothing'));
  const races = new Set(Array.from({ length: 40 }, (_, s) => rosterLook({}, { mobileType: M.Thief, seed: s }).race));
  assert.ok(races.size >= 4, `the Bay's mix off the seed (${[...races]})`);
  assert.deepEqual(rosterLook({}, { mobileType: M.Thief, seed: 7 }), rosterLook({}, { mobileType: M.Thief, seed: 7 }), 'the same one the same look on every machine');
  assert.deepEqual(rosterLook({}, { mobileType: M.Rat }), { creature: ['rat'] }, 'a creature hand its creature');
  assert.equal(rosterLook({}, { mobileType: M.GiantBat }), null, 'none for one with no match');
  const rec = {};
  const l = rosterLook(rec, { mobileType: M.Bard, seed: 3 });
  assert.equal(rosterLook(rec, { mobileType: M.Bard, seed: 3 }), l, 'kept: one build');
  assert.notEqual(rosterLook(rec, { mobileType: M.Bard, gender: 'female', seed: 3 }), l, 'another one: another look');
});

test('MWNPC10b-2 the siege: each shown fighter offered in its body on the siege\'s lane - the guard in the watch\'s steel, the captain a fifth again a man; walking as it walks, each new attack a swing, each hurt a recoil, down dead; its feet its billboard\'s; leaving lets the lane go; the origin moves them', async () => {
  const T = 1_000_000;
  const renderer = { textures: new Set(), createBillboardBatch: (archive, record, size) => ({ archive, record, size, bounds: [0, 0, 0, 0] }), destroyBillboardBatch: () => {} };
  const tex = { getFrameCount: () => 4, getSize: () => ({ width: 40, height: 80 }), getScale: () => ({ x: 0, y: 0 }) };
  let lane = null;
  const d = createSiegeNpcs({ renderer, getTexture: async () => tex, uploadRecordFrame: () => {}, cam: () => [0, 2, 10], toScene: (x, z) => [x / REF_M, 7, z / REF_M],
    wantBodies: () => true, makeBodies: () => (lane = recordingLane()) });
  const n = { id: 'n0', kind: 'guard', hp: 360, max: 360, x: 0, z: 0, tx: 10 * REF_M, tz: 0, at: T, down: false, atk: 0, hurtAt: -Infinity };
  const cap = { ...n, id: 'n9', kind: 'captain', tx: 0, x: 3 * REF_M };
  const twin = { ...n, id: 'n1', x: -3 * REF_M, tx: -3 * REF_M };
  d.frame([n, cap, twin], T + 100); await settle(); d.frame([n, cap, twin], T + 116);
  d.drawBodies({}, null, null, [0, 0, 0], 1 / 60);
  const g = lane.offered.find((o) => o.id === 'n0'), c = lane.offered.find((o) => o.id === 'n9');
  assert.ok(g && c, 'both offered');
  assert.notDeepEqual(lane.offered.find((o) => o.id === 'n1').look, g.look, 'two guards two people - the look seeded off the id');
  assert.ok(g.look.items.some((it) => it.templateIndex === ARMOR_ENUM.Helm), 'the guard in the watch\'s helmed steel');
  assert.equal(g.moving, true, 'walking where its walk carries it');
  assert.equal(c.scale, 1.2, 'the captain as his sprite stands him');
  assert.equal(g.feet, d.batches()[0].origin, 'its feet its billboard\'s');
  d.frame([{ ...n, atk: T + 1000 }, cap], T + 200);
  d.frame([{ ...n, atk: T + 1000, hurtAt: T + 300 }, cap], T + 300);
  d.drawBodies({}, null, null, [0, 0, 0], 1 / 60);
  const g2 = lane.offered.find((o) => o.id === 'n0');
  assert.deepEqual([g2.swings, g2.hits], [1, 1], 'an attack a swing, a hurt a recoil');
  d.frame([{ ...n, down: true, at: T + 400 }, cap], T + 400);
  d.drawBodies({}, null, null, [0, 0, 0], 1 / 60);
  assert.ok(lane.offered.find((o) => o.id === 'n0').dead > 0, 'down: dead');
  d.offsetBodies([5, 0, 5]);
  assert.deepEqual(lane.offsets, [[5, 0, 5]]);
  d.leave();
  assert.equal(lane.destroyed, 1);
});

test('MWNPC10b-3 the crews: each hand on her deck offered his class\'s look off her seed and his place, at his sprite\'s feet and his world facing, concealed with her owner; each swing at his work a blow; the hands below and the gone none; cleared, the lane let go', async () => {
  const { readyPool } = await import('./navalSea.mjs');
  const { ctxFor } = await import('./csaScene.mjs');
  const { Boat, spawnBoat } = await import('../src/systems/comeSailAwayBoat.js');
  const { createNavalCrew } = await import('../src/scenes/navalCrew.js');
  const { crewRoster } = await import('../src/systems/naval/crewLife.js');
  const { classById } = await import('../src/systems/naval/navalShips.js');
  const pool = await readyPool();
  const deck = pool.deckOf(2, 0);
  const boat = new Boat(2, 0); spawnBoat(boat, ctxFor({ position: [0, 0, 0], rotation: [0, 0, 0, 1] }));
  const renderer = { createBillboardBatch: (archive) => ({ archive }), destroyBillboardBatch: () => {}, textures: new Map() };
  const tex = { getFrameCount: () => 4, getSize: () => ({ width: 40, height: 80 }), getScale: () => ({ width: 0, height: 0 }), recordCount: 20 };
  let lane = null;
  const crew = createNavalCrew({ renderer, getTexture: async () => tex, uploadRecordFrame: () => {}, rand: () => 0.3, wantBodies: () => true, makeBodies: () => (lane = recordingLane()) });
  const pirate = classById('pirateBrig');
  crew.sync([{ key: 'ship:1', boat, deck, count: 6, rosterOf: () => crewRoster({ hull: 2, seed: 3, shipClass: pirate }), seed: 3, faction: 'pirate', battle: false }]);
  await settle();
  boat.conceal = { mode: 1, alpha: 0.4 };
  crew.frame(0.05, [0, 10, 0]);
  crew.drawBodies({}, null, null, [0, 10, 0], 1 / 60);
  const ship = crew.ships()[0];
  const standing = [...ship.sprites].filter(([m, s]) => s?.batch && s.unit && !m.below);
  const order = [...ship.sprites.keys()];
  const wm = boat.MeshObject.worldMatrix();
  assert.equal(lane.offered.length, standing.length, 'every hand on her deck');
  assert.ok(lane.offered.length >= 1);
  for (const o of lane.offered) {
    const [m, s] = standing.find(([, sp]) => sp.id === o.id);
    assert.equal(o.feet, s.origin, 'at his sprite\'s feet');
    const fw = [Math.sin(m.yaw), Math.cos(m.yaw)];
    assert.ok(Math.abs(s.yaw - Math.atan2(wm[0] * fw[0] + wm[8] * fw[1], wm[2] * fw[0] + wm[10] * fw[1])) < 1e-9, 'his facing out of her frame');
    assert.equal(o.conceal, boat.conceal, 'concealed with her owner');
    const i = order.indexOf(m) + 1;
    assert.deepEqual(o.look, rosterLook({}, { mobileType: m.mobile, gender: m.gender, seed: Math.imul(3 + i, 0x9e3779b1) >>> 0 }), 'his class\'s look off her seed and his place');
  }
  // a swing at his work - crewLife's one-step pulse (SHIP-WATCH): one blow each
  const [m0, s0] = standing[0];
  const step = ship.life.step;
  let pulses = [true, false, true];
  ship.life.step = (dt, ctx) => { step(dt, ctx); m0.swing = pulses.shift() ?? false; };
  crew.frame(0.05, [0, 10, 0]); crew.frame(0.05, [0, 10, 0]);
  crew.drawBodies({}, null, null, [0, 10, 0], 1 / 60);
  assert.equal(lane.offered.find((o) => o.id === s0.id).swings, 1, 'a pulse, one swing');
  crew.frame(0.05, [0, 10, 0]);
  crew.drawBodies({}, null, null, [0, 10, 0], 1 / 60);
  assert.equal(lane.offered.find((o) => o.id === s0.id).swings, 2, 'the next pulse, the next');
  void pulses;
  // a hand turned in below her deck: kept, not offered
  standing[1][0].below = true;
  crew.drawBodies({}, null, null, [0, 10, 0], 1 / 60);
  assert.ok(!lane.offered.some((o) => o.id === standing[1][1].id), 'below her deck: no body');
  crew.drawVeiledBodies();
  assert.equal(lane.veiled, 1);
  crew.clear();
  assert.equal(lane.destroyed, 1, 'cleared, the lane let go');
});

test('MWNPC10b-4 the world\'s draw points: the siege\'s bodies with the street\'s people before the flats; the crews\' with the foes before the person billboards, their veiled after; both moved with the origin', () => {
  const w = rd('src/scenes/world.js');
  const people = w.indexOf('streetPeople.draw(canvas, proj, view, mwv.eye, townTalk.overlayActive ? 0 : dt);');
  const siege = w.indexOf('siegeNpcs?.drawBodies(canvas, proj, view, mwv.eye, dt);', people);
  const flats = w.indexOf('renderer.drawBillboards(allBatches, camRight, bbUp);', siege);
  assert.ok(people > 0 && siege > people && flats > siege, 'the siege before the flats its batches ride');
  const crew = w.indexOf('navalCrew.drawBodies(canvas, proj, view, mwv.eye, foeDt);');
  const persons = w.indexOf('if (livePersonBatches.length) renderer.drawBillboards(livePersonBatches, camRight, bbUp);', crew);
  const veiled = w.indexOf('navalCrew.drawVeiledBodies();', persons);
  assert.ok(crew > 0 && persons > crew && veiled > persons, 'the crews before the person billboards, veiled after');
  assert.ok(w.includes('navalCrew.offsetBodies(r.offset); siegeNpcs?.offsetBodies(r.offset);'));
});
