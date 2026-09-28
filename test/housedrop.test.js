// HOUSE-DROP (2026-09-27, Mac relaying reports: "In houses, players can drop items and the owner cannot see them";
// asked how it should work, "Block visitor drops"). A drop is the dropper's own (AUDIT WORLD B3) and an online home's
// room carries no loot (HOME1), so what a VISITOR left on another's floor stood on the visitor's screen alone. A visitor
// now drops nothing in someone else's online home: both inventory skins refuse the ground (never a wagon, a chest, a
// corpse or a merchant) with the line said, gold too; a light dropped or thrown is refused the same way; and anything
// that still reaches the window's close goes back to the pack. The owner's own floor, an offline house and every other
// building are as they were. Driven over the transfer law, the classic window and the torches, and the hosts by source.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { planStore, planDropGold } from '../src/systems/itemTransfer.js';
import { groundRefusalOf } from '../src/systems/inventorySession.js';
import { NativeInventoryWindow } from '../src/ui/nativeInventory.js';
import { createHandheldTorches, readTorchSettings, HANDHELD_TORCHES_VENDOR, ON_STOW } from '../src/systems/handheldTorches.js';
import { WEAPONS } from '../src/characters/weapons.js';
import { EQUIP_SLOTS } from '../src/systems/equip.js';
import { DEFAULT_BINDINGS } from '../src/systems/inputActions.js';
import { MOD_SETTINGS } from '../src/systems/modSettings.js';
import { TEMPLATES } from '../src/systems/useItem.js';

const rd = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const NO = 'You cannot drop items in another\'s home.';
const dagger = () => ({ group: 'Weapons', templateIndex: 113, name: 'Dagger', stackCount: 1, weightInKg: 0.5 });

test('HOUSE-DROP: the transfer law refuses the ground on the host\'s word, with the word said - an item and gold alike; no word, no refusal', () => {
  const p = planStore(dagger(), { remote: [], groundRefusal: NO });
  assert.deepEqual([p.ok, p.refusal.reason, p.refusal.text], [false, 'ground', NO]);
  assert.equal(planStore(dagger(), { remote: [] }).ok, true, 'no word: the ground takes it');
  const g = planDropGold('10', { carried: 50, groundRefusal: NO });
  assert.deepEqual([g.ok, g.refusal.text], [false, NO], 'gold on that floor too');
  assert.equal(planDropGold('10', { carried: 50 }).ok, true);
  assert.equal(planDropGold('10', { carried: 50, usingWagon: true, groundRefusal: NO }).ok, true, 'the wagon is no floor');
});

test('HOUSE-DROP: the host\'s word is asked only when the destination IS the ground - the session\'s dropped list or a pile the player dropped before - never the wagon, a chest, a corpse or a merchant', () => {
  const deps = { dropRefusal: () => NO };
  assert.equal(groundRefusalOf(deps, {}), NO, 'the dropped list');
  assert.equal(groundRefusalOf({ ...deps, loot: { items: () => [], playerOwned: true } }, {}), NO, 'my own old pile');
  assert.equal(groundRefusalOf({ ...deps, loot: { items: () => [] } }, {}), null, 'a chest or a corpse');
  assert.equal(groundRefusalOf(deps, { usingWagon: true }), null, 'the wagon');
  assert.equal(groundRefusalOf(deps, { chooseOne: { items: [] } }), null, 'a merchant\'s choice');
  assert.equal(groundRefusalOf({}, {}), null, 'a host with no word: the ground takes it');
});

test('HOUSE-DROP executed: in the classic window a visitor\'s drop is refused with the line and the item stays in the pack; with no word it drops as ever', () => {
  const ICONS = { getTexture: async () => ({ recordCount: 0 }), uploadRecord: () => {}, textures: new Map() };
  const e = { items: [dagger()], stats: {} };
  const w = new NativeInventoryWindow({ items: () => e.items, entity: e, icons: ICONS, dropRefusal: () => NO });
  w.mode = 'remove';
  w._pick(0);
  assert.equal(e.items.length, 1, 'the dagger stays in the pack');
  assert.equal(w.dropped.length, 0, 'nothing on the floor');
  assert.equal(w.boxes?.[0]?.rows?.[0]?.text, NO, 'and the line is said');
  const f = { items: [dagger()], stats: {} };
  const v = new NativeInventoryWindow({ items: () => f.items, entity: f, icons: ICONS });
  v.mode = 'remove';
  v._pick(0);
  assert.equal(f.items.length, 0);
  assert.equal(v.dropped.length, 1, 'no word: it drops as it always did');
});

test('HOUSE-DROP executed: a light dropped or thrown on a floor that refuses it is said and stays in hand; with no word it lands', () => {
  const store = { ...Object.fromEntries(Object.entries(MOD_SETTINGS[HANDHELD_TORCHES_VENDOR].keys).map(([k, d]) => [k, d.default])), 'Handling.LanternsAtWaist': false };
  const make = (dropRefusal) => {
    const said = [];
    const pool = { spawned: [], thrown: [], spawnLightSource: (t, p, time) => pool.spawned.push({ t, p, time }), spawnLightSourceProjectile: (...a) => pool.thrown.push(a), setOnPickedUp() {} };
    const h = createHandheldTorches({ settings: () => readTorchSettings(() => store), audio: null, say: (l) => said.push(l), rolls: () => 0.5, torches: () => pool, dropRefusal, loadSprite: async () => null });
    return { h, said, pool };
  };
  const torch = () => ({ group: 'UselessItems2', templateIndex: TEMPLATES.Torch, currentCondition: 50, maxCondition: 50 });
  const refused = make(() => NO);
  refused.h.dropLightSourceAction(torch());
  refused.h.throwLightSourceAction(torch(), 1);
  assert.deepEqual(refused.said, [NO, NO], 'both said');
  assert.equal(refused.pool.spawned.length + refused.pool.thrown.length, 0, 'and nothing lands');
  const free = make(() => null);
  free.h.dropLightSourceAction(torch());
  assert.equal(free.pool.spawned.length, 1, 'no word: the light lands as ever');
});

test('HOUSE-DROP by source: the building\'s refusal is a VISITOR\'s in someone else\'s online home alone; the windows ask it, gold too; the close hands anything that slipped through back to the pack; the rig hands it to the torches', () => {
  const wm = rd('src/scenes/worldModes.js');
  assert.match(wm, /const visitorDropRefusal = \(\) => \(interiorHome && !interiorHome\.own && mode === 'interior' \? HOME_VISITOR_DROP_TEXT : null\);/, 'the owner, an offline house and every other building are untouched');
  assert.match(wm, /const no = visitorDropRefusal\(\);\n\s*if \(no\) \{ for \(const it of \[\.\.\.items\]\) takeOneInto\(playerEntity, items, it\); say\(no\); return null; \}/, 'the belt at the close: back to the pack, gold to the counter');
  assert.match(wm, /dropRefusal: \(\) => visitorDropRefusal\(\),\n/, 'the window asks');
  assert.match(wm, /dropRefusal: \(\) => visitorDropRefusal\(\),   \/\/ HOUSE-DROP: and a light/, 'and the rig');
  assert.match(rd('src/combat/weaponRig.js'), /createHandheldTorches\(\{ audio, say, torches, dropRefusal \}\)/);
  const nat = rd('src/ui/nativeInventory.js'), enh = rd('src/ui/enhancedInventory.js');
  assert.equal((nat.match(/groundRefusal: groundRefusalOf\(this\.hooks, \{ usingWagon: this\.usingWagon, chooseOne: this\.chooseOne \}\)/g) ?? []).length, 2, 'the classic window: the item and the gold');
  assert.match(nat, /if \(!plan\.ok\) \{ if \(plan\.refusal\?\.reason === 'ground'\) this\._refuse\(plan\.refusal\); return; \}/, 'and the gold\'s refusal is said');
  assert.equal((enh.match(/groundRefusal: groundRefusalOf\(deps, session\)/g) ?? []).length, 5, 'the enhanced skin: every store plan, its dry runs and the gold');
  assert.match(enh, /else if \(!plan\.ok && plan\.refusal\?\.reason === 'ground'\) notice = plan\.refusal\.text;/);
});

// ---- AUDIT (the pre-merge audit, 2026-09-27, Mac: "Audit before we merge"): the torch's two refusals, driven through the
// component's own frame (the auditor's rig): the hand law and the throw key.
const KEY = Object.fromEntries(DEFAULT_BINDINGS.map(([code, action]) => [action, code]));
function torchRig(over = {}, dropRefusal = () => NO) {
  const store = { ...Object.fromEntries(Object.entries(MOD_SETTINGS[HANDHELD_TORCHES_VENDOR].keys).map(([k, d]) => [k, d.default])), 'Handling.LanternsAtWaist': false, ...over };
  const said = [];
  const entity = { items: [], equip: { slots: {} }, lightSource: null, stats: { speed: 50, strength: 50 }, activeEffects: [] };
  const pool = { spawned: [], thrown: [], spawnLightSource: (t, p, time) => pool.spawned.push({ t, p, time }), spawnLightSourceProjectile: (...a) => pool.thrown.push(a), setOnPickedUp() {} };
  const keys = new Set();
  const h = createHandheldTorches({ settings: () => readTorchSettings(() => store), audio: null, say: (l) => said.push(l), rolls: () => 0.5, torches: () => pool, dropRefusal, handedness: () => false, loadSprite: async () => null });
  const ctx = {
    renderer: null, canvas: { width: 640, height: 400 }, entity, machine: { state: 'Idle' }, sheathed: false, usingRightHand: true,
    castPlaying: false, spellArmed: false, thirdPerson: false, climbing: false, swimming: false, transformedLycanthrope: false,
    motion: { grounded: true, standing: true, speedRatio: 1, baseSpeed: 1, localVel: [0, 0, 0] }, look: [0, 0], swingHeld: false, cursorActive: false,
    camera: () => ({ pos: [0, 1.7, 0], feet: [0, 0, 0], yaw: 0, pitch: 0, forward: [0, 0, 1], right: [1, 0, 0], up: [0, 1, 0] }),
    collider: () => null, actionDown: (a) => keys.has(KEY[a]), sheathWeapons: () => { ctx.sheathed = true; },
  };
  const frame = (dt = 0.016) => { h.update(dt, ctx); h.lateUpdate(dt, ctx); };
  const t = { group: 'UselessItems2', templateIndex: TEMPLATES.Torch, currentCondition: 50, maxCondition: 50 };
  entity.items = [t]; entity.lightSource = t;
  return { h, said, entity, pool, keys, frame, t };
}

test('AUDIT pre-merge I-C executed: with OnStow = Drop, a full hand in a visitor\'s home STOWS the light (as Unequip does) - the drop refused every frame held it lit and said the refusal forever', () => {
  const r = torchRig({ 'Handling.OnStow': ON_STOW.Drop });
  r.entity.equip.slots[EQUIP_SLOTS.LeftHand] = { group: 'Weapons', templateIndex: WEAPONS.Long_Bow };
  for (let i = 0; i < 60; i++) r.frame();
  assert.equal(r.entity.lightSource, null, 'the light is out of the hand');
  assert.equal(r.h.lastLightSource, r.t, 'remembered, as a stowed light is');
  assert.equal(r.pool.spawned.length, 0, 'nothing on the floor');
  assert.equal(r.said.filter((l) => l === NO).length, 0, 'and no refusal said every frame');
  const own = torchRig({ 'Handling.OnStow': ON_STOW.Drop }, () => null);
  own.entity.equip.slots[EQUIP_SLOTS.LeftHand] = { group: 'Weapons', templateIndex: WEAPONS.Long_Bow };
  own.frame();
  assert.equal(own.pool.spawned.length, 1, 'my own floor: it drops, as the setting says');
});

test('AUDIT pre-merge I-D executed: the throw key on a floor that refuses the throw keeps the light lit through the wind-up; the release says why and throws nothing', () => {
  const r = torchRig();
  r.keys.add(KEY.TorchThrow); r.frame(); r.frame();
  assert.equal(r.entity.lightSource, r.t, 'still lit while the key is held (the wind-up douses only a throw that will land)');
  r.keys.delete(KEY.TorchThrow); r.frame();
  assert.equal(r.entity.lightSource, r.t, 'and after the release');
  assert.equal(r.pool.thrown.length, 0, 'nothing thrown');
  assert.ok(r.entity.items.includes(r.t), 'still in the pack');
  assert.ok(r.said.includes(NO), 'the refusal said');
  const own = torchRig({}, () => null);
  own.keys.add(KEY.TorchThrow); own.frame(); own.frame();
  assert.equal(own.entity.lightSource, null, 'on my own floor the wind-up douses it, as the mod does');
});
