// AUDIT 68 (2026-09-24), cluster systems_d - src/systems (equip's one
// act, Horse Cart and Cargo's runtime and pool, the ammunition registry,
// the item info readers, Immersive Footsteps' loads, the one weight law).
// Each pin drives the producer's own output and failed on the base.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { createHandheldTorches, readTorchSettings, HANDHELD_TORCHES_VENDOR, ON_STOW, ON_PICK } from '../src/systems/handheldTorches.js';
import { createDroppedTorches } from '../src/scenes/droppedTorches.js';
import { MOD_SETTINGS } from '../src/systems/modSettings.js';
import { TEMPLATES } from '../src/systems/useItem.js';
import { equipItem, equipTableOf, addEquipChangeListener, EQUIP_SLOTS } from '../src/systems/equip.js';
import { assignQuickslot, swapQuickslot, clearQuickslots } from '../src/systems/quickslots.js';
import { createWeapon } from '../src/combat/enemyEquipment.js';
import { mintCondition, setItemFields, itemBaseValue } from '../src/systems/itemTemplates.js';
import { createPellets } from '../src/systems/thunderlock.js';
import { unitWeightInKg, itemWeight, weightForMaterial as inventoryWeightForMaterial } from '../src/systems/inventory.js';
import { weightForMaterial } from '../src/characters/weapons.js';
import { itemLongName, itemInfoTextId, itemDamageLine, itemHandsLine, itemStatRows, expandItemInfo, INFO_TEXT } from '../src/systems/itemInfo.js';
import { createHorseCartPool } from '../src/scenes/horseCartPool.js';
import { HORSE_VIEWS, HORSE_WALK_FRAMES, HORSE_SPRITE_WIDTH, HORSE_SPRITE_HEIGHT } from '../src/systems/horseCartLaw.js';
import { createImmersiveFootsteps, readFootstepSettings, IMMERSIVE_FOOTSTEPS_VENDOR } from '../src/systems/immersiveFootsteps.js';
import { makeWorld } from './hccWorld.mjs';

const T = TEMPLATES;
const flush = async (n = 8) => { for (let i = 0; i < n; i++) await new Promise((r) => setTimeout(r, 0)); };
const settingsOf = (vendor, over = {}) => ({ ...Object.fromEntries(Object.entries(MOD_SETTINGS[vendor].keys).map(([k, d]) => [k, d.default])), ...over });

// ── S27-ht-equip-midswap ────────────────────────────────────────────
const minted = (group, templateIndex, material) => mintCondition(setItemFields({ group, templateIndex, material, flags: 0 }));
const kiteShield = () => minted('Armor', 111, 0x0200);

/** A player with a sword and a kite shield worn, weapon drawn, both hands
 *  busy - and a torch picked up off the floor through the dropped-torch
 *  pool's own mint, which (OnPick Equip, no hand free) STOWS it and
 *  remembers it as the light to take up when a hand frees. */
function busyHandsWithStowedTorch({ sheathed = false } = {}) {
  const store = settingsOf(HANDHELD_TORCHES_VENDOR, { 'Handling.OnStow': ON_STOW.Drop, 'Handling.OnPick': ON_PICK.Equip });
  const said = [];
  const entity = { items: [], lightSource: null, stats: { speed: 50, strength: 50 }, activeEffects: [] };
  const renderer = { uploadTexture() {}, uploadEmissionTexture() {}, createBillboardBatch: () => ({ frame: 0 }), destroyBillboardBatch() {} };
  const pool = createDroppedTorches({ renderer, entity, settings: () => readTorchSettings(() => store), rolls: () => 0.5, loadTexture: async () => null });
  const h = createHandheldTorches({
    settings: () => readTorchSettings(() => store), audio: { playOneShot() {}, loop: () => ({ stop() {} }), play3d() {} },
    say: (l) => said.push(l), rolls: () => 0.5, torches: () => pool, handedness: () => false, loadSprite: async () => null,
  });
  pool.setOnPickedUp((item) => h.receivePickedUp(item));
  const ctx = {
    renderer: null, canvas: { width: 640, height: 400 }, entity, machine: { state: 'Idle' }, sheathed, usingRightHand: true,
    castPlaying: false, spellArmed: false, thirdPerson: false, climbing: false, swimming: false, transformedLycanthrope: false,
    motion: { grounded: true, standing: true, speedRatio: 1, baseSpeed: 1, localVel: [0, 0, 0] }, look: [0, 0], swingHeld: false, cursorActive: false,
    camera: () => ({ pos: [0, 1.7, 0], feet: [0, 0, 0], yaw: 0, pitch: 0, forward: [0, 0, 1], right: [1, 0, 0], up: [0, 1, 0] }),
    collider: () => null, keyDown: () => false, sheathWeapons: () => { ctx.sheathed = true; },
  };
  const sword = createWeapon(120, 0), shield = kiteShield();
  entity.items.push(sword, shield);
  equipItem(entity, sword); equipItem(entity, shield);
  h.update(0.016, ctx); h.lateUpdate(0.016, ctx);
  const d = pool.spawnLightSource(T.Torch, [0, 0, 1], 1000);
  pool.activate(`droppedTorch:${d.id}`, 'grab');
  const torch = entity.items.find((it) => it.templateIndex === T.Torch);
  assert.ok(torch && h.lastLightSource === torch && entity.lightSource === null, 'the fixture: the picked-up torch is stowed and remembered');
  said.length = 0;
  return { entity, h, pool, said, torch };
}

test('AUDIT 68 S27-ht-equip-midswap: a swap is ONE act - every equip listener reads the finished table, never the slot the occupant just left', () => {
  const entity = { items: [] };
  const first = kiteShield(), second = kiteShield();
  entity.items.push(first, second);
  equipItem(entity, first);
  const seen = [];
  addEquipChangeListener((e) => { if (e === entity) seen.push(equipTableOf(e)[EQUIP_SLOTS.LeftHand]); });
  equipItem(entity, second);
  assert.deepEqual(seen, [second], 'told once, with the new shield already on the arm');
});

test('AUDIT 68 S27-ht-equip-midswap: swapping a shield for a shield keeps the stowed torch in the pack - Handheld Torches\' Drop never sees a free hand the finished swap does not have', () => {
  const r = busyHandsWithStowedTorch();
  const next = kiteShield();
  r.entity.items.push(next);
  equipItem(r.entity, next);
  assert.equal(r.pool.dropped.length, 0, 'nothing on the floor');
  assert.ok(r.entity.items.includes(r.torch), 'the torch is still in the pack');
  assert.equal(r.h.lastLightSource, r.torch, 'and still the light to take up');
  assert.deepEqual(r.said, [], 'and nothing was said - the hands never changed');
});

test('AUDIT 68 S27-ht-equip-midswap: the quickslot swap (the main hand emptied, then the swap weapon in) is one act too - a sheathed swap does not drop the stowed torch', () => {
  clearQuickslots();
  const r = busyHandsWithStowedTorch({ sheathed: true });
  const other = createWeapon(118, 0);
  r.entity.items.push(other);
  assignQuickslot('swap', other);
  const res = swapQuickslot({ entity: r.entity, say: () => {} });
  clearQuickslots();
  assert.equal(res.kind, 'swapped');
  assert.equal(equipTableOf(r.entity)[EQUIP_SLOTS.RightHand], other, 'the swap happened');
  assert.equal(r.pool.dropped.length, 0, 'nothing on the floor');
  assert.ok(r.entity.items.includes(r.torch), 'the torch is still in the pack');
});

// ── S27-hcc-changed-every-frame ─────────────────────────────────────
test('AUDIT 68 S27-hcc-changed-every-frame: an idle runtime (nothing owned, nothing shown) says nothing changed - no online word every frame', () => {
  const { w, step } = makeWorld({ cart: false, horse: false });
  step();
  const before = w.changed;
  step(100);
  assert.equal(w.changed, before, 'a hundred frames of nothing are not a hundred changes');
  // an owner on foot with the horse and the cart along: no wagon trails, so every frame's teardown tears down nothing
  const { w: w2, step: s2 } = makeWorld();
  s2(3);
  const idle = w2.changed;
  s2(60);
  assert.equal(w2.changed, idle, 'and says nothing');
});

// ── S27-hcc-walk-fetch-storm ────────────────────────────────────────
test('AUDIT 68 S27-hcc-walk-fetch-storm: a walk set that failed to load is not fetched again every frame - one batch, one warning', async () => {
  const fetched = [];
  const warned = [];
  const fetchFn = async (url) => {
    fetched.push(String(url));
    if (/Walk\./.test(String(url))) return { ok: false, status: 404 };
    return { ok: true, arrayBuffer: async () => new Uint8Array(8).buffer };
  };
  const decode = async () => ({ width: HORSE_SPRITE_WIDTH, height: HORSE_SPRITE_HEIGHT, data: new Uint8ClampedArray(HORSE_SPRITE_WIDTH * HORSE_SPRITE_HEIGHT * 4) });
  const renderer = { uploadTexture: () => 'k' };
  const pool = createHorseCartPool({ renderer, fetchFn, decode, now: () => 0, log: { warn: (m) => warned.push(m), error() {} } });
  for (let frame = 0; frame < 6; frame++) { pool.presentation.horseArt.ensureWalk(); await flush(); }
  const walks = fetched.filter((u) => /Walk\./.test(u)).length;
  assert.equal(walks, HORSE_VIEWS * HORSE_WALK_FRAMES, 'the forty frames asked for once');
  assert.equal(warned.length, 1, 'and the failure said once');
  assert.equal(pool.presentation.horseArt.hasWalk(), false, 'the standing views stay');
});

// ── S27-ammo-arrow-only ─────────────────────────────────────────────
test('AUDIT 68 S27-ammo-arrow-only: the Dwemer Pellet is ammunition to every reader - its own weight and price, no material name, the ammunition record, no damage or hands rows', () => {
  const p = createPellets(10);
  assert.equal(unitWeightInKg(p), 0.2, 'a lead ball weighs its template\'s 0.2 kg - not the material ladder\'s trunc to nothing');
  assert.equal(itemWeight(p), 2, 'and ten weigh 2 kg');
  assert.equal(itemBaseValue(p), 4, 'the basePrice - twice an arrow, as designed - not 4 x 3 x the Iron band');
  assert.equal(p.value, 4, 'which is what the mint wrote');
  assert.equal(itemLongName(p), 'Dwemer Pellet', 'no "Iron" prefix');
  assert.equal(itemInfoTextId(p), INFO_TEXT.arrow, 'the ammunition record');
  assert.equal(itemDamageLine(p), null);
  assert.equal(itemHandsLine(p), null);
  // and the Arrow still reads as it always did
  const a = createWeapon(131, 0, () => 0.5);
  assert.equal(itemBaseValue(a), a.value);
  assert.equal(itemLongName(a), 'Arrow');
  assert.equal(itemInfoTextId(a), INFO_TEXT.arrow);
});

// ── S27-statrows-material-leak ──────────────────────────────────────
test('AUDIT 68 S27-statrows-material-leak: the quick-loot stat panel names no material the item\'s own name withholds', () => {
  const unidentified = { ...createWeapon(115, 9), enchantments: [{ type: 0, param: 5 }] };   // an enchanted Daedric staff, not yet identified
  assert.equal(itemLongName(unidentified), 'Staff', 'the name keeps the metal back');
  assert.ok(!itemStatRows(unidentified).some((r) => r.label === 'Material'), 'and so does the panel');
  const arrows = createWeapon(131, 0, () => 0.5);
  assert.ok(!itemStatRows(arrows).some((r) => r.label === 'Material'), 'an arrow has no material row');
  const iron = createWeapon(113, 0);
  assert.deepEqual(itemStatRows(iron).find((r) => r.label === 'Material'), { label: 'Material', text: 'Iron' }, 'a plain weapon still says what it is made of');
});

// ── S27-wth-nan ─────────────────────────────────────────────────────
test('AUDIT 68 S27-wth-nan: %wth reads the one value read - a NaN value (a pre-MAC-N1 save) is worth its template price, never "NaN"', () => {
  const dagger = { ...createWeapon(113, 0), value: NaN, stackCount: 2 };
  assert.equal(expandItemInfo('%wth', dagger), String(itemBaseValue(dagger) * 2));
});

// ── S27-if-load-clobber ─────────────────────────────────────────────
test('AUDIT 68 S27-if-load-clobber: a superseded clip load does not clear the newer load\'s marker - settle waits for it, and a volume change starts no third load', async () => {
  const store = settingsOf(IMMERSIVE_FOOTSTEPS_VENDOR, { 'AudioQualitySettings.SoundClipQuality': 0 });
  const held = [];
  let asked = 0;
  const c = createImmersiveFootsteps({
    audio: { registerSound: async () => true, playOneShot() {} }, settings: () => readFootstepSettings(() => store), random: () => 0,
    fetchClip: (name) => { asked++; return new Promise((res) => held.push({ name, go: () => res(new Uint8Array([1])) })); },
  });
  const m = { paused: false, entity: { items: [], activeEffects: [] }, grounded: true, standingStill: true, isRunning: false, movingLessThanHalfSpeed: false,
    transportMode: 0, swimming: false, pos: [0, 0, 0], inside: false, inDungeon: false, season: 0, climateIndex: 0, tileMapIndex: 2, waterWalking: false };
  c.update(0, m);                                        // load A (quality 0)
  const perLoad = asked;
  store['AudioQualitySettings.SoundClipQuality'] = 1;
  c.update(0, m);                                        // load B (quality 1) supersedes A
  assert.equal(asked, 2 * perLoad);
  for (const f of held.splice(0, perLoad)) f.go();       // A's clips come in; A settles, superseded
  await flush();
  let settled = false;
  c.settle().then(() => { settled = true; });
  await flush();
  assert.equal(settled, false, 'B is still in flight - settle waits for it');
  store['FootstepSettings.FootstepVolumeMulti'] = 2;
  c.update(0, m);                                        // any settings change
  assert.equal(asked, 2 * perLoad, 'no third load of the whole set');
  for (const f of held.splice(0)) f.go();
  await flush();
  assert.equal(settled, true);
  assert.equal(c.ownsStride(), true, 'B finished and the mod owns the stride');
});

// ── S27-weightForMaterial-dup ───────────────────────────────────────
test('AUDIT 68 S27-weightForMaterial-dup: CalculateWeightForMaterial has one home - the weight law reads it, and an unknown material weighs its base, never NaN', () => {
  assert.equal(inventoryWeightForMaterial, weightForMaterial, 'inventory.js reads weapons.js\'s, not a copy');
  assert.equal(weightForMaterial(6, 12), 6);
  assert.equal(weightForMaterial(6, 4), 4.5, 'the ladder itself unchanged');
});
