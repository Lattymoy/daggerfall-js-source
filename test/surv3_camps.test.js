import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  TENT_MODEL, FIRE_FLAT, CAMP_REACH, BY_FIRE_REACH, PLACE_AHEAD, TENT_BEHIND, FIRE_MINUTES, COOK_MINUTES, SKILLET_COOK_MINUTES, CAMPS_PER_OWNER, CAMP_KIND, CAMP_TEXT,
  campDecision, campSpot, tentPos, newCamp, fireLit, stokeFire, campExpired, placeCampItem, packCamp, cookables, cookFood, hasSkillet,
  nearestFire, byFire, campInfoText, campMenu, campWire, validCampRecord, campFromWire, mergeOwnerCamps,
} from '../src/systems/survival/camp.js';
import { createCamps, FIRE_LIGHT_UP } from '../src/scenes/camps.js';
import { createSurvivalItem, SURVIVAL_USE_TEXT, CAMPING_USES } from '../src/systems/survival/items.js';
import { TEMPLATE, FOOD_STAGE, foodStage } from '../src/systems/survival/food.js';
import { setWorldMinutes, worldMinutes } from '../src/systems/worldTick.js';
import { raceActivation } from '../src/player/activationRace.js';
import { useResultAction } from '../src/ui/enhancedInventory.js';
import { USE_PENDING } from '../src/systems/useItem.js';
import { createSceneCache, cacheScene, restoreCachedScene } from '../src/systems/sceneCache.js';
import { POSE_BOUND } from '../src/net/wire.js';

// ═══ SURV3 (2026-09-18): THE CAMPS ══════════════════════════════════
//
// Mac: "For tents, they are shared world objects ... Campfires in
// dungeons/outside + beds should act as the go-to rest options +
// adding a new campfire item players can buy and place." The pure law
// (systems/survival/camp.js), the pool a host stands (scenes/camps.js)
// on the dropped torches' shape, the inventory's hand-off, the race,
// the three host mounts, the scene cache, the wire.

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(root, p), 'utf8');
const flat = (x, z) => (o, d, m) => (d[1] < 0 && m >= o[1] ? o[1] : null);   // a floor at y = 0 under every probe

test('SURV3: where a camp may go - not indoors, not in town, not with foes near, no tent below, not in water, only on ground', () => {
  assert.equal(campDecision(CAMP_KIND.Tent, { insideBuilding: true, ground: 0 }).text, SURVIVAL_USE_TEXT.campingIndoors);
  assert.equal(campDecision(CAMP_KIND.Fire, { inTown: true, ground: 0 }).text, SURVIVAL_USE_TEXT.campingTown);
  assert.equal(campDecision(CAMP_KIND.Fire, { enemiesNearby: true, ground: 0 }).text, SURVIVAL_USE_TEXT.campingFoes);
  assert.equal(campDecision(CAMP_KIND.Tent, { insideDungeon: true, ground: 0 }).text, CAMP_TEXT.noTentBelow, 'a dungeon takes a fire and no tent');
  assert.equal(campDecision(CAMP_KIND.Fire, { insideDungeon: true, ground: 0 }).ok, true);
  assert.equal(campDecision(CAMP_KIND.Fire, { inWater: true, ground: 0 }).text, CAMP_TEXT.inWater);
  assert.equal(campDecision(CAMP_KIND.Fire, { ground: null }).text, CAMP_TEXT.noGround);
  assert.deepEqual(campDecision(CAMP_KIND.Tent, { ground: 3 }), { ok: true, text: null });
  // the spot: PLACE_AHEAD along the yaw, on the probe's floor
  const s = campSpot([10, 2, 10], Math.PI / 2, flat());
  assert.ok(Math.abs(s.pos[0] - (10 + PLACE_AHEAD)) < 1e-9 && Math.abs(s.pos[2] - 10) < 1e-9, 'forward is [sin yaw, 0, cos yaw]');
  assert.equal(s.ground, 0, 'the probe from a unit up, down to the floor');
  assert.equal(campSpot([10, 2, 10], 0, null).ground, null, 'no probe, no ground');
  assert.equal(campSpot([10, 2, 10], 0, () => 50).ground, null, 'a floor too far down is no floor');
  const c = newCamp({ id: 'a', kind: CAMP_KIND.Tent, pos: [0, 0, 0], yaw: 0, now: 100 });
  assert.deepEqual(tentPos(c).map((v) => v + 0), [0, 0, -TENT_BEHIND], 'the tent stands behind its fire, facing it');
  assert.equal(TENT_MODEL, 41606); assert.deepEqual(FIRE_FLAT, { archive: 210, record: 1 }); assert.equal(CAMP_REACH, 3.2);
});

test('SURV3: the fire - eight hours from the lighting or the stoking; a tent stokes, a kit does not; a dead kit fire is gone, a cold tent stands', () => {
  const tent = newCamp({ id: 't', kind: CAMP_KIND.Tent, pos: [0, 0, 0], now: 1000 });
  const fire = newCamp({ id: 'f', kind: CAMP_KIND.Fire, pos: [0, 0, 0], now: 1000 });
  assert.equal(tent.litUntil, 1000 + FIRE_MINUTES); assert.equal(FIRE_MINUTES, 480);
  assert.equal(fireLit(tent, 1479), true); assert.equal(fireLit(tent, 1480), false);
  assert.equal(stokeFire(tent, 1200), true); assert.equal(tent.litUntil, 1480 + FIRE_MINUTES, 'stoked from the later of its end and now');
  assert.equal(stokeFire(tent, 5000), true); assert.equal(tent.litUntil, 5000 + FIRE_MINUTES, 'a cold tent relights from now');
  assert.equal(stokeFire(fire, 1200), false); assert.equal(fire.litUntil, 1480, 'a kit fire cannot be stoked');
  assert.equal(campExpired(fire, 1479), false); assert.equal(campExpired(fire, 1480), true);
  assert.equal(campExpired(tent, 99999), false, 'a tent stands cold');
});

test('SURV3: placing - the gear pitches a tent and leaves the pack with its wear; a kit lights a fire and is spent on its last use; four camps at most', () => {
  const gear = createSurvivalItem(TEMPLATE.CampingEquipment, { condition: 10 });
  const kit = createSurvivalItem(TEMPLATE.Campfire, { condition: 1 });
  const pack = [gear, kit];
  const ctx = { now: 500, owner: 'p1', feet: [0, 1, 0], yaw: 0, probe: flat(), place: {}, standing: 0, id: 'p1:1' };
  const r = placeCampItem(gear, pack, ctx);
  assert.equal(r.ok, true); assert.equal(r.text, CAMP_TEXT.pitched);
  assert.equal(r.camp.kind, CAMP_KIND.Tent); assert.equal(r.camp.wear, 9, 'one use off the gear rides the camp');
  assert.deepEqual(r.camp.pos, [0, 0, PLACE_AHEAD]); assert.equal(r.camp.owner, 'p1'); assert.equal(r.camp.id, 'p1:1');
  assert.equal(pack.includes(gear), false, 'the gear leaves the pack while the tent stands');
  const f = placeCampItem(kit, pack, { ...ctx, standing: 1 });
  assert.equal(f.ok, true); assert.equal(f.spent, true); assert.equal(f.text, `${CAMP_TEXT.lit} ${CAMP_TEXT.kitSpent}`);
  assert.equal(pack.includes(kit), false, 'the last light takes the kit');
  const kit2 = createSurvivalItem(TEMPLATE.Campfire, { condition: 3 });
  const pack2 = [kit2];
  const f2 = placeCampItem(kit2, pack2, { ...ctx, standing: 1 });
  assert.equal(f2.spent, false); assert.equal(kit2.currentCondition, 2); assert.ok(pack2.includes(kit2), 'a kit with lights left stays');
  const full = placeCampItem(kit2, pack2, { ...ctx, standing: CAMPS_PER_OWNER });
  assert.equal(full.ok, false); assert.equal(full.text, CAMP_TEXT.tooMany); assert.equal(kit2.currentCondition, 2, 'a refusal costs nothing');
  const town = placeCampItem(kit2, pack2, { ...ctx, place: { inTown: true } });
  assert.equal(town.text, SURVIVAL_USE_TEXT.campingTown); assert.equal(kit2.currentCondition, 2);
  assert.equal(placeCampItem(createSurvivalItem(TEMPLATE.Bread), pack2, ctx).ok, false, 'only the two placeables');
  // packing: the gear back with its wear; a fire stamped out
  const back = packCamp(r.camp);
  assert.equal(back.item.templateIndex, TEMPLATE.CampingEquipment); assert.equal(back.item.currentCondition, 9); assert.equal(back.text, CAMP_TEXT.packed);
  assert.deepEqual(packCamp(f.camp), { item: null, text: CAMP_TEXT.stamped });
  assert.equal(createSurvivalItem(TEMPLATE.CampingEquipment).currentCondition, CAMPING_USES, 'the mint\'s condition is the port\'s field (SURV2 wrote `condition`, which nothing reads)');
});

test('SURV3: cooking - the raw foods alone; cooked a stage nearer fresh, one off the pack, half an hour or a quarter with a skillet', () => {
  const fish = createSurvivalItem(TEMPLATE.RawFish, { foodStage: FOOD_STAGE.Mouldy });
  const meat = createSurvivalItem(TEMPLATE.RawMeat, { stackCount: 1 });
  const bread = createSurvivalItem(TEMPLATE.Bread);
  const pack = [fish, bread, meat];
  assert.deepEqual(cookables(pack), [fish, meat]);
  assert.equal(hasSkillet(pack), false);
  const r = cookFood(fish, pack, { skillet: false });
  assert.equal(r.item.templateIndex, TEMPLATE.CookedFish); assert.equal(r.item.foodStage, FOOD_STAGE.Stale, 'mouldy raw cooks to stale');
  assert.equal(r.item.name, 'Smelly Cooked Fish'); assert.equal(r.minutes, COOK_MINUTES); assert.equal(COOK_MINUTES, 30);
  assert.equal(pack.includes(fish), false); assert.ok(pack.includes(r.item));
  pack.push(createSurvivalItem(TEMPLATE.Skillet));
  const m = cookFood(meat, pack, { skillet: hasSkillet(pack) });
  assert.equal(m.item.templateIndex, TEMPLATE.Meat); assert.equal(foodStage(m.item), 0); assert.equal(m.minutes, SKILLET_COOK_MINUTES); assert.equal(SKILLET_COOK_MINUTES, 15);
  assert.equal(m.text, CAMP_TEXT.cooked('Raw Meat'));
  assert.equal(cookFood(bread, pack), null, 'bread does not cook');
});

test('SURV3: by the fire - within four of a LIT fire, anyone\'s; the eye\'s words and the menu\'s rows', () => {
  const lit = newCamp({ id: 'a', owner: 'x', kind: CAMP_KIND.Fire, pos: [0, 0, 0], now: 0 });
  const cold = newCamp({ id: 'b', owner: 'x', kind: CAMP_KIND.Tent, pos: [10, 0, 0], now: -FIRE_MINUTES });
  assert.equal(BY_FIRE_REACH, 4);
  assert.equal(nearestFire([lit, cold], [3.9, 0, 0], 10), lit);
  assert.equal(nearestFire([lit, cold], [4.1, 0, 0], 10), null);
  assert.equal(byFire([lit, cold], [10, 0, 0], 10), false, 'a cold fire warms nobody');
  assert.equal(byFire([lit], [0, 0, 0], FIRE_MINUTES), false, 'nor a dead one');
  assert.equal(campInfoText(cold, 10, true), CAMP_TEXT.seeOwnCamp); assert.equal(campInfoText(cold, 10, false), CAMP_TEXT.seeCamp);
  assert.equal(campInfoText(lit, 10, true), CAMP_TEXT.seeOwnFire); assert.equal(campInfoText(lit, 10, false), CAMP_TEXT.seeFire);
  assert.equal(campInfoText(lit, FIRE_MINUTES, true), CAMP_TEXT.seeEmbers);
  assert.deepEqual(campMenu(lit, 10, true).map((r) => r.key), ['rest', 'cook', 'pack']);
  assert.deepEqual(campMenu(lit, 10, false).map((r) => r.key), ['rest', 'cook'], 'another\'s fire is not yours to put out');
  assert.deepEqual(campMenu(cold, 10, true).map((r) => r.key), ['rest', 'cook', 'stoke', 'pack'], 'a cold tent offers its fire');
  assert.equal(campMenu(cold, 10, true)[3].text, CAMP_TEXT.menuPack); assert.equal(campMenu(lit, 10, true)[2].text, CAMP_TEXT.menuStamp);
});

test('SURV3: the wire - a camp as its owner says it, the door every record comes in by, an owner\'s word replacing theirs alone', () => {
  const c = newCamp({ id: 'p1:3', owner: 'p1', kind: CAMP_KIND.Tent, pos: [1.2345, 2, 3], yaw: 1.23456, now: 100, wear: 7 });
  const w = campWire(c, (p) => [p[0] * 2, p[1], p[2]]);
  assert.deepEqual(w, { i: 'p1:3', k: 0, p: [2.47, 2, 3], y: 1.235, u: 580, w: 7 });
  assert.deepEqual(validCampRecord(w), { i: 'p1:3', k: 0, p: [2.47, 2, 3], y: 1.235, u: 580, w: 7 });
  for (const bad of [null, [], { ...w, i: 5 }, { ...w, i: 'a b' }, { ...w, k: 2 }, { ...w, p: [1, 2] }, { ...w, p: [POSE_BOUND + 1, 0, 0] }, { ...w, p: [0, 1e6, 0] }, { ...w, y: 'n' }, { ...w, u: -2 }, { ...w, w: 300 }, { ...w, w: 1.5 }]) {
    assert.equal(validCampRecord(bad), null, `refused whole: ${JSON.stringify(bad)}`);
  }
  assert.equal(validCampRecord({ ...w, y: 10 }).y !== 10, true, 'the yaw is wrapped');
  const back = campFromWire(validCampRecord({ ...w, u: -1 }), 'p1', (p) => [p[0] / 2, p[1], p[2]]);
  assert.deepEqual(back, { id: 'p1:3', owner: 'p1', kind: CAMP_KIND.Tent, pos: [1.235, 2, 3], yaw: 1.235, litUntil: null, wear: 7, placedAt: null });
  const mine = newCamp({ id: 'me:1', owner: null, kind: CAMP_KIND.Fire, pos: [0, 0, 0], now: 0 });
  const theirsOld = { ...back, id: 'p1:old' };
  const merged = mergeOwnerCamps([mine, theirsOld, { ...back, owner: 'p2', id: 'p2:1' }], 'p1', [w, w, { ...w, i: 'p1:4' }, { ...w, i: 'p1:5' }, { ...w, i: 'p1:6' }, { ...w, i: 'p1:7' }, { bad: 1 }]);
  assert.deepEqual(merged.map((x) => x.id), ['me:1', 'p2:1', 'p1:3', 'p1:4', 'p1:5', 'p1:6'], 'mine and p2\'s kept, p1\'s old one gone, the duplicate and the bad one dropped, four at most');
  assert.equal(CAMPS_PER_OWNER, 4);
});

/** A renderer, a texture and a pipeline the pool can stand on. */
function fakeHost() {
  const batches = [];
  const renderer = {
    createBillboardBatch: (archive, record, size, centers) => { const b = { archive, record, size, centers: centers.map((c) => [...c]), frame: null }; batches.push(b); return b; },
    destroyBillboardBatch: (b) => { b._dead = true; },
    drawMesh: () => {},
  };
  const uploads = [];
  const said = [];
  const overlays = [];
  const entity = { items: [] };
  const state = { feet: [0, 1, 0], yaw: 0, place: {}, self: null };
  const camps = createCamps({
    renderer, getTexture: async () => ({ getFrameCount: () => 3, getSize: () => ({ width: 40, height: 40 }) }), uploadRecordFrame: (a, r, f) => uploads.push([a, r, f]),
    meshes: { getGpuMesh: async () => ({ gpu: true }), cpuModels: new Map([[TENT_MODEL, { positions: [-1, 0, -1, 1, 2, 1] }]]) }, entity,
    camera: () => ({ feet: state.feet, yaw: state.yaw }), collider: () => ({ raycast: flat() }), place: () => state.place,
    pixelKeyAt: (p) => `px:${Math.floor(p[0] / 100)}`, say: (l) => said.push(l), showOverlay: (w) => overlays.push(w), openRest: () => said.push('REST'),
    advanceMinutes: (n) => said.push(`+${n}`), selfId: () => state.self,
  });
  return { camps, renderer, batches, uploads, said, overlays, entity, state };
}
const settle = () => new Promise((r) => setTimeout(r, 0));

test('SURV3: the pool - a fire stands as TEXTURE.210 record 1 with a light over it, burns down by the world clock, a kit\'s camp goes with its fire, a tent stays cold', async () => {
  setWorldMinutes(1000);
  const h = fakeHost();
  const kit = createSurvivalItem(TEMPLATE.Campfire, { condition: 2 });
  const gear = createSurvivalItem(TEMPLATE.CampingEquipment);
  h.entity.items.push(kit, gear);
  assert.equal(h.camps.placeItem(kit, h.entity.items), true);
  assert.equal(h.said.at(-1), CAMP_TEXT.lit);
  await settle();
  assert.deepEqual(h.uploads, [[210, 1, 0], [210, 1, 1], [210, 1, 2]], 'the flame\'s three frames up once');
  assert.equal(h.camps.batches().length, 1);
  assert.deepEqual(h.camps.batches()[0].centers, [[0, 0, PLACE_AHEAD]]);
  assert.equal(h.camps.batches()[0].size.w, 1, '40 pixels at GlobalScale');
  assert.deepEqual(h.camps.lights(), [{ x: 0, y: FIRE_LIGHT_UP, z: PLACE_AHEAD, range: 12 }]);
  h.state.feet = [50, 1, 0];
  assert.equal(h.camps.placeItem(gear, h.entity.items), true);
  await settle();
  assert.equal(h.camps.camps.length, 2); assert.equal(h.camps.own().length, 2);
  assert.equal(h.entity.items.includes(gear), false);
  assert.equal(h.camps.byFire([50, 0, PLACE_AHEAD]), true); assert.equal(h.camps.byFire([20, 0, 0]), false);
  h.camps.tick(0.05);
  assert.equal(h.camps.batches()[0].frame, 0, 'the flame animates on the lights archive\'s clock - 12 fps, so a twentieth is under a step');
  h.camps.tick(0.05);
  assert.equal(h.camps.batches()[0].frame, 1, '...and a tenth is one');
  setWorldMinutes(1000 + FIRE_MINUTES);
  h.camps.tick(0.1);
  assert.equal(h.camps.camps.length, 1, 'the kit\'s camp went with its fire');
  assert.equal(h.camps.camps[0].rec.kind, CAMP_KIND.Tent);
  assert.equal(h.camps.batches().length, 0, 'a cold tent shows no flame'); assert.deepEqual(h.camps.lights(), []);
  assert.equal(h.camps.draw(h.renderer), 1, 'but the tent is drawn');
  const t = h.camps.targets();
  assert.equal(t.length, 2, 'the fire\'s box and the tent\'s mesh bounds');
  assert.ok(t.every((x) => x.key === `camp:${h.camps.camps[0].rec.id}` && x.reach === CAMP_REACH));
  assert.ok(t[1].aabb.min[2] < t[0].aabb.min[2], 'the tent\'s box sits behind the fire\'s');
  setWorldMinutes(0);
});

test('SURV3: the pool - the eye names it, the menu rests, stokes, cooks and packs; the save, the pixel sweep, the recenter', async () => {
  setWorldMinutes(2000);
  const h = fakeHost();
  const gear = createSurvivalItem(TEMPLATE.CampingEquipment, { condition: 5 });
  h.entity.items.push(gear, createSurvivalItem(TEMPLATE.RawFish));
  h.camps.placeItem(gear, h.entity.items);
  await settle();
  const key = h.camps.targets()[0].key;
  assert.equal(h.camps.activate(key, 'info'), true); assert.equal(h.said.at(-1), CAMP_TEXT.seeOwnCamp);
  assert.equal(h.camps.activate('camp:nope', 'grab'), false);
  assert.equal(h.camps.activate(key, 'grab'), true);
  const menu = h.overlays.at(-1);
  assert.deepEqual(menu.items, [CAMP_TEXT.menuRest, CAMP_TEXT.menuCook, CAMP_TEXT.menuPack]);
  menu._pick(0); assert.equal(h.said.at(-1), 'REST');
  h.camps.activate(key, 'grab'); h.overlays.at(-1)._pick(1);
  const cook = h.overlays.at(-1);
  assert.deepEqual(cook.items, ['Raw Fish']);
  cook._pick(0);
  assert.equal(h.said.at(-2), CAMP_TEXT.cooked('Raw Fish')); assert.equal(h.said.at(-1), `+${COOK_MINUTES}`, 'offline the cook\'s minutes pass');
  assert.equal(h.entity.items.some((it) => it.templateIndex === TEMPLATE.CookedFish), true);
  h.camps.activate(key, 'grab'); h.overlays.at(-1)._pick(1);
  assert.equal(h.said.at(-1), CAMP_TEXT.nothingToCook);
  setWorldMinutes(2000 + FIRE_MINUTES + 1);
  h.camps.tick(0.1);
  h.camps.activate(key, 'grab');
  assert.deepEqual(h.overlays.at(-1).items, [CAMP_TEXT.menuRest, CAMP_TEXT.menuCook, CAMP_TEXT.menuStoke, CAMP_TEXT.menuPack]);
  h.overlays.at(-1)._pick(2);
  assert.equal(h.said.at(-1), CAMP_TEXT.stoked); assert.equal(h.camps.lights().length, 1, 'the flame is back');
  // the save's rows and their restore, in the host's frame
  const snap = h.camps.snapshot((p) => [p[0] + 100, p[1], p[2]]);
  assert.equal(snap.length, 1); assert.equal(snap[0].pos[0], 100); assert.equal(snap[0].wear, 4);
  h.camps.restore(snap, (p) => [p[0] - 100, p[1], p[2]]);
  await settle();
  assert.equal(h.camps.camps.length, 1); assert.deepEqual(h.camps.camps[0].rec.pos, [0, 0, PLACE_AHEAD]);
  h.camps.restore([{ junk: 1 }, null, { kind: 'x', pos: [0, 0, 0] }]);
  assert.equal(h.camps.camps.length, 1, 'a restore merges by id (AUDIT SURV B: the save\'s list joins what stands); nothing off a bad row');
  h.camps.restore(snap, (p) => [p[0] - 100, p[1], p[2]]);
  await settle();
  h.camps.offsetAll([5, 0, 0]);
  assert.deepEqual(h.camps.camps[0].rec.pos, [5, 0, PLACE_AHEAD]); assert.deepEqual(h.camps.batches()[0].centers, [[5, 0, PLACE_AHEAD]], 'the batch follows the origin');
  h.camps.collectPixel('px:1'); assert.equal(h.camps.camps.length, 1, 'another pixel\'s sweep leaves it');
  h.camps.collectPixel('px:0'); assert.equal(h.camps.camps.length, 0, 'its own takes it');
  // pack: the gear comes home
  h.camps.restore(snap, (p) => [p[0] - 100, p[1], p[2]]);
  const k2 = h.camps.targets()[0].key;
  h.camps.activate(k2, 'grab'); const lastMenu = h.overlays.at(-1); lastMenu._pick(lastMenu.items.indexOf(CAMP_TEXT.menuPack));
  assert.equal(h.said.at(-1), CAMP_TEXT.packed); assert.equal(h.camps.camps.length, 0);
  assert.equal(h.entity.items.at(-1).templateIndex, TEMPLATE.CampingEquipment); assert.equal(h.entity.items.at(-1).currentCondition, 4);
  setWorldMinutes(0);
});

test('SURV3: the pool online - my camps as records, a peer\'s through the door and replacing theirs alone, never my own id; a quiet owner swept', async () => {
  setWorldMinutes(3000);
  const h = fakeHost();
  h.state.self = 'me';
  const kit = createSurvivalItem(TEMPLATE.Campfire, { condition: 5 });
  h.entity.items.push(kit);
  h.camps.placeItem(kit, h.entity.items);
  const recs = h.camps.wireRecords((p) => [p[0] + 1000, p[1], p[2]]);
  assert.equal(recs.length, 1); assert.equal(recs[0].k, 1); assert.equal(recs[0].p[0], 1000); assert.equal(recs[0].u, 3000 + FIRE_MINUTES);
  assert.ok(recs[0].i.startsWith('me:'));
  const theirs = { i: 'p1:1', k: 0, p: [1020, 0, 0], y: 0, u: 3400, w: 3 };
  assert.equal(h.camps.applyOwner('p1', [theirs], (p) => [p[0] - 1000, p[1], p[2]], 100), true);
  await settle();
  assert.equal(h.camps.camps.length, 2); assert.equal(h.camps.own().length, 1, 'theirs is not mine');
  assert.equal(h.camps.byFire([20, 0, 0]), true, 'their fire warms me');
  assert.equal(h.camps.activate(`camp:p1:1`, 'info'), true); assert.equal(h.said.at(-1), CAMP_TEXT.seeCamp);
  h.camps.activate('camp:p1:1', 'grab');
  assert.deepEqual(h.overlays.at(-1).items, [CAMP_TEXT.menuRest, CAMP_TEXT.menuCook], 'no packing another\'s');
  assert.equal(h.camps.applyOwner('me', [theirs], undefined, 100), false, 'my own id is never a peer\'s word');
  assert.equal(h.camps.applyOwner('p1', [{ ...theirs, u: 3900 }], (p) => [p[0] - 1000, p[1], p[2]], 200), true);
  assert.equal(h.camps.camps.find((c) => c.owner === 'p1').rec.litUntil, 3900, 'an unchanged spot keeps its batch and takes the new fire');
  h.camps.applyOwner('p1', [], undefined, 300);
  assert.equal(h.camps.camps.length, 1, 'an empty word takes theirs down');
  h.camps.applyOwner('p1', [theirs], (p) => [p[0] - 1000, p[1], p[2]], 400);
  h.camps.sweepOwners(new Set(['p1']), 1000, 5000); assert.equal(h.camps.camps.length, 2, 'alive and fresh');
  h.camps.sweepOwners(new Set(['p1']), 6000, 5000); assert.equal(h.camps.camps.length, 1, 'quiet past the window');
  h.camps.applyOwner('p1', [theirs], (p) => [p[0] - 1000, p[1], p[2]], 7000);
  h.camps.sweepOwners(new Set(), 7000, 5000); assert.equal(h.camps.camps.length, 1, 'gone from the room');
  h.camps.destroyAll(); assert.equal(h.camps.camps.length, 0);
  setWorldMinutes(0);
});

test('SURV3: the race - a camp or a water source under the one ray beats what is farther and loses to what is nearer; the door counts', () => {
  const at = (key, distance) => ({ key, distance, reach: 3.2 });
  const camp = at('camp:1', 3), water = at('water:0', 4);
  assert.equal(raceActivation({ camp }).campWins, true);
  assert.equal(raceActivation({ camp, doorDistance: 2 }).campWins, false, 'a nearer door takes it');
  assert.equal(raceActivation({ camp, torch: at('droppedTorch:1', 2) }).campWins, false);
  assert.equal(raceActivation({ camp, torch: at('droppedTorch:1', 2) }).torchWins, true);
  assert.equal(raceActivation({ camp, torch: at('droppedTorch:1', 5) }).torchWins, false, 'and the torch loses to a nearer camp');
  assert.equal(raceActivation({ camp, water }).waterWins, false); assert.equal(raceActivation({ camp, water }).campWins, true);
  assert.equal(raceActivation({ water }).waterWins, true);
  assert.equal(raceActivation({ camp, wagon: at('eotbWagon', 1) }).wagonWins, true); assert.equal(raceActivation({ camp, wagon: at('eotbWagon', 9) }).wagonWins, false);
  assert.equal(raceActivation({ camp, personDistances: [1] }).nonPersonRival, 3, 'a camp is ground the person arm must beat');
  assert.equal(raceActivation({ camp, water, personDistances: [1] }).rival, 1);
  assert.equal(raceActivation({}).campWins, false); assert.equal(raceActivation({}).waterWins, false);
});

test('SURV3: the pack\'s hand-off - both skins close and hand the placeable to the host, or say why not; the scene cache carries the camps', () => {
  const r = { kind: 'pitchCamp', item: { templateIndex: TEMPLATE.CampingEquipment } };
  assert.deepEqual(useResultAction(r, { placeCamp: () => {} }), { kind: 'placeCamp', item: r.item, closeFirst: true });
  assert.deepEqual(useResultAction({ kind: 'placeFire', item: r.item }, {}), { kind: 'message', text: USE_PENDING.placeFire });
  assert.equal(USE_PENDING.pitchCamp, 'There is nowhere to set that up here.');
  const native = read('src/ui/nativeInventory.js');
  assert.match(native, /if \(r\.kind === 'pitchCamp' \|\| r\.kind === 'placeFire'\) \{\s*\n\s*if \(this\.hooks\.placeCamp\) \{ this\._closeSilently\(\); this\.hooks\.placeCamp\(r\.item, collection\); \}/);   // AUDIT SURV-TIERS: with the list it came from (the wagon's tent)
  const enh = read('src/ui/enhancedInventory.js');
  assert.match(enh, /if \(act\.kind === 'placeCamp'\) \{\s*\n\s*const place = deps\.placeCamp;\s*\n\s*onExit\(\);[^\n]*\n\s*place\(act\.item, collection\);/);
  const cache = createSceneCache();
  cacheScene(cache, 'x', { camps: [{ id: 'a', pos: [1, 2, 3] }], droppedTorches: [{ position: [1, 2, 3], time: 5, itemTemplateIndex: 247 }] });
  const back = restoreCachedScene(cache, 'x');
  assert.deepEqual(back.camps, [{ id: 'a', pos: [1, 2, 3] }]); assert.deepEqual(back.droppedTorches, [{ position: [1, 2, 3], time: 5, itemTemplateIndex: 247 }]);
});

test('SURV3: by source - the three hosts stand the pool, feed the race, draw the tents, hand the pack the ground, cache and save the camps, and share them online', () => {
  const world = read('src/scenes/world.js'), ext = read('src/scenes/exterior.js'), dc = read('src/scenes/dungeonContext.js'), modes = read('src/scenes/worldModes.js');
  for (const [name, src] of [['world', world], ['exterior', ext], ['dungeon', dc]]) {
    assert.match(src, /const camps = createCamps\(\{/, `${name}: stands the pool`);
    assert.match(src, /placeCamp: \(item, list\) => camps\.placeItem\(item, list \?\? playerEntity\.items \?\? \[\]\)/, `${name}: the pack's hand-off - off the list the item was used from (AUDIT SURV-TIERS)`);
    assert.match(src, /camps\.tick\(dt\)/, `${name}: the fires burn`);
  }
  for (const [name, src] of [['world', world], ['exterior', ext]]) {
    assert.match(src, /camp: _campPick,/, `${name}: the race takes the camp`); assert.match(src, /water: _springPick,/, `${name}: and the water source`);
    assert.match(src, /if \(_race\.campWins\) \{ if \(_campPick\.distance > _campPick\.reach\) setMidScreenText\(TOO_FAR_AWAY_TEXT\); else camps\.activate\(_campPick\.key, getInteractionMode\(\)\); \}/, `${name}: the camp's arm refuses out loud`);
    assert.match(src, /else if \(_race\.waterWins\) \{ if \(_springPick\.distance > _springPick\.reach\) setMidScreenText\(TOO_FAR_AWAY_TEXT\); else drinkAtSpring\(_springPick\.key\); \}/, `${name}: the water's arm`);
    assert.match(src, /camps\.draw\(renderer/, `${name}: the tents are drawn`);
    assert.match(src, /\.\.\.camps\.lights\(\), \.\.\.droppedTorches\.lights\(\)\)/, `${name}: the fires light`);
    assert.match(src, /openRest: \(\) => \{ townTalk\.closeOverlay\(\); toggleRest\(\); \}/, `${name}: the menu's picker leaves the slot before the rest window`);
    assert.match(src, /isWaterSourceFlat\(flat\.archive, flat\.record\) \|\| isDrySourceFlat\(flat\.archive, flat\.record\)/, `${name}: the fountains and wells off the block flats`);
    assert.match(src, /WATER_SOURCE_MODELS\.includes\(placed\.modelIdNum\)/, `${name}: the troughs off the models`);
    // AUDIT-WH P7 split the streaming host's builder from its
    // targets (one builder, three readers, no shared slot), so its
    // empty answer is the empty LIST rather than an empty array
    // literal. The law - nothing in the ray with the mod off - is
    // the same one.
    assert.match(src, /if \(!survivalOn\(\)\) return _springs;|survivalOn\(\) \? springs\.map/, `${name}: no water arm with the mod off`);
  }
  // world: the pixel sweep, the scene cache, the save envelope, the recenter, the cell's frames
  assert.doesNotMatch(world, /camps\.collectPixel\(key\)/, 'AUDIT SURV B: the streaming sweep spares a placed camp');
  // AUDIT SURV-TIERS (the third pass): the save's two converters are named once, for the save, the load and the teleport
  assert.match(world, /const campToNatives = \(pos\) => \{ const wc = state\.worldCoords\(pos\); return \[wc\.x, pos\[1\] - state\.compensation\[1\], wc\.z\]; \};/);
  assert.equal((world.match(/camps: camps\.snapshot\(campToNatives\)/g) ?? []).length, 1, 'the save envelope alone carries the camps (AUDIT SURV B: the scene cache no longer does)');
  assert.doesNotMatch(world, /camps\.restore\(arrived\.camps,/); assert.match(world, /camps\.restore\(restandAt\('pos'\)\(w\.camps\),/);   // TERRAIN-SCALE1: stood again on today's ground
  assert.match(world, /camps\.offsetAll\(r\.offset\);/);
  assert.match(world, /if \(cell && full\) frame\.c = camps\.wireRecords\(campToWire\);/, 'my camps ride my full foes frame (AUDIT SURV B: an empty list too)');
  assert.match(world, /exteriorFoes\.setOnCamps\(\(from, c, at\) => camps\.applyOwner\(from, c, campToScene, at\)\);/, 'a peer\'s arrive with their foes, off the pool\'s own apply');
  assert.match(read('src/scenes/exteriorFoes.js'), /if \(Array\.isArray\(data\.c\)\) _onCamps\?\.\(from, data\.c, _now\(\)\);[^\n]*\n\s*return true;/, 'past the pool\'s room test');
  assert.match(world, /if \(isCellRoom\(online\.room\)\) \{ const ids = ownerIds\(\); if \(ids\) camps\.sweepOwners\(ids, now, FOES_STALE_MS\); \}/, 'and go as their puppets do - the same liveness');
  assert.match(world, /if \(Array\.isArray\(data\?\.c\) && !\(data\?\.a\?\.length\) && !\(data\?\.l\?\.length\)\) return actFrameFits\(data\) \? online\.sendAct\(data\) : false;/, 'a camp frame stands alone - goes now or is said again');
  assert.doesNotMatch(world, /_torchesMode\) \{ droppedTorches\.destroyAll\(\); camps/, 'a camp survives a building visit; the torches\' sweep is theirs');
  // dungeon: fire only, the act and the memory
  assert.match(dc, /insideBuilding: false, insideDungeon: true, inTown: false/);
  assert.match(dc, /onChanged: \(\) => \{ const c = camps\.wireRecords\(\); opts\.onActions\?\.\(\{ k: _locationKey, c: c\.length \? c : \[\] \}\); \}/, 'a placed fire goes out as an act');
  assert.match(dc, /if \(Array\.isArray\(data\.c\)\) camps\.applyOwner\(id, data\.c\);/, 'another\'s lands through applyActions');
  assert.match(dc, /w\.camps = campMemory\(\);/); assert.match(dc, /applyCampMemory\(shared\.world\.camps\);/);
  assert.match(dc, /camps: camps\.snapshot\(\),/); assert.match(dc, /if \(truncate\) \{ camps\.dropOwn\(\); camps\.restore\(w\.camps\); \}/);
  assert.match(dc, /camps, campBatches: \(\) => camps\.batches\(\), campLights: \(\) => camps\.lights\(\),/);
  assert.match(modes, /\.\.\.dungeonCtx\.campLights\(\)(?:\.map\(_dgTint\))?, \.\.\.dungeonCtx\.torchLights\(\)(?:\.map\(_dgTint\))?\)/);   // AUDIT DISC19: the dungeon's colour on each, the candle alone white assert.match(modes, /\.\.\.dungeonCtx\.campBatches\(\), \.\.\.dungeonCtx\.torchBatches\(\)/);
  // AUDIT-WH2 L2-F1: ...and `hearth:` beside it. HEARTH1 says all FOUR
  // HOSTS stand a ray target on a world fire that opens the cooking
  // list; the dungeon collected the fires, stood them and named them
  // 'Fire' without ever growing the arm, so E on a brazier underground
  // was eaten in silence while the same object worked outdoors and
  // indoors. `camps.activate` already routed both keys.
  assert.match(dc, /if \(kind === 'camp' \|\| kind === 'hearth'\) return camps\.activate\(key, mode\) \? 1 : 0;/);
  assert.match(dc, /targets\.push\(\.\.\.camps\.targets\(\)\);/);
  assert.match(dc, /camps\.destroyAll\(\);[^\n]*\n\s*droppedTorches\.destroyAll\(\);\s*\n\s*weaponRig\.dispose\?\.\(\);/, 'the teardown frees the fires');
  assert.match(modes, /key\.startsWith\('droppedTorch:'\) \|\| key\.startsWith\('camp:'\)/);
  // the law is pure, and off the formulas -> equip cycle
  const law = read('src/systems/survival/camp.js');
  assert.doesNotMatch(law, /from '\.\.\/\.\.\/scenes\/|from '\.\.\/\.\.\/ui\/|from '\.\.\/\.\.\/combat\/|from '\.\.\/spellcast|from '\.\.\/diseases|from '\.\.\/effects|document\.|window\./);
  assert.equal(worldMinutes(), 0);
});
